"""Integration checks for text, paths, atomic writes, bounded work and resumability.

Run with the project .venv through uv. Tests use no neural model or GPU.
"""
import contextlib
import fcntl
import importlib.util
import io
from pathlib import Path
import sys
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import numpy as np

spec = importlib.util.spec_from_file_location('tts_engine', Path(__file__).with_name('tts_engine.py'))
E = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = E
spec.loader.exec_module(E)


class EngineTests(unittest.TestCase):
    def setUp(self):
        cache = E.ROOT/'.cache/tts-tests'
        cache.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=cache)
        self.root = Path(self.temporary.name)
        self.cache_patch = patch.object(E, 'CACHE', self.root/'state')
        self.cache_patch.start()

    def tearDown(self):
        self.cache_patch.stop()
        self.temporary.cleanup()

    def test_markup_and_inline_words(self):
        cases = {
            '**==architect==**<!--search: architect | zh#1-->':'architect',
            '<span>market-<strong>oriented</strong></span>':'market-oriented',
            '[[target|display]] and [a link](https://example.org)':'display and a link',
            'word![[a.mp3]] %%hidden%%[^1]':'word',
            'one<br />two&nbsp;&amp;&nbsp;three':'one two and three',
            "don't change well-known words":"don't change well-known words",
            'take ... into account':'take, into account',
            'word<!-- multi-line\nhidden --> next':'word next',
            '<script>bad text</script>good':'good',
        }
        for source, expected in cases.items():
            with self.subTest(source=source):
                self.assertEqual(E.clean_spoken_text(source), expected)
        self.assertEqual(E.table_cells('| [[word|alias]] | **a** phrase | meaning |'),
                         ['[[word|alias]]', '**a** phrase', 'meaning'])

    def test_real_note_plan_and_source_protection(self):
        note = E.ROOT/'02. word/b. 剑雅阅读真题/01-自然地理.md'
        before = note.read_bytes()
        tasks = E.plan_notes([note], True)
        self.assertEqual(len(tasks), 344)
        self.assertEqual(sum(t.kind == 'word' for t in tasks), 172)
        self.assertEqual(sum(t.kind == 'chunk' for t in tasks), 172)
        self.assertEqual(len({t.output for t in tasks}), 344)
        self.assertEqual(note.read_bytes(), before)
        with self.assertRaises(ValueError):
            E.check_output(E.ROOT/'20. resource/05. listening/test/audio/chunk_example.mp3')
        with self.assertRaises(ValueError):
            E.check_output(E.ROOT/'20. resource/01. base/b.connected/audio/test.mp3')
        with self.assertRaises(ValueError):
            E.check_output(E.ROOT/'test.mp3')

    def test_invalid_or_failed_encode_preserves_previous_file(self):
        target = self.root/'preserved.wav'
        target.write_bytes(b'previous recording')
        with self.assertRaises(ValueError):
            E.encode_audio_to_mp3(np.array([np.nan]), 24000, target)
        self.assertEqual(target.read_bytes(), b'previous recording')
        with patch.object(E, 'inspect_audio', side_effect=RuntimeError('forced decode rejection')):
            with self.assertRaises(RuntimeError):
                E.encode_audio_to_mp3(np.ones(7200, dtype=np.float32)*0.1, 24000, target)
        self.assertEqual(target.read_bytes(), b'previous recording')
        self.assertEqual(list(self.root.glob('.tts-*')), [])

    def test_single_model_cpu_pipeline_and_resume(self):
        main_thread = threading.get_ident()
        gpu_threads, encoder_threads = [], set()
        active, maximum = 0, 0
        mutex = threading.Lock()

        class FakeModel:
            peak_bytes = 1024

            def create(self, text, **kwargs):
                gpu_threads.append(threading.get_ident())
                return np.sin(np.arange(7200, dtype=np.float32)*0.05)*0.1, 24000

        original_encoder = E.encode_audio_to_mp3

        def checked_encoder(*args):
            nonlocal active, maximum
            with mutex:
                encoder_threads.add(threading.get_ident())
                active += 1
                maximum = max(maximum, active)
            try:
                return original_encoder(*args)
            finally:
                with mutex:
                    active -= 1

        tasks = [E.Task(f'example {i}', self.root/f'{i}.mp3') for i in range(6)]
        with contextlib.redirect_stdout(io.StringIO()), patch.object(E, 'swap_bytes', return_value=0), patch.object(E, 'load_kokoro', return_value=FakeModel()) as loader, patch.object(E, 'encode_audio_to_mp3', side_effect=checked_encoder):
            E.generate(tasks, 'bf_emma', 1.0, encoder_workers=18)
            self.assertEqual(loader.call_count, 1)
        self.assertEqual(gpu_threads, [main_thread]*6)
        self.assertLessEqual(maximum, 2)
        self.assertLessEqual(len(encoder_threads), 2)
        for task in tasks:
            self.assertEqual(E.inspect_audio(task.output, apple=True)['sample_rate'], 44100)
        with contextlib.redirect_stdout(io.StringIO()), patch.object(E, 'load_kokoro', side_effect=AssertionError('Resume loaded a GPU model')):
            E.generate(tasks, 'bf_emma', 1.0)
        tasks[0].output.write_bytes(b'corrupt cache')
        gpu_threads.clear()
        with contextlib.redirect_stdout(io.StringIO()), patch.object(E, 'load_kokoro', return_value=FakeModel()):
            E.generate(tasks, 'bf_emma', 1.0)
        self.assertEqual(len(gpu_threads), 1)

    def test_second_job_cannot_start_another_model(self):
        E.CACHE.mkdir(parents=True, exist_ok=True)
        task = E.Task('example', self.root/'example.mp3')
        with (E.CACHE/'gpu.lock').open('a') as held:
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with patch.object(E, 'load_kokoro', side_effect=AssertionError('Loaded a second model')):
                with self.assertRaisesRegex(RuntimeError, 'GPU lock'):
                    E.generate([task], 'bf_emma', 1.0)

    def test_long_sentence_can_exceed_two_gib_without_being_split(self):
        sentence = 'A complete reading sentence ' + 'with natural connected wording ' * 12 + 'ends here.'
        received = []
        samples = np.sin(np.arange(24000, dtype=np.float32)*0.05)*0.1

        def generate(text, **kwargs):
            received.append(text)
            return SimpleNamespace(audio=samples, sample_rate=24000)

        core = SimpleNamespace(get_peak_memory=lambda:5*1024**3,
                               synchronize=lambda:None, clear_cache=lambda:None)
        model = E.KokoroMLX.__new__(E.KokoroMLX)
        model.initial_swap, model.peak_bytes = 0, 0
        model._tts = SimpleNamespace(generate=generate)
        with patch.dict(sys.modules, {'mlx':SimpleNamespace(core=core), 'mlx.core':core}), patch.object(E, 'swap_bytes', return_value=0):
            audio, rate = model.create(sentence)
        self.assertEqual(received, [sentence])
        self.assertEqual(rate, 24000)
        self.assertGreater(len(audio), 0)
        self.assertEqual(model.peak_bytes, 5*1024**3)

    def test_memory_pressure_stops_before_starting_model(self):
        task = E.Task('example', self.root/'example.mp3')
        with patch.object(E, 'swap_bytes', side_effect=[0, 512*1024**2]), patch.object(E, 'load_kokoro', side_effect=AssertionError('Loaded after swap pressure')):
            with self.assertRaises(E.ResourcePressure):
                E.generate([task], 'bf_emma', 1.0)

    def test_encoder_failure_is_reported_and_keeps_old_output(self):
        task = E.Task('example', self.root/'example.mp3')
        task.output.write_bytes(b'old output')

        class FakeModel:
            peak_bytes = 0

            def create(self, *args, **kwargs):
                return np.ones(7200, dtype=np.float32)*0.1, 24000

        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()), patch.object(E, 'load_kokoro', return_value=FakeModel()), patch.object(E, 'encode_audio_to_mp3', side_effect=RuntimeError('encoder failed')):
            with self.assertRaisesRegex(RuntimeError, '1 files failed'):
                E.generate([task], 'bf_emma', 1.0)
        self.assertEqual(task.output.read_bytes(), b'old output')
        self.assertIn('encoder failed', (E.CACHE/'progress.jsonl').read_text())

    def test_interrupt_preserves_verified_inflight_file(self):
        tasks = [E.Task(f'example {i}', self.root/f'{i}.mp3') for i in range(2)]

        class InterruptedModel:
            peak_bytes = 0
            calls = 0

            def create(self, *args, **kwargs):
                self.calls += 1
                if self.calls == 2:
                    raise KeyboardInterrupt()
                return np.sin(np.arange(7200, dtype=np.float32)*0.05)*0.1, 24000

        with contextlib.redirect_stdout(io.StringIO()), patch.object(E, 'load_kokoro', return_value=InterruptedModel()):
            with self.assertRaises(KeyboardInterrupt):
                E.generate(tasks, 'bf_emma', 1.0)
        self.assertEqual(E.inspect_audio(tasks[0].output)['sample_rate'], 44100)
        self.assertFalse(tasks[1].output.exists())


if __name__ == '__main__':
    unittest.main()

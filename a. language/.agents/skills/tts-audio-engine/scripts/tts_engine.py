#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["kokoro-mlx==0.1.3", "numpy", "soundfile"]
# ///
"""Emma TTS: one GPU model, bounded CPU encoders, verified atomic MP3 output.

Use the project .venv via uv; audit/dry-run never load a model. No implicit
downloads, dependency installs, destructive cleanup or background GPU jobs.
"""
from __future__ import annotations

import argparse
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from dataclasses import dataclass
import fcntl
import gc
import hashlib
from html.parser import HTMLParser
import importlib.metadata
import importlib.util
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata
import uuid

ROOT = Path(__file__).resolve().parents[4]
WORKSPACE_ROOT = str(ROOT)
CACHE = ROOT / '.cache/tts'
KOKORO_MLX_DIR = str(ROOT / '20. resource/20. common/kokoro/Kokoro-82M-bf16')
DEFAULT_VOICE = WORD_VOICE = CHUNK_VOICE = 'bf_emma'
VERSION = 'emma-mlx-v2'
SOURCE_SIGNATURE = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
NATIVE_RATE = 24000
OUTPUT_RATE = 44100  # MPEG-1 compatibility; resampling adds no source detail.
VOICE_MAP = {'emma':'bf_emma', 'isabella':'bf_isabella', 'lewis':'bm_lewis',
             'alice':'bf_alice', 'lily':'bf_lily', 'daniel':'bm_daniel',
             'george':'bm_george', 'fable':'bm_fable'}
SOURCE_ROOTS = {'01. base', '02. word', '03. phrase', '04. grammer', '05. listening',
                '06. reading', '07. writing', '09. speaking', '10. practice'}
CHUNK_COLUMN_NAMES = ('短语', '意群', '意思单位', '意思单元')
CENTRAL_LISTENING = '02. word/m. 剑雅听力真题/音义词块.md'


class TextOnly(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.hidden = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in {'script', 'style'}:
            self.hidden += 1
        elif tag in {'br', 'p', 'div', 'li', 'tr'}:
            self.parts.append(' ')

    def handle_endtag(self, tag):
        if tag in {'script', 'style'}:
            self.hidden = max(0, self.hidden-1)
        elif tag in {'p', 'div', 'li', 'tr'}:
            self.parts.append(' ')

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def strip_html_comments(text):
    return re.sub(r'<!--[\s\S]*?-->', '', text)


def clean_spoken_text(text):
    text = strip_html_comments(str(text))
    text = re.sub(r'%%[\s\S]*?%%', '', text)
    text = re.sub(r'!\[\[[\s\S]*?\]\]', '', text)
    text = re.sub(r'!\[[^\]]*\]\([^\n]*?\)', '', text)
    text = re.sub(r'\[\[([^\]]+)\]\]', lambda m: m[1].split('|')[-1], text)
    text = re.sub(r'\[([^\]]+)\]\([^\n]*?\)', r'\1', text)
    text = re.sub(r'(?m)^\s*\[\^[^\]]+\]:.*$', '', text)
    text = re.sub(r'\[\^[^\]]+\]', '', text)
    parser = TextOnly()
    parser.feed(text)
    text = ''.join(parser.parts).replace('\xa0', ' ')
    text = re.sub(r'\\([\\`*_{}\[\]()#+\-.!|>])', r'\1', text)
    text = re.sub(r'(?m)^\s*(?:>\s*|[-+]\s+)', '', text)
    text = re.sub(r'[\*=_~`#🎧🔊]', '', text)
    text = re.sub(r'\.{3,}|…+', ', ', text).replace('&', ' and ')
    text = re.sub(r'\s+', ' ', text).strip()
    return re.sub(r'\s+([,;.!?])', r'\1', text)


def to_slug(text):
    text = unicodedata.normalize('NFD', clean_spoken_text(text).lower())
    text = re.sub(r'[\u0300-\u036f]', '', text)
    text = re.sub(r"['’]", '_', text)
    return re.sub(r'_+', '_', re.sub(r'[^\w-]', '_', text)).strip('_')


def article_audio_dir(md_path):
    path = Path(md_path).resolve()
    try:
        relative = path.relative_to(ROOT)
    except ValueError:
        return None
    if relative.parts[0] not in SOURCE_ROOTS or path.suffix.lower() != '.md':
        return None
    return str(ROOT/'20. resource'/relative.with_suffix('')/'audio')


def table_cells(line):
    """Do not split escaped pipes or wikilink aliases into new table cells."""
    result, current, depth = [], [], 0
    for token in re.findall(r'\\.|\[\[|\]\]|.', line.strip().strip('|')):
        if token == '[[':
            depth += 1
        elif token == ']]':
            depth = max(0, depth-1)
        if token == '|' and depth == 0:
            result.append(''.join(current).strip())
            current = []
        else:
            current.append(token)
    result.append(''.join(current).strip())
    return result


def table_entries(note):
    """Yield source/headword/phrase; never feed definition columns to TTS."""
    note = Path(note).resolve()
    central = note.relative_to(ROOT).as_posix() == CENTRAL_LISTENING
    section, header = '', None
    for line in strip_html_comments(note.read_text()).splitlines():
        if line.startswith('# '):
            section = line[2:].strip()
        if not line.lstrip().startswith('|'):
            header = None
            continue
        cells = table_cells(line)
        if all(re.fullmatch(r':?-+:?', cell) for cell in cells):
            continue
        is_header = len(cells) >= 2 and (cells[1] in CHUNK_COLUMN_NAMES or cells[0] == '意群')
        is_header |= bool(cells and cells[0] in {'单词', '词汇', '核心词', '音义词块', '考点词', '答案词'})
        if is_header:
            header = cells
            continue
        if not header or not cells:
            continue
        # 意群列在首列时(`意群 | 单词 | 释义 | 拆解`), 词在第 2 列
        word_index = 1 if header[0] == '意群' and len(cells) > 1 else 0
        if not cells[word_index]:
            continue
        word = clean_spoken_text(re.split(r'<br\s*/?>', cells[word_index], flags=re.I)[0])
        index = next((i for i in range(len(header)) if header[i] in CHUNK_COLUMN_NAMES and i != word_index), None)
        phrases = re.split(r'<br\s*/?>', cells[index], flags=re.I) if index is not None and index < len(cells) else ['']
        source = ROOT/'05. listening'/(section+'.md') if central else note
        if central and not source.is_file():
            raise ValueError(f'Missing listening source: {source}')
        for phrase in phrases:
            yield source, word, clean_spoken_text(phrase)


def parse_markdown_words(md_path):
    return list(dict.fromkeys(word for _, word, _ in table_entries(md_path)))


def parse_markdown_chunks(md_path):
    return list(dict.fromkeys(chunk for _, _, chunk in table_entries(md_path) if chunk))


@dataclass(frozen=True)
class Task:
    text: str
    output: Path
    kind: str = 'word'


def check_output(path):
    path = Path(path).resolve()
    if path.suffix.lower() not in {'.mp3', '.wav'}:
        raise ValueError('Output must end in .mp3 or .wav')
    if not (path.is_relative_to(ROOT/'20. resource') or path.is_relative_to(ROOT/'.cache')):
        raise ValueError('Output must be inside the resource tree or .cache')
    if not path.is_relative_to(ROOT/'.cache') and path.parent.name != 'audio':
        raise ValueError('Resource audio must be inside an article audio/ folder')
    if path.is_relative_to(ROOT/'20. resource/05. listening') and path.name.startswith('chunk_'):
        raise ValueError(f'Protected original exam chunk: {path}')
    if path.is_relative_to(ROOT/'20. resource/01. base/b.connected'):
        raise ValueError('Connected-speech recordings cannot be overwritten with TTS')
    if len(path.name.encode()) > 255:
        raise ValueError(f'Filename exceeds 255 bytes: {path.name}')
    return path


def plan_notes(notes, include_chunks):
    tasks = {}
    for note in notes:
        for source, word, chunk in table_entries(note):
            mapped = article_audio_dir(source)
            if not mapped:
                raise ValueError(f'Cannot map source note: {source}')
            pairs = [(word, False)] + ([(chunk, True)] if include_chunks and chunk else [])
            for text, is_chunk in pairs:
                if is_chunk and source.is_relative_to(ROOT/'05. listening'):
                    continue
                if not text or re.search(r'[\u4e00-\u9fff]', text):
                    raise ValueError(f'Empty/non-English spoken cell in {note}: {text!r}')
                slug = to_slug(text)
                if not slug:
                    raise ValueError(f'Empty slug in {note}: {text!r}')
                output = check_output(Path(mapped)/(('chunk_' if is_chunk else '')+slug+'.mp3'))
                task = Task(text, output, 'chunk' if is_chunk else 'word')
                if output in tasks and tasks[output].text.casefold() != text.casefold():
                    raise ValueError(f'Different texts map to one file: {output}')
                tasks.setdefault(output, task)
    return list(tasks.values())


def run_command(command, **kwargs):
    result = subprocess.run(command, capture_output=True, timeout=60, **kwargs)
    if result.returncode:
        error = result.stderr.decode(errors='replace') if isinstance(result.stderr, bytes) else result.stderr
        raise RuntimeError(f'{Path(command[0]).name} failed: {error[-1200:]}')
    return result


def inspect_audio(path, apple=False):
    """Decode actual samples; file size is never used to declare validity."""
    import numpy as np
    import soundfile as sf
    path = Path(path)
    samples, rate = sf.read(path, dtype='float32', always_2d=True)
    if samples.shape[1] != 1 or len(samples) < rate//10 or not np.isfinite(samples).all():
        raise ValueError(f'Invalid decoded samples: {path}')
    if float(np.max(np.abs(samples))) < 0.0001:
        raise ValueError(f'Silent audio: {path}')
    if apple and platform.system() == 'Darwin':
        CACHE.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='decode-', dir=CACHE) as temp:
            run_command(['afconvert', '-f', 'WAVE', '-d', 'LEF32', str(path), str(Path(temp)/'decoded.wav')])
    return {'sample_rate':rate, 'duration':len(samples)/rate,
            'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}


def encode_audio_to_mp3(samples, sr, out_mp3_path):
    """Verify a staged file before replacing the destination atomically."""
    import numpy as np
    import soundfile as sf
    output = check_output(out_mp3_path)
    samples = np.asarray(samples, dtype=np.float32)
    if samples.ndim != 1 or not np.isfinite(samples).all() or not len(samples):
        raise ValueError('Invalid PCM; existing output has not been touched')
    output.parent.mkdir(parents=True, exist_ok=True)
    staged = output.parent/('.tts-'+uuid.uuid4().hex+output.suffix)
    try:
        if output.suffix == '.wav':
            sf.write(staged, samples, sr, subtype='FLOAT')
        else:
            run_command(['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
                         '-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', 'pipe:0',
                         '-c:a', 'libmp3lame', '-b:a', '320k', '-compression_level', '0',
                         '-ar', str(OUTPUT_RATE), '-ac', '1', '-id3v2_version', '3',
                         '-write_xing', '1', str(staged)], input=samples.astype('<f4', copy=False).tobytes())
        inspect_audio(staged, apple=True)
        with staged.open('rb+') as stream:
            os.fsync(stream.fileno())
        staged.replace(output)
    finally:
        staged.unlink(missing_ok=True)
    return inspect_audio(output)


def ensure_kokoro_assets(voice=DEFAULT_VOICE):
    directory = Path(KOKORO_MLX_DIR)
    for relative in ('config.json', 'kokoro-v1_0.safetensors', f'voices/{voice}.safetensors'):
        if not (directory/relative).is_file():
            raise FileNotFoundError(f'Missing local model asset: {directory/relative}')


def prepare_espeak():
    """Keep the native loader on a space-free path, without changing notes."""
    import espeakng_loader
    source = Path(espeakng_loader.get_library_path()).parent
    destination = Path(tempfile.gettempdir())/('kokoro_espeak_'+hashlib.md5(str(source).encode()).hexdigest()[:8])
    library = destination/Path(espeakng_loader.get_library_path()).name
    if not library.exists():
        temporary = destination.with_name(destination.name+'.'+uuid.uuid4().hex)
        shutil.copytree(source, temporary, symlinks=True, ignore=shutil.ignore_patterns('__pycache__', '*.py'))
        try:
            temporary.rename(destination)
        except FileExistsError:
            shutil.rmtree(temporary)
    from misaki import espeak  # noqa: F401
    from phonemizer.backend.espeak.wrapper import EspeakWrapper
    EspeakWrapper.set_library(str(library))
    EspeakWrapper.set_data_path(str(destination/'espeak-ng-data'))


def swap_bytes():
    if platform.system() != 'Darwin':
        return 0
    text = subprocess.check_output(['sysctl', '-n', 'vm.swapusage'], text=True, timeout=5)
    match = re.search(r'used\s*=\s*([\d.]+)([KMG])', text)
    return int(float(match[1])*{'K':1024, 'M':1024**2, 'G':1024**3}[match[2]]) if match else 0


class ResourcePressure(RuntimeError):
    pass


class KokoroMLX:
    """One local MLX model, called only by the main thread."""
    def __init__(self):
        if platform.system() != 'Darwin' or platform.machine() != 'arm64':
            raise RuntimeError('Apple Silicon macOS is required')
        if importlib.metadata.version('kokoro-mlx') != '0.1.3':
            raise RuntimeError('Use the tested kokoro-mlx==0.1.3 environment')
        if importlib.util.find_spec('en_core_web_sm') is None:
            raise RuntimeError('Missing spaCy English model; run setup_environment.sh first')
        ensure_kokoro_assets()
        prepare_espeak()
        import mlx.core as mx
        from kokoro_mlx import KokoroTTS
        mx.set_default_device(mx.gpu)
        mx.set_cache_limit(0)
        self.initial_swap = swap_bytes()
        self._tts = KokoroTTS.from_pretrained(KOKORO_MLX_DIR)
        self._tts._model.eval()
        self.peak_bytes = 0

    def create(self, text, voice=DEFAULT_VOICE, speed=1.0, lang=None):
        import mlx.core as mx
        import numpy as np
        if swap_bytes() > self.initial_swap+256*1024**2:
            raise ResourcePressure('Swap grew by more than 256 MiB; stopping before another GPU job')
        try:
            result = self._tts.generate(clean_spoken_text(text), voice=voice, speed=speed,
                                        sample_rate=NATIVE_RATE, language=lang or 'en-gb')
            audio = np.asarray(result.audio, dtype=np.float32).copy()
            if result.sample_rate != NATIVE_RATE or audio.ndim != 1 or len(audio) < 2400:
                raise ValueError('Unexpected MLX sample rate, shape or duration')
            if not np.isfinite(audio).all() or float(np.max(np.abs(audio))) < 0.0001:
                raise ValueError('MLX returned non-finite or silent audio')
            # Preserve quiet consonants: trim near-digital silence, not -46 dB speech.
            indices = np.flatnonzero(np.abs(audio) > 0.0003)
            if indices.size:
                audio = audio[max(0, int(indices[0])-2880):min(len(audio), int(indices[-1])+2401)]
            peak = float(np.max(np.abs(audio)))
            if peak >= 1:
                audio *= 0.99/peak
            self.peak_bytes = max(self.peak_bytes, mx.get_peak_memory())
            return audio, NATIVE_RATE
        finally:
            mx.synchronize()
            mx.clear_cache()
            gc.collect()

    def get_voices(self):
        return self._tts.list_voices()


def load_kokoro():
    return KokoroMLX()


def fingerprint(task, voice, speed):
    assets = Path(KOKORO_MLX_DIR)
    signatures = [(str(p.relative_to(assets)), p.stat().st_size, p.stat().st_mtime_ns)
                  for p in (assets/'config.json', assets/'kokoro-v1_0.safetensors', assets/'voices'/f'{voice}.safetensors')]
    payload = [VERSION, SOURCE_SIGNATURE, task.text, voice, speed, OUTPUT_RATE, 'CBR320-ID3v23', signatures]
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False).encode()).hexdigest()


def previous_records(journal):
    result = {}
    if journal.exists():
        for line in journal.read_text().splitlines():
            try:
                record = json.loads(line)
                if record.get('status') == 'ok':
                    result[record['output']] = record
            except (ValueError, KeyError):
                continue
    return result


def generate(tasks, voice, speed, force=False, encoder_workers=2):
    """GPU runs serially; CPU encodes overlap, with at most two tasks in flight."""
    CACHE.mkdir(parents=True, exist_ok=True)
    journal = CACHE/'progress.jsonl'
    records = previous_records(journal)
    model, pending, errors = None, {}, []
    completed = cached = 0
    baseline_swap, start = swap_bytes(), time.monotonic()

    def write(record):
        with journal.open('a') as stream:
            stream.write(json.dumps(record, ensure_ascii=False)+'\n')
            stream.flush()
            os.fsync(stream.fileno())

    def consume(done):
        nonlocal completed
        for future in done:
            task, key = pending.pop(future)
            try:
                info = future.result()
                write({'status':'ok', 'output':str(task.output), 'fingerprint':key,
                       'voice':voice, 'text':task.text, **info})
                completed += 1
                print(f'[OK {completed+cached}/{len(tasks)}] {task.output.relative_to(ROOT)}', flush=True)
            except Exception as error:
                errors.append({'output':str(task.output), 'error':str(error)})
                write({'status':'error', **errors[-1]})
                print(f'[FAIL] {task.text}: {error}', file=sys.stderr, flush=True)

    with (CACHE/'gpu.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Another TTS job holds the GPU lock; no second model was started')
        with ThreadPoolExecutor(max_workers=min(2, max(1, encoder_workers))) as encoders:
            try:
                for task in tasks:
                    key = fingerprint(task, voice, speed)
                    old = records.get(str(task.output))
                    if not force and old and old.get('fingerprint') == key and task.output.exists():
                        try:
                            if inspect_audio(task.output)['sha256'] == old['sha256']:
                                cached += 1
                                continue
                        except Exception:
                            pass
                    while len(pending) >= 2:
                        consume(wait(pending, return_when=FIRST_COMPLETED).done)
                    if swap_bytes() > baseline_swap+256*1024**2:
                        raise ResourcePressure('Swap grew by more than 256 MiB; stopping this job')
                    if len(errors) >= 3:
                        raise RuntimeError('Three encoding failures; stopping the batch')
                    if model is None:
                        model = load_kokoro()
                    try:
                        if task.kind == 'passage':
                            import numpy as np
                            parts = []
                            for sentence in re.split(r'(?<=[.!?])\s+', task.text):
                                samples, sr = model.create(sentence, voice=voice, speed=speed, lang='en-gb')
                                if parts:
                                    parts.append(np.zeros(int(sr*0.4), dtype=np.float32))
                                parts.append(samples)
                            samples = np.concatenate(parts)
                        else:
                            samples, sr = model.create(task.text, voice=voice, speed=speed, lang='en-gb')
                    except ResourcePressure:
                        raise
                    except Exception as error:
                        errors.append({'output':str(task.output), 'error':str(error)})
                        write({'status':'error', **errors[-1]})
                        print(f'[FAIL] {task.text}: {error}', file=sys.stderr, flush=True)
                        if len(errors) >= 3:
                            raise RuntimeError('Three synthesis failures; stopping the batch')
                        continue
                    pending[encoders.submit(encode_audio_to_mp3, samples, sr, task.output)] = (task, key)
                while pending:
                    consume(wait(pending, return_when=FIRST_COMPLETED).done)
            finally:
                if pending:
                    consume(wait(pending).done)
    print(json.dumps({'generated':completed, 'cached':cached, 'failed':len(errors),
                      'seconds':round(time.monotonic()-start, 1), 'gpu_processes':1 if model else 0,
                      'peak_mlx_mib':round(model.peak_bytes/1024**2, 1) if model else 0}), flush=True)
    if errors:
        raise RuntimeError(f'{len(errors)} files failed; details are in {journal}')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode', choices=['single','passage','file','scan-dir','audit','dual'], default='single')
    parser.add_argument('--text', '-t')
    parser.add_argument('--voice', '-v', default=DEFAULT_VOICE)
    parser.add_argument('--speed', type=float, default=1.0)
    parser.add_argument('--file', '-f')
    parser.add_argument('--dir', '-d')
    parser.add_argument('--out', '-o')
    parser.add_argument('--include-chunks', action='store_true')
    parser.add_argument('--force', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--limit', type=int)
    parser.add_argument('--encoder-workers', '--workers', '-w', type=int, default=2,
                        help='CPU encoders only, bounded to 1–2; GPU always uses one model')
    args = parser.parse_args(argv)
    if not 0.5 <= args.speed <= 1.5:
        parser.error('--speed must be between 0.5 and 1.5')
    voice = VOICE_MAP.get(args.voice, args.voice)
    if args.mode == 'dual':
        print('[INFO] Legacy dual mode means one reading', flush=True)
        args.mode = 'file' if args.file else 'single'
    if args.mode in {'single','passage'}:
        if not args.text or not args.out:
            parser.error('single/passage requires --text and --out; no implicit output path')
        text = clean_spoken_text(args.text)
        if not text:
            parser.error('Text is empty after removing markup')
        tasks = [Task(text, check_output(args.out), 'passage' if args.mode == 'passage' else 'word')]
    else:
        if bool(args.file) == bool(args.dir):
            parser.error('Specify exactly one --file or --dir')
        notes = [Path(args.file).resolve()] if args.file else sorted(Path(args.dir).resolve().rglob('*.md'))
        if args.out:
            parser.error('Batch paths are mapped from notes; --out is only for single/passage')
        tasks = plan_notes(notes, args.include_chunks)
    if args.limit is not None:
        if args.limit <= 0:
            parser.error('--limit must be positive')
        tasks = tasks[:args.limit]
    gpu_models = 0 if args.dry_run or args.mode == 'audit' else 1
    print(f'[PLAN] {len(tasks)} files; voice={voice}; GPU models={gpu_models}; MP3=44.1 kHz mono CBR320', flush=True)
    if args.dry_run:
        for task in tasks:
            print(json.dumps({'text':task.text, 'output':str(task.output)}, ensure_ascii=False))
        return 0
    if args.mode == 'audit':
        errors = []
        for task in tasks:
            try:
                inspect_audio(task.output, apple=True)
            except Exception as error:
                errors.append({'output':str(task.output), 'error':str(error)})
        print(json.dumps({'total':len(tasks), 'valid':len(tasks)-len(errors), 'errors':errors}, ensure_ascii=False))
        return 1 if errors else 0
    if not tasks:
        raise ValueError('No supported vocabulary or phrase rows found')
    if not shutil.which('ffmpeg') or not shutil.which('afconvert'):
        raise RuntimeError('ffmpeg and macOS afconvert must be available')
    ensure_kokoro_assets(voice)
    generate(tasks, voice, args.speed, args.force, args.encoder_workers)
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print('[STOPPED] Interrupted; committed outputs and journal preserved', file=sys.stderr)
        sys.exit(130)
    except Exception as error:
        print(f'[ERROR] {error}', file=sys.stderr)
        sys.exit(1)

---
name: tts-audio-engine
description: >-
  Local English TTS using Kokoro-82M on MLX. Uses Emma for all words, meaning
  chunks, phrases and passages. Runs one GPU model with bounded CPU encoding,
  decoded-file verification, atomic writes and resumable progress.
  Synthesize only when explicitly requested.
---

# TTS Audio Engine

The implementation is `.agents/skills/tts-audio-engine/scripts/tts_engine.py`.
Use the current implementation and real playback tests when migrating models;
historical descriptions are not evidence that an output works.

## Authorization and scope

- Generate only explicitly requested notes or entries. Vocabulary enrollment alone does not authorize synthesis.
- Use Emma (`bf_emma`) for headwords, meaning chunks, phrases and passages, one reading per file.
- Listening exam `05. listening/**/audio/chunk_*.mp3` must remain original recordings. The engine rejects these output paths. Central listening tables map headwords to the original article, while preserving its real-audio chunks.
- Do not synthesize connected-speech examples. Phonics reuses existing recordings unless explicitly requested.
- Preserve note text and learning marks. Clean only the synthesis input copy.
- Do not delete existing audio as part of routine generation. The new file replaces the old file only after successful encoding and verification.

## Environment

Install the pinned dependencies once in the project `.venv`, using uv:

```bash
zsh .agents/skills/tts-audio-engine/scripts/setup_environment.sh
```

The lock file includes `kokoro-mlx==0.1.3` and the spaCy English model.
Synthesis never installs packages or downloads weights. Missing dependencies or
local assets produce explicit errors before synthesis.

Model assets must exist under
`20. resource/20. common/kokoro/Kokoro-82M-bf16/`:
`config.json`, `kokoro-v1_0.safetensors`, and `voices/bf_emma.safetensors`.
The model library upcasts checkpoint weights to float32 for stable inference;
the `bf16` directory name does not describe runtime memory consumption.
The native espeak loader uses a space-free system temporary path.

## Commands

Use the fixed project environment, without ephemeral `--with` overlays:

```bash
UV_CACHE_DIR="$PWD/.cache/uv" uv run --no-project --python "$PWD/.venv/bin/python" python .agents/skills/tts-audio-engine/scripts/tts_engine.py --mode file --file "02. word/b. 剑雅阅读真题/01-自然地理.md" --include-chunks
```

The same command resumes successful files using a journal fingerprint and the
actual output checksum. `--force` regenerates the requested scope.
`--dry-run` lists text and paths without loading a model or writing audio.
`--limit N` selects the first N planned output files for a small test.

For one word or phrase, use an explicit source-owned output path:

```bash
UV_CACHE_DIR="$PWD/.cache/uv" uv run --no-project --python "$PWD/.venv/bin/python" python .agents/skills/tts-audio-engine/scripts/tts_engine.py --mode single --voice emma --text "abundance" --out "20. resource/02. word/b. 剑雅阅读真题/01-自然地理/audio/abundance.mp3" --force
```

Audit existing outputs without loading a model:

```bash
UV_CACHE_DIR="$PWD/.cache/uv" uv run --no-project --python "$PWD/.venv/bin/python" python .agents/skills/tts-audio-engine/scripts/tts_engine.py --mode audit --file "02. word/b. 剑雅阅读真题/01-自然地理.md" --include-chunks
```

`scan-dir --dir <requested-directory>` handles only the requested directory.
`passage --text <cleaned-original-passage> --out <explicit-path>` synthesizes
sentence by sentence, with 0.4-second inter-sentence gaps. It never chooses an
implicit destination or modifies note embeds.

## Runtime and quality

- Exactly one GPU model runs in the main process. A file lock rejects a second TTS job.
- CPU MP3 encoding overlaps inference, with at most two files in flight. `--encoder-workers 1|2` controls CPU encoding only; legacy `--workers` is an alias and cannot create more GPU models.
- MLX free-buffer caching is disabled and cleared after each utterance. Do not impose a fixed 2 GiB MLX memory limit or stop merely because active/peak allocation exceeds it. Record peak usage and stop if swap grows by more than 256 MiB. Reading passages use complete sentences without arbitrary character-length splitting. Do not repeat multi-process GPU benchmarks.
- Normal speed is `1.0`. No forced low-precision inference is used.
- Native PCM is float32 mono at 24 kHz. Quiet consonants are retained by conservative near-silence trimming.
- MP3 export uses MPEG-1, 44.1 kHz mono, 320 kbps CBR, LAME compression level 0 and ID3v2.3. Resampling is for compatibility, not additional source detail.
- Float32 PCM is piped directly to ffmpeg. No intermediate 16-bit WAV quantization occurs. Explicit `.wav` output remains float32 lossless.
- Staged files must pass full sample decoding and macOS `afconvert` decoding before atomic replacement. Empty, silent or non-finite samples are rejected. Decoder checks are not a substitute for a real Finder/QuickTime playback check when a user reports a player-specific failure.
- Any failed output produces an error record and nonzero exit status. Three failures stop the batch. Interruption preserves verified outputs and the journal.

## Paths and text

Resource path = `20. resource/` + note path without `.md` + `/audio/`.
Use `<slug>.mp3` for headwords and `chunk_<slug>.mp3` for the corresponding
phrase. Every note has its own directory; playback never borrows another note's
audio. Only `.cache/` may hold previews and intermediate verification artifacts.

Spoken-text cleanup covers Markdown marks, HTML comments/tags, Obsidian hidden
comments, embeds, links, footnote markers, escaped formatting and HTML entities.
It retains apostrophes, hyphens and normal punctuation; placeholders become pauses.
Parsers read only the headword and phrase columns, never Chinese definitions.

Progress is stored in `.cache/tts/progress.jsonl`. Resume requires matching
text, voice, speed, model assets, encoder version and output checksum; file size
alone never declares an output valid.

## Validation

Run the integration checks without loading a neural model or GPU:

```bash
UV_CACHE_DIR="$PWD/.cache/uv" uv run --no-project --python "$PWD/.venv/bin/python" python .agents/skills/tts-audio-engine/scripts/test_engine.py
```

After model/encoder changes, test a word and a phrase with the real model,
inspect codec parameters and native playback, then validate the requested note.

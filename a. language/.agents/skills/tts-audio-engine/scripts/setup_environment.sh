#!/bin/zsh
set -eu
task_root="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$task_root"
export UV_CACHE_DIR="$task_root/.cache/uv"
if [ ! -f .venv/pyvenv.cfg ]; then
  uv venv --python 3.12 .venv
fi
uv pip install --python .venv/bin/python -r .agents/skills/tts-audio-engine/requirements.lock
uv run --no-project --python "$task_root/.venv/bin/python" python -c 'import kokoro_mlx, en_core_web_sm; print("TTS dependencies ready; no model synthesis was started")'

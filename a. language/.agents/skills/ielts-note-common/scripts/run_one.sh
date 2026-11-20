#!/bin/sh
# 用法: run_one.sh <任务id>   只读沙箱, 输出写到 .cache/codex_para/<id>.out.json
cd "$(dirname "$0")/../../../.." || exit 1
T="$1"
codex exec -C "$PWD" -s read-only --skip-git-repo-check --ephemeral --color never --output-schema .cache/codex_para/schema.json -o ".cache/codex_para/$T.out.json" - < ".cache/codex_para/$T.prompt.txt" > ".cache/codex_para/$T.log" 2>&1

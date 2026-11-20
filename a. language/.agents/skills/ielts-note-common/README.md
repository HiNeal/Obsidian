# ielts-note-common

`ielts-reading-note` 与 `ielts-listening-note` 两个 skill 共用的脚本, 放在 `scripts/`(受 Git 版本管理)。

- 运行位置: 一律在 `a. language/` 根目录下运行, 如 `python3 .agents/skills/ielts-note-common/scripts/result_marks.py`; 缺省 dry run, 加 `--apply` 才写盘。
- 数据和缓存不在这里, 仍在 `.cache/`(已被 `.gitignore` 忽略): `ieltsbro_records/`、`ieltsbro_records_listening/`、`reading_cache/`、`listening_cache/`、`codex_para/`、`errattr/data_NN.py`(分析数据)。脚本通过「项目根 / .cache」找到它们。
- 令牌只在内存里用, 不落盘不输出。
- `run_one.sh`: 让 Codex 在只读沙箱里为一份同义改写任务出建议, 用法 `sh .agents/skills/ielts-note-common/scripts/run_one.sh <任务id>`。
- `.cache/` 里同名的旧脚本暂时保留, 以后改动只改这里。

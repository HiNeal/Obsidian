---
name: ielts-reading-note
description: 把雅思哥或九分学长的阅读做题记录生成或补全为本库篇章笔记, 含原文、本篇词表、同义改写表与错题记录。用户要求整理新做题记录或同步阅读笔记时使用。
---

# 目标格式

在 `a. language/` 根目录操作, 以根 `AGENTS.md` 的 Common 与 Reading 为准。结构固定为 `# 原文 → # 单词 → # 短语 → # 同义改写 → # 错题记录`。

- 单词与短语由用户选择, 不自行选词。没有待录入词条时保留空表头。
- 单词八列: `| 单词 | 音标 | 释义 | 记忆 | 英意 | 意群 | 同义词 | 评分 |`(音标写第二列 `/DJ 音标/`, 单词格只写词头)。短语四列: `| 短语 | 释义 | 意群 | 评分 |`, 按原文出现顺序排列。
- 词条留在本篇, 全库查重用于复用释义, 按本篇列结构复制对应字段。不得送入未整理词库。新词评分为 0, 保护已有用户标记与评分。
- 不新增 search 注释, 高亮只查本篇词表; 语境义项在本篇释义列高亮。保护已有高亮, 不批量改写历史笔记。
- 不生成 `# 题目`、`# 分析`、✅❌ 标记或题号注释。

# 获取与写入流程

脚本位于 `.agents/skills/ielts-note-common/scripts/`。Python 统一使用根规则指定的 uv 命令前缀:

```bash
UV_CACHE_DIR="$PWD/.cache/uv" uv run --no-project --python "$PWD/.venv/bin/python" python <脚本> <参数>
```

1. 运行 `ieltsbro_sync.py --reading` 查看缺失记录, 再用 `--apply` 将详情保存到 `.cache/ieltsbro_records/`。令牌只在内存使用, 不打印、不落盘; 只读列表和详情接口, 权限错误即停。
2. 用 `record_map.py --reading` 按原文匹配现有笔记, 确认目标后再 `--apply`。九分学长的作答来自 Chromium 缓存, 缺失时请用户在 App 打开该次回顾; 不代提交作答。
3. 新文章先从 `.cache/reading_cache/` 取原文, 缺失时用 `reading_fetch.py` 只读获取。按现有行文结构目录选择分类, 用 `new_reading_note.py "C21-Test 1-Passage 3" "09. 作品评价"` 预览, 核对后加 `--apply`, 不覆盖已有笔记。
4. 题干、选项、实际作答与标准答案只作为缓存中的复盘素材, 不先写旧题目区再转换。用 errattr_worksheet.py <笔记名关键字> 读取工作单。先检查工具是否能从当前记录得到完整素材, 缺失时只读缓存原始详情, 不猜答案。
5. 仅将错题写入 `# 错题记录`: 保留题干与必要选项, 选项在下方, 不写题号、题组说明或对错标记。每题末尾用引用块逐行写 `正确 / 错误 / 常见陷阱 / 直接原因 / 破局法则`, 依据本模块方法论判断, 不硬套分类。
6. 对照题目与原文, 将真实同义改写写入 `| 题目表达 | 原文表达 |` 表, 单词优先、最小颗粒, 不写整句、题号、省略号或 para 注释; 不强配。
7. 仅录入用户指定词条, 完成后核对标题顺序、表头、评分、高亮与错题来源, 运行 `git diff --check`, 确认修改仅涉及目标篇章及必要记录映射。

# 旧流程与资源边界

- `reading_questions.py`、`ieltsbro_questions.py`、`jiufen_questions.py`、`mock_flow.py` 的旧题目写盘流程, 以及 `matching_table.py`、`listening_matching_table.py`、`matching_refresh.py`、`judgement_options.py`、`options_below.py`、`strip_answer_lines.py`、`result_marks.py`、`errattr_apply.py`、`errattr_correct.py`、`paraphrase_apply.py` 不用于新格式笔记的写入。不得按旧顺序批量 --apply。
- 旧 `audit_reading_format.py` 与嵌入式同义改写审计按旧格式判断, 不作为当前格式验收依据。
- 所有音频落在 `20. resource/` 加笔记完整相对路径(去 .md)的 `audio/` 中, 不跨篇借用。默认不合成 TTS, 只汇报缺失数量; 听力短语原声不得用 TTS 覆盖。
- 音频修剪与原声切片仅在用户要求时进行, 使用限定目标的流程, 不无范围运行全库写盘脚本。
- 汇报新建或补全的笔记、错题数量、缺失素材与待生成音频数量。未实际完成的同步或核对如实说明。

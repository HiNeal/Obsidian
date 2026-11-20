#!/usr/bin/env python3
"""只读审计所有笔记 `# 同义改写` 表: 不得含省略号(... 或 …), 每格应是短语而非整句(词数上限 MAXW)。
另检查 `# 题目` 里的 `==题目表达==<!--para: 原文表达-->`: 题目表达与每条原文表达(` / ` 分隔)都只能是单词或短语(词数上限 MAXW), 且高亮不得包住填空 `\_`。
用法: python3 .agents/skills/ielts-note-common/scripts/audit_paraphrase.py [文件...]   无参数则查 05. listening 与 06. reading 全部。退出码=违规行数。"""
import glob, re, sys
MAXW = 8
def words(c):
    c = re.sub(r"<br\s*/?>.*", "", c)           # 去掉 <br>(题型) 后缀
    c = re.sub(r"[*\[\]【】]|反", " ", c) if False else re.sub(r"[*\[\]]|【反】", "", c)
    return len(c.split())
def bad_highlights(t):
    m = re.search(r"(?ms)^# 题目\n(.*?)(?=^# |\Z)", t)
    out = []
    for h in re.finditer(r"==(.+?)==<!--para:\s*(.*?)-->", m.group(1) if m else ""):
        why = []
        if words(h.group(1)) > MAXW: why.append(f"题目表达>{MAXW}词")
        if any(words(x) > MAXW for x in h.group(2).split(" / ")): why.append(f"原文表达>{MAXW}词")
        if "\\_" in h.group(1): why.append("高亮包住填空")
        if "..." in h.group(0) or "…" in h.group(0): why.append("省略号")
        if why: out.append((h.group(0), "+".join(why)))
    return out
def bad_rows(f):
    t = open(f).read(); out = bad_highlights(t); m = re.search(r"(?ms)^# 同义改写\n(.*?)(?=^# |\Z)", t)
    if not m: return out
    for r in [l for l in m.group(1).splitlines() if l.startswith("|")][2:]:
        cells = [x.strip() for x in r.strip().strip("|").split(" | ")] if " | " in r else [x.strip() for x in r.strip().strip("|").split("|")]
        why = []
        if any("..." in c or "…" in c for c in cells): why.append("省略号")
        if any(words(c) > MAXW for c in cells): why.append(f">{MAXW}词")
        if why: out.append((r, "+".join(why)))
    return out
files = [a for a in sys.argv[1:] if a != "-v"] or sorted(glob.glob("05. listening/*/*.md") + glob.glob("06. reading/*/*.md"))
n = 0
for f in files:
    rows = bad_rows(f)
    if rows:
        n += len(rows)
        if len(files) <= 3 or "-v" in sys.argv:
            for r, w in rows: print(f"  [{w}] {r[:160]}")
        print(f"{len(rows):3d} {f}")
print("违规行", n)
sys.exit(1 if n else 0)

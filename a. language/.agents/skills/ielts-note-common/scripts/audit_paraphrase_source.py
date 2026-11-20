#!/usr/bin/env python3
"""只读审计 `# 同义改写`: 右列「原文表达」每个短语(以 / 分隔)须在 `# 原文`/`# 音频` 里连续出现; 并查推导符号 -> => →。
用法: python3 .agents/skills/ielts-note-common/scripts/audit_paraphrase_source.py [文件...]   退出码=问题数"""
import glob, re, sys
def norm(x): return " ".join(re.sub(r"[^a-z0-9 ]", " ", x.lower().replace("’", "'").replace("‘", "'").replace("\xa0", " ")).split())
def problems(f):
    t = open(f).read(); m = re.search(r"(?ms)^# 同义改写\n(.*?)(?=^# |\Z)", t)
    sec = re.search(r"(?ms)^# (?:原文|音频)\n(.*?)(?=^# )", t)
    if not sec: return []
    src = norm(re.sub(r"<!--.*?-->|==|\*\*|!\[\[.*?\]\]", "", sec.group(1)))
    out = []
    # 题目里的高亮同义改写: <!--para: 原文表达 / 原文表达--> 同样须是原文连续词块
    for note in re.findall(r"<!--para:\s*([^\n]*?)-->", t):
        if "..." in note or "…" in note: out.append(("省略号", note))
        for part in re.split(r"\s+/\s+", re.sub(r"【反】", "", note)):
            p = norm(part)
            if p and p not in src: out.append(("不在原文", part))
    if not m: return out
    for r in [l for l in m.group(1).splitlines() if l.startswith("|")][2:]:
        c = [x.strip() for x in r.strip().strip("|").split("|")]
        if re.search(r"->|=>|→", r): out.append(("推导符号", r))
        if len(c) < 2: continue
        for part in re.split(r"\s*/\s*", re.sub(r"<br>.*|【反】|[\[\]*]", "", c[1]).strip()):
            p = norm(part)
            if p and p not in src: out.append(("不在原文", f"{part}   <== {r}"))
    return out
files = sys.argv[1:] or sorted(glob.glob("05. listening/*/*.md") + glob.glob("06. reading/*/*.md"))
n = 0
for f in files:
    ps = problems(f)
    if ps:
        n += len(ps)
        if len(files) <= 3:
            for k, r in ps: print(f"  [{k}] {r[:200]}")
        print(f"{len(ps):3d} {f}")
print("问题行", n); sys.exit(1 if n else 0)

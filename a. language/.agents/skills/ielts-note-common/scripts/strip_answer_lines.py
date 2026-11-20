#!/usr/bin/env python3
"""阅读笔记 `# 题目`: 删除题组后面的 `**答案**: ...` 行(卡片已展示正确答案与我的错选)。
例外: 该题组里有题目没有对错标记(没做过), 答案行是唯一来源, 保留。缺省 dry run, 加 --apply 写盘。"""
import glob, os, re, sys
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", ".."))
QM = re.compile(r"<!--\s*(?:q|question):\s*\d{1,2}(?:\s*[–-]\s*\d{1,2})?\s*-->")
RES = re.compile(r"(?:<!--\s*(?:q|question):\s*\d{1,2}(?:\s*[–-]\s*\d{1,2})?\s*-->|<!--\s*res:\s*\d{1,2}\s*-->)[ \t]*(?:✅|❌)")
def process(text):
    m = re.search(r"^# 题目[ \t]*$", text, re.M)
    if not m: return text, 0, []
    s = m.end(); nxt = re.search(r"^# ", text[s:], re.M); e = s + nxt.start() if nxt else len(text)
    lines = text[s:e].split("\n"); out = []; start = 0; removed = 0; kept = []
    for ln in lines:
        if re.match(r"^\*\*Questions?\b", ln, re.I): start = len(out)
        if re.match(r"^\*\*答案\*\*\s*[:：]", ln):
            block = "\n".join(out[start:])
            nq = len(QM.findall(block)); nr = len(RES.findall(block))
            if nq and nr >= nq:
                removed += 1
                while out and not out[-1].strip(): out.pop()          # 吞掉答案行前多余空行
                continue
            kept.append(ln[:60])
        out.append(ln)
    return text[:s] + "\n".join(out) + text[e:], removed, kept
def main():
    apply = "--apply" in sys.argv; tot = 0; kept_all = []
    for f in sorted(glob.glob(os.path.join(ROOT, "06. reading", "*", "*.md")) + glob.glob(os.path.join(ROOT, "05. listening", "*", "*.md"))):
        t = open(f, encoding="utf-8").read(); new, r, kept = process(t)
        tot += r
        for k in kept: kept_all.append((os.path.basename(f)[:-3], k))
        if r and apply: open(f, "w", encoding="utf-8").write(new)
    print(f"删除答案行 {tot} 条", "(已写入)" if apply else "(dry run)")
    for k in kept_all: print("  保留:", *k)
if __name__ == "__main__": main()

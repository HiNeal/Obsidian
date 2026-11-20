#!/usr/bin/env python3
"""阅读笔记 `# 题目`: 判断题(TRUE/FALSE/NOT GIVEN 或 YES/NO/NOT GIVEN)题干后补全选项列表:
    - A. TRUE / - B. FALSE / - C. NOT GIVEN   (YES/NO 题组为 A. YES / B. NO / C. NOT GIVEN)
已有选项的题不动; 只在 `# 题目` 段、判断题组内处理。缺省 dry run, 加 --apply 写盘。"""
import glob, os, re, sys
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", ".."))
Q = re.compile(r"^\*\*(\d{1,2})\.\*\*")
def kind(header):
    h = header.upper()
    if "NOT GIVEN" not in h: return None
    if "YES" in h and "NO " in h + " ": return ("YES", "NO")
    if "TRUE" in h and "FALSE" in h: return ("TRUE", "FALSE")
    return None
def process(text):
    m = re.search(r"^# 题目[ \t]*$", text, re.M)
    if not m: return text, 0, 0
    s = m.end(); nxt = re.search(r"^# ", text[s:], re.M); e = s + nxt.start() if nxt else len(text)
    lines = text[s:e].split("\n"); out = []; labels = None; added = 0; have = 0
    i = 0
    while i < len(lines):
        ln = lines[i]; out.append(ln)
        if re.match(r"^\*\*Questions?\b", ln, re.I): labels = kind(ln)
        elif ln.startswith("**答案**") or ln.startswith("# "): labels = None
        if labels and Q.match(ln):
            j = i + 1
            while j < len(lines) and not lines[j].strip(): j += 1
            if j < len(lines) and re.match(r"^\s*[-*]\s+A\.\s", lines[j]): have += 1
            else:
                out += ["", f"- A. {labels[0]}", f"- B. {labels[1]}", "- C. NOT GIVEN"]; added += 1
        i += 1
    return text[:s] + "\n".join(out) + text[e:], added, have
def main():
    apply = "--apply" in sys.argv; total = notes = already = 0
    for f in sorted(glob.glob(os.path.join(ROOT, "06. reading", "*", "*.md"))):
        t = open(f, encoding="utf-8").read(); new, a, h = process(t)
        already += h
        if a:
            notes += 1; total += a
            print(f"{os.path.basename(f)[:-3][:50]}: 补 {a} 题")
            if apply: open(f, "w", encoding="utf-8").write(new)
    print(f"共 {notes} 篇补 {total} 道判断题选项, 已有选项 {already} 题", "(已写入)" if apply else "(dry run)")
if __name__ == "__main__": main()

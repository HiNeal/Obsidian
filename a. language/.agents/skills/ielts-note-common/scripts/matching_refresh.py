#!/usr/bin/env python3
"""已转成表格的匹配题(`|  | A | B |…` 表头 + `<!--q: N-->` 行): 按做题记录刷新 🟢(正确) / 🔴(我选错) / ○。缺省 dry run, 加 --apply 写盘。"""
import glob, os, re, sys
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", "..")); HERE = os.path.join(ROOT, ".cache")
sys.path.insert(0, SCRIPTS)
import result_marks as R, errattr_correct as C, listening_flow as L
def letter(label):
    m = re.match(r"^([A-Za-z]{1,4})\b", label or ""); return m.group(1).upper() if m else None
def refresh(text, labels, correct):
    out = []; n = 0
    for ln in text.split("\n"):
        m = re.match(r"^(\|\s*\*\*(\d{1,2})\.\*\*.*?<!--q:\s*\d+\s*-->(?:✅|❌)?\s*\|)((?:\s*[○🟢🔴]\s*\|)+)\s*$", ln)
        if m:
            num = m.group(2); cols = len(re.findall(r"[○🟢🔴]", m.group(3)))
            hdr = None
            c = letter(correct.get(num) or (labels.get(num, (None, None))[1])); wr = labels.get(num)
            mine = letter(wr[0]) if wr else None
            if c:
                # 列字母取自表头: 回溯最近一行表头
                idx = len(out) - 1
                while idx >= 0 and not re.match(r"^\|\s*\|\s*A\s*\|", out[idx]): idx -= 1
                letters = re.findall(r"[A-Z]+", out[idx]) if idx >= 0 else []
                if len(letters) == cols:
                    cells = ["🟢" if col == c else "🔴" if (mine == col and mine != c) else "○" for col in letters]
                    new = m.group(1) + " " + " | ".join(cells) + " |"
                    if new != ln: ln = new; n += 1
        out.append(ln)
    return "\n".join(out), n
def main():
    apply = "--apply" in sys.argv
    paths = sorted(glob.glob(os.path.join(ROOT, "06. reading", "*", "*.md")) + glob.glob(os.path.join(ROOT, "05. listening", "*", "*.md")))
    texts = {p: open(p, encoding="utf-8").read() for p in paths}
    labels = {}; correct = {}
    for src in (R.labels_ieltsbro(), R.labels_jiufen({p: texts[p] for p in paths if "06. reading" in p})):
        for n, r in src.items(): labels.setdefault(n, {}).update(r)
    for src in (C.ieltsbro_correct(), C.jiufen_correct({p: texts[p] for p in paths if "06. reading" in p})):
        for n, r in src.items(): correct.setdefault(n, {}).update(r)
    lt = {p: texts[p] for p in paths if "05. listening" in p}
    _, ll, lc = L.all_data(lt)
    for n, r in ll.items(): labels.setdefault(n, {}).update(r)
    for n, r in lc.items(): correct.setdefault(n, {}).update(r)
    tot = notes = 0
    for p in paths:
        new, n = refresh(texts[p], labels.get(p, {}), correct.get(p, {}))
        if n:
            notes += 1; tot += n
            if apply: open(p, "w", encoding="utf-8").write(new)
    print(f"刷新匹配表格 {tot} 行, {notes} 篇", "(已写入)" if apply else "(dry run)")
if __name__ == "__main__": main()

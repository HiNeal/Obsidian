#!/usr/bin/env python3
"""听力笔记 `# 题目`: 共用一组选项的匹配题(含看图选字母)改成表格, 与阅读段落匹配一致:
左列题干(粗体题号), 右侧 A..X 各选项一列; 🟢 正确答案, 🔴 我选错的, ○ 其余。选项列表(及地图图片)保留在表上方。
正确/我的答案取自 listening_flow(做题记录), 没记录时取 `**答案**:` 行。缺省 dry run, 加 --apply 写盘。"""
import glob, os, re, sys
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", "..")); HERE = os.path.join(ROOT, ".cache")
sys.path.insert(0, SCRIPTS)
import listening_flow as L
HEAD = re.compile(r"^\*\*Questions?\b[^\n]*$", re.M | re.I)
STOP = re.compile(r"^\*\*(?:Questions?\b|答案)", re.M)
Q = re.compile(r"<!--\s*q:\s*(\d{1,2})\s*-->")
def letter(label):
    m = re.match(r"^([A-Za-z]{1,4})\b", label or ""); return m.group(1).upper() if m and (len(m.group(1)) == 1) else None
def convert(text, data):
    m = re.search(r"^# 题目[ \t]*$", text, re.M)
    if not m: return text, 0, []
    s = m.end(); nxt = re.search(r"^# ", text[s:], re.M); e = s + nxt.start() if nxt else len(text)
    sec = text[s:e]; res = []; skipped = []; last = 0
    labels, correct = data
    for h in HEAD.finditer(sec):
        if h.start() < last: continue
        head = h.group(0)
        if re.search(r"Choose (?:TWO|THREE) letters|flow-?chart|Complete the (?:table|notes|summary|sentences|form)", head, re.I): continue
        rest = sec[h.end():]; stop = STOP.search(rest); body = rest[:stop.start()] if stop else rest
        if re.search(r"^\|", body, re.M): continue
        lines = body.split("\n"); stems = []; keep = []
        for ln in lines:
            if not ln.strip(): continue
            if re.match(r"^\s*[-*]\s+[A-Z]\.\s", ln) or ln.lstrip().startswith("!["): keep.append(ln); continue
            if ln.startswith("**") and not Q.search(ln): keep.append(ln); continue
            if ln.strip().startswith("(选项为地图"): continue
            qm = Q.search(ln)
            if not qm: keep.append(ln); continue
            stem = ln[:qm.start()].rstrip().rstrip("\\_").rstrip(); stem = re.sub(r"(?:\\_)+\s*$", "", stem).rstrip()
            tail = ln[qm.end():]
            if re.search(r"[A-Za-z0-9]", re.sub(r"<!--.*?-->|✅|❌", "", tail)): stems.append(None); break   # 空格后还有正文 => 填空题
            stems.append((qm.group(1), stem))
        if not stems or None in stems or len(stems) < 2: continue
        opt_letters = re.findall(r"^\s*[-*]\s+([A-Z])\.\s", "\n".join(keep), re.M)
        rng = re.search(r"\b([A-Z])\s*[-–]\s*([A-Z])\b", head)
        if opt_letters: cols = sorted(set(opt_letters))
        elif rng: cols = [chr(c) for c in range(ord(rng.group(1)), ord(rng.group(2)) + 1)]
        else: skipped.append(head[:50]); continue
        ans = re.search(r"^\*\*答案\*\*[:：]\s*([A-Z](?:\s*[,，、]\s*[A-Z])*)", rest[stop.start():] if stop else "", re.M)
        key = re.findall(r"[A-Z]", ans.group(1)) if ans else []
        rows = []
        for i, (num, stem) in enumerate(stems):
            wr = labels.get(num); c = letter((correct.get(num) or (wr[1] if wr else None)))
            if not c and len(key) == len(stems): c = key[i]
            mine = letter(wr[0]) if wr else None
            cells = ["🟢" if col == c else "🔴" if (mine == col and mine != c) else "○" for col in cols]
            rows.append(f"| **{num}.** {stem} <!--q: {num}--> | " + " | ".join(cells) + " |")
        table = ["", "|  | " + " | ".join(cols) + " |", "| :--- | " + " | ".join([":-:"] * len(cols)) + " |"] + rows + [""]
        def kind(l): return "b" if re.match(r"^\s*[-*]\s", l) else "o"
        parts = []
        for i, l in enumerate(keep):
            if i and kind(l) != kind(keep[i - 1]): parts.append("")
            parts.append(l)
        pre = "\n".join(parts)
        block = "\n\n" + pre + "\n" + "\n".join(table) + "\n" if pre else "\n" + "\n".join(table) + "\n"
        res.append((h.end(), h.end() + len(body), block)); last = h.end() + len(body)
    for a, b, tb in reversed(res): sec = sec[:a] + tb + sec[b:]
    return text[:s] + sec + text[e:], len(res), skipped
def main():
    apply = "--apply" in sys.argv; texts = {f: open(f, encoding="utf-8").read() for f in L.note_files()}
    _, labels, correct = L.all_data(texts); n = 0
    for f in L.note_files():
        t = texts[f]; new, d, sk = convert(t, (labels.get(f, {}), correct.get(f, {})))
        if d or sk:
            print(f"{os.path.basename(f)[:-3][:44]:44} 转 {d} 组", ("跳过 " + str(sk)) if sk else ""); n += d
            if apply and new != t: open(f, "w", encoding="utf-8").write(new)
    print(f"共 {n} 组", "(已写入)" if apply else "(dry run)")
if __name__ == "__main__": main()

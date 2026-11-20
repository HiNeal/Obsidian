#!/usr/bin/env python3
"""阅读笔记 `# 题目`: 段落信息匹配题(Which paragraph/section contains the following information?)改成表格:
左列题干(粗体题号 + 题干 + 对错标记), 右侧 A..X 各段一列; 🟢 = 正确答案, 🔴 = 我选错的答案, ○ = 其余。
正确答案取自 `**答案**:` 行和做题记录, 我的答案取自做题记录(雅思哥最早一次 / 九分学长最早一次)。
缺省 dry run, 加 --apply 写盘。已是表格的题组不动。"""
import glob, json, os, re, sys
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", "..")); HERE = os.path.join(ROOT, ".cache")
sys.path.insert(0, SCRIPTS)
import errattr_jiufen as J
from ieltsbro_judge import judge

def letters():
    out = {}
    res = json.load(open(f"{HERE}/ieltsbro_records/_map.json")); notes = {}
    for k, v in res.items():
        for date, eid, n, r, title in v:
            if r >= 0.5: notes.setdefault(n, {}).setdefault(title, []).append((date, eid))
    for n, groups in notes.items():
        path = os.path.join(ROOT, n) if not os.path.isabs(n) else n
        for title, att in groups.items():
            att.sort(); d = json.load(open(f"{HERE}/ieltsbro_records/{att[0][1]}.json"))
            for j in judge(d):
                if j["qtype"] == 4 and isinstance(j["num"], int):
                    try: out.setdefault(path, {})[str(j["num"])] = (chr(65 + int(j["mine"])) if j["mine"] is not None else None, chr(65 + int(j["correct"])))
                    except (ValueError, TypeError): pass
    by = {}
    for a in J.attempts(): by.setdefault(a["parts"][0]["title"].strip(), []).append(a)
    for title, atts in by.items():
        n = J.note_for(title)
        if not n: continue
        a = sorted(atts, key=lambda a: a["createdAt"])[0]
        for d in a["details"]:
            if re.fullmatch(r"[A-Z]", d["rightAnswer"] or ""): out.setdefault(n, {})[str(d["qNumber"])] = (d["userAnswer"] or None, d["rightAnswer"])
    return out

HEAD = re.compile(r"^\*\*Questions?\b[^\n]*which (?:paragraph|section)[^\n]*$", re.M | re.I)
MARK = re.compile(r"(?:\\_){2,}\s*(<!--\s*q:\s*(\d{1,2})\s*-->)\s*(✅|❌)?|(<!--\s*(?:q|question):\s*(\d{1,2})\s*-->)\s*(✅|❌)?")

def convert(text, mine):
    out = []; pos = 0; done = 0; skipped = []
    sec_m = re.search(r"^# 题目[ \t]*$", text, re.M)
    if not sec_m: return text, 0, []
    s = sec_m.end(); nxt = re.search(r"^# ", text[s:], re.M); e = s + nxt.start() if nxt else len(text)
    sec = text[s:e]; res = []; last = 0
    for h in HEAD.finditer(sec):
        if h.start() < last: continue
        rest = sec[h.end():]; stop = re.search(r"^\*\*(?:Questions?\b|答案)", rest, re.M)
        body = rest[:stop.start()] if stop else rest
        if "\n|" in "\n" + body.strip(): continue                      # 已是表格
        rng = re.search(r"([A-Z])\s*[-–]\s*([A-Z])", h.group(0))
        if not rng: skipped.append(h.group(0)[:40]); continue
        cols = [chr(c) for c in range(ord(rng.group(1)), ord(rng.group(2)) + 1)]
        items = []
        for ln in body.split("\n"):
            if not ln.strip() or re.match(r"\s*[-*]\s+[A-Z]\.\s", ln) or ln.strip().startswith("(选项为地图"): continue
            m = MARK.search(ln)
            if not m: skipped.append("无题号: " + ln[:30]); items = None; break
            num = m.group(2) or m.group(5); emoji = m.group(3) or m.group(6) or ""
            stem = (ln[:m.start()]).rstrip().rstrip("\\_").rstrip()
            stem = re.sub(r"(?:\\_)+\s*$", "", stem).rstrip()
            items.append((num, stem, emoji))
        if not items: continue
        ans = re.search(r"^\*\*答案\*\*[:：]\s*([A-Z](?:\s*[,，、]\s*[A-Z])*)", rest[stop.start():] if stop else "", re.M)
        key = re.findall(r"[A-Z]", ans.group(1)) if ans else []
        rows = []
        for i, (num, stem, emoji) in enumerate(items):
            m_, c_ = mine.get(num, (None, None))
            c_ = c_ or (key[i] if i < len(key) and len(key) == len(items) else None)
            cells = []
            for col in cols:
                cells.append("🟢" if col == c_ else "🔴" if (m_ == col and m_ != c_) else "○")
            rows.append(f"| **{num}.** {stem} <!--q: {num}-->{emoji} | " + " | ".join(cells) + " |")
        table = ["", "", "|  | " + " | ".join(cols) + " |", "| :--- | " + " | ".join([":-:"] * len(cols)) + " |"] + rows + [""]
        res.append((h.end(), h.end() + len(body), "\n".join(table) + "\n")); last = h.end() + len(body); done += 1
    for a, b, tb in reversed(res): sec = sec[:a] + tb + sec[b:]
    return text[:s] + sec + text[e:], done, skipped

def main():
    apply = "--apply" in sys.argv; data = letters(); n_groups = 0
    for f in sorted(glob.glob(os.path.join(ROOT, "06. reading", "*", "*.md"))):
        t = open(f, encoding="utf-8").read(); new, d, sk = convert(t, data.get(f, {}))
        if d or sk: print(f"{os.path.basename(f)[:-3][:46]:46} 转 {d} 组", "跳过:" + str(sk) if sk else "")
        if d:
            n_groups += d
            if apply and new != t: open(f, "w", encoding="utf-8").write(new)
    print(f"共 {n_groups} 组段落匹配题", "(已写入)" if apply else "(dry run)")
if __name__ == "__main__": main()

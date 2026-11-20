#!/usr/bin/env python3
"""答对的题(✅)也要有卡片: 在 `# 分析` 两列表里补 `| 题号 | 正确: 标准答案 |` (不带分析)。
已有该题的行(含手写行)且没有「正确:」时, 在分析格最前面补一行 `正确: …`。缺省 dry run, 加 --apply 写盘。"""
import glob, json, os, re, sys
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", "..")); HERE = os.path.join(ROOT, ".cache")
sys.path.insert(0, SCRIPTS)
import result_marks as R
import errattr_jiufen as J
import errattr_worksheet as W
from ieltsbro_judge import judge
from errattr_apply import covered, first_int, add_marks

def ieltsbro_correct():
    res = json.load(open(f"{HERE}/ieltsbro_records/_map.json")); notes = {}
    for k, v in res.items():
        for date, eid, n, r, title in v:
            if r >= 0.5: notes.setdefault(n, {}).setdefault(title, []).append((date, eid))
    out = {}
    for n, groups in notes.items():
        path = os.path.join(ROOT, n) if not os.path.isabs(n) else n
        for title, att in groups.items():
            att.sort(); d = json.load(open(f"{HERE}/ieltsbro_records/{att[0][1]}.json")); Jd = judge(d)
            for q in d["subjectData"]["questionList"]:
                qj = q["questionJson"]
                for i, a in enumerate(q["answerJson"]):
                    j = next(x for x in Jd if x["qi"] == q["questionId"] and x["idx"] == i)
                    if j["credit"] < j["total"]: continue
                    num = j["num"]; _, opts = W.stem_for(q, i, num if isinstance(num, int) else qj["startIndex"])
                    out.setdefault(path, {})[R.key(num)] = R.clean(W.label(q, j["correct"], opts))
    return out

def jiufen_correct(texts):
    out = {}; by = {}
    for a in J.attempts(): by.setdefault(a["parts"][0]["title"].strip(), []).append(a)
    for title, atts in by.items():
        n = J.note_for(title)
        if not n: continue
        a = sorted(atts, key=lambda a: a["createdAt"])[0]
        m = re.search(r"^# 题目[ \t]*$", texts[n], re.M); sec = texts[n][m.end():] if m else ""
        nx = re.search(r"^# ", sec, re.M); sec = sec[:nx.start()] if nx else sec
        def lab(num, x):
            if re.fullmatch(r"[A-Za-z]{1,4}", x or ""):
                txt = R.option_map(sec, num).get(x) or R.bullet_before(sec, num, x)
                if txt: return txt if txt.upper() in R.TFNG else f"{x.upper() if re.fullmatch('[ivxIVX]+', x) else x}. {txt}"
            return x
        for d in a["details"]:
            if d["state"] == "1" and d["rightAnswer"]: out.setdefault(n, {})[R.key(d["qNumber"])] = R.clean(lab(d["qNumber"], d["rightAnswer"].strip()))
        for mm in re.finditer(r"<!--\s*question:\s*(\d{1,2})[–-](\d{1,2})\s*-->", sec):
            lo, hi = int(mm.group(1)), int(mm.group(2))
            ds = [d for d in a["details"] if lo <= int(d["qNumber"]) <= hi]
            if ds and all(d["state"] == "1" for d in ds):
                om = R.option_map(sec, f"{lo}[–-]{hi}")
                out.setdefault(n, {})[R.key(f"{lo}-{hi}")] = R.clean(" / ".join(f"{x}. {om[x]}" if x in om else x for x in [d["rightAnswer"] for d in ds]))
    return out

OKMARK = re.compile(r"✅<!--\s*res:\s*(\d{1,2}(?:\s*[–-]\s*\d{1,2})?)\s*-->")

def update(text, correct):
    i = text.find("# 分析")
    if i < 0: return text, 0, 0
    head, sec = text[:i], text[i:]
    lines = sec.split("\n"); idx = [k for k, l in enumerate(lines) if l.startswith("|")]
    if not idx: return text, 0, 0
    a, b = idx[0], idx[-1]; tbl = lines[a:b + 1]
    if any(not l.startswith("|") for l in tbl) or len(tbl) < 2: return text, 0, 0
    rows = [l for l in tbl[2:] if [c.strip() for c in l.strip().strip("|").split("|")][0]]   # 去掉空占位行
    ok = [re.sub(r"\s", "", m.group(1)).replace("-", "–") for m in OKMARK.finditer(head)]
    added = patched = 0; new_rows = list(rows)
    for key in ok:
        lab = correct.get(key)
        if not lab: continue
        nums = covered(key); done = False
        for k, l in enumerate(new_rows):
            c = [x.strip() for x in l.strip().strip("|").split("|")]
            if covered(c[0]) & nums and (c[0].replace("-", "–") == key or covered(c[0]) == nums):
                if "正确:" not in (c[2] if len(c) > 2 else ""):
                    body = f"正确: {lab}<br>{c[2]}" if len(c) > 2 and c[2] else f"正确: {lab}"
                    new_rows[k] = f"| {c[0]} | {c[1] if len(c) > 1 else '✅'} | {body} |"; patched += 1
                done = True; break
        if not done:
            new_rows.append(f"| {key} | ✅ | 正确: {lab} |"); added += 1
    new_rows.sort(key=lambda r: first_int(r.split("|")[1]))
    if not new_rows: new_rows = [l for l in tbl[2:]]               # 没有任何题: 保持空模板
    new_tbl = tbl[:2] + new_rows
    return head + "\n".join(lines[:a] + new_tbl + lines[b + 1:]), added, patched

def main():
    apply = "--apply" in sys.argv
    paths = sorted(glob.glob(os.path.join(ROOT, "06. reading", "*", "*.md")))
    texts = {p: open(p, encoding="utf-8").read() for p in paths}
    correct = {}
    for src in (ieltsbro_correct(), jiufen_correct(texts)):
        for n, r in src.items(): correct.setdefault(n, {}).update(r)
    import listening_flow as L                                   # 听力: 同样补「正确: …」行
    lt = {f: open(f, encoding="utf-8").read() for f in L.note_files()}
    for n, r in L.all_data(lt)[2].items(): correct.setdefault(n, {}).update(r)
    paths += L.note_files(); texts.update(lt)
    A = P = notes = 0
    for p in paths:
        if p not in correct: continue
        new, a, pt = update(texts[p], correct[p])
        if new != texts[p]:
            notes += 1; A += a; P += pt
            if apply: open(p, "w", encoding="utf-8").write(add_marks(new))
    print(f"改动 {notes} 篇, 新增行 {A}, 给手写行补正确 {P}", "(已写入)" if apply else "(dry run)")
if __name__ == "__main__": main()

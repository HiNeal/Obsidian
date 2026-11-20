#!/usr/bin/env python3
"""听力错题工作单(只读): 每篇的错题 = 题干上下文 / 我的 / 正确 / 官方解析。用法: python3 .agents/skills/ielts-note-common/scripts/listening_worksheet.py [笔记名关键字 ...]"""
import glob, json, os, re, sys
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", "..")); HERE = os.path.join(ROOT, ".cache"); sys.path.insert(0, SCRIPTS)
import listening_flow as L, result_marks as R, errattr_worksheet as W, errattr_jiufen as J
from ieltsbro_judge import judge
def ctx(text, num):
    m = re.search(r"^# 题目[ \t]*$", text, re.M)
    sec = text[m.end():] if m else ""; nx = re.search(r"^# ", sec, re.M); sec = sec[:nx.start()] if nx else sec
    k = re.search(r"<!--\s*(?:q|question):\s*" + str(num).replace("–", "[–-]") + r"\s*-->", sec)
    if not k: return ""
    start = sec.rfind("\n", 0, k.start()) + 1; end = sec.find("\n", k.end()); line = sec[start: end if end > 0 else len(sec)]
    pos = k.start() - start; pre = re.sub(r"<!--.*?-->|==|\*\*|\\_", lambda m: "___" if m.group(0) == "\\_" else "", line[:pos])
    return re.sub(r"\s+", " ", pre[-170:]).strip()
def main(only):
    texts = {f: open(f, encoding="utf-8").read() for f in L.note_files()}
    _, labels, _ = L.all_data(texts)
    expl = {}
    res = json.load(open(os.path.join(L.LDIR, "_map.json"))); notes = {}
    for k, v in res.items():
        for date, eid, n, r, title in v:
            if r >= 0.5: notes.setdefault(n, {}).setdefault(title, []).append((date, eid))
    for n, groups in notes.items():
        n = n if os.path.isabs(n) else os.path.join(L.ROOT, n)
        for title, att in groups.items():
            att.sort(); d = json.load(open(os.path.join(L.LDIR, att[0][1] + ".json")))
            for q in d["subjectData"]["questionList"]:
                for i, a in enumerate(q["answerJson"]):
                    num = q["questionJson"]["startIndex"] + i if q["questionType"] != 2 else f'{q["questionJson"]["startIndex"]}–{q["questionJson"]["endIndex"]}'
                    expl.setdefault(n, {})[R.key(num)] = W.txt(a.get("explain"))
    tri = L.note_trigrams()
    for f in L.note_files():
        name = os.path.basename(f)[:-3]
        if only and not any(o.lower() in name.lower() for o in only): continue
        lab = labels.get(f, {})
        if not lab: continue
        print(f"\n######## {name} 错{len(lab)}")
        for k in sorted(lab, key=lambda s: int(re.match(r"\d+", s).group(0))):
            print(f"- Q{k}: …{ctx(texts[f], k)}")
            print(f"  我答: {lab[k][0]} | 正确: {lab[k][1]}")
            e = expl.get(f, {}).get(k, "") or L.EXPL.get(f, {}).get(k, "")
            if e: print("  解析:", e[:300])
if __name__ == "__main__": main(sys.argv[1:])

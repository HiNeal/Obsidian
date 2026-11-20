#!/usr/bin/env python3
"""雅思哥模考记录 -> 并入练习记录同一套数据: 模考 userAnswer 只有作答编号, 题目和标准答案取自题库(reading_cache / listening_cache)。
只补「还没有任何做题记录」的笔记; 写入 ieltsbro_records(_listening)/<id>.json 与 _map.json, 其余流程不变。只读调用。"""
import glob, html, json, os, re, sys, time
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", "..")); HERE = os.path.join(ROOT, ".cache")
sys.path.insert(0, SCRIPTS)
import ieltsbro_api as A
MOCK = os.path.join(HERE, "ieltsbro_mock")
def norm(x): return re.sub(r"[^a-z0-9 ]", "", html.unescape(x or "").lower().replace("\xa0", " ").replace("’", "'").replace("‘", "'")).split()
def htm(h): return html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<br\s*/?>|</div>|</p>", " ", h or "")))
def grams(w, n): return set(zip(*[w[i:] for i in range(n)]))

def mock_exams():
    lst = []; p = 1
    while True:
        c = A.call("hcp/studyCenter/examInfo/pageV3", {"curPage": p, "status": None, "paperCode": None})["pageData"]
        lst += c["list"]; time.sleep(0.3)
        if len(lst) >= c["total"] or not c["list"]: break
        p += 1
    return lst

def user_answers(x, part):
    f = os.path.join(MOCK, f"{x['examInfoId']}_{part}.json")
    if os.path.exists(f): return json.load(open(f))
    d = A.call(f"hcp/studyCenter/examDetail/userAnswer?examId={x['examInfoId']}&examPart={part}"); time.sleep(0.4)
    json.dump({k: d[k] for k in ("scoreDetail",)}, open(f, "w"), ensure_ascii=False); return json.load(open(f))

def covered_notes(kind):
    d = "ieltsbro_records" if kind == "reading" else "ieltsbro_records_listening"
    res = json.load(open(os.path.join(HERE, d, "_map.json"))); out = set()
    for k, v in res.items():
        for date, eid, n, r, title in v:
            if r >= 0.5: out.add(os.path.basename(n))
    return out

def reading(apply):
    exams = [x for x in mock_exams() if "3" in x["examInclude"].split(",") and x["passagesScore"] > 0 and x["timeSpend"] > 0]
    notes = {}
    for f in glob.glob(os.path.join(ROOT, "06. reading", "*", "*.md")):
        t = open(f, encoding="utf-8").read(); m = re.search(r"# 原文\s*\n(.*?)(?=\n# |\Z)", t, re.S)
        if m: notes[f] = grams(norm(re.sub(r"<!--.*?-->|==|\*\*|!\[\[.*?\]\]|\([A-H]\)", "", m.group(1))), 4)
    cov = covered_notes("reading"); cache = {}
    for f in glob.glob(os.path.join(HERE, "reading_cache", "*.json")):
        d = json.load(open(f)); cache[d.get("_title", "")] = d
    mp = json.load(open(os.path.join(HERE, "ieltsbro_records", "_map.json"))); lst = json.load(open(os.path.join(HERE, "ieltsbro_records", "_list.json")))
    added = []
    for x in exams:
        ua = user_answers(x, 3); sd = ua["scoreDetail"]; code = x["paperCode"].replace(" Test ", "-Test ")
        for part in (1, 2, 3):
            title = f"{code}-Passage {part}"; d = cache.get(title)
            if not d: continue
            nums = [q["questionJson"]["startIndex"] + i for q in d["questionList"] for i in range(len(q["answerJson"]))]
            if not any(str(n) in sd or any(k.startswith(str(n)) for k in sd) for n in nums): continue
            G = grams(norm(htm(d["passagesContent"])), 4)
            note, r = max(((n, len(A_ & G) / max(1, len(G))) for n, A_ in notes.items()), key=lambda z: z[1])
            if r < 0.5 or os.path.basename(note) in cov: continue
            eid = f"mock{x['examInfoId']}p{part}"; date = x["startedDate"][:19].replace("T", " ")
            rec = {"scoreDetail": sd, "subjectData": {k: d[k] for k in ("passagesContent", "questionList") if k in d}, "timeSpend": x["timeSpend"]}
            added.append((title, date, eid, note, r)); print("补", title, "->", os.path.basename(note)[:44], round(r, 2), date)
            if apply:
                json.dump(rec, open(os.path.join(HERE, "ieltsbro_records", eid + ".json"), "w"), ensure_ascii=False)
                mp.setdefault(title, []).append([date, eid, os.path.relpath(note, ROOT), round(r, 2), f"mock-{title}"])
    if apply: json.dump(mp, open(os.path.join(HERE, "ieltsbro_records", "_map.json"), "w"), ensure_ascii=False)
    print(len(added), "条模考作答可补" + ("(已写入)" if apply else "(dry run)"))

def listening(apply):
    exams = [x for x in mock_exams() if "1" in x["examInclude"].split(",") and x["listeningScore"] > 0 and x["timeSpend"] > 0]
    def qtext(d):
        out = []
        for q in d["questionList"]:
            qj = q["questionJson"]; out += [htm(qj.get("descriptions")), htm(qj.get("questionsContent"))]
            for it in qj.get("questions") or []:
                out.append(htm(it.get("content"))); out += [htm(o.get("content")) for o in it.get("options", [])]
            out += [htm(o.get("content")) for o in qj.get("matchOptions") or []]
        return set(norm(" ".join(out)))
    notes = {}
    for f in glob.glob(os.path.join(ROOT, "05. listening", "*", "*.md")):
        t = open(f, encoding="utf-8").read(); m = re.search(r"^# 题目[ \t]*$", t, re.M); sec = t[m.end():] if m else ""
        nx = re.search(r"^# ", sec, re.M); sec = sec[:nx.start()] if nx else sec
        notes[f] = set(norm(re.sub(r"<!--.*?-->|==|\*\*|\\_|[|○🟢🔴✅❌]", "", sec)))
    cov = covered_notes("listening"); cache = {}
    for f in glob.glob(os.path.join(HERE, "listening_cache", "*.json")):
        d = json.load(open(f)); cache[d.get("_title", "")] = d
    d0 = os.path.join(HERE, "ieltsbro_records_listening")
    mp = json.load(open(os.path.join(d0, "_map.json"))); added = []
    for x in exams:
        sd = user_answers(x, 1)["scoreDetail"]; code = x["paperCode"].replace(" Test ", "-Test ")
        for part in (1, 2, 3, 4):
            title = f"{code}-Part {part}"; d = cache.get(title)
            if not d: continue
            nums = [q["questionJson"]["startIndex"] + i for q in d["questionList"] for i in range(len(q["answerJson"]))]
            if not any(str(n) in sd or any(k.startswith(str(n) + "-") for k in sd) for n in nums): continue
            B = qtext(d)
            note, r = max(((n, len(S & B) / max(1, len(B))) for n, S in notes.items()), key=lambda z: z[1])
            if r < 0.6 or os.path.basename(note) in cov: continue
            eid = f"mock{x['examInfoId']}p{part}"; date = x["startedDate"][:19].replace("T", " ")
            added.append(title); print("补", title, "->", os.path.basename(note)[:44], round(r, 2), date)
            if apply:
                json.dump({"scoreDetail": sd, "subjectData": {"questionList": d["questionList"], "listenDetailList": []}, "timeSpend": x["timeSpend"]}, open(os.path.join(d0, eid + ".json"), "w"), ensure_ascii=False)
                mp.setdefault(title, []).append([date, eid, os.path.relpath(note, ROOT), round(r, 2), f"mock-{title}"])
    if apply: json.dump(mp, open(os.path.join(d0, "_map.json"), "w"), ensure_ascii=False)
    print(len(added), "条听力模考作答可补" + ("(已写入)" if apply else "(dry run)"))

def gaps(apply):
    """笔记已有部分题的做题记录(缺口), 用模考作答补缺的题组(只补缺口, 不覆盖已有结果)。"""
    exams = [x for x in mock_exams() if x["timeSpend"] > 0]
    def missing(note):
        t = open(note, encoding="utf-8").read(); m = re.search(r"^# 题目[ \t]*$", t, re.M)
        sec = t[m.end():] if m else ""; nx = re.search(r"^# ", sec, re.M); sec = sec[:nx.start()] if nx else sec
        qs = {int(a) for a in re.findall(r"<!--\s*(?:q|question):\s*(\d{1,2})", sec)}
        for a, b in re.findall(r"<!--\s*question:\s*(\d{1,2})[–-](\d{1,2})", sec): qs |= set(range(int(a), int(b) + 1))
        have = {int(a) for a in re.findall(r"(?:q|question|res):\s*(\d{1,2})\s*-->\s*[✅❌]", sec)}
        for a, b in re.findall(r"(?:question|res):\s*(\d{1,2})[–-](\d{1,2})\s*-->\s*[✅❌]", sec): have |= set(range(int(a), int(b) + 1))
        return qs - have
    for kind, glob_dir, cachedir, part_key, prefix, maxpart in (("reading", "06. reading", "reading_cache", 3, "Passage", 3), ("listening", "05. listening", "listening_cache", 1, "Part", 4)):
        recd = "ieltsbro_records" if kind == "reading" else "ieltsbro_records_listening"
        mp = json.load(open(os.path.join(HERE, recd, "_map.json"))); cache = {}
        for f in glob.glob(os.path.join(HERE, cachedir, "*.json")):
            d = json.load(open(f)); cache[d.get("_title", "")] = d
        for note in glob.glob(os.path.join(ROOT, glob_dir, "*", "*.md")):
            miss = missing(note)
            if not miss: continue
            for x in exams:
                if str(part_key) not in x["examInclude"].split(","): continue
                sd = user_answers(x, part_key)["scoreDetail"]; code = x["paperCode"].replace(" Test ", "-Test ")
                for part in range(1, maxpart + 1):
                    title = f"{code}-{prefix} {part}"; d = cache.get(title)
                    if not d: continue
                    groups = []
                    for q in d["questionList"]:
                        s, e_ = q["questionJson"]["startIndex"], q["questionJson"]["endIndex"]
                        if set(range(s, e_ + 1)) <= miss and any(str(n) in sd or f"{s}-{e_}" in sd for n in range(s, e_ + 1)): groups.append(q)
                    if not groups: continue
                    txt = open(note, encoding="utf-8").read()
                    if kind == "reading":
                        m = re.search(r"# 原文\s*\n(.*?)(?=\n# |\Z)", txt, re.S); A_ = grams(norm(re.sub(r"<!--.*?-->|==|\*\*|!\[\[.*?\]\]|\([A-H]\)", "", m.group(1))), 4)
                        r = len(A_ & grams(norm(htm(d["passagesContent"])), 4)) / max(1, len(A_))
                        if r < 0.5: continue
                    else: continue
                    eid = f"mock{x['examInfoId']}p{part}gap"; date = x["startedDate"][:19].replace("T", " ")
                    print("补缺口", title, "->", os.path.basename(note)[:40], sorted({n for q in groups for n in range(q['questionJson']['startIndex'], q['questionJson']['endIndex'] + 1)}), date)
                    if apply:
                        json.dump({"scoreDetail": sd, "subjectData": {"questionList": groups}, "timeSpend": x["timeSpend"]}, open(os.path.join(HERE, recd, eid + ".json"), "w"), ensure_ascii=False)
                        mp.setdefault(title, []).append([date, eid, os.path.relpath(note, ROOT), round(r, 2), f"mock-gap-{title}"])
        if apply: json.dump(mp, open(os.path.join(HERE, recd, "_map.json"), "w"), ensure_ascii=False)

if __name__ == "__main__":
    reading("--apply" in sys.argv); listening("--apply" in sys.argv); gaps("--apply" in sys.argv)

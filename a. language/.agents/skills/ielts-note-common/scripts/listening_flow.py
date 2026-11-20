#!/usr/bin/env python3
"""听力做题记录 -> 对错 / 标签 / 正确答案 (雅思哥 ieltsbro_records_listening 最早一次 + 九分学长缓存回顾最早一次)。
供 result_marks / errattr_apply / errattr_correct 合并使用; 单独运行可查看匹配情况。"""
import glob, json, os, re, sys, html
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", "..")); HERE = os.path.join(ROOT, ".cache")
sys.path.insert(0, SCRIPTS)
import result_marks as R
import errattr_worksheet as W
import errattr_jiufen as J
from ieltsbro_judge import judge
LDIR = os.path.join(HERE, "ieltsbro_records_listening")
EXPL = {}   # path -> key -> 官方解析文本(九分学长回顾), 供工作单使用

def _norm(x): return re.sub(r"[^a-z0-9 ]", "", html.unescape(x or "").lower().replace("\xa0", " ").replace("’", "'").replace("‘", "'")).split()
def _tri(w): return set(zip(w, w[1:], w[2:]))
def note_files(): return sorted(f for f in glob.glob(os.path.join(ROOT, "05. listening", "*", "*.md")) if "/01. 方法总论/" not in f)
def note_trigrams():
    out = {}
    for f in note_files():
        t = open(f, encoding="utf-8").read(); m = re.search(r"# 音频\\s*\\n(.*?)(?=\\n# )".replace("\\\\", "\\"), t, re.S)
        if m: out[f] = _tri(_norm(re.sub(r"<!--.*?-->|==|\*\*|!\[\[.*?\]\]", "", m.group(1))))
    return out

def ieltsbro():
    """返回 (results, labels, correct): path -> key -> bool / (我的, 正确) / 正确标签。"""
    res = json.load(open(os.path.join(LDIR, "_map.json"))); notes = {}
    for k, v in res.items():
        for date, eid, n, r, title in v:
            if r >= 0.5: notes.setdefault(n, {}).setdefault(title, []).append((date, eid))
    results, labels, correct = {}, {}, {}
    for n, groups in notes.items():
        path = n if os.path.isabs(n) else os.path.join(ROOT, n)
        for title, att in groups.items():
            att.sort(); d = json.load(open(os.path.join(LDIR, att[0][1] + ".json"))); Jd = judge(d)
            for q in d["subjectData"]["questionList"]:
                qj = q["questionJson"]
                for i, a in enumerate(q["answerJson"]):
                    j = next(x for x in Jd if x["qi"] == q["questionId"] and x["idx"] == i)
                    key = R.key(j["num"])
                    try: _, opts = W.stem_for(q, i, j["num"] if isinstance(j["num"], int) else qj["startIndex"])
                    except Exception: opts = []
                    ok = j["credit"] >= j["total"]; results.setdefault(path, {})[key] = ok
                    cor = R.clean(W.label(q, j["correct"], opts))
                    correct.setdefault(path, {})[key] = cor
                    if not ok:
                        mine = R.clean(W.label(q, j["mine"], opts)) if j["mine"] is not None else "(未作答)"
                        labels.setdefault(path, {})[key] = (mine, cor)
    return results, labels, correct

def jiufen(texts):
    """九分学长听力回顾: 每个 part 按转写相似度匹配笔记, 每篇取最早一次。"""
    tri = note_trigrams(); best = {}
    for a in J.attempts("listening"):
        for pt in a["parts"]:
            aj = pt.get("articleJson")
            try: segs = json.loads(aj)["segments"] if isinstance(aj, str) else (aj or {}).get("segments", [])
            except Exception: segs = []
            G = _tri(_norm(" ".join(s.get("text", "") for s in segs)))
            if not G: continue
            f, r = max(((f, len(A & G) / max(1, len(G))) for f, A in tri.items()), key=lambda z: z[1])
            if r < 0.6: continue
            if f not in best or a["createdAt"] < best[f][0]["createdAt"]: best[f] = (a, pt)
    results, labels, correct = {}, {}, {}
    for f, (a, pt) in best.items():
        t = texts.get(f) or open(f, encoding="utf-8").read()
        m = re.search(r"^# 题目[ \t]*$", t, re.M); sec = t[m.end():] if m else ""
        nx = re.search(r"^# ", sec, re.M); sec = sec[:nx.start()] if nx else sec
        def lab(num, x):
            x = (x or "").strip()
            if not x: return "(未作答)"
            if re.fullmatch(r"[A-Za-z]{1,4}", x):
                txt = R.option_map(sec, num).get(x) or R.bullet_before(sec, num, x)
                if txt: return txt if txt.upper() in R.TFNG else f"{x.upper() if re.fullmatch('[ivxIVX]+', x) else x}. {txt}"
            return x
        qmap = {q["id"]: q for g in pt["groups"] for q in g["questions"]}
        for d in a["details"]:
            key = R.key(d["qNumber"]); ok = d["state"] == "1"
            results.setdefault(f, {})[key] = ok
            qq = qmap.get(d["questionId"]) or {}
            EXPL.setdefault(f, {})[key] = "；".join(J.txt(x.get("content")) for x in (qq.get("analyses") or []))
            cor = R.clean(lab(d["qNumber"], d["rightAnswer"])); correct.setdefault(f, {})[key] = cor
            if not ok: labels.setdefault(f, {})[key] = (R.clean(lab(d["qNumber"], d["userAnswer"])), cor)
        # 多选题范围 (如 15–16): 逐题结果合并
        for mm in re.finditer(r"<!--\s*question:\s*(\d{1,2})[–-](\d{1,2})\s*-->", sec):
            lo, hi = int(mm.group(1)), int(mm.group(2)); ds = [d for d in a["details"] if lo <= int(d["qNumber"]) <= hi]
            if not ds: continue
            k = R.key(f"{lo}-{hi}"); om = R.option_map(sec, f"{lo}[–-]{hi}")
            f_ = lambda L: " / ".join(f"{x}. {om[x]}" if x in om else x for x in L if x)
            ok = all(d["state"] == "1" for d in ds); results[f][k] = ok
            cor = R.clean(f_([d["rightAnswer"] for d in ds])); correct[f][k] = cor
            if not ok: labels.setdefault(f, {})[k] = (R.clean(f_([d["userAnswer"] for d in ds]) or "(未作答)"), cor)
    return results, labels, correct

def all_data(texts=None):
    texts = texts or {f: open(f, encoding="utf-8").read() for f in note_files()}
    out = [{}, {}, {}]
    for src in (ieltsbro(), jiufen(texts)):
        for i in range(3):
            for n, r in src[i].items(): out[i].setdefault(n, {}).update(r)
    return out

if __name__ == "__main__":
    results, labels, correct = all_data()
    for n in sorted(results): print(os.path.basename(n)[:-3][:44].ljust(44), "✅", sum(results[n].values()), "❌", sum(1 for v in results[n].values() if not v))
    print(len(results), "篇有记录")

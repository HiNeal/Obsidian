#!/usr/bin/env python3
"""把做题对错写进阅读笔记 `# 题目`: 在 `<!--q: N-->` / `<!--question: N-->` 之后放 ✅(答对) 或 ❌(答错)。
来源: 雅思哥 ieltsbro_records(每个题组取最早一次作答) + 九分学长缓存(每篇取最早一次)。
多选题 `<!--question: 23–24-->` 只有两空全对才是 ✅。缺省 dry run, 加 --apply 写盘。幂等: 已有标记会按最新结果更新。"""
import glob, json, os, re, sys
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", "..")); HERE = os.path.join(ROOT, ".cache")
sys.path.insert(0, SCRIPTS)
from ieltsbro_judge import judge
import errattr_jiufen as J

def key(n): return str(n).replace("-", "–")

def ieltsbro():
    res = json.load(open(f"{HERE}/ieltsbro_records/_map.json")); notes = {}
    for k, v in res.items():
        for date, eid, n, r, title in v:
            if r >= 0.5: notes.setdefault(n, {}).setdefault(title, []).append((date, eid))
    out = {}
    for n, groups in notes.items():
        marks = out.setdefault(os.path.join(ROOT, n) if not os.path.isabs(n) else n, {})
        for title, att in groups.items():
            att.sort(); d = json.load(open(f"{HERE}/ieltsbro_records/{att[0][1]}.json"))
            for j in judge(d): marks[key(j["num"])] = j["credit"] >= j["total"]
    return out

def jiufen():
    out = {}
    by = {}
    for a in J.attempts(): by.setdefault(a["parts"][0]["title"].strip(), []).append(a)
    for title, atts in by.items():
        n = J.note_for(title)
        if not n: continue
        a = sorted(atts, key=lambda a: a["createdAt"])[0]
        out[n] = {key(d["qNumber"]): d["state"] == "1" for d in a["details"]}
    return out

ANS = r"(?:[ \t]*<!--\s*ans:[^\n]*?-->)?"
TFNG = {"TRUE", "FALSE", "NOT GIVEN", "YES", "NO"}

def clean(s):
    s = re.sub(r"\s+", " ", str(s)).strip().replace("--", "–").replace("|", "/")
    m = re.fullmatch(r"([A-Z])\.\s*", s)
    s = m.group(1) if m else s
    return (s[:150] + "…") if len(s) > 150 else s

def labels_ieltsbro():
    import errattr_worksheet as W
    out = {}
    for n, items in W.build().items():
        path = os.path.join(ROOT, n) if not os.path.isabs(n) else n
        for it in items: out.setdefault(path, {})[key(it["num"])] = (clean(it["mine"]), clean(it["correct"]))
    return out

def option_map(sec, num):
    """从笔记 `# 题目` 里取该题题干之后的 `- A. xxx` 选项 -> {字母: 文本}。"""
    m = re.search(r"<!--\s*question:\s*" + str(num) + r"\s*-->", sec)
    if not m: return {}
    out = {}
    for ln in sec[m.end():].split("\n")[1:]:
        if not ln.strip() and not out: continue
        b = re.match(r"^\s*[-*]\s+([A-Z])\.\s*(.*)$", ln)
        if b: out[b.group(1)] = re.sub(r"==|<!--.*?-->", "", b.group(2)).strip()
        elif ln.strip(): break
        elif out: break
    return out

def bullet_before(sec, num, letter):
    """题号注释 <!--q: N--> 之前最近的 `- X. 文本` 选项(字母或罗马数字, 不分大小写)。"""
    m = re.search(r"<!--\s*(?:q|question):\s*" + str(num) + r"\s*-->", sec)
    head = sec[:m.start()] if m else sec
    hits = re.findall(r"^\s*[-*]\s+" + re.escape(letter) + r"\.\s+(.+)$", head, re.M | re.I)
    if not hits:                                  # 选项列表现在放在题目下面
        hits = re.findall(r"^\s*[-*]\s+" + re.escape(letter) + r"\.\s+(.+)$", sec, re.M | re.I)
    return re.sub(r"==|<!--.*?-->", "", hits[-1]).strip() if hits else None

def labels_jiufen(texts):
    out = {}
    by = {}
    for a in J.attempts(): by.setdefault(a["parts"][0]["title"].strip(), []).append(a)
    for title, atts in by.items():
        n = J.note_for(title)
        if not n: continue
        a = sorted(atts, key=lambda a: a["createdAt"])[0]
        m = re.search(r"^# 题目[ \t]*$", texts[n], re.M); sec = texts[n][m.end():] if m else ""
        nx = re.search(r"^# ", sec, re.M); sec = sec[:nx.start()] if nx else sec
        for d in a["details"]:
            if d["state"] == "1": continue
            mine, right = (d["userAnswer"] or "").strip(), (d["rightAnswer"] or "").strip()
            def lab(x):
                if not x: return "(未作答)"
                if re.fullmatch(r"[A-Za-z]{1,4}", x):
                    txt = option_map(sec, d["qNumber"]).get(x) or bullet_before(sec, d["qNumber"], x)
                    if txt: return txt if txt.upper() in TFNG else f"{x.upper() if re.fullmatch('[ivxIVX]+', x) else x}. {txt}"
                return x
            out.setdefault(n, {})[key(d["qNumber"])] = (clean(lab(mine)), clean(lab(right)))
        # 多选题范围(如 38–40): 逐题的选择合并成一条
        for mm in re.finditer(r"<!--\s*question:\s*(\d{1,2})[–-](\d{1,2})\s*-->", sec):
            lo, hi = int(mm.group(1)), int(mm.group(2)); ks = [str(i) for i in range(lo, hi + 1)]
            if all(k in out.get(n, {}) or True for k in ks):
                mine_l = [d["userAnswer"] for d in a["details"] if lo <= int(d["qNumber"]) <= hi and d["userAnswer"]]
                right_l = [d["rightAnswer"] for d in a["details"] if lo <= int(d["qNumber"]) <= hi]
                om = option_map(sec, f"{lo}[–-]{hi}")
                f = lambda L: " / ".join(f"{x}. {om[x]}" if x in om else x for x in L)
                out.setdefault(n, {})[key(f"{lo}-{hi}")] = (clean(f(mine_l)) if mine_l else "(未作答)", clean(f(right_l)))
    return out

MARK = re.compile(r"(<!--\s*(?:q|question):\s*(\d{1,2}(?:\s*[–-]\s*\d{1,2})?)\s*-->)(?:[ \t]*(?:✅|❌))?" + ANS)

QM = re.compile(r"<!--\s*(q|question):\s*(\d{1,2}(?:\s*[–-]\s*\d{1,2})?)\s*-->")
STRIP_Q = re.compile(r"(<!--\s*q:\s*\d{1,2}\s*-->)(?:✅|❌)(?:<!--\s*ans:[^\n]*?-->)?")
STRIP_RES = re.compile(r"[ \t]?<!--\s*res:\s*\d{1,2}\s*-->(?:✅|❌)(?:<!--\s*ans:[^\n]*?-->)?")
SENT = re.compile(r"(?:[ \t]*[.?!])+(?=[ \t]+[A-Z“\"(‘']|[ \t]*$)")

def mask(line):                      # 把 HTML 注释换成等长空白, 找句号时不会误入注释
    return re.sub(r"<!--.*?-->", lambda m: " " * len(m.group(0)), line)

def apply_note(text, results, labels=None):
    """先去掉前置标记, 按旧逻辑重算, 最后把 ✅/❌ 统一搬到每题最前面(result_front)。"""
    import result_front as RF
    new, hit, total, unused = _apply_note(RF.strip_front(text), results, labels)
    return RF.section_to_front(new), hit, total, unused

def _apply_note(text, results, labels=None):
    """选择/判断/段落匹配: 对错紧跟题号注释(题干后面)。填空题: 空格处只留 <!--q: N-->, 对错放在这道题(这一句)末尾 <!--res: N-->✅。"""
    labels = labels or {}
    m = re.search(r"^# 题目[ \t]*$", text, re.M)
    if not m: return text, 0, 0, set(results)
    s = m.end(); nxt = re.search(r"^# ", text[s:], re.M); e = s + nxt.start() if nxt else len(text)
    hit = total = 0; used = set(); out = []
    def mark(k):                      # k: 归一化题号字符串 -> (emoji+答案注释) 或 None
        members = [k]
        if k not in results and "–" in k:
            a, b = map(int, k.split("–")); members = [str(i) for i in range(a, b + 1)]
            if not all(x in results for x in members): return None
        elif k not in results: return None
        used.update(members)
        ok = all(results[x] for x in members)
        return "✅" if ok else "❌"
    for ln in text[s:e].split("\n"):
        qs = list(QM.finditer(ln))
        if not qs: out.append(ln); continue
        matching_row = ln.lstrip().startswith("|") and re.search(r"[○🟢🔴]", ln)
        fill = (not matching_row) and all(q.group(1) == "q" for q in qs)
        total += len(qs)
        if not fill:                                                  # 题干后面(紧跟题号注释)
            def rep(mm):
                nonlocal hit
                r = mark(key(re.sub(r"\s", "", mm.group(2))))
                if r is None: return mm.group(0)
                hit += 1; return mm.group(1) + r + (" " if mm.string[mm.end():mm.end() + 1] == "|" else "")
            out.append(MARK.sub(rep, ln)); continue
        ln = STRIP_RES.sub("", STRIP_Q.sub(r"\1", ln))               # 先清掉旧标记, 保证可重复运行
        qs = list(QM.finditer(ln)); masked = mask(ln); inserts = {}
        row = ln.lstrip().startswith("|")
        for q in qs:
            num = key(re.sub(r"\s", "", q.group(2))); r = mark(num)
            if r is None: continue
            hit += 1
            if row:                                               # 表格行: 放在该空所在单元格的末尾
                nxt = masked.find("|", q.end()); pos = nxt if nxt >= 0 else len(ln.rstrip())
                while pos > 0 and ln[pos - 1] == " ": pos -= 1
            else:
                sm = SENT.search(masked, q.end()); pos = sm.end() if sm else len(ln.rstrip())
            inserts.setdefault(pos, []).append(f" <!--res: {num}-->{r}")
        for pos in sorted(inserts, reverse=True): ln = ln[:pos] + "".join(inserts[pos]) + ln[pos:]
        out.append(ln)
    return text[:s] + "\n".join(out) + text[e:], hit, total, set(results) - used

def main():
    apply = "--apply" in sys.argv
    allres = {}
    for src in (ieltsbro(), jiufen()):
        for n, r in src.items(): allres.setdefault(n, {}).update(r)
    texts = {n: open(n, encoding="utf-8").read() for n in allres}
    import listening_flow as L                                   # 听力: 同样的对错标记
    lres = L.all_data()[0]
    for n, r in lres.items():
        allres.setdefault(n, {}).update(r); texts[n] = open(n, encoding="utf-8").read()
    labels = {}
    for src in (labels_ieltsbro(), labels_jiufen(texts)):
        for n, r in src.items(): labels.setdefault(n, {}).update(r)
    changed = ok = bad = 0; problems = []; noans = 0
    for n, r in sorted(allres.items()):
        t = texts[n]
        new, hit, total, unused = apply_note(t, r, labels.get(n, {}))
        o = sum(1 for k, v in r.items() if v and k not in unused); b = sum(1 for k, v in r.items() if not v and k not in unused)
        ok += o; bad += b
        if unused or hit < total: problems.append((os.path.basename(n)[:-3], f"标记 {hit}/{total}", "题目里找不到的结果题号: " + ",".join(sorted(unused)) if unused else ""))
        if new != t:
            changed += 1
            if apply: open(n, "w", encoding="utf-8").write(new)
    print(f"涉及笔记 {len(allres)} 篇, 改动 {changed} 篇, ✅ {ok} 个, ❌ {bad} 个", "(已写入)" if apply else "(dry run)")
    for p in problems: print("  需核对:", *p)
if __name__ == "__main__": main()

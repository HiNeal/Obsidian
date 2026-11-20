"""雅思哥阅读错题工作单: 每个题组取最早一次作答, 输出错题的题干/选项/我的答案/标准答案/官方解析。
用法: python3 .agents/skills/ielts-note-common/scripts/errattr_worksheet.py [笔记名关键字 ...]  (只读缓存 ieltsbro_records/)"""
import json, re, sys, html, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ieltsbro_judge import judge
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", "..")); HERE = os.path.join(ROOT, ".cache")
L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
def txt(h, n=None):
    s = html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<br\s*/?>|</div>|</p>|</li>", "\n", str(h or ""))))
    s = re.sub(r"[ \t\xa0]+", " ", s); s = re.sub(r"\n\s*", "\n", s).strip()
    return s[:n] if n else s

def stem_for(q, a_index, num):
    qj = q["questionJson"]; qt = q["questionType"]
    if qt in (1, 3, 2):
        item = qj["questions"][0 if qt == 2 else a_index]
        opts = [o["content"] for o in item.get("options", [])]
        return item["content"].strip(), opts
    content = txt(qj.get("questionsContent"))
    if qt == 4:
        m = re.search(r"^\s*%s\.?\s*(.+?)\s*(?:\.{3,})?\s*$" % re.escape(str(num)), content, re.M) or re.search(r"[^.\n]*\b%s\s*\.{3,}[^.\n]*[.\n]?" % re.escape(str(num)), content)
        s = (m.group(1) if m and m.lastindex else m.group(0)).strip() if m else content[:200]
        return s, [f"{o['index']}. {o['content']}" for o in qj.get("matchOptions", [])]
    # 填空: 第 i 个 ...... 即第 i 空
    parts = re.split(r"\.{3,}", content)
    i = a_index
    pre = parts[i][-110:] if i < len(parts) else ""
    post = parts[i + 1][:70] if i + 1 < len(parts) else ""
    return (pre + " ______ " + post).replace("\n", " ").strip(), []

def label(q, v, opts):
    qt = q["questionType"]
    try:
        if qt == 1: return f"{L[int(v)]}. {opts[int(v)]}"
        if qt == 3: return opts[int(v)]
        if qt == 4:
            i = int(v); return opts[i] if i < len(opts) else str(v)
        if qt == 2:
            vs = v if isinstance(v, list) else json.loads(v)
            return " / ".join(f"{L[int(i)]}. {opts[int(i)]}" for i in vs)
    except Exception: pass
    return str(v)

def build(only=None):
    res = json.load(open(f"{HERE}/ieltsbro_records/_map.json"))
    notes = {}
    for k, v in res.items():
        for date, eid, n, r, title in v:
            if r >= 0.5: notes.setdefault(n, {}).setdefault(title, []).append((date, eid))
    out = {}
    for n, groups in sorted(notes.items()):
        name = os.path.basename(n)[:-3]
        if only and not any((o[1:].lower()==name.lower()) if o.startswith('=') else (o.lower() in name.lower()) for o in only): continue
        items = []
        for title, att in groups.items():
            att.sort(); d = json.load(open(f"{HERE}/ieltsbro_records/{att[0][1]}.json"))
            J = judge(d)
            for q in d["subjectData"]["questionList"]:
                qj = q["questionJson"]; s, e = qj["startIndex"], qj["endIndex"]
                for i, a in enumerate(q["answerJson"]):
                    j = next(x for x in J if x["qi"] == q["questionId"] and x["idx"] == i)
                    if j["credit"] >= j["total"]: continue
                    num = j["num"]; stem, opts = stem_for(q, i, num if isinstance(num, int) else s)
                    qt = q["questionType"]
                    mine = label(q, j["mine"], opts) if j["mine"] is not None else "(未作答)"
                    cor = label(q, j["correct"], opts)
                    items.append(dict(num=num, qt=qt, stem=stem, mine=mine, correct=cor, explain=txt(a.get("explain")), kw=txt(a.get("keywords")), date=att[0][0], group=q["questionNavigation"], nattempt=len(att)))
        out[n] = items
    return out

if __name__ == "__main__":
    only = sys.argv[1:]
    TY = {0: "填空", 1: "单选", 2: "多选", 3: "判断", 4: "匹配/选词"}
    for n, items in build(only).items():
        print(f"\n######## {os.path.basename(n)[:-3]}  [{n.split('/')[1]}]  错题{len(items)}")
        for it in items:
            print(f"- Q{it['num']} ({TY[it['qt']]}) {it['stem'][:200]}")
            print(f"  我答: {it['mine'][:120]} | 正确: {it['correct'][:120]}")
            print(f"  解析: {it['explain'][:330]}")

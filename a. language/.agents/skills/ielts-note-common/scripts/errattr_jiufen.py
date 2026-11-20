"""九分学长阅读做题回顾(缓存 results/<id>/review)的错题工作单: 每篇取最早一次作答。只读缓存。
用法: python3 .agents/skills/ielts-note-common/scripts/errattr_jiufen.py [标题关键字 ...]"""
import os, re, zlib, json, html, glob, sys
C = os.path.expanduser("~/Library/Application Support/xxgg-electron/Cache/Cache_Data")
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", "..")); HERE = os.path.join(ROOT, ".cache")
def txt(h, n=None):
    s = html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<br\s*/?>|</div>|</p>|</li>", "\n", str(h or ""))))
    s = re.sub(r"[ \t\xa0]+", " ", s); s = re.sub(r"\n\s*", "\n", s).strip()
    return s[:n] if n else s
def key(s): return re.sub(r"[^a-z0-9]", "", s.lower())
def attempts(channel="reading"):
    out = []
    for f in sorted(os.listdir(C)):
        p = os.path.join(C, f)
        if not os.path.isfile(p): continue
        b = open(p, "rb").read()
        u = re.search(rb"https?://[^\x00\s\x1f]+", b[:400])
        if not u or b"/review" not in u.group(0) or not (b"results" in u.group(0) or b"mixed-practice/compositions" in u.group(0)): continue
        i = b.find(b"\x1f\x8b")
        try: d = json.loads(zlib.decompressobj(31).decompress(b[i:]))["data"]
        except Exception: continue
        # 单篇回顾是 d["attempt"]; 组卷回顾(mixed-practice/compositions/<id>/review)的每篇作答在 d["children"][i]["attempt"]
        for a in ([d["attempt"]] if "attempt" in d else [c["attempt"] for c in d.get("children", []) if c.get("attempt")]):
            if a["channel"] == channel: out.append(a)
    return out
def note_for(title):
    k = key(title)
    for n in sorted(glob.glob(os.path.join(ROOT, "06. reading", "*", "*.md"))):
        if "/01. 方法总论/" in n: continue
        kk = key(os.path.basename(n)[:-3])
        if not kk: continue
        if kk == k or kk.startswith(k) or k.startswith(kk): return n
def build(only=None):
    by = {}
    for a in attempts():
        by.setdefault(a["parts"][0]["title"].strip(), []).append(a)
    res = {}
    for title, atts in by.items():
        if only and not any(o.lower() in title.lower() for o in only): continue
        atts.sort(key=lambda a: a["createdAt"]); a = atts[0]
        qs = {}
        for pt in a["parts"]:
            for g in pt["groups"]:
                for q in g["questions"]: qs[q["id"]] = (g, q)
        items = []
        for dt in a["details"]:
            if dt["state"] == "1": continue
            g, q = qs.get(dt["questionId"], (None, None))
            opts = q.get("options") if q else []
            ana = "；".join(txt(x.get("content")) for x in (q.get("analyses") or [])) if q else ""
            items.append(dict(num=dt["qNumber"], gtype=g["type"] if g else "", qrange=g["qRange"] if g else "", state=dt["state"],
                              stem=txt(q.get("question") if q else "", 260), opts=[txt(o.get("content") if isinstance(o, dict) else o, 90) for o in (opts or [])],
                              mine=dt["userAnswer"], correct=dt["rightAnswer"], explain=ana, desc=txt(g.get("description") if g else "", 160), content=txt(g.get("contentHtml") if g else "")))
        res[title] = dict(note=note_for(title), date=a["createdAt"], n=len(atts), items=items, acc=(a["correctCount"], a["totalCount"]))
    return res
if __name__ == "__main__":
    for t, r in build(sys.argv[1:]).items():
        print(f"\n######## {t} [{os.path.basename(r['note'])[:-3] if r['note'] else '无笔记'}] {r['date']} 共{r['n']}次 {r['acc'][0]}/{r['acc'][1]} 错{len(r['items'])}")
        for it in r["items"]:
            print(f"- Q{it['num']} ({it['gtype']},{it['qrange']}) state={it['state']} 我答:{it['mine']!r} 正确:{it['correct']!r}")
            if it["stem"]: print("  题干:", it["stem"][:200])
            if it["opts"]: print("  选项:", " | ".join(f"{chr(65+i)}.{o}" for i, o in enumerate(it["opts"]))[:420])
            print("  解析:", it["explain"][:360])

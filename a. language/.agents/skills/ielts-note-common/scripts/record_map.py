#!/usr/bin/env python3
"""把还没映射的练习记录(_list.json 里有、_map.json 里没有)按原文/剧本相似度匹配到笔记, 写入 _map.json。
阅读: 记录里的 passagesContent 与笔记 `# 原文` 的 4 元词组相似度; 听力: 记录的 listenDetailList 与笔记 `# 音频` 剧本的 3 元词组相似度。
相似度 >= 0.5 才算匹配; 没有匹配的记录(= 笔记还不存在)会列出来, 需要先新建笔记再重跑。
用法: python3 .agents/skills/ielts-note-common/scripts/record_map.py [--reading|--listening] [--apply]   缺省 dry run。"""
import glob, html, json, os, re, sys
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", "..")); HERE = os.path.join(ROOT, ".cache")
def norm(x): return re.sub(r"[^a-z0-9 ]", "", html.unescape(x or "").lower().replace("\xa0", " ").replace("’", "'").replace("‘", "'")).split()
def htm(h): return re.sub(r"<[^>]+>", " ", re.sub(r"<br\\s*/?>|</div>|</p>", " ", h or ""))
def grams(w, n): return set(zip(*[w[i:] for i in range(n)]))
CLEAN = r"<!--.*?-->|==|\*\*|!\[\[.*?\]\]|\([A-H]\)"
KINDS = {
    "reading": ("ieltsbro_records", "06. reading", r"# 原文\s*\n(.*?)(?=\n# |\Z)", 4,
                lambda sd: htm(sd.get("passagesContent", "")), lambda sd, v: v["readingDataVO"]["pathInfo"], lambda v: v["readingDataVO"]["title"]),
    "listening": ("ieltsbro_records_listening", "05. listening", r"# 音频\s*\n(.*?)(?=\n# )", 3,
                  lambda sd: " ".join(x.get("englishDetail", "") for x in sd.get("listenDetailList", [])), lambda sd, v: v["listeningDataVO"]["pathInfo"], lambda v: v["listeningDataVO"]["title"]),
}
def run(kind, apply):
    d, folder, pat, n, text, key, title = KINDS[kind]; base = os.path.join(HERE, d)
    mp = json.load(open(os.path.join(base, "_map.json"))); lst = json.load(open(os.path.join(base, "_list.json")))
    mapped = {e[1] for v in mp.values() for e in v}
    notes = {}
    for f in glob.glob(os.path.join(ROOT, folder, "*", "*.md")):
        m = re.search(pat, open(f, encoding="utf-8").read(), re.S)
        if m: notes[f] = grams(norm(re.sub(CLEAN, "", m.group(1))), n)
    added = 0; orphans = []
    for r in lst:
        eid = r["exerciseIdStr"]
        if eid in mapped: continue
        p = os.path.join(base, eid + ".json")
        if not os.path.exists(p): continue
        rec = json.load(open(p)); G = grams(norm(text(rec["subjectData"])), n); v = r.get("readingDataVO") or r.get("listeningDataVO")
        note, ratio = max(((f, len(A & G) / max(1, len(G))) for f, A in notes.items()), key=lambda z: z[1], default=(None, 0))
        if ratio < 0.5: orphans.append((r["createDate"], eid, key(rec["subjectData"], r), v.get("title"))); continue
        print("匹配", r["createDate"], key(rec["subjectData"], r), "->", os.path.basename(note), round(ratio, 2)); added += 1
        mp.setdefault(key(rec["subjectData"], r), []).append([r["createDate"], eid, os.path.relpath(note, ROOT), round(ratio, 2), title(r)])
    if apply and added: json.dump(mp, open(os.path.join(base, "_map.json"), "w"), ensure_ascii=False)
    print(f"{kind}: 新匹配 {added} 条" + ("(已写入)" if apply else "(dry run)"))
    for o in orphans: print("  找不到笔记(需先新建):", *o)
def main():
    apply = "--apply" in sys.argv
    for k in [k for k in KINDS if f"--{k}" in sys.argv] or list(KINDS): run(k, apply)
if __name__ == "__main__": main()

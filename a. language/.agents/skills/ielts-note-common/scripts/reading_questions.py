#!/usr/bin/env python3
"""阅读笔记 `# 题目`: 按原文把笔记匹配到雅思哥学术类阅读(.cache/reading_cache/, 由 reading_fetch.py 拉取), 写入 `# 原文` 之后。
用法: python3 .agents/skills/ielts-note-common/scripts/reading_questions.py [--apply]"""
import glob, html, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ieltsbro_questions as Q

def norm(x): return re.sub(r"[^a-z0-9 ]", "", x.lower().replace("\xa0", " ").replace("’", "'").replace("‘", "'")).split()
def htm(h): return html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<br\s*/?>|</div>|</p>", " ", h)))
def grams(w): return set(zip(w, w[1:], w[2:], w[3:]))

def sources():
    out = []
    for f in glob.glob(os.path.join(os.path.join(os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..")), ".cache"), "reading_cache", "*.json")):
        d = json.load(open(f)); out.append((d["_title"], grams(norm(htm(d["passagesContent"]))), d))
    return out

def note_text(t):
    b = re.search(r"# 原文\s*\n(.*?)(?=\n# |\Z)", t, re.S).group(1)
    return norm(re.sub(r"<!--.*?-->|==|\*\*|!\[\[.*?\]\]|\([A-H]\)", "", b))

def insert(t, md):
    return Q.N.merge_questions(t, md)

def main():
    apply = "--apply" in sys.argv
    src = sources(); done = 0
    for n in sorted(glob.glob("06. reading/*/*.md")):
        t = open(n).read()
        A = grams(note_text(t))
        r, title, d = max(((len(A & g) / max(1, len(A)), ti, dd) for ti, g, dd in src), key=lambda z: z[0])
        if r < 0.5: print("未命中", n.split("/")[-1]); continue
        groups = [Q.group_md(q) for q in d["questionList"]]
        md = "# 题目\n\n" + "\n\n".join(g for g in groups if g) + "\n\n"
        print(f"处理 {n.split('/')[-1][:45]} <- {title} {r:.2f} 题组{len(groups)}")
        if apply: open(n, "w").write(insert(t, md)); done += 1
    print("写入", done)

if __name__ == "__main__":
    main()

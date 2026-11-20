#!/usr/bin/env python3
"""从九分学长缓存提取听力题目, 按原文匹配到听力笔记, 写入 `# 题目`(仅填空着的)。
九分学长缓存不含标准答案(rightAnswer 为空), 故不写答案行。
用法: python3 .agents/skills/ielts-note-common/scripts/jiufen_questions.py [--apply]"""
import ast, glob, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jiufen_cache as J
import ieltsbro_questions as Q

def norm(x): return re.sub(r"[^a-z0-9 ]", "", x.lower().replace("’", "'")).split()

def lst(v): return v if isinstance(v, list) else (ast.literal_eval(v) if isinstance(v, str) and v.startswith("[") else [])

def inputs(h):
    # Keep placeholders until the common range validator assigns hidden numbers.
    return re.sub(r"<input[^>]*>", " ...... ", h or "")

def group_md(g):
    t = g["type"]
    desc = [x.strip().replace("**", "") for x in Q.text(g.get("description") or "").split("\n") if x.strip()]
    qs = sorted(lst(g.get("questions")), key=lambda q: int(q["qNumber"]))
    numbers = [int(q["qNumber"]) for q in qs]
    if not numbers: raise ValueError("Missing source qNumber")
    label = f"Questions {numbers[0]}–{numbers[-1]}" if len(numbers)>1 else f"Question {numbers[0]}"
    out = [f"**{label}**: " + " ".join(desc)]
    if t == "fill-in-the-blank":
        out.append(Q.body_md(inputs(g["contentHtml"])))
    elif t in ("single-choice", "multiple-choice"):
        for q in (qs[:1] if t == "multiple-choice" else qs):  # 多选题每个空位重复同一题干, 只留一份
            opts = sorted(lst(q.get("options")), key=lambda o: o["optionNum"])
            out.append(f"**{q['question'].strip()}**")
            out.append("\n".join(f"- {o['optionNum']}. {o['option'].strip()}" for o in opts))
    elif t in ("matching", "map"):
        if g.get("imageUrl"): out.append(f"![]({g['imageUrl']})")
        box = sorted(lst(g.get("options")) or lst(qs[0].get("options")), key=lambda o: o["optionNum"]) if qs else []
        box = [o for o in box if (o.get("option") or "").strip()]
        if box: out.append("\n".join(f"- {o['optionNum']}. {o['option'].strip()}" for o in box))
        if g.get("contentHtml"): out.append(Q.body_md(inputs(g["contentHtml"])))
        else: out.append("\n\n".join(f"{q['qNumber']} {q['question'].strip()} {Q.BLANK}" for q in qs))
    else:
        return None
    md = "\n\n".join(x for x in out if x)
    placeholders = re.findall(r'<input\b[^>]*\bplaceholder=["\x27](\d+)["\x27]', g.get("contentHtml") or "", re.I)
    slots = [int(n) for n in placeholders] if placeholders else None
    md, reason = Q.N.number_group(md, numbers, t, gap_numbers=slots)
    if reason: raise ValueError(f"Cannot safely number {label}: {reason}")
    return md

def main():
    apply = "--apply" in sys.argv
    parts = []
    for f, p in J.load_parts():
        aj = json.loads(p["articleJson"]) if isinstance(p["articleJson"], str) else p["articleJson"]
        parts.append((p, norm(" ".join(s["text"] for s in aj["segments"]))[:400]))
    for n in sorted(glob.glob("05. listening/*/*.md")):
        t = open(n).read()
        # Existing sections are merged in place below, preserving all annotations.
        b = re.sub(r"<!--.*?-->|==|\*\*|!\[\[.*?\]\]", "", re.search(r"# 音频\s*\n(.*?)(?=\n# )", t, re.S).group(1))
        mine = norm(b)[:400]; A = set(zip(mine, mine[1:], mine[2:]))
        r, p = max(((len(A & set(zip(x, x[1:], x[2:]))) / max(1, len(A)), p) for p, x in parts), key=lambda z: z[0])
        if r < 0.5: print("跳过(缓存没有)", n.split("/")[-1]); continue
        groups = [group_md(g) for g in sorted(p["groups"], key=lambda g: int(g["displayOrder"]))]
        md = "# 题目\n\n" + "\n\n".join(g for g in groups if g) + "\n\n"
        t2 = Q.N.merge_questions(t, md)
        print(f"处理 {n.split('/')[-1]}  <- {p['label']} 相似度{r:.2f} 组数{len(groups)}")
        if apply: open(n, "w").write(t2)

def reading_main():
    """阅读: 雅思哥没有的笔记, 用九分学长缓存按原文(缺原文时按标题)匹配。"""
    import reading_questions as R
    apply = "--apply" in sys.argv
    parts = []
    for f, p in J.load_parts("reading"):
        parts.append((p, R.grams(R.norm(R.htm(p.get("article") or ""))), re.sub(r"\W+", " ", (p.get("title") or "")).strip().lower()))
    src = R.sources()
    for n in sorted(glob.glob("06. reading/*/*.md")):
        t = open(n).read()
        A = R.grams(R.note_text(t))
        if max((len(A & g) / max(1, len(A)) for _, g, _ in src), default=0) >= 0.5: continue  # 雅思哥已处理
        name = re.sub(r"\W+", " ", os.path.basename(n)[:-3]).strip().lower()
        best = max(((len(A & g) / max(1, len(A)), p) for p, g, ti in parts), key=lambda z: z[0], default=(0, None))
        p = best[1] if best[0] >= 0.5 else next((p for p, g, ti in parts if ti == name), None)
        if not p: print("未命中", os.path.basename(n)); continue
        groups = [group_md(g) for g in sorted(p["groups"], key=lambda g: int(g["displayOrder"]))]
        md = "# 题目\n\n" + "\n\n".join(x for x in groups if x) + "\n\n"
        print(f"处理 {os.path.basename(n)[:45]} <- {p['title']} 题组{len(groups)}")
        if apply: open(n, "w").write(R.insert(t, md))

if __name__ == "__main__":
    reading_main() if "--reading" in sys.argv else main()

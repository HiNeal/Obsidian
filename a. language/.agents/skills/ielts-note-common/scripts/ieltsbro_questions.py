#!/usr/bin/env python3
"""从雅思哥(ieltsbro)机考软件缓存提取听力题目, 写入听力笔记的 `# 题目`(介于 # 音频 与 # 同义改写 之间)。
用法: python3 .agents/skills/ielts-note-common/scripts/ieltsbro_questions.py [--apply]
缓存里没有的套题会被跳过。"""
import glob, html, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import question_numbering as N
CACHE = os.path.expanduser("~/Library/Application Support/雅思哥机考软件/Cache/Cache_Data")
BLANK = r"\_" * 8

def load_tests():
    tests = {}
    for f in os.listdir(CACHE):
        p = os.path.join(CACHE, f)
        if not os.path.isfile(p): continue
        b = open(p, "rb").read()
        if b"examListeningV2" not in b[:700]: continue
        j = b.find(b'{"status"')
        try: d = json.JSONDecoder().raw_decode(b[j:].decode("utf8", "ignore"))[0]["content"]
        except Exception: continue
        for part in d:
            m = re.match(r"C(\d+)-Test (\d+)-Part (\d+)", part.get("listenQuestion", ""))
            if m: tests[tuple(map(int, m.groups()))] = part
    return tests

def fetch_remote(needed):
    """缓存里没有的套题, 用雅思哥接口只读获取: practiceList 取 subjectId, listening/detail 取题目与答案。"""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import ieltsbro_api as A
    topics = {t["name"]: t["topicId"] for t in A.call("hcp/qsBank/paperTopic/topicList", {"examType": 0, "ifPc": True, "type": 1, "part": "paper"})}
    got = {}
    for c in sorted({k[0] for k in needed}):
        tid = topics.get(f"C{c}")
        if not tid: print("雅思哥没有", f"C{c}"); continue
        page = 1
        while True:
            r = A.call("hcp/qsBank/listening/practiceList", {"curPage": page, "limit": 20, "paperType": 1, "examType": 0, "type": "paper", "topicId": tid})
            for it in r.get("list", []):
                m = re.match(r"C(\d+)-Test (\d+)-Part (\d+)", it["title"])
                if m and tuple(map(int, m.groups())) in needed: got[tuple(map(int, m.groups()))] = it["subjectId"]
            if page * 20 >= r.get("total", 0): break
            page += 1
    out = {}
    for key, sid in got.items():
        d = A.call("hcp/qsBank/listening/detail", {"paperType": 1, "part": key[2], "subjectId": sid})
        out[key] = {"questions": d["questionList"], "listenQuestion": d["listenQuestion"]}
        print("联网获取", d["listenQuestion"], "题组", len(d["questionList"]))
    return out

def text(h):
    h = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", h, flags=re.S)
    h = re.sub(r"</?strong>|</?b>", "**", h)
    h = re.sub(r"<br\s*/?>|</div>|</p>|</li>|</tr>", "\n", h)
    h = re.sub(r"<[^>]+>", "", h)
    return html.unescape(h).replace("\xa0", " ")

def blanks(s):
    s = re.sub(r"(?<![\w.])\d{1,2}\s*\.{3,}", "......", s)
    return re.sub(r"(?<![\w.])\.{3,}(?![\w])|…{2,}", BLANK, s)

def table_md(t):
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", t, flags=re.S):
        cells = [re.sub(r"\s+", " ", text(c)).strip().replace("|", "\\|") for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, flags=re.S)]
        rows.append([blanks(c).replace(" • ", "<br>• ").replace("•", "<br>•", 1) if c.startswith("•") else blanks(c).replace(" • ", "<br>• ") for c in cells])
    if not rows: return ""
    w = max(map(len, rows)); rows = [r + [""] * (w - len(r)) for r in rows]
    if w == 1:  # 单列表格(笔记式填空)按列表输出
        out, prev_bullet = [], True
        for (c,) in rows:
            c = re.sub(r"^(<br>)+\s*", "", c).strip()
            if not c: continue
            c = re.sub(r"^\*\*(\d+)\.?\*\*\s*", r"\1 ", c)
            bullet = c.startswith("•")
            line = "- " + c.lstrip("• ").strip() if bullet else c
            if out and not (bullet and prev_bullet): out.append("")
            out.append(line); prev_bullet = bullet
        return "\n".join(out)
    out = ["| " + " | ".join(rows[0]) + " |", "| " + " | ".join([":---"] * w) + " |"]
    out += ["| " + " | ".join(r) + " |" for r in rows[1:]]
    return "\n".join(out)

def body_md(h):
    tables = []
    def keep(m): tables.append(table_md(m.group(0))); return f"\n@@T{len(tables)-1}@@\n"
    h = re.sub(r"<table.*?</table>", keep, h, flags=re.S)
    lines = []
    for ln in text(h).split("\n"):
        nested = bool(re.match(r"^\s+[-–]\s", ln))  # 缩进的短横线是上一条的子项
        ln = re.sub(r"[ \t]+", " ", ln).strip()
        if not ln: continue
        if nested: lines.append("  - " + blanks(ln[1:].strip())); continue
        ln = re.sub(r"^[·•–-]\s*", "- ", ln) if re.match(r"^[·•]", ln) else ln
        if re.match(r"^–", ln): ln = "  - " + ln.lstrip("– ").strip()
        lines.append(blanks(ln))
    out = []
    for ln in lines:
        m = re.fullmatch(r"@@T(\d+)@@", ln)
        out.append(("\n" + tables[int(m.group(1))] + "\n") if m else ln)
    # 列表项之间不留空行, 其余段落之间空一行
    out = [re.sub(r"\*\*\s*(.+?)\s*\*\*", r"**\1**", x) for x in out]
    res = []
    for i, ln in enumerate(out):
        res.append(ln)
        nxt = out[i + 1] if i + 1 < len(out) else None
        if nxt is not None and not (ln.startswith(("- ", "  - ")) and nxt.startswith(("- ", "  - "))): res.append("")
    return "\n".join(res).strip()

def letter(i): return chr(65 + i)

def letters(v):
    items = v if isinstance(v, list) else re.findall(r"\d+", str(v))
    return ", ".join(sorted(letter(int(x)) for x in items if str(x).isdigit()))

def group_md(q):
    qj = q["questionJson"]; t = int(qj["questionType"])
    desc = [x.strip() for x in text(qj["descriptions"]).split("\n") if x.strip()]
    desc = [re.sub(r"\*\*\s*(.+?)\s*\*\*", r"**\1**", d) for d in desc]
    plain = [d for d in desc[1:] if not d.startswith("**")]
    titles = [d for d in desc[1:] if d.startswith("**")]
    out = ([f"**{desc[0].replace('**', '')}**: " + " ".join(plain)] if desc else []) + titles
    ans = q.get("answerJson") or []
    if t == 0:
        out.append(body_md(qj["questionsContent"]))
        a = ", ".join(str(x.get("correctValue", "")).split("/")[0].strip() for x in ans)
    elif t in (1, 2, 3):
        for sq in qj["questions"]:
            if t == 3:
                line = f"- {sq['content'].strip()}"
                if out and out[-1].startswith("- "): out[-1] += "\n" + line
                else: out.append(line)
                continue
            out.append(f"**{sq['content'].strip()}**")
            out.append("\n".join(f"- {letter(i)}. {o['content'].strip()}" for i, o in enumerate(sq["options"])))
        if t == 3:  # 判断题: 答案是选项文字
            names = [[o["content"].strip() for o in sq["options"]] for sq in qj["questions"]]
            a = ", ".join(n[int(x["correctValue"])] if n and str(x.get("correctValue", "")).isdigit() and int(x["correctValue"]) < len(n) else str(x.get("correctValue", "")) for n, x in zip(names, ans))
        elif t == 1 and len(qj["questions"]) > 1:
            a = ", ".join(letters(x.get("correctValue", "")) for x in ans)
        else:
            a = " / ".join(letters(x.get("correctValue", "")) for x in ans)
    elif t == 4:
        if qj.get("optionsTitle"): out.append(f"**{qj['optionsTitle'].strip()}**")
        opts = [f"- {o['index']}. {o['content'].strip()}" for o in qj.get("matchOptions", []) if o.get("content", "").strip()]
        out.append("\n".join(opts) if opts else "(选项为地图, 见雅思哥原题)")
        out.append(body_md(qj["questionsContent"]))
        a = ", ".join(letter(int(x["correctValue"])) if str(x.get("correctValue", "")).isdigit() else str(x.get("correctValue", "")) for x in ans)
    else:
        return None
    out.append(f"**答案**: {a}")
    md = "\n\n".join(x for x in out if x)
    numbers = list(range(int(qj["startIndex"]), int(qj["endIndex"]) + 1))
    # Cache answer slots joined by | belong to one question (slash denotes alternatives).
    # dfn spans provide the same grouping in older HTML exports.
    gap_numbers = None
    if t == 0 and len(ans) == len(numbers):
        gap_numbers = [n for n,a in zip(numbers,ans) for _ in str(a.get("correctValue", "")).split("|")]
    if t == 0 and "<dfn>" in qj.get("questionsContent", ""):
        units = re.findall(r"<dfn>.*?</dfn>|\.{3,}", qj["questionsContent"], re.S)
        if len(units) == len(numbers):
            gap_numbers = [n for n,u in zip(numbers,units) for _ in re.findall(r"\.{3,}",u)]
    md, reason = N.number_group(md, numbers, str(t), gap_numbers=gap_numbers)
    if reason:
        raise ValueError(f"Cannot safely number {numbers}: {reason}")
    return md

def norm(x): return re.sub(r"[^a-z0-9 ]", "", x.lower().replace("’", "'")).split()

def by_script(t, tests):
    body = re.search(r"# 音频\s*\n(.*?)(?=\n# )", t, re.S)
    if not body: return None
    text_ = re.sub(r"<!--.*?-->|==|\*\*|!\[\[.*?\]\]", "", body.group(1))
    mine = norm(text_)[:200]
    best = (0, None)
    for key, part in tests.items():
        if "subjectData" not in part: continue
        theirs = norm(" ".join(d["englishDetail"] for d in part["subjectData"]["listenDetailList"]))[:200]
        a = set(zip(mine, mine[1:], mine[2:])); b = set(zip(theirs, theirs[1:], theirs[2:]))
        r = len(a & b) / max(1, len(a))
        if r > best[0]: best = (r, key)
    return best[1] if best[0] > 0.5 else None

def main():
    apply = "--apply" in sys.argv
    tests = load_tests(); print("缓存套题:", sorted(tests))
    if "--online" in sys.argv:
        need = set()
        for f in glob.glob("05. listening/*/*.md"):
            m = re.search(r"!\[\[[^\]]*/剑雅(\d+)-Test(\d+)-Part(\d+)\.mp3\]\]", open(f).read())
            if m and tuple(map(int, m.groups())) not in tests: need.add(tuple(map(int, m.groups())))
        tests.update(fetch_remote(need))
    for f in sorted(glob.glob("05. listening/*/*.md")):
        t = open(f).read()
        m = re.search(r"!\[\[[^\]]*/剑雅(\d+)-Test(\d+)-Part(\d+)\.mp3\]\]", t)
        key = tuple(map(int, m.groups())) if m else by_script(t, tests)
        if not key: print("跳过(无法识别套题)", f.split("/")[-1]); continue
        if key not in tests: print("跳过(缓存没有)", key, f.split("/")[-1]); continue
        groups = [group_md(q) for q in tests[key]["questions"]]
        md = "# 题目\n\n" + "\n\n".join(g for g in groups if g) + "\n\n"
        t2 = N.merge_questions(t, md)
        print("处理", key, f.split("/")[-1], "组数", len(groups))
        if apply: open(f, "w").write(t2)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""把 Codex 给出的同义改写建议(.cache/codex_para/<id>.out.json)校验后写入笔记 `# 题目`(缺省 dry run, --apply 写盘)。
校验: phrase 与 para 各 <=8 词、无省略号/推导符号/标记符; phrase 必须在该题自己那块文字里连续出现且不与已有高亮重叠;
para 每段必须在 `# 原文`/`# 音频` 里连续出现。不合格的条目丢弃并报告原因。"""
import glob, json, os, re, sys
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", "..")); HERE = os.path.join(ROOT, ".cache"); D = os.path.join(HERE, "codex_para")
def norm(s): return " ".join(re.sub(r"[^a-z0-9 ]", " ", s.lower().replace("’", "'").replace("‘", "'").replace("\xa0", " ")).split())
def words(s): return len(re.findall(r"[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*", s))
def section(t, name):
    m = re.search(rf"^# {name}[ \t]*$", t, re.M)
    if not m: return None
    nx = re.search(r"^# ", t[m.end():], re.M); return m.end(), (m.end() + nx.start() if nx else len(t))
def block_span(sec, q):
    lines = sec.split("\n"); pos = 0; qre = r"[–-]".join(re.escape(x) for x in re.split(r"[–-]", str(q)))
    for i, ln in enumerate(lines):
        m = re.search(r"<!--\s*(q|question):\s*" + qre + r"\s*-->", ln)
        if m:
            end = pos + len(ln)
            if m.group(1) == "question":
                j = i + 1; e = end
                while j < len(lines) and (lines[j].strip().startswith("-") or not lines[j].strip()):
                    e += 1 + len(lines[j]); j += 1
                    if j < len(lines) and not lines[j].strip() and j + 1 < len(lines) and not lines[j + 1].strip().startswith("-"): break
                return pos, e
            return pos, end
        pos += len(ln) + 1
    return None
def inside_markup(text, idx):
    line = text[:idx].rsplit("\n", 1)[-1]
    return line.count("==") % 2 == 1 or bool(re.search(r"<!--[^>]*$", line)) or line.count("**") % 2 == 1 and False
def valid_item(it):
    ph, pa = it["phrase"].strip(), it["para"].strip()
    if not ph or not pa: return "空"
    if re.search(r"\.\.\.|…|->|=>|→|==|<!--|\\_|\*\*", ph + pa): return "含禁用符号"
    if words(ph) > 8: return "题目表达超 8 词"
    for seg in re.split(r"\s*/\s*", pa):
        seg = seg.replace("【反】", "").strip()
        if not seg or words(seg) > 8: return "原文表达超 8 词或为空"
    return None
def run(apply):
    tasks = json.load(open(os.path.join(D, "tasks.json"))); acc = rej = 0; notes = 0; reasons = {}
    for task in tasks:
        f = os.path.join(D, task["id"] + ".out.json")
        if not os.path.exists(f): continue
        try: items = json.load(open(f))["items"]
        except Exception: reasons["输出不是合法 JSON"] = reasons.get("输出不是合法 JSON", 0) + 1; continue
        path = os.path.join(ROOT, task["note"]); t = open(path, encoding="utf-8").read()
        src = section(t, "音频" if "05. listening" in path else "原文"); srcn = norm(t[src[0]:src[1]]) if src else ""
        changed = False
        for it in items:
            why = valid_item(it)
            if not why:
                segs = [s.replace("【反】", "").strip() for s in re.split(r"\s*/\s*", it["para"])]
                if not all(norm(s) and norm(s) in srcn for s in segs): why = "原文表达在原文里找不到"
            if not why:
                qs = section(t, "题目"); sec = t[qs[0]:qs[1]]; span = block_span(sec, it["q"])
                if not span: why = "找不到该题"
                else:
                    blk = sec[span[0]:span[1]]; pat = re.compile(re.escape(it["phrase"].strip()).replace("'", "['’]").replace("’", "['’]"), re.I); hit = None
                    for m in pat.finditer(blk):
                        a = qs[0] + span[0] + m.start()
                        if inside_markup(t, a) or "==" in m.group(0): continue
                        if re.match(r"\s*(?:\\_|<!--|==)", t[a + len(m.group(0)): a + len(m.group(0)) + 4]) and False: continue
                        hit = (a, a + len(m.group(0)), m.group(0)); break
                    if not hit: why = "题目表达在该题文字里找不到或已被高亮"
                    else:
                        a, b, txt = hit
                        t = t[:a] + f"=={txt}==<!--para: {it['para'].strip()}-->" + t[b:]; changed = True; acc += 1; continue
            rej += 1; reasons[why] = reasons.get(why, 0) + 1
        if changed:
            notes += 1
            if apply: open(path, "w", encoding="utf-8").write(t)
    print(f"采纳 {acc} 条, 丢弃 {rej} 条, 涉及 {notes} 篇", "(已写入)" if apply else "(dry run)")
    for k, v in sorted(reasons.items(), key=lambda x: -x[1]): print("  丢弃原因:", k, v)
if __name__ == "__main__": run("--apply" in sys.argv)

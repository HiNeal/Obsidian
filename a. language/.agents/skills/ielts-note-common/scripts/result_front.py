#!/usr/bin/env python3
"""把 `# 题目` 里的 ✅/❌ 放到每题最前面(行首/列表符后/表格单元格开头), 源码形如 `✅<!--res: 5--> `。
旧格式(对错在题号注释或句末 `<!--res: N-->✅`)会被搬到前面, 其余内容不动。幂等。
缺省 dry run, 加 --apply 写盘。作用范围: 05. listening / 06. reading 的 `# 题目` 小节。"""
import glob, os, re, sys
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", "..")); HERE = os.path.join(ROOT, ".cache")
NUM = r"\d{1,2}(?:\s*[–-]\s*\d{1,2})?"
FRONT = re.compile(r"(✅|❌)<!--\s*res:\s*(" + NUM + r")\s*--> ?")
OLD = re.compile(r"([ \t]*)<!--\s*(q|question|res):\s*(" + NUM + r")\s*-->[ \t]*(✅|❌)")
BULLET = re.compile(r"^(\s*(?:[-*+–—•]|\d+\.)\s+)?")

def norm(n): return re.sub(r"\s", "", n).replace("-", "–")

def strip_front(sec):
    return FRONT.sub("", sec)

def pull(text):
    """去掉旧格式的 emoji(res 注释整体去掉, q/question 注释保留), 返回 (新文本, [(emoji, 题号)])。"""
    got = []
    def rep(m):
        got.append((m.group(4), norm(m.group(3))))
        return "" if m.group(2) == "res" else f"{m.group(1)}<!--{m.group(2)}: {m.group(3)}-->"
    return OLD.sub(rep, text), got

def tokens(got): return "".join(f"{e}<!--res: {n}--> " for e, n in got)

NUMLEAD = re.compile(r"\*\*\d{1,2}(?:\s*[–-]\s*\d{1,2})?\.\*\*[ \t]*")
DOT = re.compile(r"^(\s*)\*\*[•·][ \t]*(.*?)\*\*")

def after_lead(text):
    """题号 `**11.**` 后面插入标记; 没有题号则在开头。返回插入位置。"""
    m = NUMLEAD.match(text)
    return m.end() if m else 0

def place(rest, got):
    """填空题: 标记放在该空的横线前面(`✅ ________<!--q: N-->`); 其余放在题号后/行首。返回新文本。"""
    ins, front = [], []
    for e, n in got:
        m = re.search(r"(?:\\_){2,}[ \t]*<!--\s*q:\s*" + re.escape(n) + r"\s*-->", rest) if re.fullmatch(r"\d{1,2}", n) else None
        (ins if m else front).append((m.start(), e, n) if m else (e, n))
    for pos, e, n in sorted(ins, reverse=True): rest = rest[:pos] + f"{e}<!--res: {n}--> " + rest[pos:]
    k = after_lead(rest)
    return rest[:k] + tokens(front) + rest[k:]

def line_to_front(ln):
    if ln.lstrip().startswith("|"):
        cells = re.split(r"(?<!\\)\|", ln); out = []
        for i, c in enumerate(cells):
            if i == 0 or i == len(cells) - 1 and not c.strip():
                out.append(c); continue
            exist = [(m.group(1), norm(m.group(2))) for m in FRONT.finditer(c)]
            new, got = pull(strip_front(c)); got = exist + got
            if not got: out.append(c); continue
            lead = re.match(r"\s*", new).group(0) or " "
            rest = new[len(re.match(r"\s*", new).group(0)):]
            out.append(lead + place(rest, got))
        return "|".join(out)
    exist = [(m.group(1), norm(m.group(2))) for m in FRONT.finditer(ln)]
    new, got = pull(strip_front(ln)); got = exist + got
    if not got: return ln
    new = DOT.sub(lambda m: f"{m.group(1)}- **{m.group(2).strip()}**", new, count=1)
    m = BULLET.match(new); head = m.group(0) or ""
    return head + place(new[len(head):], got)

def section_to_front(text):
    m = re.search(r"^# 题目[ \t]*$", text, re.M)
    if not m: return text
    s = m.end(); nx = re.search(r"^# ", text[s:], re.M); e = s + nx.start() if nx else len(text)
    body = "\n".join(line_to_front(l) for l in text[s:e].split("\n"))
    return text[:s] + body + text[e:]

def main():
    apply = "--apply" in sys.argv; files = 0; marks = 0
    for f in sorted(glob.glob(f"{ROOT}/0[56]. */**/*.md", recursive=True)):
        t = open(f, encoding="utf-8").read(); n = section_to_front(t)
        if n != t:
            files += 1; marks += len(FRONT.findall(n)) - len(FRONT.findall(t))
            if apply: open(f, "w", encoding="utf-8").write(n)
    print(f"改动 {files} 篇, 新搬 {marks} 个标记", "(已写入)" if apply else "(dry run)")
if __name__ == "__main__": main()

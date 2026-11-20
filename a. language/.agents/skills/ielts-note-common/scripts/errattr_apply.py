#!/usr/bin/env python3
"""把分析写入阅读笔记 `# 分析` 三列表 `| 题号 | 结果(✅/❌) | 分析 |` (缺省 dry run, --apply 写盘)。
数据: .cache/errattr/data_*.py 里的 DATA = {笔记名: [(题号, 常见陷阱, 直接原因, 破局法则), ...]}
错误/正确两行由 result_marks 的做题记录标签生成。规则: 表头/已有行/表后文字原样保留, 只插入新行; 已覆盖的题号不重复写; 空模板行被替换。"""
import glob, importlib.util, os, re, sys
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", ".."))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
def first_int(s):
    m = re.search(r"\d+", s); return int(m.group(0)) if m else 10**6
def covered(cell):
    nums = set(); c = cell.replace("–", "-").replace("—", "-")
    for a, b in re.findall(r"(\d+)\s*-\s*(\d+)", c):
        if int(b) >= int(a): nums |= set(range(int(a), int(b) + 1))
    nums |= {int(x) for x in re.findall(r"\d+", c)}
    return nums
RESMARK = re.compile(r"(✅|❌)<!--\s*res:\s*(\d{1,2}(?:\s*[–-]\s*\d{1,2})?)\s*-->")
def add_marks(text):
    """`# 分析` 表「结果」列补 ✅/❌ (取自 `# 题目` 里同题的对错标记; 多题取 ❌ 优先)。可重复运行。"""
    i = text.find("# 分析")
    if i < 0: return text
    head, sec = text[:i], text[i:]
    by = {}
    for m in RESMARK.finditer(head):
        for n in covered(m.group(2)): by[n] = "❌" if (by.get(n) == "❌" or m.group(1) == "❌") else "✅"
    out = []
    for ln in sec.split("\n"):
        cells = re.split(r"(?<!\\)\|", ln) if ln.startswith("|") else []
        if len(cells) == 5 and cells[1].strip() and not re.match(r"^(:?-+:?|题号)$", cells[1].strip()):
            base = cells[1].strip()
            es = [by[n] for n in covered(base) if n in by]
            if es: ln = f"| {base} | {'❌' if '❌' in es else '✅'} |{cells[3]}|"
        out.append(ln)
    return head + "\n".join(out)

def load(only_file=None):
    data = {}
    for f in sorted(glob.glob(os.path.join(ROOT, ".cache/errattr/data_*.py"))):
        if only_file and os.path.basename(f) != only_file: continue
        spec = importlib.util.spec_from_file_location("d", f); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
        for k, v in m.DATA.items(): data.setdefault(k, []).extend(v)
    return data
def find(name):
    c = glob.glob(os.path.join(ROOT, "06. reading", "*", name + ".md")) + glob.glob(os.path.join(ROOT, "05. listening", "*", name + ".md"))
    return c[0] if c else None
def rewrite(sec, items, labels):
    lines = sec.split("\n"); idx = [i for i, l in enumerate(lines) if l.startswith("|")]
    if not idx: return sec, 0
    a, b = idx[0], idx[-1]; tbl = lines[a:b + 1]
    if any(not l.startswith("|") for l in tbl): return sec, 0
    hdr, rows = tbl[:2], tbl[2:]; keep = []; have = set()
    for l in rows:
        c = [x.strip() for x in l.strip().strip("|").split("|")]
        if not c[0]: continue
        keep.append(l); have |= covered(c[0])
    new = []
    for num, trap, cause, rule in items:
        key = str(num).replace("-", "–"); ns = covered(key)
        if ns and ns <= have: continue
        wr = labels.get(key)
        head = f"错误: {wr[0]}<br>正确: {wr[1]}" if wr else ""
        new.append((first_int(key), f"| {key} |  | {head}{'<br>' if head else ''}常见陷阱: {trap}<br>直接原因: {cause}<br>破局法则: {rule} |")); have |= ns
    merged = [(first_int(l.split("|")[1]), 0, l) for l in keep] + [(k, 1, l) for k, l in new]
    merged.sort(key=lambda t: (t[0], t[1]))
    return "\n".join(lines[:a] + hdr + [l for _, _, l in merged] + lines[b + 1:]), len(new)
def main():
    import result_marks as R
    apply = "--apply" in sys.argv; only = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--file=")), None)
    data = load(only); added = 0
    paths = {name: find(name) for name in data}
    texts = {p: open(p, encoding="utf-8").read() for p in glob.glob(os.path.join(ROOT, "06. reading", "*", "*.md"))}
    labels = {}
    for src in (R.labels_ieltsbro(), R.labels_jiufen(texts)):
        for n, r in src.items(): labels.setdefault(n, {}).update(r)
    import listening_flow as L
    ltexts = {f: open(f, encoding="utf-8").read() for f in L.note_files()}; texts.update(ltexts)
    for n, r in L.all_data(ltexts)[1].items(): labels.setdefault(n, {}).update(r)
    for name, items in data.items():
        p = paths[name]
        if not p: print("找不到笔记", name); continue
        t = texts[p]; i = t.find("# 分析")
        if i < 0: print("无分析标题", name); continue
        newsec, n = rewrite(t[i:], items, labels.get(p, {}))
        print(f"{name}: 新增 {n} 行"); added += n
        if apply and n: open(p, "w", encoding="utf-8").write(add_marks(t[:i] + newsec))
    print("合计新增", added, "(已写入)" if apply else "(dry run)")
def mark_all(apply=False):
    n = 0
    for f in glob.glob(os.path.join(ROOT, "06. reading", "*", "*.md")) + glob.glob(os.path.join(ROOT, "05. listening", "*", "*.md")):
        t = open(f, encoding="utf-8").read(); new = add_marks(t)
        if new != t:
            n += 1
            if apply: open(f, "w", encoding="utf-8").write(new)
    print(f"题号列前加 ✅/❌: 改动 {n} 篇", "(已写入)" if apply else "(dry run)")
if __name__ == "__main__":
    if "--mark-all" in sys.argv: mark_all("--apply" in sys.argv)
    else: main()

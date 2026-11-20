#!/usr/bin/env python3
"""只读审计 06. reading 全部文章: 标题顺序/表格式、题目、同义改写、分析、对错标记、选项格式。"""
import glob, os, re, sys
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", ".."))
sys.path.insert(0, SCRIPTS)
from errattr_apply import covered
QM = re.compile(r"<!--\s*(q|question):\s*(\d{1,2}(?:\s*[–-]\s*\d{1,2})?)\s*-->")
_RES = re.compile(r"(✅|❌)<!--\s*res:\s*(\d{1,2}(?:\s*[–-]\s*\d{1,2})?)\s*-->")
class _R:
    @staticmethod
    def findall(t): return [(n, e) for e, n in _RES.findall(t)]
RES = _R
def sections(t):
    ms = list(re.finditer(r"^# (.+?)\s*$", t, re.M)); out = {}
    for i, m in enumerate(ms): out[m.group(1)] = t[m.end(): ms[i + 1].start() if i + 1 < len(ms) else len(t)]
    return [m.group(1) for m in ms], out
def main():
    R = {k: [] for k in ["标题顺序/残留标题", "分析表不是三列", "没有题目", "题目没有任何同义改写", "部分题没有同义改写", "没有分析表", "分析表是空模板(无任何行)", "有对错标记的题缺分析行/缺正确", "题目没有对错标记(没做过)", "判断题缺选项", "残留答案行/ans注释", "段落匹配没转表格"]}
    files = sorted(glob.glob(os.path.join(ROOT, "06. reading", "*", "*.md")) + (sorted(glob.glob(os.path.join(ROOT, "05. listening", "*", "*.md"))) if "--listening" in sys.argv else []))
    files = [f for f in files if "/01. 方法总论/" not in f]
    for f in files:
        name = os.path.basename(f)[:-3]; t = open(f, encoding="utf-8").read()
        heads, sec = sections(t)
        if heads not in (["原文", "题目", "分析"], ["音频", "题目", "分析"]): R["标题顺序/残留标题"].append((name, " | ".join(heads))); 
        q = sec.get("题目", "")
        qs = QM.findall(q)
        if len(q.strip()) < 40 or not qs: R["没有题目"].append(name)
        else:
            paras = len(re.findall(r"<!--para:", q))
            if paras == 0: R["题目没有任何同义改写"].append(name)
            # 每题块: 以题号标记结尾的行/段落
            lines = q.split("\n"); no = []
            for i, ln in enumerate(lines):
                for m in QM.finditer(ln):
                    if m.group(1) == "q" or m.group(1) == "question":
                        # 取该题所在行; 选择/判断题含题干行; 填空含所在句/行
                        if "<!--para:" not in ln:
                            if ln.lstrip().startswith("|") and re.search(r"[○🟢🔴]", ln): no.append(m.group(2))
                            else: no.append(m.group(2))
            if paras and no: R["部分题没有同义改写"].append((name, f"{len(set(no))}/{len(set(m[1] for m in qs))} 题所在行无改写"))
            if re.search(r"^\*\*答案\*\*", q, re.M) or "<!--ans:" in t: R["残留答案行/ans注释"].append(name)
            # 判断题缺选项
            for g in re.finditer(r"^\*\*Questions?\b[^\n]*$", q, re.M | re.I):
                h = g.group(0).upper()
                if "NOT GIVEN" in h:
                    seg = q[g.end():]; nx = re.search(r"^\*\*(?:Questions?\b|答案)", seg, re.M); seg = seg[:nx.start()] if nx else seg
                    stems = re.findall(r"^\*\*(\d{1,2})\.\*\*", seg, re.M); opts = len(re.findall(r"^\s*[-*]\s+A\.\s", seg, re.M))
                    if len(stems) != opts: R["判断题缺选项"].append((name, f"题 {len(stems)} 选项组 {opts}"))
                if re.search(r"which (paragraph|section)", g.group(0), re.I):
                    seg = q[g.end():]; nx = re.search(r"^\*\*(?:Questions?\b|答案)", seg, re.M); seg = seg[:nx.start()] if nx else seg
                    if not re.search(r"^\|", seg, re.M): R["段落匹配没转表格"].append(name)
        a = sec.get("分析")
        if a is None: R["没有分析表"].append(name); continue
        hdr = [l for l in a.split("\n") if l.startswith("|")]
        if hdr and [c.strip() for c in hdr[0].strip().strip("|").split("|")] != ["题号", "结果", "分析"]: R["分析表不是三列"].append((name, hdr[0][:50]))
        rows = [[c.strip() for c in l.strip().strip("|").split("|")] for l in hdr[2:]]
        real = [r for r in rows if r[0]]
        marks = RES.findall(q)
        if not real and not marks: R["分析表是空模板(无任何行)"].append(name) if qs else None
        if marks:
            for num, emo in marks:
                nums = covered(num.replace("-", "–"))
                if not any(nums <= covered(r[0]) and "正确:" in (r[2] if len(r) > 2 else "") for r in real): R["有对错标记的题缺分析行/缺正确"].append((name, num)); break
            wrong = [n for n, e in marks if e == "❌"]
            for num in wrong:
                nums = covered(num.replace("-", "–"))
                row = next((r for r in real if nums <= covered(r[0])), None)
                if row and "常见陷阱:" not in (row[2] if len(row) > 2 else ""): R["有对错标记的题缺分析行/缺正确"].append((name, f"{num} ❌无常见陷阱")); break
        elif qs: R["题目没有对错标记(没做过)"].append(name)
    print(f"共 {len(files)} 篇\n")
    for k, v in R.items():
        print(f"## {k}: {len(v)}")
        for x in v[:40]: print("   ", x if isinstance(x, str) else " | ".join(map(str, x)))
if __name__ == "__main__": main()

#!/usr/bin/env python3
"""选项一律放在题目下面: 题组开头(第一道题之前)的共用选项列表(字母或罗马数字, 连同 `**list of words**` 之类的粗体小标题)挪到该题组题目之后。
适用: 选词填空、标题匹配、人名匹配、听力匹配等所有"选项在前、题目在后"的题组; 每道题自己的选项(在题干之后)不动。
缺省 dry run, 加 --apply 写盘。幂等。"""
import glob, os, re, sys
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", "..")); HERE = os.path.join(ROOT, ".cache")
OPT = re.compile(r"^- (?:[A-Za-z]|[IVXivx]{1,4})\. ")
TITLE = re.compile(r"^\*\*(?!Questions?\b)[^*]+\*\*\s*$")

def fix_group(g):
    L = g.split("\n")
    for i, l in enumerate(L):
        if OPT.match(l) and (i == 0 or not OPT.match(L[i - 1])):
            if re.search(r"<!--\s*(?:q|question):", "\n".join(L[:i])): return g, False   # 题目已经出现在前面, 这是题干自己的选项
            j = i
            while j < len(L) and (OPT.match(L[j]) or not L[j].strip()): j += 1
            while j > i and not L[j - 1].strip(): j -= 1                      # 不吞列表后的空行
            k = sum(1 for x in L[i:j] if OPT.match(x))
            rest = "\n".join(L[j:])
            if k < 3 or OPT.search(rest) or not re.search(r"<!--\s*(?:q|question):", rest): return g, False
            s = i
            p = i - 1
            while p >= 0 and not L[p].strip(): p -= 1
            if p >= 0 and TITLE.match(L[p]): s = p                               # 带上 **list of words** 小标题
            block = L[s:j]
            before = L[:s]; after = L[j:]
            while before and not before[-1].strip(): before.pop()
            while after and not after[0].strip(): after.pop(0)
            tail = []
            while after and not after[-1].strip(): tail.append(after.pop())      # 组尾空行留在最后
            new = before + [""] + after + [""] + block + tail
            return "\n".join(new), True
    return g, False

def fix(text):
    m = re.search(r"^# 题目[ \t]*$", text, re.M)
    if not m: return text, 0
    s = m.end(); nx = re.search(r"^# ", text[s:], re.M); e = s + nx.start() if nx else len(text)
    parts = re.split(r"(?m)^(?=\*\*Questions? )", text[s:e]); out = []; n = 0
    for g in parts:
        ng, ch = fix_group(g); out.append(ng); n += ch
    return text[:s] + "".join(out) + text[e:], n

def main():
    apply = "--apply" in sys.argv; files = groups = 0
    for f in sorted(glob.glob(f"{ROOT}/0[56]. */*/*.md")):
        t = open(f, encoding="utf-8").read(); new, n = fix(t)
        if new != t:
            files += 1; groups += n
            if apply: open(f, "w", encoding="utf-8").write(new)
    print(f"改动 {files} 篇, {groups} 个题组", "(已写入)" if apply else "(dry run)")
if __name__ == "__main__": main()

#!/usr/bin/env python3
"""找出 `# 题目` 里自己那一块没有同义改写高亮的题, 为每篇生成给 Codex 的任务(提示词 + JSON Schema)。只读。
用法: python3 .agents/skills/ielts-note-common/scripts/paraphrase_gaps.py [--list]"""
import glob, json, os, re, sys
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", "..")); HERE = os.path.join(ROOT, ".cache"); OUT = os.path.join(HERE, "codex_para")
RULES = """你是雅思阅读/听力同义改写标注助手。只读: 不要修改任何文件, 只输出 JSON。
任务: 笔记 `{note}` 的 `# 题目` 里下面列出的题目还没有同义改写高亮。请对照该笔记的 `# {src}` 原文, 为这些题找出「题目里的单词或短语」与「原文里对应的单词或短语」的同义改写对, 最多每题 3 处。
硬性规则(违反的条目会被丢弃):
1. phrase = 题目里**连续、逐字出现**的 1 个单词或 1 个短语(不超过 8 个词); 必须出自该题自己的文字(题干或选项), 不得跨粗体 `**` 边界, 不得包含填空 `\\_`、`<!--`、`==`, 不得是题号。
2. para = 原文里**连续、逐字出现**的词块(不超过 8 个词), 要能在 `# {src}` 里原样找到(大小写和标点可忽略); 同一处对应多个原文表达时用 " / " 分隔; 反义对立(判断题 FALSE/NO 等)在该条原文表达后加【反】。严禁省略号(... 或 …)和推导符号(-> => →)。
3. 单词优先, 单词层面找不到才用短语, 且尽量短; 题目与原文同形的词不要高亮。
4. 填空题: 高亮与空格相邻的转述词; 答案词可以写进 para; 空格本身不能放进 phrase。
5. 宁缺毋滥: 原文直接复现原词、或题目内容原文根本没提(NOT GIVEN)时, 没有真正的同义改写就**不要给**该题, 不要硬配。
6. 不要选已经带 `==...==<!--para: ...-->` 的文字, 也不要与它们重叠。
输出: 严格符合给定 JSON Schema 的对象 {{"items":[{{"q":题号整数或"23-24"字符串,"phrase":"…","para":"…"}}]}}。没有可补的就输出 {{"items":[]}}。
待补的题(题号 + 该题当前文字):
"""
SCHEMA = {"type": "object", "additionalProperties": False, "required": ["items"], "properties": {"items": {"type": "array", "items": {"type": "object", "additionalProperties": False, "required": ["q", "phrase", "para"], "properties": {"q": {"type": ["integer", "string"]}, "phrase": {"type": "string"}, "para": {"type": "string"}}}}}}
def gaps(path):
    t = open(path, encoding="utf-8").read(); m = re.search(r"^# 题目[ \t]*$", t, re.M)
    if not m: return []
    nx = re.search(r"^# ", t[m.end():], re.M); q = t[m.end():m.end() + nx.start()] if nx else t[m.end():]
    lines = q.split("\n"); out = []
    for i, ln in enumerate(lines):
        for mm in re.finditer(r"<!--\s*(q|question):\s*(\d{1,2}(?:[–-]\d{1,2})?)", ln):
            num = mm.group(2)
            if mm.group(1) == "question":
                blk = [ln]; j = i + 1
                while j < len(lines) and (lines[j].strip().startswith("-") or not lines[j].strip()):
                    blk.append(lines[j]); j += 1
                    if j < len(lines) and not lines[j].strip() and j + 1 < len(lines) and not lines[j + 1].strip().startswith("-"): break
                text = "\n".join(blk)
            else: text = ln
            if "<!--para:" in text: continue
            if re.match(r"^\s*Paragraph [A-Z]\b|^\s*(?:Section|Part) [A-Z]\b", text): continue            # 选标题的行, 改写在标题列表上
            clean = re.sub(r"<!--.*?-->|[○🟢🔴✅❌]", "", text).strip()
            if len(re.findall(r"[A-Za-z]+", clean)) < 3: continue
            out.append({"q": num, "text": clean[:700]})
    return out
def main():
    tasks = []
    for f in sorted(glob.glob(os.path.join(ROOT, "06. reading", "*", "*.md")) + glob.glob(os.path.join(ROOT, "05. listening", "*", "*.md"))):
        g = gaps(f)
        if not g: continue
        src = "音频" if "05. listening" in f else "原文"; name = os.path.basename(f)[:-3]
        tid = re.sub(r"[^A-Za-z0-9]+", "_", name)[:40] + f"_{len(tasks):03d}"
        prompt = RULES.format(note=os.path.relpath(f, ROOT), src=src) + "\n".join(f"- 第 {x['q']} 题: {x['text']}" for x in g)
        open(os.path.join(OUT, tid + ".prompt.txt"), "w", encoding="utf-8").write(prompt)
        tasks.append({"id": tid, "note": os.path.relpath(f, ROOT), "n": len(g)})
    json.dump(SCHEMA, open(os.path.join(OUT, "schema.json"), "w"), ensure_ascii=False)
    json.dump(tasks, open(os.path.join(OUT, "tasks.json"), "w"), ensure_ascii=False, indent=1)
    print(len(tasks), "篇有待补的题, 共", sum(t["n"] for t in tasks), "题")
if __name__ == "__main__": main()

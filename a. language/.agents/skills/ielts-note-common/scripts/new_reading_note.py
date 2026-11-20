#!/usr/bin/env python3
"""新建阅读笔记骨架: 从雅思哥题库缓存(.cache/reading_cache/<subjectId>.json, 由 reading_fetch.py 拉取)取原文,
写成 `# 原文 / # 单词 / # 短语 / # 同义改写 / # 错题记录` 五段, 放进指定分类文件夹。同义改写表与错题记录由对照作答后的复盘补充, 不生成旧题目区。
用法: python3 .agents/skills/ielts-note-common/scripts/new_reading_note.py "C21-Test 1-Passage 3" "09. 作品评价" [--apply]   缺省 dry run
分类文件夹按文章行文结构从 06. reading 下现有 10 个文件夹里选; 已存在同名笔记则不覆盖。"""
import glob, html, json, os, re, sys
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", "..")); HERE = os.path.join(ROOT, ".cache")

def find(title):
    for f in glob.glob(os.path.join(HERE, "reading_cache", "*.json")):
        d = json.load(open(f))
        if d.get("_title") == title: return d
    raise SystemExit(f"reading_cache 里没有 {title}; 先运行 python3 .agents/skills/ielts-note-common/scripts/reading_fetch.py")

def paragraphs(h):
    out = []
    for p in re.findall(r"<p[^>]*>(.*?)</p>", h, re.S):
        t = html.unescape(re.sub(r"<[^>]+>", "", p)).replace("\xa0", " ")
        t = re.sub(r"\s+", " ", t).strip()
        if t: out.append(t)
    return out

def build(d):
    paras = paragraphs(d["passagesContent"])
    title = paras[0].rstrip(" .") if paras else d["_title"]
    body = paras[1:]
    text = "# 原文\n\n" + "\n\n".join(body) + "\n\n# 单词\n\n| 单词 | 音标 | 释义 | 记忆 | 英意 | 意群 | 同义词 | 评分 |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n\n# 短语\n\n| 短语 | 释义 | 意群 | 评分 |\n| --- | --- | --- | --- |\n\n# 同义改写\n\n| 题目表达 | 原文表达 |\n| --- | --- |\n\n# 错题记录\n"
    return title, text

def main():
    apply = "--apply" in sys.argv; args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 2: raise SystemExit(__doc__)
    title, folder = args
    d = find(title); name, text = build(d)
    name = re.sub(r"[\\/:*?\"<>|]", "", name).strip()
    path = os.path.join(ROOT, "06. reading", folder, name + ".md")
    if os.path.exists(path): raise SystemExit(f"已存在, 不覆盖: {path}")
    print(("写入 " if apply else "将写入 ") + os.path.relpath(path, ROOT), f"({len(text)} 字符, 段落 {text.count(chr(10)*2) - 3})")
    if apply:
        os.makedirs(os.path.dirname(path), exist_ok=True); open(path, "w", encoding="utf-8").write(text)
if __name__ == "__main__": main()

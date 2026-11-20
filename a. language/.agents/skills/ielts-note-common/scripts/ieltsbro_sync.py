#!/usr/bin/env python3
"""同步雅思哥新做的练习记录(只读): 列出 userExercise/page2 里本地还没有的记录, --apply 时拉详情落到
.cache/ieltsbro_records/(阅读)或 ieltsbro_records_listening/(听力)<id>.json, 并更新 _list.json。
用法: python3 .agents/skills/ielts-note-common/scripts/ieltsbro_sync.py [--reading|--listening] [--apply]
令牌只在内存里用; 只调用列表/详情接口, 不提交任何东西。"""
import json, os, sys
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", "..")); HERE = os.path.join(ROOT, ".cache"); sys.path.insert(0, SCRIPTS)
import ieltsbro_api as A

PARTS = {"reading": (3, "ieltsbro_records"), "listening": (1, "ieltsbro_records_listening")}

def listing(part):
    out, page = [], 1
    while True:
        c = A.call("hcp/qsBank/userExercise/page2", {"exercisePart": part, "curPage": page, "keywords": ""})
        rows = (c or {}).get("records") or (c or {}).get("list") or (c if isinstance(c, list) else [])
        if not rows: break
        out += rows
        if len(rows) < 10: break
        page += 1
    return out

def main():
    apply = "--apply" in sys.argv
    kinds = [k for k in PARTS if f"--{k}" in sys.argv] or list(PARTS)
    for kind in kinds:
        part, d = PARTS[kind]; folder = os.path.join(HERE, d); os.makedirs(folder, exist_ok=True)
        have = {f[:-5] for f in os.listdir(folder) if f.endswith(".json") and not f.startswith("_")}
        rows = listing(part); new = [r for r in rows if r["exerciseIdStr"] not in have]
        print(f"{kind}: 线上 {len(rows)} 条, 本地缺 {len(new)} 条")
        for r in new:
            v = r.get("readingDataVO") or r.get("listeningDataVO") or {}
            print("  ", r["createDate"], r["exerciseIdStr"], v.get("pathInfo"), v.get("title"), f"{v.get('correctAnwserNumber')}/{v.get('questionNumber')}")
        if not apply or not new: continue
        for r in new:
            det = A.call(f"hcp/qsBank/userExercise/detail/{r['exerciseIdStr']}", {})
            json.dump(det, open(os.path.join(folder, r["exerciseIdStr"] + ".json"), "w"), ensure_ascii=False)
        json.dump(rows, open(os.path.join(folder, "_list.json"), "w"), ensure_ascii=False)
        print(f"  已写入 {len(new)} 条")
if __name__ == "__main__": main()

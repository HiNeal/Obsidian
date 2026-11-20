"""雅思哥阅读做题记录判分(只读缓存 ieltsbro_records/): 返回每题 (题号, 题型, 我的答案, 标准答案, 是否正确)。"""
import json, re

def norm(s): return re.sub(r"\s+", " ", str(s)).strip().lower()

def judge(d):
    sd = d["scoreDetail"]; out = []
    for q in d["subjectData"]["questionList"]:
        qj = q["questionJson"]; qt = q["questionType"]; s, e = qj["startIndex"], qj["endIndex"]
        for i, a in enumerate(q["answerJson"]):
            cv = a["correctValue"]
            if qt == 2:
                key = f"{s}-{e}"; mine = sd.get(key); num = key
                ok = mine is not None and sorted(map(str, mine)) == sorted(map(str, cv))
                credit = len(set(map(str, mine or [])) & set(map(str, cv)))
            else:
                num = s + i; mine = sd.get(str(num)); credit = None
                if qt == 0:
                    alts = [norm(x) for x in re.split(r"/|\|", str(cv))] + [norm(cv)]
                    ok = mine is not None and norm(mine) in alts
                else:
                    ok = mine is not None and str(mine) == str(cv)
            if qt != 2: credit = 1 if ok else 0
            out.append(dict(credit=credit, total=2 if qt == 2 else 1, num=num, qtype=qt, group=q["questionNavigation"], mine=mine, correct=cv, ok=ok, idx=i, qi=q["questionId"]))
    return out

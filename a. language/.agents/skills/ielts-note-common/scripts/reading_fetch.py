"""把雅思哥全部剑桥阅读 passage(C5-C21)只读拉取到 .cache/reading_cache/<subjectId>.json, 已存在则跳过。"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ieltsbro_api as A
OUT = os.path.join(os.path.join(os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..")), ".cache"), "reading_cache")
os.makedirs(OUT, exist_ok=True)
topics = A.call("hcp/qsBank/paperTopic/topicList", {"examType": 0, "ifPc": True, "type": 3, "part": "paper"})
n = 0
for t in topics:
    page = 1
    while True:
        r = A.call("hcp/qsBank/passages/practiceList", {"curPage": page, "limit": 20, "paperType": 0, "examType": 0, "type": "paper", "topicId": t["topicId"]})
        for it in r["list"]:
            p = os.path.join(OUT, it["subjectId"] + ".json")
            if os.path.exists(p): continue
            part = int(it["title"].rsplit(" ", 1)[1])
            d = A.call("hcp/qsBank/passages/detail", {"paperType": 0, "part": part, "subjectId": it["subjectId"]})
            d["_title"] = it["title"]
            json.dump(d, open(p, "w"), ensure_ascii=False)
            n += 1; time.sleep(0.4)
        if page * 20 >= r["total"]: break
        page += 1
    print(t["name"], "完成", flush=True)
print("新增", n)

"""雅思哥 hcp-server 只读调用: 令牌取自本机 App 的本地存储, 不落盘不输出。"""
import glob, json, os, re, urllib.request
BASE = "https://hcp-server.ieltsbro.com/"
VERSION = "3.3.1"  # App 版本号, 接口要求 version 头
APP = os.path.expanduser("~/Library/Application Support/雅思哥机考软件/")

def token():
    for f in glob.glob(APP + "Local Storage/leveldb/*"):
        b = open(f, "rb").read()
        for m in re.finditer(rb"user_storage", b):
            seg = b[m.end():m.end() + 6000].decode("utf8", "ignore")
            try: o, _ = json.JSONDecoder().raw_decode(seg[seg.find("{"):])
            except Exception: continue
            if isinstance(o, dict) and o.get("token"): return o["token"]
    raise SystemExit("没找到登录令牌")

def call(path, body=None, query=""):
    url = BASE + path + query
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + token(), "Content-Type": "application/json",
                 "User-Agent": "Mozilla/5.0", "source": "3", "version": VERSION, "Origin": "https://pc-new.ieltsbro.com", "Referer": "https://pc-new.ieltsbro.com/"},
        method="POST" if body is not None else "GET")
    r = json.loads(urllib.request.urlopen(req, timeout=30).read())
    if r.get("status") != 0: raise RuntimeError(f"{path}: {r.get('status')} {r.get('message')}")
    return r.get("content")

"""九分学长 www.9fnnn.com 只读调用: 令牌取自本机 App 的本地存储(file:// 下的 token, LevelDB),
读取时临时拷贝一份目录用 plyvel 打开, 读完即删; 令牌只在内存里用, 不落盘不输出。请求头是 `token: <令牌>`。"""
import json, os, shutil, subprocess, tempfile, urllib.request
BASE = "https://www.9fnnn.com/api/practice/v1/"
SRC = os.path.expanduser("~/Library/Application Support/xxgg-electron/Local Storage/leveldb")
SCRIPTS = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(SCRIPTS, "..", "..", "..", ".."))
_TOKEN = None
_CODE = '''import plyvel,sys
db=plyvel.DB(sys.argv[1],create_if_missing=False)
out=None
for k,v in db:
    if k.startswith(b"_file://") and k.endswith(b"token"): out=v[1:].decode("utf-8","ignore") if v[:1] in (b"\\x00",b"\\x01") else v.decode("utf-8","ignore")
db.close(); sys.stdout.write(out or "")'''

def token():
    global _TOKEN
    if _TOKEN: return _TOKEN
    tmp = tempfile.mkdtemp(prefix="xxgg-ldb-")
    try:
        d = os.path.join(tmp, "ldb"); shutil.copytree(SRC, d)
        try: os.remove(os.path.join(d, "LOCK"))
        except FileNotFoundError: pass
        env = dict(os.environ, UV_CACHE_DIR=os.path.join(ROOT, ".cache", "uv"))
        r = subprocess.run(["uv", "run", "-p", "3.12", "--no-project", "--with", "plyvel-ci", "python", "-c", _CODE, d], capture_output=True, text=True, env=env)
        t = r.stdout.strip()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    if not t: raise SystemExit("没找到九分学长登录令牌")
    _TOKEN = t; return t

def call(path, query=""):
    url = BASE + path + (("?" + query) if query else "")
    req = urllib.request.Request(url, headers={"token": token(), "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "Mozilla/5.0"})
    r = json.loads(urllib.request.urlopen(req, timeout=30).read())
    if str(r.get("code")) != "200": raise RuntimeError(f"{path}: {r.get('code')} {r.get('message') or r.get('msg')}")
    return r.get("data")

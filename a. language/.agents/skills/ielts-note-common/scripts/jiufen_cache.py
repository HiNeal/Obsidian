"""九分学长(xxgg-electron)缓存读取: 听力 exam 响应 -> {part: {...}}。"""
import os, re, zlib, json
CACHE = os.path.expanduser("~/Library/Application Support/xxgg-electron/Cache/Cache_Data")

def load_parts(channel="listening"):
    out = []
    for f in sorted(os.listdir(CACHE)):
        p = os.path.join(CACHE, f)
        if not os.path.isfile(p): continue
        b = open(p, "rb").read()
        u = re.search(rb"https?://[^\x00\s\x1f]+", b[:400])
        if not u or b"/exam" not in u.group(0): continue
        i = b.find(b"\x1f\x8b")
        try: d = json.loads(zlib.decompressobj(31).decompress(b[i:]))
        except Exception: continue
        dd = d.get("data", {})
        if isinstance(dd, dict) and dd.get("channel") == channel:
            for part in dd.get("parts", []): out.append((f, part))
    return out

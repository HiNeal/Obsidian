#!/usr/bin/env python3
"""从听力真题原声中截取「单词 | 短语 | 释义」表的短语切片 chunk_${slug}.mp3。

用法（缺省 dry run，只报告对齐结果；加 --apply 才写 mp3）：
  uv run -p 3.12 --no-project --with mlx-whisper --with torch --with torchaudio --with num2words \
    python .agents/skills/ielts-note-common/scripts/slice_listening_chunks.py "05. listening/.../xxx.md" [...] [--apply] [--force]

流程：读笔记 `# 音频` 下嵌入的整段原声 → mlx-whisper 词级时间戳（结果缓存在 .cache/whisper/）
→ 在转写词序列里找短语的连续词序列 → torchaudio MMS 强制对齐求精确词边界，
在与邻词的间隙里取能量最低点下刀（不切半个词、不带邻词尾音）→ ffmpeg 截取。
文件名与 highlight-decompose 插件的 toSlug 一致，写入该笔记的同名音频文件夹。
"""
import json, re, subprocess, sys, unicodedata
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
CACHE = ROOT / ".cache" / "whisper"
MODEL = "mlx-community/whisper-large-v3-turbo"


def to_slug(s):  # 与插件 main.js toSlug 一致
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower().strip()
    s = re.sub(r"[*_~`#]", "", s)
    s = re.sub(r"['’`]", "_", s)
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"[^\w\-]", "_", s)
    s = re.sub(r"_+", "_", s)
    return s.strip("_")


def norm_word(w):
    w = w.lower().replace("’", "'")
    w = w.replace("%", " percent")
    return re.sub(r"[^a-z0-9' ]", "", w).strip()


def tokens(text):
    return [t for t in (norm_word(x) for x in re.split(r"[\s–—\-]+", text)) if t]


def transcribe(mp3):
    CACHE.mkdir(parents=True, exist_ok=True)
    out = CACHE / (mp3.stem + ".json")
    if out.exists():
        return json.loads(out.read_text())
    import mlx_whisper
    res = mlx_whisper.transcribe(str(mp3), path_or_hf_repo=MODEL, word_timestamps=True, language="en")
    words = [{"w": w["word"], "s": w["start"], "e": w["end"]} for seg in res["segments"] for w in seg.get("words", [])]
    out.write_text(json.dumps(words, ensure_ascii=False))
    return words


def expand(words):
    """把转写词拆成归一化后的子词，保留时间。"""
    out = []
    for i, w in enumerate(words):
        for t in tokens(w["w"]):
            out.append((t, i))
    return out


def locate(chunk_toks, flat):
    seq = [t for t, _ in flat]
    n = len(chunk_toks)
    best = (0, None)
    for i in range(len(seq) - n + 1):
        r = SequenceMatcher(None, chunk_toks, seq[i:i + n]).ratio()
        if r > best[0]:
            best = (r, i)
    return best


SR = 16000


def load_pcm(mp3):
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(mp3), "-ac", "1", "-ar", str(SR),
                          "-f", "s16le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32)


def quietest(pcm, a, b, frame=0.02):
    """[a, b] 内 20ms 帧 RMS 最低处的中心时间。"""
    import numpy as np
    a, b = max(0.0, a), min(len(pcm) / SR, b)
    hop, win = int(0.005 * SR), int(frame * SR)
    best, best_t = None, (a + b) / 2
    for i in range(int(a * SR), max(int(a * SR) + 1, int(b * SR) - win), hop):
        r = float(np.sqrt(np.mean(pcm[i:i + win] ** 2)))
        if best is None or r < best:
            best, best_t = r, (i + win / 2) / SR
    return best_t


_FA = None


def _fa():
    global _FA
    if _FA is None:
        import torchaudio
        b = torchaudio.pipelines.MMS_FA
        _FA = (b.get_model(with_star=False), b.get_tokenizer(), b.get_aligner())
    return _FA


def fa_words(text):
    from num2words import num2words
    out = []
    for w in re.split(r"[\s–—\-]+", text.replace("%", " percent")):
        w = re.sub(r"\d+", lambda m: " " + num2words(int(m.group())) + " ", w.lower().replace("’", "'"))
        out += [t for t in re.sub(r"[^a-z' ]", " ", w).split() if t.strip("'")]
    return out


def refine(pcm, words, a_i, b_i, ctx=3):
    """MMS 强制对齐短语及前后各 ctx 个词，返回 (起点, 终点) 秒。"""
    import numpy as np, torch
    lo, hi = max(0, a_i - ctx), min(len(words) - 1, b_i + ctx)
    t0, t1 = max(0.0, words[lo]["s"] - 0.4), min(len(pcm) / SR, words[hi]["e"] + 0.4)
    # 每个 whisper 词可能拆成多个对齐词（如 50% → fifty percent），记下它们的下标范围
    seq, owner = [], []
    for k in range(lo, hi + 1):
        for t in fa_words(words[k]["w"]):
            seq.append(t.replace("'", "")); owner.append(k)
    model, tok, align = _fa()
    wav = torch.from_numpy(pcm[int(t0 * SR):int(t1 * SR)] / 32768.0).float().unsqueeze(0)
    with torch.inference_mode():
        em, _ = model(wav)
    spans = align(em[0], tok(seq))
    sec = wav.size(1) / em.size(1) / SR
    st = [t0 + sp[0].start * sec for sp in spans]
    en = [t0 + sp[-1].end * sec for sp in spans]
    first = owner.index(a_i)
    last = len(owner) - 1 - owner[::-1].index(b_i)
    s, e = st[first], en[last]
    prev_e = en[first - 1] if first > 0 else s - 0.15
    next_s = st[last + 1] if last + 1 < len(st) else e + 0.15
    s = quietest(pcm, max(prev_e, s - 0.15), s) if prev_e < s else s
    e = quietest(pcm, e, min(next_s, e + 0.15)) if next_s > e else e
    return s, e


def rows_of(note):
    text = note.read_text(encoding="utf-8")
    rows = []
    if "## 音义词块" in text:
        sec = text.split("## 音义词块", 1)[1].split("\n## ", 1)[0]
        for line in sec.splitlines():
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            chunk = next((c for c in cells if "**" in c), None)
            if chunk:
                rows.append(chunk)
    if not rows:
        # 当前规范：集中入库在 02. word/m. 剑雅听力真题/音义词块.md
        table_path = ROOT / "02. word/m. 剑雅听力真题/音义词块.md"
        if table_path.exists():
            table_text = table_path.read_text(encoding="utf-8")
            # 匹配分节名：如 # 02. 咨询办理/Accommodation Options
            rel_stem = note.relative_to(ROOT / "05. listening").with_suffix("")
            target_heading = f"# {rel_stem}"
            if target_heading in table_text:
                sec = table_text.split(target_heading, 1)[1].split("\n# ", 1)[0]
                for line in sec.splitlines():
                    if line.startswith("|") and "**" in line:
                        cells = [c.strip() for c in line.strip().strip("|").split("|")]
                        if len(cells) >= 2:
                            if "**" in cells[0]:
                                rows.append(cells[0])
                            elif "**" in cells[1]:
                                rows.append(cells[1])
    m = re.search(r"!\[\[(20\. resource/05\. listening/[^\]]+\.mp3)\]\]", text)
    if not m:
        raise ValueError(f"No audio embed found in {note}")
    return rows, ROOT / m.group(1)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    apply, force = "--apply" in sys.argv, "--force" in sys.argv
    for a in args:
        note = (ROOT / a) if not Path(a).is_absolute() else Path(a)
        chunks, mp3 = rows_of(note)
        words = transcribe(mp3)
        flat = expand(words)
        pcm = load_pcm(mp3)
        print(f"== {note.name}  ({len(chunks)} 短语)")
        for chunk in chunks:
            plain = chunk.replace("**", "")
            ct = tokens(plain)
            ratio, i = locate(ct, flat)
            if i is None or ratio < 0.8:
                print(f"  [MISS {ratio:.2f}] {plain}")
                continue
            a_i, b_i = flat[i][1], flat[i + len(ct) - 1][1]
            # Whisper 的词边界首尾相接、偏差可达上百毫秒，只用来定位；
            # 真正的下刀点由 MMS 强制对齐给出，再在与邻词的间隙里取能量最低点。
            s, e = refine(pcm, words, a_i, b_i)
            heard = " ".join(w["w"].strip() for w in words[a_i:b_i + 1])
            out = mp3.parent / f"chunk_{to_slug(plain)}.mp3"
            flag = "" if ratio == 1 else f" ≈{ratio:.2f} heard: {heard}"
            print(f"  {s:7.2f}-{e:7.2f}  {out.name}{flag}")
            if apply and (force or not out.exists()):
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{s:.3f}", "-to", f"{e:.3f}",
                                "-i", str(mp3), "-af", "afade=t=in:d=0.02,areverse,afade=t=in:d=0.03,areverse",
                                "-codec:a", "libmp3lame", "-q:a", "2", str(out)], check=True)


if __name__ == "__main__":
    main()

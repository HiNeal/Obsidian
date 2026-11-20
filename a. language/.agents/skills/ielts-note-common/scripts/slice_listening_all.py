#!/usr/bin/env python3
"""按各篇听力笔记自己的 `# 单词`(含答案词表) / `# 短语` 表, 从本篇主音频截取缺失的意群原声 chunk_${slug}.mp3;
同时列出缺失的词头音频 ${sWord}.mp3(词头走 TTS, 不在此合成)。
用法: python .agents/skills/ielts-note-common/scripts/slice_listening_all.py [--apply] [--only 笔记名子串]
需在装有 mlx-whisper / torchaudio / num2words 的环境里运行。"""
import re, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import slice_listening_chunks as S

ROOT = S.ROOT
LISTENING = ROOT / "05. listening"

def sections():
    """{笔记相对 05. listening 的路径(无 .md): [(词头, 意群)]}, 只取本篇 # 单词(含答案词表) / # 短语 表。"""
    out = {}
    for note in sorted(LISTENING.rglob("*.md")):
        text = note.read_text()
        if not text.startswith("# 音频"): continue
        key = str(note.relative_to(LISTENING))[:-3]
        for sec in ("单词", "短语"):
            m = re.search(r"\n# " + sec + r"\n(.*?)(?=\n# |\Z)", text, re.S)
            if not m: continue
            for line in m.group(1).splitlines():
                if not line.startswith("|") or re.match(r"^\|\s*:?-{3}", line): continue
                c = [x.strip() for x in line.strip().strip("|").split("|")]
                if len(c) < 3 or c[0] in ("答案词", "单词", "短语"): continue
                word, chunk = re.sub(r"[=*]", "", c[0]).split("<br>")[0].strip(), c[2]
                if "**" in chunk: out.setdefault(key, []).append((word, chunk))
    return out

def main():
    apply = "--apply" in sys.argv
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else ""
    missing_words = []
    for sec, rows in sections().items():
        if only and only not in sec: continue
        note = ROOT / "05. listening" / (sec + ".md")
        m = re.search(r"# 音频\s*\n\s*!\[\[([^\]]+\.mp3)\]\]", note.read_text())
        mp3 = ROOT / m.group(1)
        todo = [(h, c) for h, c in rows if not (mp3.parent / f"chunk_{S.to_slug(c.replace('**',''))}.mp3").exists()]
        for h, _ in rows:
            if not (mp3.parent / f"{S.to_slug(h)}.mp3").exists(): missing_words.append((sec, h))
        print(f"== {sec}: 短语缺 {len(todo)}/{len(rows)}")
        if not todo: continue
        words = S.transcribe(mp3); flat = S.expand(words); pcm = S.load_pcm(mp3)
        for h, chunk in todo:
            plain = chunk.replace("**", "")
            ct = S.tokens(plain); r, i = S.locate(ct, flat)
            if i is None or r < 0.8:
                print(f"  [MISS {r:.2f}] {plain}"); continue
            a, b = flat[i][1], flat[i + len(ct) - 1][1]
            s, e = S.refine(pcm, words, a, b)
            out = mp3.parent / f"chunk_{S.to_slug(plain)}.mp3"
            flag = "" if r == 1 else f" ≈{r:.2f} heard: {' '.join(w['w'].strip() for w in words[a:b+1])}"
            print(f"  {s:7.2f}-{e:7.2f} {out.name}{flag}")
            if apply:
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{s:.3f}", "-to", f"{e:.3f}", "-i", str(mp3),
                                "-af", "afade=t=in:d=0.02,areverse,afade=t=in:d=0.03,areverse",
                                "-codec:a", "libmp3lame", "-q:a", "2", str(out)], check=True)
    print(f"\n缺词块 TTS: {len(missing_words)}")
    Path("/private/tmp/missing_words.tsv").write_text("\n".join(f"{s}\t{h}" for s, h in missing_words))

main()

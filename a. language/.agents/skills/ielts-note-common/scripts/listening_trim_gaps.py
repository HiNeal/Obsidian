"""裁掉听力主音频里连续静音>=10s的读题空档与结尾留白(接缝留0.4s), 先备份到 .cache/audio_backup/。dry run 缺省, 加 --apply 写盘。"""
import re,glob,subprocess,sys,os,shutil
APPLY="--apply" in sys.argv
BK=os.path.join(os.path.join(os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..")), ".cache"),"audio_backup")
PAD=0.4
def dur(p): return float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p],capture_output=True,text=True).stdout)
seen=set()
for n in sorted(glob.glob("05. listening/**/*.md",recursive=True)):
    t=open(n).read()
    m=re.search(r'# 音频\s*\n\s*!\[\[([^\]]+\.mp3)\]\]',t)
    if not m or m.group(1) in seen: continue
    seen.add(m.group(1)); mp3=m.group(1)
    if not os.path.exists(mp3): print("缺文件",mp3); continue
    D=dur(mp3)
    out=subprocess.run(["ffmpeg","-hide_banner","-i",mp3,"-af","silencedetect=noise=-40dB:d=10","-f","null","-"],capture_output=True,text=True).stderr
    st=[float(x) for x in re.findall(r"silence_start: ([\d.]+)",out)]
    en=[float(x) for x in re.findall(r"silence_end: ([\d.]+)",out)]
    if len(st)>len(en): en.append(D)
    gaps=list(zip(st,en))
    print(f"{mp3.split('05. listening/')[1]}  {D:.1f}s  长静音: "+", ".join(f"{a:.0f}-{b:.0f}({b-a:.0f}s)" for a,b in gaps))
    if not gaps or not APPLY: continue
    keep=[];cur=0.0
    for a,b in gaps:
        s_end=min(a+PAD,b)
        if s_end>cur+0.05: keep.append((cur,s_end))
        cur=max(b-PAD,s_end) if b<D-0.05 else D
    if cur<D-0.05: keep.append((cur,D))
    expr="+".join(f"between(t,{a:.3f},{b:.3f})" for a,b in keep)
    os.makedirs(BK,exist_ok=True); bk=os.path.join(BK,mp3.replace("/","__")); shutil.copy2(mp3,bk)
    tmp=mp3+".tmp.mp3"
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",bk,"-af",f"aselect='{expr}',asetpts=N/SR/TB","-codec:a","libmp3lame","-q:a","2",tmp],check=True)
    os.replace(tmp,mp3)
    print(f"   -> {dur(mp3):.1f}s")

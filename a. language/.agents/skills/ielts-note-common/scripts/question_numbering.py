"""Number question blocks in place; never rebuild an existing question section.
Ranges/counts must agree before sequential assignment. Dry-run migration is separate.
"""
import re

BLANK = r"\_" * 8
GAP = re.compile(r"(?:<!--q:\s*(?P<before>\d+)\s*-->\s*)?(?P<blank>(?:\\_){3,}|(?<![\w\\])_{3,}|\.{3,}|…{2,})(?:<!--q:\s*(?P<after>\d+)\s*-->)?")
HEADER = re.compile(r"(?mi)^\*\*Questions?\s*(\d+)(?:\s*(?:[-–—−]|and|to)\s*(\d+))?\*\*[^\n]*")
SECTION = re.compile(r"(?ms)^# 题目[^\n]*\n(.*?)(?=^# |\Z)")
PREFIX = re.compile(r"^(\s*(?:-\s+)?)(?:\*\*(\d+)(?:[–-](\d+))?\.\*\*\s*|(?:\*\*)?(\d+)\.?\s+(?:\*\*)?)")


def visible(s):
    s = re.sub(r"<!--.*?-->", "", s)
    return s.replace("==", "").replace("**", "").strip()


def number_group(block, numbers=None, kind=None, stems=None, gap_numbers=None):
    """Use an explicit source range or a Questions heading with exact structure checks.
    Returns (text, reason). Empty reason means every question was safely numbered.
    """
    head = HEADER.match(block)
    if numbers is None:
        if not head:
            return block, "no reliable question range"
        numbers = list(range(int(head[1]), int(head[2] or head[1]) + 1))
    numbers = list(numbers)
    if not numbers or len(set(numbers)) != len(numbers) or any(not 1 <= n <= 40 for n in numbers):
        return block, "invalid source numbers"
    start = head.end() if head else 0
    answer = re.search(r"(?m)^\*\*答案\*\*", block[start:])
    end = start + answer.start() if answer else len(block)
    body = block[start:end]
    # Hidden stem annotations are rewritten only after their source range validates.
    body = re.sub(r' ?<!--question:\s*\d+(?:[–-]\d+)?\s*-->', '', body)
    gaps = list(GAP.finditer(body))
    edits = []
    if gaps:
        existing = [int(m['before'] or m['after']) for m in gaps if m['before'] or m['after']]
        assigned = list(gap_numbers) if gap_numbers is not None else (existing if len(existing)==len(gaps) and set(existing)==set(numbers) else numbers)
        if len(gaps) != len(assigned):
            return block, f"blank count {len(gaps)} != range count {len(assigned)}"
        if set(assigned) != set(numbers):
            return block, "blank numbers do not cover source range"
        for m, n in zip(gaps, assigned):
            if any(int(v) != n for v in (m['before'], m['after']) if v):
                return block, f"existing blank number conflicts with {n}"
            edits.append((m.start(), m.end(), BLANK + f"<!--q: {n}-->"))
        # Source HTML sometimes leaves the printed question number at line start.
        # Only remove a prefix if that line's first gap has the same number.
        gap_lines = [m for m in re.finditer(r"(?m)^.*$", body) if any(m.start() <= g.start() < m.end() for g in gaps)]
        printed = [PREFIX.match(m[0]) for m in gap_lines]
        local_sequence = bool(head and re.search(r'Which (?:paragraph|section) contains',head[0],re.I) and len(printed)==len(numbers) and all(printed) and [int(p[2] or p[4]) for p in printed]==list(range(1,len(numbers)+1)))
        for m in gap_lines:
            gs = [i for i,g in enumerate(gaps) if m.start() <= g.start() < m.end()]
            p = PREFIX.match(m[0])
            if gs and p:
                old = int(p[2] or p[4]); n = assigned[gs[0]]
                if (old == n or local_sequence) and not p[3]:
                    edits.append((m.start(), m.start()+p.end(), p[1]))
    else:
        lines = list(re.finditer(r"(?m)^.*$", body))
        candidates = []
        # A choice stem must be followed by A. options. Instructions/titles cannot qualify.
        choice = bool(re.search(r"(?m)^\s*-\s+A[.)]\s", body))
        if choice:
            for i,m in enumerate(lines):
                if not m[0].strip(): continue
                following = next((x[0] for x in lines[i+1:] if x[0].strip()), "")
                if re.match(r"^\s*-\s+A[.)]\s", following) and not re.match(r"^\s*-\s*[A-Z][.)]\s",m[0]):
                    candidates.append(m)
        elif kind in ("judgement", "3") or (head and re.search(r"Do the following statements|TRUE|YES if|YES / NO", head[0], re.I)):
            candidates = [m for m in lines if re.match(r"^\s*-\s+\S",m[0])]
        elif stems:
            wanted = [visible(s) for s in stems]
            candidates = [m for m in lines if visible(PREFIX.sub(lambda x:x[1],m[0],count=1)).lstrip("- ") in wanted]
        else:
            # Existing printed numbers are reliable anchors for matching without gaps.
            candidates = [m for m in lines if PREFIX.match(m[0]) and int(PREFIX.match(m[0])[2] or PREFIX.match(m[0])[4]) in numbers]
        multi = len(candidates)==1 and len(numbers)>1 and choice and (kind in ("multiple-choice","2") or (head and re.search(r"Choose (?:TWO|THREE|FOUR|FIVE|\d+) (?:letters|answers)",head[0],re.I)))
        if len(candidates) != len(numbers) and not multi:
            return block, f"stem count {len(candidates)} != range count {len(numbers)}"
        for i,m in enumerate(candidates):
            n = numbers[0] if multi else numbers[i]
            label = f"{numbers[0]}–{numbers[-1]}" if multi else str(n)
            p = PREFIX.match(m[0])
            if p:
                if int(p[2] or p[4]) != n or (p[3] and int(p[3]) != (numbers[-1] if multi else n)):
                    return block,"existing stem number conflicts with source"
                edits.append((m.start(),m.start()+p.end(),p[1]))
            edits.append((m.end(),m.end(),f" <!--question: {label}-->"))
    for a,b,replacement in sorted(edits,reverse=True):
        body=body[:a]+replacement+body[b:]
    return block[:start]+body+block[end:], ""


def number_section(body):
    heads=list(HEADER.finditer(body))
    if not heads:
        return body, ["no question range"] if body.strip() else []
    issues=[]
    for i,h in reversed(list(enumerate(heads))):
        end=heads[i+1].start() if i+1<len(heads) else len(body)
        old=body[h.start():end]
        new,reason=number_group(old)
        if reason: issues.append(f"{h[1]}–{h[2]}: {reason}")
        body=body[:h.start()]+new+body[end:]
    return body,list(reversed(issues))


def merge_questions(note, generated):
    """Keep all existing text/answers/annotations, numbering existing sections in place.
    Only an absent/empty section may receive generated content.
    """
    if re.search(r"(?m)^# (?:单词|短语|同义改写|错题记录)\s*$", note):
        raise ValueError("新格式篇章禁止写入旧 # 题目; 请直接整理同义改写表与错题记录")
    m=SECTION.search(note)
    if m:
        old=m[1]
        body=number_section(old)[0] if old.strip() else SECTION.search(generated)[1]
        return note[:m.start(1)]+body+note[m.end(1):]
    h=re.search(r"(?m)^# (?!原文|音频)",note)
    at=h.start() if h else len(note)
    return note[:at].rstrip("\n")+"\n\n"+generated+note[at:]

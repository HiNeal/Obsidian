const { normalize } = require("./dom");

function appendInline(parent, text) {
  text.split(/<br\s*\/?>/).forEach((line, i) => {
    if (i > 0) parent.createEl("br");
    line.split(/\*\*(.+?)\*\*/).forEach((part, k) => {
      if (!part) return;
      if (k % 2) parent.createEl("strong", { text: part });
      else parent.appendText(part);
    });
  });
}

// 牛津英文释义块的词性行：`v. 主项`（词性与第一个主项同行）。
const EN_POS = /^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|int\.|det\.|num\.|abbr\.|comb\.|contr\.|inf\.|symbol\.)(?:\s+(.*))?$/;

// A reading occurrence owns its sense: ==issued==<!--search: issue | 签发-->.
// The shared entry never owns an article's choice of sense.
function readingNotePath(path) {
  return String(path || "").match(/(?:^|\/)((?:06\. reading|07\. writing|09\. speaking|10\. practice\/reading|12\. books)\/.*\.md)$/i)?.[1] || "";
}

function senseContext(text) {
  return normalize(String(text || "")).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function chunkMatchesContext(entry, context) {
  const chunk = senseContext(entry.chunk);
  const surrounding = senseContext(context);
  return !!chunk && (" " + surrounding + " ").includes(" " + chunk + " ");
}

// Vocabulary cards keep the reading-tested senses stored in the current cell.
// Article cards read the entry from the article's own table, where ==...== marks
// this article's context sense: preserveHighlights === "context" keeps them as such.
// false drops the marks (old annotation-driven cards pick their own sense).
function appendMeaningInline(parent, text, preserveHighlights = true) {
  let offset = 0;
  for (const match of text.matchAll(/(\*\*|==)(.+?)\1/g)) {
    parent.appendText(text.slice(offset, match.index));
    const target = match[1] === "**" ? parent.createEl("strong")
      : preserveHighlights === "context" ? parent.createEl("mark", { cls: "hd-context-sense" })
      : preserveHighlights ? parent.createEl("mark", { cls: "hd-tested-sense" }) : parent;
    appendMeaningInline(target, match[2], preserveHighlights);
    offset = match.index + match[0].length;
  }
  parent.appendText(text.slice(offset));
}

function surfaceForm(text) {
  return String(text).replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

// Preserve offsets while masking code, comments and tables. Annotation
// comments are read from the original source, never from their rendered DOM.
function maskSource(content) {
  const blank = s => s.replace(/[^\n]/g, " ");
  let fence = null;
  const masked = content.split("\n").map(line => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      return blank(line);
    }
    if (marker) { fence = { char: marker[1][0], length: marker[1].length }; return blank(line); }
    return line;
  }).join("\n").replace(/<!--[\s\S]*?(?:-->|$)/g, blank)
    .replace(/(`+)[\s\S]*?\1(?!`)/g, blank)
    .replace(/\\[\\`*{}\[\]()#+.!_>~=|-]/g, blank)
    .replace(/^[ \t]*\|[^\n]*$/gm, blank);
  return masked;
}

function sourceHighlights(content) {
  const masked = maskSource(content);
  const out = [];
  for (const m of masked.matchAll(/==([^=\n]+)==/g)) {
    const end = m.index + m[0].length;
    // 题目里的同义改写: ==题目短语==<!--para: 原文表达 / 原文表达-->, 悬停显示原文表达。
    const para = content.slice(end).match(/^[ \t]*<!--\s*para[:：]\s*([^\n]*?)\s*-->/);
    if (para) {
      out.push({ from: m.index, to: end, text: normalize(content.slice(m.index + 2, end - 2)), annotation: null, para: para[1].trim(),
        annotationRange: { from: end + para[0].indexOf("<!--"), to: end + para[0].length } });
      continue;
    }
    const note = content.slice(end).match(/^(?:\*\*)?[ \t]*<!--\s*search[:：]\s*([^\n]*?)\s*-->/);
    let annotation = null;
    if (note) {
      const value = note[1].trim();
      const pair = value.includes("|") ? value.split("|") : value.match(/^(\S+)\s+(.+)$/)?.slice(1);
      if ((pair?.length >= 2 && pair?.length <= 4) && pair.every(s => s.trim()) && !/[<>]/.test(value)) {
        const surface = pair.length >= 3 ? surfaceForm(pair[2]) : null;
        annotation = { word: normalize(pair[0]), gloss: pair[1].trim(), surface,
          ...(pair.length === 4 ? { reference: normalize(pair[3]) } : {}),
          changed: surface !== null && surface !== surfaceForm(content.slice(m.index + 2, end - 2)) };
      }
    }
    const annotationRange = note ? { from: end + note[0].indexOf("<!--"), to: end + note[0].length } : null;
    out.push({ from: m.index, to: end, text: normalize(content.slice(m.index + 2, end - 2)), annotation, annotationRange });
  }
  let question = false;
  const headings = [...masked.matchAll(/^#\s+(.+?)\s*#*\s*$/gm)];
  let heading = 0;
  for (const range of out) {
    while (heading < headings.length && headings[heading].index < range.from) {
      question = headings[heading++][1].trim() === "题目";
    }
    if (question || range.para) range.question = true;
  }
  return out;
}

function bindReadingSenses(root, source, path = "", hasEntry = null, question = false) {
  const marks = (root.matches("mark") ? [root] : [...root.querySelectorAll("mark")])
    .filter(el => !el.closest("table, pre, code, .internal-embed"));
  for (const el of marks) {
    delete el.dataset.hdSenseWord; delete el.dataset.hdSenseGloss; delete el.dataset.hdSenseSurface; delete el.dataset.hdSenseReference;
    el.dataset.hdSensePath = path;
  }
  const ranges = sourceHighlights(source);
  const matchedLength = marks.length === ranges.length && marks.every((el, i) => normalize(el.textContent) === ranges[i].text);
  marks.forEach((el, i) => {
    el.classList.toggle("hd-question-highlight", question || Boolean(matchedLength && ranges[i].question));
    delete el.dataset.hdPara;
    if (matchedLength && ranges[i].para) {
      el.dataset.hdPara = ranges[i].para;
      el.classList.toggle("hd-para-word", true);
      el.classList.toggle("hd-reading-word", false);
      el.classList.toggle("hd-plain-highlight", false);
      return;
    }
    el.classList.toggle("hd-para-word", false);
    const note = matchedLength ? ranges[i].annotation : null;
    if (note) {
      el.dataset.hdSenseWord = note.word; el.dataset.hdSenseGloss = note.gloss;
      if (note.surface !== null) el.dataset.hdSenseSurface = note.surface;
      if (note.reference) el.dataset.hdSenseReference = note.reference;
    }
    const isEnglish = /[a-z]/i.test(el.textContent) && !/[\u3400-\u9fff]/.test(el.textContent);
    const text = matchedLength ? ranges[i].text : normalize(el.textContent);
    const matched = isEnglish && (!hasEntry || hasEntry(text, note));
    el.classList.toggle("hd-reading-word", Boolean(matched));
    // 纯高亮: 既无注释, 本篇也查不到词条。
    el.classList.toggle("hd-plain-highlight", Boolean(matchedLength && !note && !ranges[i].para && !matched));
  });
}

// 听力笔记: 只给带 para 注释的高亮绑定同义改写悬停, 其余高亮交给听力自己的逻辑。
function bindParaphrase(root, source, question = false) {
  const marks = (root.matches("mark") ? [root] : [...root.querySelectorAll("mark")])
    .filter(el => !el.closest("table, pre, code, .internal-embed"));
  const ranges = sourceHighlights(source);
  const matchedLength = marks.length === ranges.length && marks.every((el, i) => normalize(el.textContent) === ranges[i].text);
  marks.forEach((el, i) => {
    el.classList.toggle("hd-question-highlight", question || Boolean(matchedLength && ranges[i].question));
    delete el.dataset.hdPara;
    const para = matchedLength ? ranges[i].para : null;
    el.classList.toggle("hd-para-word", Boolean(para));
    if (para) el.dataset.hdPara = para;
  });
}

function questionBlanks(content, includeTables = false) {
  const out = [];
  let question = false, fence = null, offset = 0;
  for (const line of content.split("\n")) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
    } else if (marker) {
      fence = { char: marker[1][0], length: marker[1].length };
    } else {
      const heading = line.match(/^#\s+(.+?)\s*#*\s*$/);
      if (heading) question = heading[1].trim() === "题目";
      if (question && (includeTables || !/^\s*\|/.test(line))) {
        for (const match of line.replace(/<!--.*?-->|(`+).*?\1/g, text => " ".repeat(text.length)).matchAll(/(?:\\_){8}|(?<![\\_])_{8}(?!_)/g)) {
          const end = match.index + match[0].length;
          const before = line.slice(0, match.index).match(/<!--\s*q:\s*(\d+(?:[–-]\d+)?)\s*-->$/);
          const after = line.slice(end).match(/^<!--\s*q:\s*(\d+(?:[–-]\d+)?)\s*-->/);
          const label = after || before;
          const labelFrom = after ? offset + end : offset + match.index - (before?.[0].length || 0);
          out.push({ from: offset + match.index, to: offset + end,
            ...(label ? { number: label[1], labelFrom, labelTo: labelFrom + label[0].length } : {}) });
        }
      }
    }
    offset += line.length + 1;
  }
  return out;
}

const readingDocRanges = new WeakMap();

function highlightsForDoc(doc) {
  if (!readingDocRanges.has(doc)) readingDocRanges.set(doc, sourceHighlights(doc.toString()));
  return readingDocRanges.get(doc);
}


// `#adj1` selects one main sense; `#n2.3` selects its third Chinese gloss.
// `#1` counts main senses across POS-less lines.
// It indexes the card's own Chinese block, so rewording a sense never breaks it.
const POS_RE = "n|v|adj|adv|prep|conj|pron|int|det|num";
function parseSenseId(value) {
  const m = String(value || "").trim().match(new RegExp(`^(?:zh)?#(${POS_RE})?(\\d+)(?:\\.(\\d+))?$`));
  return m ? { pos: m[1] || "", main: +m[2], sub: m[3] ? +m[3] : 0 } : null;
}

// Semicolons delimit main senses. Top-level commas delimit selectable Chinese
// glosses; commas inside a parenthetical usage label do not change numbering.
function senseItems(text) {
  const start = text.match(new RegExp(`^(?:${POS_RE})\\.\\s*`))?.[0].length || 0;
  const items = [];
  let from = start;
  const close = (end) => {
    let a = from, b = end;
    while (a < b && /\s/.test(text[a])) a++;
    while (b > a && /\s/.test(text[b - 1])) b--;
    if (b > a) {
      const subs = [];
      let depth = 0, part = a;
      const finish = end => {
        let x = part, y = end;
        while (x < y && /\s/.test(text[x])) x++;
        while (y > x && /\s/.test(text[y - 1])) y--;
        if (y > x) subs.push({ from: x, to: y });
        part = end + 1;
      };
      for (let i = a; i < b; i++) {
        if (/[（(]/.test(text[i])) depth++;
        else if (/[）)]/.test(text[i])) depth = Math.max(0, depth - 1);
        else if (!depth && /[,，]/.test(text[i])) finish(i);
      }
      finish(b);
      items.push({ from: a, to: b, subs });
    }
    from = end + 1;
  };
  for (let i = start; i < text.length; i++) if (/[;；]/.test(text[i])) close(i);
  close(text.length);
  return items;
}

function senseIdMatches(lines, id) {
  let count = 0;
  for (const [lineIndex, text] of lines.entries()) {
    const pos = text.match(new RegExp(`^(${POS_RE})\\.`))?.[1] || "";
    if (id.pos && pos !== id.pos) continue;
    const items = senseItems(text);
    const item = items[id.main - 1 - (id.pos ? 0 : count)];
    if (item) {
      // Ambiguous legacy main IDs never highlight several translations.
      const gloss = id.sub ? item.subs[id.sub - 1] : item.subs.length === 1 ? item.subs[0] : null;
      return gloss ? [{ lineIndex, from: gloss.from, to: gloss.to }] : [];
    }
    if (id.pos) return [];
    count += items.length;
  }
  return [];
}

function readingSenseMatches(lines, gloss) {
  if (!gloss) return [];
  const id = parseSenseId(gloss);
  if (id) return senseIdMatches(lines, id);
  // Optional POS disambiguates repeated definitions: "v. 发布".
  const tagged = gloss.match(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|int\.|det\.|num\.)\s+(.+)$/);
  const target = tagged ? tagged[2] : gloss;
  if (!target) return [];
  const hits = [], loose = [];
  let pos = "";
  for (const [lineIndex, text] of lines.entries()) {
    const prefix = text.match(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|int\.|det\.|num\.)\s*/);
    if (prefix) pos = prefix[1];
    if (tagged && tagged[1] !== pos) continue;
    let at = 0;
    while ((at = text.indexOf(target, at)) >= 0) {
      const start = prefix ? prefix[0].length : 0, end = at + target.length;
      // Full-width parentheses are part of a Chinese usage label, e.g.
      // 消费者（生物） or （植物的）腺, not a second occurrence of the generic sense.
      const before = c => !c || /[\s;；,，(]/.test(c);
      const after = c => !c || /[\s;；,，()]/.test(c);
      if ((at === start || before(text[at - 1])) && after(text[end])) hits.push({ lineIndex, from: at, to: end });
      else if (after(text[end]) && /[㐀-鿿]/.test(text[at - 1] || "")) {
        // A gloss that ends a longer item still names that sense: 长条 in 狭长条.
        let from = at;
        while (from > start && !before(text[from - 1])) from--;
        loose.push({ lineIndex, from, to: end });
      }
      at = end;
    }
  }
  return hits.length ? hits : loose;
}

// When no listed sense matches the gloss, pick the sense sharing the most
// characters with it (Dice score over character sets); the first one wins ties.
function nearestSense(lines, gloss) {
  if (parseSenseId(gloss)) return null;
  const target = new Set(String(gloss || "").replace(/^(?:n|v|adj|adv|prep|conj|pron|int|det|num)\.\s*/, "").replace(/[的地]/g, ""));
  if (!target.size) return null;
  let best = null, bestScore = 0;
  for (const [lineIndex, text] of lines.entries()) {
    const start = text.match(/^(?:n|v|adj|adv|prep|conj|pron|int|det|num)\.\s*/)?.[0].length || 0;
    for (const m of text.slice(start).matchAll(/[^;；,，()（）\s]+/g)) {
      const chars = new Set(m[0].replace(/[的地]/g, ""));
      const shared = [...chars].filter(c => target.has(c)).length;
      const score = chars.size ? 2 * shared / (chars.size + target.size) : 0;
      if (score > bestScore) {
        bestScore = score;
        best = { lineIndex, from: start + m.index, to: start + m.index + m[0].length };
      }
    }
  }
  return best;
}

function highlightReadingSense(root, gloss) {
  const lines = Array.from(root.children);
  const texts = lines.map(line => line.textContent);
  const hits = readingSenseMatches(texts, gloss);
  if (hits.length > 1) return false;
  const hit = hits[0];
  if (!hit) return false;
  const { lineIndex, from, to } = hit;
  const selected = senseItems(texts[lineIndex].slice(from, to));
  if (selected.length !== 1 || selected[0].subs.length !== 1) return false;
  const line = lines[lineIndex];
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT), parts = [];
  let node, offset = 0;
  while ((node = walker.nextNode())) {
    if (offset < to && from < offset + node.length) parts.push({ node, from: Math.max(0, from - offset), to: Math.min(node.length, to - offset) });
    offset += node.length;
  }
  for (const part of parts) {
    const range = document.createRange();
    range.setStart(part.node, part.from); range.setEnd(part.node, part.to);
    const mark = document.createElement("mark");
    mark.className = "hd-context-sense";
    range.surroundContents(mark);
  }
  return true;
}

// 英文释义编号: `en#1` / `en#v1` / `en#v1.2`。en 表示英文块(中文块写 zh#, 裸 # 兼容为 zh); 词性可省; 数字是该词性下第几个
// 主项(英文块里不带 • 的行, 词性行本身即第 1 主项); `.k` 是该主项下第 k 个 • 子项。
function parseEnglishSenseId(value) {
  const m = String(value || "").trim().match(new RegExp(`^en#(${POS_RE})?(\\d+)(?:\\.(\\d+))?$`));
  return m ? { pos: m[1] || "", main: +m[2], sub: m[3] ? +m[3] : 0 } : null;
}

// groups: [{ pos: "v.", rows: ["main", "sub", "sub", "main", ...] }], 与英文块渲染顺序一致。
// 返回 { group, row }(下标), 编号越界或无法唯一定位时返回 null。
function englishSenseTarget(groups, id) {
  if (!id) return null;
  let count = 0;
  for (const [group, g] of groups.entries()) {
    if (id.pos && g.pos !== id.pos + ".") continue;
    for (let row = 0; row < g.rows.length; row++) {
      if (g.rows[row] !== "main") continue;
      if (++count !== id.main) continue;
      if (!id.sub) return { group, row };
      let seen = 0;
      for (let k = row + 1; k < g.rows.length && g.rows[k] === "sub"; k++) {
        if (++seen === id.sub) return { group, row: k };
      }
      return null;
    }
  }
  return null;
}

function unwrapCardMarks(root) {
  root.querySelectorAll("mark, .cm-highlight").forEach(mark => mark.replaceWith(...mark.childNodes));
}

module.exports = { questionBlanks, bindParaphrase, parseSenseId, parseEnglishSenseId, englishSenseTarget, appendInline, EN_POS, readingNotePath, senseContext, chunkMatchesContext, appendMeaningInline, surfaceForm, sourceHighlights, bindReadingSenses, readingDocRanges, highlightsForDoc, readingSenseMatches, nearestSense, highlightReadingSense, unwrapCardMarks };

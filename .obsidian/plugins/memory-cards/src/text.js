// 纯文本工具: Markdown 表格行切分、单元格清洗、HTML 转义、音频 slug。不依赖 Obsidian, test.js 直接调用。

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") { cur += "|"; i++; continue; }
    if (s[i] === "|") { cells.push(cur.trim()); cur = ""; continue; }
    cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

const isSeparator = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line || "");
const isTableLine = (line) => Boolean(line) && line.trim().startsWith("|");
const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, "");
const brToNewline = (s) => s.replace(/<br\s*\/?>/gi, "\n");
const stripTags = (s) => s.replace(/<[^>]*>/g, "");
const decodeEntities = (s) => s
  .replace(/&emsp;|&ensp;|&nbsp;/g, " ")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
  .replace(/&amp;/g, "&");
const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const isPhonetic = (s) => /^\/[^/]+\/$/.test(s.trim());

/** 单元格 → 纯文本: 去注释、标签、实体与 ** / == 标记。 */
const plain = (s) => decodeEntities(stripTags(stripComments(s))).replace(/\*\*|==/g, "").trim();

/** 单元格 → 多行文本 (保留 <br> 换行与 ==标记==, 去其余标签)。 */
const multiline = (s) => decodeEntities(stripTags(brToNewline(stripComments(s))));

// 释义行开头的词性标签, 单独成列显示
const POS_RE = /^((?:n|v|vt|vi|adj|adv|prep|conj|pron|int|det|num|abbr|exclam|art|aux|modal|phr|prefix|suffix)\.)\s*/;

/**
 * 释义 → HTML: 每行一条, 行首词性 (n. / adj. ...) 放在左侧一列, 释义在右侧左对齐,
 * 折行时对齐到释义起点; ==考过义项== 浅绿底; 空行 = 词性之间留一点空。输入是 multiline() 之后的文本。
 */
function meaningHtml(text) {
  const mark = (s) => escapeHtml(s).replace(/==([^=]+)==/g, '<mark class="mc-exam">$1</mark>');
  const out = [];
  let gap = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) { gap = out.length > 0; continue; }
    const cls = gap ? "mc-sense is-gap" : "mc-sense";
    gap = false;
    const m = line.match(POS_RE);
    out.push(m
      ? `<div class="${cls}"><span class="mc-pos">${escapeHtml(m[1])}</span><span class="mc-def">${mark(line.slice(m[0].length))}</span></div>`
      : `<div class="${cls} is-plain"><span class="mc-def">${mark(line)}</span></div>`);
  }
  return out.join("");
}

/**
 * 英意 → HTML: 两栏网格, 左栏词性(只有该词性的第一条主义项才有, 其余留空), 右栏义项文字,
 * 这样同一词性下的多条主义项文字起点对齐; 「•」子义项在右栏缩进一档。输入是 parseMeaning() 之后的文本。
 */
const EN_POS = /^((?:n|v|adj|adv|prep|conj|pron|int|det|num|abbr|exclam)\.)\s+/;
function englishHtml(text) {
  const rows = text.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    if (/^•/.test(line)) {
      return `<span class="mc-en-pos"></span><div class="mc-en is-sub">${escapeHtml(line.replace(/^•\s*/, ""))}</div>`;
    }
    const m = line.match(EN_POS);
    const pos = m ? escapeHtml(m[1]) : "";
    const body = escapeHtml(m ? line.slice(m[0].length) : line);
    return `<span class="mc-en-pos is-main">${pos}</span><div class="mc-en is-main">${body}</div>`;
  });
  return `<div class="mc-en-grid">${rows.join("")}</div>`;
}

/** 意群 → HTML: **靶心词** 加粗, 多条意群各占一行。 */
function phraseHtml(text) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => `<div class="mc-phrase-line">${escapeHtml(l).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")}</div>`)
    .join("");
}

/** Base「例子」列只取词头, 保留词形与顺序, 词性及后面的释义留在原文中。 */
function exampleWords(text = "") {
  const words = [], seen = new Set();
  const pos = /\s+(?:n|v|vt|vi|adj|adv|prep|conj|pron|int|det|num|abbr|exclam|art|aux|modal|phr)\.\s*/;
  for (const raw of multiline(text).split("\n")) {
    const line = plain(raw);
    if (!line) continue;
    const match = line.match(pos);
    if (!match && !/^[A-Za-z][A-Za-z0-9'’ .-]*$/.test(line)) continue;
    const word = (match ? line.slice(0, match.index) : line).trim();
    if (!word || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    words.push(word);
  }
  return words;
}

/**
 * 按「括号段结束」切分构词行: "rad, ras(根: 刮), -ity(性质)" → ["rad, ras(根: 刮)", "-ity(性质)"]。
 * 只在 ")" 之后断开, 词根变体 "muscl, muscul(...)" 里的逗号不会被切开。
 */
function splitParts(line) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    cur += ch;
    if (ch === ")" && depth === 0 && /^\s*(?:,|$)/.test(line.slice(i + 1))
        && !/^[a-z]+$/i.test(memoryPart(cur.trim()).meaning)) {
      parts.push(cur.replace(/^[,\s]+/, "").trim()); cur = "";
    }
  }
  const rest = cur.replace(/^[,\s]+/, "").trim();
  if (rest) parts.push(rest);
  return parts;
}

/**
 * 记忆 → HTML。构词行 (`out(词: 向外), cry(词: 喊叫)`) 拆成一枚枚成分: 片段加粗, 括号释义灰色;
 * 其余行 (核心意象 / 引申解释) 作正文。输入是 parseMeaning() 之后的文本。
 */
function memoryParts(line) {
  const parts = /^[A-Za-z(\-]/.test(line) && line.includes("(") ? splitParts(line) : null;
  const ok = (p) => /\(.*\)$/.test(p) || /^-?[a-z]{1,3}-?$/.test(p);
  return parts && parts.every(ok) && parts.some((p) => p.includes("(")) ? parts : null;
}

/** 最后一组外层括号才是释义, 保留 my(o) 等词根自带的可选字母。 */
function memoryPart(part) {
  let depth = 0;
  if (part.endsWith(")")) {
    for (let i = part.length - 1; i >= 0; i--) {
      if (part[i] === ")") depth++;
      if (part[i] === "(" && --depth === 0) {
        return { word: part.slice(0, i).trim(), meaning: part.slice(i + 1, -1) };
      }
    }
  }
  return { word: part, meaning: "" };
}

/** 记忆列分为构词说明与核心意象, 不把无构词的首行误当拆解。 */
function splitMemory(text = "") {
  const decomposition = [], memory = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const bare = line.replace(/\*\*/g, "");
    const formation = memoryParts(bare)
      || /^由\s*.+(?:混合构成|截短形成)$/.test(line)
      || /^[A-Za-z].*的首字母缩写$/.test(line);
    (formation ? decomposition : memory).push(formation ? bare : line);
  }
  return { decomposition: decomposition.join("\n"), memory: memory.join("\n") };
}

function memoryHtml(text) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean)
    .map((line) => `<div class="mc-mem-line">${escapeHtml(line)}</div>`).join("");
}

/** 与 tts-audio-engine 的 to_slug() 及 Memory App 的 MTDeckAudioIndex.slug 逐条一致。 */
function toSlug(str) {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim()
    .replace(/[*=_~`#]/g, "")
    .replace(/['’`]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/** someone's 类短语的录音按 someone_s 命名, 两种都试。 */
function slugVariants(text) {
  const s = toSlug(text);
  if (!s) return [];
  const out = [s];
  if (s.includes("_s_") || s.endsWith("_s")) out.push(s.replace(/_s_/g, "_someone_s_").replace(/_s$/g, "_someone_s"));
  return out;
}

/** 听写判分用: 忽略大小写, 忽略空格与连字符的差别 (well known = well-known), 弯引号当直引号。 */
const spellKey = (s) => (s || "")
  .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
  .replace(/[\s\-\u2010-\u2014]+/g, "").toLowerCase();

const baseName = (path) => (path || "").split("/").pop().replace(/\.md$/i, "");
const folderOf = (path) => (path || "").split("/").slice(0, -1).join(" / ");

module.exports = {
  splitRow, isSeparator, isTableLine, stripComments, brToNewline, stripTags, decodeEntities,
  escapeHtml, isPhonetic, plain, multiline, meaningHtml, englishHtml, phraseHtml, exampleWords, memoryHtml, splitMemory, splitParts, memoryPart, toSlug, slugVariants, baseName, folderOf, spellKey,
};

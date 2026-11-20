const { LEADING_BREAKS, firstLine, normalize, splitCells } = require("./dom");
const { articleNotePath, isPluginExcludedNote, listeningNotePath } = require("../shared/notes");

const CENTRAL_WORD_ROOT = "02. word/b. 剑雅阅读真题/";

const LISTENING_WORD_ROOT = "02. word/m. 剑雅听力真题/";

function listeningMetadata(cell) {
  const tag = String(cell || "").match(/<span\b[^>]*\bclass="hd-listening-source"[^>]*>/)?.[0] || "";
  const decode = value => value.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const source = decode(tag.match(/\bdata-source="([^"]*)"/)?.[1] || "");
  const forms = decode(tag.match(/\bdata-forms="([^"]*)"/)?.[1] || "");
  return { sourcePath: listeningNotePath(source) ? source : "", forms: forms.split(";").map(normalize).filter(Boolean) };
}

function listeningSectionSource(title) {
  return listeningNotePath(`05. listening/${title.replace(/\.md$/i, "")}.md`);
}

const CENTRAL_CONTEXT_PHRASE_ROOT = "03. phrase/未整理短语.md";

const CENTRAL_PHRASE_ROOT = "03. phrase/a. 剑雅通用短语/";

function libraryKind(path) {
  const relative = (path || "").replace(/^a\. language\//, "");
  return relative.startsWith("02. word/") ? "word"
    : relative.startsWith(CENTRAL_CONTEXT_PHRASE_ROOT) ? "context"
    : relative.startsWith("03. phrase/") ? "phrase" : "";
}

function libraryPriority(path) {
  const relative = (path || "").replace(/^a\. language\//, "");
  return relative.startsWith(CENTRAL_WORD_ROOT) ? 0
    : relative.startsWith(CENTRAL_CONTEXT_PHRASE_ROOT) ? 1
    : relative.startsWith(CENTRAL_PHRASE_ROOT) ? 2
    : libraryKind(path) === "word" ? 3 : 4;
}

function headwordOf(cell) {
  return normalize(firstLine(cell));
}

// The hidden detail column: 拆解 in vocabulary tables, or 释义 in phrase /
// grammar / listening tables (`短语 | 短语 | 释义`). Both start with the meaning.
function detailColumn(names) {
  const decomp = names.findIndex((h) => /拆解|英意/.test(h));
  if (decomp >= 0) return decomp;
  return (names[1] === "短语" || names[1] === "意群" || names[0] === "意群") ? names.indexOf("释义") : -1;
}

// 词汇表(`单词 | 释义 | 记忆 | 意群 | 拆解`)的中文释义只存在「释义」列, 记忆锚点只存在「记忆」列;
// 拆解格是 `/音标/<br><br>英文释义`。卡片的渲染链路按「音标 / 中文释义 / 记忆锚点 / 英文释义」四段读,
// 所以在读入时把释义列、记忆列依次插回音标之后。
function composeDecomp(meaning, decomp, memory) {
  // 释义列词性之间的空行只是版式, 合并时收成单换行, 免得被当成下一块; 卡片按词性自行留白。
  const flatMeaning = (meaning || "").replace(/(?:<br\s*\/?>\s*){2,}/gi, "<br>");
  const inserts = [flatMeaning, memory].map((s) => (s || "").trim()).filter(Boolean);
  if (!inserts.length) return decomp;
  const parts = (decomp || "").split(/<br\s*\/?>\s*<br\s*\/?>/).map((p) => p.trim()).filter(Boolean);
  const at = parts.length && /^\/[^/]+\/$/.test(parts[0]) ? 1 : 0;
  parts.splice(at, 0, ...inserts);
  return parts.join("<br><br>");
}

function parseTables(content, path) {
  if (isPluginExcludedNote(path)) return [];
  const entries = [];
  const lines = content.split("\n");
  const listeningLibrary = (path || "").replace(/^a\. language\//, "").startsWith(LISTENING_WORD_ROOT);
  let sectionSource = "";
  for (let i = 0; i + 1 < lines.length; i++) {
    // 听力集中表按文章分节: `# 02. 咨询办理/Accommodation Options` 即来源 05. listening/….md
    const heading = listeningLibrary && lines[i].match(/^#\s+(.+?)\s*$/);
    if (heading) sectionSource = listeningSectionSource(heading[1]);
    if (!lines[i].trim().startsWith("|") || !/^\s*\|\s*:?-{3,}/.test(lines[i + 1])) continue;
    const header = splitCells(lines[i]).map((h) => h.replace(/[\*=_`]/g, "").trim());
    const wordIdx = header[0] === "意群" ? 1 : 0; // 意群列在首列时词在第 2 列
    const decompCol = detailColumn(header) >= 0 ? detailColumn(header)
      : (libraryKind(path) || articleNotePath(path)) && /单词|答案词|短语|词块|考点词|^表达$/.test(header[wordIdx]) ? header.indexOf("释义") : -1;
    if (decompCol < 0) continue;
    const isMeaning = header[decompCol] === "释义";
    const meaningCol = !isMeaning && header.some((h) => /拆解|英意/.test(h)) ? header.indexOf("释义") : -1;
    const memoryCol = !isMeaning && header.some((h) => /拆解|英意/.test(h)) ? header.indexOf("记忆") : -1;
    const chunkCol = header.findIndex((h, i) => i !== wordIdx && (h === "短语" || h === "意群"));
    const phCol = isMeaning ? -1 : header.indexOf("音标");
    const synCol = header.indexOf("同义词");
    let j = i + 2;
    for (; j < lines.length && lines[j].trim().startsWith("|"); j++) {
      const cells = splitCells(lines[j]);
      const word = headwordOf(cells[wordIdx] || "");
      let decomp = (cells[decompCol] || "").replace(LEADING_BREAKS, "");
      if (meaningCol >= 0 || memoryCol >= 0) {
        decomp = composeDecomp(meaningCol >= 0 ? cells[meaningCol] : "", decomp, memoryCol >= 0 ? cells[memoryCol] : "");
      }
      if (!word) continue;
      const keys = new Set([word]);
      const chunk = chunkCol >= 0 ? cells[chunkCol] || "" : "";
      for (const m of chunk.matchAll(/\*\*(.+?)\*\*/g)) keys.add(normalize(m[1]));
      const listening = listeningMetadata(cells[wordIdx]);
      if (!listening.sourcePath && sectionSource) listening.sourcePath = sectionSource;
      // 听力笔记自己的单词表与短语表: 来源即本篇。
      if (!listening.sourcePath && listeningNotePath(path)) listening.sourcePath = listeningNotePath(path);
      if (listening.sourcePath) {
        for (const form of [...word.split(/\s*\/\s*/), ...listening.forms]) keys.add(normalize(form));
      }
      let ph = phCol >= 0 ? (cells[phCol] || "").replace(/^\/|\/$/g, "").trim() : "";
      if (!ph && cells[wordIdx] && cells[wordIdx].includes("<br>")) {
        const parts = cells[wordIdx].split(/<br\s*\/?>/i);
        if (parts.length > 1 && parts[1].trim().startsWith("/")) {
          ph = parts[1].replace(/^\/|\/$/g, "").trim();
        }
      }
      if (!ph && decomp) {
        const dparts = decomp.split(/<br\s*\/?>\s*<br\s*\/?>/);
        for (const part of dparts) {
          const trimmed = part.trim();
          if (trimmed.startsWith("/") && trimmed.endsWith("/")) {
            ph = trimmed.replace(/^\/|\/$/g, "").trim();
            break;
          }
        }
      }
      const syn = synCol >= 0 ? (cells[synCol] || "").trim() : "";
      entries.push({ word, chunk: normalize(chunk), decomp, keys, path, isMeaning, ph, ...(syn ? { syn } : {}),
        ...(listening.sourcePath ? { sourcePath: listening.sourcePath,
          chunkText: chunk.replace(/\*\*|==/g, "").replace(/<br\s*\/?>/gi, " ").trim() } : {}) });
    }
    i = j - 1;
  }
  return entries;
}

// Cheap lemma guesses for when the highlight's form is not bolded in any 短语.
function candidates(text) {
  const t = normalize(text);
  const out = [t];
  const add = (s) => s && s.length > 1 && !out.includes(s) && out.push(s);
  const contractions = /^(?:it|that|there|here|what|who|where|when|how|let|he|she)['’]s$/;
  if (/['’]s$/.test(t) && !contractions.test(t)) {
    for (const form of candidates(t.slice(0, -2))) add(form);
  } else if (/s['’]$/.test(t)) {
    for (const form of candidates(t.slice(0, -1))) add(form);
  }
  const irregular = { bore: "bear", borne: "bear", clung: "cling", dwelt: "dwell", dug: "dig", laid: "lay", bred: "breed", fed: "feed", foresaw: "foresee", foreseen: "foresee", grew: "grow", grown: "grow", shook: "shake", shaken: "shake", sought: "seek", caught: "catch", taught: "teach", thought: "think", brought: "bring", found: "find", ground: "grind", froze: "freeze", frozen: "freeze", arose: "arise", arisen: "arise", withdrew: "withdraw", withdrawn: "withdraw", swelled: "swell", swollen: "swell", sank: "sink", sunk: "sink", swung: "swing", threw: "throw", thrown: "throw", lay: "lie", lain: "lie", wrote: "write", written: "write", took: "take", taken: "take", went: "go", gone: "go", made: "make", ran: "run", rose: "rise", risen: "rise" };
  add(irregular[t]);
  // Genuine inflections only; -ly and other derivations need their own entries.
  add(({ mice: "mouse", children: "child", men: "man", women: "woman", teeth: "tooth", feet: "foot",
    geese: "goose", oxen: "ox", phenomena: "phenomenon", criteria: "criterion", stimuli: "stimulus",
    hypotheses: "hypothesis", knives: "knife", wives: "wife", calves: "calf",
    overtook: "overtake", overtaken: "overtake", spun: "spin", stuck: "stick", misled: "mislead", woven: "weave", wove: "weave", felt: "feel", sawn: "saw", done: "do", did: "do", duly: "due", blown: "blow", blew: "blow", bacteria: "bacterium", rebuilt: "rebuild", drawn: "draw", drew: "draw",
    spoilt: "spoil", rethought: "rethink", fishermen: "fisherman" })[t]);
  // 文章高亮的副词常指向形容词词头: rapidly→rapid, steadily→steady, dramatically→dramatic, regrettably→regrettable。
  if (!/\s/.test(t) && t.length > 4 && t.endsWith("ly")) {
    if (t.endsWith("tly") || t.endsWith("bly") || t.endsWith("ply")) add(t.slice(0, -1) + "e");
    if (t.endsWith("ically")) add(t.slice(0, -4));
    if (t.endsWith("ily")) add(t.slice(0, -3) + "y");
    if (t.endsWith("ably") || t.endsWith("ibly")) add(t.slice(0, -1) + "e");
    add(t.slice(0, -2));
  }
  if (t.endsWith("ies") || t.endsWith("ied")) add(t.slice(0, -3) + "y");
  if (t.endsWith("es")) add(t.slice(0, -2));
  if (t.endsWith("s")) add(t.slice(0, -1));
  if (t.endsWith("ed")) {
    add(t.slice(0, -2));
    add(t.slice(0, -1));
  }
  if (t.endsWith("ing")) {
    // emphasising → emphasise 先于 emphasis; 词表里只有一个时两种都能命中。
    if (/[sczv]ing$/.test(t)) add(t.slice(0, -3) + "e");
    add(t.slice(0, -3));
    add(t.slice(0, -3) + "e");
  }
  for (const s of out.slice(1)) if (/([b-df-hj-np-tv-z])\1$/.test(s)) add(s.slice(0, -1));
  return out;
}

function cellHeadword(cell) {
  const clone = cell.cloneNode(true);
  clone.querySelectorAll("button, .clickable-icon").forEach((b) => b.remove());
  const first = firstLine(clone.innerHTML);
  const div = document.createElement("div");
  div.innerHTML = first;
  return (div.textContent || "").trim();
}

module.exports = { listeningSectionSource, CENTRAL_WORD_ROOT, LISTENING_WORD_ROOT, listeningMetadata, CENTRAL_CONTEXT_PHRASE_ROOT, CENTRAL_PHRASE_ROOT, libraryKind, libraryPriority, headwordOf, detailColumn, composeDecomp, parseTables, candidates, cellHeadword };

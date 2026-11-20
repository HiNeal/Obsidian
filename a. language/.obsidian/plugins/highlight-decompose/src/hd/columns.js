const { cellMarkdown, headerText } = require("./dom");
const { appendMeaningInline } = require("./reading");

// Moves everything from the first <br><br> of a phrase cell into a hidden span.
// Text is moved, not removed, so table-sound still reads the headword (it splits
// innerHTML at the first <br>) and the cell's textContent is unchanged.
function hidePhraseMeaning(cell) {
  const root = cell.querySelector(":scope > .table-cell-wrapper") || cell;
  if (root.querySelector(".hd-phrase-meaning, .cm-editor")) return;
  const first = firstDoubleBreak(root);
  if (!first || !root.lastChild) return;
  const before = document.createRange();
  before.setStart(root, 0);
  before.setEndBefore(first);
  if (!before.toString().trim()) return;
  const range = document.createRange();
  range.setStartBefore(first);
  range.setEndAfter(root.lastChild);
  const span = document.createElement("span");
  span.className = "hd-phrase-meaning";
  span.appendChild(range.extractContents());
  root.appendChild(span);
}

function hideWordCellPhonetic(cell) {
  const root = cell.querySelector(":scope > .table-cell-wrapper") || cell;
  if (root.querySelector(".hd-cell-phonetic, .cm-editor")) return;
  const br = root.querySelector("br");
  if (!br) return;
  let next = br.nextSibling;
  while (next && next.nodeType === 3 && !next.nodeValue.trim()) next = next.nextSibling;
  if (!next || (next.nodeType === 3 && !next.nodeValue.trim().startsWith("/"))) return;

  const range = document.createRange();
  range.setStartBefore(br);
  range.setEndAfter(root.lastChild);
  const span = document.createElement("span");
  span.className = "hd-cell-phonetic";
  span.appendChild(range.extractContents());
  root.appendChild(span);
}

const BASE_FILE = /(^|\/)01\. base\/[xyz]\.word-[a-z]+\.md$/;

// The first <br> of the first <br><br> in a cell's content root, if any.
function firstDoubleBreak(root) {
  return Array.from(root.querySelectorAll("br")).find((br) => {
    let next = br.nextSibling;
    while (next && next.nodeType === 3 && !next.nodeValue.trim()) next = next.nextSibling;
    return next && next.nodeName === "BR";
  });
}

// Base 例子 cell: `释义<br><br>例词` — hide 释义 and the <br><br> after it.
function hideLeadingMeaning(cell) {
  const root = cell.querySelector(":scope > .table-cell-wrapper") || cell;
  if (root.querySelector(".hd-phrase-meaning, .cm-editor")) return;
  const first = firstDoubleBreak(root);
  if (!first) return;
  let second = first.nextSibling;
  while (second.nodeName !== "BR") second = second.nextSibling;
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEndAfter(second);
  if (!range.toString().trim()) return;
  const span = document.createElement("span");
  span.className = "hd-phrase-meaning";
  span.appendChild(range.extractContents());
  root.prepend(span);
  hideExampleMeanings(root);
  joinExamples(root);
}

// Several examples on one line: each <br> run between them becomes a space.
function joinExamples(root) {
  let seenText = false;
  let run = [];
  const flush = (more) => {
    if (!run.length) return;
    run.forEach((br) => br.classList.add("hd-br-hidden"));
    if (seenText && more) run[run.length - 1].after(createSpan({ cls: "hd-br-space", text: " " }));
    run = [];
  };
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeName === "BR") {
      run.push(node);
      continue;
    }
    const hidden = node.classList && (node.classList.contains("hd-phrase-meaning") || node.classList.contains("hd-ex-meaning"));
    if (hidden || !node.textContent.trim()) continue;
    flush(true);
    seenText = true;
  }
  flush(false);
}

// `apathy  n.冷漠` → keep `apathy`, hide `  n.冷漠` (data-word remembers `apathy`).
function hideExampleMeanings(root) {
  let word = "";
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeName === "BR") {
      word = "";
      continue;
    }
    if (node.nodeType !== 3) {
      if (!(node.classList && node.classList.contains("hd-phrase-meaning"))) word += node.textContent;
      continue;
    }
    const m = node.nodeValue.match(/^([\s\S]*?)(\s{2,})(\S[\s\S]*)$/);
    if (!m) {
      word += node.nodeValue;
      continue;
    }
    word += m[1];
    const meaning = createSpan({ cls: "hd-ex-meaning", text: m[2] + m[3] });
    meaning.dataset.word = word.trim();
    node.nodeValue = m[1];
    node.after(meaning);
    word = "";
  }
}

const QTYPE = /^[(（]\s*([^()（）]*[\u4e00-\u9fa5][^()（）]*?)\s*[)）]$/;

// Visible text before / after a <br>, ignoring the hidden 题型 labels.
function textAround(root, br) {
  let before = "";
  let after = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement.closest(".hd-qtype")) continue;
    if (br.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING) before += node.nodeValue;
    else after += node.nodeValue;
  }
  return [before.trim(), after.trim()];
}

// "(判断题)" lines in a 短语 cell are hidden and shown in the card instead.
function hideQuestionTypes(root) {
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType !== 3 || !QTYPE.test(node.nodeValue.trim())) continue;
    const span = createSpan({ cls: "hd-qtype" });
    node.replaceWith(span);
    span.appendChild(node);
  }
}

// Leading/trailing <br>s are hidden; a lone inner <br> becomes a space; runs of
// two or more (the separator between several examples) are kept.
function flattenChunk(cell) {
  const root = cell.querySelector(":scope > .table-cell-wrapper") || cell;
  if (root.hasAttribute("data-hd-flat") || root.querySelector(".cm-editor")) return;
  root.setAttribute("data-hd-flat", "");
  hideQuestionTypes(root);
  const brs = Array.from(root.querySelectorAll("br"));
  const runs = [];
  for (const br of brs) {
    const last = runs[runs.length - 1];
    let prev = br.previousSibling;
    while (prev && prev.nodeType === 3 && !prev.nodeValue.trim()) prev = prev.previousSibling;
    if (last && prev === last[last.length - 1]) last.push(br);
    else runs.push([br]);
  }
  for (const run of runs) {
    const [beforeText, afterText] = textAround(root, run[0]);
    const edge = !beforeText || !afterText;
    if (!edge && run.length > 1) continue;
    for (const br of run) br.classList.add("hd-br-hidden");
    if (!edge) run[0].after(createSpan({ cls: "hd-br-space", text: " " }));
  }
}

function markBaseTable(table) {
  const headers = Array.from(table.querySelector("thead tr, tr").querySelectorAll("th, td"));
  if (headers.length !== 2 || headerText(headers[1]) !== "例子") return;
  table.classList.add("hd-base-table");
  for (const row of table.querySelectorAll("tr")) {
    if (row.cells.length < 2 || row.cells[0].tagName !== "TD") continue;
    row.classList.add("hd-row");
    hideLeadingMeaning(row.cells[1]);
  }
}

// 词表末尾的「评分」列 (0–5, memory-cards 写入) 只给插件读, 显示层一律隐藏。
const SCORE_HEADER = "评分";
// 「同义词」列同样只在悬浮卡片显示, 与评分列一起隐藏。
const HIDDEN_HEADERS = [SCORE_HEADER, "同义词"];

// Which columns a table hides behind the card, by header; null = not handled.
// 判断表型时不把评分列算进列数, 否则 `X | 释义 | 评分` 不再被识别成两列释义表。
function hiddenColumnsFor(headers) {
  const names = headers.map(headerText).filter((n) => !HIDDEN_HEADERS.includes(n));
  // 现代词表含意群或拆解时, 释义列是正常展示列, 拆解列由后面的 isVocab 逻辑单独隐藏
  if (names.includes("意群") || names.some((n) => /拆解|英意/.test(n)) || names.includes("短语")) return null;
  if (names.length === 2 && names[1] === "释义") return [1];
  return null;
}

// Hidden cells are still in the DOM, so themes keep drawing the right edge and
// right-hand corners on the real :last-child. Mark the last visible cell instead.
function markHiddenColumns(table, hidden) {
  const headerRow = table.querySelector("thead tr, tr");
  const headerCells = headerRow ? Array.from(headerRow.querySelectorAll("th, td")) : [];
  headerCells.forEach((cell, i) => {
    if (HIDDEN_HEADERS.includes(headerText(cell)) && !hidden.includes(i)) hidden = [...hidden, i];
  });
  for (const row of table.querySelectorAll("tr")) {
    const cells = Array.from(row.querySelectorAll("th, td"));
    const visible = cells.filter((_, i) => !hidden.includes(i));
    const last = visible[visible.length - 1];
    cells.forEach((cell, i) => {
      cell.classList.toggle("hd-hidden-col", hidden.includes(i));
      cell.classList.toggle("hd-visible-last", cell === last && hidden.some(j => j > i));
    });
  }
}

function detailBlocks(text) {
  return String(text || "").split(/<br\s*\/?>\s*<br\s*\/?>/i)
    .map(part => part.trim()).filter(Boolean);
}

// 释义列的不同词性之间空一行(`n. …<br><br>v. …`): 首个非音标块后面紧跟的词性块都属于释义。
const POS_BLOCK = /^(?:n|v|adj|adv|prep|conj|pron|int|det|num|abbr|exclam|prefix|suffix|phr)\.\s*/;
function definitionOnly(text) {
  const blocks = detailBlocks(text);
  const start = blocks.findIndex(part => !/^\/[^/]+\/$/.test(part));
  if (start < 0) return "";
  let end = start + 1;
  while (end < blocks.length && POS_BLOCK.test(blocks[end])) end++;
  return blocks.slice(start, end).join("<br><br>");
}

// Keep native cells and source text intact: table editing, audio and cards still
// read the original columns. Only the mobile display uses this projection.
function markMobileDefinitions(table, headers, meaningCol, wordCol = 0) {
  table.classList.add("hd-mobile-table");
  markHiddenColumns(table, headers.map((_, i) => i).filter(i => i !== wordCol && i !== meaningCol));
  for (const row of table.querySelectorAll("tr")) {
    const cell = row.cells[meaningCol];
    if (!cell) continue;
    const heading = cell === headers[meaningCol];
    const meaning = heading ? "" : definitionOnly(cellMarkdown(cell));
    let source = cell.querySelector(":scope > .table-cell-wrapper, :scope > .hd-mobile-source");
    if (!source) {
      source = document.createElement("span");
      source.className = "hd-mobile-source";
      source.append(...cell.childNodes);
      cell.appendChild(source);
    }
    cell.classList.add("hd-mobile-definition");
    if (heading) {
      cell.dataset.hdMobileLabel = "释义";
      continue;
    }
    let display = cell.querySelector(":scope > .hd-mobile-meaning");
    if (!display) {
      display = document.createElement("span");
      display.className = "hd-mobile-meaning";
      cell.appendChild(display);
    }
    if (display.dataset.meaning === meaning) continue;
    display.dataset.meaning = meaning;
    display.replaceChildren();
    meaning.split(/<br\s*\/?>/i).forEach((line, i) => {
      if (i) display.appendChild(document.createElement("br"));
      appendMeaningInline(display, line);
    });
  }
}

// 第二列的「释义」模式（设置 → 单词表第二列）。短语内容包进可隐藏的源容器，释义写进
// 单元格属性，由 CSS ::after 在 body.hd-second-column-meaning 下显示。属性不是正文，
// 不改变 textContent 与 innerHTML 的文字，音频与行键的读取不受影响。
function wrapChunkSource(cell) {
  if (cell.querySelector(":scope > .table-cell-wrapper, :scope > .hd-chunk-source") || cell.querySelector(".cm-editor")) return;
  const source = document.createElement("span");
  source.className = "hd-chunk-source";
  // 耳机按钮留在外面，两种模式下都可点。
  source.append(...Array.from(cell.childNodes).filter(node => !(node.nodeType === 1 && node.matches("button, .audio-playback-btn"))));
  cell.appendChild(source);
}

function meaningText(cell) {
  return definitionOnly(cellMarkdown(cell))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*|==/g, "")
    .trim();
}

function markChunkMeaning(table, headerRow, chunkCol, decompCol) {
  table.classList.add("hd-meaning-table");
  for (const row of table.querySelectorAll("tr")) {
    const chunk = row.cells[chunkCol];
    if (!chunk) continue;
    wrapChunkSource(chunk);
    if (row === headerRow) {
      chunk.classList.add("hd-chunk-meaning-head");
      chunk.dataset.hdMeaningLabel = "释义";
      continue;
    }
    if (!row.cells[decompCol]) continue;
    chunk.classList.add("hd-chunk-meaning-cell");
    chunk.dataset.hdMeaning = meaningText(row.cells[decompCol]);
  }
}

function markColumnTable(table, hidden) {
  table.classList.add("hd-column-table");
  markHiddenColumns(table, hidden);
  table.dataset.hdHidden = hidden.join(",");
  for (const row of table.querySelectorAll("tr")) {
    if (row.cells[0] && row.cells[0].tagName === "TD") row.classList.add("hd-row");
  }
}

module.exports = { SCORE_HEADER, hidePhraseMeaning, hideWordCellPhonetic, BASE_FILE, firstDoubleBreak, hideLeadingMeaning, joinExamples, hideExampleMeanings, QTYPE, textAround, hideQuestionTypes, flattenChunk, markBaseTable, hiddenColumnsFor, markHiddenColumns, detailBlocks, definitionOnly, markMobileDefinitions, markColumnTable, markChunkMeaning };

const { Platform } = require("obsidian");
const { BASE_FILE, flattenChunk, hiddenColumnsFor, hidePhraseMeaning, hideWordCellPhonetic, markBaseTable, markChunkMeaning, markColumnTable, markHiddenColumns } = require("./columns");
const { headerText, wordColumnIndex } = require("./dom");
const { detailColumn, libraryKind } = require("./library");
const { articleNotePath, isPluginExcludedNote } = require("../shared/notes");

// 阅读、听力文章里的 `# 单词` / `# 短语` 表按 02. word / 03. phrase 的词表规则显示; 源码不变。
function displayPath(path, firstHeader) {
  if (!articleNotePath(path)) return path;
  if (firstHeader === "单词" || firstHeader === "答案词") return "02. word/__article__.md";
  if (firstHeader === "短语" || firstHeader === "表达") return "03. phrase/__article__.md";
  return path;
}

function markBaseExampleTable(table) {
  const headerRow = table.querySelector("thead tr, tr");
  if (!headerRow) return;
  const headers = Array.from(headerRow.querySelectorAll("th, td")).map(headerText);
  // Overview tables remain untouched. Read only the current row's third cell.
  const visibleHeaders = headers.filter(name => name !== "评分" && name !== "同义词");
  if (visibleHeaders.length !== 3 || headers[1] !== "释义" || headers[2] !== "例子") return;
  table.classList.add("hd-base-examples-table");
  markHiddenColumns(table, [2]);
  for (const row of table.querySelectorAll("tbody tr")) {
    if (row.cells.length === headers.length && row.cells[0].tagName === "TD") row.classList.add("hd-row");
  }
}

// Only word-library tables move their context into the card; grammar stays intact.
// 短语库(03. phrase/, 含未整理短语)的「意群」列直接显示在表格里, 不进卡片。
function contextCardColumn(names, path) {
  path = displayPath(path, names[0]);
  if (libraryKind(path) !== "word" || !names.includes("释义")) return -1;
  const word = names[0] === "意群" ? 1 : 0;
  return names.findIndex((name, i) => i !== word && (name === "意群" || name === "短语"));
}

function markContextCard(table, names, path, hidden) {
  const context = contextCardColumn(names, path);
  table.classList.toggle("hd-context-card", context >= 0);
  if (context < 0) return hidden;
  table.classList.add("hd-meaning-visible");
  return [...new Set([...hidden.filter(i => names[i] !== "释义"), context])];
}

// 手机端只显示词头与释义两列。音标列(第二列, 显示层始终隐藏)存在时, 释义列后移, 不能再按「前两列」取。
function mobileHiddenColumns(headers) {
  const names = headers.map(headerText);
  const keep = new Set([0, names[1] === "音标" && names.includes("释义") ? names.indexOf("释义") : 1]);
  return names.map((_, i) => i).filter(i => !keep.has(i));
}

function markTable(table, path) {
  if (isPluginExcludedNote(path)) return markBaseExampleTable(table);
  const headerRow = table.querySelector("thead tr, tr");
  if (!headerRow) return;
  if (BASE_FILE.test(path)) return markBaseTable(table);
  path = displayPath(path, headerText(headerRow.querySelector("th, td") || {}));
  // 短语库保留可见释义, 词头挂载与单词表相同的高亮按钮。
  if ((path || "").replace(/^a\. language\//, "").startsWith("03. phrase/")) {
    table.classList.add("hd-meaning-visible");
    const headers = Array.from(headerRow.querySelectorAll("th, td"));
    const wordCol = wordColumnIndex(table);
    if (["短语", "表达"].includes(headerText(headers[wordCol] || {}))) {
      table.classList.add("hd-phrase-library");
      for (const row of table.querySelectorAll("tbody tr")) {
        if (row.cells[wordCol]?.tagName !== "TD") continue;
        row.classList.add("hd-row");
        row.cells[wordCol].classList.add("hd-word-cell");
      }
    }
    const hidden = Platform.isMobile ? headers.map((_, i) => i).filter(i => i > 1) : [];
    markHiddenColumns(table, markContextCard(table, headers.map(headerText), path, hidden));
    return;
  }
  const headers = Array.from(headerRow.querySelectorAll("th, td"));
  const hidden = hiddenColumnsFor(headers);
  if (hidden) {
    markColumnTable(table, Platform.isMobile ? headers.map((_, i) => i).filter(i => i > 1) : hidden);
    return;
  }
  const decompCol = detailColumn(headers.map(headerText));
  const wordCol = wordColumnIndex(table);
  const chunkCol = headers.findIndex((h, i) => i !== wordCol && (headerText(h) === "短语" || headerText(h) === "意群"));
  // 其余表型不做卡片处理, 但评分列仍要隐藏
  if (chunkCol < 0) return markHiddenColumns(table, []);
  const isVocab = decompCol >= 0;
  const isPhrase = !isVocab && chunkCol >= 0;
  if (!isVocab && !isPhrase) return markHiddenColumns(table, []);
  table.classList.add(isVocab ? "hd-decomp-table" : "hd-phrase-table");
  const phCol = headers.findIndex((h) => headerText(h) === "音标");
  const hiddenColumns = Platform.isMobile ? mobileHiddenColumns(headers)
    : isVocab ? (phCol >= 0 ? [decompCol, phCol] : [decompCol]) : [];
  markHiddenColumns(table, markContextCard(table, headers.map(headerText), path, hiddenColumns));
  for (const row of table.querySelectorAll("tr")) {
    const cells = row.querySelectorAll("th, td");
    if (!cells[0] || cells[0].tagName !== "TD") continue;
    row.classList.add("hd-row");
    if (cells[wordCol]) cells[wordCol].classList.add("hd-word-cell");
    if (isVocab) hideWordCellPhonetic(cells[wordCol]);
    if (isPhrase) hidePhraseMeaning(cells[wordCol]);
    if (cells[chunkCol]) flattenChunk(cells[chunkCol]);
  }
  // 必须在 flattenChunk 之后：包装会移动子节点，先包装会打乱短语的换行处理。
  const hasExplicitMeaning = headers.some((h) => headerText(h) === "释义");
  if (isVocab && !Platform.isMobile && !hasExplicitMeaning) markChunkMeaning(table, headerRow, chunkCol, decompCol);
}

// 词头高亮由评分生成: 末列「评分」≥ 1 的词条, 词头文字在渲染层套 .hd-score-mark, 源码里不再写 ==。
const SCORE_HEADER = "评分";
const NON_HEAD = ".audio-playback-btn, .hd-promote, button, .cm-editor, .hd-cell-phonetic";

function scoreOf(cell) {
  const text = (cell && cell.textContent || "").trim();
  return /^\d+$/.test(text) ? Number(text) : 0;
}

function unwrapScoreMark(cell) {
  for (const mark of cell.querySelectorAll(".hd-score-mark")) mark.replaceWith(...mark.childNodes);
  cell.normalize();
}

// 词头 = 第一个换行(<br>)之前的内联内容, 按钮、音标等不算。
function wrapScoreMark(cell) {
  const host = cell.querySelector(":scope > .table-cell-wrapper") || cell;
  if (host.querySelector(":scope > .hd-score-mark")) return;
  const nodes = [];
  for (const node of Array.from(host.childNodes)) {
    if (node.nodeName === "BR") break;
    if (node.nodeType === 1 && node.matches(NON_HEAD)) continue;
    if (node.nodeType === 1 && node.matches(".hd-br-space")) break;
    if (node.nodeType === 3 && !node.textContent.trim()) continue;
    nodes.push(node);
  }
  if (!nodes.length) return;
  const mark = document.createElement("span");
  mark.className = "hd-score-mark";
  nodes[0].before(mark);
  mark.append(...nodes);
}

function markScoreHighlight(table) {
  const headerRow = table.querySelector("thead tr, tr");
  if (!headerRow) return;
  const scoreCol = Array.from(headerRow.cells).map(headerText).indexOf(SCORE_HEADER);
  if (scoreCol < 0) return;
  const wordCol = wordColumnIndex(table);
  for (const row of table.querySelectorAll("tbody tr")) {
    const cell = row.cells[wordCol];
    if (!cell || cell.tagName !== "TD" || cell.querySelector(".cm-editor")) continue;
    const scored = scoreOf(row.cells[scoreCol]) >= 1;
    cell.classList.toggle("hd-scored", scored);
    if (scored) wrapScoreMark(cell);
    else unwrapScoreMark(cell);
  }
}

module.exports = { markBaseExampleTable, markTable, markScoreHighlight, contextCardColumn };

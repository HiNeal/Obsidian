const { setIcon } = require("obsidian");
const { HEADPHONES_SVG, PLUGIN_OWNED_SELECTOR } = require("./constants");

function createAudioBtn(titleText, onClickHandler) {
  const btn = document.createElement("span");
  btn.className = "audio-playback-btn";
  try {
    if (typeof setIcon === "function") {
      setIcon(btn, "headphones");
    } else {
      btn.innerHTML = HEADPHONES_SVG;
    }
  } catch (e) {
    btn.innerHTML = HEADPHONES_SVG;
  }
  btn.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
  });
  btn.addEventListener("click", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onClickHandler();
  });
  return btn;
}

function getAudioBindingText(cell) {
  if (!cell) return "";
  const content = cell.querySelector(":scope > .table-cell-wrapper") || cell;
  return (content.textContent || "").replace(/\s+/g, " ").trim();
}

function fastStringHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

// 短语列的原声接在单词列的播放队列后面，所以要先按列的音频类型把两者配起来。
// 听力表的表头是「短语 | 音义词块」，单词列认不出文字里的“单词”二字，
// 因此配对只看白名单判出的音频类型，不看表头字面。
function pairChunkColumnWithWord(colTypes) {
  const wordColIndex = Array.isArray(colTypes) ? colTypes.indexOf("word") : -1;
  // 没有单词列的表（例如纯短语切片表）保留短语自己的耳机，否则整表哑掉。
  const chunkColIndex = wordColIndex === -1 ? -1 : colTypes.indexOf("chunk");
  return { wordColIndex, chunkColIndex };
}

function getAudioBindingKey(cell, type, context) {
  const wordText = context && context.wordCell ? getAudioBindingText(context.wordCell) : "";
  // 单词格会接着播本行短语原声，所以短语文字变了也必须重新绑定，
  // 否则旧闭包会一直指向上一段切片。
  const chunkText = context && context.chunkCell ? getAudioBindingText(context.chunkCell) : "";
  return fastStringHash(
    `${type}\u241f${getAudioBindingText(cell)}\u241f${wordText}\u241f${chunkText}`
  );
}

// 与 hd/dom.js 的 headerText 相同: 选中整列时表头会多出一个编辑器副本, 只读原始 wrapper。
function normalizeHeaderText(headerCell) {
  if (!headerCell) return "";
  const wrapper = headerCell.querySelector(":scope > .table-cell-wrapper");
  return ((wrapper || headerCell).textContent || "")
    .replace(/[\*_~`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// 词条列表头的第三种写法：以「短语」收尾。
// 题目短语 / 原文通用短语 / 原文语境短语 / 逻辑短语的「短语」都算，
// 它们和词书的「单词」列是同一种东西——词头 + 释义，同样挂耳机。
// 必须是收尾而不是包含：规则文档里的「典型短语与功能示例」「短语动词」
// 是讲解列和分组名，不是词条列，一旦放行整列会平白多出耳机。
function isPhraseHeaderText(text) {
  return /短语$/.test(text);
}

function getDefinitionContentRoot(cell) {
  if (!cell) return null;
  // 调用方也可能传进纯文本桩（单元测试）或文本节点，没有 querySelector，原样返回。
  if (typeof cell.querySelector !== "function") return cell;
  return cell.querySelector(":scope > .table-cell-wrapper") || cell;
}

function isPluginOwnedNode(node) {
  if (!node) return false;
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!element || typeof element.closest !== "function") return false;
  // 连「插件节点的子节点」一起认：setIcon 是往自家 span 里换 <svg>，那也会作为
  // 新增节点报上来。只认自身的话，每换一次图标就白跑一轮整表更新。
  return Boolean(element.closest(PLUGIN_OWNED_SELECTOR));
}

// 该回调在滚动时每帧同步执行，必须保持廉价：不展开数组、命中即短路。
function mutationHasExternalDomChange(mutation) {
  for (const node of mutation.addedNodes) {
    if (!isPluginOwnedNode(node)) return true;
  }
  for (const node of mutation.removedNodes) {
    if (!isPluginOwnedNode(node)) return true;
  }
  return false;
}

function collectTablesFromNode(node, contentRoot, tables) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
  const element = node;
  // 已脱离文档的节点（如被移除的行）无需扫描，其影响由仍在文档中的 target 覆盖。
  if (!contentRoot.contains(element)) return;
  // 节点本身就在某个表格内时，直接归位，省掉一次全子树 querySelectorAll。
  const parentTable = element.closest("table");
  if (parentTable) {
    tables.add(parentTable);
    return;
  }
  for (const table of element.querySelectorAll("table")) tables.add(table);
}

function collectChangedTables(mutations, contentRoot) {
  const tables = new Set();
  for (const mutation of mutations) {
    collectTablesFromNode(mutation.target, contentRoot, tables);
    for (const node of mutation.addedNodes) collectTablesFromNode(node, contentRoot, tables);
    // removedNodes 已脱离文档，contains() 必为 false，遍历它们纯属浪费。
  }
  return tables;
}

function getDataRows(table) {
  const tbodyRows = table.querySelectorAll("tbody tr");
  if (tbodyRows && tbodyRows.length > 0) {
    return Array.from(tbodyRows);
  }
  const allRows = Array.from(table.querySelectorAll("tr"));
  return allRows.length > 1 ? allRows.slice(1) : [];
}

function getContentRootOfNode(node) {
  if (!node || !node.closest) return null;
  return node.closest(".markdown-source-view.is-live-preview, .markdown-preview-view");
}

// 词汇表表头: 同时含「短语」与「拆解」。
function isVocabularyHeaderRow(row) {
  if (!row) return false;
  const names = Array.from(row.querySelectorAll("th, td")).map((h) => (h.textContent || "").replace(/[\*_~`#]/g, "").trim());
  return (names.includes("短语") || names.includes("意群")) && names.some((n) => /拆解|英意/.test(n));
}

module.exports = { createAudioBtn, getAudioBindingText, fastStringHash, pairChunkColumnWithWord, getAudioBindingKey, normalizeHeaderText, isPhraseHeaderText, getDefinitionContentRoot, isPluginOwnedNode, mutationHasExternalDomChange, collectTablesFromNode, collectChangedTables, getDataRows, getContentRootOfNode, isVocabularyHeaderRow };

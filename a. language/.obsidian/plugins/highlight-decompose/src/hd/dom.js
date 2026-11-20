const HIGHLIGHT_SELECTOR = "mark, .cm-highlight, tr.hd-row";

const hoverElement = (target) => target instanceof Element
  && !target.closest(".hd-tooltip") ? target.closest("tr.hd-row") || target.closest("mark, .cm-highlight") : null;

const PROMOTE_CELL_SELECTOR = ".hd-decomp-table tr.hd-row > td.hd-word-cell, .hd-phrase-library tr.hd-row > td.hd-word-cell, .hd-base-examples-table tr.hd-row > td:first-child";

// 选中整列时 Obsidian 会在表头再挂一个编辑器（原 wrapper 被隐藏但仍在 DOM 里），
// 直接读 textContent 会得到「释义释义」，列名匹配失败，意群列就会被重新露出来。
// 所以只读第一个直接子 wrapper（原始文字）。
const headerText = (cell) => {
  const wrapper = cell.querySelector(":scope > .table-cell-wrapper");
  return ((wrapper || cell).textContent || "").replace(/[\*_~`#]/g, "").trim();
};

// 意群列在首列的表（`意群 | 单词 | 释义 | 拆解`、`意群 | 短语 | 释义`）词在第 2 列，其余表词在第 1 列。
function wordColumnIndex(table) {
  const headerRow = table && table.querySelector ? table.querySelector("thead tr, tr") : null;
  const first = headerRow && headerRow.cells && headerRow.cells[0];
  return first && headerText(first) === "意群" ? 1 : 0;
}

// 这一行的词条格（词头所在格）。
function wordCellOf(row) {
  if (!row || !row.cells) return null;
  const table = row.closest ? row.closest("table") : null;
  return row.cells[wordColumnIndex(table)] || row.cells[0] || null;
}

// Read the current cell, including unsaved edits' static rendering, without
// borrowing cached definitions or serializing editor/button UI into the card.
function cellMarkdown(cell) {
  if (!cell) return "";
  const root = cell.querySelector(":scope > .table-cell-wrapper, :scope > .hd-mobile-source") || cell;
  const read = (node) => {
    if (node.nodeType === 3) return node.nodeValue;
    if (node.nodeType !== 1) return "";
    if (node.matches("button, .audio-playback-btn, .hd-promote, .clickable-icon, .cm-editor")) return "";
    if (node.tagName === "BR") return "<br>";
    const text = Array.from(node.childNodes, read).join("");
    if (node.matches("strong, b")) return `**${text}**`;
    if (node.matches("mark, .cm-highlight")) return `==${text}==`;
    return text;
  };
  return Array.from(root.childNodes, read).join("").trim();
}

// Hit the actual character under the pointer, not the cell's padding or the
// nearest caret (which browsers also return for empty space beside a line).
function pointerHitsText(event, root) {
  const caret = document.caretRangeFromPoint && document.caretRangeFromPoint(event.clientX, event.clientY);
  const node = caret && caret.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE || !root.contains(node)) return false;
  const range = document.createRange();
  for (const offset of [caret.startOffset, caret.startOffset - 1]) {
    if (offset < 0 || offset >= node.length || !/\S/.test(node.nodeValue[offset])) continue;
    range.setStart(node, offset);
    range.setEnd(node, offset + 1);
    for (const rect of range.getClientRects()) {
      if (rect.width > 0 && event.clientX >= rect.left && event.clientX <= rect.right
          && event.clientY >= rect.top && event.clientY <= rect.bottom) return true;
    }
  }
  return false;
}

// 词头格: 只在词头文字本身(含词间空格)的行框内才算命中, 格子留白不算。
function pointerOnText(event, root, pad = 2) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    // .cm-editor 只排除词头格内部嵌套的编辑器; 实时预览里整篇笔记本身就在 .cm-editor 内, 不能按祖先判断。
    acceptNode: (n) => {
      if (!/\S/.test(n.nodeValue) || !n.parentElement) return NodeFilter.FILTER_REJECT;
      if (n.parentElement.closest("button, .audio-playback-btn, .hd-promote, .clickable-icon")) return NodeFilter.FILTER_REJECT;
      const editor = n.parentElement.closest(".cm-editor");
      return editor && root.contains(editor) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.width > 0 && event.clientX >= r.left - pad && event.clientX <= r.right + pad
          && event.clientY >= r.top - pad && event.clientY <= r.bottom + pad) return true;
    }
  }
  return false;
}

function splitCells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

function normalize(text) {
  return text.replace(/\*\*/g, "").replace(/==/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

// Leading <br>s only align a cell with multi-line neighbours; the headword is
// the first non-empty line.
const LEADING_BREAKS = /^(?:\s*<br\s*\/?>)+/i;

function firstLine(html) {
  return html.replace(LEADING_BREAKS, "").split(/<br\s*\/?>/i)[0];
}

module.exports = { HIGHLIGHT_SELECTOR, hoverElement, PROMOTE_CELL_SELECTOR, headerText, wordColumnIndex, wordCellOf, cellMarkdown, pointerHitsText, pointerOnText, splitCells, normalize, LEADING_BREAKS, firstLine };

// 双击正文切换所在高亮, 选中后点击只添加高亮, 不改动词表评分与表格编辑交互。
function wordRange(text, offset) {
  for (const m of text.matchAll(/[A-Za-z]+(?:[’'-][A-Za-z]+)*/g)) {
    if (offset >= m.index && offset < m.index + m[0].length) return { from: m.index, to: m.index + m[0].length };
  }
  return null;
}
function highlightChange(text, range) {
  // 已在高亮内就保持原状, 包括高亮短语中的单词。
  const lineStart = text.lastIndexOf('\n', range.from - 1) + 1;
  if ((text.slice(lineStart, range.from).match(/==/g) || []).length % 2) return null;
  return { from: range.from, to: range.to, insert: `==${text.slice(range.from, range.to)}==` };
}
function toggleHighlightChange(text, range) {
  const lineStart = text.lastIndexOf('\n', range.from - 1) + 1;
  const lineEnd = text.indexOf('\n', range.from);
  const line = text.slice(lineStart, lineEnd < 0 ? text.length : lineEnd);
  for (const match of line.matchAll(/==([^\n]*?)==/g)) {
    const from = lineStart + match.index;
    const to = from + match[0].length;
    if (range.from >= from + 2 && range.from < to - 2) {
      return { from, to, insert: match[1] };
    }
  }
  return highlightChange(text, range);
}
function selectionChanges(text, range) {
  const changes = [];
  let offset = range.from;
  for (const line of text.slice(range.from, range.to).split('\n')) {
    const lead = line.length - line.trimStart().length;
    const end = line.trimEnd().length;
    if (end > lead && !line.includes('==')) {
      const change = highlightChange(text, { from: offset + lead, to: offset + end });
      if (change) changes.push(change);
    }
    offset += line.length + 1;
  }
  return changes;
}
function pointInsideRange(range, event) {
  return [...range.getClientRects()].some(r => event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom);
}

// 阅读视图的正文不包含高亮和加粗标记。保留每个可见字符的源码位置,
// 使口语母版中的 **加粗文字** 也能切换高亮, 且不删掉用户的加粗。
function previewHighlightChanges(source, specs, selected = false) {
  const hidden = new Set();
  for (const pattern of [/==([^\n]*?)==/g, /\*\*(?=\S)([^\n]+?)\*\*/g]) {
    for (const match of source.matchAll(pattern)) {
      for (const i of [match.index, match.index + 1, match.index + match[0].length - 2, match.index + match[0].length - 1]) hidden.add(i);
    }
  }
  let plain = "";
  const offsets = [];
  for (let i = 0; i < source.length; i++) {
    if (hidden.has(i)) continue;
    plain += source[i];
    offsets.push(i);
  }
  const edits = [];
  for (const { visible, offset, length } of specs) {
    const start = plain.indexOf(visible);
    // 重复段落或渲染文字无法精确对应时保持源码不变。
    if (start < 0 || plain.indexOf(visible, start + 1) !== -1 || !length) return [];
    const from = offsets[start + offset];
    const to = offsets[start + offset + length - 1] + 1;
    if (!Number.isFinite(from) || !Number.isFinite(to)) return [];
    if (selected) edits.push(...selectionChanges(source, { from, to }));
    else {
      const edit = toggleHighlightChange(source, { from, to });
      if (edit) edits.push(edit);
    }
  }
  return edits;
}

class DoubleClickHighlightMethods {
  setupDoubleClickHighlight() {
    this.register(() => this.doubleClickScrollCleanup?.());
    const context = (event) => {
      const el = event.target?.closest?.('.markdown-source-view, .markdown-preview-view');
      if (!el || event.target.closest('table, pre, code, a, button, input, textarea, .internal-embed, .cm-formatting, .cm-inline-code, .cm-hmd-codeblock')) return null;
      const leaf = this.app.workspace.getLeavesOfType('markdown').find(l => l.view.containerEl.contains(el));
      return leaf?.view.file ? { view: leaf.view, el } : null;
    };
    let pendingSelection = null;
    this.registerDomEvent(document, 'mousedown', event => {
      pendingSelection = null;
      if (event.button !== 0 || event.detail !== 1 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const ctx = context(event);
      if (!ctx) return;
      const cm = ctx.view.getMode() === 'source' && ctx.view.editor?.cm;
      let selected;
      if (cm) {
        const range = cm.state.selection.main;
        const pos = cm.posAtCoords({ x: event.clientX, y: event.clientY });
        if (range.empty || pos == null || pos < range.from || pos >= range.to) return;
        selected = { from: range.from, to: range.to };
      } else {
        const selection = ctx.el.ownerDocument.defaultView.getSelection();
        if (!selection?.rangeCount || selection.isCollapsed) return;
        const range = selection.getRangeAt(0);
        if (!ctx.el.contains(range.commonAncestorContainer) || !pointInsideRange(range, event)) return;
        selected = range.cloneRange();
      }
      event.preventDefault();
      event.stopPropagation();
      pendingSelection = { ctx, selected, x: event.clientX, y: event.clientY };
    }, true);
    this.registerDomEvent(document, 'mouseup', event => {
      const pending = pendingSelection;
      pendingSelection = null;
      if (!pending || event.button !== 0 || Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 4) return;
      event.preventDefault();
      event.stopPropagation();
      this.highlightDoubleClickedWord(event, pending.ctx, pending.selected).catch(error => console.error('[HighlightDecompose] Selection highlight failed', error));
    }, true);
    // detail>=2 的按下一律拦截: 连点第 3 次起浏览器/CodeMirror 会选中整个自然段。
    // 连续高亮再取消 = 4 连击, 偶数次(第 2、4 次…)按双击切换高亮, 奇数次(第 3、5 次…)只吞掉。
    let toggledAt = null;
    this.registerDomEvent(document, 'mousedown', event => {
      if (event.button !== 0 || event.detail < 2 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !context(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.target.ownerDocument.defaultView.getSelection()?.removeAllRanges();
    }, true);
    this.registerDomEvent(document, 'click', event => {
      if (event.button !== 0 || event.detail < 4 || event.detail % 2 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const ctx = context(event);
      if (!ctx) return;
      toggledAt = event.timeStamp;
      event.preventDefault();
      event.stopPropagation();
      this.highlightDoubleClickedWord(event, ctx).catch(error => console.error('[HighlightDecompose] Double click highlight failed', error));
    }, true);
    this.registerDomEvent(document, 'dblclick', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const ctx = context(event);
      if (!ctx) return;
      event.preventDefault();
      event.stopPropagation();
      // 同一次点击已由 click 处理(4 连击以上)时不重复切换。
      if (toggledAt !== null && event.timeStamp - toggledAt < 100) return;
      this.highlightDoubleClickedWord(event, ctx).catch(error => console.error('[HighlightDecompose] Double click highlight failed', error));
    }, true);
  }

  async highlightDoubleClickedWord(event, { view, el }, selected = null) {
    const cm = view.getMode() === 'source' && view.editor?.cm;
    if (cm) {
      const pos = cm.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null) return;
      const line = cm.state.doc.lineAt(pos);
      const range = selected ? { from: 0, to: 0 } : wordRange(line.text, pos - line.from);
      if (!range) return;
      range.from += line.from;
      range.to += line.from;
      const source = cm.state.doc.toString();
      const changes = selected ? selectionChanges(source, selected) : [toggleHighlightChange(source, range)].filter(Boolean);
      // 保留当前光标并映射它的位置, 同时保留视口锚点。不要把光标移到新标记旁。
      if (changes.length) {
        const spec = { changes, effects: cm.scrollSnapshot(), scrollIntoView: false };
        if (selected) spec.selection = { anchor: selected.to + changes.reduce((n, c) => n + c.insert.length - (c.to - c.from), 0) };
        cm.dispatch(spec);
      }
      el.ownerDocument.defaultView.getSelection()?.removeAllRanges();
      return;
    }
    // 阅读视图只在段落的完整可见文字能唯一对应源码时落盘, 避免同词误改。
    const doc = el.ownerDocument;
    const specs = [];
    if (selected) {
      for (const block of el.querySelectorAll('p, h1, h2, h3, h4, h5, h6')) {
        if (block.closest('table, pre, code, .internal-embed') || !selected.intersectsNode(block)) continue;
        const full = doc.createRange();
        full.selectNodeContents(block);
        const part = full.cloneRange();
        if (selected.compareBoundaryPoints(0, full) > 0) part.setStart(selected.startContainer, selected.startOffset);
        if (selected.compareBoundaryPoints(2, full) < 0) part.setEnd(selected.endContainer, selected.endOffset);
        if (!part.toString().trim()) continue;
        const prefix = full.cloneRange();
        prefix.setEnd(part.startContainer, part.startOffset);
        specs.push({ visible: block.textContent, offset: prefix.toString().length, length: part.toString().length });
      }
    } else {
      const caret = doc.caretRangeFromPoint(event.clientX, event.clientY);
      if (!caret || caret.startContainer.nodeType !== 3) return;
      const node = caret.startContainer;
      const range = wordRange(node.nodeValue, caret.startOffset);
      const block = node.parentElement.closest('p, h1, h2, h3, h4, h5, h6');
      if (!range || !block || !el.contains(block)) return;
      const prefix = doc.createRange();
      prefix.selectNodeContents(block);
      prefix.setEnd(node, range.from);
      specs.push({ visible: block.textContent, offset: prefix.toString().length, length: range.to - range.from });
    }
    if (!specs.length) return;
    // 阅读视图更新会重新排版整篇文章。用逻辑滚动位置跨过重绘,
    // 并在用户主动滚动/切换页面时立即停止恢复。
    const preview = view.previewMode;
    const scroll = preview.getScroll();
    const restore = () => { if (view.getMode() === 'preview') preview.applyScroll(scroll); };
    let timer;
    const observer = new MutationObserver(restore);
    const stop = () => {
      observer.disconnect();
      clearTimeout(timer);
      for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) doc.removeEventListener(type, stop, true);
    };
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) doc.addEventListener(type, stop, true);
    observer.observe(el, { childList: true, subtree: true });
    timer = setTimeout(stop, 800);
    this.doubleClickScrollCleanup?.();
    this.doubleClickScrollCleanup = stop;
    try {
    await this.app.vault.process(view.file, source => {
      const edits = previewHighlightChanges(source, specs, Boolean(selected));
      for (const edit of edits.sort((a, b) => b.from - a.from)) source = source.slice(0, edit.from) + edit.insert + source.slice(edit.to);
      return source;
    });
    restore();
    } catch (error) { stop(); throw error; }
    doc.defaultView.getSelection()?.removeAllRanges();
  }
}
module.exports = { DoubleClickHighlightMethods, wordRange, highlightChange, toggleHighlightChange, selectionChanges, previewHighlightChanges };

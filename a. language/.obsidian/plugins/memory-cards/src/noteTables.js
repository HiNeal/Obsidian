const { setIcon } = require("obsidian");
const { scanTableScopes } = require("./tableScopes");

const EDIT_DEBOUNCE = 180;

function hasTableMutation(records) {
  for (const r of records) {
    for (const n of r.addedNodes) {
      if (n.nodeType !== 1 || n.classList?.contains('mc-table-study')) continue;
      if (n.tagName === 'TABLE' || n.querySelector?.('table')) return true;
    }
    for (const n of r.removedNodes) {
      if (n.nodeType !== 1 || n.classList?.contains('mc-table-study')) continue;
      if (n.tagName === 'TABLE' || n.querySelector?.('table')) return true;
    }
  }
  return false;
}

// 单表入口挂在第一列表头, 按钮不参与编辑, 不修改笔记源码。
function registerNoteTables(plugin) {
  const contexts = new WeakMap();
  const cache = new WeakMap();
  const observed = new WeakSet();
  const observers = [];
  const buttons = new Set();
  let frame = null;
  let editTimer = null;

  const schedule = () => { if (frame === null) frame = requestAnimationFrame(refresh); };
  const scheduleEdit = () => {
    clearTimeout(editTimer);
    editTimer = setTimeout(schedule, EDIT_DEBOUNCE);
  };

  const observeSource = (view) => {
    const src = view.contentEl.querySelector('.markdown-source-view');
    if (!src || observed.has(src)) return;
    observed.add(src);
    const observer = new MutationObserver((records) => {
      if (hasTableMutation(records)) schedule();
    });
    observer.observe(src, { childList: true, subtree: true });
    observers.push(observer);
  };

  const refresh = () => {
    frame = null;
    for (const button of buttons) if (!button.isConnected) buttons.delete(button);
    for (const leaf of plugin.app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (!view.file || !view.contentEl.isConnected || (!view.contentEl.offsetWidth && !view.contentEl.offsetHeight)) continue;
      observeSource(view);

      const docObj = view.editor?.cm?.state?.doc || null;
      let cached = cache.get(view);
      let tablesChanged = false;
      if (!cached || (docObj ? cached.docObj !== docObj : cached.text !== (view.editor?.getValue() ?? view.data ?? ''))) {
        const text = docObj ? docObj.toString() : (view.editor?.getValue() ?? view.data ?? '');
        if (!cached || cached.text !== text) {
          cached = { docObj, text, path: view.file.path, tables: scanTableScopes(text) };
          tablesChanged = true;
        } else {
          cached.docObj = docObj;
          if (cached.path !== view.file.path) { cached.path = view.file.path; tablesChanged = true; }
        }
        cache.set(view, cached);
      } else if (cached.path !== view.file.path) {
        cached.path = view.file.path;
        tablesChanged = true;
      }

      if (!cached.tables.length && !tablesChanged) continue;

      for (const table of view.contentEl.querySelectorAll('.markdown-preview-view table, .markdown-source-view table')) {
        let button = table.mcStudyButton;
        if (button && !button.isConnected) { delete table.mcStudyButton; button = null; }
        if (button && !tablesChanged) continue;

        let line = null;
        try {
          if (table.closest('.markdown-source-view') && view.editor?.cm) {
            const cm = view.editor.cm;
            line = cm.state.doc.lineAt(cm.posAtDOM(table)).number - 1;
          } else {
            const ctx = contexts.get(table);
            line = ctx?.getSectionInfo(table)?.lineStart ?? null;
          }
        } catch (_) { /* 未完成挂载的表格等下一次刷新。 */ }
        const scope = line == null ? null : cached.tables.find(t => line >= t.line && line <= t.end);
        if (!scope) { if (button) { button.remove(); delete table.mcStudyButton; } continue; }
        const host = table.querySelector('thead tr, tr')?.firstElementChild;
        if (!host) continue;
        if (button && button.parentElement !== host) { button.remove(); button = null; }
        if (!button) {
          host.classList.add('mc-table-host');
          button = host.createEl('button', { cls: 'mc-table-study', attr: { type: 'button', contenteditable: 'false' } });
          setIcon(button, 'mc-cards');
          button.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); });
          button.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            plugin.openDeck(button.mcPath, leaf, button.mcKey);
          });
          table.mcStudyButton = button;
          buttons.add(button);
        }
        button.mcPath = view.file.path;
        button.mcKey = scope.key;
        const label = `学习 ${scope.label} · ${scope.count} 张`;
        if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
      }
    }
  };

  plugin.registerMarkdownPostProcessor((el, ctx) => {
    const tables = el.querySelectorAll('table');
    if (!tables.length) return;
    tables.forEach(table => contexts.set(table, ctx));
    schedule();
  });
  plugin.registerEvent(plugin.app.workspace.on('layout-change', schedule));
  plugin.registerEvent(plugin.app.workspace.on('active-leaf-change', schedule));
  plugin.registerEvent(plugin.app.workspace.on('file-open', schedule));
  plugin.registerEvent(plugin.app.workspace.on('editor-change', scheduleEdit));
  plugin.app.workspace.onLayoutReady(schedule);
  schedule();
  plugin.register(() => {
    for (const observer of observers) observer.disconnect();
    observers.length = 0;
    clearTimeout(editTimer);
    if (frame !== null) cancelAnimationFrame(frame);
    buttons.forEach(button => button.remove());
    document.querySelectorAll('.mc-table-host').forEach(el => el.classList.remove('mc-table-host'));
    document.querySelectorAll('table').forEach(table => { delete table.mcStudyButton; });
  });
}
module.exports = { registerNoteTables };

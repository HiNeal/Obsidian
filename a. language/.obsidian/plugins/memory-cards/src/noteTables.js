const { setIcon } = require("obsidian");
const { parseDeck } = require("./parse");
const { tableScopes } = require("./tableScopes");

// 单表入口挂在第一列表头, 按钮不参与编辑, 不修改笔记源码。
function registerNoteTables(plugin) {
  const contexts = new WeakMap();
  const cache = new WeakMap();
  const buttons = new Set();
  let frame = null;
  const refresh = () => {
    frame = null;
    for (const button of buttons) if (!button.isConnected) buttons.delete(button);
    for (const leaf of plugin.app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (!view.file) continue;
      const text = view.editor?.getValue();
      let cached = cache.get(view);
      if (!cached || cached.text !== text) {
        cached = { text, tables: tableScopes(parseDeck(text || '')) };
        cache.set(view, cached);
      }
      for (const table of view.contentEl.querySelectorAll('.markdown-preview-view table, .markdown-source-view table')) {
        const headers = [...(table.querySelector('thead tr, tr')?.children || [])];
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
        let button = table.mcStudyButton;
        if (button && !button.isConnected) { delete table.mcStudyButton; button = null; }
        if (!scope) { if (button) { button.remove(); delete table.mcStudyButton; } continue; }
        const host = headers[0];
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
  const schedule = () => { if (frame === null) frame = requestAnimationFrame(refresh); };
  plugin.registerMarkdownPostProcessor((el, ctx) => {
    el.querySelectorAll('table').forEach(table => contexts.set(table, ctx));
    schedule();
  });
  const observer = new MutationObserver(schedule);
  observer.observe(plugin.app.workspace.containerEl, { childList: true, subtree: true, characterData: true });
  plugin.registerEvent(plugin.app.workspace.on('layout-change', schedule));
  plugin.registerEvent(plugin.app.workspace.on('editor-change', schedule));
  plugin.app.workspace.onLayoutReady(schedule);
  schedule();
  plugin.register(() => {
    observer.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
    buttons.forEach(button => button.remove());
    document.querySelectorAll('.mc-table-host').forEach(el => el.classList.remove('mc-table-host'));
    document.querySelectorAll('table').forEach(table => { delete table.mcStudyButton; });
  });
}
module.exports = { registerNoteTables };

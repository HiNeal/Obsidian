const { MarkdownView } = require("obsidian");
const { getSettings } = require("../settings");
const { isPluginExcludedNote } = require("../../shared/notes");

class RuleMethods {
  // 路径黑名单：命中的笔记整篇不挂耳机。
  isPathExcluded(contextFile) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = contextFile
      || (activeView && activeView.file ? activeView.file : this.app.workspace.getActiveFile());
    if (isPluginExcludedNote(file)) return true;
    if (!file) return false;
    const path = (typeof file === "string" ? file : (file.path || "")).toLowerCase();
    if (!path) return false;
    for (const kw of getSettings().excludePathKeywords) {
      if (path.includes(kw.toLowerCase())) return true;
    }
    return false;
  }

  isReadingFile(contextFile) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = contextFile
      || (activeView && activeView.file ? activeView.file : this.app.workspace.getActiveFile());
    if (!file) return false;
    const path = (typeof file === "string" ? file : (file.path || "")).toLowerCase();
    return path.includes("06. reading") || path.includes("10. practice/reading") || path.includes("/reading/");
  }

  // 01. base 默认把耳机留在最后一列；连音与重音笔记例外，按普通语音表挂在第一列。
  isBaseFile(contextFile) {
    const file = contextFile || this.app.workspace.getActiveFile();
    if (!file) return false;
    const path = typeof file === "string" ? file : (file.path || "");
    if (/(^|\/)01\. base\/(?:b\.connected|c\.prosody)\.md$/i.test(path)) return false;
    return /(^|\/)01\. base\//.test(path);
  }

  isPronunciationFile(contextFile) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = contextFile
      || (activeView && activeView.file ? activeView.file : this.app.workspace.getActiveFile());
    if (!file) return false;
    const path = (typeof file === "string" ? file : (file.path || "")).toLowerCase();
    // 只认文件名主干，不认字母序号：笔记改过序号（a./b./c.）后仍能识别。
    return path.endsWith("phonemes.md") || path.endsWith("pronunciation.md");
  }

  isPhonemesFile(contextFile) {
    const file = contextFile || this.app.workspace.getActiveFile();
    if (!file) return false;
    const path = (typeof file === "string" ? file : (file.path || "")).toLowerCase();
    return path.endsWith("a.phonemes.md");
  }

  // 表头黑名单（“同义改写”、“改写机制”等纯文本分析表）：整表不挂耳机。
  hasExcludedHeader(table) {
    const headerRow = table.querySelector("thead tr, tr:first-child");
    if (!headerRow) return false;
    const headers = headerRow.querySelectorAll("th, td");
    for (let i = 0; i < headers.length; i++) {
      const text = (headers[i].textContent || "").replace(/[\*_~`#]/g, "").trim();
      for (const hKw of getSettings().excludeHeaderKeywords) {
        if (text.includes(hKw)) return true;
      }
    }
    return false;
  }

  // 音标篇的例词/例句表由内容列识别，不再依赖音频来源状态列。
  // 基础动作与机制表仍保持纯文本；纯音标表继续走音标单元格挂载。
  isPronunciationExampleTable(table) {
    const headerRow = table.querySelector("thead tr, tr:first-child");
    if (!headerRow) return false;
    const headers = Array.from(headerRow.querySelectorAll("th, td"))
      .map((h) => (h.textContent || "").replace(/[\*_~`#]/g, "").trim());
    return ["单词", "例句", "句子", "地名"].includes(headers[0])
      || (headers.length === 2 && headers[1] === "解释");
  }

  isAudioExcluded(table, contextFile) {
    return this.isPathExcluded(contextFile) || this.hasExcludedHeader(table);
  }

  // 当前需要接管的 Markdown 视图（内容根 + 所属文件）。
  // 未聚焦但可见的分栏也会被接管；隐藏标签页（display:none，offsetParent 为 null）跳过。
  getManagedContexts() {
    // 同一帧里有四处会问同一个问题（表格更新、滚动补测、按钮绑定帧、观察者同步），
    // 而每次都要读 offsetParent/offsetHeight 触发一次布局。按帧缓存，下一帧自动作废；
    // 分栏切换会即时改变答案，所以 active-leaf-change 里显式清一次。
    if (this.managedContextsCache) return this.managedContextsCache;

    const contexts = [];
    const seen = new Set();
    const collect = (view) => {
      if (!view || !view.contentEl) return;
      if (isPluginExcludedNote(view.file)) return;
      // 同一视图里编辑区与阅读区两个容器都在 DOM 中，只是其一被隐藏；
      // 编辑区排在前面，只取第一个匹配会让阅读模式整篇被当成「隐藏标签页」跳过。
      const root = Array.from(view.contentEl.querySelectorAll(
        ".markdown-source-view.is-live-preview, .markdown-preview-view"
      )).find((el) => el.offsetParent || el.offsetHeight > 0);
      if (!root || seen.has(root)) return;  // 隐藏标签页
      seen.add(root);
      // view 是算「这张表在源码里是第几张」的唯一精确来源，见 tableOrdinal()。
      contexts.push({ root, file: view.file || null, view });
    };

    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) collect(leaf.view);
    this.managedContextsCache = contexts;
    requestAnimationFrame(() => { this.managedContextsCache = null; });
    return contexts;
  }
}

module.exports = { RuleMethods };

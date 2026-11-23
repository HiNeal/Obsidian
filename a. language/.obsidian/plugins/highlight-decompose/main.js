/* 由 build.js 从 src/ 生成，请改 src/ 而不是这个文件。 */
const __defs = {
"index": function (module, exports, require) {
// 插件入口：只负责组装。hd/ 是悬浮拆解，audio/ 是耳机点读，两边互不引用，
// 仅由 hd/plugin.js 把 audio 作为子组件挂载。
const HighlightDecomposePlugin = require("./hd/plugin");
const TableSoundPlugin = require("./audio/plugin");
const audioSettings = require("./audio/settings");
const audioConstants = require("./audio/constants");
const audioDom = require("./audio/dom");
const audioExtract = require("./audio/extract");
const reading = require("./hd/reading");
const library = require("./hd/library");
const columns = require("./hd/columns");
const tables = require("./hd/tables");
const dom = require("./hd/dom");
const marks = require("./hd/marks");

module.exports = HighlightDecomposePlugin;
module.exports.TableSound = TableSoundPlugin;
// 供 test.js 访问的纯函数（不依赖 Obsidian 运行时）。
module.exports.__test__ = {
  pairChunkColumnWithWord: audioDom.pairChunkColumnWithWord,
  extractTargetWord: audioExtract.extractTargetWord,
  toSlug: audioExtract.toSlug,
  parseListText: audioSettings.parseListText,
  serializeListText: audioSettings.serializeListText,
  parseCsvList: audioSettings.parseCsvList,
  serializeCsvList: audioSettings.serializeCsvList,
  parseGroupedText: audioSettings.parseGroupedText,
  serializeGroupedText: audioSettings.serializeGroupedText,
  AUDIO_COLUMN_TYPES: audioConstants.AUDIO_COLUMN_TYPES,
  VAULT_PREFIX: audioConstants.VAULT_PREFIX,
  AUDIO_ROOT: audioConstants.AUDIO_ROOT,
  DEFAULT_SETTINGS: audioSettings.DEFAULT_SETTINGS,
  readingNotePath: reading.readingNotePath,
  senseContext: reading.senseContext,
  chunkMatchesContext: reading.chunkMatchesContext,
  appendMeaningInline: reading.appendMeaningInline,
  sourceHighlights: reading.sourceHighlights,
  nearestSense: reading.nearestSense,
  bindReadingSenses: reading.bindReadingSenses,
  highlightReadingSense: reading.highlightReadingSense,
  readingSenseMatches: reading.readingSenseMatches,
  parseSenseId: reading.parseSenseId,
  parseEnglishSenseId: reading.parseEnglishSenseId,
  englishSenseTarget: reading.englishSenseTarget,
  parseTables: library.parseTables,
  libraryKind: library.libraryKind,
  candidates: library.candidates,
  listeningNotePath: library.listeningNotePath,
  listeningMetadata: library.listeningMetadata,
  definitionOnly: columns.definitionOnly,
  markTable: tables.markTable,
  contextCardColumn: tables.contextCardColumn,
  cellMarkdown: dom.cellMarkdown,
  hoverElement: dom.hoverElement,
  splitMarks: marks.splitMarks,
};

},
"hd/plugin": function (module, exports, require) {
// Hover a ==highlight== (reading view <mark>, live preview .cm-highlight) to see
// the matching row's 拆解 cell. Passage lookup searches the current note and
// all of 02. word and 03. phrase; a table row still owns its own cell (an empty
// cell shows no card). A row is keyed by its headword and
// by every **bold** word in its 短语 cell, so inflected highlights (herds,
// dwelt) still hit the lemma row.
// Vocabulary tables (any table with 拆解 + 短语 headers) get their 拆解 column
// hidden; phrase, grammar and listening tables (`短语 | 短语 | 释义`) get their
// 释义 column hidden the same way. A legacy table whose second column is 短语
// but has no 释义 column gets the 释义 after the first <br><br> of its first
// cell hidden. Prefix, root and suffix notes use a separate examples-only
// card: meanings stay visible, with a highlight toggle and matching headphones entry
// (playback is intentionally inactive in these three notes). Column tables hide
// whole columns: `| 单词 | 释义 |` (and 538 / speaking variants) hide 释义.
// 同义替换 / 同义改写 tables are English on both sides and stay fully visible. Hovering anywhere in such a row shows the card pinned just right of
// the row's first column (a highlight: just right of the highlight). 短语 cells lose their line breaks except the <br><br> between examples.
// Display only: the Markdown is untouched, and hidden <br>s stay in the DOM so
// table-sound parses the cells exactly as before.
const { Platform, Plugin } = require("obsidian");
const { installMixins } = require("../mixin");
const { hoverElement, pointerHitsText, pointerOnText, wordCellOf } = require("./dom");
const { libraryKind } = require("./library");
const { bindParaphrase, bindReadingSenses, readingNotePath } = require("./reading");
const { listeningNotePath, articleNotePath } = require("../shared/notes");
const { markScoreHighlight, markTable } = require("./tables");
const { isPluginExcludedNote } = require("../shared/notes");
const { PromoteMethods } = require("./features/promote");
const { TableSessionMethods } = require("./features/tableSession");
const { LibraryMethods } = require("./features/library");
const { ReadingWordMethods } = require("./features/readingWords");
const { TooltipMethods } = require("./features/tooltip");
const { ReadingAudioMethods } = require("./features/readingAudio");
const { HighlightVisibilityMethods } = require("./features/highlightVisibility");
const { DoubleClickHighlightMethods } = require("./features/doubleClickHighlight");
const { AudioSeekMethods } = require("./features/audioSeek");
const TableSoundPlugin = require("../audio/plugin");

class HighlightDecomposePlugin extends Plugin {
  constructor() {
    super(...arguments);
    this.libraryRevision = 0;
    this.entriesCache = new Map();
    this.fileEntries = new Map();
    this.sourceContents = new Map();
  }
  onload() {
    this.unloading = false;
    // 耳机点读先于本插件的表格处理加载，与合并前的插件加载顺序一致。
    this.tableSound = new TableSoundPlugin(this.app, this.manifest);
    this.addChild(this.tableSound);
    // 它启动时只处理「有变化的表格」，首次完整扫描靠之后的布局事件；插件热重载时
    // 没有那次事件，耳机会缺。界面就绪后（它的异步 onload 也已跑完）主动扫一次。
    this.app.workspace.onLayoutReady(() => {
      this.audioStartupTimer = setTimeout(() => {
        const ts = this.tableSound;
        if (!ts || !ts.requestUpdate) return;
        // 与它自己的 layout-change 处理完全相同。
        ts.managedContextsCache = null;
        ts.syncViewObservers();
        ts.requestUpdate(true);
      }, 300);
    });

    this.fileEntries = new Map();
    this.sourceContents = new Map();
    this.readingRenderVersions = new WeakMap();
    this.libraryRevision = 0;
    this.libraryReady = false;
    this.libraryLoad = null;
    this.hoverToken = 0;
    this.activeEl = null;
    this.tip = document.body.createDiv({ cls: "hd-tooltip" });
    this.tip.hide();
    this.setupPromoteButton();
    this.setupDoubleClickHighlight();
    this.setupAudioSeek();
    this.setupReadingWords();
    this.setupHighlightVisibility();
    this.registerMarkdownPostProcessor(async (el, ctx) => {
      if (listeningNotePath(ctx.sourcePath) && !el.closest(".hd-tooltip")) {
        // 听力笔记只绑定题目里的同义改写悬停。
        const section = ctx.getSectionInfo(el);
        const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (!section || !file) return;
        const source = await this.app.vault.cachedRead(file);
        if (!this.unloading) {
          const lines = source.split("\n");
          const question = lines.slice(0, section.lineStart + 1).filter(line => /^#\s+/.test(line)).at(-1)?.trim() === "# 题目";
          bindParaphrase(el, lines.slice(section.lineStart, section.lineEnd + 1).join("\n"), question);
          // 本篇表格里查不到的高亮标为纯高亮: 「隐藏原文高亮底色」开启时仍保留底色。
          await this.ensureIndex(file);
          for (const mark of el.querySelectorAll("mark")) {
            if (mark.closest("table, pre, code, .internal-embed") || mark.dataset.hdPara) continue;
            mark.classList.toggle("hd-plain-highlight", !this.lookup(mark.textContent || "", ctx.sourcePath, "", true));
          }
          this.renderAnswerBlanks(el, lines.slice(section.lineStart, section.lineEnd + 1).join("\n"), question);
        }
        return;
      }
      if (!readingNotePath(ctx.sourcePath) || el.closest(".hd-tooltip")) return;
      const version = {};
      this.readingRenderVersions.set(el, version);
      const section = ctx.getSectionInfo(el);
      const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
      if (!section || !file) return;
      const source = await this.app.vault.cachedRead(file);
      if (this.unloading || this.readingRenderVersions.get(el) !== version) return;
      const lines = source.split("\n");
      const question = lines.slice(0, section.lineStart + 1).filter(line => /^#\s+/.test(line)).at(-1)?.trim() === "# 题目";
      bindReadingSenses(el, lines.slice(section.lineStart, section.lineEnd + 1).join("\n"), ctx.sourcePath, (text, note) => this.hasReadingEntry(text, note, ctx.sourcePath, true), question);
      this.renderAnswerBlanks(el, lines.slice(section.lineStart, section.lineEnd + 1).join("\n"), question);
    });
    this.app.workspace.onLayoutReady(() => {
      this.loadLibraries().then(() => Promise.all(this.app.workspace.getLeavesOfType("markdown")
        .map(leaf => leaf.view.file).filter(file => file && articleNotePath(file.path))
        .map(file => this.ensureIndex(file))))
        .then(() => this.refreshLibraryViews()).catch(error => console.error("[HighlightDecompose] Library indexing failed", error));
    });
    this.registerEvent(this.app.workspace.on("file-open", file => {
      if (file && articleNotePath(file.path)) this.ensureIndex(file)
        .catch(error => console.error("[HighlightDecompose] Article indexing failed", error));
    }));

    let scanQueued = false;
    const scan = () => {
      this.tableScanFrame = null;
      if (this.unloading) return;
      scanQueued = false;
      for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
        const path = (leaf.view.file && leaf.view.file.path) || "";
        const excluded = isPluginExcludedNote(path);
        leaf.view.containerEl.toggleAttribute("data-hd-excluded", excluded);
        leaf.view.containerEl.toggleAttribute("data-hd-reading", Boolean(readingNotePath(path)));
        leaf.view.containerEl.toggleAttribute("data-hd-passage", Boolean(readingNotePath(path) || listeningNotePath(path)));
        let resized = false;
        leaf.view.containerEl.querySelectorAll("table").forEach((t) => {
          // Live preview caches each table's height and only re-measures on the
          // next click, then scrolls to correct it. Hiding columns / <br>s shrinks
          // the table, so tell CodeMirror right away instead.
          const live = t.closest(".cm-editor");
          if (live) this.patchTableRender(t);
          const before = live ? t.offsetHeight : 0;
          markTable(t, path);
          markScoreHighlight(t);
          if (excluded && this.tableSound) this.tableSound.bindBaseReferenceEntry(t);
          if (live && t.offsetHeight !== before) resized = true;
        });
        const cm = resized && leaf.view.editor && leaf.view.editor.cm;
        if (cm) cm.requestMeasure();
      }
      this.refreshPromoteSoon();
    };
    const scheduleScan = () => {
      if (scanQueued) return;
      scanQueued = true;
      this.tableScanFrame = requestAnimationFrame(scan);
    };
    this.registerEvent(this.app.workspace.on("file-open", scheduleScan));
    this.registerEvent(this.app.workspace.on("active-leaf-change", scheduleScan));
    this.observer = new MutationObserver(scheduleScan);
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.app.workspace.onLayoutReady(scan);

    this.registerEvent(this.app.vault.on("modify", (f) => this.reindex(f)));
    this.registerEvent(this.app.vault.on("create", (f) => this.reindex(f)));
    this.registerEvent(this.app.vault.on("delete", (f) => {
      this.fileEntries.delete(f.path);
      this.sourceContents.delete(f.path);
      if (libraryKind(f.path)) { this.libraryRevision++; this.refreshLibraryViews(); }
    }));
    this.registerEvent(
      this.app.vault.on("rename", (f, oldPath) => {
        this.fileEntries.delete(oldPath);
        this.sourceContents.delete(oldPath);
        if (libraryKind(oldPath)) this.libraryRevision++;
        this.reindex(f);
        if (libraryKind(oldPath)) this.refreshLibraryViews();
      })
    );

    const isOverActualContent = (e, el, cell) => {
      if (!el) return false;
      const meaningCell = e.target instanceof Element
        && e.target.closest(".hd-base-examples-table tr.hd-row > td:nth-child(2)");
      if (meaningCell) return pointerHitsText(e, meaningCell);
      if (el.matches("mark, .cm-highlight, strong, em, b, i, a, code")) return true;
      // If hovering cell or row
      const targetCell = cell?.closest("td, th") || cell || (el.matches("td, th") ? el : null);
      if (!targetCell) return true;
      // 词汇表/短语表: 鼠标在「释义」「意群」等非词头列上时不弹卡片, 只有词头格触发。
      if (el.matches("tr.hd-row") && el.closest(".hd-decomp-table, .hd-phrase-table, .hd-context-card")
        && targetCell.parentElement && targetCell !== wordCellOf(targetCell.parentElement)) return false;
      // In first cell (headword column), check if cell has text
      if (targetCell.parentElement && targetCell === wordCellOf(targetCell.parentElement)) {
        // 词头格整格都触发卡片, 但耳机、高亮按钮所在的竖向整条区域(含上下空白)不触发。
        const buttons = [...targetCell.querySelectorAll(".audio-playback-btn, .hd-promote")];
        if (this.promoteBtn?.isConnected) buttons.push(this.promoteBtn);
        for (const btn of buttons) {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && e.clientX >= r.left - 4 && e.clientX <= r.right + 4) return false;
        }
        return true;
      }
      // In 短语 cell (or other cells), check if mouse is within the text range or text nodes
      if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (range && range.startContainer) {
          const node = range.startContainer;
          if (node.nodeType === 3 && node.nodeValue.trim().length > 0) {
            // Check character bounding box if possible
            const testRange = document.createRange();
            testRange.setStart(node, Math.max(0, range.startOffset - 1));
            testRange.setEnd(node, Math.min(node.nodeValue.length, range.startOffset + 1));
            const rect = testRange.getBoundingClientRect();
            // allow a 16px tolerance around the character
            if (rect.width > 0 && Math.abs(e.clientX - (rect.left + rect.right) / 2) < 24 && Math.abs(e.clientY - (rect.top + rect.bottom) / 2) < 20) {
              return true;
            }
          }
        }
      }
      // Fallback: check inner wrapper bounds
      const wrapper = targetCell.querySelector(":scope > .table-cell-wrapper") || targetCell;
      const textSpan = wrapper.querySelector("strong, mark, .cm-highlight, span") || wrapper;
      const wr = textSpan.getBoundingClientRect();
      return e.clientX >= wr.left - 8 && e.clientX <= wr.right + 8 && e.clientY >= wr.top - 4 && e.clientY <= wr.bottom + 4;
    };

    if (Platform.isMobile) {
      this.registerDomEvent(document, "click", (e) => {
        const el = hoverElement(e.target);
        const cell = e.target instanceof Element && e.target.closest("td, th, mark, .cm-highlight");
        if (el && isOverActualContent(e, el, cell) && (el !== this.activeEl || cell !== this.activeCell)) this.show(el, cell);
        else if (!(e.target instanceof Element && e.target.closest(".hd-tooltip"))) this.hide();
      });
      return;
    }

    // 词表行的卡片: 鼠标一离开词头格(包括移到卡片上)就立即消失; 原文高亮等其他卡片保持原有的延迟与可停留行为。
    const rowCardActive = () => Boolean(this.activeEl);
    const leaveCard = () => rowCardActive() ? this.hide() : this.scheduleHide();
    const updateHover = (e) => {
      const target = e.target instanceof Element ? e.target : null;
      this.hoverReadingAudio(target || document.body);
      // 鼠标移进卡片: 保持显示, 可以在卡片里停留、选字
      if (target && target.closest(".hd-tooltip")) return rowCardActive() ? this.hide() : this.cancelHide();
      if (!target || target.closest(".audio-playback-btn, .hd-promote")) return this.hide();
      const el = hoverElement(target);
      const cell = target.closest("td, th, mark, .cm-highlight");
      if (!el || !isOverActualContent(e, el, cell)) return leaveCard();
      if (el !== this.activeEl || cell !== this.activeCell) this.show(el, cell);
      else this.cancelHide();
    };
    this.registerDomEvent(document, "mouseover", updateHover);
    this.registerDomEvent(document, "mousemove", updateHover);
    this.registerDomEvent(document, "mouseout", (e) => {
      const target = e.relatedTarget instanceof Element ? e.relatedTarget : null;
      if (target && target.closest(".hd-tooltip")) return rowCardActive() ? this.hide() : this.cancelHide();
      if (!target || target.closest(".audio-playback-btn, .hd-promote")) return this.hide();
      const next = hoverElement(target);
      const cell = target.closest("td, th, mark, .cm-highlight");
      // Moving between child elements of the same content keeps its card.
      if (next === this.activeEl && cell === this.activeCell) return this.cancelHide();
      leaveCard();
    });
    const leavePassage = () => {
      this.hide();
    };
    this.registerDomEvent(window, "blur", leavePassage);
    this.registerDomEvent(document, "mouseleave", leavePassage);
    this.registerDomEvent(document, "scroll", (e) => {
      if (e.target instanceof Element && e.target.closest(".hd-tooltip")) return;
      leavePassage();
      this.refreshPromoteSoon();
    }, true);
  }
  onunload() {
    this.unloading = true;
    this.stopListeningHover();
    this.clearReadingHighlight();
    document.querySelectorAll("[data-hd-passage]").forEach(el => el.removeAttribute("data-hd-passage"));
    document.querySelectorAll(".hd-answer-blank").forEach(el => el.replaceWith(document.createTextNode("________")));
    clearTimeout(this.audioStartupTimer);
    cancelAnimationFrame(this.tableScanFrame);
    cancelAnimationFrame(this.promoteRefreshFrame);
    if (this.tableRenderProto) this.tableRenderProto.proto.render = this.tableRenderProto.original;
    this.observer.disconnect();
    document.querySelectorAll(".hd-passage-phrase").forEach(span => span.replaceWith(...span.childNodes));
    document.querySelectorAll("[data-hd-excluded]").forEach((el) => el.removeAttribute("data-hd-excluded"));
    document.querySelectorAll(".hd-decomp-table").forEach((t) => t.classList.remove("hd-decomp-table"));
    document.querySelectorAll(".hd-column-table").forEach((t) => {
      t.classList.remove("hd-column-table");
      delete t.dataset.hdHidden;
    });
    document.querySelectorAll(".hd-mobile-meaning").forEach((el) => el.remove());
    document.querySelectorAll(".hd-mobile-source").forEach((el) => el.replaceWith(...el.childNodes));
    document.querySelectorAll(".hd-mobile-definition").forEach((cell) => {
      cell.classList.remove("hd-mobile-definition");
      delete cell.dataset.hdMobileLabel;
    });
    document.querySelectorAll(".hd-mobile-table").forEach((table) => table.classList.remove("hd-mobile-table"));
    document.querySelectorAll(".hd-chunk-source").forEach((el) => el.replaceWith(...el.childNodes));
    document.querySelectorAll(".hd-chunk-meaning-cell, .hd-chunk-meaning-head").forEach((cell) => {
      cell.classList.remove("hd-chunk-meaning-cell", "hd-chunk-meaning-head");
      delete cell.dataset.hdMeaning;
      delete cell.dataset.hdMeaningLabel;
    });
    document.querySelectorAll(".hd-meaning-table").forEach((table) => table.classList.remove("hd-meaning-table"));
    document.querySelectorAll(".hd-context-card").forEach((table) => table.classList.remove("hd-context-card"));
    document.querySelectorAll(".hd-hidden-col").forEach((c) => c.classList.remove("hd-hidden-col"));
    document.querySelectorAll(".hd-visible-last").forEach((c) => c.classList.remove("hd-visible-last"));
    document.querySelectorAll(".hd-phrase-table").forEach((t) => t.classList.remove("hd-phrase-table"));
    document.querySelectorAll(".hd-base-table").forEach((t) => t.classList.remove("hd-base-table"));
    document.querySelectorAll(".hd-base-examples-table").forEach((t) => t.classList.remove("hd-base-examples-table"));
    document.querySelectorAll(".hd-row").forEach((r) => r.classList.remove("hd-row"));
    document.querySelectorAll(".hd-phrase-meaning").forEach((m) => m.replaceWith(...m.childNodes));
    document.querySelectorAll(".hd-cell-phonetic").forEach((m) => m.replaceWith(...m.childNodes));
    document.querySelectorAll(".hd-br-space").forEach((sp) => sp.remove());
    document.querySelectorAll(".hd-qtype").forEach((q) => q.replaceWith(...q.childNodes));
    document.querySelectorAll(".hd-ex-meaning").forEach((ex) => {
      const word = ex.previousSibling;
      if (word && word.nodeType === 3) word.nodeValue += ex.textContent;
      else ex.before(ex.textContent);
      ex.remove();
    });
    document.querySelectorAll(".hd-br-hidden").forEach((br) => br.classList.remove("hd-br-hidden"));
    document.querySelectorAll("[data-hd-flat]").forEach((el) => el.removeAttribute("data-hd-flat"));
    this.tip.remove();
    if (this.promoteBtn) this.promoteBtn.remove();
  }
}

installMixins(HighlightDecomposePlugin, AudioSeekMethods, DoubleClickHighlightMethods, PromoteMethods, TableSessionMethods, LibraryMethods, ReadingWordMethods, TooltipMethods, ReadingAudioMethods, HighlightVisibilityMethods);

module.exports = HighlightDecomposePlugin;

},
"mixin": function (module, exports, require) {
// 把一组「方法类」的方法拷到目标类的原型上。每个功能文件只负责自己那组方法，
// 通过 this 访问插件实例；同名方法重复安装会直接报错，避免静默覆盖。
function installMixins(target, ...mixins) {
  for (const mixin of mixins) {
    for (const key of Object.getOwnPropertyNames(mixin.prototype)) {
      if (key === "constructor") continue;
      if (Object.prototype.hasOwnProperty.call(target.prototype, key)) {
        throw new Error(`${target.name}.${key} 被重复定义`);
      }
      Object.defineProperty(target.prototype, key, Object.getOwnPropertyDescriptor(mixin.prototype, key));
    }
  }
}

module.exports = { installMixins };

},
"hd/dom": function (module, exports, require) {
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

},
"hd/library": function (module, exports, require) {
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
  const irregular = { bore: "bear", borne: "bear", clung: "cling", dwelt: "dwell", dug: "dig", laid: "lay", bred: "breed", fed: "feed", foresaw: "foresee", foreseen: "foresee", grew: "grow", grown: "grow", shook: "shake", shaken: "shake", sought: "seek", caught: "catch", taught: "teach", thought: "think", brought: "bring", found: "find", ground: "grind", froze: "freeze", frozen: "freeze", arose: "arise", arisen: "arise", withdrew: "withdraw", withdrawn: "withdraw", swelled: "swell", swollen: "swell", sank: "sink", sunk: "sink", shrank: "shrink", shrunk: "shrink", shrunken: "shrink", swung: "swing", threw: "throw", thrown: "throw", lay: "lie", lain: "lie", wrote: "write", written: "write", took: "take", taken: "take", went: "go", gone: "go", made: "make", ran: "run", rose: "rise", risen: "rise" };
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

},
"shared/notes": function (module, exports, require) {
function listeningNotePath(path) {
  return String(path || "").match(/(?:^|\/)(05\. listening\/.*\.md)$/i)?.[1] || "";
}

// 听力集中表按文章分节: 表格前最近的一级标题即来源笔记 `文件夹/笔记名`。
function sectionSourceOf(cell) {
  const table = cell?.closest?.("table");
  if (!table) return "";
  const root = table.closest(".markdown-preview-view, .markdown-source-view, .view-content") || table.ownerDocument;
  let title = "";
  for (const node of root.querySelectorAll("h1, .cm-header-1, table")) {
    if (node === table) break;
    if (node.tagName !== "TABLE") title = node.textContent.replace(/^#\s*/, "").trim();
  }
  return title ? listeningNotePath(`05. listening/${title}.md`) : "";
}

// Match these three reference notes, including a vault-relative parent folder.
// These notes opt out of normal features; only their dedicated example cards run.
// This is separate from the configurable audio-only exclusions.
function isPluginExcludedNote(file) {
  const path = typeof file === "string" ? file : (file && file.path) || "";
  return /(?:^|\/)01\. base\/(?:x\.word-prefix|y\.word-root|z\.word-suffix)\.md$/i.test(path);
}

// 听说读写篇章共用本篇词表、卡片与高亮交互。
function articleNotePath(path) {
  return String(path || "").match(/(?:^|\/)((?:05\. listening|06\. reading|07\. writing|09\. speaking)\/.*\.md)$/i)?.[1] || "";
}

function articleModule(path) {
  return articleNotePath(path).match(/^\d+\. (listening|reading|writing|speaking)\//i)?.[1].toLowerCase() || "";
}

function articleHighlightSetting(path) {
  const kind = articleModule(path);
  return kind ? `hide${kind[0].toUpperCase()}${kind.slice(1)}ArticleHighlights` : "";
}

module.exports = { sectionSourceOf, listeningNotePath, articleNotePath, articleModule, articleHighlightSetting, isPluginExcludedNote };

},
"hd/reading": function (module, exports, require) {
const { normalize } = require("./dom");

function appendInline(parent, text) {
  text.split(/<br\s*\/?>/).forEach((line, i) => {
    if (i > 0) parent.createEl("br");
    line.split(/\*\*(.+?)\*\*/).forEach((part, k) => {
      if (!part) return;
      if (k % 2) parent.createEl("strong", { text: part });
      else parent.appendText(part);
    });
  });
}

// 牛津英文释义块的词性行：`v. 主项`（词性与第一个主项同行）。
const EN_POS = /^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|int\.|det\.|num\.|abbr\.|comb\.|contr\.|inf\.|symbol\.)(?:\s+(.*))?$/;

// A reading occurrence owns its sense: ==issued==<!--search: issue | 签发-->.
// The shared entry never owns an article's choice of sense.
function readingNotePath(path) {
  return String(path || "").match(/(?:^|\/)((?:06\. reading|07\. writing|09\. speaking|10\. practice\/reading|12\. books)\/.*\.md)$/i)?.[1] || "";
}

function senseContext(text) {
  return normalize(String(text || "")).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function chunkMatchesContext(entry, context) {
  const chunk = senseContext(entry.chunk);
  const surrounding = senseContext(context);
  return !!chunk && (" " + surrounding + " ").includes(" " + chunk + " ");
}

// Vocabulary cards keep the reading-tested senses stored in the current cell.
// Article cards read the entry from the article's own table, where ==...== marks
// this article's context sense: preserveHighlights === "context" keeps them as such.
// false drops the marks (old annotation-driven cards pick their own sense).
function appendMeaningInline(parent, text, preserveHighlights = true) {
  let offset = 0;
  for (const match of text.matchAll(/(\*\*|==)(.+?)\1/g)) {
    parent.appendText(text.slice(offset, match.index));
    const target = match[1] === "**" ? parent.createEl("strong")
      : preserveHighlights === "context" ? parent.createEl("mark", { cls: "hd-context-sense" })
      : preserveHighlights ? parent.createEl("mark", { cls: "hd-tested-sense" }) : parent;
    appendMeaningInline(target, match[2], preserveHighlights);
    offset = match.index + match[0].length;
  }
  parent.appendText(text.slice(offset));
}

function surfaceForm(text) {
  return String(text).replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

// Preserve offsets while masking code, comments and tables. Annotation
// comments are read from the original source, never from their rendered DOM.
function maskSource(content) {
  const blank = s => s.replace(/[^\n]/g, " ");
  let fence = null;
  const masked = content.split("\n").map(line => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      return blank(line);
    }
    if (marker) { fence = { char: marker[1][0], length: marker[1].length }; return blank(line); }
    return line;
  }).join("\n").replace(/<!--[\s\S]*?(?:-->|$)/g, blank)
    .replace(/(`+)[\s\S]*?\1(?!`)/g, blank)
    .replace(/\\[\\`*{}\[\]()#+.!_>~=|-]/g, blank)
    .replace(/^[ \t]*\|[^\n]*$/gm, blank);
  return masked;
}

function sourceHighlights(content) {
  const masked = maskSource(content);
  const out = [];
  for (const m of masked.matchAll(/==([^=\n]+)==/g)) {
    const end = m.index + m[0].length;
    // 题目里的同义改写: ==题目短语==<!--para: 原文表达 / 原文表达-->, 悬停显示原文表达。
    const para = content.slice(end).match(/^[ \t]*<!--\s*para[:：]\s*([^\n]*?)\s*-->/);
    if (para) {
      out.push({ from: m.index, to: end, text: normalize(content.slice(m.index + 2, end - 2)), annotation: null, para: para[1].trim(),
        annotationRange: { from: end + para[0].indexOf("<!--"), to: end + para[0].length } });
      continue;
    }
    const note = content.slice(end).match(/^(?:\*\*)?[ \t]*<!--\s*search[:：]\s*([^\n]*?)\s*-->/);
    let annotation = null;
    if (note) {
      const value = note[1].trim();
      const pair = value.includes("|") ? value.split("|") : value.match(/^(\S+)\s+(.+)$/)?.slice(1);
      if ((pair?.length >= 2 && pair?.length <= 4) && pair.every(s => s.trim()) && !/[<>]/.test(value)) {
        const surface = pair.length >= 3 ? surfaceForm(pair[2]) : null;
        annotation = { word: normalize(pair[0]), gloss: pair[1].trim(), surface,
          ...(pair.length === 4 ? { reference: normalize(pair[3]) } : {}),
          changed: surface !== null && surface !== surfaceForm(content.slice(m.index + 2, end - 2)) };
      }
    }
    const annotationRange = note ? { from: end + note[0].indexOf("<!--"), to: end + note[0].length } : null;
    out.push({ from: m.index, to: end, text: normalize(content.slice(m.index + 2, end - 2)), annotation, annotationRange });
  }
  let question = false;
  const headings = [...masked.matchAll(/^#\s+(.+?)\s*#*\s*$/gm)];
  let heading = 0;
  for (const range of out) {
    while (heading < headings.length && headings[heading].index < range.from) {
      question = headings[heading++][1].trim() === "题目";
    }
    if (question || range.para) range.question = true;
  }
  return out;
}

function bindReadingSenses(root, source, path = "", hasEntry = null, question = false) {
  const marks = (root.matches("mark") ? [root] : [...root.querySelectorAll("mark")])
    .filter(el => !el.closest("table, pre, code, .internal-embed"));
  for (const el of marks) {
    delete el.dataset.hdSenseWord; delete el.dataset.hdSenseGloss; delete el.dataset.hdSenseSurface; delete el.dataset.hdSenseReference;
    el.dataset.hdSensePath = path;
  }
  const ranges = sourceHighlights(source);
  const matchedLength = marks.length === ranges.length && marks.every((el, i) => normalize(el.textContent) === ranges[i].text);
  marks.forEach((el, i) => {
    el.classList.toggle("hd-question-highlight", question || Boolean(matchedLength && ranges[i].question));
    delete el.dataset.hdPara;
    if (matchedLength && ranges[i].para) {
      el.dataset.hdPara = ranges[i].para;
      el.classList.toggle("hd-para-word", true);
      el.classList.toggle("hd-reading-word", false);
      el.classList.toggle("hd-plain-highlight", false);
      return;
    }
    el.classList.toggle("hd-para-word", false);
    const note = matchedLength ? ranges[i].annotation : null;
    if (note) {
      el.dataset.hdSenseWord = note.word; el.dataset.hdSenseGloss = note.gloss;
      if (note.surface !== null) el.dataset.hdSenseSurface = note.surface;
      if (note.reference) el.dataset.hdSenseReference = note.reference;
    }
    const isEnglish = /[a-z]/i.test(el.textContent) && !/[\u3400-\u9fff]/.test(el.textContent);
    const text = matchedLength ? ranges[i].text : normalize(el.textContent);
    const matched = isEnglish && (!hasEntry || hasEntry(text, note));
    el.classList.toggle("hd-reading-word", Boolean(matched));
    // 纯高亮: 既无注释, 本篇也查不到词条。
    el.classList.toggle("hd-plain-highlight", Boolean(matchedLength && !note && !ranges[i].para && !matched));
  });
}

// 听力笔记: 只给带 para 注释的高亮绑定同义改写悬停, 其余高亮交给听力自己的逻辑。
function bindParaphrase(root, source, question = false) {
  const marks = (root.matches("mark") ? [root] : [...root.querySelectorAll("mark")])
    .filter(el => !el.closest("table, pre, code, .internal-embed"));
  const ranges = sourceHighlights(source);
  const matchedLength = marks.length === ranges.length && marks.every((el, i) => normalize(el.textContent) === ranges[i].text);
  marks.forEach((el, i) => {
    el.classList.toggle("hd-question-highlight", question || Boolean(matchedLength && ranges[i].question));
    delete el.dataset.hdPara;
    const para = matchedLength ? ranges[i].para : null;
    el.classList.toggle("hd-para-word", Boolean(para));
    if (para) el.dataset.hdPara = para;
  });
}

function questionBlanks(content, includeTables = false) {
  const out = [];
  let question = false, fence = null, offset = 0;
  for (const line of content.split("\n")) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
    } else if (marker) {
      fence = { char: marker[1][0], length: marker[1].length };
    } else {
      const heading = line.match(/^#\s+(.+?)\s*#*\s*$/);
      if (heading) question = heading[1].trim() === "题目";
      if (question && (includeTables || !/^\s*\|/.test(line))) {
        for (const match of line.replace(/<!--.*?-->|(`+).*?\1/g, text => " ".repeat(text.length)).matchAll(/(?:\\_){8}|(?<![\\_])_{8}(?!_)/g)) {
          const end = match.index + match[0].length;
          const before = line.slice(0, match.index).match(/<!--\s*q:\s*(\d+(?:[–-]\d+)?)\s*-->$/);
          const after = line.slice(end).match(/^<!--\s*q:\s*(\d+(?:[–-]\d+)?)\s*-->/);
          const label = after || before;
          const labelFrom = after ? offset + end : offset + match.index - (before?.[0].length || 0);
          out.push({ from: offset + match.index, to: offset + end,
            ...(label ? { number: label[1], labelFrom, labelTo: labelFrom + label[0].length } : {}) });
        }
      }
    }
    offset += line.length + 1;
  }
  return out;
}

const readingDocRanges = new WeakMap();

function highlightsForDoc(doc) {
  if (!readingDocRanges.has(doc)) readingDocRanges.set(doc, sourceHighlights(doc.toString()));
  return readingDocRanges.get(doc);
}


// `#adj1` selects one main sense; `#n2.3` selects its third Chinese gloss.
// `#1` counts main senses across POS-less lines.
// It indexes the card's own Chinese block, so rewording a sense never breaks it.
const POS_RE = "n|v|adj|adv|prep|conj|pron|int|det|num";
function parseSenseId(value) {
  const m = String(value || "").trim().match(new RegExp(`^(?:zh)?#(${POS_RE})?(\\d+)(?:\\.(\\d+))?$`));
  return m ? { pos: m[1] || "", main: +m[2], sub: m[3] ? +m[3] : 0 } : null;
}

// Semicolons delimit main senses. Top-level commas delimit selectable Chinese
// glosses; commas inside a parenthetical usage label do not change numbering.
function senseItems(text) {
  const start = text.match(new RegExp(`^(?:${POS_RE})\\.\\s*`))?.[0].length || 0;
  const items = [];
  let from = start;
  const close = (end) => {
    let a = from, b = end;
    while (a < b && /\s/.test(text[a])) a++;
    while (b > a && /\s/.test(text[b - 1])) b--;
    if (b > a) {
      const subs = [];
      let depth = 0, part = a;
      const finish = end => {
        let x = part, y = end;
        while (x < y && /\s/.test(text[x])) x++;
        while (y > x && /\s/.test(text[y - 1])) y--;
        if (y > x) subs.push({ from: x, to: y });
        part = end + 1;
      };
      for (let i = a; i < b; i++) {
        if (/[（(]/.test(text[i])) depth++;
        else if (/[）)]/.test(text[i])) depth = Math.max(0, depth - 1);
        else if (!depth && /[,，]/.test(text[i])) finish(i);
      }
      finish(b);
      items.push({ from: a, to: b, subs });
    }
    from = end + 1;
  };
  for (let i = start; i < text.length; i++) if (/[;；]/.test(text[i])) close(i);
  close(text.length);
  return items;
}

function senseIdMatches(lines, id) {
  let count = 0;
  for (const [lineIndex, text] of lines.entries()) {
    const pos = text.match(new RegExp(`^(${POS_RE})\\.`))?.[1] || "";
    if (id.pos && pos !== id.pos) continue;
    const items = senseItems(text);
    const item = items[id.main - 1 - (id.pos ? 0 : count)];
    if (item) {
      // Ambiguous legacy main IDs never highlight several translations.
      const gloss = id.sub ? item.subs[id.sub - 1] : item.subs.length === 1 ? item.subs[0] : null;
      return gloss ? [{ lineIndex, from: gloss.from, to: gloss.to }] : [];
    }
    if (id.pos) return [];
    count += items.length;
  }
  return [];
}

function readingSenseMatches(lines, gloss) {
  if (!gloss) return [];
  const id = parseSenseId(gloss);
  if (id) return senseIdMatches(lines, id);
  // Optional POS disambiguates repeated definitions: "v. 发布".
  const tagged = gloss.match(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|int\.|det\.|num\.)\s+(.+)$/);
  const target = tagged ? tagged[2] : gloss;
  if (!target) return [];
  const hits = [], loose = [];
  let pos = "";
  for (const [lineIndex, text] of lines.entries()) {
    const prefix = text.match(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|int\.|det\.|num\.)\s*/);
    if (prefix) pos = prefix[1];
    if (tagged && tagged[1] !== pos) continue;
    let at = 0;
    while ((at = text.indexOf(target, at)) >= 0) {
      const start = prefix ? prefix[0].length : 0, end = at + target.length;
      // Full-width parentheses are part of a Chinese usage label, e.g.
      // 消费者（生物） or （植物的）腺, not a second occurrence of the generic sense.
      const before = c => !c || /[\s;；,，(]/.test(c);
      const after = c => !c || /[\s;；,，()]/.test(c);
      if ((at === start || before(text[at - 1])) && after(text[end])) hits.push({ lineIndex, from: at, to: end });
      else if (after(text[end]) && /[㐀-鿿]/.test(text[at - 1] || "")) {
        // A gloss that ends a longer item still names that sense: 长条 in 狭长条.
        let from = at;
        while (from > start && !before(text[from - 1])) from--;
        loose.push({ lineIndex, from, to: end });
      }
      at = end;
    }
  }
  return hits.length ? hits : loose;
}

// When no listed sense matches the gloss, pick the sense sharing the most
// characters with it (Dice score over character sets); the first one wins ties.
function nearestSense(lines, gloss) {
  if (parseSenseId(gloss)) return null;
  const target = new Set(String(gloss || "").replace(/^(?:n|v|adj|adv|prep|conj|pron|int|det|num)\.\s*/, "").replace(/[的地]/g, ""));
  if (!target.size) return null;
  let best = null, bestScore = 0;
  for (const [lineIndex, text] of lines.entries()) {
    const start = text.match(/^(?:n|v|adj|adv|prep|conj|pron|int|det|num)\.\s*/)?.[0].length || 0;
    for (const m of text.slice(start).matchAll(/[^;；,，()（）\s]+/g)) {
      const chars = new Set(m[0].replace(/[的地]/g, ""));
      const shared = [...chars].filter(c => target.has(c)).length;
      const score = chars.size ? 2 * shared / (chars.size + target.size) : 0;
      if (score > bestScore) {
        bestScore = score;
        best = { lineIndex, from: start + m.index, to: start + m.index + m[0].length };
      }
    }
  }
  return best;
}

function highlightReadingSense(root, gloss) {
  const lines = Array.from(root.children);
  const texts = lines.map(line => line.textContent);
  const hits = readingSenseMatches(texts, gloss);
  if (hits.length > 1) return false;
  const hit = hits[0];
  if (!hit) return false;
  const { lineIndex, from, to } = hit;
  const selected = senseItems(texts[lineIndex].slice(from, to));
  if (selected.length !== 1 || selected[0].subs.length !== 1) return false;
  const line = lines[lineIndex];
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT), parts = [];
  let node, offset = 0;
  while ((node = walker.nextNode())) {
    if (offset < to && from < offset + node.length) parts.push({ node, from: Math.max(0, from - offset), to: Math.min(node.length, to - offset) });
    offset += node.length;
  }
  for (const part of parts) {
    const range = document.createRange();
    range.setStart(part.node, part.from); range.setEnd(part.node, part.to);
    const mark = document.createElement("mark");
    mark.className = "hd-context-sense";
    range.surroundContents(mark);
  }
  return true;
}

// 英文释义编号: `en#1` / `en#v1` / `en#v1.2`。en 表示英文块(中文块写 zh#, 裸 # 兼容为 zh); 词性可省; 数字是该词性下第几个
// 主项(英文块里不带 • 的行, 词性行本身即第 1 主项); `.k` 是该主项下第 k 个 • 子项。
function parseEnglishSenseId(value) {
  const m = String(value || "").trim().match(new RegExp(`^en#(${POS_RE})?(\\d+)(?:\\.(\\d+))?$`));
  return m ? { pos: m[1] || "", main: +m[2], sub: m[3] ? +m[3] : 0 } : null;
}

// groups: [{ pos: "v.", rows: ["main", "sub", "sub", "main", ...] }], 与英文块渲染顺序一致。
// 返回 { group, row }(下标), 编号越界或无法唯一定位时返回 null。
function englishSenseTarget(groups, id) {
  if (!id) return null;
  let count = 0;
  for (const [group, g] of groups.entries()) {
    if (id.pos && g.pos !== id.pos + ".") continue;
    for (let row = 0; row < g.rows.length; row++) {
      if (g.rows[row] !== "main") continue;
      if (++count !== id.main) continue;
      if (!id.sub) return { group, row };
      let seen = 0;
      for (let k = row + 1; k < g.rows.length && g.rows[k] === "sub"; k++) {
        if (++seen === id.sub) return { group, row: k };
      }
      return null;
    }
  }
  return null;
}

function unwrapCardMarks(root) {
  root.querySelectorAll("mark, .cm-highlight").forEach(mark => mark.replaceWith(...mark.childNodes));
}

module.exports = { questionBlanks, bindParaphrase, parseSenseId, parseEnglishSenseId, englishSenseTarget, appendInline, EN_POS, readingNotePath, senseContext, chunkMatchesContext, appendMeaningInline, surfaceForm, sourceHighlights, bindReadingSenses, readingDocRanges, highlightsForDoc, readingSenseMatches, nearestSense, highlightReadingSense, unwrapCardMarks };

},
"hd/tables": function (module, exports, require) {
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

},
"hd/columns": function (module, exports, require) {
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

},
"hd/features/promote": function (module, exports, require) {
const { PROMOTE_CELL_SELECTOR } = require("../dom");

// 词头格右侧动作区(耳机所在)的悬浮状态。H 高亮按钮已移除: 词头高亮由评分 ≥ 1 在渲染层生成, 不再写笔记。
class PromoteMethods {
  setupPromoteButton() {
    this.lastMouse = null;
    this.registerDomEvent(document, "mousemove", (e) => {
      this.lastMouse = { x: e.clientX, y: e.clientY };
    }, true);
    // 耳机只在鼠标移到词头格右侧区域时才显示; 鼠标在词头文字一侧时不显示。
    const sync = (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (!t) return;
      this.syncActionZone(t.closest(PROMOTE_CELL_SELECTOR), e.clientX);
    };
    this.registerDomEvent(document, "mouseover", sync);
    this.registerDomEvent(document, "mousemove", sync);
  }

  // 词头格右侧按钮区域 = 格子的右内边距(耳机的地盘)。
  pointerInActionZone(td, x) {
    const rect = td.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(td).paddingRight) || 44;
    return x >= rect.right - pad;
  }

  syncActionZone(td, x) {
    if (this.zoneCell && this.zoneCell !== td) this.zoneCell.classList.remove("hd-actions-zone");
    this.zoneCell = td || null;
    if (!td) return this.hidePromote();
    const inZone = this.pointerInActionZone(td, x);
    td.classList.toggle("hd-actions-zone", inZone);
    if (inZone) this.setHoverCell(td);
    else this.hidePromote();
  }

  // 鼠标不动而内容在动(滚动、表格重绘)时浏览器不会补发 mouseover, 按鼠标最后的位置重新找它下面的单词格。
  refreshPromoteSoon() {
    if (this.unloading) return;
    cancelAnimationFrame(this.promoteRefreshFrame);
    this.promoteRefreshFrame = requestAnimationFrame(() => {
      const m = this.lastMouse;
      const stack = m ? document.elementsFromPoint(m.x, m.y) : [];
      const td = stack.map((el) => el.closest(PROMOTE_CELL_SELECTOR)).find(Boolean);
      this.syncActionZone(td || null, m ? m.x : 0);
    });
  }

  hidePromote() {
    this.setHoverCell(null);
    if (this.zoneCell) this.zoneCell.classList.remove("hd-actions-zone");
  }

  // 当前悬浮的单词格: 单词表的耳机只在这一格显示。
  setHoverCell(td) {
    if (this.hoverCell === td) return;
    if (this.hoverCell) this.hoverCell.classList.remove("hd-hover");
    this.hoverCell = td;
    if (td) td.classList.add("hd-hover");
  }
}

module.exports = { PromoteMethods };

},
"hd/features/tableSession": function (module, exports, require) {
const { markTable } = require("../tables");

class TableSessionMethods {
  // Finalize presentation as part of rendering, before native code measures
  // a cell, locks its dimensions, focuses its editor or scrolls to it.
  patchTableRender(table) {
    if (this.tableRenderProto) return;
    let widget = null;
    for (let n = table; n && !widget; n = n.parentElement) {
      const w = n.cmTile && n.cmTile.widget;
      if (w && typeof w.getClosestCell === "function") widget = w;
    }
    if (!widget) return;
    const proto = Object.getPrototypeOf(widget);
    if (typeof proto.render !== "function") return;
    const plugin = this;
    const originalRender = proto.render;
    proto.render = function (...args) {
      const result = originalRender.apply(this, args);
      if (this.tableEl) plugin.markTableNow(this.tableEl);
      return result;
    };
    this.tableRenderProto = { proto, original: originalRender };
  }

  markTableNow(table) {
    const leaf = this.app.workspace.getLeavesOfType("markdown").find((l) => l.view.containerEl.contains(table));
    const path = (leaf && leaf.view.file && leaf.view.file.path) || "";
    markTable(table, path);
  }
}

module.exports = { TableSessionMethods };

},
"hd/features/library": function (module, exports, require) {
const { TFile } = require("obsidian");
const { libraryKind, libraryPriority, parseTables } = require("../library");
const { articleNotePath, isPluginExcludedNote } = require("../../shared/notes");

class LibraryMethods {
  async reindex(file) {
    if (!(file instanceof TFile) || file.extension !== "md") return;
    if (isPluginExcludedNote(file)) {
      this.fileEntries.delete(file.path);
      return;
    }
    const content = await this.app.vault.cachedRead(file);
    if (this.unloading) return;
    const entries = parseTables(content, file.path);
    const firstIndex = !this.sourceContents.has(file.path);
    const changed = !firstIndex && this.sourceContents.get(file.path) !== content;
    this.sourceContents.set(file.path, content);
    if (entries.length) this.fileEntries.set(file.path, entries);
    else this.fileEntries.delete(file.path);
    if (libraryKind(file.path)) {
      this.libraryRevision++;
      if (this.libraryReady) this.refreshLibraryViews();
    }
    if (articleNotePath(file.path) && (firstIndex || changed)) {
      this.libraryRevision++;
      for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
        if (leaf.view.file?.path === file.path) leaf.view.editor?.cm?.dispatch({});
      }
    }
    if (changed) {
      this.hide();
      for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
        if (leaf.view.file?.path === file.path && leaf.view.getMode?.() === "preview") leaf.view.previewMode?.rerender(true);
      }
    }
  }

  refreshLibraryViews() {
    if (this.unloading) return;
    this.hide();
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      leaf.view.editor?.cm?.dispatch({});
      if (leaf.view.getMode?.() === "preview") leaf.view.previewMode?.rerender(true);
    }
  }

  async loadLibraries() {
    if (this.libraryReady) return;
    if (this.libraryLoad) return this.libraryLoad;
    const files = this.app.vault.getMarkdownFiles().filter(file => libraryKind(file.path))
      .sort((a, b) => a.path.localeCompare(b.path));
    this.libraryLoad = Promise.all(files.map(file => this.reindex(file))).then(() => { this.libraryReady = true; })
      .finally(() => { this.libraryLoad = null; });
    return this.libraryLoad;
  }

  entriesFor(path) {
    // 文章只查本篇自己的单词表与短语表; 直接读最新索引, 不缓存, 以免文章改动后仍用旧词条。
    if (articleNotePath(path)) return this.fileEntries.get(path) || [];
    if (!this.entriesCache) this.entriesCache = new Map();
    const revision = Number.isFinite(this.libraryRevision) ? this.libraryRevision : 0;
    const cacheKey = `${revision}:${path}`;
    if (this.entriesCache.has(cacheKey)) return this.entriesCache.get(cacheKey);
    const entries = [...(this.fileEntries.get(path) || [])];
    // Context phrases used to live beside words. Keep them ahead of generic
    // phrases when both libraries contain the same expression after migration.
    for (const [other, rows] of [...this.fileEntries].sort(([a], [b]) => libraryPriority(a) - libraryPriority(b) || a.localeCompare(b))) {
      if (other !== path && libraryKind(other)) entries.push(...rows);
    }
    if (this.entriesCache.size > 20) this.entriesCache.clear();
    this.entriesCache.set(cacheKey, entries);
    return entries;
  }

  // Index both complete library trees and the hovered note; vault events keep them current.
  async ensureIndex(file) {
    await this.loadLibraries();
    if (file && !this.sourceContents.has(file.path)) await this.reindex(file);
  }

  hasReadingEntry(text, annotation, path, library = false) {
    // 文章不再写 search 注释: 本篇表里查得到即为词条高亮。
    if (!annotation?.gloss?.trim()) return articleNotePath(path) ? Boolean(this.lookup(text, path, "", !library)) : false;
    if (!this.libraryReady && !this.fileEntries.size) return false;
    if (annotation) {
      if (this.lookupAnnotation(annotation, path)) return true;
      if (annotation.reference && this.lookup(annotation.reference, path, "", !library)) return true;
      if (annotation.word && this.lookup(annotation.word, path, "", !library)) return true;
    }
    return Boolean(this.lookup(text, path, "", !library));
  }
}

module.exports = { LibraryMethods };

},
"hd/features/readingWords": function (module, exports, require) {
const { normalize } = require("../dom");
const { highlightsForDoc, readingNotePath, surfaceForm, questionBlanks } = require("../reading");
const { articleNotePath } = require("../../shared/notes");

class ReadingWordMethods {
  setupReadingWords() {
    const { Decoration, ViewPlugin, EditorView, WidgetType } = require("@codemirror/view");
    class AnswerBlank extends WidgetType {
      constructor(number = "") { super(); this.number = number; }
      eq(other) { return other.number === this.number; }
      toDOM() {
        const span = document.createElement("span");
        span.className = "hd-answer-blank";
        span.textContent = "________";
        if (this.number) span.dataset.hdQuestionNumber = this.number;
        return span;
      }
    }
    const { editorInfoField, editorLivePreviewField } = require("obsidian");
    const plugin = this;
    this.registerEditorExtension(ViewPlugin.fromClass(class {
      constructor(view) {
        this.libraryRevision = -1;
        this.rebuild(view);
      }
      update(update) {
        const path = update.state.field(editorInfoField, false)?.file?.path || "";
        const live = update.state.field(editorLivePreviewField, false);
        const revision = plugin.libraryRevision;
        const highlightRevision = plugin.highlightRevision || 0;
        if (update.docChanged || path !== this.path || live !== this.live || revision !== this.libraryRevision
          || highlightRevision !== this.highlightRevision) {
          this.rebuild(update.view);
        }
      }
      rebuild(view) {
        this.path = view.state.field(editorInfoField, false)?.file?.path || "";
        this.live = view.state.field(editorLivePreviewField, false);
        this.libraryRevision = plugin.libraryRevision;
        this.highlightRevision = plugin.highlightRevision || 0;
        this.decorations = Decoration.none;
        this.hiddenAnnotations = Decoration.none;
        const blankRanges = this.live && /(?:^|\/)(?:05\. listening|06\. reading)\//.test(this.path)
          ? questionBlanks(view.state.doc.toString()) : [];
        const blankLabels = blankRanges.filter(r => r.labelFrom !== undefined).map(r =>
          Decoration.replace({}).range(r.labelFrom, r.labelTo));
        const blanks = [...blankLabels, ...blankRanges.map(r =>
          Decoration.replace({ widget: new AnswerBlank(r.number) }).range(r.from, r.to))];
        const passageMarks = ranges => ranges.map(r => {
          // 文章(阅读、听力)里以本篇表格是否收录判断; 其余笔记沿用「无注释即纯高亮」。
          const isPlain = !r.para && (articleNotePath(this.path)
            ? !plugin.hasReadingEntry(r.text, r.annotation, this.path) && !plugin.lookup(r.text, this.path, "", true)
            : !r.annotation);
          let cls = r.question ? "hd-passage-highlight hd-question-highlight" : "hd-passage-highlight";
          if (isPlain) cls += " hd-plain-highlight";
          return Decoration.mark({
            class: cls,
            attributes: { "data-hd-highlight": String(r.from) },
          }).range(r.from + 2, r.to - 2);
        });
        // 听力笔记只隐藏 search 注释(与阅读一致), 悬浮卡片仍走听力专用逻辑。
        if (/(?:^|\/)05\. listening\//.test(this.path) && this.live) {
          const all = highlightsForDoc(view.state.doc);
          const notes = all.filter(r => r.annotationRange).map(r =>
            Decoration.replace({}).range(r.annotationRange.from, r.annotationRange.to));
          this.hiddenAnnotations = Decoration.set([...notes, ...blanks], true);
          const paras = all.filter(r => r.para).map(r =>
            Decoration.mark({ class: "hd-para-word", attributes: { "data-hd-para": r.para } }).range(r.from + 2, r.to - 2));
          this.decorations = Decoration.set([...notes, ...blanks, ...passageMarks(all), ...paras], true);
          return;
        }
        if (!readingNotePath(this.path)) return;
        const ranges = highlightsForDoc(view.state.doc);
        const hidden = this.live ? ranges.filter(r => r.annotationRange).map(r =>
          Decoration.replace({}).range(r.annotationRange.from, r.annotationRange.to)) : [];
        if (this.live) this.hiddenAnnotations = Decoration.set([...hidden, ...blanks], true);
        const paras = ranges.filter(r => r.para).map(r =>
          Decoration.mark({ class: "hd-para-word", attributes: { "data-hd-para": r.para } }).range(r.from + 2, r.to - 2));
        const words = ranges
          .filter(r => !r.para && /[a-z]/i.test(r.text) && !/[\u3400-\u9fff]/.test(r.text) && plugin.hasReadingEntry(r.text, r.annotation, this.path))
          .map(r => Decoration.mark({ class: "hd-reading-word" }).range(r.from + 2, r.to - 2));
        // 关闭展示高亮: 两侧 == 标记隐藏, 高亮词不加底色; 纯高亮(无 search/para)不加隐藏 marker 保持原生展示; 悬浮卡片与朗读仍靠词标记工作, 源码模式同样生效。
        if (plugin.hideReadingHighlights()) {
          const markers = ranges.filter(r => !r.para && (r.annotation || plugin.hasReadingEntry(r.text, null, this.path))).flatMap(r => [
            Decoration.replace({}).range(r.from, r.from + 2),
            Decoration.replace({}).range(r.to - 2, r.to)]);
          this.decorations = Decoration.set([...hidden, ...blanks, ...markers, ...passageMarks(ranges), ...words, ...paras], true);
          return;
        }
        if (!this.live) return;
        this.decorations = Decoration.set([...hidden, ...blanks, ...passageMarks(ranges), ...words, ...paras], true);
      }
    }, {
      decorations: instance => instance.decorations,
      // Arrow keys skip invisible metadata rather than moving through dozens
      // of hidden characters. Source mode remains fully editable.
      provide: extension => EditorView.atomicRanges.of(view =>
        view.plugin(extension)?.hiddenAnnotations || Decoration.none),
    }));
  }

  readingOccurrence(el, path) {
    if (!readingNotePath(path)) return null;
    const leaf = this.app.workspace.getLeavesOfType("markdown").find(l => l.view.containerEl.contains(el));
    const cm = leaf?.view.editor?.cm;
    if (el.closest(".cm-editor")) {
      if (!cm) return null;
      try {
        const { editorInfoField } = require("obsidian");
        const editorPath = cm.state.field?.(editorInfoField, false)?.file?.path;
        if (editorPath && editorPath !== path) return null;
        const at = cm.posAtDOM(el);
        return highlightsForDoc(cm.state.doc).find(r => r.from <= at && at < r.to) || null;
      } catch (_) { return null; }
    }
    const mark = el.closest("mark");
    if (mark?.dataset.hdSensePath && mark.dataset.hdSensePath !== path) return null;
    return mark ? { text: normalize(mark.textContent), annotation: mark.dataset.hdSenseWord
      ? { word: mark.dataset.hdSenseWord, gloss: mark.dataset.hdSenseGloss,
        surface: mark.dataset.hdSenseSurface ?? null,
        ...(mark.dataset.hdSenseReference ? { reference: mark.dataset.hdSenseReference } : {}),
        changed: mark.dataset.hdSenseSurface !== undefined && mark.dataset.hdSenseSurface !== surfaceForm(mark.textContent) } : null } : null;
  }

  readingSense(el, path) {
    return this.readingOccurrence(el, path)?.annotation || null;
  }

  clearReadingHighlight() {
    for (const node of this.activeReadingNodes || []) {
      node.classList.remove("hd-reading-active");
      node.style.removeProperty("--hd-reading-active-bg");
    }
    this.activeReadingNodes = null;
  }

  highlightReadingOccurrence(el, path, occurrence) {
    this.clearReadingHighlight();
    if (!occurrence || !readingNotePath(path)) return;
    const nodes = [];
    if (el.closest(".cm-editor")) {
      const leaf = this.app.workspace.getLeavesOfType("markdown").find(l => l.view.containerEl.contains(el));
      const cm = leaf?.view.editor?.cm;
      if (!cm || occurrence.from === undefined) return;
      // One source occurrence may have several rendered spans (bold, wrapping,
      // token boundaries). Highlight only spans inside that exact occurrence.
      for (const node of el.closest(".cm-editor").querySelectorAll(".hd-reading-word")) {
        try {
          const at = cm.posAtDOM(node);
          if (occurrence.from + 2 <= at && at < occurrence.to - 2) nodes.push(node);
        } catch (_) { /* A redraw can detach a span while moving the pointer. */ }
      }
    } else {
      const mark = el.closest("mark.hd-reading-word");
      if (mark) nodes.push(mark);
    }
    const scope = el.closest(".markdown-rendered, .cm-content") || el.parentElement;
    const background = scope && getComputedStyle(scope).getPropertyValue("--text-highlight-bg").trim();
    for (const node of nodes) {
      if (background) node.style.setProperty("--hd-reading-active-bg", background);
      node.classList.add("hd-reading-active");
    }
    this.activeReadingNodes = nodes;
  }
}

module.exports = { ReadingWordMethods };

},
"hd/features/tooltip": function (module, exports, require) {
const { Platform } = require("obsidian");
const { QTYPE, definitionOnly } = require("../columns");
const { LEADING_BREAKS, cellMarkdown, headerText, normalize, wordCellOf } = require("../dom");
const { candidates, cellHeadword, composeDecomp, detailColumn, libraryKind, libraryPriority } = require("../library");
const { parseSenseId, parseEnglishSenseId, englishSenseTarget, EN_POS, appendInline, appendMeaningInline, chunkMatchesContext, highlightReadingSense, readingNotePath, readingSenseMatches, unwrapCardMarks } = require("../reading");
const { articleNotePath, isPluginExcludedNote, listeningNotePath } = require("../../shared/notes");
const { contextCardColumn } = require("../tables");

// 文章没有 search 注释时, 在本篇词条里找这处高亮对应的行:
// 1. 意群原句包含这处高亮, 且词头与高亮至少有一个词同根;
// 2. 否则取词头实词全部能在高亮里找到同根词的行(took over → take over, a trusted circle → circle)。
const PLACEHOLDER = /^(?:\.\.\.\S*|…\S*|aaa|bbb|ccc|ddd|one's|someone's|sb|sth|doing|\(be\))$/;
const STOP = new Set(["a", "an", "the", "of", "to", "in", "on", "at", "for", "by", "with", "and", "or", "as", "is", "are", "was", "were", "be"]);
function wordsOf(text) {
  return normalize(text || "").replace(/[^\p{L}\p{N}'’\-. ]+/gu, " ").split(/\s+/)
    .map(w => w.replace(/^\.+(?=\p{L})/u, "").replace(/(?<=\p{L})\.+$/u, "")).filter(w => w && !/^\.$/.test(w));
}
function parts(words) {
  return words.flatMap(w => [w, ...(w.includes("-") ? w.split("-") : [])]).filter(Boolean);
}
function sameRoot(a, b) {
  if (a === b || a.replace(/-/g, "") === b.replace(/-/g, "")) return true;
  const n = Math.min(a.length, b.length);
  if (n < 4) return false;
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i >= Math.min(5, n) || (i >= 4 && i >= n - 1);
}
function articleFallback(local, text) {
  const words = wordsOf(text);
  const target = words.join(" ");
  if (!target) return null;
  const forms = parts(words).flatMap(w => candidates(w));
  const has = h => forms.some(t => sameRoot(h, t));
  let best = null, bestScore = 0;
  for (const e of local) {
    const head = wordsOf(e.word).filter(w => !PLACEHOLDER.test(w));
    const content = head.filter(w => !STOP.has(w));
    const shared = content.filter(has).length;
    const inSentence = (" " + wordsOf(e.chunk).join(" ") + " ").includes(" " + target + " ");
    const covered = content.length > 0 && shared === content.length;
    const insideHead = inSentence && words.every(w => STOP.has(w) || head.includes(w));
    if (!((inSentence && shared) || covered || insideHead)) continue;
    const score = (inSentence ? 100 : 0) + (covered ? 50 : 0) + shared * 10 - Math.abs(head.length - words.length);
    if (score > bestScore) { best = e; bestScore = score; }
  }
  return best;
}

class TooltipMethods {
  // 中文释义：每个词性一行，直接取自笔记。
  renderMeaning(meaning, annotation = null, preserveHighlights = !annotation) {
    const box = this.tip.createDiv({ cls: "hd-meaning hd-zh-block" });
    const lines = meaning.split(/<br\s*\/?>/i).map(l => l.trim()).filter(Boolean);
    lines.forEach((line, i) => {
      // 不同词性之间空一行
      const gap = i > 0 && /^[a-z]+\.\s/.test(line.replace(/<[^>]*>|\*\*|==/g, ""));
      appendMeaningInline(box.createDiv({ cls: gap ? "hd-zh-line hd-pos-gap" : "hd-zh-line" }), line, preserveHighlights);
    });
    if (annotation && !parseEnglishSenseId(annotation.gloss)) highlightReadingSense(box, annotation.gloss);
  }

  // 注释为英文编号(#e1 / #ev1.2)时, 在英文块里高亮对应的主项或子项。
  highlightEnglishSense(box, gloss) {
    const id = parseEnglishSenseId(gloss);
    if (!id) return false;
    const groups = [], holders = [];
    let current = null;
    for (const el of box.children) {
      if (el.classList.contains("hd-en-pos-tag")) {
        current = { pos: el.textContent.trim(), rows: [] };
        groups.push(current); holders.push([]);
      } else if (el.classList.contains("hd-en-body") && current) {
        for (const row of el.children) {
          const sub = row.classList.contains("hd-en-sub");
          current.rows.push(sub ? "sub" : "main");
          holders[holders.length - 1].push(sub ? row.lastElementChild : row);
        }
      }
    }
    const hit = englishSenseTarget(groups, id);
    const holder = hit && holders[hit.group][hit.row];
    if (!holder) return false;
    const mark = document.createElement("mark");
    mark.className = "hd-context-sense";
    mark.textContent = holder.textContent;
    holder.textContent = "";
    holder.appendChild(mark);
    return true;
  }

  // Explicit dictionary cross-references stay article-local. They never change
  // the primary word card or the hovered source range.
  renderSenseReference(annotation, path) {
    const entry = this.lookupAnnotation({ word: annotation.reference, gloss: annotation.gloss }, path);
    this.tip.createDiv({ cls: "hd-current-sense", text: `本文用法参见: ${annotation.reference}` });
    if (!entry) {
      this.tip.createDiv({ cls: "hd-current-sense", text: "参照词条未找到, 请核对" });
      return false;
    }
    const meaning = entry.decomp.split(/<br\s*\/?>\s*<br\s*\/?>/i).map(s => s.trim()).find(s => s && !/^\/[^/]+\/$/.test(s)) || "";
    this.renderMeaning(meaning, annotation);
    return true;
  }

  // 牛津英文释义：`v. 主项<br>&emsp;• 子项<br>主项<br>n. 主项`，不编号。
  // 整块是两列网格：左列词性，右列释义；所有词性的主项共用右列左对齐，子项圆点再缩进一级。
  renderEnglishBlock(enText, container, gloss = null) {
    const box = container.createDiv({ cls: "hd-en-block" });
    let body = null;
    const group = (pos) => {
      box.createDiv({ cls: "hd-en-pos-tag", text: pos });
      body = box.createDiv({ cls: "hd-en-body" });
    };
    for (const raw of enText.split(/<br\s*\/?>/i)) {
      const line = raw.replace(/&emsp;|&nbsp;/g, " ").trim();
      if (!line) continue;
      const sub = line.match(/^•\s*(.+)$/);
      if (sub) {
        if (!body) group("");
        const item = body.createDiv({ cls: "hd-en-sub" });
        item.createSpan({ cls: "hd-en-bullet", text: "•" });
        item.createSpan({ text: sub[1] });
        continue;
      }
      const pos = line.match(EN_POS);
      if (pos || !body) group(pos ? pos[1] : "");
      const text = pos ? pos[2] || "" : line;
      if (text) body.createDiv({ cls: "hd-en-main", text });
    }
    if (gloss) this.highlightEnglishSense(box, gloss);
  }

  fileFor(el) {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      if (leaf.view.containerEl.contains(el)) return leaf.view.file;
    }
    return this.app.workspace.getActiveFile();
  }

  // 文章只查本篇自己的表; 其余笔记查询当前笔记与整个 02. word / 03. phrase。
  // 文章本篇表里查不到时(且未要求 localOnly), 回退到 02. word 词库显示卡片; 录入时仍必须补进本篇表。
  lookup(text, path, context = "", localOnly = false) {
    const hit = this.lookupLocal(text, path, context);
    if (hit || localOnly || !articleNotePath(path) || listeningNotePath(path)) return hit;
    return this.lookupWordLibrary(text, context);
  }

  lookupWordLibrary(text, context = "") {
    const keys = candidates(text);
    const cacheKey = `wordlib:${this.libraryRevision}`;
    if (!this.entriesCache) this.entriesCache = new Map();
    let rows = this.entriesCache.get(cacheKey);
    if (!rows) {
      rows = [...this.fileEntries].filter(([p]) => libraryKind(p) === "word").sort(([a], [b]) => libraryPriority(a) - libraryPriority(b) || a.localeCompare(b)).flatMap(([, r]) => r).filter(e => e.decomp);
      if (this.entriesCache.size > 20) this.entriesCache.clear();
      this.entriesCache.set(cacheKey, rows);
    }
    const singleWord = !/\s/.test(normalize(text));
    const exact = keys.flatMap(key => rows.filter(e => e.word === key));
    let hit = exact.find(e => chunkMatchesContext(e, context)) || exact[0];
    if (!hit) for (const key of keys) {
      const hits = rows.filter(e => e.keys.has(key) && (!singleWord || !/\s/.test(e.word.replace(/\s*\/\s*/g, "/"))));
      if (hits.length) { hit = hits.find(e => chunkMatchesContext(e, context)) || hits[0]; break; }
    }
    return hit ? { ...hit, fromLibrary: true } : null;
  }

  lookupLocal(text, path, context = "") {
    const keys = candidates(text);
    const local = this.entriesFor(path).filter((e) => e.decomp);
    // Prefer an actual headword over another entry's bold-example alias.
    // Otherwise sustainable can resolve to sustain, or negotiate to a phrase.
    const exact = keys.flatMap(key => local.filter(e => e.word === key));
    if (exact.length) return exact.find(e => chunkMatchesContext(e, context)) || exact[0];
    const singleWord = !/\s/.test(normalize(text));
    for (const key of keys) {
      // `harbour / harbor` 这类英美拼写词头仍算单词。
      const hits = local.filter((e) => e.keys.has(key) && (!singleWord || !/\s/.test(e.word.replace(/\s*\/\s*/g, "/"))));
      if (hits.length) return hits.find((e) => chunkMatchesContext(e, context)) || hits[0];
    }
    return articleNotePath(path) ? articleFallback(local, text) : null;
  }

  lookupListening(text, path, context = "") {
    const source = listeningNotePath(path);
    if (!source) return null;
    const keys = candidates(text);
    const cacheKey = `listening:${this.libraryRevision}:${source}`;
    let rows = this.entriesCache.get(cacheKey);
    if (!rows) {
      rows = [...this.fileEntries.values()].flat().filter(entry => listeningNotePath(entry.sourcePath) === source);
      if (this.entriesCache.size > 20) this.entriesCache.clear();
      this.entriesCache.set(cacheKey, rows);
    }
    const entries = rows.filter(entry => entry.decomp && keys.some(key => entry.keys.has(key)));
    // Prefer a real headword, then this occurrence's complete chunk.
    const exact = entries.filter(entry => keys.includes(entry.word));
    const matches = exact.length ? exact : entries;
    return matches.find(entry => chunkMatchesContext(entry, context)) || matches[0] || null;
  }

  // Article annotations select an exact headword and a compatible part of speech.
  // Prefer a definition containing the selected sense across duplicate wordbooks.
  lookupAnnotation(annotation, path) {
    const id = parseSenseId(annotation.gloss);
    const tagged = !annotation.reference && (id?.pos ? [null, id.pos + "."] : annotation.gloss.match(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|int\.|det\.|num\.)\s+/));
    const matches = this.entriesFor(path).filter(e => e.word === normalize(annotation.word) && e.decomp).map(entry => {
      const meaning = entry.decomp.split(/<br\s*\/?>\s*<br\s*\/?>/i).map(s => s.trim()).find(s => s && !/^\/[^/]+\/$/.test(s)) || "";
      const lines = meaning.split(/<br\s*\/?>/i).map(s => s.replace(/<[^>]*>|\*\*|==/g, "").trim()).filter(Boolean);
      const positions = lines.map(s => s.match(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|int\.|det\.|num\.)\s*/)?.[1]).filter(Boolean);
      return { entry, lines, compatible: !tagged || !positions.length || positions.includes(tagged[1]) };
    }).filter(hit => hit.compatible);
    return (matches.find(hit => readingSenseMatches(hit.lines, annotation.gloss).length === 1) || matches[0])?.entry || null;
  }

  // 表格行只读取本行释义与拆解; 拆解为空时仍可单独显示本行意群。
  lookupRow(row, path) {
    const table = row.closest("table");
    const headers = Array.from(table?.querySelector("thead tr, tr")?.cells || [], headerText);
    const column = detailColumn(headers);
    if (column < 0) return null;
    let decomp = cellMarkdown(row.cells[column]).replace(LEADING_BREAKS, "");
    const meaningColumn = headers[column] === "释义" || !headers.some((h) => /拆解|英意/.test(h)) ? -1 : headers.indexOf("释义");
    const memoryColumn = headers[column] === "释义" ? -1 : headers.indexOf("记忆");
    const meaningMd = meaningColumn >= 0 && row.cells[meaningColumn] ? cellMarkdown(row.cells[meaningColumn]) : "";
    const memoryMd = memoryColumn >= 0 && row.cells[memoryColumn] ? cellMarkdown(row.cells[memoryColumn]) : "";
    if (meaningMd || memoryMd) decomp = composeDecomp(meaningMd, decomp, memoryMd);
    if (!decomp.trim()) return null;
    const synColumn = headers.indexOf("同义词");
    const syn = synColumn >= 0 && row.cells[synColumn] ? cellMarkdown(row.cells[synColumn]).trim() : "";
    const phColumn = headers.indexOf("音标");
    const phBlock = decomp.split(/<br\s*\/?>\s*<br\s*\/?>/i).find((part) => /^\/[^/]+\/$/.test(part.trim()));
    // 单词表的音标写在单词格第二行(`word<br>/音标/`), 页面上隐藏, 只在卡片显示。
    const wordLines = cellMarkdown(wordCellOf(row)).replace(LEADING_BREAKS, "").split(/<br\s*\/?>/i).map((s) => s.trim());
    const wordPh = wordLines.slice(1).find((s) => /^\/[^/]+\/$/.test(s)) || "";
    const ph = (phColumn >= 0 ? cellMarkdown(row.cells[phColumn]) : phBlock || wordPh).replace(/^\/|\/$/g, "").trim();
    return { word: normalize(cellHeadword(wordCellOf(row))), decomp, ph, path, isMeaning: headers[column] === "释义", ...(syn ? { syn } : {}) };
  }

  appendEntrySources(entry, path) {
    // 文章卡片不显示来源。
    if (!entry?.path || !readingNotePath(path) || articleNotePath(path)) return;
    const paths = new Set([entry.path]);
    for (const other of this.entriesFor(path)) {
      if (other.word === entry.word && other.path) paths.add(other.path);
    }
    const footer = this.tip.createDiv({ cls: "hd-entry-sources" });
    for (const source of paths) {
      footer.createDiv({ text: source.replace(/\.md$/i, "") });
    }
  }

  appendQuestionTypes(row) {
    const types = [];
    for (const q of row.querySelectorAll(".hd-qtype")) {
      const m = q.textContent.trim().match(QTYPE);
      if (m && !types.includes(m[1])) types.push(m[1]);
    }
    if (types.length) this.tip.createDiv({ cls: "hd-qtypes", text: types.join(" · ") });
  }

  appendRowContext(row, parent = this.tip) {
    const table = row.closest("table.hd-context-card");
    if (!table) return false;
    const names = Array.from(table.querySelector("thead tr, tr")?.cells || [], headerText);
    const column = contextCardColumn(names, this.fileFor(row)?.path || "");
    const cell = row.cells[column];
    const content = cell && (cell.querySelector(":scope > .table-cell-wrapper") || cell).cloneNode(true);
    if (!content) return false;
    content.querySelectorAll("button, .audio-playback-btn, .hd-promote, .cm-editor, .hd-br-space, .hd-qtype").forEach(node => node.remove());
    content.querySelectorAll(".hd-br-hidden").forEach(br => br.classList.remove("hd-br-hidden"));
    if (!content.textContent.trim()) return false;
    const block = parent.createDiv({ cls: "hd-card-context" });
    block.createSpan({ cls: "hd-card-context-body" }).append(...content.childNodes);
    return true;
  }

  showRowContext(row, anchor) {
    this.tip.empty();
    if (!this.appendRowContext(row)) return this.hide();
    this.appendQuestionTypes(row);
    this.tip.show();
    this.position(row, anchor);
  }

  showPhrase(row, anchor) {
    const isBase = !!row.closest(".hd-base-table");
    const cell = isBase ? row.cells[1] : row.cells[0];
    const hidden = cell && cell.querySelector(".hd-phrase-meaning");
    if (!hidden || !hidden.textContent.trim()) return this.hide();
    this.tip.empty();
    const body = this.tip.createDiv({ cls: "hd-meaning hd-phrase-body" });
    body.append(...hidden.cloneNode(true).childNodes);
    unwrapCardMarks(body);
    // The clone starts with the two <br> that separated phrase from 释义.
    Array.from(body.querySelectorAll("br")).slice(0, 2).forEach((br) => br.remove());
    if (isBase) {
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      const gloss = walker.nextNode();
      if (gloss && /[;；]/.test(gloss.nodeValue)) {
        const fragment = document.createDocumentFragment();
        gloss.nodeValue.split(/[;；]/).map((part) => part.trim()).filter(Boolean).forEach((part, i) => {
          if (i) fragment.appendChild(document.createElement("br"));
          fragment.appendChild(document.createTextNode(part));
        });
        gloss.replaceWith(fragment);
      }
    }
    const examples = row.querySelectorAll(".hd-ex-meaning");
    if (examples.length) {
      const list = this.tip.createDiv({ cls: "hd-decomp hd-examples" });
      examples.forEach((ex, i) => {
        if (i > 0) list.createEl("br");
        list.createEl("strong", { text: ex.dataset.word });
        list.appendText(" " + ex.textContent.trim());
      });
    }
    this.appendQuestionTypes(row);
    this.tip.show();
    this.position(row, anchor);
  }

  // Column tables: the hidden cells' rendered content, one block per column.
  showColumns(row, anchor) {
    const hidden = row.closest(".hd-column-table").dataset.hdHidden.split(",").map(Number);
    this.tip.empty();
    for (const i of hidden) {
      const cell = row.cells[i];
      if (!cell) continue;
      const content = (cell.querySelector(":scope > .table-cell-wrapper") || cell).cloneNode(true);
      content.querySelectorAll("button, .audio-playback-btn").forEach((b) => b.remove());
      if (!content.textContent.trim()) continue;
      const block = this.tip.createDiv({ cls: this.tip.childElementCount ? "hd-decomp" : "hd-meaning" });
      block.append(...content.childNodes);
      unwrapCardMarks(block);
    }
    if (!this.tip.childElementCount) return this.hide();
    this.tip.show();
    this.position(row, anchor);
  }

  showBaseExamples(row) {
    const cell = row.cells[2];
    const content = cell && (cell.querySelector(":scope > .table-cell-wrapper") || cell).cloneNode(true);
    if (!content) return this.hide();
    content.querySelectorAll("button, .audio-playback-btn, .cm-editor").forEach((node) => node.remove());
    if (!content.textContent.trim()) return this.hide();
    this.tip.empty();
    this.tip.createDiv({ cls: "hd-base-examples-body" }).append(...content.childNodes);
    this.tip.show();
    this.position(row, row.cells[0]);
  }

  async show(el, anchor) {
    this.cancelHide();
    // Clear the previous card before any asynchronous lookup for the new content.
    this.stopListeningHover();
    this.tip.hide();
    this.clearReadingHighlight();
    if (isPluginExcludedNote(this.fileFor(el))) {
      const row = el.closest(".hd-base-examples-table tr.hd-row");
      const cell = anchor && anchor.closest("td, th");
      if (!row || (cell !== row.cells[0] && cell !== row.cells[1])) return this.hide();
      ++this.hoverToken;
      this.activeEl = el;
      this.activeCell = anchor;
      return this.showBaseExamples(row);
    }
    // 高亮更新期间不弹卡片。
    if (this.promotePending) return;
    if (el.matches("tr.hd-row") && el.closest(".hd-phrase-library") && !el.closest(".hd-context-card")) return this.hide();
    const token = ++this.hoverToken;
    this.activeEl = el;
    this.activeCell = anchor || (el.matches("tr") ? wordCellOf(el) : el);
    if (el.matches("tr.hd-row") && el.closest(".hd-phrase-library.hd-context-card")) return this.showRowContext(el, anchor);
    const para = (el.closest?.("[data-hd-para]") || el.querySelector?.("[data-hd-para]"))?.dataset?.hdPara;
    if (para) return this.showParaphrase(el, anchor, para);
    if (el.matches("tr.hd-row") && el.closest(".hd-phrase-table, .hd-base-table")) return this.showPhrase(el, anchor);
    if (el.matches("tr.hd-row") && el.closest(".hd-column-table")) return this.showColumns(el, anchor);
    const isRow = el.matches("tr.hd-row");
    const text = isRow ? cellHeadword(wordCellOf(el)) : el.textContent || "";
    if (!text.trim()) return this.hide();
    const file = this.fileFor(el);
    if (!isRow) await this.ensureIndex(file);
    const path = file ? file.path : "";
    const occurrence = isRow ? null : this.readingOccurrence(el, path);
    const annotation = occurrence?.annotation || null;
    if (annotation?.changed) {
      if (token !== this.hoverToken || this.activeEl !== el) return;
      this.tip.empty();
      this.tip.createDiv({ cls: "hd-current-sense", text: "正文已改动, 请核对词义" });
      this.tip.show();
      this.position(el, anchor);
      return;
    }
    if (!annotation && text.length > 60) return this.hide();
    const context = isRow ? "" : (el.closest("p, li, blockquote, .cm-line") || el.parentElement)?.textContent || "";
    const entry = isRow ? this.lookupRow(el, path) : annotation
      ? this.lookupAnnotation(annotation, path)
      : el.matches("mark, .cm-highlight") ? this.lookup(occurrence?.text || text, path, context) : null;
    if (token !== this.hoverToken || this.activeEl !== el) return;
    if (!entry?.decomp) {
      if (isRow && el.closest(".hd-context-card")) return this.showRowContext(el, anchor);
      if (!annotation) return this.hide();
      this.tip.empty();
      this.tip.createDiv({ cls: "hd-head-row" }).createDiv({ cls: "hd-headword", text: normalize(annotation.word) });
      this.tip.createDiv({ cls: "hd-current-sense", text: parseSenseId(annotation.gloss) ? `本文义编号 ${annotation.gloss}, 词库未收录` : `本文义: ${annotation.gloss}` });
      this.highlightReadingOccurrence(el, path, occurrence);
      this.tip.show();
      this.position(el, anchor);
      return;
    }

    if (!isRow && listeningNotePath(path)) {
      this.tip.empty();
      // 听力原文卡片: 词条来自本篇词表, 释义里的 ==...== 就是本篇语境义项, 照样高亮。
      this.renderMeaning(definitionOnly(entry.decomp), null, "context");
      const resolved = this.tableSound?.resolveListeningAudio(entry);
      this.tip.show();
      this.position(el, anchor);
      if (resolved?.paths.length && this.tableSound?.settings?.listeningHoverAudio) {
        this.listeningHoverAudio = true;
        this.tableSound.stopCurrentAudio();
        void this.tableSound.playResolvedAudio(el, resolved);
      }
      return;
    }

    let parts = entry.decomp.split(/<br\s*\/?>\s*<br\s*\/?>/).map((p) => p.trim()).filter(Boolean);
    let ph = entry.ph || "";

    parts = parts.filter((part) => {
      if (!/^\/[^/]+\/$/.test(part)) return true;
      if (!ph) ph = part.slice(1, -1).trim();
      return false;
    });

    let meaning = parts[0] || "";
    let remaining = parts.slice(1);
    let enBlock = null;

    if (remaining.length > 0 && !/[\u4e00-\u9fa5]/.test(remaining[remaining.length - 1])) {
      enBlock = remaining.pop();
    }
    const decompParts = remaining;

    this.tip.empty();
    const phText = ph ? (ph.startsWith("/") ? ph : `/${ph}/`) : "";
    const headword = !isRow && readingNotePath(path) ? (annotation?.word ? normalize(annotation.word) : entry.word) : "";
    const libraryRow = isRow && !!el.closest(".hd-context-card");
    if (libraryRow) {
      const line = this.tip.createDiv({ cls: "hd-table-card-topline" });
      this.appendRowContext(el, line);
      if (phText) line.createSpan({ cls: "hd-ph", text: phText });
    } else if (headword) {
      // 阅读卡片首行: search 词在左, 音标在右, 同一行对齐。
      const head = this.tip.createDiv({ cls: "hd-head-row" });
      head.createDiv({ cls: "hd-headword", text: headword });
      if (phText) head.createDiv({ cls: "hd-ph", text: phText });
    } else if (phText) {
      this.tip.createDiv({ cls: "hd-ph", text: phText });
    }
    // Library tables already show the definition beside the headword.
    if (meaning && meaning.trim() && !(isRow && el.closest(".hd-context-card"))) {
      // 文章原文卡片 (无旧式 search 注释): 词条来自本篇词表, 释义里的 ==...== 是本篇语境义项, 高亮出来。
      const articleContext = !isRow && !annotation && articleNotePath(path) && !entry.fromLibrary ? "context" : false;
      this.renderMeaning(meaning, annotation?.reference ? null : annotation, isRow || articleContext);
    }
    if (annotation?.reference) this.renderSenseReference(annotation, path);
    if (decompParts.length) {
      // 记忆锚点与中文释义同属中文部分，不加分割线
      appendInline(this.tip.createDiv({ cls: "hd-decomp hd-anchor" }), decompParts.join("<br>"));
    }
    this.appendSynonyms(entry.syn);
    if (enBlock) {
      this.renderEnglishBlock(enBlock, this.tip, annotation?.reference ? null : annotation?.gloss);
    }
    if (el.matches("tr.hd-row")) this.appendQuestionTypes(el);
    if (!this.tip.textContent.trim()) return this.hide();
    if (!isRow) {
      this.appendEntrySources(entry, path);
      this.highlightReadingOccurrence(el, path, occurrence);
    }
    this.tip.show();
    this.position(el, anchor);
  }

  // 同义词: 来自表格「同义词」列, `n. a, b<br>v. c, d` 每个词性一行, 词典没有的词该格为空, 不显示。
  appendSynonyms(syn) {
    if (!syn || !syn.trim()) return;
    const items = syn.split(/<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;
    const box = this.tip.createDiv({ cls: "hd-synonyms" });
    for (const text of items) {
      const m = text.match(/^([a-z]+\.)\s+(.*)$/);
      const line = box.createDiv({ cls: "hd-syn-line" });
      if (m) line.createSpan({ cls: "hd-syn-pos", text: m[1] });
      line.createSpan({ cls: "hd-syn-words", text: m ? m[2] : text });
    }
  }

  // Vocabulary cards span the full table; other table cards keep their two-column width.
  position(el, anchor) {
    let target = anchor || this.activeCell || (el && el.matches("tr") ? el.cells[0] : el) || this.activeEl;
    if (!target) return;

    let row = el && el.matches("tr.hd-row") ? el : (target.closest ? target.closest("tr") : null);
    const pad = 4;

    if (row && row.cells.length >= 2) {
      const cell1 = row.cells[0];
      // 第二列可能是隐藏的音标列: 取第一个可见的非词头格。
      const cell2 = Array.from(row.cells).slice(1).find(cell => !cell.classList.contains("hd-hidden-col")) || cell1;
      const r1 = cell1.getBoundingClientRect();
      const r2 = cell2.getBoundingClientRect();
      const tableRect = row.closest(".hd-decomp-table, .hd-context-card")?.getBoundingClientRect();
      const left = tableRect ? tableRect.left : r1.left;
      const width = tableRect ? tableRect.width : r2.right - r1.left;

      this.tip.style.width = `${width}px`;
      this.tip.style.maxWidth = `${width}px`;
      this.tip.style.left = `${left}px`;

      this.placeBelow(Math.max(r1.bottom, r2.bottom), pad);
    } else {
      // In-article highlights (or non-table elements)
      const container = target.closest(".markdown-rendered, .cm-content, .markdown-preview-view") || target.parentElement;
      const cr = container ? container.getBoundingClientRect() : null;
      const r = target.getBoundingClientRect();
      const pad = 4;

      let left = r.left;
      let width = 0;

      if (cr) {
        left = cr.left;
        width = cr.width;
      } else {
        width = Math.min(window.innerWidth - 32, 720);
        left = Math.max(pad, (window.innerWidth - width) / 2);
      }

      this.tip.style.width = `${width}px`;
      this.tip.style.maxWidth = `${width}px`;
      this.tip.style.left = `${left}px`;

      this.placeBelow(r.bottom, pad);
    }
  }

  // Always tightly below the anchor (0px gap), never flipped above or shifted
  // over it; when the viewport bottom is too close, the card scrolls instead.
  placeBelow(top, pad) {
    this.tip.style.top = `${top}px`;
    this.tip.style.maxHeight = `${Math.max(0, window.innerHeight - top - pad)}px`;
    this.tip.style.overflowY = "auto";
  }

  // 对错标记的卡片: 在 ✅/❌ 正上方, 留 10px 间距, 宽度与正文列一致; 上方空间不够时卡片内部滚动。
  positionAbove(el) {
    const pad = 4;
    const container = el.closest(".markdown-rendered, .cm-content, .markdown-preview-view") || el.parentElement;
    const cr = container ? container.getBoundingClientRect() : null;
    const r = el.getBoundingClientRect();
    let left, width;
    if (cr) { left = cr.left; width = cr.width; }
    else { width = Math.min(window.innerWidth - 32, 720); left = Math.max(pad, (window.innerWidth - width) / 2); }
    this.tip.style.width = `${width}px`;
    this.tip.style.maxWidth = `${width}px`;
    this.tip.style.left = `${left}px`;
    const gap = 10;
    const room = Math.max(0, r.top - pad - gap);
    this.tip.style.maxHeight = `${room}px`;
    this.tip.style.overflowY = "auto";
    const height = Math.min(this.tip.offsetHeight, room);
    this.tip.style.top = `${r.top - gap - height}px`;
  }

  // 题目里的同义改写: 悬停显示原文表达（多个以 / 分隔, 每条后的【反】表示反义对立）。
  showParaphrase(el, anchor, text) {
    const phrases = text.split(/\s+\/\s+/).map(p => p.trim()).filter(Boolean);
    if (!phrases.length) return this.hide();
    this.tip.empty();
    const box = this.tip.createDiv({ cls: "hd-meaning hd-para-body" });
    phrases.forEach((phrase, i) => {
      if (i) box.createEl("br");
      const negated = phrase.includes("【反】");
      box.appendText((negated ? "（反）" : "") + phrase.replace(/【反】/g, "").trim());
    });
    this.tip.show();
    this.position(el, anchor);
  }

  // 离开词条后留一小段时间让鼠标移到卡片上; 期间进入卡片或回到词条就取消, 否则收起。
  scheduleHide(delay = 0) {
    // 离开即消失: 默认不留延迟, 直接收起。
    if (delay <= 0) return this.hide();
    if (this.hideTimer) return;
    this.hideTimer = setTimeout(() => { this.hideTimer = null; this.hide(); }, delay);
  }

  cancelHide() {
    clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  hide() {
    this.cancelHide();
    this.hoverToken++;
    this.stopListeningHover();
    this.clearReadingHighlight();
    this.activeEl = null;
    this.activeCell = null;
    this.tip.hide();
  }

  stopListeningHover() {
    if (this.listeningHoverAudio) this.tableSound?.stopCurrentAudio();
    this.listeningHoverAudio = false;
  }
}

module.exports = { TooltipMethods };

},
"hd/features/readingAudio": function (module, exports, require) {
const { findAudioFilePath } = require("../../audio/lookup");
const { readingNotePath } = require("../reading");
const { articleModule } = require("../../shared/notes");

// 阅读原文里鼠标移到高亮词上时朗读该词（规范原形音频，取本篇音频目录）。
// 移到别的高亮词立即切换，移开立即停止；缺失音频直接跳过。
class ReadingAudioMethods {
  hoverReadingAudio(target) {
    const el = target.closest(".hd-reading-word");
    if (el === this.readingAudioEl) return;
    this.readingAudioEl = el;
    this.stopReadingAudio();
    if (!el) return;
    const file = this.fileFor(el);
    if (!file || !readingNotePath(file.path)) return;
    const occurrence = this.readingOccurrence(el, file.path);
    // 无注释时先查本篇词条, 用词头找音频(pupils → pupil.mp3)。
    const entry = occurrence?.annotation ? null : this.lookup(occurrence?.text || el.textContent || "", file.path);
    const word = occurrence?.annotation?.word || entry?.word || occurrence?.text;
    // 先取本篇音频目录; 单词已归口词库时, 再取词条所在笔记的镜像音频目录。
    let path = word && findAudioFilePath(this.app, word, file);
    if (word && !path && occurrence?.annotation) {
      const entry = this.lookupAnnotation(occurrence.annotation, file.path);
      if (entry?.path) path = findAudioFilePath(this.app, word, { path: entry.path });
    }
    const setting = `${articleModule(file.path) || "reading"}HoverAudio`;
    if (!path || !this.tableSound?.settings?.[setting]) return;
    this.readingAudioOn = true;
    this.tableSound.stopCurrentAudio();
    void this.tableSound.playResolvedAudio(el, { label: word, paths: [path], word });
  }

  stopReadingAudio() {
    if (this.readingAudioOn) this.tableSound?.stopCurrentAudio();
    this.readingAudioOn = false;
  }
}

module.exports = { ReadingAudioMethods };

},
"audio/lookup": function (module, exports, require) {
const { AUDIO_ROOT, AUDIO_SUBDIR, VAULT_PREFIX } = require("./constants");
const { PHONEME_ALIASES, toSlug } = require("./extract");

function vaultPathExists(app, vaultPath) {
  if (!app || !app.vault || !vaultPath) return false;
  if (app.vault.getAbstractFileByPath(vaultPath)) return true;

  // MP3 files are deliberately excluded from the file explorer, so they do
  // not appear in Vault.getFiles(). Use the desktop adapter as a fallback.
  try {
    const adapter = app.vault.adapter;
    if (!adapter || typeof adapter.getFullPath !== "function") return false;
    return require("fs").existsSync(adapter.getFullPath(vaultPath));
  } catch (e) {
    return false;
  }
}

// 「源目录 => 音频目录」逐行映射
// 返回当前文章的音频目录：音频根目录 + 笔记完整相对路径，与文档目录 1:1 一致。
//   02. word/a. 雅思词汇真经/03-动物保护.md
// ➔ 20. resource/02. word/a. 雅思词汇真经/03-动物保护/audio/
function getArticleAudioDirectories(app, contextFile = null) {
  const activeFile = contextFile || (app && app.workspace && app.workspace.getActiveFile
    ? app.workspace.getActiveFile()
    : null);
  const activePath = typeof activeFile === "string" ? activeFile : (activeFile && activeFile.path ? activeFile.path : "");
  if (!activePath.toLowerCase().endsWith(".md")) return [];

  const vaultPrefix = activePath.startsWith(VAULT_PREFIX) ? VAULT_PREFIX : "";
  const articleRelPath = activePath.slice(vaultPrefix.length).replace(/\.md$/i, "");
  if (!articleRelPath) return [];

  const articlePaths = [articleRelPath];
  // Reading notes may carry the Cambridge/test tag in the filename while
  // their audio directory was generated from the clean article title, e.g.
  // `Roman shipbuilding and navigation (C16-Test 3-Passage 1).md` →
  // `Roman shipbuilding and navigation/`. Keep the exact path first, then
  // try the clean reading-title variant without weakening article isolation.
  if (articleRelPath.startsWith("06. reading/") || articleRelPath.startsWith("10. practice/reading/")) {
    const cleanArticlePath = articleRelPath.replace(/\s+\([^/]*\)$/, "");
    if (cleanArticlePath !== articleRelPath) articlePaths.push(cleanArticlePath);
  }

  return articlePaths.map((path) => `${vaultPrefix}${AUDIO_ROOT}/${path}/${AUDIO_SUBDIR}`);
}

function findAudioFilePath(app, targetWord, contextFile = null) {
  if (!targetWord) return null;

  // 没有活动的 .md 笔记就没有「这篇文章的音频目录」可言。
  // 按文章级隔离的约定，此时宁可报缺失，也不跨文章去捞同名音频。
  const articleAudioDirs = getArticleAudioDirectories(app, contextFile);
  if (!articleAudioDirs.length) return null;

  const exactSlug = toSlug(targetWord);
  const exactSlugNoPunct = targetWord.toLowerCase().trim()
    .replace(/[*_~`#'’`]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  const slugs = [exactSlug, exactSlugNoPunct];
  if (exactSlug.includes("_s_") || exactSlug.endsWith("_s")) {
    slugs.push(
      exactSlug.replace(/_s_/g, "_someone_s_").replace(/_s$/g, "_someone_s"),
      exactSlugNoPunct.replace(/_s_/g, "_someone_s_").replace(/_s$/g, "_someone_s")
    );
  }

  const articleCandidates = [...new Set(
    articleAudioDirs.flatMap((dir) =>
      slugs.flatMap((slug) => [
        `${dir}/${slug}.mp3`,
        `${dir}/${slug}.wav`,
        `${dir}/chunk_${slug}.mp3`,
        `${dir}/chunk_${slug}.wav`,
        `${dir}/cs_${slug}.mp3`,
        `${dir}/cs_${slug}.wav`,
        `${dir}/cs_chunk_${slug}.mp3`,
        `${dir}/cs_chunk_${slug}.wav`,
      ])
    )
  )];
  for (const candidate of articleCandidates) {
    if (vaultPathExists(app, candidate)) return candidate;
  }
  return null;
}

function findPhonemeAudioPath(app, phoneme, contextFile = null) {
  if (!phoneme) return null;
  const pClean = phoneme.trim().replace(/:/g, "ː");
  const aliases = PHONEME_ALIASES.get(pClean) || [pClean];
  if (!aliases.includes(pClean)) aliases.unshift(pClean);

  const articleAudioDirs = getArticleAudioDirectories(app, contextFile);
  const adapter = app && app.vault ? app.vault.adapter : null;
  const fs = require("fs");

  const searchSubDirs = [
    "",
    "01. 元音",
    "02. 辅音",
    "音标/01. 元音",
    "音标/02. 辅音",
    "音标"
  ];

  // 1. 优先在当前文章的音频目录及其子目录下查找（如 20. resource/01. base/a.phonemes/audio/）
  if (articleAudioDirs && articleAudioDirs.length && adapter) {
    try {
      for (const articleAudioDir of articleAudioDirs) {
        for (const sub of searchSubDirs) {
          const vaultDir = sub ? `${articleAudioDir}/${sub}` : articleAudioDir;
          const fullDir = adapter.getFullPath(vaultDir);
          if (!fs.existsSync(fullDir)) continue;
          const names = fs.readdirSync(fullDir);
          for (const name of names) {
            if (!name.toLowerCase().endsWith(".mp3")) continue;
            const basename = name.slice(0, -4);
            const pure = basename.replace(/^\d+[\.\-_\s]+/, "").trim();
            if (pure === pClean || aliases.includes(pure) || aliases.includes(pure.toLowerCase())) {
              return `${vaultDir}/${name}`;
            }
          }
        }
      }
    } catch (e) {}
  }

  // 自然拼读只使用本篇已同步的录音，缺失时不跨文章借用。
  if (articleAudioDirs.some((dir) => /\/01\. base\/d\.phonics\/audio$/i.test(`/${dir}`))) return null;

  // 2. 音标为全库公共基础音库：在当前文章未找到时，回退到全局音标目录
  if (adapter) {
    try {
      const globalPhonemeDirs = [
        `${VAULT_PREFIX}${AUDIO_ROOT}/01. base/a.phonemes/${AUDIO_SUBDIR}`,
        `${AUDIO_ROOT}/01. base/a.phonemes/${AUDIO_SUBDIR}`,
        "00. base/音标/01. 元音",
        "00. base/音标/02. 辅音",
        "00. base/音标"
      ];
      for (const gDir of globalPhonemeDirs) {
        const fullDir = adapter.getFullPath(gDir);
        if (!fs.existsSync(fullDir)) continue;
        const names = fs.readdirSync(fullDir);
        for (const name of names) {
          if (!name.toLowerCase().endsWith(".mp3")) continue;
          const basename = name.slice(0, -4);
          const pure = basename.replace(/^\d+[\.\-_\s]+/, "").trim();
          if (pure === pClean || aliases.includes(pure) || aliases.includes(pure.toLowerCase())) {
            return `${gDir}/${name}`;
          }
        }
      }
    } catch (e) {}
  }

  const files = getAudioFileIndex(app);

  // 3. 兜底：从文件索引中查找
  if (files && files.length) {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.extension === "mp3" && (f.path.includes("/01. base/a.phonemes/") || f.path.includes("/音标/"))) {
        const b = f.basename;
        const bPure = b.replace(/^\d+[\.\-\_\s]+/, "").trim();
        if (bPure === pClean || aliases.includes(b) || aliases.includes(bPure) || aliases.includes(bPure.toLowerCase())) {
          return f.path;
        }
      }
    }
  }

  return null;
}

// 音频索引缓存：库内有两万多个 mp3，每次点击都重扫全库并逐个 toLowerCase()
// 会造成明显启动延迟。这里只在库结构变化时重建一次。
let audioFileIndexCache = null;

function getAudioFileIndex(app) {
  if (audioFileIndexCache) return audioFileIndexCache;
  const entries = [];
  const all = app.vault.getFiles();
  for (let i = 0; i < all.length; i++) {
    const f = all[i];
    if (f.extension !== "mp3" && f.extension !== "wav") continue;
    entries.push({
      path: f.path,
      extension: f.extension,
      basename: f.basename,
      base: f.basename.toLowerCase(),  // 预先小写，避免每次查找重复分配字符串
    });
  }
  audioFileIndexCache = entries;
  return entries;
}

function invalidateAudioFileIndex() {
  audioFileIndexCache = null;
}

function findSentenceAudioPath(app, sentenceText, contextFile = null) {
  if (!sentenceText) return null;

  const articleAudioDirs = getArticleAudioDirectories(app, contextFile);
  if (!articleAudioDirs.length) return null;

  const sSlug = toSlug(sentenceText);
  const articleCandidates = articleAudioDirs.flatMap((dir) => [
    `${dir}/cs_${sSlug}.mp3`,
    `${dir}/${sSlug}.mp3`,
  ]);
  for (const candidate of articleCandidates) {
    if (vaultPathExists(app, candidate)) return candidate;
  }
  return null;
}

function findChunkAudioPath(app, chunkText, targetWord, contextFile = null) {
  if (!chunkText && !targetWord) return null;

  const articleAudioDirs = getArticleAudioDirectories(app, contextFile);
  if (!articleAudioDirs.length) return null;

  const rawTexts = [chunkText, targetWord].filter(Boolean);
  const slugs = [];
  for (const t of rawTexts) {
    const s = toSlug(t);
    if (!s) continue;
    slugs.push(s);
    if (s.includes("_s_") || s.endsWith("_s")) {
      slugs.push(s.replace(/_s_/g, "_someone_s_").replace(/_s$/g, "_someone_s"));
    }
  }

  const articleCandidates = [...new Set(
    articleAudioDirs.flatMap((dir) =>
      slugs.flatMap((sSlug) => [
        `${dir}/chunk_${sSlug}.mp3`,
        `${dir}/chunk_${sSlug}.wav`,
        `${dir}/cs_chunk_${sSlug}.mp3`,
        `${dir}/cs_chunk_${sSlug}.wav`,
        `${dir}/${sSlug}.mp3`,
        `${dir}/${sSlug}.wav`,
        `${dir}/cs_${sSlug}.mp3`,
        `${dir}/cs_${sSlug}.wav`,
      ])
    )
  )];
  for (const candidate of articleCandidates) {
    if (vaultPathExists(app, candidate)) return candidate;
  }
  return null;
}

module.exports = { vaultPathExists, getArticleAudioDirectories, findAudioFilePath, findPhonemeAudioPath, getAudioFileIndex, invalidateAudioFileIndex, findSentenceAudioPath, findChunkAudioPath };

},
"audio/constants": function (module, exports, require) {
const WORD_COL_CLASS = "td-word-col";

const HEADPHONES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>`;

// 1. 白名单表头配置 (严格精准匹配，仅当表头完全匹配下列名称时才挂载对应类型音频)
// 音频列白名单：类型是固定的有限集合，因此按「类型 → 列名数组」组织，
// 而不是让 44 个列名各写一行等号。
const AUDIO_COLUMN_TYPES = ["auto", "word", "chunk", "phoneme", "phonetic", "sentence"];

const DEFAULT_AUDIO_COLUMNS = {
  // 自适应：无论填音标、单词还是句子都自动识别
  auto: ["音频", "读音", "朗读", "播放", "发音", "Audio", "audio"],
  // 单词单字标准发音
  word: ["单词", "音义词块", "单词短语", "词块", "原声词块", "核心表达",
         "核心词", "词汇", "生词", "答案", "答案词", "Word", "word"],
  // 听力短语切片
  chunk: ["短语", "意群", "听力短语", "语块", "Chunk", "chunk"],
  // 音标与辅音发音
  phoneme: ["清音", "浊音", "清辅音", "浊辅音"],
  phonetic: ["音标", "Phonetic", "phonetic"],
  // 整句原声
  sentence: ["原句", "句子", "例句", "整句", "Sentence", "sentence"],
};

// 2. 排除黑名单配置 (命中的路径或表头坚决不挂载耳机)
const DEFAULT_EXCLUDE_RULES = {
  pathKeywords: [],

  // 表头黑名单：只要表格包含以下列名，整表判定为纯文本分析，不挂载耳机
  headerKeywords: [
    "同义改写",
    "改写机制",
  ],

  // 解释说明列黑名单：包含这些关键词的列，坚决不挂载耳机
  columnExcludeKeywords: [
    "技巧",
    "要领",
    "方法",
    "说明",
    "解释",
    "规则",
    "接触面",
    "器官",
    "动作",
    "滑动",
    "起点",
    "释义",
    "拆解",
    "英意",
    "备注",
  ],
};

// 插件自己插进单元格的节点。任何「读正文」或「清理插件痕迹」的地方都用这一份，
// 漏掉一个就会让指纹或变更检测把自家节点当成正文。
const PLUGIN_CHROME_SELECTOR = ".audio-playback-btn";

const PLUGIN_OWNED_SELECTOR = PLUGIN_CHROME_SELECTOR;

// ==================== 库结构常量 ====================
// 这三个值描述的是「库的形状」，不是用户偏好：只有重构整个目录结构时才会变，
// 而那种改动本来就要连带改代码。暴露成可编辑设置反而是脚枪——
// 前缀少个斜杠就整条音频链路静默失效，面板不会给任何提示。
const VAULT_PREFIX = "a. language/";            // 笔记所在的库内子目录（含结尾斜杠）

const AUDIO_ROOT = "20. resource";              // 资源根目录：<根>/<笔记路径>/audio/ 与笔记路径 1:1 镜像
const AUDIO_SUBDIR = "audio";                   // 笔记文件夹内的音频类型子目录

// ==================== 正在播放高亮的抗重渲染定位 ====================
// Live Preview / 阅读视图会在编辑、滚动时整块重建表格 DOM。
// 只握着 <td> 节点引用的话，重建后手里的引用变成游离节点，
// 浅绿色的「正在播放」高亮就凭空消失（音频还在响）。
// 因此额外记一份「内容根 + 表格序号 + 行号 + 列号 + 文本指纹」的坐标，
// 重建后据此找回新节点并把高亮补回去。
const PLAYING_CELL_CLASS = "audio-is-playing";

const PAUSED_CELL_CLASS = "audio-is-paused";

module.exports = { WORD_COL_CLASS, HEADPHONES_SVG, AUDIO_COLUMN_TYPES, DEFAULT_AUDIO_COLUMNS, DEFAULT_EXCLUDE_RULES, PLUGIN_CHROME_SELECTOR, PLUGIN_OWNED_SELECTOR, VAULT_PREFIX, AUDIO_ROOT, AUDIO_SUBDIR, PLAYING_CELL_CLASS, PAUSED_CELL_CLASS };

},
"audio/extract": function (module, exports, require) {
const { PLUGIN_CHROME_SELECTOR } = require("./constants");
const { getDefinitionContentRoot } = require("./dom");

function extractTargetWord(cell) {
  if (!cell) return "";
  // 从内容根克隆，而不是整个 <td>：单元格进入编辑态后，Obsidian 会在同一个 <td> 里
  // 同时留下渲染副本和可编辑副本，直接读 td 会把正文读成两遍。
  const contentRoot = getDefinitionContentRoot(cell) || cell;
  let clone = contentRoot.cloneNode ? contentRoot.cloneNode(true) : null;
  if (clone) {
    const btns = clone.querySelectorAll(PLUGIN_CHROME_SELECTOR);
    for (let i = 0; i < btns.length; i++) btns[i].remove();
  }
  let text = clone ? (clone.innerHTML || clone.textContent || "") : (contentRoot.innerHTML || contentRoot.textContent || "");
  text = text.replace(/[🎧🔊]/g, " ");
  // 开头的 <br> 只为和多行的邻格对齐，词头是第一个非空行。
  text = text.replace(/^(?:\s*<br\s*\/?>)+/i, "").split(/<br\s*\/?>/i)[0];
  text = text.replace(/&[#\w]+;/g, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.split(/[\n\r]/)[0];
  // 词头后的括注一律是词形或同义说明，不属于词头本身：
  //   "**dinghies** (单数 dinghy)" / "**cleansed** (原形 cleanse)" / "**expenses** (travel expenses)"
  // 旧实现把括号内容拼接到词头之后，生成 "dinghies dinghy" 这类根本不存在的
  // 文件名，导致这类词条的音频永远查不到。整段丢弃。
  text = text.replace(/\([^)]*\)/g, " ");
  text = text.split(/[\u4e00-\u9fa5]/)[0];
  text = text.split(/\b(n|v|adj|adv|prep|conj|pron|art|num|int|vi|vt)\.\s*/i)[0];
  text = text.replace(/[\*=_~`#]/g, "").trim();
  return text;
}

function toSlug(str) {
  if (!str) return "";
  return str
    // 先折叠重音符号，否则 é / ñ 会被后面的 [^\w\-] 整个吞掉，
    // 生成 saut / ni_o 这类既对不上原词、也无法反查的文件名。
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim()
    .replace(/[*=_~`#]/g, "")
    .replace(/['’`]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

const PHONEME_ALIASES = new Map([
  ["iː", ["iː", "i_long", "i:"]],
  ["i:", ["iː", "i_long", "i:"]],
  ["ɪ", ["ɪ", "i_short", "i"]],
  ["ʊ", ["ʊ", "u_short", "u"]],
  ["uː", ["uː", "u_long", "u:"]],
  ["u:", ["uː", "u_long", "u:"]],
  ["e", ["e"]],
  ["ə", ["ə", "schwa"]],
  ["ɜː", ["ɜː", "ɜ:", "er_long", "3:", "3_long"]],
  ["ɜ:", ["ɜː", "ɜ:", "er_long", "3:", "3_long"]],
  ["ɔː", ["ɔː", "ɔ:", "o_long"]],
  ["ɔ:", ["ɔː", "ɔ:", "o_long"]],
  ["æ", ["æ", "ae"]],
  ["ʌ", ["ʌ", "wedge", "caret"]],
  ["ɑː", ["ɑː", "ɑ:", "a_long"]],
  ["ɑ:", ["ɑː", "ɑ:", "a_long"]],
  ["ɒ", ["ɒ", "short_o"]],
  // 双元音 (8)
  ["eɪ", ["eɪ", "ei"]],
  ["ei", ["eɪ", "ei"]],
  ["aɪ", ["aɪ", "ai"]],
  ["ai", ["aɪ", "ai"]],
  ["ɔɪ", ["ɔɪ", "oi"]],
  ["oi", ["ɔɪ", "oi"]],
  ["aʊ", ["aʊ", "au"]],
  ["au", ["aʊ", "au"]],
  ["əʊ", ["əʊ", "ou", "eu"]],
  ["ou", ["əʊ", "ou", "eu"]],
  ["ʊə", ["ʊə", "uə", "ua"]],
  ["uə", ["ʊə", "uə", "ua"]],
  ["eə", ["eə", "ea", "air"]],
  ["ea", ["eə", "ea", "air"]],
  ["ɪə", ["ɪə", "iə", "ia", "ear"]],
  ["iə", ["ɪə", "iə", "ia", "ear"]],
  // 辅音
  ["p", ["p"]], ["b", ["b"]], ["t", ["t"]], ["d", ["d"]],
  ["k", ["k"]], ["g", ["g"]], ["f", ["f"]], ["v", ["v"]],
  ["s", ["s"]], ["z", ["z"]], ["m", ["m"]], ["n", ["n"]],
  ["ŋ", ["ŋ", "eng", "ng"]],
  ["h", ["h"]], ["l", ["l"]], ["ɫ", ["ɫ", "dark_l"]], ["r", ["r"]], ["w", ["w"]], ["j", ["j"]],
  ["tʃ", ["tʃ", "tch", "tf", "ch"]],
  ["tf", ["tʃ", "tch", "tf", "ch"]],
  ["dʒ", ["dʒ", "d3", "dz3", "dj"]],
  ["d3", ["dʒ", "d3", "dz3", "dj"]],
  ["θ", ["θ", "theta", "th", "th_voiceless"]],
  ["ð", ["ð", "eth", "dh", "th_voiced"]],
  ["ʃ", ["ʃ", "esh", "sh"]],
  ["ʒ", ["ʒ", "ezh", "zh", "j_voiced"]],
  ["ts", ["ts"]],
  ["dz", ["dz"]],
  ["tr", ["tr"]],
  ["dr", ["dr"]],
]);

function isKnownPhoneme(p) {
  if (!p) return false;
  const pClean = p.trim().replace(/:/g, "ː");
  return PHONEME_ALIASES.has(pClean);
}

function isPurePhonemeCell(cell) {
  if (!cell) return false;
  // 从内容根克隆，而不是整个 <td>：单元格进入编辑态后，Obsidian 会在同一个 <td> 里
  // 同时留下渲染副本和可编辑副本，直接读 td 会把正文读成两遍。
  const contentRoot = getDefinitionContentRoot(cell) || cell;
  let clone = contentRoot.cloneNode ? contentRoot.cloneNode(true) : null;
  if (clone) {
    const btns = clone.querySelectorAll(PLUGIN_CHROME_SELECTOR);
    for (let i = 0; i < btns.length; i++) btns[i].remove();
  }
  let text = clone ? (clone.innerHTML || clone.textContent || "") : (contentRoot.innerHTML || contentRoot.textContent || "");
  text = text.replace(/[🎧🔊]/g, "").trim();
  text = text.split(/<br\s*\/?>/i)[0].trim();
  text = text.replace(/&[#\w]+;/g, " ");
  text = text.replace(/<[^>]+>/g, " ");
  if (!text.trim()) return false;

  // 1. 纯音标格绝对不允许包含任何汉字（排除说明性文字与例句）
  if (/[\u4e00-\u9fa5]/.test(text)) return false;

  // 2. 去除 Markdown 粗体/斜体以及音标常见斜线与中括号
  const clean = text.replace(/[\*_~`#\[\]\/]/g, "").trim().replace(/:/g, "ː");
  if (!clean || clean.length > 8) return false;

  return isKnownPhoneme(clean);
}

function extractAllTargetPhonemes(cell, allowClusters = false) {
  if (!cell) return [];
  // 从内容根克隆，而不是整个 <td>：单元格进入编辑态后，Obsidian 会在同一个 <td> 里
  // 同时留下渲染副本和可编辑副本，直接读 td 会把正文读成两遍。
  const contentRoot = getDefinitionContentRoot(cell) || cell;
  let clone = contentRoot.cloneNode ? contentRoot.cloneNode(true) : null;
  if (clone) {
    const btns = clone.querySelectorAll(PLUGIN_CHROME_SELECTOR);
    for (let i = 0; i < btns.length; i++) btns[i].remove();
  }
  let text = clone ? (clone.innerHTML || clone.textContent || "") : (contentRoot.innerHTML || contentRoot.textContent || "");
  text = text.replace(/[🎧🔊]/g, " ");
  // 音标格开头的换行用于与邻列对齐，不是音标内容的结束。
  text = text.replace(/^(?:\s*<br\s*\/?>)+/i, "").split(/<br\s*\/?>/i)[0];
  text = text.replace(/&[#\w]+;/g, " ");
  text = text.replace(/<[^>]+>/g, " ").trim();

  const results = [];
  // 1. 优先提取所有 // 包含的音标片段: /.../
  const regex = /\/([^\/]+)\//g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const rawP = match[1].trim().replace(/:/g, "ː");
    if (isKnownPhoneme(rawP) || (allowClusters && /^[pbtdkgfvszmnŋhlrwjθðʃʒ]{2,4}$/.test(rawP))) {
      results.push(rawP);
    } else {
      const parts = rawP.split(/[\s,，、]+/).map(s => s.trim().replace(/:/g, "ː")).filter(Boolean);
      for (const part of parts) {
        if (isKnownPhoneme(part)) {
          results.push(part);
        }
      }
    }
  }

  // 2. 如果没有 /.../ 格式，尝试按换行或分隔符拆分纯文本
  if (results.length === 0) {
    const lines = text.split(/[\n\r,，、]+/).map(s => s.replace(/[\*_~`#\[\]\/]/g, "").trim().replace(/:/g, "ː")).filter(Boolean);
    for (const line of lines) {
      if (isKnownPhoneme(line)) {
        results.push(line);
      }
    }
  }

  return results;
}

function extractTargetPhoneme(cell) {
  const list = extractAllTargetPhonemes(cell);
  return list.length > 0 ? list[0] : "";
}

function extractTargetSentence(cell) {
  if (!cell) return "";
  // 从内容根克隆，而不是整个 <td>：单元格进入编辑态后，Obsidian 会在同一个 <td> 里
  // 同时留下渲染副本和可编辑副本，直接读 td 会把正文读成两遍。
  const contentRoot = getDefinitionContentRoot(cell) || cell;
  let clone = contentRoot.cloneNode ? contentRoot.cloneNode(true) : null;
  if (clone) {
    const btns = clone.querySelectorAll(PLUGIN_CHROME_SELECTOR);
    for (let i = 0; i < btns.length; i++) btns[i].remove();
  }
  let text = clone ? (clone.innerHTML || clone.textContent || "") : (contentRoot.innerHTML || contentRoot.textContent || "");
  text = text.replace(/[🎧🔊]/g, " ");
  // 阅读笔记的短语格以 <br> 开头（`<br>例句<br>(判断题)<br>`），取第一段非空内容，
  // 否则读到空串，耳机只念短语、不接短语原声。
  const segments = text.split(/<br\s*\/?>/i);
  text = segments.find((seg) => seg.replace(/<[^>]+>|&[#\w]+;/g, "").trim()) || "";
  text = text.replace(/&[#\w]+;/g, " ");
  // Inline emphasis can split a hyphenated word; removing it must not add spaces.
  text = text.replace(/<\/?(?:strong|b|em|i|mark|span|s|del|code)\b[^>]*>/gi, "");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/[*_~`#]/g, " ");
  text = text.replace(/[\u4e00-\u9fa5]/g, " ");
  text = text.replace(/^[.\s]+|[.\s]+$/g, "");
  text = text.replace(/\s+/g, " ");
  return text.trim();
}

module.exports = { extractTargetWord, toSlug, PHONEME_ALIASES, isKnownPhoneme, isPurePhonemeCell, extractAllTargetPhonemes, extractTargetPhoneme, extractTargetSentence };

},
"audio/dom": function (module, exports, require) {
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
  for (const type of ["pointerdown", "mousedown"]) {
    btn.addEventListener(type, (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
    });
  }
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

},
"hd/features/highlightVisibility": function (module, exports, require) {
const { readingNotePath, questionBlanks } = require("../reading");
const { articleHighlightSetting, articleModule } = require("../../shared/notes");

// 「原文展示高亮」「题目展示高亮」: 听力、阅读各两个开关。开启时持续显示, 关闭时仅悬停显示。
// 悬浮卡片与朗读照常工作, 其他笔记不受影响。
const HIDDEN_CLASS = "hd-highlight-hidden";
const QUESTION_SHOWN_CLASS = "hd-question-shown";

class HighlightVisibilityMethods {
  setupHighlightVisibility() {
    const { workspace } = this.app;
    this.registerEvent(workspace.on("active-leaf-change", () => this.syncHighlightVisibility()));
    this.registerEvent(workspace.on("layout-change", () => this.syncHighlightVisibility()));
    this.registerEvent(workspace.on("highlight-decompose:settings", () => this.refreshHighlightSettings()));
    workspace.onLayoutReady(() => this.syncHighlightVisibility());
    this.setupHighlightToggleButton();
  }

  // 「# 原文」标题后的开关: 点击切换本篇所属模块的「隐藏原文高亮」。
  toggleArticleHighlights(path) {
    const key = articleHighlightSetting(path);
    const ts = this.tableSound;
    if (!key || !ts?.settings) return;
    ts.settings[key] = !ts.settings[key];
    void ts.saveSettings();
  }

  paintHighlightToggle(btn) {
    const hidden = Boolean(this.tableSound?.settings?.[articleHighlightSetting(btn.dataset.hdPath)]);
    btn.classList.toggle("is-off", hidden);
    require("obsidian").setIcon(btn, hidden ? "eye-off" : "eye");
    btn.setAttribute("aria-label", hidden ? "显示原文高亮" : "隐藏原文高亮");
  }

  makeHighlightToggle(path) {
    const btn = document.createElement("span");
    btn.className = "hd-hl-toggle";
    btn.dataset.hdPath = path;
    this.paintHighlightToggle(btn);
    btn.addEventListener("mousedown", e => e.preventDefault());
    btn.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); this.toggleArticleHighlights(path); });
    return btn;
  }

  setupHighlightToggleButton() {}

  // 开关变化后让已打开的编辑器重算装饰, 并刷新显示。
  refreshHighlightSettings() {
    this.highlightRevision = (this.highlightRevision || 0) + 1;
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      leaf.view?.editor?.cm?.dispatch({});
    }
    for (const btn of document.querySelectorAll(".hd-hl-toggle")) this.paintHighlightToggle(btn);
    this.syncHighlightVisibility();
  }

  syncHighlightVisibility() {
    const settings = this.tableSound?.settings;
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const el = leaf.view?.containerEl;
      if (!el) continue;
      const path = leaf.view.file?.path || "";
      const hidden = Boolean(settings?.[articleHighlightSetting(path)]);
      el.classList.toggle(HIDDEN_CLASS, hidden);
      // 关闭时不论本篇词表是否收录, 正文高亮底色一律隐藏。
      el.classList.toggle("hd-hide-unlisted-highlights", hidden);
      // 开关放进标签页标题栏的操作图标里, 与其他图标并排, 不随正文滚动。
      const view = leaf.view;
      if (!view.hdHlAction && typeof view.addAction === "function") {
        view.hdHlAction = view.addAction("eye", "隐藏原文高亮", () => this.toggleArticleHighlights(view.file?.path || ""));
        view.hdHlAction.addClass("hd-hl-action");
      }
      const act = view.hdHlAction;
      if (act) {
        const on = Boolean(articleHighlightSetting(path));
        act.toggleClass("hd-hl-action-hidden", !on);
        act.dataset.hdPath = path;
        require("obsidian").setIcon(act, hidden ? "eye-off" : "eye");
        act.setAttribute("aria-label", hidden ? "显示原文高亮" : "隐藏原文高亮");
      }
      const questionShown = false;
      el.classList.toggle(QUESTION_SHOWN_CLASS, questionShown);
    }
  }
}

module.exports = { HighlightVisibilityMethods };

},
"hd/features/doubleClickHighlight": function (module, exports, require) {
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

},
"hd/features/audioSeek": function (module, exports, require) {
const { setIcon } = require("obsidian");

function seekAudio(audio, seconds) {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
  audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
}
class AudioSeekMethods {
  setupAudioSeek() {
    let lastAudio = null;
    let lastSource = null;
    let lastContainer = null;
    let lastAudioParent = null;
    let wantsPlayback = false;
    let recoveringAudio = false;
    let lastPosition = 0;
    let audioKeyboardActive = false;
    const audioDock = document.createElement('div');
    audioDock.hidden = true;
    document.body.appendChild(audioDock);
    this.audioControlDiagnostics = {};
    this.audioControlTarget = () => targetAudio();
    const isNoteAudio = audio => audio?.matches?.('.workspace-leaf-content audio[controls]');
    const remember = audio => {
      if (audio === lastAudio) return audio;
      if (lastAudio?.parentElement === audioDock) {
        lastAudio.pause();
        lastAudio.remove();
      }
      wantsPlayback = !audio.paused && !audio.ended;
      lastPosition = audio.currentTime || 0;
      lastAudio = audio;
      lastAudioParent = audio.parentElement;
      lastSource = audio.getAttribute('src');
      lastContainer = audio.closest('.workspace-leaf-content');
      watchAudio(audio);
      return audio;
    };
    const targetAudio = () => {
      if (lastAudio && !lastAudio.paused && !lastAudio.ended) return lastAudio;
      const all = [...document.querySelectorAll('.workspace-leaf-content audio[controls]')];
      const playing = all.filter(a => !a.paused && !a.ended);
      if (playing.length) return remember(playing.includes(lastAudio) ? lastAudio : playing[0]);
      if (lastAudio?.isConnected) return lastAudio;
      const replacement = all.find(a => a.getAttribute('src') === lastSource && a.closest('.workspace-leaf-content') === lastContainer);
      if (replacement) {
        // CodeMirror 重建播放器时保留暂停位置, 不把进度重置到开头。
        if (lastAudio && replacement !== lastAudio && lastAudio.currentTime > 0 && replacement.currentTime === 0) {
          const position = lastAudio.currentTime;
          if (replacement.readyState >= 1) replacement.currentTime = position;
          else replacement.addEventListener('loadedmetadata', () => {
            if (replacement.currentTime === 0) replacement.currentTime = Math.min(position, replacement.duration || position);
          }, { once: true });
        }
        return remember(replacement);
      }
      // 实时预览编辑/滚动会卸载媒体 DOM, 音频对象仍可正常播放与定位。
      if (lastAudio?.getAttribute('src')) return lastAudio;
      const active = this.app.workspace.getMostRecentLeaf?.()?.view?.containerEl;
      const audio = active?.querySelector('audio[controls]');
      return audio ? remember(audio) : null;
    };
    const play = () => targetAudio()?.play().catch(error => console.error('[HighlightDecompose] Audio playback failed', error));
    const pause = () => { wantsPlayback = false; targetAudio()?.pause(); };
    const togglePlayback = () => {
      const audio = targetAudio();
      if (audio) audio.paused ? play() : pause();
    };
    const seek = seconds => { const audio = targetAudio(); if (audio) { seekAudio(audio, seconds); syncSession(audio); } };
    const floating = document.createElement('div');
    floating.className = 'hd-floating-audio';
    floating.setAttribute('role', 'region');
    floating.setAttribute('aria-label', '悬浮音频播放器');
    floating.hidden = true;
    const button = (label, icon, action) => {
      const el = document.createElement('button');
      el.type = 'button';
      setIcon(el, icon);
      this.registerDomEvent(el, 'click', () => { action(); renderFloating(); });
      floating.appendChild(el);
      return el;
    };
    button('后退', 'rotate-ccw', () => seek(-5));
    const toggle = button('播放', 'play', togglePlayback);
    toggle.classList.add('hd-floating-audio-toggle');
    button('前进', 'rotate-cw', () => seek(5));
    const progress = document.createElement('input');
    progress.type = 'range';
    progress.min = '0';
    progress.step = '0.1';
    floating.appendChild(progress);
    const time = document.createElement('span');
    time.className = 'hd-floating-audio-time';
    floating.appendChild(time);
    const formatTime = value => {
      const seconds = Math.floor(Number.isFinite(value) ? value : 0);
      return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    };
    const positionFloating = () => {
      if (!lastContainer?.isConnected) return;
      // 直接锚定文章窗格, 避免窗口坐标与 Obsidian 缩放后的 CSS 坐标混用。
      if (floating.parentElement !== lastContainer) lastContainer.appendChild(floating);
      floating.style.setProperty('--hd-audio-pane-width', `${Math.max(0, lastContainer.clientWidth - 32)}px`);
    };
    const paneObserver = new ResizeObserver(positionFloating);
    let observedPane = null;
    const renderFloating = () => {
      const audio = lastAudio;
      floating.hidden = !audio || !lastContainer?.isConnected;
      if (floating.hidden) return;
      if (observedPane !== lastContainer) {
        paneObserver.disconnect();
        paneObserver.observe(lastContainer);
        observedPane = lastContainer;
      }
      positionFloating();
      const playing = !audio.paused && !audio.ended;
      const icon = playing ? 'pause' : 'play';
      if (toggle.dataset.icon !== icon) {
        setIcon(toggle, icon);
        toggle.dataset.icon = icon;
      }
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      progress.disabled = duration <= 0;
      progress.max = String(duration || 1);
      progress.value = String(audio.currentTime || 0);
      time.textContent = `${formatTime(audio.currentTime)} / ${formatTime(duration)}`;
    };
    this.registerDomEvent(progress, 'input', () => {
      const audio = targetAudio();
      if (audio && Number.isFinite(audio.duration)) {
        audio.currentTime = Math.max(0, Math.min(audio.duration, Number(progress.value)));
        syncSession(audio);
        renderFloating();
      }
    });
    document.body.appendChild(floating);
    this.registerDomEvent(window, 'resize', positionFloating);
    this.registerEvent(this.app.workspace.on('layout-change', positionFloating));
    this.registerEvent(this.app.workspace.on('resize', positionFloating));
    for (const [id, name, run] of [
      ['audio-rewind-5s', '音频后退 5 秒', () => seek(-5)],
      ['audio-toggle-playback', '音频暂停 / 继续', togglePlayback],
      ['audio-forward-5s', '音频前进 5 秒', () => seek(5)],
    ]) this.addCommand({ id, name, checkCallback: checking => {
      if (!targetAudio()) return false;
      if (!checking) run();
      return true;
    } });
    // 使用单一键盘入口, 不再同时注册默认快捷键, 避免一次触发两遍。
    this.registerDomEvent(window, 'keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing) return;
      const key = ({ MediaTrackPrevious: 'F7', MediaTrackNext: 'F9', MediaPlayPause: 'F8', AudioTrackPrevious: 'F7', AudioTrackNext: 'F9' })[event.key] || event.key;
      const localKey = [' ', 'ArrowLeft', 'ArrowRight'].includes(key);
      if (localKey && (!audioKeyboardActive || !lastContainer?.isConnected || floating.hidden)) return;
      if (!localKey && !['F7', 'F8', 'F9'].includes(key)) return;
      if (!targetAudio()) return;
      this.audioControlDiagnostics.lastKey = event.key;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (key === 'F8' || key === ' ') { if (!event.repeat) togglePlayback(); }
      else seek(key === 'F7' || key === 'ArrowLeft' ? -5 : 5);
    }, true);
    // Mac 媒体键通过系统媒体会话接入, 不要求焦点位于播放器。
    const session = navigator.mediaSession;
    const handlers = { previoustrack: () => seek(-5), nexttrack: () => seek(5),
      seekbackward: () => seek(-5), seekforward: () => seek(5), play, pause,
      seekto: detail => { const audio = targetAudio(); if (audio && Number.isFinite(detail.seekTime)) { audio.currentTime = Math.max(0, Math.min(audio.duration, detail.seekTime)); syncSession(audio); } } };
    let bound = false;
    const bind = () => {
      if (!session) return;
      for (const [action, handler] of Object.entries(handlers)) {
        try { session.setActionHandler(action, detail => { this.audioControlDiagnostics.lastAction = action; handler(detail); }); } catch (_) {}
      }
      bound = true;
    };
    const watched = new Set();
    const syncSession = audio => {
      renderFloating();
      if (!session || !audio) return;
      session.playbackState = audio.paused ? 'paused' : 'playing';
      if (!session.metadata && typeof MediaMetadata !== 'undefined') {
        session.metadata = new MediaMetadata({ title: 'Obsidian 音频' });
      }
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        try { session.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: Math.max(0, Math.min(audio.duration, audio.currentTime)) }); } catch (_) {}
      }
    };
    const onAudioState = event => {
      if (event.target !== lastAudio) return;
      if (event.type === 'play') wantsPlayback = true;
      if (event.type === 'pause' && event.target.isConnected && !recoveringAudio) wantsPlayback = false;
      if (event.type === 'ended') wantsPlayback = false;
      if (event.target.currentTime > 0) lastPosition = event.target.currentTime;
      syncSession(event.target);
      // 原生播放器及宿主可能在播放事件中重设媒体会话, 在其后恢复控制入口。
      if (event.type === 'play') { bind(); queueMicrotask(bind); }
    };
    const watchAudio = audio => {
      if (watched.has(audio)) return;
      watched.add(audio);
      for (const type of ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata', 'durationchange']) audio.addEventListener(type, onAudioState);
    };
    this.registerDomEvent(document, 'play', event => {
      if (isNoteAudio(event.target)) { remember(event.target); syncSession(event.target); bind(); queueMicrotask(bind); }
    }, true);
    for (const type of ['pointerdown', 'focusin']) this.registerDomEvent(document, type, event => {
      const audio = event.composedPath().find(isNoteAudio);
      // 点击播放器后接管按键; 回到文章或其他区域立即交还原有快捷键。
      audioKeyboardActive = !!audio || event.composedPath().includes(floating);
      if (audio) { remember(audio); bind(); renderFloating(); }
    }, true);
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => { audioKeyboardActive = false; if (targetAudio()) bind(); renderFloating(); }));
    // 实时预览滚动会卸载播放器。将同一个媒体节点暂存到页面外的隐藏容器,
    // 回滚时再交还给新建的播放器位置, 进度与原生控件共用同一音频对象。
    const keepAudioAlive = () => {
      if (!lastAudio || !lastContainer?.isConnected) return;
      if (lastAudio.parentElement !== audioDock && lastAudio.parentElement) lastAudioParent = lastAudio.parentElement;
      if (!lastAudio.isConnected) {
        recoveringAudio = true;
        audioDock.appendChild(lastAudio);
        if (!lastAudio.getAttribute('src') && lastSource) lastAudio.setAttribute('src', lastSource);
        if (lastAudio.currentTime === 0 && lastPosition > 0) {
          const restore = () => { lastAudio.currentTime = Math.min(lastPosition, lastAudio.duration || lastPosition); };
          if (lastAudio.readyState >= 1) restore();
          else lastAudio.addEventListener('loadedmetadata', restore, { once: true });
        }
        if (wantsPlayback && lastAudio.paused && !lastAudio.ended) {
          lastAudio.play().catch(error => console.error('[HighlightDecompose] Audio recovery failed', error))
            .finally(() => { recoveringAudio = false; });
        } else recoveringAudio = false;
      }
      if (lastAudio.parentElement === audioDock && lastAudioParent?.isConnected) {
        lastAudioParent.appendChild(lastAudio);
      }
      if (lastAudio.parentElement === audioDock) {
        const replacement = [...lastContainer.querySelectorAll('audio[controls]')]
          .find(audio => audio !== lastAudio && audio.getAttribute('src') === lastSource);
        if (replacement) { lastAudioParent = replacement.parentElement; replacement.replaceWith(lastAudio); }
      }
    };
    const audioObserver = new MutationObserver(records => {
      if (records.every(record => floating.contains(record.target))) return;
      keepAudioAlive();
      // 仅在显隐改变时刷新, 避免时间文字触发观察器循环。
      const hidden = !lastAudio || !lastContainer?.isConnected;
      if (floating.hidden !== hidden) renderFloating();
    });
    audioObserver.observe(document.body, { childList: true, subtree: true });
    const initialAudio = targetAudio();
    if (initialAudio) { bind(); syncSession(initialAudio); }
    this.register(() => {
      audioObserver.disconnect();
      paneObserver.disconnect();
      floating.remove();
      if (lastAudio?.parentElement === audioDock) {
        lastAudio.pause();
        // 重载时还原宿主持有的嵌入节点, 包括暂时被编辑器卸载的容器。
        if (lastAudioParent) lastAudioParent.appendChild(lastAudio);
      }
      audioDock.remove();
      for (const audio of watched) for (const type of ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata', 'durationchange']) audio.removeEventListener(type, onAudioState);
      if (!bound) return;
      for (const action of Object.keys(handlers)) {
        try { session.setActionHandler(action, null); } catch (_) {}
      }
    });
  }
}
module.exports = { AudioSeekMethods, seekAudio };

},
"audio/plugin": function (module, exports, require) {
// 耳机点读（原 table-sound 插件，2026-10-05 并入）：作为 hd 插件的子组件加载（addChild），设置存在同一份 data.json。
const { Plugin } = require("obsidian");
const { installMixins } = require("../mixin");
const { collectChangedTables, mutationHasExternalDomChange } = require("./dom");
const { invalidateAudioFileIndex } = require("./lookup");
const { getSettings } = require("./settings");
const { TableSoundSettingTab } = require("./settingsTab");
const { RuleMethods } = require("./features/rules");
const { PlaybackMethods } = require("./features/playback");
const { ResolveMethods } = require("./features/resolve");
const { TableMethods } = require("./features/tables");
const { SettingsStoreMethods } = require("./features/settingsStore");

class TableSoundPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new TableSoundSettingTab(this.app, this));

    this.scheduled = false;
    this.debounceTimer = null;
    this.viewObservers = new Map();
    this.pendingTables = new Set();
    this.pendingAudioTables = new Set();
    this.pendingFullUpdate = false;
    this.audioBindingFrame = null;
    this.updateFrame = null;

    this.queueAudioBinding = (table) => {
      this.pendingAudioTables.add(table);
      if (this.audioBindingFrame !== null) return;
      // 耳机按钮推迟到下一帧补，不和表格首帧绘制争抢。
      this.audioBindingFrame = requestAnimationFrame(() => {
        this.audioBindingFrame = null;
        const contexts = this.getManagedContexts();
        const tables = Array.from(this.pendingAudioTables);
        this.pendingAudioTables.clear();
        for (const pendingTable of tables) {
          const matchedCtx = contexts.find((ctx) => ctx.root.contains(pendingTable));
          if (matchedCtx) {
            this.bindAudioButtons(pendingTable, matchedCtx);
          }
        }
      });
    };

    this.runScheduledUpdate = () => {
      const tables = this.pendingFullUpdate ? null : Array.from(this.pendingTables);
      this.pendingTables.clear();
      this.pendingFullUpdate = false;
      try {
        this.updateManagedTables(tables);
      } catch (err) {
        console.error("[TableSound] Table update error:", err);
      } finally {
        // DOM 变动异常时也必须释放调度锁，否则后续 Live Preview 更新会永久停滞。
        this.scheduled = false;
      }
    };

    // Register exclusive audio playback state.
    this.currentPlayingAudio = null;
    this.currentPlayingCell = null;
    this.playingCellDescriptor = null;
    this.playingCellToken = 0;
    this.isPaused = false;
    this.pauseWaiters = [];
    this.currentBlobUrl = null;
    this.currentPlayRequest = null;
    this.currentPlaybackResolve = null;

    this.addCommand({
      id: "toggle-playback-pause",
      name: "暂停 / 继续当前播放",
      callback: () => this.togglePlaybackPause(),
    });

    this.addCommand({
      id: "report-missing-audio",
      name: "体检：列出当前笔记缺失音频的单元格",
      callback: () => this.reportMissingAudio(),
    });

    // 按 Escape 键停止当前正在播放的音频
    this.registerDomEvent(window, "keydown", (e) => {
      if (e.key === "Escape") {
        if (this.currentPlayingAudio || this.currentPlayRequest) {
          this.stopCurrentAudio();
        }
      }
    });

    // Debounce table processing while Markdown views update.
    this.requestUpdate = (immediate = false, tables = null) => {
      if (tables === null) {
        this.pendingFullUpdate = true;
        this.pendingTables.clear();
      } else if (!this.pendingFullUpdate) {
        for (const table of tables) this.pendingTables.add(table);
      }
      if (immediate) {
        if (!this.scheduled) {
          this.scheduled = true;
          this.updateFrame = requestAnimationFrame(() => {
            this.updateFrame = null;
            this.runScheduledUpdate();
          });
        }
        return;
      }

      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        if (!this.scheduled) {
          this.scheduled = true;
          this.updateFrame = requestAnimationFrame(() => {
            this.updateFrame = null;
            this.runScheduledUpdate();
          });
        }
      }, getSettings().updateDebounceMs);
    };

    // 为每个当前可见的 Markdown 视图各挂一个观察者。
    // 旧实现只认 .workspace-leaf.mod-active，分屏时未聚焦的那一栏
    // 从不更新，新开的第二栏在点进去之前答案是露着的。
    this.syncViewObservers = () => {
      const roots = new Set(this.getManagedContexts().map((ctx) => ctx.root));

      for (const [root, observer] of this.viewObservers) {
        if (roots.has(root)) continue;
        observer.disconnect();
        this.viewObservers.delete(root);
      }

      for (const root of roots) {
        if (this.viewObservers.has(root)) continue;
        const observer = new MutationObserver((mutations) => {
          // 忽略本插件插入/移除耳机按钮造成的变动，避免自己唤醒自己。
          if (!mutations.some(mutationHasExternalDomChange)) return;
          // 高亮先当帧补回来，不等 debounce，否则重建瞬间会闪掉一段。
          this.reassertPlayingHighlight();
          const changedTables = collectChangedTables(mutations, root);
          if (changedTables.size > 0) this.requestUpdate(false, changedTables);
        });
        observer.observe(root, { childList: true, subtree: true });
        this.viewObservers.set(root, observer);
      }
    };

    // Stop playback when leaving the current note.
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.managedContextsCache = null;
        this.stopCurrentAudio();
        this.syncViewObservers();
        this.requestUpdate(true);
      })
    );

    // 同一标签页里切换阅读 / 编辑模式不会触发 active-leaf-change，
    // 但可见容器换了一个，必须重新接管，否则切过去的那一侧没有耳机。
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.managedContextsCache = null;
        this.syncViewObservers();
        this.requestUpdate(true);
      })
    );

    this.register(() => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      for (const observer of this.viewObservers.values()) observer.disconnect();
      this.viewObservers.clear();
      if (this.audioBindingFrame !== null) cancelAnimationFrame(this.audioBindingFrame);
      if (this.updateFrame !== null) cancelAnimationFrame(this.updateFrame);
      this.pendingAudioTables.clear();
    });

    // 库结构变化（新生成音频、重命名、删除）后让音频索引失效，下次查找时重建。
    this.registerEvent(this.app.vault.on("create", invalidateAudioFileIndex));
    this.registerEvent(this.app.vault.on("delete", invalidateAudioFileIndex));
    this.registerEvent(this.app.vault.on("rename", invalidateAudioFileIndex));

    this.syncViewObservers();
    this.requestUpdate(false);
  }
  onunload() {
    this.stopCurrentAudio();
    invalidateAudioFileIndex();
    const tables = document.querySelectorAll("table");
    for (let index = 0; index < tables.length; index++) {
      this.clearAudioFromTable(tables[index]);
    }
  }
}

installMixins(TableSoundPlugin, RuleMethods, PlaybackMethods, ResolveMethods, TableMethods, SettingsStoreMethods);

module.exports = TableSoundPlugin;

},
"audio/settings": function (module, exports, require) {
const { AUDIO_COLUMN_TYPES, DEFAULT_AUDIO_COLUMNS, DEFAULT_EXCLUDE_RULES } = require("./constants");
const { invalidateAudioFileIndex } = require("./lookup");

const DEFAULT_SETTINGS = {
  // --- 表格识别 ---
  audioColumns: JSON.parse(JSON.stringify(DEFAULT_AUDIO_COLUMNS)),
  excludePathKeywords: [...DEFAULT_EXCLUDE_RULES.pathKeywords],
  excludeHeaderKeywords: [...DEFAULT_EXCLUDE_RULES.headerKeywords],
  excludeColumnKeywords: [...DEFAULT_EXCLUDE_RULES.columnExcludeKeywords],

  // --- 音频匹配 ---
  // 严格模式只认「文章级同名目录内的精确匹配」，命中不了直接报缺失，
  // 不做跨文章的全库模糊回退（对应知识库「不得跨文章回退读取同名音频」的约定）。

  // --- 高亮显示 ---
  showListeningHighlights: false,
  showReadingHighlights: false,
  showListeningQuestionHighlights: false,
  showReadingQuestionHighlights: false,
  // 听说读写各自的开关: 读听隐藏已收录词, 写说隐藏全部正文高亮; 不隐藏 ==, 卡片与朗读照常。
  hideReadingArticleHighlights: false,
  hideListeningArticleHighlights: false,
  hideWritingArticleHighlights: false,
  hideSpeakingArticleHighlights: false,

  // --- 悬停朗读 ---
  listeningHoverAudio: true,
  readingHoverAudio: false,
  writingHoverAudio: false,
  speakingHoverAudio: false,

  // --- 播放 ---
  playbackRate: 1,
  phonemeGapMs: 300,

  updateDebounceMs: 32,
};

let runtimeSettings = { ...DEFAULT_SETTINGS };

let audioColumnLookup = buildAudioColumnLookup(DEFAULT_SETTINGS.audioColumns);

// 配置按类型分组便于阅读，运行时按列名查找，因此建一份反向索引。
function buildAudioColumnLookup(grouped) {
  const lookup = new Map();
  for (const type of Object.keys(grouped || {})) {
    for (const name of grouped[type] || []) lookup.set(name, type);
  }
  return lookup;
}

function getSettings() {
  return runtimeSettings;
}

function applyRuntimeSettings(next) {
  runtimeSettings = next;
  audioColumnLookup = buildAudioColumnLookup(next.audioColumns);
  invalidateAudioFileIndex();
}

// --- 设置面板用的文本序列化助手 ---------------------------------------
function parseListText(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function serializeListText(list) {
  return (list || []).join("\n");
}

// 逗号分隔的一行列表，用于列名、关键词这类短条目。
function parseCsvList(text) {
  return String(text || "")
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function serializeCsvList(list) {
  return (list || []).join(", ");
}

// 「类型: 名称1, 名称2」逐行分组
function parseGroupedText(text) {
  const grouped = {};
  for (const line of parseListText(text)) {
    const at = line.indexOf(":");
    if (at === -1) continue;
    const type = line.slice(0, at).trim();
    if (!AUDIO_COLUMN_TYPES.includes(type)) continue;
    grouped[type] = parseCsvList(line.slice(at + 1));
  }
  return grouped;
}

function serializeGroupedText(grouped) {
  return AUDIO_COLUMN_TYPES
    .filter((type) => (grouped || {})[type] && grouped[type].length)
    .map((type) => `${type}: ${serializeCsvList(grouped[type])}`)
    .join("\n");
}

function getAudioColumnLookup() {
  return audioColumnLookup;
}

module.exports = { DEFAULT_SETTINGS, buildAudioColumnLookup, getSettings, applyRuntimeSettings, parseListText, serializeListText, parseCsvList, serializeCsvList, parseGroupedText, serializeGroupedText, getAudioColumnLookup };

},
"audio/settingsTab": function (module, exports, require) {
const { PluginSettingTab, Setting, Notice } = require("obsidian");
const { DEFAULT_SETTINGS } = require("./settings");

class TableSoundSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    const settings = this.plugin.settings;
    const save = async () => this.plugin.saveSettings();
    containerEl.empty();

    // ---------- 音频 ----------
    // ---------- 听力 ----------
    new Setting(containerEl).setName("听力").setHeading();




    new Setting(containerEl)
      .setName("悬停朗读")
      .addToggle((toggle) => toggle.setValue(settings.listeningHoverAudio).onChange(async (value) => {
        settings.listeningHoverAudio = value;
        await save();
      }));


    // ---------- 阅读 ----------
    new Setting(containerEl).setName("阅读").setHeading();




    new Setting(containerEl)
      .setName("悬停朗读")
      .addToggle((toggle) => toggle.setValue(settings.readingHoverAudio).onChange(async (value) => {
        settings.readingHoverAudio = value;
        await save();
      }));


    for (const [label, kind] of [["写作", "Writing"], ["口语", "Speaking"]]) {
      new Setting(containerEl).setName(label).setHeading();
      const audioKey = `${kind.toLowerCase()}HoverAudio`;
      new Setting(containerEl)
        .setName("悬停朗读")
        .addToggle(toggle => toggle.setValue(settings[audioKey]).onChange(async value => {
          settings[audioKey] = value;
          await save();
        }));
    }

    new Setting(containerEl).setName("音频").setHeading();

    new Setting(containerEl)
      .setName("播放速度")
      .addSlider((slider) =>
        slider
          .setLimits(0.5, 1.5, 0.05)
          .setValue(settings.playbackRate)
          .setDynamicTooltip()
          .onChange(async (value) => {
            settings.playbackRate = value;
            await save();
          })
      );

    // ---------- 恢复默认 ----------
    new Setting(containerEl)
      .setName("恢复默认设置")
      .addButton((button) =>
        button
          .setButtonText("恢复默认")
          .setWarning()
          .onClick(async () => {
            this.plugin.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            await save();
            this.display();
            new Notice("已恢复默认设置", 2000);
          })
      );
  }
}

module.exports = { TableSoundSettingTab };

},
"audio/features/rules": function (module, exports, require) {
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

},
"audio/features/playback": function (module, exports, require) {
const { Notice } = require("obsidian");
const { playClip, prepareClipSafe, releaseClip } = require("../clip");
const { PAUSED_CELL_CLASS, PLAYING_CELL_CLASS } = require("../constants");
const { findAudioFilePath, findChunkAudioPath } = require("../lookup");
const { describePlayingCell, resolvePlayingCell } = require("../playingCell");
const { getSettings } = require("../settings");
const { listeningNotePath } = require("../../shared/notes");

class PlaybackMethods {
  // 标记某个单元格为「正在播放」，同时记下可跨重建复原的坐标。
  // 返回递增令牌，调用方在 finally 里凭令牌判断该由不由自己收尾。
  markPlayingCell(cell) {
    if (!cell) return this.playingCellToken;
    this.clearPlayingCellHighlight();
    this.currentPlayingCell = cell;
    this.playingCellDescriptor = describePlayingCell(cell);
    cell.classList.add(PLAYING_CELL_CLASS);
    return ++this.playingCellToken;
  }

  isPlayingCell(cell) {
    return Boolean(cell) && cell === this.currentPlayingCell;
  }

  clearPlayingCellHighlight() {
    const descriptor = this.playingCellDescriptor;
    this.playingCellDescriptor = null;
    if (this.currentPlayingCell) {
      this.currentPlayingCell.classList.remove(PLAYING_CELL_CLASS, PAUSED_CELL_CLASS);
      this.currentPlayingCell = null;
    }
    // 高亮可能已被补写到重建后的新节点上，按坐标再擦一次，避免残留。
    const rebuilt = resolvePlayingCell(descriptor);
    if (rebuilt) rebuilt.classList.remove(PLAYING_CELL_CLASS, PAUSED_CELL_CLASS);
  }

  // 表格被 Obsidian 重建后，把高亮补回到新的单元格节点上。
  reassertPlayingHighlight() {
    const descriptor = this.playingCellDescriptor;
    if (!descriptor) return;
    if (this.currentPlayingCell &&
        this.currentPlayingCell.isConnected &&
        this.currentPlayingCell.classList.contains(PLAYING_CELL_CLASS)) {
      return;
    }
    const cell = resolvePlayingCell(descriptor);
    if (!cell) return;
    if (this.currentPlayingCell && this.currentPlayingCell !== cell) {
      this.currentPlayingCell.classList.remove(PLAYING_CELL_CLASS);
    }
    this.currentPlayingCell = cell;
    cell.classList.add(PLAYING_CELL_CLASS);
    cell.classList.toggle(PAUSED_CELL_CLASS, this.isPaused);
  }

  // ==================== 暂停 / 继续 ====================
  // 暂停不同于停止：停止会作废当前播放任务，暂停只是把这一格按住不放，
  // 恢复后从断点接着播放，不必重新点一遍。
  togglePlaybackPause() {
    if (!this.currentPlayingAudio && !this.currentPlayRequest) {
      new Notice("当前没有正在播放的音频", 1500);
      return;
    }
    if (this.isPaused) this.resumePlayback();
    else this.pausePlayback();
  }

  pausePlayback() {
    if (this.isPaused) return;
    this.isPaused = true;
    const audio = this.currentPlayingAudio;
    // awaitClipPlayback 的 onpause 只在请求已作废时才收尾，
    // 因此这里按下去不会让挂起的 Promise 提前兑现，播放任务原地暂停。
    if (audio && !audio.paused) {
      try { audio.pause(); } catch (e) {}
    }
    if (this.currentPlayingCell) this.currentPlayingCell.classList.add(PAUSED_CELL_CLASS);
  }

  resumePlayback() {
    if (!this.isPaused) return;
    this.isPaused = false;
    if (this.currentPlayingCell) this.currentPlayingCell.classList.remove(PAUSED_CELL_CLASS);
    const audio = this.currentPlayingAudio;
    if (audio && audio.paused && !audio.ended) {
      audio.play().catch(() => {});
    }
    this.wakePauseWaiters();
  }

  wakePauseWaiters() {
    const waiters = this.pauseWaiters;
    this.pauseWaiters = [];
    for (const wake of waiters) {
      try { wake(); } catch (e) {}
    }
  }

  // 同一格包含多个音标时，音标之间的间隔必须认暂停。
  async sleepRespectingPause(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
    while (this.isPaused) {
      await new Promise((resolve) => this.pauseWaiters.push(resolve));
    }
  }

  stopCurrentAudio() {
    // 停止会作废当前任务，因此必须先解除暂停并唤醒所有等待者。
    this.isPaused = false;
    this.wakePauseWaiters();

    // 标记当前进行中的单音频异步请求已废弃
    if (this.currentPlayRequest) {
      this.currentPlayRequest.aborted = true;
      this.currentPlayRequest = null;
    }

    // 必须先兑现挂起的播放 Promise，再摘掉事件处理器，否则等待方永远醒不过来。
    if (this.currentPlaybackResolve) {
      const resolvePending = this.currentPlaybackResolve;
      this.currentPlaybackResolve = null;
      try { resolvePending(); } catch (e) {}
    }

    if (this.currentPlayingAudio) {
      const audio = this.currentPlayingAudio;
      audio.onended = null;
      audio.onerror = null;
      audio.onpause = null;
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.src = "";
      } catch (e) {}
      this.currentPlayingAudio = null;
    }

    this.clearPlayingCellHighlight();

    if (this.currentBlobUrl) {
      try {
        URL.revokeObjectURL(this.currentBlobUrl);
      } catch (e) {}
      this.currentBlobUrl = null;
    }
  }

  async playSingleCellAudio(cell, type, context) {
    // 同一格再次点击作为暂停 / 继续；点另一格则立即停止旧音频并播放新格。
    if (this.isPlayingCell(cell) && (this.currentPlayingAudio || this.currentPlayRequest)) {
      this.togglePlaybackPause();
      return;
    }

    this.stopCurrentAudio();

    const resolved = this.resolveAudioForCell(cell, type, context);
    return this.playResolvedAudio(cell, resolved);
  }

  resolveListeningAudio(entry) {
    if (!entry?.sourcePath || !listeningNotePath(entry.sourcePath)) return null;
    const file = { path: entry.sourcePath };
    const forms = [entry.word, ...entry.word.split(/\s*\/\s*/)].map(word => word.replace(/\([^)]*\)/g, "").trim());
    const word = forms.map(form => findAudioFilePath(this.app, form, file)).find(Boolean);
    const chunk = findChunkAudioPath(this.app, entry.chunk, entry.word, file);
    return { label: entry.word, paths: [...new Set([word, chunk].filter(Boolean))], word, chunk };
  }

  async playResolvedAudio(cell, resolved) {
    if (!resolved || !resolved.paths || resolved.paths.length === 0) {
      const label = resolved && resolved.label ? resolved.label : "当前单元格";
      new Notice(`⚠️ [${label}] 未找到可播放音频`, 2000);
      return;
    }

    const request = { aborted: false };
    this.currentPlayRequest = request;
    const isStillCurrent = () => !request.aborted && this.currentPlayRequest === request;
    const playingToken = this.markPlayingCell(cell);

    try {
      let prepared = prepareClipSafe(this, resolved.paths[0]);

      // 一个音标单元格可能含多个音标文件；它们仍属于当前单元格，
      // 可以逐个播放，但绝不再扫描或播放下一行。
      for (let index = 0; index < resolved.paths.length; index++) {
        if (!isStillCurrent()) {
          releaseClip(this, prepared);
          return;
        }

        const current = prepared;
        prepared = index + 1 < resolved.paths.length
          ? prepareClipSafe(this, resolved.paths[index + 1])
          : null;

        const outcome = await playClip(this, resolved.paths[index], isStillCurrent, current);
        if (outcome === "aborted" || !isStillCurrent()) {
          releaseClip(this, prepared);
          return;
        }

        if (index < resolved.paths.length - 1) {
          await this.sleepRespectingPause(getSettings().phonemeGapMs);
        }
      }
    } catch (err) {
      console.error("[TableSound] 单元格音频播放失败:", err);
    } finally {
      if (this.currentPlayRequest === request) this.currentPlayRequest = null;
      // 节点可能已被重建，因此凭令牌判断是否仍由本次播放负责收尾。
      if (this.playingCellToken === playingToken) this.clearPlayingCellHighlight();
    }
  }
}

module.exports = { PlaybackMethods };

},
"audio/clip": function (module, exports, require) {
const { getSettings } = require("./settings");

function applyPlaybackRate(audio) {
  const rate = Number(getSettings().playbackRate) || 1;
  if (rate > 0 && rate !== 1) audio.playbackRate = rate;
}

function prepareClip(plugin, path) {
  const audio = new Audio(plugin.app.vault.adapter.getResourcePath(path));
  audio.preload = "auto";
  applyPlaybackRate(audio);
  try { audio.load(); } catch (e) {}
  return { path, audio, blobUrl: null };
}

// 预取用：构造失败不应打断播放，返回 null 让调用方走常规路径。
function prepareClipSafe(plugin, path) {
  try {
    return prepareClip(plugin, path);
  } catch (err) {
    console.error("[TableSound] 预取失败:", path, err);
    return null;
  }
}

async function prepareClipViaBlob(plugin, path) {
  const arrayBuffer = await plugin.app.vault.adapter.readBinary(path);
  const blobUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: "audio/mpeg" }));
  plugin.currentBlobUrl = blobUrl;
  const audio = new Audio(blobUrl);
  applyPlaybackRate(audio);
  return { path, audio, blobUrl };
}

function releaseClip(plugin, clip) {
  if (!clip) return;
  if (clip.blobUrl) {
    try { URL.revokeObjectURL(clip.blobUrl); } catch (e) {}
    if (plugin.currentBlobUrl === clip.blobUrl) plugin.currentBlobUrl = null;
  }
  if (plugin.currentPlayingAudio === clip.audio) plugin.currentPlayingAudio = null;
  // 中止仍在进行的缓冲并释放已缓存数据（预取后未被播放的片段尤其需要）。
  try {
    clip.audio.pause();
    clip.audio.removeAttribute("src");
    clip.audio.load();
  } catch (e) {}
}

// 等待一条音频结束，返回 "ended" | "error" | "aborted"。
// stopCurrentAudio() 通过 currentPlaybackResolve 主动兑现，
// 避免它摘掉事件处理器之后等待方永远醒不过来。
function awaitClipPlayback(plugin, audio, isStillCurrent) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (outcome) => {
      if (settled) return;
      settled = true;
      audio.onended = null;
      audio.onerror = null;
      audio.onpause = null;
      if (plugin.currentPlaybackResolve === abort) plugin.currentPlaybackResolve = null;
      resolve(outcome);
    };
    const abort = () => finish("aborted");

    plugin.currentPlaybackResolve = abort;
    audio.onended = () => finish("ended");
    audio.onerror = () => {
      const code = audio.error ? audio.error.code : "unknown";
      console.error("[TableSound] 音频加载/解码失败, code:", code);
      finish("error");
    };
    audio.onpause = () => { if (!isStillCurrent()) finish("aborted"); };
    audio.play().catch(() => finish("error"));
  });
}

// 播放一条音频。prepared 可以是 prepareClip() 预取好的片段。
// 资源地址播放失败时，回落到 Blob 再试一次，保证不会因路径编码问题彻底放不出声。
async function playClip(plugin, path, isStillCurrent, prepared) {
  if (!isStillCurrent()) {
    releaseClip(plugin, prepared);
    return "aborted";
  }

  const clip = prepared || prepareClipSafe(plugin, path);
  if (clip) {
    plugin.currentPlayingAudio = clip.audio;
    const outcome = await awaitClipPlayback(plugin, clip.audio, isStillCurrent);
    releaseClip(plugin, clip);
    if (outcome !== "error") return outcome;
    console.warn("[TableSound] 资源地址播放失败，回落到 Blob 重试:", path);
  }

  if (!isStillCurrent()) return "aborted";
  let fallback = null;
  try {
    fallback = await prepareClipViaBlob(plugin, path);
  } catch (err) {
    console.error("[TableSound] 读取音频失败:", path, err);
    return "error";
  }
  if (!isStillCurrent()) {
    releaseClip(plugin, fallback);
    return "aborted";
  }

  plugin.currentPlayingAudio = fallback.audio;
  const outcome = await awaitClipPlayback(plugin, fallback.audio, isStillCurrent);
  releaseClip(plugin, fallback);
  return outcome;
}

module.exports = { applyPlaybackRate, prepareClip, prepareClipSafe, prepareClipViaBlob, releaseClip, awaitClipPlayback, playClip };

},
"audio/playingCell": function (module, exports, require) {
const { getAudioBindingText, getContentRootOfNode, getDataRows } = require("./dom");

// 指纹只取正文文本：插件自己插入的耳机和挡板都是空文本节点，
// 因此重建前后（有无按钮）算出来的指纹一致。
function playingCellFingerprint(cell) {
  return getAudioBindingText(cell).slice(0, 160);
}

function describePlayingCell(cell) {
  if (!cell || !cell.closest) return null;
  const table = cell.closest("table");
  const root = getContentRootOfNode(cell);
  if (!table || !root) return null;
  const tableIndex = Array.from(root.querySelectorAll("table")).indexOf(table);
  const rowIndex = getDataRows(table).indexOf(cell.closest("tr"));
  if (tableIndex === -1 || rowIndex === -1) return null;
  return {
    root,
    tableIndex,
    rowIndex,
    colIndex: cell.cellIndex,
    fingerprint: playingCellFingerprint(cell),
  };
}

function resolvePlayingCell(descriptor) {
  if (!descriptor || !descriptor.root || !descriptor.root.isConnected) return null;
  const table = descriptor.root.querySelectorAll("table")[descriptor.tableIndex];
  if (!table) return null;
  const row = getDataRows(table)[descriptor.rowIndex];
  if (!row) return null;
  const cell = row.querySelectorAll("td, th")[descriptor.colIndex];
  if (!cell) return null;
  // 指纹不符说明表格结构真的改了（增删行列），宁可不高亮也不要点亮错误的格子。
  if (playingCellFingerprint(cell) !== descriptor.fingerprint) return null;
  return cell;
}

module.exports = { playingCellFingerprint, describePlayingCell, resolvePlayingCell };

},
"audio/features/resolve": function (module, exports, require) {
const { Notice } = require("obsidian");
const { getDataRows, normalizeHeaderText } = require("../dom");
const { extractAllTargetPhonemes, extractTargetPhoneme, extractTargetSentence, extractTargetWord, isKnownPhoneme } = require("../extract");
const { findAudioFilePath, findChunkAudioPath, findPhonemeAudioPath, findSentenceAudioPath } = require("../lookup");
const { listeningNotePath, sectionSourceOf } = require("../../shared/notes");

class ResolveMethods {
  resolveAudioMetadataForCell(cell, type, context) {
    if (!cell || !type) return null;

    let resolvedType = type;
    if (resolvedType === "auto") {
      const phonemes = extractAllTargetPhonemes(cell);
      if (phonemes.length > 0) {
        resolvedType = "phoneme";
      } else {
        const sentenceText = extractTargetSentence(cell);
        resolvedType = sentenceText.split(/\s+/).filter(Boolean).length >= 4
          ? "sentence"
          : "word";
      }
    }

    if (resolvedType === "word") {
      // 耳机可能挂在拆解/短语格，词头必须取配对的单词格，不能解析按钮所在格。
      const targetWord = extractTargetWord(context && context.wordCell ? context.wordCell : cell);
      if (!targetWord) return null;
      // 短语格空着时不许诺连播：整列存在不代表这一行有切片。
      const followsChunk = Boolean(
        context && context.chunkCell && extractTargetSentence(context.chunkCell)
      );
      return {
        resolvedType,
        label: targetWord,
        itemCount: followsChunk ? 2 : 1,
        followsChunk
      };
    }

    if (resolvedType === "chunk") {
      const chunkText = extractTargetSentence(cell);
      const wordCell = context ? context.wordCell : null;
      const targetWord = wordCell ? extractTargetWord(wordCell) : "";
      const label = chunkText || targetWord;
      return label ? { resolvedType, label, itemCount: 1 } : null;
    }

    if (resolvedType === "phoneme" || resolvedType === "phonetic") {
      const phonemes = extractAllTargetPhonemes(cell, resolvedType === "phonetic");
      const wordCell = context ? context.wordCell : null;
      const targetWord = wordCell ? extractTargetWord(wordCell) : "";
      if (phonemes.length === 0 && !targetWord) return null;
      return {
        resolvedType: "phoneme",
        label: phonemes.length > 0 ? phonemes.map((p) => `/${p}/`).join(" ") : targetWord,
        itemCount: Math.max(phonemes.length, 1),
      };
    }

    if (resolvedType === "sentence") {
      const sentenceText = extractTargetSentence(cell);
      return sentenceText ? { resolvedType, label: sentenceText, itemCount: 1 } : null;
    }

    return null;
  }

  resolveAudioForCell(cell, type, context) {
    if (!cell || !type) return null;
    // Central listening rows retain the original article's isolated audio directory.
    const contextFile = context?.file || this.app?.workspace?.getActiveFile?.();
    const contextPath = typeof contextFile === "string" ? contextFile : contextFile?.path || "";
    const centralListening = /(?:^|\/)02\. word\/m\. 剑雅听力真题\/音义词块\.md$/i.test(contextPath);
    const source = context?.wordCell?.querySelector?.(".hd-listening-source")?.dataset.source
      || (centralListening ? sectionSourceOf(context?.wordCell) : "");
    if (source && listeningNotePath(source)) context = { ...context, file: { path: source } };

    let resolvedType = type;
    if (resolvedType === "auto") {
      const p = extractTargetPhoneme(cell);
      if (p && (isKnownPhoneme(p) || findPhonemeAudioPath(this.app, p))) {
        resolvedType = "phoneme";
      } else {
        const w = extractTargetWord(cell);
        if (w && findAudioFilePath(this.app, w, context && context.file)) {
          resolvedType = "word";
        } else {
          const s = extractTargetSentence(cell);
          if (s && findSentenceAudioPath(this.app, s, context && context.file)) {
            resolvedType = "sentence";
          } else if (p) {
            resolvedType = "phoneme";
          } else {
            resolvedType = "word";
          }
        }
      }
    }

    if (resolvedType === "word") {
      // 耳机可能挂在拆解/短语格，词头必须取配对的单词格，不能解析按钮所在格。
      const targetWord = extractTargetWord(context && context.wordCell ? context.wordCell : cell);
      if (!targetWord) return null;
      const foundPath = findAudioFilePath(this.app, targetWord, context && context.file);
      const paths = foundPath ? [foundPath] : [];
      return {
        resolvedType: "word",
        label: targetWord,
        paths
      };
    } else if (resolvedType === "chunk") {
      const chunkText = extractTargetSentence(cell);
      const wordCell = context ? context.wordCell : null;
      const targetWord = wordCell ? extractTargetWord(wordCell) : "";
      if (!chunkText && !targetWord) return null;
      const foundPath = findChunkAudioPath(this.app, chunkText, targetWord, context && context.file);
      return {
        resolvedType: "chunk",
        label: chunkText || targetWord,
        paths: foundPath ? [foundPath] : []
      };
    } else if (resolvedType === "phoneme" || resolvedType === "phonetic") {
      const phonemes = extractAllTargetPhonemes(cell, resolvedType === "phonetic");
      const wordCell = context ? context.wordCell : null;
      const targetWord = wordCell ? extractTargetWord(wordCell) : "";

      if (phonemes.length === 0 && !targetWord) return null;

      const displayLabel = phonemes.length > 0 ? phonemes.map(p => `/${p}/`).join(" ") : targetWord;
      const foundPaths = [];
      for (const p of phonemes) {
        const pPath = findPhonemeAudioPath(this.app, p, context && context.file);
        if (pPath) foundPaths.push(pPath);
      }
      if (foundPaths.length === 0 && targetWord) {
        const wPath = findAudioFilePath(this.app, targetWord, context && context.file);
        if (wPath) foundPaths.push(wPath);
      }
      return {
        resolvedType: "phoneme",
        label: displayLabel,
        paths: foundPaths
      };
    } else if (resolvedType === "sentence") {
      const sentenceText = extractTargetSentence(cell);
      if (!sentenceText) return null;
      const foundPath = findSentenceAudioPath(this.app, sentenceText, context && context.file);
      return {
        resolvedType: "sentence",
        label: sentenceText,
        paths: foundPath ? [foundPath] : []
      };
    }

    return null;
  }

  // ==================== 缺失音频体检 ====================
  // 逐格解析当前笔记的音频列，列出解析不到文件的单元格。
  // 对应知识库「交付前必须核验词块双声音频与短语切片全覆盖」的要求。
  reportMissingAudio() {
    const contexts = this.getManagedContexts();
    if (!contexts.length) {
      new Notice("没有找到可体检的 Markdown 视图", 2000);
      return;
    }

    const missing = [];
    let checked = 0;

    for (const ctx of contexts) {
      for (const table of ctx.root.querySelectorAll("table")) {
        if (this.isAudioExcluded(table, ctx.file)) continue;

        const headerRow = table.querySelector("thead tr, tr:first-child");
        if (!headerRow) continue;
        const headers = headerRow.querySelectorAll("th, td");
        if (!headers.length) continue;

        const colTypes = [];
        for (let c = 0; c < headers.length; c++) colTypes.push(this.getColumnAudioType(headers[c]));
        const wordColIndex = this.getWordColIndex(headers);

        for (const row of getDataRows(table)) {
          const cells = row.querySelectorAll("td");
          for (let c = 0; c < colTypes.length; c++) {
            if (!colTypes[c] || c >= cells.length) continue;
            const cell = cells[c];
            const wordCell = wordColIndex !== -1 ? cells[wordColIndex] : null;
            checked++;
            let res = null;
            try {
              res = this.resolveAudioForCell(cell, colTypes[c], { wordCell, table });
            } catch (err) {
              console.error("[TableSound] 体检解析失败:", err);
            }
            if (res && res.paths && res.paths.length > 0) continue;

            const label = (cell.textContent || "").replace(/[🎧🔊]/g, "").trim().slice(0, 40);
            missing.push({
              file: ctx.file ? ctx.file.path : "(未知文件)",
              column: normalizeHeaderText(headers[c]),
              text: label || "(空单元格)",
            });
          }
        }
      }
    }

    if (!missing.length) {
      new Notice(`音频体检通过：${checked} 个单元格全部可解析`, 3000);
      console.info(`[TableSound] 音频体检通过，共检查 ${checked} 个单元格。`);
      return;
    }

    console.group(`[TableSound] 音频体检：${checked} 个单元格中有 ${missing.length} 个缺失`);
    console.table(missing);
    console.groupEnd();
    new Notice(`音频体检：${missing.length}/${checked} 个单元格缺失音频，明细见控制台`, 5000);
  }
}

module.exports = { ResolveMethods };

},
"audio/features/tables": function (module, exports, require) {
const { PLAYING_CELL_CLASS, PLUGIN_CHROME_SELECTOR, WORD_COL_CLASS } = require("../constants");
const { createAudioBtn, getAudioBindingKey, getDataRows, isPhraseHeaderText, isVocabularyHeaderRow } = require("../dom");
const { isKnownPhoneme, isPurePhonemeCell } = require("../extract");
const { getAudioColumnLookup, getSettings } = require("../settings");
const { isPluginExcludedNote } = require("../../shared/notes");

class TableMethods {
  updateManagedTables(tables = null) {
    this.syncViewObservers();
    // 重建后的新节点先认领高亮，后面的解绑逻辑才知道哪一格不能擦。
    this.reassertPlayingHighlight();
    const contexts = this.getManagedContexts();
    if (!contexts.length) return;

    for (const ctx of contexts) {
      const scoped = tables === null
        ? Array.from(ctx.root.querySelectorAll("table"))
        : tables.filter((table) => ctx.root.contains(table));

      for (let i = 0; i < scoped.length; i++) {
        try {
          this.processTable(scoped[i], ctx);
        } catch (err) {
          console.error("[TableSound] Error processing table index " + i + ":", err);
        }
      }
    }

    this.reassertPlayingHighlight();
  }

  processTable(table, ctx) {
    const file = ctx && ctx.file ? ctx.file : null;

    // 表头黑名单：整表判定为纯文本分析，不挂耳机，保持纯净文本。
    if (this.hasExcludedHeader(table)) {
      this.clearAudioFromTable(table);
      return;
    }

    // 路径黑名单：整篇不挂耳机。
    if (this.isPathExcluded(file)) {
      this.clearAudioFromTable(table);
      return;
    }

    const headerRow = table.querySelector("thead tr, tr:first-child");
    if (!headerRow) return;
    const headers = headerRow.querySelectorAll("th, td");
    if (headers.length < 1) return;

    // 首次打开表格时耳机推迟一帧挂载；已有绑定的编辑刷新仍走同步 O(1) 指纹快路。
    if (table.querySelector("[data-audio-bound]")) {
      this.bindAudioButtons(table, ctx);
    } else {
      this.queueAudioBinding(table);
    }
  }

  getWordColIndex(headers) {
    if (!headers) return -1;
    for (let i = 0; i < headers.length; i++) {
      const text = (headers[i].textContent || "").replace(/[\*_~`#]/g, "").trim();
      if (
        getAudioColumnLookup().get(text) === "word" ||
        text.includes("单词") ||
        text.includes("答案词") ||
        text.includes("核心词") ||
        text.includes("考点词") ||
        text.includes("词块") ||
        text.includes("介词") ||
        text.includes("连词") ||
        text.includes("副词") ||
        isPhraseHeaderText(text) ||
        text.toLowerCase().includes("word") ||
        text.includes("答案") ||
        text.includes("语料") ||
        text.includes("例子") ||
        text.includes("表达")
      ) {
        return i;
      }
    }
    return -1;
  }

  clearAudioFromTable(table) {
    const btns = table.querySelectorAll(PLUGIN_CHROME_SELECTOR);
    for (let i = 0; i < btns.length; i++) btns[i].remove();
    const boundCells = table.querySelectorAll("[data-audio-bound], [data-sentence-audio-bound]");
    for (let i = 0; i < boundCells.length; i++) {
      boundCells[i].removeAttribute("data-audio-bound");
      boundCells[i].removeAttribute("data-sentence-audio-bound");
      boundCells[i].removeAttribute("data-audio-source-key");
      boundCells[i].__tableSoundPlayFn = null;
      boundCells[i].style.cursor = "";
      // 解绑按钮不等于播放结束：正在播放的那一格必须保住浅绿色高亮。
      if (!this.isPlayingCell(boundCells[i])) {
        boundCells[i].classList.remove(PLAYING_CELL_CLASS);
      }
    }
  }

  removeAudioFromCell(cell) {
    const btns = cell.querySelectorAll(PLUGIN_CHROME_SELECTOR);
    for (let i = 0; i < btns.length; i++) btns[i].remove();
    cell.removeAttribute("data-audio-bound");
    cell.removeAttribute("data-sentence-audio-bound");
    cell.removeAttribute("data-audio-source-key");
    cell.__tableSoundPlayFn = null;
    cell.style.cursor = "";
    if (!this.isPlayingCell(cell)) {
      cell.classList.remove(PLAYING_CELL_CLASS);
    }
  }

  getColumnAudioType(headerCell) {
    if (!headerCell) return null;
    const raw = (headerCell.textContent || "").trim();
    // 清洗掉 Markdown 格式符号 (如 **单词** -> 单词)
    const clean = raw.replace(/[\*_~`#]/g, "").trim();

    // 0. 词汇表（`单词 | 短语 | 拆解 | 音标`）的音标列只供悬浮卡片读取，不挂耳机。
    if (clean === "音标" && isVocabularyHeaderRow(headerCell.closest("tr"))) return null;

    // 1. 优先精确匹配白名单
    const matched = getAudioColumnLookup().get(clean);
    // 「短语」既是第一列的词条列表头，也是第二列的短语（原意群）列表头：第一列算 word，第二列起算 chunk。
    // 意群列在首列的表（`意群 | 短语 | 释义`）里，「短语」是第二列的词条列。
    const firstHeaderCell = headerCell.parentElement && headerCell.parentElement.firstElementChild;
    const chunkLeads = !!firstHeaderCell && firstHeaderCell !== headerCell
      && (firstHeaderCell.textContent || "").replace(/[\*_~`#]/g, "").trim() === "意群";
    if (matched === "chunk" && clean === "短语" && headerCell.parentElement && (firstHeaderCell === headerCell || chunkLeads)) return "word";
    if (matched) return matched;

    // 2. 包含“单词”“核心词”或以“短语”收尾的表头默认判定为 word 列。
    // 必须排在黑名单之前：词书表头形如「行为动作单词」「滑动练习单词」，
    // 前缀是主题名，可能正好撞上「动作」「说明」这类给解释列准备的黑名单词；
    // 一旦让黑名单先跑，整列会被判空，耳机与 R / L 标记会一起消失。
    // 带「单词 / 核心词」或以「短语」收尾的表头是词条列，语义上已无歧义，直接放行。
    if (clean.includes("单词") || clean.includes("答案词") || clean.includes("核心词") || clean === "表达" || isPhraseHeaderText(clean)) {
      return "word";
    }

    // 2.5 第二列是「短语」，第一列就是词条列——表头叫什么随便（系列名、分类名都算）。
    // 这条必须排在黑名单与斜杠规则之前，否则两头都会漏：
    //   - 黑名单：「for 系列（目的 ➔ 原因 / 解释 / 追求）」「解释副词」撞上「解释」被判空，整列没按钮；
    //   - 斜杠规则：「to 系列（方向 ➔ 目标 / 顺应 / 导致）」里的 / 是顿隔符不是音标公式，
    //     被判成 auto 后整表没有 word 列，短语列于是保住了本该并入词条格连播的耳机。
    // 放在白名单之后是关键：音标 / 清音 / 浊音 这类发音列已在第 1 条精确匹配走，不会误伤。
    const ownRow = headerCell.closest("tr");
    if (ownRow) {
      const ownCells = ownRow.querySelectorAll("th, td");
      if (ownCells.length >= 2 && headerCell === ownCells[0]) {
        const secondClean = (ownCells[1].textContent || "").replace(/[\*_~`#]/g, "").trim();
        if (getAudioColumnLookup().get(secondClean) === "chunk") return "word";
      }
    }

    // 3. 检查解释说明类黑名单 (如 "发音技巧", "两个接触面", "释义", "解释", "拆解", "机制" 等坚决排除)
    for (const exKw of getSettings().excludeColumnKeywords) {
      if (clean.includes(exKw)) {
        return null;
      }
    }

    // 4. 用户核心规则：只要表头包含“音”（连音、加音、爆破音、浊音、清音、读音、发音、语音、音标、音素、省音、重音等），判定为 auto 音频列
    if (clean.includes("音")) {
      return "auto";
    }

    // 5. 包含音标斜杠或加号公式（如 /ə/ + /r/、/u:/ + /w/）判定为 auto 音频列
    if (clean.includes("/") || clean.includes("+")) {
      return "auto";
    }

    // 6. 双列表格智能推断：如果表格只有 2 列，且第二列为解释/说明/释义列，
    // 第一列非解释黑名单时，判定为 auto 音频列（挂载耳机与朗读）
    const headerRow = headerCell.closest("tr");
    if (headerRow) {
      const rowHeaders = headerRow.querySelectorAll("th, td");
      if (rowHeaders.length === 2 && headerCell === rowHeaders[0]) {
        const nextClean = (rowHeaders[1].textContent || "").replace(/[\*_~`#]/g, "").trim();
        if (nextClean.includes("解释") || nextClean.includes("说明") || nextClean.includes("释义") || nextClean.includes("原理") || nextClean.includes("机制")) {
          return "auto";
        }
      }
    }

    return null;
  }

  lastVisibleColumnIndex(headers, lastColIndex) {
    const plugins = this.app.plugins;
    if (!plugins || !plugins.enabledPlugins || !plugins.enabledPlugins.has("highlight-decompose")) {
      return lastColIndex;
    }
    const names = Array.from(headers).map((h) => (h.textContent || "").replace(/[\*_~`#]/g, "").trim());
    const hidden = new Set();
    const hasChunk = names.includes("短语") || names.includes("意群");
    const table = headers[0] && headers[0].closest ? headers[0].closest("table") : null;
    // 03. phrase 与 02. word 单词表的「释义」列是直接显示的列（后者拆解列才是卡片源），不能算作隐藏列。
    const meaningVisible = (table && table.classList.contains("hd-meaning-visible")) || names.some((n) => /拆解|英意/.test(n));
    names.forEach((name, i) => /拆解|英意/.test(name) && hasChunk && hidden.add(i));
    // 评分列在显示层隐藏, 耳机不能挂到它上面
    if (names.includes("评分")) hidden.add(names.indexOf("评分"));
    if (names.includes("同义词")) hidden.add(names.indexOf("同义词"));
    if (names.some((n) => /拆解|英意/.test(n)) && hasChunk && names.includes("音标")) hidden.add(names.indexOf("音标"));
    if ((names[1] === "短语" || names[1] === "意群") && names.includes("释义") && !meaningVisible) hidden.add(names.indexOf("释义"));
    if (names[1] === "释义" && !meaningVisible) hidden.add(1);
    for (let i = lastColIndex; i >= 0; i--) if (!hidden.has(i)) return i;
    return lastColIndex;
  }

  mountAudioToCell(cell, type, context) {
    if (!cell || !type) return;

    const bindingKey = getAudioBindingKey(cell, type, context);
    const directBtn = cell.querySelector(":scope > .audio-playback-btn");
    if (
      cell.dataset.audioBound === type &&
      cell.dataset.audioSourceKey === bindingKey &&
      directBtn
    ) {
      return;
    }

    // 首次挂载和编辑刷新只解析文字；真正点击时再查找音频文件。
    const metadata = this.resolveAudioMetadataForCell(cell, type, context);
    if (!metadata) {
      this.removeAudioFromCell(cell);
      return;
    }

    const { label } = metadata;
    const tooltip = metadata.followsChunk
      ? `🎧 播放 [${label}] → 本行短语原声（播放时点它可暂停 / 继续）`
      : `🎧 播放 [${label}]（播放时点它可暂停 / 继续）`;
    cell.__tableSoundPlayFn = () => this.playSingleCellAudio(cell, type, context);

    // 清理旧按钮
    const existingDirectAudio = cell.querySelectorAll(":scope > .audio-playback-btn");
    for (const audioButton of existingDirectAudio) audioButton.remove();

    const btn = createAudioBtn(tooltip, () => {
      if (typeof cell.__tableSoundPlayFn === "function") cell.__tableSoundPlayFn();
    });
    cell.appendChild(btn);

    // 绑定单元格点击事件；清理并重新挂载按钮时不重复注册监听器。
    cell.style.position = "relative";
    const wrapper = cell.querySelector(".table-cell-wrapper");
    if (wrapper) wrapper.style.position = "relative";
    // 正文区不挂任何监听：单元格本来就是编辑区域，点它就该正常进编辑模式。
    // 播放与暂停全部收进 🎧 按钮，与编辑动作天然分开。
    // 早期版本在这里留过 inline cursor:pointer，必须清掉，否则光标仍在暗示可点播放。
    cell.style.cursor = "";
    cell.dataset.audioBound = type;
    cell.dataset.audioSourceKey = bindingKey;
  }

  // 单词列不换行：表头含「单词 / 核心词」的那一列打上 WORD_COL_CLASS，
  // 样式只作用在这个类上（见 styles.css），普通表格不受影响。
  markWordColumn(table, headers) {
    let wordCol = -1;
    for (let c = 0; c < headers.length; c++) {
      const clean = (headers[c].textContent || "").replace(/[\*_~`#]/g, "").trim();
      if (clean.includes("单词") || clean.includes("答案词") || clean.includes("核心词")) { wordCol = c; break; }
    }
    for (const row of table.querySelectorAll("tr")) {
      const cells = row.querySelectorAll("th, td");
      for (let i = 0; i < cells.length; i++) cells[i].classList.toggle(WORD_COL_CLASS, i === wordCol);
    }
  }

  // Base reference notes only need the matching entry, not audio resolution.
  bindBaseReferenceEntry(table) {
    if (!table.classList.contains("hd-base-examples-table")) return;
    table.classList.add("ts-word-led");
    for (const row of getDataRows(table)) {
      const cell = row.cells[0];
      if (!cell || cell.querySelector(":scope > .audio-playback-btn")) continue;
      const btn = createAudioBtn("耳机", () => {});
      btn.setAttribute("aria-disabled", "true");
      cell.appendChild(btn);
      cell.dataset.audioBound = "base-reference";
    }
  }

  bindAudioButtons(table, ctx = null) {
    const contextFile = (ctx && ctx.file) || (this.getManagedContexts().find((c) => c.root.contains(table)) || {}).file;
    if (isPluginExcludedNote(contextFile)) {
      this.clearAudioFromTable(table);
      return;
    }
    const headerRow = table.querySelector("thead tr, tr:first-child");
    if (!headerRow) return;
    const headers = headerRow.querySelectorAll("th, td");
    if (!headers.length) return;
    this.markWordColumn(table, headers);

    if (this.isAudioExcluded(table, contextFile)) {
      this.clearAudioFromTable(table);
      return;
    }

    // 1. 解析每一列的白名单类型，并检测表头是否为常规文字表头
    const colTypes = [];
    let wordColIndex = this.getWordColIndex(headers);
    let hasAnyWhitelistedCol = false;
    let hasAnyStandardHeader = false;

    for (let c = 0; c < headers.length; c++) {
      const type = this.getColumnAudioType(headers[c]);
      colTypes.push(type);
      if (type) hasAnyWhitelistedCol = true;

      const raw = (headers[c].textContent || "").replace(/[\*_~`#]/g, "").trim();
      if (raw.length > 0 && !isKnownPhoneme(raw) && !getAudioColumnLookup().has(raw)) {
        hasAnyStandardHeader = true;
      }
    }

    // 2. 如果整表没有任何一列命中白名单：
    if (!hasAnyWhitelistedCol) {
      if (!hasAnyStandardHeader) {
        const allCells = Array.from(table.querySelectorAll("th, td"));
        const purePhonemeCells = new Set();

        for (let i = 0; i < allCells.length; i++) {
          const cell = allCells[i];
          if (isPurePhonemeCell(cell)) {
            purePhonemeCells.add(cell);
          }
        }

        if (purePhonemeCells.size >= 8) {
          const rows = getDataRows(table);
          for (let i = 0; i < allCells.length; i++) {
            const cell = allCells[i];
            if (purePhonemeCells.has(cell)) {
              const rowIndex = rows.indexOf(cell.closest("tr"));
              if (rowIndex === -1) {
                // 第一行仍是表头：不在表头放耳机。
                this.removeAudioFromCell(cell);
              } else {
                this.mountAudioToCell(cell, "phoneme", {
                  table,
                  colIndex: cell.cellIndex,
                  rowIndex,
                  file: contextFile,
                });
              }
            } else {
              this.removeAudioFromCell(cell);
            }
          }
          return;
        }
      }

      this.clearAudioFromTable(table);
      return;
    }

    // 3. 表头只保留列名；音频只由正文单元格里的耳机按钮触发。
    for (let c = 0; c < headers.length; c++) {
      this.removeAudioFromCell(headers[c]);
    }

    // 4. 判定是否为发音/音标专项目录或表格
    // 词汇表(单词 | 音标 | ... | 英意)的音标列只供悬浮卡片读取, 不能让整表被当成发音表。
    const isVocabTable = isVocabularyHeaderRow(headerRow);
    const isPhoneticsTable = colTypes.some((t) => t === "phoneme" || t === "phonetic") ||
      !isVocabTable && Array.from(headers).some((h) => {
        const text = (h.textContent || "").replace(/[\*_~`#]/g, "").trim();
        return text === "清音" || text === "浊音" || text === "清辅音" || text === "浊辅音" || text === "音标";
      });

    const isPronunciationDoc = this.isPronunciationFile(contextFile);

    const rows = getDataRows(table);

    if (isPhoneticsTable) {
      // 发音专项目录：按列白名单类型分别挂载（如清音列挂清音、浊音列挂浊音、音标列挂音标）
      for (let r = 0; r < rows.length; r++) {
        const cells = rows[r].querySelectorAll("td");
        for (let c = 0; c < cells.length; c++) {
          const cell = cells[c];
          const type = colTypes[c];
          if (!type || (type !== "phoneme" && type !== "phonetic")) {
            this.removeAudioFromCell(cell);
            continue;
          }
          this.mountAudioToCell(cell, type, {
            table,
            colIndex: c,
            rowIndex: r,
            file: contextFile,
          });
        }
      }
      return;
    }

    // 音标篇只给音标表与例词/例句表挂耳机，基础机制表保持纯文本。
    if (isPronunciationDoc && !this.isPronunciationExampleTable(table)) {
      this.clearAudioFromTable(table);
      return;
    }

    // 5. 非发音通用表格（词汇/短语/语法/阅读/听力等）：
    // 耳机挂在第一列（单词/词块格），悬浮才显示；只有 01. base 仍挂在最后一个可见列。
    // 播放严格按序连播：先念单词/短语标准发音，再念短语语流原声
    const lastColIndex = headers.length - 1;
    wordColIndex = this.getWordColIndex(headers);
    if (wordColIndex === -1 || wordColIndex === lastColIndex) {
      const candidateIndex = Array.from(headers).findIndex((h, idx) => {
        if (idx === lastColIndex) return false;
        const text = (h.textContent || "").replace(/[\*_~`#]/g, "").trim();
        return !(idx >= 1 && (text.includes("短语") || text.includes("意群"))) && !text.includes("例子");
      });
      if (candidateIndex !== -1) wordColIndex = candidateIndex;
      else if (wordColIndex === -1) wordColIndex = 0;
    }
    const chunkColIndex = Array.from(headers).findIndex((h, idx) => {
      const text = (h.textContent || "").replace(/[\*_~`#]/g, "").trim();
      return (idx >= 1 && (text.includes("短语") || text.includes("意群"))) || text.includes("语块") || text.includes("Chunk");
    });

    // highlight-decompose 会把部分列收起、改为悬浮卡片（规则须与它的 hiddenColumnsFor 一致）：
    // 拆解列；短语表的「释义」列；第 2 列为「释义」的释义列。
    // 耳机挂到最后一个仍可见的列上，否则会跟着被收起的列一起消失。
    // 01. base 以外的笔记（以及任何带「拆解」列的词汇表）挂在单词列，
    // 悬浮该单词格时才显示（见 styles.css 的 table.ts-word-led）。
    const isWordLed = !this.isBaseFile(contextFile) ||
      this.isPhonemesFile(contextFile) ||
      Array.from(headers).some((h) => (h.textContent || "").replace(/[\*_~`#]/g, "").trim().match(/拆解|英意/));
    table.classList.toggle("ts-word-led", isWordLed && wordColIndex !== -1);
    const audioColIndex = isWordLed && wordColIndex !== -1
      ? wordColIndex
      : this.lastVisibleColumnIndex(headers, lastColIndex);

    for (let r = 0; r < rows.length; r++) {
      const cells = rows[r].querySelectorAll("td");
      const wordCell = wordColIndex !== -1 && wordColIndex < cells.length ? cells[wordColIndex] : null;
      const chunkCell = chunkColIndex !== -1 && chunkColIndex < cells.length ? cells[chunkColIndex] : null;

      for (let c = 0; c < cells.length; c++) {
        const cell = cells[c];
        if (c === audioColIndex) {
          this.mountAudioToCell(cell, "word", {
            wordCell,
            chunkCell,
            table,
            colIndex: c,
            rowIndex: r,
            file: contextFile,
          });
        } else {
          this.removeAudioFromCell(cell);
        }
      }
    }
  }
}

module.exports = { TableMethods };

},
"audio/features/settingsStore": function (module, exports, require) {
const { AUDIO_COLUMN_TYPES } = require("../constants");
const { DEFAULT_SETTINGS, applyRuntimeSettings } = require("../settings");

class SettingsStoreMethods {
  // ==================== 设置读写 ====================
  async loadSettings() {
    const stored = (await this.loadData()) || {};
    const merged = { ...DEFAULT_SETTINGS, ...stored };
    // 迁移: 旧的统一开关拆成阅读、听力两个开关。
    if (typeof stored.hideArticleHighlights === "boolean") {
      if (!("hideReadingArticleHighlights" in stored)) merged.hideReadingArticleHighlights = stored.hideArticleHighlights;
      if (!("hideListeningArticleHighlights" in stored)) merged.hideListeningArticleHighlights = stored.hideArticleHighlights;
      delete merged.hideArticleHighlights;
    }

    // 迁移：旧版把列名配置存成扁平的「列名 -> 类型」，现按「类型 -> 列名数组」组织。
    if (merged.audioColumns && typeof merged.audioColumns === "object") {
      const values = Object.values(merged.audioColumns);
      if (values.length && values.every((value) => typeof value === "string")) {
        const grouped = {};
        for (const [name, type] of Object.entries(merged.audioColumns)) {
          if (!AUDIO_COLUMN_TYPES.includes(type)) continue;
          (grouped[type] = grouped[type] || []).push(name);
        }
        merged.audioColumns = grouped;
      }
    }
    // 迁移：旧结构回退映射已整体移除，音频一律走 1:1 新结构，陈旧键直接丢弃。
    delete merged.articleAudioRoots;
    delete merged.legacyAudioRoots;
    // 迁移：三个库结构路径已固化为代码常量，不再作为可编辑设置。
    // 迁移：文章级隔离已成结构性事实，跨文章模糊回退整段移除，两个开关随之作废。
    delete merged.strictAudioMatch;
    delete merged.logMatchTier;
    delete merged.vaultPrefix;
    delete merged.audioRoot;
    delete merged.listeningPathPrefix;

    // 迁移：释义遮罩整体移除（改由 highlight-decompose 的悬浮卡片显示释义），丢弃全部遮罩配置。
    for (const key of ["maskColumns", "maskGap", "maskGapX", "maskGapBottom", "maskModes",
                       "maskAllVisibleLeaves", "revealMode"]) {
      delete merged[key];
    }

    // 旧版支持按列连续播放；现已改为只播放当前单元格，丢弃条目间隔。
    delete merged.clipGapMs;

    // 形状校验，避免旧版或手改过的 data.json 让插件崩掉。
    // 迁移：「单词表第二列」与「展示释义」开关均已移除。
    delete merged.secondColumn;
    delete merged.showMeaning;
    if (!merged.audioColumns || typeof merged.audioColumns !== "object") {
      merged.audioColumns = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.audioColumns));
    }
    for (const type of AUDIO_COLUMN_TYPES) {
      if (!Array.isArray(merged.audioColumns[type])) merged.audioColumns[type] = [];
    }
    for (const key of ["excludePathKeywords", "excludeHeaderKeywords",
                       "excludeColumnKeywords"]) {
      if (!Array.isArray(merged[key])) merged[key] = DEFAULT_SETTINGS[key];
    }
    for (const key of ["listeningHoverAudio", "readingHoverAudio", "writingHoverAudio", "speakingHoverAudio",
                       "hideListeningArticleHighlights", "hideReadingArticleHighlights",
                       "hideWritingArticleHighlights", "hideSpeakingArticleHighlights",
                       "showListeningHighlights", "showReadingHighlights",
                       "showListeningQuestionHighlights", "showReadingQuestionHighlights"]) {
      if (typeof merged[key] !== "boolean") merged[key] = DEFAULT_SETTINGS[key];
    }
    this.settings = merged;
    applyRuntimeSettings(merged);
    // Initial loading is asynchronous; update views that mounted before it finished.
    this.app.workspace.trigger("highlight-decompose:settings");
  }

  async saveSettings() {
    await this.saveData(this.settings);
    applyRuntimeSettings(this.settings);
    this.app.workspace.trigger("highlight-decompose:settings");
    this.requestUpdate(true);
  }
}

module.exports = { SettingsStoreMethods };

},
"hd/marks": function (module, exports, require) {
// ---- 两层词汇标记：0 基础（不标），1 高亮 ==w== ----
function splitMarks(text, preserveBold = false) {
  const metadata = text.match(/\s*<span\b[^>]*\bclass="hd-listening-source"[^>]*><\/span>\s*$/)?.[0] || "";
  if (metadata) text = text.slice(0, -metadata.length);
  let lead = text.match(/^\s*/)[0];
  let trail = text.slice(lead.length).match(/\s*$/)[0];
  let core = text.slice(lead.length, text.length - trail.length);
  const markers = new Set();
  for (;;) {
    const m = ["**", "=="].find((mk) => core.length > 4 && core.startsWith(mk) && core.endsWith(mk));
    if (!m) break;
    const inner = core.slice(2, -2);
    if (inner[0] === m[0] || inner[inner.length - 1] === m[0] || inner.includes(m)) break;
    core = inner;
    if (preserveBold && m === "**") {
      lead += m;
      trail = m + trail;
    } else markers.add(m);
  }
  return { lead, core, trail: trail + metadata, level: markers.size ? 1 : 0 };
}

function wrapLevel(core, level) {
  if (level === 1) return `==${core}==`;
  return core;
}

module.exports = { splitMarks, wrapLevel };

},
};
const __cache = {};
const __resolve = (fromId, request) => {
  const parts = fromId.split("/").slice(0, -1);
  for (const seg of request.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== "." && seg !== "") parts.push(seg);
  }
  const base = parts.join("/");
  return base in __defs ? base : base + "/index";
};
function __load(id) {
  if (__cache[id]) return __cache[id].exports;
  const module = (__cache[id] = { exports: {} });
  __defs[id].call(module.exports, module, module.exports, (request) =>
    request.startsWith(".") ? __load(__resolve(id, request)) : require(request));
  return module.exports;
}
module.exports = __load("index");

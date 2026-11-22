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

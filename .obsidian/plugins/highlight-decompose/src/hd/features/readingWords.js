const { normalize } = require("../dom");
const { highlightsForDoc, readingNotePath, surfaceForm, questionBlanks } = require("../reading");
const { articleNotePath, isInScope } = require("../../shared/notes");

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
        if (!isInScope(this.path)) return;
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

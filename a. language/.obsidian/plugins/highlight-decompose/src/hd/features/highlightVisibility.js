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
  }

  renderAnswerBlanks(root, source = "", question = true) {
    const labels = questionBlanks(`# ${question ? "题目" : "原文"}\n${source}`, true);
    const existing = root.querySelectorAll(".hd-answer-blank").length;
    let blankIndex = existing;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement.closest(".hd-answer-blank, pre, code") && /(?:\\_){8}|(?<!_)_{8}(?!_)/.test(node.nodeValue)) nodes.push(node);
    }
    for (const node of nodes) {
      const fragment = document.createDocumentFragment();
      let offset = 0;
      for (const match of node.nodeValue.matchAll(/(?:\\_){8}|(?<!_)_{8}(?!_)/g)) {
        fragment.append(node.nodeValue.slice(offset, match.index));
        const span = document.createElement("span");
        span.className = "hd-answer-blank";
        span.textContent = match[0];
        const number = labels[blankIndex++]?.number;
        if (number) span.dataset.hdQuestionNumber = number;
        fragment.append(span);
        offset = match.index + match[0].length;
      }
      fragment.append(node.nodeValue.slice(offset));
      node.replaceWith(fragment);
    }
  }

  clearPassageHighlight() {
    for (const node of this.hoveredPassageNodes || []) node.classList.remove("hd-passage-hover");
    this.hoveredPassageNodes = null;
    this.hoveredPassageAnchor = null;
  }

  hoverPassageHighlight(target) {
    // 原文高亮交给 Obsidian 原生样式, 悬停不再改变高亮。
    return this.clearPassageHighlight();
    const scope = target?.closest("[data-hd-passage]");
    const anchor = scope && !target.closest("table, pre, code, .internal-embed")
      ? target.closest("[data-hd-highlight], mark, .cm-highlight") : null;
    if (anchor === this.hoveredPassageAnchor) return;
    this.clearPassageHighlight();
    if (!anchor) return;
    const id = anchor.dataset.hdHighlight;
    const nodes = id === undefined ? [anchor]
      : [...scope.querySelectorAll(`[data-hd-highlight="${id}"]`)];
    // Native CM tokens can wrap our decoration; both layers must lose their
    // background together when the pointer leaves the complete source range.
    for (const node of [...nodes]) {
      const token = node.closest(".cm-highlight");
      if (token && !nodes.includes(token)) nodes.push(token);
      for (const child of node.querySelectorAll(".cm-highlight, mark")) {
        if (!nodes.includes(child)) nodes.push(child);
      }
    }
    for (const node of nodes) node.classList.add("hd-passage-hover");
    this.hoveredPassageNodes = nodes;
    this.hoveredPassageAnchor = anchor;
  }

  // 原文高亮交给 Obsidian 原生样式, 不再隐藏。
  hideReadingHighlights() {
    return false;
  }

  // 开关变化后让已打开的编辑器重算装饰, 并刷新显示。
  refreshHighlightSettings() {
    this.highlightRevision = (this.highlightRevision || 0) + 1;
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      leaf.view?.editor?.cm?.dispatch({});
    }
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
      // 写作、口语的范文可直接标记表达, 无需先建立词表才能隐藏底色。
      el.classList.toggle("hd-hide-unlisted-highlights", hidden && ["writing", "speaking"].includes(articleModule(path)));
      const questionShown = false;
      el.classList.toggle(QUESTION_SHOWN_CLASS, questionShown);
    }
  }
}

module.exports = { HighlightVisibilityMethods };

const { readingNotePath, questionBlanks } = require("../reading");
const { articleHighlightSetting, articleModule, isInScope } = require("../../shared/notes");

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
      const inScope = isInScope(path);
      const hidden = inScope && Boolean(settings?.[articleHighlightSetting(path)]);
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
        const on = inScope && Boolean(articleHighlightSetting(path));
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

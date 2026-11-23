// 入口: 注册视图、入口按钮与命令。导出纯函数给 test.js。

const { Plugin, MarkdownView, TFile, addIcon } = require("obsidian");
const { VIEW_TYPE, DECK_ROOTS } = require("./constants");
const { hasDeckCards } = require("./parse");
const { PrefsStore } = require("./store");
const { MemoryCardsSettingTab } = require("./settings");
const { AudioLibrary } = require("./audio");
const { registerIcons } = require("./ui/icons");
const { DeckSheet } = require("./ui/sheets");
const { registerNoteTables } = require("./noteTables");
const { CardView } = require("./view/CardView");

// Obsidian 把 aria-label 显示成悬浮提示; 用户不要任何悬浮提示, 入口按钮创建后去掉。
const noTooltip = (el) => { el.removeAttribute("aria-label"); return el; };
const isDeckCandidate = (file) => file instanceof TFile && file.extension === "md";
const inDeckRoots = (path) => DECK_ROOTS.some((r) => path.startsWith(r));

class MemoryCardsPlugin extends Plugin {
  async onload() {
    registerIcons(addIcon);
    this.store = await PrefsStore.load(this);
    this.addSettingTab(new MemoryCardsSettingTab(this.app, this));
    this.audio = new AudioLibrary(this.app);
    this.registerView(VIEW_TYPE, (leaf) => new CardView(leaf, this));
    // 必须紧跟 registerView 注册: 卸载时 register 回调倒序执行, 这一条会先于「注销视图 + 关闭卡片页」运行
    this.register(() => this.restoreNotesOnDisable());
    registerNoteTables(this);

    // 按模块设置自动展示卡片。点「返回笔记」后这个标签页记住「这篇要看笔记」,
    // 直到它换成别的文件, 免得刚回到笔记又被切回卡片。
    this.noteByChoice = new WeakMap();
    this.registerEvent(this.app.workspace.on("file-open", (file) => this.autoOpenCards(file)));

    const ribbon = this.addRibbonIcon("mc-cards", "单词卡", () => {
      const file = this.app.workspace.getActiveFile();
      if (isDeckCandidate(file) && inDeckRoots(file.path)) this.openDeck(file.path);
      else this.pickDeck();
    });

    noTooltip(ribbon);

    this.addCommand({
      id: "study-current-note",
      name: "把当前笔记展示成单词卡",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || !view.file) return false;
        if (!checking) this.openDeck(view.file.path, view.leaf);
        return true;
      },
    });
    this.addCommand({ id: "pick-deck", name: "切换卡组", callback: () => this.pickDeck() });
    this.addCommand({
      id: "resume-last-deck",
      name: "继续上次的卡组",
      callback: () => (this.store.lastDeck ? this.openDeck(this.store.lastDeck) : this.pickDeck()),
    });

    // 笔记改名时迁移它的学习进度与设置 (卡片页没开着也要迁)
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (file instanceof TFile && oldPath.endsWith(".md")) this.store.rename(oldPath, file.path);
    }));

    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (!isDeckCandidate(file)) return;
      menu.addItem((item) => item.setTitle("展示成单词卡").setIcon("mc-cards").onClick(() => this.openDeck(file.path)));
    }));

    // 每篇笔记标题栏右上角: 一键展示成卡片 (手机同样显示在标题栏)
    const addHeaderButtons = () => this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => this.addHeaderButton(leaf.view));
    this.app.workspace.onLayoutReady(addHeaderButtons);
    this.registerEvent(this.app.workspace.on("layout-change", addHeaderButtons));
    this.registerEvent(this.app.workspace.on("active-leaf-change", addHeaderButtons));
  }

  onunload() {
    if (document.body.mcSheet) document.body.mcSheet.close();
    this.store.flush();
    this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
      const view = leaf.view;
      if (view.mcCardAction) { view.mcCardAction.remove(); delete view.mcCardAction; }
    });
  }

  /**
   * 用户关闭插件时, Obsidian 会直接关掉所有卡片标签页 (detachLeavesOfType)。
   * 改成把每个卡片页换回它原本的笔记: 换页是异步的, 所以先让这次 detach 落空, 换完再恢复。
   * 只在用户手动关闭时处理; 重载插件或退出 Obsidian 时卡片页本来就会保留。
   */
  restoreNotesOnDisable() {
    if (!this._userDisabled) return;
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      const view = leaf.view;
      const file = this.app.vault.getAbstractFileByPath(view.deckPath || "");
      if (!(file instanceof TFile)) continue; // 笔记已不存在: 照常关闭
      leaf.detach = () => {}; // 实例上临时遮住原型方法
      Promise.resolve(view.backToNote())
        .catch((e) => console.error("memory-cards: 换回笔记失败", e))
        .finally(() => { delete leaf.detach; });
    }
  }

  addHeaderButton(view) {
    if (!(view instanceof MarkdownView) || view.mcCardAction) return;
    view.mcCardAction = noTooltip(view.addAction("mc-cards", "展示成单词卡", () => {
      if (view.file) this.openDeck(view.file.path, view.leaf);
    }));
  }

  setMemoryHints(value) {
    this.store.memoryHints = value;
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      const view = leaf.view;
      if (!view.face) continue;
      view.face.setMemoryHints(this.store.memoryHints);
      view.face.fit();
      view.placeDict();
    }
  }

  async autoOpenCards(file) {
    if (!isDeckCandidate(file)) return;
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || view.file !== file) return;
    const leaf = view.leaf;
    if (this.noteByChoice.has(leaf)) {
      if (this.noteByChoice.get(leaf) === file.path) return;
      this.noteByChoice.delete(leaf);
    }
    if (!this.store.shouldAutoOpen(file.path)) return;
    const text = await this.app.vault.cachedRead(file);
    if (!hasDeckCards(text)) return;
    if (leaf.view !== view || view.file !== file) return; // 读文件期间已切走
    if (this.noteByChoice.get(leaf) === file.path || !this.store.shouldAutoOpen(file.path)) return;
    await this.openDeck(file.path, leaf);
  }

  pickDeck(leaf) {
    const cardView = leaf && leaf.view instanceof CardView ? leaf.view : null;
    new DeckSheet(this.app, {
      store: this.store,
      currentPath: cardView ? cardView.deckPath : "",
      host: cardView ? cardView.contentEl : null,
      onChoose: (path) => this.openDeck(path, leaf),
    }).open();
  }

  /** 传入 leaf 时在原标签页切换 (笔记 ⇄ 卡片), 否则复用已有卡片页或新开一个。 */
  async openDeck(path, leaf, tableKey = null) {
    const target = leaf || this.app.workspace.getLeavesOfType(VIEW_TYPE)[0] || this.app.workspace.getLeaf(true);
    await target.setViewState({ type: VIEW_TYPE, active: true, state: { file: path, tableKey } });
    this.app.workspace.revealLeaf(target);
  }
}

module.exports = MemoryCardsPlugin;
module.exports.parseDeck = require("./parse").parseDeck;
module.exports.arrangeDeck = require("./session").arrangeDeck;
module.exports.StudySession = require("./session").StudySession;
module.exports.toSlug = require("./text").toSlug;

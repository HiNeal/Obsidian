// 卡片页: 把 StudySession (牌堆) 与各个界面组件装配起来, 是唯一同时知道它们的地方。
// 对弹窗公开 setXxx() 一组方法, 弹窗只调这些方法, 不碰 DOM。

const { ItemView, TFile, Notice } = require("obsidian");
const { VIEW_TYPE, MOTION } = require("../constants");
const { parseDeck } = require("../parse");
const { removeCardRow } = require("../delete");
const { makeBookmark, restorePosition, progressPatch } = require("../progress");
const { tableScopes, scopeCards } = require("../tableScopes");
const { baseName, splitRow, plain, spellKey } = require("../text");
const cardKey = (card) => `${card.table || 0}\u0000${card.word}`;
const { StudySession } = require("../session");
const { SCORE_MAX, clampScore, rewriteRow } = require("../score");
const { Player } = require("../audio");
const { icon } = require("../ui/icons");
const { OrderSheet, SettingsSheet, RoundSheet, ScopeSheet } = require("../ui/sheets");
const { CardFace } = require("./cardFace");
const { ProgressBar } = require("./progress");
const { ControlBar } = require("./controls");
const { bindSwipe } = require("./gestures");
const { Autoplay } = require("./autoplay");
const { DictationPanel } = require("./dictation");

const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// ← → 翻页, ↑ ↓ 调整评分, 空格自动播放, 回车揭晓, ⌘ + Delete 删除当前卡片及整行
const KEY_ACTIONS = {
  ArrowLeft: "prev", ArrowRight: "next",
  ArrowUp: "scoreUp", ArrowDown: "scoreDown",
  " ": "play", Enter: "reveal",
};
const SCORE_SAVE_DELAY = 500; // 连续按键合并成一次写盘

/** 等动画结束, 但最多等 duration + 400ms: 窗口最小化时动画可能迟迟不结束, 不能让翻页卡死。 */
function settle(animation, duration) {
  return Promise.race([
    animation.finished.catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, duration + 400)),
  ]);
}

class CardView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.store = plugin.store;
    this.deckPath = "";
    this.tableKey = null;
    this.tables = [];
    this.allCards = [];
    this.session = new StudySession();
    this.player = new Player();
    this.transitioning = false;
    this.revealTimer = null;
    this.pendingScores = new Map(); // card -> 待写回的分数
    this.scoreSaveTimer = null;
    this.reloadTimer = null;
    this.ownWrite = null;    // 最近一次评分写盘后的全文: modify 事件读到同样内容就是自己写的
    this.loadToken = 0;      // 每次切换卡组自增, 晚到的旧结果直接丢弃
    this.reloadSeq = 0;      // 笔记编辑触发的重读: 只应用比已应用的更新的那一次
    this.appliedSeq = 0;
    this.closed = false;
    this.deleting = false;
    this.round = { judged: 0, wrong: new Set() }; // 听写这一轮: 判了几张, 拼错的词 (cardKey)
    this.autoplay = new Autoplay({
      speak: () => this.speakCurrent(),
      stopSpeech: () => this.player.stop(),
      delayAfter: (elapsed) => {
        const p = this.prefs;
        const reveal = p.review && !p.dictation ? Math.max(0, p.revealDelay - elapsed) : 0;
        return p.interval + reveal;
      },
      advance: () => this.move(1),
      onState: (on) => this.controls && this.controls.setPlaying(on),
    });
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return this.deckPath ? baseName(this.deckPath) : "单词卡"; }
  getIcon() { return "mc-cards"; }
  getState() { return { file: this.deckPath, tableKey: this.tableKey }; }

  async setState(state, result) {
    this.ensureBuilt();
    if (state && state.file) await this.loadDeck(state.file, state.tableKey ?? null);
    return super.setState(state, result);
  }

  get prefs() { return this.store.deck(this.deckPath); }
  setPrefs(patch) { this.store.setDeck(this.deckPath, patch); }

  // ==================== 生命周期 ====================

  async onOpen() {
    this.ensureBuilt();
    this.addAction("mc-note", "返回笔记", () => this.backToNote()).removeAttribute("aria-label"); // 不要悬浮提示
    this.scopeButton = this.addAction("mc-cards", "学习范围", () => {
      if (this.tables.length) new ScopeSheet(this.app, this).open();
    });
    this.scopeButton.addClass("mc-scope-action");
    this.scopeButton.removeAttribute("aria-label");
    this.deleteButton = this.addAction("trash-2", "删除当前卡片及笔记整行 (⌘⌫)", () => this.deleteCurrentCard());
    this.deleteButton.addClass("mc-delete-action");
    // 删除键挪到左侧: 紧跟 Obsidian 自带的 后退/前进 按钮
    const nav = this.containerEl.querySelector(".view-header-nav-buttons");
    if (nav) nav.appendChild(this.deleteButton);
    this.renderChrome();

    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file.path === this.deckPath) this.scheduleReload();
    }));
    // 偏好的改名迁移由插件统一处理 (卡片页没开时也要迁移), 这里只跟着改自己的路径
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (oldPath !== this.deckPath) return;
      this.deckPath = file.path;
      this.leaf.updateHeader && this.leaf.updateHeader();
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (file.path === this.deckPath) this.loadDeck(this.deckPath);
    }));
    this.registerDomEvent(window, "keydown", (e) => this.onKey(e), true);
  }

  async onClose() {
    // 先停下所有会继续动的东西, 再等评分写盘, 避免关闭途中还在翻页或发声
    this.closed = true;
    this.loadToken++;
    if (this.contentEl.mcSheet) this.contentEl.mcSheet.close();
    this.autoplay.stop();
    this.player.stop();
    this.clearReveal();
    clearTimeout(this.reloadTimer);
    this.reloadTimer = null;
    this.face && this.face.destroy();
    this.resizeObserver && this.resizeObserver.disconnect();
    await this.deleteWrite;
    await this.flushScores();
  }

  ensureBuilt() {
    if (this.root) return;
    this.contentEl.empty();
    this.contentEl.addClass("mc-view");
    this.root = this.contentEl.createDiv("mc-root");


    this.stage = this.root.createDiv("mc-stage");
    this.face = new CardFace(this.stage);
    this.emptyEl = this.stage.createDiv("mc-empty");

    // 听写输入框: 在幕布上 (卡片外), 够宽时贴在卡片右侧, 不够宽时排在卡片下面
    this.dict = new DictationPanel(this.root, {
      onSubmit: (typed) => this.submitSpelling(typed),
      onReplay: () => { this.player.stop(); this.speakCurrent(); },
      onTyping: () => this.autoplay.stop(),
      onNav: (direction) => this.step(direction),
      onScore: (delta) => this.adjustScore(delta),
    });

    this.progress = new ProgressBar(this.root, {
      onScrubStart: () => this.autoplay.stop(),
      onCommit: (i) => this.jumpTo(i),
    });
    this.controls = new ControlBar(this.root, {
      order: () => new OrderSheet(this.app, this).open(),
      prev: () => this.step(-1),
      play: () => { if (!this.loading && !this.deleting) this.autoplay.toggle(); },
      next: () => this.step(1),
      settings: () => {
        const sheet = new SettingsSheet(this.app, this);
        sheet.onClosed = () => this.focusDict(); // 在设置里打开听写后, 关掉弹窗直接可以打字
        sheet.open();
      },
    });

    bindSwipe(this.stage, this.face.el, {
      canStart: () => !this.loading && !this.deleting && !this.transitioning && this.session.size > 0,
      onDragStart: () => this.autoplay.interrupt(),
      onTap: (target) => this.onTap(target),
      onCommit: (direction, dx) => this.move(direction, dx),
      onCancel: () => this.autoplay.on && this.autoplay.cycle(),
    });

    // 卡片尺寸随窗口/分栏变化, 单词字号跟着重算
    this.resizeObserver = new ResizeObserver(() => { this.face.fit(); this.placeDict(); });
    this.resizeObserver.observe(this.stage);
    this.resizeObserver.observe(this.contentEl); // 标签页变宽变窄: 输入框在卡片右侧与下方之间切换
  }

  // ==================== 卡组 ====================

  async loadDeck(path, tableKey = null) {
    const token = ++this.loadToken;
    this.loading = true;
    this.autoplay.stop();
    this.player.stop();
    this.clearReveal();
    try {
      await this.deleteWrite;
      await this.flushScores();
      if (token !== this.loadToken || this.closed) return;
      const file = this.app.vault.getAbstractFileByPath(path);
      const changedFile = path !== this.deckPath;
      this.deckPath = path;
      this.tableKey = tableKey;
      this.ownWrite = null;
      if (changedFile) this.plugin.audio.clear();
      if (!(file instanceof TFile)) {
        this.store.forget(path);
        this.allCards = [];
        this.tables = [];
        this.session.arrange([], this.arrangePrefs());
        this.render();
        return;
      }
      const data = await this.app.vault.cachedRead(file);
      if (token !== this.loadToken || this.closed) return;
      this.appliedSeq = this.reloadSeq;
      const cards = this.readScope(data);
      this.resetRound();
      const prefs = this.prefs;
      const index = tableKey == null ? prefs.progress : (prefs.tableProgress?.[tableKey] || 0);
      const bookmark = tableKey == null ? prefs.bookmark : prefs.tableBookmarks?.[tableKey];
      this.session.arrange(cards, this.arrangePrefs());
      this.session.index = restorePosition(this.session, bookmark, index);
      this.store.touch(path);
      this.leaf.updateHeader && this.leaf.updateHeader();
      this.render();
    } finally {
      if (token === this.loadToken) {
        this.loading = false;
        this.renderChrome();
      }
    }
  }

  scheduleReload() {
    clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = null;
      this.reload();
    }, 180);
  }

  /**
   * 笔记被编辑: 表格结构没变就原地更新卡片内容, 不重排 (一轮刷到一半顺序不能变);
   * 增删了行或改了词头才重排, 并留在同一个词上。外部编辑时先把待写的评分写进去再读。
   */
  async reload({ force = false } = {}) {
    if (this.loading || this.deleting) return;
    const token = this.loadToken;
    const tableKey = this.tableKey;
    const seq = ++this.reloadSeq;
    const path = this.deckPath;
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    const hadPending = this.pendingScores.size > 0;
    if (hadPending) await this.flushScores();
    const data = await this.app.vault.read(file);
    if (this.closed || this.loading || this.deleting || token !== this.loadToken || tableKey !== this.tableKey || path !== this.deckPath || seq < this.appliedSeq) return;
    // 内容正好是自己刚写的评分: 卡片已在内存里更新过, 不重排。
    // 先写了待存评分的那次除外: 它读到的内容里还带着外部的编辑, 必须应用。
    if (!force && !hadPending && data === this.ownWrite) return;
    this.appliedSeq = seq;
    const cards = this.readScope(data);
    // 表格结构没变 (只是评分、高亮、释义等内容变了): 原地更新卡片, 牌堆顺序不动,
    // 新分数等刷完这一轮回到第一张时才参与排序。只有增删行、改词头才重排。
    if (!this.session.refresh(cards, this.pendingScores)) {
      const bookmark = makeBookmark(this.session);
      const index = this.session.index;
      this.session.arrange(cards, this.arrangePrefs());
      this.session.index = restorePosition(this.session, bookmark, index);
    }
    this.render({ keepReveal: true });
  }

  readScope(data) {
    this.allCards = parseDeck(data);
    this.tables = tableScopes(this.allCards);
    return scopeCards(this.allCards, this.tableKey);
  }

  async selectScope(key) {
    if (key === this.tableKey || this.transitioning) return;
    await this.loadDeck(this.deckPath, key);
    this.app.workspace.requestSaveLayout();
  }

  saveProgress() {
    const patch = progressPatch(this.prefs, this.tableKey, this.session);
    if (patch) this.setPrefs(patch);
  }

  /** 听说读写篇章的卡组: 本篇词表全部上卡, 不受进阶模式(只刷评分 ≥ 1)过滤。 */
  arrangePrefs() {
    const article = /^(?:a\. language\/)?(?:05\. listening|06\. reading|07\. writing|09\. speaking)\//.test(this.deckPath || "");
    return article ? { ...this.prefs, focus: false } : this.prefs;
  }

  rearrange() {
    this.autoplay.stop();
    this.resetRound();
    this.session.arrange(this.session.cards, this.arrangePrefs(), { index: 0 });
    this.render();
    this.startCardCycle({ speak: false });
  }

  // ==================== 渲染 ====================

  render({ keepReveal = false, deferLayout = true } = {}) {
    const card = this.session.card;
    const prefs = this.prefs;
    const wasRevealed = this.face.revealed;
    this.face.el.toggleClass("is-hidden", !card);
    this.stage.toggleClass("is-empty", !card);
    this.emptyEl.toggleClass("is-hidden", Boolean(card));
    if (!card) this.renderEmpty();
    else {
      this.face.setMemoryHints(this.store.memoryHints);
      this.face.render(card, { dictation: prefs.dictation, review: prefs.review && !prefs.dictation });
      if (keepReveal && wasRevealed) this.face.reveal();
      if (deferLayout) requestAnimationFrame(() => { this.face.fit(); this.placeDict(); });
      else { this.face.fit(); this.placeDict(); }
      this.saveProgress();
    }
    this.syncDict(card, keepReveal);
    this.progress.set(this.session.index, this.session.size);
    this.renderChrome();
  }

  renderEmpty() {
    this.emptyEl.empty();
    this.emptyEl.appendChild(icon("empty", "mc-empty-icon"));
    this.emptyEl.createDiv({ cls: "mc-empty-title", text: this.tableKey != null ? "这张表已移除或没有可学习的条目" : this.deckPath ? "这篇笔记没有可学习的表格" : "还没有选择卡组" });
    this.emptyEl.createDiv({ cls: "mc-empty-desc", text: "带「释义」列的单词表、短语表都会变成卡片" });
    const btn = this.emptyEl.createEl("button", { cls: "mc-empty-btn", text: "选择卡组", attr: { type: "button" } });
    btn.addEventListener("click", () => this.openDeckSheet());
  }

  renderChrome() {
    const prefs = this.prefs;
    const scope = this.tables.find(t => t.key === this.tableKey);
    const name = this.tableKey == null ? "整篇笔记" : (scope?.label || "表格已移除");
    if (this.scopeButton) {
      this.scopeButton.dataset.scope = name;
      this.scopeButton.setAttribute("aria-disabled", String(!this.tables.length));
    }
    if (this.deleteButton) {
      const disabled = !this.session.card || this.deleting || this.loading;
      this.deleteButton.setAttribute("aria-disabled", String(disabled));
      this.deleteButton.toggleClass("is-disabled", disabled);
    }
    this.controls.setOrder(prefs.order);
    this.controls.setPlaying(this.autoplay.on);
  }

  // ==================== 翻页 ====================

  step(direction) {
    this.autoplay.interrupt();
    this.move(direction);
  }

  async move(direction, fromDx = 0, { skipSummary = false } = {}) {
    if (this.loading || this.deleting || this.transitioning || !this.session.size) return;
    // 听写刷到这一轮最后一张再往后: 先出小结, 关掉小结才进下一轮
    if (!skipSummary && direction > 0 && this.prefs.dictation && this.round.judged > 0 && this.session.index >= this.session.size - 1) {
      this.showRoundSummary();
      return;
    }
    this.transitioning = true;
    this.player.stop();
    this.clearReveal();
    this.face.dismissPeek();
    const card = this.face.el;
    const quick = reduceMotion();
    const width = this.stage.clientWidth || 360;
    const out = -direction * width * 1.05;
    const outEnd = `perspective(900px) translateX(${out}px) rotateY(${-direction * 22}deg)`;

    // 不用 fill: "forwards" 保持动画终点: 那样的动画效果可能残留在卡片上 (浏览器不再列出,
    // 却一直盖住样式), 表现为卡片永久透明。做法是先把行内样式设成终点, 动画只负责过程;
    // 无论动画完成、被取消还是渲染出错, finally 都把卡片还原成可见。
    const outDuration = quick ? 1 : fromDx ? MOTION.outSwipe : MOTION.outTap;
    const inDuration = quick ? 1 : MOTION.in;
    try {
      card.style.transform = outEnd;
      card.style.opacity = "0";
      await settle(card.animate(
        [
          { transform: `perspective(900px) translateX(${fromDx}px)`, opacity: 1 },
          { transform: outEnd, opacity: 0 },
        ],
        { duration: outDuration, easing: "cubic-bezier(.4,0,.8,.6)" },
      ), outDuration);
      if (this.closed) return;

      this.session.advance(direction, this.arrangePrefs());
      this.render({ deferLayout: false });

      card.style.transform = "";
      card.style.opacity = "";
      await settle(card.animate(
        [
          { transform: `perspective(900px) translateX(${-out * 0.5}px) rotateY(${direction * 18}deg)`, opacity: 0 },
          { transform: "perspective(900px) translateX(0) rotateY(0)", opacity: 1 },
        ],
        { duration: inDuration, easing: "cubic-bezier(.2,1.15,.35,1)" },
      ), inDuration);
    } finally {
      card.getAnimations().forEach((a) => a.cancel());
      card.style.transform = "";
      card.style.opacity = "";
      this.transitioning = false;
    }
    if (!this.closed) this.startCardCycle();
  }

  jumpTo(index) {
    if (this.loading || this.deleting) return;
    this.autoplay.stop();
    const target = this.session.clamp(index);
    if (target === this.session.index) { this.progress.set(target, this.session.size); return; }
    this.player.stop();
    this.session.index = target;
    this.render();
    this.startCardCycle();
  }

  /** 卡片上屏之后: 复习揭晓计时, 然后自动播放的下一轮或单次朗读。 */
  startCardCycle({ speak = true } = {}) {
    this.scheduleReveal();
    if (this.autoplay.on) this.autoplay.cycle();
    else if (speak) this.speakCurrent();
  }

  async speakCurrent() {
    const card = this.session.card;
    // 听写靠听音拼写 (单词与释义都遮着): 听写模式下不管「发音」开关都朗读
    if (this.closed || !card || !(this.store.speech || this.prefs.dictation)) return true;
    const urls = await this.plugin.audio.urlsFor(this.deckPath, card);
    if (this.closed || card !== this.session.card) return false;
    return this.player.play(urls);
  }

  // ==================== 揭晓 ====================

  clearReveal() {
    clearTimeout(this.revealTimer);
    this.revealTimer = null;
  }

  scheduleReveal() {
    this.clearReveal();
    const p = this.prefs;
    if (!p.review || p.dictation || this.face.revealed) return;
    this.revealTimer = setTimeout(() => this.face.reveal(), Math.max(p.revealDelay, 0.05) * 1000);
  }

  reveal() {
    // 听写时没拼就揭晓 (点单词 / 回车): 等于没拼出来, 按拼错算
    if (this.prefs.dictation && this.session.card && !this.face.revealed && !this.dict.locked && !this.dict.retrying) {
      this.submitSpelling("");
      return;
    }
    this.clearReveal();
    this.face.reveal();
  }

  // ==================== 听写 ====================

  /** 换了卡就清空输入框; 同一张卡重绘 (笔记被编辑) 时保留已输入的内容与判分结果。 */
  syncDict(card, keep) {
    const on = Boolean(card) && this.prefs.dictation;
    this.dict.show(on);
    if (!on) { this.dictCard = null; return; }
    if (!(keep && card === this.dictCard)) {
      this.dictCard = card;
      this.dict.reset();
      this.focusDict();
    }
    if (!this.dict.locked && !this.dict.retrying) this.hintIfSilent(card);
    this.placeDict();
  }

  /** 这个词没有录音就没法听写: 单词照常遮着, 先把释义亮出来, 改成看义拼词。 */
  async hintIfSilent(card) {
    const urls = await this.plugin.audio.urlsFor(this.deckPath, card);
    if (this.closed || urls.length || card !== this.session.card || !this.prefs.dictation || this.face.revealed) return;
    this.face.hintMeaning();
    this.dict.hint("没有录音 · 看释义拼写");
  }

  resetRound() {
    this.round = { judged: 0, wrong: new Set() };
  }

  /** 一轮刷完: 报告拼了几个、错了几个; 可以只重刷拼错的, 否则关掉弹窗进下一轮。 */
  showRoundSummary() {
    this.autoplay.stop();
    const { judged, wrong } = this.round;
    this.resetRound();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); // 回车别再落进输入框
    const sheet = new RoundSheet(this.app, this, { judged, wrong: wrong.size, onDrill: () => this.drillWrong(wrong) });
    sheet.onClosed = () => { if (!sheet.drill && !this.closed) this.move(1, 0, { skipSummary: true }); };
    sheet.open();
  }

  /** 只重刷拼错的词 (保持当前顺序); 刷到头自动回到整副牌。 */
  drillWrong(keys) {
    const cards = this.session.deck.filter((c) => keys.has(cardKey(c)));
    this.player.stop();
    if (!this.session.drill(cards)) { this.move(1, 0, { skipSummary: true }); return; }
    this.render();
    this.startCardCycle();
  }

  placeDict() {
    if (this.dict) this.dict.place({ view: this.contentEl, root: this.root, stage: this.stage, card: this.face.el, word: this.face.wordEl });
  }

  /** 只在自己是当前标签页、没有弹窗挡着、且不是触屏 (免得每张卡都弹键盘) 时自动聚焦。 */
  focusDict() {
    if (this.closed || !this.dict || !this.dict.visible || this.dict.locked) return;
    if (this.app.workspace.getActiveViewOfType(CardView) !== this) return;
    if (document.querySelector(".modal-container, .mc-sheet-container")) return;
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;
    this.dict.focus();
  }

  /**
   * 回车提交拼写, 每张卡只判一次, 只判对错、不改分。
   * 拼对后再回车 = 下一张; 拼错后要照着揭晓的卡片再拼对一遍才下一张。
   */
  submitSpelling(typed) {
    const card = this.session.card;
    if (!card || this.loading || this.deleting || this.transitioning) return;
    if (this.dict.locked) { this.step(1); return; }
    const correct = spellKey(typed) === spellKey(card.word);
    if (this.dict.retrying) {
      if (correct) this.step(1);
      else this.dict.shake();
      return;
    }
    this.clearReveal();
    this.face.reveal();
    this.round.judged++;
    if (!correct) this.round.wrong.add(cardKey(card));
    if (correct) this.dict.pass("拼写正确");
    else this.dict.retry(spellKey(typed) ? "拼写错误" : "没拼出来");
  }

  /** 轻点: 复习模式任意处揭晓; 听写模式点单词揭晓; 其余情况看分数。不改分。 */
  onTap(target) {
    if (this.loading || this.deleting || this.transitioning || !this.session.card) return;
    const p = this.prefs;
    if (!this.face.revealed && ((p.review && !p.dictation) || (p.dictation && this.face.isOnMask(target)))) {
      this.reveal();
      return;
    }
    this.face.showScore();
  }

  onKey(e) {
    if (this.deleting || this.loading) return;
    if (this.app.workspace.getActiveViewOfType(CardView) !== this || e.ctrlKey || e.altKey) return;
    // 任何弹窗开着时, 方向键等留给弹窗, 不翻卡也不打分
    if (document.querySelector(".modal-container, .menu, .suggestion-container, .mc-sheet-container")) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (t && t.tagName === "INPUT" && !t.hasClass("mc-range")) return;
    const action = e.metaKey
      ? (!e.shiftKey && (e.key === "Backspace" || e.key === "Delete") ? "delete" : null)
      : KEY_ACTIONS[e.key];
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat && (action === "play" || action === "reveal" || action === "delete")) return;
    if (action === "prev") this.step(-1);
    else if (action === "next") this.step(1);
    else if (action === "scoreUp") this.adjustScore(1);
    else if (action === "scoreDown") this.adjustScore(-1);
    else if (action === "play") this.autoplay.toggle();
    else if (action === "delete") this.deleteCurrentCard();
    else this.reveal();
  }

  // ==================== 评分 ====================

  /**
   * ↑ / ↓: 分数弹窗未显示时, 第一下只弹出当前分数, 不改分; 弹窗显示期间再按才 ±1 分 (0–5)。
   * 写回笔记合并到最后一次按键之后。
   */
  adjustScore(delta) {
    const card = this.session.card;
    if (!card || this.loading || this.deleting || this.transitioning) return;
    if (card.scoreCol < 0) {
      this.face.showScore({ blocked: true, hint: "此表没有评分列, 暂不支持打分" });
      return;
    }
    if (!this.face.scoreShown) {
      this.face.showScore();
      return;
    }
    const next = clampScore(card.score + delta);
    if (next === card.score) {
      this.face.showScore({ blocked: true, hint: next === SCORE_MAX ? "已是最高分" : "已是最低分" });
      return;
    }
    this.commitScore(card, next);
    this.face.showScore({ changed: true, down: delta < 0 });
  }

  /** 改内存里的分数并排队写回笔记 (↑ / ↓)。 */
  commitScore(card, next) {
    card.score = next;
    card.focus = next >= 1 ? 1 : 0;
    this.session.refreshFocus();
    this.renderChrome();
    this.pendingScores.set(card, next);
    clearTimeout(this.scoreSaveTimer);
    this.scoreSaveTimer = setTimeout(() => this.flushScores(), SCORE_SAVE_DELAY);
  }

  /** 把待写的分数一次性写回笔记: 只改每行的评分格和词头高亮, 其余字符不动。 */
  async flushScores() {
    clearTimeout(this.scoreSaveTimer);
    this.scoreSaveTimer = null;
    if (!this.pendingScores.size) return;
    const pending = [...this.pendingScores];
    this.pendingScores.clear();
    const file = this.app.vault.getAbstractFileByPath(this.deckPath);
    if (!(file instanceof TFile)) return;
    const failed = [];
    try {
      this.ownWrite = await this.app.vault.process(file, (data) => {
        const lines = data.split("\n");
        for (const [card, score] of pending) {
          const index = this.locateRow(lines, card);
          const next = index < 0 ? null : rewriteRow(lines[index], { wordCol: card.wordCol, scoreCol: card.scoreCol, score });
          if (next == null) failed.push(card.word);
          else lines[index] = next;
        }
        return lines.join("\n");
      });
    } catch (error) {
      console.error("[MemoryCards] 评分写回失败", error);
      failed.push(...pending.map(([card]) => card.word));
    }
    if (failed.length) new Notice(`评分未写回: ${failed.join(", ")} (笔记里找不到这一行)`, 4000);
  }

  /** 先信解析时记下的行号, 词头对不上 (笔记被改过) 再按词头在全文里找离原行最近的一行。 */
  locateRow(lines, card) {
    const headOf = (line) => {
      if (!line || !line.trim().startsWith("|")) return null;
      const cells = splitRow(line);
      return cells.length > card.scoreCol ? plain((cells[card.wordCol] || "").split(/<br\s*\/?>/i)[0]) : null;
    };
    if (headOf(lines[card.line]) === card.word) return card.line;
    let best = -1;
    lines.forEach((line, i) => {
      if (headOf(line) === card.word && (best < 0 || Math.abs(i - card.line) < Math.abs(best - card.line))) best = i;
    });
    if (best >= 0) card.line = best;
    return best;
  }

  // ==================== 删除 ====================

  deleteCurrentCard() {
    const card = this.session.card;
    if (!card || this.loading || this.deleting || this.transitioning || this.closed) return;
    this.deleting = true;
    this.autoplay.stop();
    this.player.stop();
    this.clearReveal();
    this.face.dismissPeek();
    this.renderChrome();
    this.deleteWrite = this.removeCurrentRow(card);
    return this.deleteWrite;
  }

  async removeCurrentRow(card) {
    const path = this.deckPath;
    const token = this.loadToken;
    const tableKey = this.tableKey;
    const expectedCards = this.session.cards.slice();
    const index = this.session.index;
    const next = this.session.deck[(index + 1) % this.session.size];
    const bookmark = next !== card ? makeBookmark({ cards: this.session.cards, card: next }) : null;
    const removedBookmark = makeBookmark({ cards: this.session.cards, card });
    if (bookmark && bookmark.tableKey === removedBookmark.tableKey && bookmark.word === removedBookmark.word && bookmark.occurrence > removedBookmark.occurrence) bookmark.occurrence--;
    const isCurrent = () => !this.closed && token === this.loadToken && path === this.deckPath && tableKey === this.tableKey;
    let removed = false;
    try {
      // 先存完待写评分, 免得删除后旧队列又命中别的同名行。
      await this.flushScores();
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) return;
      const data = await this.app.vault.process(file, text => {
        const updated = removeCardRow(text, card, expectedCards);
        removed = updated !== null;
        return updated ?? text;
      });
      if (isCurrent()) {
        this.appliedSeq = ++this.reloadSeq;
        this.ownWrite = null;
        this.resetRound();
        this.session.arrange(this.readScope(data), this.arrangePrefs());
        this.session.index = restorePosition(this.session, bookmark, index);
        this.render();
      }
      new Notice(removed ? `已删除 ${card.word} 及笔记对应整行` : "这一行已变更, 卡片已刷新, 请重新选择后删除", 3500);
    } catch (error) {
      console.error("[MemoryCards] 删除卡片失败", error);
      new Notice("删除失败, 请重新打开笔记后重试", 4000);
    } finally {
      this.deleting = false;
      if (isCurrent()) {
        this.renderChrome();
        if (removed && this.session.card) this.startCardCycle();
        else this.scheduleReveal();
        this.focusDict();
      }
    }
  }

  // ==================== 弹窗调用的公开方法 ====================

  setOrder(order) {
    if (order === this.prefs.order) { this.autoplay.stop(); return; }
    this.setPrefs({ order });
    this.rearrange();
  }

  setFocus(focus) {
    this.setPrefs({ focus });
    this.rearrange();
  }

  setDictation(dictation) {
    this.setPrefs({ dictation });
    this.resetRound();
    this.render();
    this.scheduleReveal();
    this.autoplay.restart();
  }

  setReview(review) {
    this.setPrefs({ review });
    this.render();
    this.scheduleReveal();
    this.autoplay.restart();
  }

  setPause(interval) {
    this.setPrefs({ interval: Math.round(interval * 10) / 10 });
    this.autoplay.restart();
  }

  setRevealDelay(revealDelay) {
    this.setPrefs({ revealDelay: Math.round(revealDelay * 10) / 10 });
    this.autoplay.restart();
  }

  setSpeech(on) {
    this.store.speech = on;
    if (!on) this.player.stop();
    this.autoplay.restart();
  }

  openDeckSheet() {
    this.plugin.pickDeck(this.leaf);
  }

  async backToNote() {
    const file = this.app.vault.getAbstractFileByPath(this.deckPath);
    if (!(file instanceof TFile)) return;
    this.autoplay.stop();
    const card = this.session && this.session.card;
    this.plugin.noteByChoice && this.plugin.noteByChoice.set(this.leaf, this.deckPath); // 别再被自动切回卡片
    const scope = this.tables.find(t => t.key === this.tableKey);
    const line = scope?.line ?? card?.line;
    await this.leaf.openFile(file, line != null ? { eState: { line } } : undefined);
  }
}

module.exports = { CardView };

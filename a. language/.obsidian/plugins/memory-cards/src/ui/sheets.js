// 三个弹窗: 播放顺序、设置、切换卡组。全部继承 Sheet, 纯文字, 不放图标。
// 只通过 view 的公开方法改状态, 不直接碰卡片 DOM。

const { Platform } = require("obsidian");
const { Sheet } = require("./sheet");
const { toggle, rangeField } = require("./components");
const { LIMITS, DECK_ROOTS, AUTO_CARD_CATEGORIES } = require("../constants");
const { baseName, folderOf } = require("../text");

const seconds = (v) => (v === 0 ? "不停顿" : `${Number(v).toFixed(1)} 秒`);

class OrderSheet extends Sheet {
  constructor(app, view) {
    super(app, { title: "播放顺序", host: view.contentEl });
    this.view = view;
  }

  build(body) {
    const current = this.view.prefs.order;
    const group = this.group(body, { footnote: "切换后回到第一张, 并停止自动播放。" });
    const choose = (order) => () => { this.view.setOrder(order); this.close(); };
    this.row(group, { title: "循环播放", desc: "按笔记顺序", selected: current === "loop", onClick: choose("loop") });
    this.row(group, { title: "智能播放", desc: "每张表各自按评分从高到低", selected: current === "smart", onClick: choose("smart") });
  }
}

/** 设置: 学习方式、自动播放、复习、发音、卡组, 合在一个弹窗里。 */
class SettingsSheet extends Sheet {
  constructor(app, view) {
    super(app, { title: "设置", host: view.contentEl });
    this.view = view;
  }

  build(body) {
    const view = this.view;
    const prefs = view.prefs;
    const session = view.session;
    const reviewOn = prefs.review && !prefs.dictation;

    const study = this.group(body, { label: "学习方式", footnote: "按 ↑ / ↓ 给单词表、短语表的词加减分 (0–5)。" });
    this.row(study, {
      title: "进阶模式",
      desc: session.hasFocus ? `只刷评分 ≥ 1 的 ${session.focusCount} 个词` : "还没有评分 ≥ 1 的词",
      disabled: !session.hasFocus,
      trailing: toggle({
        value: session.focusActive, disabled: !session.hasFocus,
        onChange: (v) => { view.setFocus(v); this.refresh(); },
      }).el,
    });
    this.row(study, {
      title: "听写模式", desc: "遮住单词与释义, 在卡片旁听音拼写, 只判对错、不改分",
      trailing: toggle({ value: prefs.dictation, onChange: (v) => { view.setDictation(v); this.refresh(); } }).el,
    });
    this.row(study, {
      title: "复习模式", desc: prefs.dictation ? "听写模式下不可用" : "释义延迟淡入, 点卡片提前揭晓",
      disabled: prefs.dictation,
      trailing: toggle({
        value: reviewOn, disabled: prefs.dictation,
        onChange: (v) => { view.setReview(v); this.refresh(); },
      }).el,
    });
    if (reviewOn) {
      this.block(study, rangeField({
        title: "释义渐显延迟", ...LIMITS.revealDelay, value: prefs.revealDelay, format: seconds,
        onInput: (v) => view.setRevealDelay(v),
      }).el);
    }

    const display = this.group(body, { label: "显示" });
    this.row(display, {
      title: "词根提示",
      desc: "显示单词中的词根标记线及旁边的词根释义; 词根、前缀和后缀卡片的对应单词始终显示",
      trailing: toggle({ value: view.store.memoryHints, onChange: (v) => view.plugin.setMemoryHints(v) }).el,
    });

    const play = this.group(body, { label: "播放", footnote: "发音只读单词本身, 没有录音就跳过。" });
    this.block(play, rangeField({
      title: reviewOn ? "释义后停顿" : "读完后停顿", ...LIMITS.interval, value: prefs.interval, format: seconds,
      onInput: (v) => view.setPause(v),
    }).el);
    this.row(play, {
      title: "播放发音",
      trailing: toggle({ value: view.store.speech, onChange: (v) => view.setSpeech(v) }).el,
    });

    const autoCards = this.group(body, { label: "自动展示卡片", footnote: "按类别应用于所有笔记。关闭后, 再打开文章时保持笔记形式; 单词包含短语库。" });
    for (const { key, label } of AUTO_CARD_CATEGORIES) {
      this.row(autoCards, {
        title: label,
        trailing: toggle({
          value: view.store.autoCardsEnabled(key),
          onChange: value => view.store.setAutoCards(key, value),
        }).el,
      });
    }

    const deck = this.group(body, { label: "卡组" });
    this.row(deck, {
      title: "在笔记中定位本词", desc: session.card ? session.card.word : "", disabled: !session.card,
      onClick: () => { this.close(); view.backToNote(); },
    });
    this.row(deck, {
      title: "切换卡组", desc: baseName(view.deckPath),
      onClick: () => { this.close(); view.openDeckSheet(); },
    });
  }
}

/** 听写刷完一轮的小结: 拼了几个、错了几个, 可以只重刷拼错的。关闭 (完成 / Esc / 点遮罩) = 继续下一轮。 */
class RoundSheet extends Sheet {
  constructor(app, view, { judged, wrong, onDrill }) {
    super(app, { title: "本轮听写", host: view.contentEl });
    Object.assign(this, { judged, wrong, onDrill });
  }

  onOpen() {
    // 焦点从输入框移到弹窗: 回车直接选第一行
    setTimeout(() => {
      if (!this.isOpen) return;
      const first = this.body.querySelector(".mc-row.is-clickable");
      if (first) first.focus();
    }, 30);
  }

  build(body) {
    const { judged, wrong } = this;
    const stats = this.group(body, { label: "结果" });
    this.row(stats, { title: `拼写 ${judged} 个`, desc: wrong ? `拼对 ${judged - wrong} 个, 拼错 ${wrong} 个` : "全部拼对" });
    const next = this.group(body, { label: "接下来" });
    if (wrong) {
      this.row(next, {
        title: `只重刷拼错的 ${wrong} 个`, desc: "刷完回到整副牌",
        onClick: () => { this.drill = true; this.close(); this.onDrill(); },
      });
    }
    this.row(next, { title: "继续下一轮", onClick: () => this.close() });
  }
}

class DeckSheet extends Sheet {
  /** host: 从卡片页打开时传卡片页的内容区, 弹窗在该标签页内居中; 从功能区 / 命令打开时为空, 相对窗口居中。 */
  constructor(app, { store, currentPath, onChoose, host = null }) {
    super(app, { title: "切换卡组", host });
    this.store = store;
    this.currentPath = currentPath;
    this.onChoose = onChoose;
    this.query = "";
  }

  onOpen() {
    // 搜索框放在可滚动区之外, 输入时不被重绘打断
    const search = createDiv("mc-search");
    const input = search.createEl("input", { attr: { type: "search", placeholder: "搜索笔记", spellcheck: "false" } });
    input.addEventListener("input", () => { this.query = input.value; this.refresh(); });
    this.body.before(search);
    if (!Platform.isMobile) setTimeout(() => input.focus(), 30);
  }

  decks() {
    return this.app.vault.getMarkdownFiles()
      .filter((f) => DECK_ROOTS.some((r) => f.path.startsWith(r)))
      .map((f) => f.path)
      .sort((a, b) => a.localeCompare(b, "zh"));
  }

  build(body) {
    const tokens = this.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const all = this.decks();
    const exists = new Set(all);
    const choose = (path) => () => { this.close(); this.onChoose(path); };
    const addRow = (group, path) => this.row(group, {
      title: baseName(path), desc: folderOf(path), selected: path === this.currentPath, onClick: choose(path),
    });

    if (!tokens.length) {
      const recent = this.store.recent.filter((p) => exists.has(p));
      if (recent.length) {
        const group = this.group(body, { label: "最近学习" });
        recent.forEach((p) => addRow(group, p));
      }
    }

    const matches = tokens.length ? all.filter((p) => tokens.every((t) => p.toLowerCase().includes(t))) : all;
    const shown = matches.slice(0, 80);
    const group = this.group(body, {
      label: tokens.length ? `搜索结果 · ${matches.length}` : "全部笔记",
      footnote: matches.length > shown.length ? `还有 ${matches.length - shown.length} 篇, 输入关键词缩小范围。` : "",
    });
    if (!shown.length) this.row(group, { title: "没有匹配的笔记" });
    shown.forEach((p) => addRow(group, p));
  }
}

class ScopeSheet extends Sheet {
  constructor(app, view) {
    super(app, { title: "学习范围", host: view.contentEl });
    this.view = view;
  }
  build(body) {
    const view = this.view;
    const group = this.group(body, { label: baseName(view.deckPath), footnote: "每个范围分别记住进度, 评分仍保存在原表中。" });
    const choose = key => () => { this.close(); view.selectScope(key); };
    this.row(group, { title: "整篇笔记", desc: `${view.allCards.length} 张`, selected: view.tableKey == null, onClick: choose(null) });
    for (const table of view.tables) this.row(group, {
      title: table.label, desc: `${table.count} 张`, selected: view.tableKey === table.key, onClick: choose(table.key),
    });
  }
}

module.exports = { OrderSheet, SettingsSheet, RoundSheet, DeckSheet, ScopeSheet };

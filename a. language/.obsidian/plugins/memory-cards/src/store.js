// 持久化: 插件 data.json。每个卡组 (笔记路径) 一份学习偏好, 另有全局发音开关与最近卡组。
// 写入合并 600ms 再落盘, 卸载时立即落盘。

const { DEFAULT_PREFS, RECENT_LIMIT, AUTO_CARD_CATEGORIES } = require("./constants");

class PrefsStore {
  constructor(plugin, data) {
    this.plugin = plugin;
    this.data = Object.assign({ speech: false, lastDeck: "", recent: [], decks: {} }, data || {});
    if (!Array.isArray(this.data.recent)) this.data.recent = [];
    this.data.autoCards = Object.fromEntries(AUTO_CARD_CATEGORIES.map(({ key }) => [key, this.data.autoCards?.[key] !== false]));
    this.timer = null;
    // 一次性迁移: 清掉旧版存下的播放顺序, 让所有卡组回到默认的智能播放。
    if ((this.data.prefsVersion || 0) < 2) {
      for (const prefs of Object.values(this.data.decks || {})) delete prefs.order;
      this.data.prefsVersion = 2;
      this.save();
    }
  }

  static async load(plugin) {
    return new PrefsStore(plugin, await plugin.loadData());
  }

  deck(path) {
    return Object.assign({}, DEFAULT_PREFS, this.data.decks[path] || {});
  }

  setDeck(path, patch) {
    if (!path) return;
    this.data.decks[path] = Object.assign(this.data.decks[path] || {}, patch);
    this.save();
  }

  get speech() { return Boolean(this.data.speech); }
  set speech(value) { this.data.speech = Boolean(value); this.save(); }

  get memoryHints() { return this.data.memoryHints !== false; }
  set memoryHints(value) { this.data.memoryHints = Boolean(value); this.save(); }

  autoCardsEnabled(category) { return this.data.autoCards[category] === true; }

  setAutoCards(category, value) {
    if (!AUTO_CARD_CATEGORIES.some(({ key }) => key === category)) return;
    this.data.autoCards[category] = Boolean(value);
    this.save();
  }

  shouldAutoOpen(path) {
    const category = AUTO_CARD_CATEGORIES.find(({ roots }) => roots.some(root => path.startsWith(root)));
    return Boolean(category && this.autoCardsEnabled(category.key));
  }

  get lastDeck() { return this.data.lastDeck; }
  get recent() { return this.data.recent.slice(); }

  touch(path) {
    this.data.lastDeck = path;
    this.data.recent = [path, ...this.data.recent.filter((p) => p !== path)].slice(0, RECENT_LIMIT);
    this.save();
  }

  rename(from, to) {
    if (this.data.decks[from]) {
      this.data.decks[to] = this.data.decks[from];
      delete this.data.decks[from];
    }
    if (this.data.lastDeck === from) this.data.lastDeck = to;
    this.data.recent = this.data.recent.map((p) => (p === from ? to : p));
    this.save();
  }

  forget(path) {
    this.data.recent = this.data.recent.filter((p) => p !== path);
    this.save();
  }

  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 600);
  }

  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    return this.plugin.saveData(this.data);
  }
}

module.exports = { PrefsStore };

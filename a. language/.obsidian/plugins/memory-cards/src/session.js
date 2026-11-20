// 牌堆逻辑: 进阶筛选、播放顺序、当前位置。纯数据, 不碰 DOM, test.js 直接测。

const { SCORE_MAX } = require("./score");

/**
 * 智能播放: 每张表格各自成组 (单词表、短语表、同义改写表……), 组与组保持笔记里的先后顺序, 不互相穿插;
 * 组内按评分 5 → 0 分桶, 同分保持笔记顺序 (分桶本身稳定, 不依赖 sort 的稳定性)。
 * 所以 5 分的短语排在短语表那一组的最前, 而不是跑到单词前面。
 */
function bySmartOrder(cards) {
  const groups = new Map();
  for (const card of cards) {
    const key = card.table || 0;
    if (!groups.has(key)) groups.set(key, Array.from({ length: SCORE_MAX + 1 }, () => []));
    groups.get(key)[SCORE_MAX - (card.score || 0)].push(card);
  }
  return [...groups.values()].flatMap((buckets) => buckets.flat());
}

/**
 * 循环播放保持笔记顺序; 智能播放按评分从高到低 (每张表格各排各的)。
 * 进阶模式 = 只刷评分 ≥ 1 的词, 只在卡组确实有这样的词时生效, 免得锁在空牌堆里。
 */
function arrangeDeck(cards, { order, focus }) {
  const focusCards = cards.filter((c) => c.focus === 1);
  const hasFocus = focusCards.length > 0;
  const focusActive = Boolean(focus) && hasFocus;
  let deck = focusActive ? focusCards : cards.slice();
  if (order === "smart") deck = bySmartOrder(deck);
  return { deck, hasFocus, focusActive, focusCount: focusCards.length };
}

class StudySession {
  constructor() {
    this.cards = [];
    this.deck = [];
    this.index = 0;
    this.hasFocus = false;
    this.focusActive = false;
    this.focusCount = 0;
    this.drilling = false; // 正在只重刷一部分卡 (听写拼错的词)
  }

  get size() { return this.deck.length; }
  get card() { return this.deck[this.index] || null; }

  /**
   * 重新排牌。keepWord 优先 (笔记被编辑后留在同一个词上), 其次 index。
   */
  arrange(cards, prefs, { index = 0, keepWord = null } = {}) {
    this.cards = cards;
    this.drilling = false;
    const result = arrangeDeck(cards, prefs);
    Object.assign(this, result);
    let next = index;
    if (keepWord) {
      const found = this.deck.findIndex((c) => c.word === keepWord);
      next = found >= 0 ? found : this.index;
    }
    this.index = this.clamp(next);
    return this;
  }

  /**
   * 笔记被改写但表格结构没变 (行数、词头、所在表格都一样, 比如评分写回或改了高亮 / 释义):
   * 把新内容抄到原来的卡片对象上, 牌堆顺序、筛选和当前位置一律不动。
   * keepScore 里的卡片 (评分还没写盘) 保留内存里的分数。结构变了返回 false, 由调用方重排。
   */
  refresh(cards, keepScore = null) {
    const old = this.cards;
    if (cards.length !== old.length) return false;
    if (!cards.every((c, i) => c.word === old[i].word && c.table === old[i].table)) return false;
    cards.forEach((fresh, i) => {
      const { score, focus } = old[i];
      Object.assign(old[i], fresh);
      if (keepScore && keepScore.has(old[i])) Object.assign(old[i], { score, focus });
    });
    this.refreshFocus();
    return true;
  }

  /**
   * 打分后刷新进阶词数量。牌堆本身不重排、不重新筛选 (正在看的卡不会跳走),
   * 新的分数在刷完一轮 (首尾循环, 见 advance)、下次进入卡组或切换顺序 / 进阶模式时生效。
   */
  refreshFocus() {
    this.focusCount = this.cards.filter((c) => c.focus === 1).length;
    this.hasFocus = this.focusCount > 0;
  }

  /** 临时只刷这几张 (保持传入顺序); 刷到头 (见 advance) 或任何一次重排后回到整副牌。 */
  drill(cards) {
    if (!cards.length) return false;
    this.deck = cards.slice();
    this.index = 0;
    this.drilling = true;
    return true;
  }

  clamp(index) {
    return Math.min(Math.max(Number(index) || 0, 0), Math.max(this.deck.length - 1, 0));
  }

  /**
   * 翻一张。智能播放走到头循环时, 按最新评分重排 (进阶模式同时重新筛选),
   * 这样一轮里打过的分在下一轮就体现在顺序上; 循环播放照常首尾相接。
   * 重刷 (drill) 走到头: 不管哪种顺序都回到整副牌。
   */
  advance(direction, prefs) {
    const n = this.deck.length;
    const wraps = direction > 0 ? this.index >= n - 1 : this.index <= 0;
    if (wraps && prefs && (prefs.order === "smart" || this.drilling)) {
      this.arrange(this.cards, prefs);
      this.index = direction > 0 ? 0 : Math.max(this.deck.length - 1, 0);
    } else {
      this.index = this.offset(direction);
    }
  }

  /** 首尾循环 */
  offset(direction) {
    const n = this.deck.length;
    return n ? (this.index + direction + n) % n : 0;
  }
}

module.exports = { StudySession, arrangeDeck };

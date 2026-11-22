/* 由 build.js 从 src/ 生成，请改 src/ 而不是这个文件。 */
const __defs = {
"index": function (module, exports, require) {
// 入口: 注册视图、入口按钮与命令。导出纯函数给 test.js。

const { Plugin, MarkdownView, TFile, addIcon } = require("obsidian");
const { VIEW_TYPE, DECK_ROOTS } = require("./constants");
const { parseDeck } = require("./parse");
const { PrefsStore } = require("./store");
const { BASE_SOURCES, createRootIndex } = require("./roots");
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
    await this.loadRootIndex();
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
    this.registerEvent(this.app.vault.on("modify", async file => {
      if (!BASE_SOURCES.some(source => source.path === file.path)) return;
      await this.loadRootIndex();
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
        if (leaf.view instanceof CardView) await leaf.view.reload({ force: true });
      }
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

  async loadRootIndex() {
    const seq = this.rootIndexSeq = (this.rootIndexSeq || 0) + 1;
    const index = new Map();
    for (const { path, kind } of BASE_SOURCES) {
      const file = this.app.vault.getAbstractFileByPath(path);
      createRootIndex(file instanceof TFile ? await this.app.vault.read(file) : "", kind, index);
    }
    if (seq === this.rootIndexSeq) this.rootIndex = index;
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
    if (!parseDeck(text).length) return;
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

},
"constants": function (module, exports, require) {
// 全插件共用的常量。改默认值只改这里。

const VIEW_TYPE = "memory-cards-view";

// 音频与笔记 1:1 镜像: 20. resource/<笔记路径去 .md>/audio/
const AUDIO_ROOT = "20. resource";
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a"];

// 卡组候选范围 (切换卡组列表与笔记标题栏按钮只在这些模块出现)
const DECK_ROOTS = ["01. base/", "02. word/", "03. phrase/", "04. grammer/", "05. listening/", "06. reading/", "07. writing/", "09. speaking/", "10. practice/"];

// 打开这些模块里的笔记时默认直接展示成卡片 (笔记里有能上卡的表才切)
const AUTO_CARD_CATEGORIES = [
  { key: "word", label: "单词", roots: ["02. word/", "03. phrase/"] },
  { key: "listening", label: "听力", roots: ["05. listening/"] },
  { key: "reading", label: "阅读", roots: ["06. reading/"] },
  { key: "writing", label: "写作", roots: ["07. writing/"] },
  { key: "speaking", label: "口语", roots: ["09. speaking/"] },
];

// 集中听力词块: 每行的音频在来源文章的镜像目录里, 来源 = 表格上方的一级标题
const LISTENING_CENTRAL = /(?:^|\/)02\. word\/m\. 剑雅听力真题\/音义词块\.md$/i;

// 每个卡组独立保存的学习偏好, 与 Memory App 的 MTAutoplaySettings 默认值一致
const DEFAULT_PREFS = Object.freeze({
  interval: 2.3,       // 读完后停顿 (秒)
  revealDelay: 0.3,    // 复习模式释义渐显延迟 (秒)
  order: "smart",      // loop 循环播放 | smart 智能播放 (默认智能)
  focus: true,         // 进阶模式; 卡组没有进阶词时自动忽略
  dictation: false,
  review: false,
  progress: 0,
});

const LIMITS = Object.freeze({
  interval: { min: 0, max: 6, step: 0.1 },
  revealDelay: { min: 0.3, max: 3, step: 0.1 },
});

const RECENT_LIMIT = 6;

// 动效时长 (毫秒)。系统开启「减弱动态效果」时全部缩短。
const MOTION = Object.freeze({
  outTap: 110,
  outSwipe: 90,
  in: 200,
  snapBack: 220,
  swipeThreshold: 0.22, // 拖过舞台宽度的比例即翻页
  swipeVelocity: 0.5,   // px/ms
});

// 单条录音的安全超时, 防止某条坏音频把自动播放卡死
const AUDIO_ITEM_TIMEOUT = 15000;

module.exports = {
  VIEW_TYPE, AUDIO_ROOT, AUDIO_EXTENSIONS, DECK_ROOTS, AUTO_CARD_CATEGORIES, LISTENING_CENTRAL,
  DEFAULT_PREFS, LIMITS, RECENT_LIMIT, MOTION, AUDIO_ITEM_TIMEOUT,
};

},
"parse": function (module, exports, require) {
// 笔记 → 卡片。只读 Markdown 源码, 不碰 DOM。
//
// 能上卡的表: 必须有「释义」列 (或同义改写表的「原文表达」列)。
//   单词表  | 单词 | 音标 | 释义 | 记忆 | 英意 | 意群 | 同义词 | 评分 |   (记忆用于定位词根, 其余内容在悬浮卡展示)
//   短语表  | 短语 | 释义 | 意群 |
//   语法表  | 语法词条 | 意群 | 释义 |
//   Base    | <主题> | 释义 | 例子 | 评分 |
//   同义改写 | 题目表达 | 原文表达 |       → 英英对仗卡
// 评分: 表末「评分」列 (0–5) 是唯一来源; 没有评分列的表按词头整格高亮推导 (==word== = 1, 否则 0)。

const { splitRow, isSeparator, isTableLine, stripComments, stripTags, brToNewline, plain, multiline, isPhonetic } = require("./text");
const { SCORE_HEADER, clampScore } = require("./score");
const { resolveRootHints } = require("./roots");

const headerName = (h) => plain(h).replace(/\*/g, "").trim();

function tableColumns(header) {
  const names = header.map(headerName);
  const meaning = names.indexOf("释义");
  const original = names.indexOf("原文表达");
  if (meaning < 0 && original < 0) return null;
  const word = names[0] === "意群" && names.length > 1 ? 1 : 0;
  const score = names.indexOf(SCORE_HEADER);
  // 悬浮卡片用: 英意 (旧表头「拆解」) 与意群; 意群就是词头列时不重复展示
  const english = names.findIndex((n) => n === "英意" || n === "拆解");
  const phraseCol = names.indexOf("意群");
  const phrase = phraseCol === word ? -1 : phraseCol;
  const memory = names.indexOf("记忆");
  const examples = names.indexOf("例子");
  const synonyms = names.indexOf("同义词");
  const phonetic = names.indexOf("音标"); // 独立音标列 (词头格第二行的旧写法仍可读)
  return meaning >= 0
    ? { word, meaning, score, paired: false, english, phrase, memory, examples, synonyms, phonetic }
    : { word, meaning: original, score, paired: true };
}

function parseHeadCell(raw) {
  const lines = brToNewline(stripComments(raw)).split("\n").map((l) => l.trim()).filter(Boolean);
  const bare = stripTags(lines[0] || "").trim();
  const focus = /^(\*\*)?==[^=]+==(\*\*)?$/.test(bare) || /^\*\*[^*]+\*\*$/.test(bare) ? 1 : 0;
  return {
    word: plain(lines[0] || ""),
    focus,
    phonetic: lines.slice(1).map(plain).find(isPhonetic) || "",
    source: (raw.match(/data-source="([^"]+)"/) || [])[1] || "",
  };
}

function parseMeaning(raw) {
  return multiline(raw)
    .split("\n").map((l) => l.trim())
    .filter((l) => !isPhonetic(l)) // 听力集中表把音标写在释义末尾, 卡面不显示音标
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\*\*/g, "")
    .trim();
}

/**
 * @returns {Array<{id,word,score,focus,phonetic,meaning,paired,table,memory,english,phrase,h1,source,line,wordCol,scoreCol}>}
 *   table: 所在表格的序号 (智能播放按表格隔离排序, 每张表各排各的);
 *   score: 0–5; focus: score ≥ 1 (进阶); h1: 最近的一级标题 (集中听力表定位来源文章);
 *   line: 源码行号; wordCol / scoreCol: 写回评分时定位单元格 (scoreCol = -1 表示该表没有评分列)
 */
function parseDeck(markdown, { rootIndex = null } = {}) {
  const lines = markdown.split(/\r?\n/);
  const cards = [];
  let h1 = "";
  let heading = "";
  const occurrences = new Map();
  let table = -1;
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) { inCode = !inCode; continue; }
    if (inCode) continue;
    const hm = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (hm) {
      heading = plain(hm[2]);
      if (hm[1].length === 1) {
        h1 = plain(hm[2]);
      }
      continue;
    }
    if (!isTableLine(line) || !isSeparator(lines[i + 1])) continue;
    const header = splitRow(line).map(headerName);
    const cols = tableColumns(header);
    const tableStart = i;
    const identity = JSON.stringify([heading, header[0]]);
    const occurrence = (occurrences.get(identity) || 0) + 1;
    occurrences.set(identity, occurrence);
    const tableKey = JSON.stringify([heading, header[0], occurrence]);
    table += 1;
    i += 1;
    while (isTableLine(lines[i + 1])) {
      i++;
      if (!cols) continue;
      const row = splitRow(lines[i]);
      const head = parseHeadCell(row[cols.word] || "");
      if (!head.word) continue;
      const meaningCell = row[cols.meaning] || "";
      const rawScore = cols.score >= 0 ? plain(row[cols.score] || "") : "";
      const score = /^\d+$/.test(rawScore) ? clampScore(rawScore) : head.focus;
      const memory = cols.memory >= 0 ? parseMeaning(row[cols.memory] || "") : "";
      cards.push({
        id: cards.length,
        word: head.word,
        score,
        focus: score >= 1 ? 1 : 0,
        phonetic: head.phonetic || (cols.phonetic >= 0 ? plain(row[cols.phonetic] || "").trim() : ""),
        meaning: cols.paired ? plain(meaningCell) : parseMeaning(meaningCell),
        paired: cols.paired,
        table,
        tableKey,
        tableStart,
        tableHeading: heading,
        tableHeader: header[0],
        ...(cols.paired ? { roots: [], rootRanges: [] } : resolveRootHints(memory, head.word, rootIndex)),
        memory,
        english: cols.english >= 0 ? parseMeaning(row[cols.english] || "") : "",
        synonyms: cols.synonyms >= 0 ? parseMeaning(row[cols.synonyms] || "") : "",
        phrase: cols.phrase >= 0 ? multiline(row[cols.phrase] || "").replace(/==/g, "").trim() : "",
        examples: cols.examples >= 0 ? multiline(row[cols.examples] || "").replace(/==/g, "").trim() : "",
        h1,
        source: head.source,
        line: i,
        wordCol: cols.word,
        scoreCol: cols.score,
      });
    }
  }
  return cards;
}

module.exports = { parseDeck, tableColumns };

},
"text": function (module, exports, require) {
// 纯文本工具: Markdown 表格行切分、单元格清洗、HTML 转义、音频 slug。不依赖 Obsidian, test.js 直接调用。

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") { cur += "|"; i++; continue; }
    if (s[i] === "|") { cells.push(cur.trim()); cur = ""; continue; }
    cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

const isSeparator = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line || "");
const isTableLine = (line) => Boolean(line) && line.trim().startsWith("|");
const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, "");
const brToNewline = (s) => s.replace(/<br\s*\/?>/gi, "\n");
const stripTags = (s) => s.replace(/<[^>]*>/g, "");
const decodeEntities = (s) => s
  .replace(/&emsp;|&ensp;|&nbsp;/g, " ")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
  .replace(/&amp;/g, "&");
const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const isPhonetic = (s) => /^\/[^/]+\/$/.test(s.trim());

/** 单元格 → 纯文本: 去注释、标签、实体与 ** / == 标记。 */
const plain = (s) => decodeEntities(stripTags(stripComments(s))).replace(/\*\*|==/g, "").trim();

/** 单元格 → 多行文本 (保留 <br> 换行与 ==标记==, 去其余标签)。 */
const multiline = (s) => decodeEntities(stripTags(brToNewline(stripComments(s))));

// 释义行开头的词性标签, 单独成列显示
const POS_RE = /^((?:n|v|vt|vi|adj|adv|prep|conj|pron|int|det|num|abbr|exclam|art|aux|modal|phr|prefix|suffix)\.)\s*/;

/**
 * 释义 → HTML: 每行一条, 行首词性 (n. / adj. ...) 放在左侧一列, 释义在右侧左对齐,
 * 折行时对齐到释义起点; ==考过义项== 浅绿底; 空行 = 词性之间留一点空。输入是 multiline() 之后的文本。
 */
function meaningHtml(text) {
  const mark = (s) => escapeHtml(s).replace(/==([^=]+)==/g, '<mark class="mc-exam">$1</mark>');
  const out = [];
  let gap = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) { gap = out.length > 0; continue; }
    const cls = gap ? "mc-sense is-gap" : "mc-sense";
    gap = false;
    const m = line.match(POS_RE);
    out.push(m
      ? `<div class="${cls}"><span class="mc-pos">${escapeHtml(m[1])}</span><span class="mc-def">${mark(line.slice(m[0].length))}</span></div>`
      : `<div class="${cls} is-plain"><span class="mc-def">${mark(line)}</span></div>`);
  }
  return out.join("");
}

/**
 * 英意 → HTML: 两栏网格, 左栏词性(只有该词性的第一条主义项才有, 其余留空), 右栏义项文字,
 * 这样同一词性下的多条主义项文字起点对齐; 「•」子义项在右栏缩进一档。输入是 parseMeaning() 之后的文本。
 */
const EN_POS = /^((?:n|v|adj|adv|prep|conj|pron|int|det|num|abbr|exclam)\.)\s+/;
function englishHtml(text) {
  const rows = text.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    if (/^•/.test(line)) {
      return `<span class="mc-en-pos"></span><div class="mc-en is-sub">${escapeHtml(line.replace(/^•\s*/, ""))}</div>`;
    }
    const m = line.match(EN_POS);
    const pos = m ? escapeHtml(m[1]) : "";
    const body = escapeHtml(m ? line.slice(m[0].length) : line);
    return `<span class="mc-en-pos is-main">${pos}</span><div class="mc-en is-main">${body}</div>`;
  });
  return `<div class="mc-en-grid">${rows.join("")}</div>`;
}

/** 意群 → HTML: **靶心词** 加粗, 多条意群各占一行。 */
function phraseHtml(text) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => `<div class="mc-phrase-line">${escapeHtml(l).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")}</div>`)
    .join("");
}

/** Base「例子」列只取词头, 保留词形与顺序, 词性及后面的释义留在原文中。 */
function exampleWords(text = "") {
  const words = [], seen = new Set();
  const pos = /\s+(?:n|v|vt|vi|adj|adv|prep|conj|pron|int|det|num|abbr|exclam|art|aux|modal|phr)\.\s*/;
  for (const raw of multiline(text).split("\n")) {
    const line = plain(raw);
    if (!line) continue;
    const match = line.match(pos);
    if (!match && !/^[A-Za-z][A-Za-z0-9'’ .-]*$/.test(line)) continue;
    const word = (match ? line.slice(0, match.index) : line).trim();
    if (!word || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    words.push(word);
  }
  return words;
}

/**
 * 按「括号段结束」切分构词行: "rad, ras(根: 刮), -ity(性质)" → ["rad, ras(根: 刮)", "-ity(性质)"]。
 * 只在 ")" 之后断开, 词根变体 "muscl, muscul(...)" 里的逗号不会被切开。
 */
function splitParts(line) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    cur += ch;
    if (ch === ")" && depth === 0 && /^\s*(?:,|$)/.test(line.slice(i + 1))
        && !/^[a-z]+$/i.test(memoryPart(cur.trim()).meaning)) {
      parts.push(cur.replace(/^[,\s]+/, "").trim()); cur = "";
    }
  }
  const rest = cur.replace(/^[,\s]+/, "").trim();
  if (rest) parts.push(rest);
  return parts;
}

/**
 * 记忆 → HTML。构词行 (`out(词: 向外), cry(词: 喊叫)`) 拆成一枚枚成分: 片段加粗, 括号释义灰色;
 * 其余行 (核心意象 / 引申解释) 作正文。输入是 parseMeaning() 之后的文本。
 */
function memoryParts(line) {
  const parts = /^[A-Za-z(\-]/.test(line) && line.includes("(") ? splitParts(line) : null;
  const ok = (p) => /\(.*\)$/.test(p) || /^-?[a-z]{1,3}-?$/.test(p);
  return parts && parts.every(ok) && parts.some((p) => p.includes("(")) ? parts : null;
}

/** 最后一组外层括号才是释义, 保留 my(o) 等词根自带的可选字母。 */
function memoryPart(part) {
  let depth = 0;
  if (part.endsWith(")")) {
    for (let i = part.length - 1; i >= 0; i--) {
      if (part[i] === ")") depth++;
      if (part[i] === "(" && --depth === 0) {
        return { word: part.slice(0, i).trim(), meaning: part.slice(i + 1, -1) };
      }
    }
  }
  return { word: part, meaning: "" };
}

/** 记忆列分为构词说明与核心意象, 不把无构词的首行误当拆解。 */
function splitMemory(text = "") {
  const decomposition = [], memory = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const bare = line.replace(/\*\*/g, "");
    const formation = memoryParts(bare)
      || /^由\s*.+(?:混合构成|截短形成)$/.test(line)
      || /^[A-Za-z].*的首字母缩写$/.test(line);
    (formation ? decomposition : memory).push(formation ? bare : line);
  }
  return { decomposition: decomposition.join("\n"), memory: memory.join("\n") };
}

function memoryHtml(text) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean)
    .map((line) => `<div class="mc-mem-line">${escapeHtml(line)}</div>`).join("");
}

/** 与 tts-audio-engine 的 to_slug() 及 Memory App 的 MTDeckAudioIndex.slug 逐条一致。 */
function toSlug(str) {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim()
    .replace(/[*=_~`#]/g, "")
    .replace(/['’`]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/** someone's 类短语的录音按 someone_s 命名, 两种都试。 */
function slugVariants(text) {
  const s = toSlug(text);
  if (!s) return [];
  const out = [s];
  if (s.includes("_s_") || s.endsWith("_s")) out.push(s.replace(/_s_/g, "_someone_s_").replace(/_s$/g, "_someone_s"));
  return out;
}

/** 听写判分用: 忽略大小写, 忽略空格与连字符的差别 (well known = well-known), 弯引号当直引号。 */
const spellKey = (s) => (s || "")
  .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
  .replace(/[\s\-\u2010-\u2014]+/g, "").toLowerCase();

const baseName = (path) => (path || "").split("/").pop().replace(/\.md$/i, "");
const folderOf = (path) => (path || "").split("/").slice(0, -1).join(" / ");

module.exports = {
  splitRow, isSeparator, isTableLine, stripComments, brToNewline, stripTags, decodeEntities,
  escapeHtml, isPhonetic, plain, multiline, meaningHtml, englishHtml, phraseHtml, exampleWords, memoryHtml, splitMemory, splitParts, memoryPart, toSlug, slugVariants, baseName, folderOf, spellKey,
};

},
"score": function (module, exports, require) {
// 评分: 单词、短语及 Base 词根词缀表末尾的「评分」列, 0–5 分。≥1 的词头在渲染层高亮, 源码词头不写 ==。
// 其余笔记没有评分列, 只能看分不能打分。
// 纯文本函数, 不依赖 Obsidian, test.js 直接测; 写盘由 CardView 通过 vault.process 调用 rewriteRow。
//
// 标记规则与 highlight-decompose 的 marks.js 保持一致:
//   单词表: 整格 **word** / ==word== / **==word==** 都算高亮, 改写时统一成 ==word== 或去掉标记;
//   短语库 (03. phrase): 用户的 **加粗** 原样保留, 只增删外层 ==。

const SCORE_HEADER = "评分";
const SCORE_MAX = 5;

const clampScore = (n) => Math.min(SCORE_MAX, Math.max(0, Math.round(Number(n) || 0)));
const isPhraseLibrary = (path) => (path || "").startsWith("03. phrase/");

/** 与 highlight-decompose marks.js 的 splitMarks 相同。preserveBold: 短语库的 ** 是用户标记, 不算高亮。 */
function splitMarks(text, preserveBold = false) {
  // 听力集中表词头末尾可能挂着隐藏的来源标签, 它不属于词头, 必须留在 == 外面
  const metadata = text.match(/\s*<span\b[^>]*\bclass="hd-listening-source"[^>]*><\/span>\s*$/)?.[0] || "";
  if (metadata) text = text.slice(0, -metadata.length);
  let lead = text.match(/^\s*/)[0];
  let trail = text.slice(lead.length).match(/\s*$/)[0];
  let core = text.slice(lead.length, text.length - trail.length);
  let level = 0;
  for (;;) {
    const m = ["**", "=="].find((mk) => core.length > 4 && core.startsWith(mk) && core.endsWith(mk));
    if (!m) break;
    const inner = core.slice(2, -2);
    if (inner[0] === m[0] || inner[inner.length - 1] === m[0] || inner.includes(m)) break;
    core = inner;
    if (preserveBold && m === "**") { lead += m; trail = m + trail; } else level = 1;
  }
  return { lead, core, trail: trail + metadata, level };
}

/** 一行表格里每个单元格在原文中的 [start, end) 位置 (不含竖线), 跳过转义竖线 \| 。 */
function cellSpans(line) {
  const pipes = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "|" && line[i - 1] !== "\\") pipes.push(i);
  }
  const spans = [];
  for (let k = 0; k + 1 < pipes.length; k++) spans.push([pipes[k] + 1, pipes[k + 1]]);
  return spans;
}

/** 词头格只改第一行 (`word<br>/音标/` 的音标原样保留)。 */
function rewriteHead(cell, highlighted, preserveBold = false) {
  const br = cell.search(/<br\s*\/?>/i);
  const head = br < 0 ? cell : cell.slice(0, br);
  const rest = br < 0 ? "" : cell.slice(br);
  const { lead, core, trail } = splitMarks(head, preserveBold);
  return lead + (highlighted ? `==${core}==` : core) + trail + rest;
}

/**
 * 改写一行: 只改评分格, 词头不再写 == (高亮由 highlight-decompose 按评分 ≥ 1 在渲染层生成)。
 * 其余字符原样保留。
 * @returns 新行; 列数不够时返回 null (调用方据此放弃写盘)
 */
function rewriteRow(line, { scoreCol, score }) {
  const spans = cellSpans(line);
  if (scoreCol >= spans.length) return null;
  const [start, end] = spans[scoreCol];
  return line.slice(0, start) + ` ${clampScore(score)} ` + line.slice(end);
}

module.exports = { SCORE_HEADER, SCORE_MAX, clampScore, isPhraseLibrary, splitMarks, cellSpans, rewriteHead, rewriteRow };

},
"roots": function (module, exports, require) {
// 只把笔记里已有的构词成分与 Base 精确匹配, 不从单词拼写或分组标题推断词根。
const { splitRow, isSeparator, isTableLine, plain, multiline, splitMemory, splitParts, memoryPart } = require("./text");

const ROOT_BASE_PATH = "01. base/y.word-root.md";
const PREFIX_BASE_PATH = "01. base/x.word-prefix.md";
const SUFFIX_BASE_PATH = "01. base/z.word-suffix.md";
const BASE_SOURCES = [
  { path: ROOT_BASE_PATH, kind: "root" },
  { path: PREFIX_BASE_PATH, kind: "prefix" },
  { path: SUFFIX_BASE_PATH, kind: "suffix" },
];

function rootForms(word) {
  const expand = form => {
    const m = form.match(/\([a-z]+\)/i);
    if (!m) return /^[a-z]+$/i.test(form) ? [form.toLowerCase()] : [];
    return ["", m[0].slice(1, -1)].flatMap(value => expand(form.slice(0, m.index) + value + form.slice(m.index + m[0].length)));
  };
  return [...new Set(word.split(/[,/]/).flatMap(form => expand(form.trim().replace(/^-+|-+$/g, ""))))];
}

/** 词根表首列表头含「词根」; 前缀/后缀文件里每张带「释义」列的表都是词缀表 (总表没有释义列, 自然跳过)。 */
function createRootIndex(markdown, kind = "root", index = new Map()) {
  const lines = markdown.split(/\r?\n/);
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) { inCode = !inCode; continue; }
    if (inCode || !isTableLine(lines[i]) || !isSeparator(lines[i + 1])) continue;
    const header = splitRow(lines[i]).map(plain);
    const meaningCol = header.indexOf("释义");
    const isRootTable = meaningCol >= 0 && (kind !== "root" || header[0].includes("词根"));
    i++;
    while (isTableLine(lines[i + 1])) {
      const cells = splitRow(lines[++i]);
      if (!isRootTable) continue;
      const word = plain(cells[0] || "");
      const meaning = multiline(cells[meaningCol] || "").replace(/\*\*|==/g, "").trim();
      if (!word || !meaning) continue;
      const root = { word, meaning, kind };
      for (const form of rootForms(word)) {
        const key = `${kind}:${form}`;
        const entries = index.get(key) || [];
        if (!entries.some(entry => entry.word === word && entry.meaning === meaning)) entries.push(root);
        index.set(key, entries);
      }
    }
  }
  return index;
}

const isConnector = ({ word, meaning }) => !word || /词:|连接/.test(meaning || "") || /→/.test(word);
const isDashed = ({ word }) => word.startsWith("-") || word.endsWith("-");

/**
 * 画线规则: 拆解行里不带连字符、也不是连接成分的成分都画 (前缀 pre-、后缀 -ion 不画)。
 * 只看拆解行本身, 不比对 Base; 只有一个成分且不带连字符 (没有真正拆开) 的行不画。
 * 返回与 parts 等长的数组, 画线的给 {word, meaning, kind}, 其余 null。
 */
function pickRoots(parts) {
  if (parts.length === 1 && !isDashed(parts[0])) return [null];
  return parts.map(part => (isConnector(part) || isDashed(part) || /-/.test(part.word) || !rootForms(part.word).length
    ? null : { word: part.word, meaning: part.meaning || "", kind: "root" }));
}

/** 必须按已有拆解完整拼回单词, 才能标出位置; 不靠子串搜索猜词根。 */
function alignParts(word, parts) {
  const options = parts.map(part => rootForms(part.word.split("→").pop().replace(/^-+|-+$/g, "")));
  const paths = [];
  const walk = (i, offset, spans) => {
    if (paths.length > 1) return;
    if (i === parts.length) {
      if (offset === word.length) paths.push(spans);
      return;
    }
    for (const form of options[i]) {
      if (word.toLowerCase().startsWith(form, offset)) walk(i + 1, offset + form.length, [...spans, { start: offset, end: offset + form.length }]);
    }
  };
  walk(0, 0, []);
  return paths.length === 1 ? paths[0] : null;
}

function resolveRootHints(memory, word, index) {
  const roots = [], rootRanges = [];
  if (!memory) return { roots, rootRanges };
  const { decomposition } = splitMemory(memory);
  for (const line of decomposition.split("\n")) {
    const parts = splitParts(line).map(memoryPart);
    const matched = pickRoots(parts);
    for (const root of matched.filter(Boolean)) {
      if (!roots.some(entry => entry.word === root.word && entry.meaning === root.meaning)) roots.push(root);
    }
    const spans = alignParts(word, parts);
    if (spans && !rootRanges.length && parts.length > 1) {
      // 每个成分 (词根、前缀、后缀、连接成分) 都画线, 各自一段范围; 词根的 rootIndex 指向 roots, 其余为 -1
      for (let i = 0; i < spans.length; i++) {
        const span = spans[i], root = matched[i];
        let end = span.end, next = i + 1;
        if (root) {
          const forms = rootForms(root.word);
          // hem + o 等连接成分, 仅当拼成 Base 已有的 hemo 形式时并入同色范围。
          for (let j = i + 1; j < parts.length && /连接(?:元音|字母|成分)/.test(parts[j].meaning); j++) {
            const combined = word.slice(span.start, spans[j].end).toLowerCase();
            if (!forms.some(form => form.startsWith(combined))) break;
            if (forms.includes(combined)) { end = spans[j].end; next = j + 1; }
          }
        }
        const rootIndex = root ? roots.findIndex(entry => entry.word === root.word && entry.meaning === root.meaning) : -1;
        const part = parts[i];
        const kind = /连接/.test(part.meaning || "") ? "link" : part.word.startsWith("-") ? "suffix" : part.word.endsWith("-") ? "prefix" : "root";
        rootRanges.push({ start: span.start, end, rootIndex, kind });
        i = next - 1;
      }
    }
  }
  return { roots, rootRanges };
}

module.exports = { ROOT_BASE_PATH, BASE_SOURCES, createRootIndex, resolveRootHints, pickRoots };

},
"store": function (module, exports, require) {
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

},
"settings": function (module, exports, require) {
const { PluginSettingTab, Setting } = require("obsidian");
const { AUTO_CARD_CATEGORIES } = require("./constants");

class MemoryCardsSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    this.containerEl.empty();
    new Setting(this.containerEl).setName("卡片显示").setHeading();
    new Setting(this.containerEl)
      .setName("词根提示")
      .addToggle(toggle => toggle
        .setValue(this.plugin.store.memoryHints)
        .onChange(async value => {
          this.plugin.setMemoryHints(value);
          await this.plugin.store.flush();
        }));
    for (const { key, label } of AUTO_CARD_CATEGORIES) {
      new Setting(this.containerEl).setName(label).setHeading();
      new Setting(this.containerEl)
        .setName("自动展示卡片")
        .addToggle(toggle => toggle
          .setValue(this.plugin.store.autoCardsEnabled(key))
          .onChange(async value => {
            this.plugin.store.setAutoCards(key, value);
            await this.plugin.store.flush();
          }));
    }
  }
}

module.exports = { MemoryCardsSettingTab };

},
"audio": function (module, exports, require) {
// 录音: 只播放 20. resource/<笔记路径>/audio/ 里已有的文件。缺失或损坏就跳过, 不合成语音, 不朗读释义。
// 目录清单每个卡组只列一次 (vault.adapter.list, 桌面与手机都可用), 之后的查找全在内存里。

const { AUDIO_ROOT, AUDIO_EXTENSIONS, LISTENING_CENTRAL, AUDIO_ITEM_TIMEOUT } = require("./constants");
const { slugVariants } = require("./text");

const key = (name) => name.normalize("NFC").toLowerCase();

class AudioLibrary {
  constructor(app) {
    this.app = app;
    this.listings = new Map(); // dir -> Promise<Map<小写文件名, vault 路径>>
  }

  clear() { this.listings.clear(); }

  list(dir) {
    if (!this.listings.has(dir)) this.listings.set(dir, this.readDir(dir));
    return this.listings.get(dir);
  }

  async readDir(dir) {
    const files = new Map();
    try {
      const adapter = this.app.vault.adapter;
      if (!(await adapter.exists(dir))) return files;
      for (const path of (await adapter.list(dir)).files) {
        const name = path.split("/").pop();
        if (AUDIO_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))) files.set(key(name), path);
      }
    } catch (e) { /* 读不到就当没有音频 */ }
    return files;
  }

  /** 笔记路径 → 音频目录。集中听力词块按行来源; 阅读笔记额外试去掉 (Cxx-Test x-Passage x) 的标题。 */
  directoriesFor(deckPath, card) {
    let note = deckPath;
    if (card.source) note = card.source;
    else if (LISTENING_CENTRAL.test(deckPath) && card.h1 && card.h1 !== "音义词块") note = `05. listening/${card.h1}.md`;
    const rel = note.replace(/\.md$/i, "");
    const dirs = [`${AUDIO_ROOT}/${rel}/audio`];
    if (/^(06\. reading|10\. practice\/reading)\//.test(rel)) {
      const clean = rel.replace(/\s+\([^/]*\)$/, "");
      if (clean !== rel) dirs.push(`${AUDIO_ROOT}/${clean}/audio`);
    }
    return dirs;
  }

  async find(dirs, text) {
    const slugs = slugVariants(text);
    for (const dir of dirs) {
      const files = await this.list(dir);
      if (!files.size) continue;
      for (const slug of slugs) {
        // 单词录音优先; 短语词条的录音按 chunk_ 命名, 作为后备
        const bases = [slug, `chunk_${slug}`, `cs_${slug}`];
        for (const base of bases) {
          for (const ext of AUDIO_EXTENSIONS) {
            const hit = files.get(key(base + ext));
            if (hit) return hit;
          }
        }
      }
    }
    return null;
  }

  /** 只播单词本身的录音。返回可直接给 <audio> 的资源地址, 没有录音时为空数组。 */
  async urlsFor(deckPath, card) {
    const path = await this.find(this.directoriesFor(deckPath, card), card.word);
    return path ? [this.app.vault.adapter.getResourcePath(path)] : [];
  }
}

class Player {
  constructor() {
    this.audio = null;
    this.generation = 0;
    this.abort = null;
  }

  stop() {
    this.generation++;
    if (this.abort) { this.abort(); this.abort = null; }
    this.release();
  }

  /** 去掉 src 后必须 load() 一次, 媒体元素才会真正丢掉已缓冲的数据和解码器。 */
  release() {
    const audio = this.audio;
    this.audio = null;
    if (!audio) return;
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    } catch (e) { /* 已释放 */ }
  }

  /** 依次播放; 全部结束 (坏文件跳过) 返回 true, 被 stop() 打断返回 false。 */
  async play(urls) {
    this.stop();
    const generation = this.generation;
    for (const url of urls) {
      if (generation !== this.generation) return false;
      await this.playOne(url);
    }
    return generation === this.generation;
  }

  playOne(url) {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      let timer = null;
      const finish = () => {
        clearTimeout(timer);
        audio.onended = audio.onerror = null;
        if (this.abort === finish) this.abort = null;
        if (this.audio === audio) this.release(); // 播完也释放, 不留着上一条录音
        resolve();
      };
      timer = setTimeout(finish, AUDIO_ITEM_TIMEOUT);
      audio.onended = finish;
      audio.onerror = finish;
      this.audio = audio;
      this.abort = finish;
      audio.play().catch(finish);
    });
  }
}

module.exports = { AudioLibrary, Player };

},
"ui/icons": function (module, exports, require) {
// 自绘图标: 24 网格, 线宽 1.8, 圆头圆角, 统一视觉重量。只用在控制栏、空状态和 Obsidian 入口按钮; 弹窗不放图标。
// 线条图标用 stroke, 播放/暂停等实心图标在路径上写 fill。
// icon(name) 给插件自己的界面用; registerIcons(addIcon) 注册给 Obsidian (功能区、标题栏按钮)。

const stroke = (width = 1.8) => `fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
const S = stroke();
const F = 'fill="currentColor" stroke="none"';

const ICONS = {
  // 两张错落叠放的卡片: 插件图标
  cards: `<g ${S}><rect x="4" y="7" width="12" height="14" rx="2.6"/><path d="M8.5 4.6A2.6 2.6 0 0 1 10.8 3h6.6A2.6 2.6 0 0 1 20 5.6v10.2a2.6 2.6 0 0 1-1.7 2.4"/></g>`,
  note: `<g ${S}><path d="M13.5 3H7.4A2.4 2.4 0 0 0 5 5.4v13.2A2.4 2.4 0 0 0 7.4 21h9.2a2.4 2.4 0 0 0 2.4-2.4V8.5z"/><path d="M13.5 3v3.6a1.9 1.9 0 0 0 1.9 1.9H19"/><path d="M8.8 13h6.4M8.8 16.6h4"/></g>`,
  // 三角形的视觉重心在左侧 1/3 处, 包围盒中心比按钮中心偏右 1 个单位才显得居中
  play: `<path ${F} d="M6.7 5.9v12.2c0 1.2 1.3 1.9 2.3 1.3l9.7-6.1c1-.6 1-2 0-2.6L9 4.6C8 4 6.7 4.7 6.7 5.9z"/>`,
  pause: `<g ${F}><rect x="6.2" y="5" width="4" height="14" rx="1.6"/><rect x="13.8" y="5" width="4" height="14" rx="1.6"/></g>`,
  prev: `<path ${stroke(2)} d="M14.5 5.5 8 12l6.5 6.5"/>`,
  next: `<path ${stroke(2)} d="M9.5 5.5 16 12l-6.5 6.5"/>`,
  loop: `<g ${S}><path d="M4 11.2V10a4 4 0 0 1 4-4h11"/><path d="m16 3 3 3-3 3"/><path d="M20 12.8V14a4 4 0 0 1-4 4H5"/><path d="m8 21-3-3 3-3"/></g>`,
  smart: `<g ${S}><path d="M10.5 4.5 12 9l4.5 1.5L12 12l-1.5 4.5L9 12 4.5 10.5 9 9z"/><path d="M17.5 14.5 18.3 17l2.2.8-2.2.8-.8 2.4-.8-2.4-2.2-.8 2.2-.8z"/></g>`,
  settings: `<g ${S}><circle cx="12" cy="12" r="3"/><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/></g>`,
  empty: `<g ${S}><rect x="4" y="7" width="12" height="14" rx="2.6" stroke-dasharray="2.4 2.6"/><path d="M8.5 4.6A2.6 2.6 0 0 1 10.8 3h6.6A2.6 2.6 0 0 1 20 5.6v10.2a2.6 2.6 0 0 1-1.7 2.4"/></g>`,
};

const SVG_NS = "http://www.w3.org/2000/svg";

function icon(name, cls = "") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", `mc-svg mc-svg-${name}${cls ? ` ${cls}` : ""}`);
  svg.innerHTML = ICONS[name] || "";
  return svg;
}

function setIconEl(el, name) {
  el.querySelectorAll(":scope > svg.mc-svg").forEach((s) => s.remove());
  el.prepend(icon(name));
}

/** Obsidian 的 addIcon 用 0-100 视口; 等比放大 24 网格。 */
function registerIcons(addIcon) {
  for (const name of ["cards", "note"]) {
    addIcon(`mc-${name}`, `<g transform="scale(4.1667)">${ICONS[name]}</g>`);
  }
}

module.exports = { icon, setIconEl, registerIcons, ICONS };

},
"ui/sheets": function (module, exports, require) {
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

},
"ui/sheet": function (module, exports, require) {
// 统一弹窗: 所有弹出层 (播放顺序、设置、切换卡组) 都继承 Sheet,
// 共用同一套纯文字结构: 顶部标题 + 「完成」, 下面是分组卡片 (组标题 → 行 → 组脚注)。
// 子类只实现 build(body), 状态变化后调用 refresh() 重绘。
//
// 不用 Obsidian 的 Modal: Modal 永远相对整个窗口居中。Sheet 挂在宿主元素 (卡片页的标签页内容区) 里,
// 遮罩只盖住这个标签页, 弹窗相对它居中, 分栏或缩放时跟着走; 没有宿主时退回整个窗口。

class Sheet {
  /** @param {{ title: string, host?: HTMLElement }} opts */
  constructor(app, { title, host = null }) {
    this.app = app;
    this.sheetTitle = title;
    this.host = host;
    this.isOpen = false;
    this.onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      this.close();
    };
  }

  open() {
    const host = this.host || document.body;
    if (host.mcSheet) host.mcSheet.close(); // 同一个宿主同时只开一个弹窗
    host.mcSheet = this;
    this.isOpen = true;

    this.containerEl = host.createDiv({ cls: `mc-sheet-container${this.host ? "" : " is-global"}` });
    const backdrop = this.containerEl.createDiv("mc-sheet-backdrop");
    backdrop.addEventListener("click", () => this.close());
    this.modalEl = this.containerEl.createDiv({ cls: "mc-sheet", attr: { role: "dialog", "aria-modal": "true" } });
    this.contentEl = this.modalEl;
    window.addEventListener("keydown", this.onKeyDown, true);

    const header = this.contentEl.createDiv("mc-sheet-header");
    header.createDiv({ cls: "mc-sheet-title", text: this.sheetTitle });
    const done = header.createEl("button", { cls: "mc-sheet-close", text: "完成", attr: { type: "button" } });
    done.addEventListener("click", () => this.close());

    this.body = this.contentEl.createDiv("mc-sheet-body");
    this.onOpen();
    this.refresh();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    window.removeEventListener("keydown", this.onKeyDown, true);
    const host = this.host || document.body;
    if (host.mcSheet === this) host.mcSheet = null;
    this.containerEl.remove();
    if (this.onClosed) this.onClosed();
  }

  /** 子类可覆盖: 骨架建好、第一次 build 之前调用 (比如加搜索框)。 */
  onOpen() {}

  refresh() {
    const scroll = this.body.scrollTop;
    this.body.empty();
    this.build(this.body);
    this.body.scrollTop = scroll;
  }

  build() { /* 子类实现 */ }

  // ---------- 布局积木 ----------

  /** 分组: 返回组容器, 行都加在里面。 */
  group(parent, { label = "", footnote = "" } = {}) {
    const section = parent.createDiv("mc-section");
    if (label) section.createDiv({ cls: "mc-section-label", text: label });
    const group = section.createDiv("mc-group");
    if (footnote) section.createDiv({ cls: "mc-section-footnote", text: footnote });
    return group;
  }

  /**
   * 一行: 标题 / 说明 [尾部控件]。selected 的行标题换强调色并在右侧标「当前」。
   * trailing: 控件元素 (开关等); onClick 存在时整行可点。
   */
  row(group, { title, desc = "", trailing = null, onClick = null, disabled = false, selected = false }) {
    const row = group.createDiv("mc-row");
    row.toggleClass("is-disabled", disabled);
    row.toggleClass("is-selected", selected);
    const text = row.createDiv("mc-row-text");
    text.createDiv({ cls: "mc-row-title", text: title });
    if (desc) text.createDiv({ cls: "mc-row-desc", text: desc });
    const tail = row.createDiv("mc-row-trailing");
    if (trailing) tail.appendChild(trailing);
    else if (selected) tail.createSpan({ cls: "mc-row-current", text: "当前" });
    if (onClick && !disabled) {
      row.addClass("is-clickable");
      row.setAttr("role", "button");
      row.setAttr("tabindex", "0");
      row.addEventListener("click", onClick);
      row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e); } });
    }
    return row;
  }

  /** 整块控件 (分段选择、滑杆) 直接放进组里。 */
  block(group, el) {
    const wrap = group.createDiv("mc-block");
    wrap.appendChild(el);
    return wrap;
  }
}

module.exports = { Sheet };

},
"ui/components": function (module, exports, require) {
// 可复用控件: 开关、滑杆。卡片页进度条与弹窗滑杆共用 paintRange, 拖动时填充色实时跟手。

/** 按当前值刷新滑杆填充 (--mc-fill)。input 事件与代码赋值都要调用。 */
function paintRange(input) {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 0;
  const pct = max > min ? ((Number(input.value) - min) / (max - min)) * 100 : 0;
  input.style.setProperty("--mc-fill", `${Math.min(100, Math.max(0, pct))}%`);
  return pct;
}

function toggle({ value, disabled = false, onChange }) {
  const el = createEl("button", {
    cls: "mc-switch",
    attr: { type: "button", role: "switch", "aria-checked": String(Boolean(value)) },
  });
  el.createSpan("mc-switch-knob");
  let current = Boolean(value);
  const sync = () => {
    el.toggleClass("is-on", current);
    el.setAttr("aria-checked", String(current));
  };
  sync();
  el.disabled = disabled;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    if (el.disabled) return;
    current = !current;
    sync();
    onChange(current);
  });
  return { el, set(v) { current = Boolean(v); sync(); } };
}

/** 滑杆字段: 标题 + 数值胶囊 + 滑杆 + 两端刻度。onInput 每次拖动触发, onChange 松手触发。 */
function rangeField({ title, min, max, step, value, format, onInput, onChange }) {
  const el = createDiv("mc-field");
  const head = el.createDiv("mc-field-head");
  head.createDiv({ cls: "mc-field-title", text: title });
  const pill = head.createDiv({ cls: "mc-value-pill", text: format(value) });
  const input = el.createEl("input", {
    cls: "mc-range",
    attr: { type: "range", min: String(min), max: String(max), step: String(step), value: String(value) },
  });
  const scale = el.createDiv("mc-field-scale");
  scale.createSpan({ text: format(min) });
  scale.createSpan({ text: format(max) });
  paintRange(input);
  input.addEventListener("input", () => {
    const v = Math.round(Number(input.value) / step) * step;
    paintRange(input);
    pill.setText(format(v));
    onInput && onInput(v);
  });
  input.addEventListener("change", () => onChange && onChange(Number(input.value)));
  return { el, input };
}

module.exports = { paintRange, toggle, rangeField };

},
"noteTables": function (module, exports, require) {
const { setIcon } = require("obsidian");
const { parseDeck } = require("./parse");
const { tableScopes } = require("./tableScopes");

// 单表入口挂在第一列表头, 按钮不参与编辑, 不修改笔记源码。
function registerNoteTables(plugin) {
  const contexts = new WeakMap();
  const cache = new WeakMap();
  const buttons = new Set();
  let frame = null;
  const refresh = () => {
    frame = null;
    for (const button of buttons) if (!button.isConnected) buttons.delete(button);
    for (const leaf of plugin.app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (!view.file) continue;
      const text = view.editor?.getValue();
      let cached = cache.get(view);
      if (!cached || cached.text !== text) {
        cached = { text, tables: tableScopes(parseDeck(text || '')) };
        cache.set(view, cached);
      }
      for (const table of view.contentEl.querySelectorAll('.markdown-preview-view table, .markdown-source-view table')) {
        const headers = [...(table.querySelector('thead tr, tr')?.children || [])];
        let line = null;
        try {
          if (table.closest('.markdown-source-view') && view.editor?.cm) {
            const cm = view.editor.cm;
            line = cm.state.doc.lineAt(cm.posAtDOM(table)).number - 1;
          } else {
            const ctx = contexts.get(table);
            line = ctx?.getSectionInfo(table)?.lineStart ?? null;
          }
        } catch (_) { /* 未完成挂载的表格等下一次刷新。 */ }
        const scope = line == null ? null : cached.tables.find(t => line >= t.line && line <= t.end);
        let button = table.mcStudyButton;
        if (button && !button.isConnected) { delete table.mcStudyButton; button = null; }
        if (!scope) { if (button) { button.remove(); delete table.mcStudyButton; } continue; }
        const host = headers[0];
        if (!host) continue;
        if (button && button.parentElement !== host) { button.remove(); button = null; }
        if (!button) {
          host.classList.add('mc-table-host');
          button = host.createEl('button', { cls: 'mc-table-study', attr: { type: 'button', contenteditable: 'false' } });
          setIcon(button, 'mc-cards');
          button.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); });
          button.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            plugin.openDeck(button.mcPath, leaf, button.mcKey);
          });
          table.mcStudyButton = button;
          buttons.add(button);
        }
        button.mcPath = view.file.path;
        button.mcKey = scope.key;
        const label = `学习 ${scope.label} · ${scope.count} 张`;
        if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
      }
    }
  };
  const schedule = () => { if (frame === null) frame = requestAnimationFrame(refresh); };
  plugin.registerMarkdownPostProcessor((el, ctx) => {
    el.querySelectorAll('table').forEach(table => contexts.set(table, ctx));
    schedule();
  });
  const observer = new MutationObserver(schedule);
  observer.observe(plugin.app.workspace.containerEl, { childList: true, subtree: true, characterData: true });
  plugin.registerEvent(plugin.app.workspace.on('layout-change', schedule));
  plugin.registerEvent(plugin.app.workspace.on('editor-change', schedule));
  plugin.app.workspace.onLayoutReady(schedule);
  schedule();
  plugin.register(() => {
    observer.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
    buttons.forEach(button => button.remove());
    document.querySelectorAll('.mc-table-host').forEach(el => el.classList.remove('mc-table-host'));
    document.querySelectorAll('table').forEach(table => { delete table.mcStudyButton; });
  });
}
module.exports = { registerNoteTables };

},
"tableScopes": function (module, exports, require) {
// 表格身份来自标题、首列表头与同名表顺序; 不依赖渲染出的表格数量。
function tableScopes(cards) {
  const groups = new Map();
  for (const card of cards) {
    if (!groups.has(card.tableKey)) groups.set(card.tableKey, {
      key: card.tableKey, heading: card.tableHeading, header: card.tableHeader,
      line: card.tableStart, end: card.line, count: 0,
    });
    const group = groups.get(card.tableKey);
    group.count++;
    group.end = card.line;
  }
  const tables = [...groups.values()];
  for (const table of tables) {
    const siblings = tables.filter(t => t.heading === table.heading);
    table.label = table.heading || table.header;
    if (table.heading && siblings.length > 1) table.label += ` · ${table.header}`;
    const same = siblings.filter(t => t.header === table.header);
    if (same.length > 1) table.label += ` ${same.indexOf(table) + 1}`;
  }
  return tables;
}
const scopeCards = (cards, key) => key == null ? cards : cards.filter(c => c.tableKey === key);
module.exports = { tableScopes, scopeCards };

},
"view/CardView": function (module, exports, require) {
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
      if (file.path === this.deckPath) this.reload();
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
      this.deckPath = path;
      this.tableKey = tableKey;
      this.ownWrite = null;
      this.plugin.audio.clear();
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
    this.allCards = parseDeck(data, { rootIndex: this.plugin.rootIndex });
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
    const article = /^(?:05\. listening|06\. reading|07\. writing|09\. speaking)\//.test(this.deckPath || "");
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

  render({ keepReveal = false } = {}) {
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
      requestAnimationFrame(() => { this.face.fit(); this.placeDict(); });
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
      this.render();

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

},
"delete": function (module, exports, require) {
const { parseDeck } = require("./parse");

// 重读当前表, 按同名词的出现次序定位。行号会随外部插入漂移, 不能直接拿旧行号删除。
function removeCardRow(markdown, target, expectedCards) {
  const sameWord = card => card.tableKey === target.tableKey && card.word === target.word;
  const before = expectedCards.filter(sameWord);
  const fresh = parseDeck(markdown).filter(sameWord);
  const occurrence = before.indexOf(target);
  const fields = ["meaning", "phonetic", "paired", "memory", "english", "phrase", "examples", "source"];
  // 同名行数量或内容变了就停止, 交给界面重读, 不猜要删哪一条。评分与高亮可由待写队列更新。
  if (occurrence < 0 || before.length !== fresh.length ||
      !before.every((card, i) => fields.every(key => card[key] === fresh[i][key]))) return null;
  const lines = markdown.split("\n");
  lines.splice(fresh[occurrence].line, 1);
  return lines.join("\n");
}

module.exports = { removeCardRow };

},
"progress": function (module, exports, require) {
// 序号兼容旧进度; 书签优先跟随同一表中的同一个词, 不随智能排序漂移。
function makeBookmark(session) {
  const card = session.card;
  if (!card) return null;
  const same = session.cards.filter(c => c.tableKey === card.tableKey && c.word === card.word);
  return { tableKey: card.tableKey, word: card.word, occurrence: same.indexOf(card) };
}
function restorePosition(session, bookmark, fallback = 0) {
  if (bookmark) {
    const same = session.cards.filter(c => c.tableKey === bookmark.tableKey && c.word === bookmark.word);
    const card = same[bookmark.occurrence || 0];
    const index = session.deck.indexOf(card);
    if (index >= 0) return index;
  }
  return session.clamp(fallback);
}
function progressPatch(prefs, tableKey, session) {
  // 错词小牌堆是临时练习, 不能把它的序号存成正常牌堆的进度。
  if (session.drilling || !session.card) return null;
  const bookmark = makeBookmark(session);
  if (tableKey == null) return { progress: session.index, bookmark };
  return {
    tableProgress: { ...prefs.tableProgress, [tableKey]: session.index },
    tableBookmarks: { ...prefs.tableBookmarks, [tableKey]: bookmark },
  };
}
module.exports = { makeBookmark, restorePosition, progressPatch };

},
"session": function (module, exports, require) {
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

},
"view/cardFace": function (module, exports, require) {
// 卡面: 上半区单词, 细分隔, 下半区释义。负责渲染、单词自适应字号、揭晓与分数徽章。

const { meaningHtml, englishHtml, phraseHtml, exampleWords, memoryHtml } = require("../text");

const SCORE_LINGER = 900; // 最后一次操作后停留多久再收起 (毫秒)
const LEAVE_GRACE = 500; // 离开单词后留多久再收起, 够鼠标穿过释义移到悬浮卡上 (毫秒)
const PEEK_DELAY = 0; // 鼠标停在单词上立即浮出英意与意群 (毫秒)

// 标注和单词随同一张卡片变换, 必须使用布局坐标, 避免翻页旋转影响测量。
function layoutBox(el, ancestor) {
  let left = 0, top = 0, node = el;
  while (node && node !== ancestor) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent;
  }
  return { left, top, width: el.offsetWidth, height: el.offsetHeight, bottom: top + el.offsetHeight };
}

class CardFace {
  constructor(stage) {
    // 卡片背后的一张「下一张」纸, 给牌堆一点厚度
    stage.createDiv("mc-card-under");
    this.el = stage.createDiv("mc-card");
    // 评分弹窗: 从卡片顶部弹出, 只显示分数
    this.scoreEl = this.el.createDiv("mc-score");
    this.scoreNum = this.scoreEl.createDiv("mc-score-num");
    this.scoreHint = this.scoreEl.createDiv("mc-score-hint");
    const upper = this.el.createDiv("mc-upper");
    this.wordEl = upper.createDiv("mc-word");
    this.annotationEl = upper.createDiv("mc-root-annotations");
    this.rootAnnotations = [];
    this.el.createDiv("mc-divider");
    const lower = this.el.createDiv("mc-lower");
    this.meaningEl = lower.createDiv("mc-meaning");
    this.examplesEl = this.el.createDiv("mc-examples is-hidden");
    this.exampleWordsEl = this.examplesEl.createDiv("mc-example-words");
    this.hintEl = this.el.createDiv("mc-hint");
    // 悬浮卡: 鼠标停在单词上时, 在释义下面浮出另一张卡片 (顶边贴释义底部, 三角指向释义中间),
    // 顶行单词 + 音标, 下面依次是意群、记忆、英意 (ODE 英文释义); 只认鼠标, 触屏不触发
    this.peekEl = this.el.createDiv("mc-peek");
    this.peekBody = this.peekEl.createDiv("mc-peek-body");
    const head = this.peekBody.createDiv("mc-peek-head");
    this.peekWord = head.createDiv("mc-peek-word");
    this.peekPhonetic = head.createDiv("mc-peek-phonetic");
    const section = (label, cls) => {
      const el = this.peekBody.createDiv("mc-peek-section");
      el.createDiv({ cls: "mc-peek-label", text: label });
      return { el, body: el.createDiv(cls) };
    };
    this.peekPhrase = section("意群", "mc-peek-phrase");
    this.peekExamples = section("对应单词", "mc-peek-examples mc-peek-phrase");
    this.peekMemory = section("记忆", "mc-peek-memory");
    this.peekSyn = section("同义词", "mc-peek-syn");
    this.peekEn = section("英意", "mc-peek-en");
    this.peekArrow = this.peekEl.createDiv("mc-peek-arrow");
    this.revealed = true;
    this.scoreTimer = null;
    this.peekTimer = null;
    this.hovering = false;
    this.leaveTimer = null;
    // 翻页时鼠标还停在原处: 记下鼠标位置与旧悬浮卡的位置, 新卡停稳后若鼠标仍在单词或旧悬浮卡范围内, 继续浮出
    this.pointer = null;
    this.lastDy = 0; // 最近一次垂直移动方向 (正 = 向下)
    this.resumeHover = false;
    this.resumeRect = null;
    this.resuming = false;
    this.onPointerMove = (e) => {
      if (e.pointerType !== "mouse") return;
      if (this.pointer && e.clientY !== this.pointer.y) this.lastDy = e.clientY - this.pointer.y;
      this.pointer = { x: e.clientX, y: e.clientY };
    };
    this.el.ownerDocument.addEventListener("pointermove", this.onPointerMove, true);
    // 只在鼠标停在单词本身 (.mc-word-text) 上时浮出; 单词每次换卡重建, 用事件委托
    const onWord = (t) => Boolean(t && t.closest && t.closest(".mc-word-text"));
    const inPeek = (t) => Boolean(t && this.peekEl.contains(t));
    // 回到单词或进入悬浮卡: 取消收起
    const stay = () => {
      clearTimeout(this.leaveTimer);
      this.hovering = true;
    };
    // 离开单词或悬浮卡: 默认立即收起; 只有鼠标向下移动离开时才留 LEAVE_GRACE 毫秒, 让鼠标移到下方的悬浮卡上
    const leave = (e) => {
      clearTimeout(this.leaveTimer);
      const dy = e && this.pointer ? e.clientY - this.pointer.y : 0;
      const down = dy > 0 || (dy === 0 && this.lastDy > 0);
      if (!down) {
        this.hovering = false;
        this.hidePeek();
        return;
      }
      this.leaveTimer = setTimeout(() => {
        this.hovering = false;
        this.hidePeek();
      }, LEAVE_GRACE);
    };
    this.el.addEventListener("pointerover", (e) => {
      if (e.pointerType !== "mouse" || !onWord(e.target)) return;
      const was = this.hovering;
      stay();
      if (!was) this.schedulePeek();
    });
    // 单词与悬浮卡之间隔着释义: 鼠标在释义上也算还在悬停区, 否则往下移动时卡会在半路消失
    const inMeaning = (t) => Boolean(t && this.meaningEl && this.meaningEl.contains(t));
    this.el.addEventListener("pointerover", (e) => {
      if (e.pointerType === "mouse" && inMeaning(e.target) && this.peekEl.hasClass("is-visible")) stay();
    });
    this.el.addEventListener("pointerout", (e) => {
      if (!inMeaning(e.target) || onWord(e.relatedTarget) || inMeaning(e.relatedTarget) || inPeek(e.relatedTarget)) return;
      if (this.peekEl.hasClass("is-visible")) leave(e);
    });
    this.el.addEventListener("pointerout", (e) => {
      if (!onWord(e.target) || onWord(e.relatedTarget) || inPeek(e.relatedTarget)) return;
      if (inMeaning(e.relatedTarget) && this.peekEl.hasClass("is-visible")) return;
      // 悬浮卡还没浮出时, 离开单词直接取消, 不等
      if (!this.peekEl.hasClass("is-visible")) {
        clearTimeout(this.leaveTimer);
        this.hovering = false;
        this.hidePeek();
        return;
      }
      leave(e);
    });
    this.peekEl.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") stay();
    });
    this.peekEl.addEventListener("pointerleave", (e) => {
      if (onWord(e.relatedTarget) || inMeaning(e.relatedTarget)) return;
      leave(e);
    });
    // 按下即收起: 不挡拖动翻页与轻点
    this.el.addEventListener("pointerdown", () => this.hidePeek());
  }

  get hasPeek() {
    const c = this.card;
    return Boolean(c && !c.paired && (c.english || c.phrase || c.examples || c.memory || c.synonyms));
  }

  /** 开关只控制词根标记线与旁边的词根释义, 悬浮卡片的记忆段始终显示; 保留当前词、揭晓状态与播放进度。 */
  setMemoryHints(enabled) {
    if (this.memoryHints === enabled) return;
    this.memoryHints = enabled;
    this.el.toggleClass("hide-memory-hints", !enabled);
    this.peekCard = null;
    this.hidePeek();
  }

  schedulePeek(delay = PEEK_DELAY) {
    clearTimeout(this.peekTimer);
    if (!this.hovering || !this.revealed || !this.hasPeek) return;
    this.peekTimer = setTimeout(() => {
      if (!this.hovering || !this.revealed || this.el.hasClass("is-dragging")) return;
      // 翻页动画中 (卡片滑过鼠标底下也会触发悬停) 不浮出, 等卡片停稳再判断
      if (this.el.getAnimations().length) { this.schedulePeek(delay); return; }
      if (this.resuming && !this.pointerStillOver()) {
        this.resuming = false;
        this.hovering = false;
        return;
      }
      this.resuming = false;
      // 内容在浮出这一刻才换成当前卡: 旧悬浮卡淡出途中换卡, 不会闪出新卡的内容
      if (this.peekCard !== this.card) this.renderPeek(this.card);
      this.placePeek();
      this.peekEl.addClass("is-visible");
    }, delay);
  }

  /** 翻页后判断鼠标是否还停在新单词上, 或还在翻页前悬浮卡所占的范围内。 */
  pointerStillOver() {
    const p = this.pointer;
    if (!p) return false;
    const t = this.el.ownerDocument.elementFromPoint(p.x, p.y);
    if (t && t.closest && t.closest(".mc-word-text")) return true;
    const r = this.resumeRect;
    return Boolean(r && p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom);
  }

  /**
   * 悬浮卡放在释义下面: 顶边贴释义底部, 顶部三角指向释义中间; 下方放不下 (不足 MIN_BELOW) 时
   * 改放单词上方 (底边贴单词顶部, 三角朝下)。内容超高时在悬浮卡内滚动。
   * 挂在整个卡片标签页 (.mc-view) 上而不是卡片里, 宽度不受手机卡片比例限制。
   */
  placePeek() {
    const host = this.el.closest(".mc-view") || this.el.parentElement;
    if (this.peekEl.parentElement !== host) host.appendChild(this.peekEl);
    const box = host.getBoundingClientRect();
    const ARROW = 8; // 三角高度, 与 CSS 一致
    const GAP = 4;
    const EDGE = 16; // 离标签页四边的最小距离
    const MIN_BELOW = 140;

    // 释义区可滚动: 释义底部超出可见区时以可见区底部为准
    const meaning = this.meaningEl.getBoundingClientRect();
    const lower = this.meaningEl.parentElement.getBoundingClientRect();
    const below = Math.min(meaning.bottom, lower.bottom) - box.top + ARROW + GAP;
    const roomBelow = box.height - below - EDGE;
    const above = roomBelow < MIN_BELOW;

    let anchor;
    this.peekEl.toggleClass("is-above", above);
    if (above) {
      const word = (this.wordEl.querySelector(".mc-word-text") || this.wordEl).getBoundingClientRect();
      const bottom = box.bottom - word.top + ARROW + GAP;
      this.peekEl.style.top = "";
      this.peekEl.style.bottom = `${bottom}px`;
      this.peekBody.style.maxHeight = `${Math.max(box.height - bottom - EDGE, 80)}px`;
      anchor = word;
    } else {
      this.peekEl.style.bottom = "";
      this.peekEl.style.top = `${below}px`;
      this.peekBody.style.maxHeight = `${roomBelow}px`;
      anchor = meaning;
    }

    // 宽度跟着内容走 (CSS 460–800px), 不超出标签页; 尽量以锚点中心为中线, 靠边时往里收
    const centerX = anchor.left + anchor.width / 2 - box.left;
    this.peekEl.style.left = "0px"; // 先归零再量宽, 否则上一张卡的位置会把宽度挤窄
    const width = Math.min(this.peekEl.offsetWidth, box.width - EDGE * 2);
    const left = Math.min(Math.max(centerX - width / 2, EDGE), box.width - EDGE - width);
    this.peekEl.style.left = `${left}px`;
    this.peekArrow.style.left = `${Math.min(Math.max(centerX - left, 16), width - 16)}px`;
  }

  /** 翻页开始时调用: 立刻收起并忘掉悬停, 旧卡的悬浮卡不跟着飞出动画停留。 */
  dismissPeek() {
    clearTimeout(this.leaveTimer);
    if (this.hovering) {
      this.resumeHover = true;
      if (this.peekEl.hasClass("is-visible")) this.resumeRect = this.peekEl.getBoundingClientRect();
    }
    this.hovering = false;
    // 翻页时不淡出, 直接消失
    this.peekEl.addClass("is-instant");
    this.hidePeek();
    void this.peekEl.offsetWidth;
    this.peekEl.removeClass("is-instant");
  }

  hidePeek() {
    clearTimeout(this.peekTimer);
    this.peekEl.removeClass("is-visible");
  }

  renderPeek(card) {
    this.peekCard = card;
    this.peekWord.setText(card.word);
    this.peekPhonetic.setText(card.phonetic || "");
    this.peekPhonetic.toggleClass("is-hidden", !card.phonetic);
    const fill = (sec, text, toHtml) => {
      sec.body.innerHTML = text ? toHtml(text) : "";
      sec.el.toggleClass("is-hidden", !text);
    };
    fill(this.peekPhrase, card.phrase, phraseHtml);
    fill(this.peekExamples, card.examples, phraseHtml);
    fill(this.peekMemory, card.memory, memoryHtml);
    fill(this.peekSyn, card.synonyms, englishHtml);
    fill(this.peekEn, card.english, englishHtml);
    this.peekBody.scrollTop = 0;
  }

  /** dictation: 遮住单词并藏释义; review: 只藏释义, 到点淡入。 */
  render(card, { dictation, review }) {
    this.card = card;
    this.revealed = !(dictation || review);
    this.el.toggleClass("is-paired", card.paired);
    this.el.toggleClass("is-dictation", dictation);
    this.el.toggleClass("is-concealed", !this.revealed);
    this.el.removeClass("is-hinted");
    this.scoreEl.removeClass("is-visible");

    this.wordEl.empty();
    this.annotationEl.empty();
    this.annotationEl.removeClass("is-ready");
    this.rootAnnotations = [];
    const word = this.wordEl.createSpan("mc-word-text");
    let offset = 0;
    let end = 0;
    const ranges = (card.rootRanges || []).filter(range => {
      if (["prefix", "suffix", "link"].includes(range.kind)) return false; // 只给词根画线
      const ok = range.start >= end && range.end <= card.word.length && range.end > range.start;
      if (ok) end = range.end;
      return ok;
    });
    for (const [index, range] of ranges.entries()) {
      word.appendText(card.word.slice(offset, range.start));
      const mark = word.createSpan({ cls: (index % 2 ? "mc-word-root is-overline" : "mc-word-root"), text: card.word.slice(range.start, range.end) });
      offset = range.end;
    }
    word.appendText(card.word.slice(offset));
    if (dictation) word.addClass("mc-mask");
    this.wordEl.toggleClass("is-multi", /\s/.test(card.word));

    // 英英对仗卡 (题目表达 | 原文表达) 的下半区是英文原文, 换用英文排版
    if (card.paired) this.meaningEl.setText(card.meaning);
    else this.meaningEl.innerHTML = meaningHtml(card.meaning);
    const examples = card.paired ? [] : exampleWords(card.examples || "");
    this.exampleWordsEl.empty();
    for (const text of examples) this.exampleWordsEl.createSpan({ cls: "mc-example-word", text });
    this.examplesEl.toggleClass("is-hidden", !examples.length);
    this.meaningEl.scrollTop = 0;
    this.meaningEl.parentElement.scrollTop = 0;
    this.hintEl.setText(dictation ? "轻点单词揭晓" : "轻点揭晓释义");

    // 换卡时收起, 不为新卡自动浮出: 要鼠标重新移到新单词上才出 (翻页时不打扰)
    this.dismissPeek();
    // 翻页前鼠标就停在单词 / 悬浮卡上: 保持悬停状态, 等新卡停稳后再核对鼠标位置并浮出
    if (this.resumeHover && this.hasPeek) {
      this.resumeHover = false;
      this.resuming = true;
      this.hovering = true;
      this.schedulePeek();
    } else {
      this.resumeHover = false;
      this.resuming = false;
      this.resumeRect = null;
    }
  }

  /** 单词尽量大, 放不下就缩: 单个词不折行, 多词短语最多三行。 */
  fit() {
    const el = this.wordEl;
    if (!el.isConnected || !el.clientWidth) return;
    el.style.paddingTop = "";
    el.style.paddingBottom = "";
    const multi = el.hasClass("is-multi");
    const width = this.el.clientWidth;
    let size = Math.round(Math.min(multi ? 30 : 44, width * (multi ? 0.09 : 0.13)));
    const min = 16;
    const lineHeight = multi ? 1.3 : 1.15;
    const glyphRoom = 0.72; // 与 CSS 里 .mc-word 上下 padding (0.4em + 0.32em) 一致
    el.style.fontSize = `${size}px`;
    while (size > min && (el.scrollWidth > el.clientWidth + 1 || (multi && el.scrollHeight > size * (lineHeight * 3 + glyphRoom) + 2))) {
      size -= 1;
      el.style.fontSize = `${size}px`;
    }
    this.placeRootMeanings();
  }

  /** 线只盖住词根字母的可见墨迹: 按首字母左侧、末字母右侧的实际侧边距收线, 不含字距与字形留白。 */
  fitRootLines() {
    const marks = this.wordEl.querySelectorAll(".mc-word-root");
    if (!marks.length) return;
    const doc = this.wordEl.ownerDocument;
    const ctx = doc.createElement("canvas").getContext("2d");
    for (const mark of marks) {
      const style = doc.defaultView.getComputedStyle(mark);
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      if ("letterSpacing" in ctx) ctx.letterSpacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
      const text = mark.textContent;
      const first = ctx.measureText(text[0]);
      const last = ctx.measureText(text[text.length - 1]);
      // 再向内收 3px, 让线比字母略短一点点, 两端不顶到字形边缘。
      const trim = 3;
      const left = Math.max(0, -first.actualBoundingBoxLeft) + trim;
      const right = Math.max(0, last.width - last.actualBoundingBoxRight) + trim;
      mark.style.setProperty("--mc-root-inset-l", `${left.toFixed(2)}px`);
      mark.style.setProperty("--mc-root-inset-r", `${right.toFixed(2)}px`);
    }
  }

  /** 释义贴着本词根的线, 同侧释义各占互不重叠的横向空间。 */
  placeRootMeanings() {
    this.annotationEl.removeClass("is-ready");
    this.fitRootLines();
    if (this.memoryHints === false || !this.rootAnnotations.length) return;
    const parent = this.annotationEl.offsetParent;
    const width = this.annotationEl.clientWidth;
    if (!parent || !width) return;
    let box = layoutBox(this.annotationEl, parent);
    let aboveHeight = 0, belowHeight = 0;
    for (const above of [false, true]) {
      const entries = this.rootAnnotations.filter(entry => entry.above === above)
        .map(entry => {
          const rect = layoutBox(entry.mark, parent);
          return { ...entry, center: rect.left + rect.width / 2 - box.left };
        }).sort((a, b) => a.center - b.center);
      entries.forEach((entry, i) => {
        const left = i ? (entries[i - 1].center + entry.center) / 2 + 4 : 0;
        const right = i + 1 < entries.length ? (entry.center + entries[i + 1].center) / 2 - 4 : width;
        entry.label.style.maxWidth = `${Math.max(1, Math.min(180, right - left))}px`;
        const labelWidth = entry.label.offsetWidth;
        entry.label.style.left = `${Math.max(left, Math.min(entry.center - labelWidth / 2, right - labelWidth))}px`;
        const height = entry.label.offsetHeight;
        if (above) aboveHeight = Math.max(aboveHeight, height);
        else belowHeight = Math.max(belowHeight, height);
      });
    }
    // 增加字形区留白, 让整条释义落在卡片内, 且不挤进中文释义区。
    this.wordEl.style.paddingTop = `calc(0.4em + ${aboveHeight ? aboveHeight + 8 : 0}px)`;
    this.wordEl.style.paddingBottom = `calc(0.32em + ${belowHeight ? belowHeight + 8 : 0}px)`;
    box = layoutBox(this.annotationEl, parent);
    for (const { mark, label, above } of this.rootAnnotations) {
      const rect = layoutBox(mark, parent);
      const line = mark.ownerDocument.defaultView.getComputedStyle(mark, "::after");
      const thickness = parseFloat(line.borderBottomWidth) || 5;
      const lineTop = above ? rect.top + parseFloat(line.top)
        : rect.bottom - parseFloat(line.bottom) - thickness;
      const top = above ? lineTop - 6 - label.offsetHeight : lineTop + thickness + 6;
      label.style.top = `${top - box.top}px`;
    }
    this.annotationEl.addClass("is-ready");
  }

  /** 听写但这个词没有录音: 单词照常遮着, 释义先亮出来, 看义拼词。 */
  hintMeaning() {
    if (!this.revealed) this.el.addClass("is-hinted");
  }

  isOnMask(target) {
    return Boolean(target && target.closest && target.closest(".mc-mask"));
  }

  reveal() {
    if (this.revealed) return false;
    this.revealed = true;
    this.el.removeClass("is-concealed");
    this.el.querySelectorAll(".mc-mask").forEach((m) => m.addClass("is-revealed"));
    this.schedulePeek();
    return true;
  }

  /**
   * 弹出当前分数。连续调用时弹窗不收起, 只让数字跳一下; 最后一次调用 SCORE_LINGER 毫秒后自动收起。
   * @param {{ changed?: boolean, down?: boolean, blocked?: boolean, hint?: string }} opts
   *   changed: 分数刚变过 (数字弹跳); down: 这次是减分 (绿色, 加分与单纯看分是原本的红色);
   *   blocked: 已到 0 或 5 的边界 (左右晃一下); hint: 小字说明
   */
  showScore({ changed = false, down = false, blocked = false, hint = "" } = {}) {
    if (!this.card) return;
    const score = this.card.score;
    this.scoreNum.setText(String(score));
    this.scoreHint.setText(hint);
    this.scoreHint.toggleClass("is-hidden", !hint);
    this.scoreEl.toggleClass("is-zero", score === 0);
    this.scoreEl.toggleClass("is-down", down);
    this.scoreEl.addClass("is-visible");
    const restart = (cls) => {
      this.scoreEl.removeClass(cls);
      void this.scoreEl.offsetWidth; // 重新触发动画
      this.scoreEl.addClass(cls);
    };
    if (changed) restart("is-bump");
    if (blocked) restart("is-blocked");
    clearTimeout(this.scoreTimer);
    this.scoreTimer = setTimeout(() => this.scoreEl.removeClass("is-visible", "is-bump", "is-blocked"), SCORE_LINGER);
  }

  /** 分数弹窗是否正在显示 (用于「第一下只看分」)。 */
  get scoreShown() {
    return this.scoreEl.hasClass("is-visible");
  }

  destroy() {
    clearTimeout(this.scoreTimer);
    clearTimeout(this.peekTimer);
    clearTimeout(this.leaveTimer);
    this.el.ownerDocument.removeEventListener("pointermove", this.onPointerMove, true);
    this.peekEl.remove();
  }
}

module.exports = { CardFace };

},
"view/progress": function (module, exports, require) {
// 进度条: 只有一条滑杆, 填充色实时跟手, 松手才真正跳转。不显示计数, 不做悬浮气泡。

const { paintRange } = require("../ui/components");

class ProgressBar {
  /**
   * @param {{ onScrubStart(): void, onCommit(index): void }} handlers
   */
  constructor(parent, handlers) {
    this.handlers = handlers;
    this.el = parent.createDiv("mc-progress");
    const track = this.el.createDiv("mc-progress-track");
    this.input = track.createEl("input", {
      cls: "mc-range mc-progress-range",
      attr: { type: "range", min: "0", max: "0", step: "1", value: "0" },
    });
    this.scrubbing = false;

    this.input.addEventListener("pointerdown", () => this.begin());
    this.input.addEventListener("input", () => {
      this.begin();
      paintRange(this.input);
    });
    const end = () => {
      if (!this.scrubbing) return;
      this.scrubbing = false;
      this.el.removeClass("is-scrubbing");
      this.handlers.onCommit(Number(this.input.value));
    };
    this.input.addEventListener("change", end);
    this.input.addEventListener("pointerup", () => setTimeout(end, 0));
    this.input.addEventListener("pointercancel", end);
  }

  begin() {
    if (this.scrubbing) return;
    this.scrubbing = true;
    this.el.addClass("is-scrubbing");
    this.handlers.onScrubStart();
  }

  set(index, total) {
    this.input.max = String(Math.max(total - 1, 0));
    if (!this.scrubbing) this.input.value = String(index);
    this.input.disabled = total <= 1;
    paintRange(this.input);
  }
}

module.exports = { ProgressBar };

},
"view/controls": function (module, exports, require) {
// 控制栏: [顺序] [‹] [▶/❚❚] [›] [设置], 与 Memory App 一致。
// 按钮不设 aria-label: Obsidian 会把它显示成悬浮提示, 用户不需要。

const { icon, setIconEl } = require("../ui/icons");

class ControlBar {
  /** handlers: { order(e), prev(), play(), next(), settings() } */
  constructor(parent, handlers) {
    this.el = parent.createDiv("mc-controls");
    this.orderBtn = this.button("loop", "mc-side", handlers.order);
    this.button("prev", "mc-step", handlers.prev);
    this.playBtn = this.button("play", "mc-play", handlers.play);
    this.button("next", "mc-step", handlers.next);
    this.button("settings", "mc-side", handlers.settings);
  }

  button(name, cls, onClick) {
    const btn = this.el.createEl("button", { cls: `mc-ctrl ${cls}`, attr: { type: "button" } });
    btn.appendChild(icon(name));
    btn.addEventListener("click", (e) => { e.stopPropagation(); onClick(e); });
    return btn;
  }

  setOrder(order) {
    setIconEl(this.orderBtn, order === "smart" ? "smart" : "loop");
    this.orderBtn.toggleClass("is-smart", order === "smart");
  }

  setPlaying(playing) {
    setIconEl(this.playBtn, playing ? "pause" : "play");
    this.playBtn.toggleClass("is-playing", playing);
  }
}

module.exports = { ControlBar };

},
"view/gestures": function (module, exports, require) {
// 手势: 横向拖动卡片 = 翻页 (左滑下一张, 右滑上一张), 轻点 = 揭晓 / 看分数。纵向滑动留给释义滚动。

const { MOTION } = require("../constants");

/**
 * @param {HTMLElement} stage   接收手势的区域 (卡片外起手也能翻)
 * @param {HTMLElement} card    跟手移动的卡片
 * @param {{ canStart(): boolean, onDragStart(): void, onTap(target): void, onCommit(direction, dx): void, onCancel(): void }} h
 */
function bindSwipe(stage, card, h) {
  let s = null;

  const onDown = (e) => {
    if (e.button > 0 || !h.canStart()) return;
    s = { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, dragging: false, id: e.pointerId };
  };

  const onMove = (e) => {
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.dragging) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { s = null; return; } // 纵向: 交给滚动
      if (Math.abs(dx) < 8) return;
      if (!h.canStart()) { s = null; return; } // 按下之后才开始翻页 (键盘 / 自动播放): 不再跟手
      s.dragging = true;
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* 不支持就算了 */ }
      card.addClass("is-dragging");
      h.onDragStart();
    }
    s.dx = dx;
    const p = Math.max(-1, Math.min(1, dx / (stage.clientWidth || 360)));
    card.style.transform = `perspective(900px) translateX(${dx}px) rotateY(${p * 16}deg) rotateZ(${p * 2.5}deg)`;
    e.preventDefault();
  };

  const onUp = (e) => {
    if (!s || e.pointerId !== s.id) return;
    const g = s;
    s = null;
    if (!g.dragging) {
      if (e.type === "pointerup" && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 10) h.onTap(e.target);
      return;
    }
    card.removeClass("is-dragging");
    const velocity = g.dx / Math.max(performance.now() - g.t, 1);
    const width = stage.clientWidth || 360;
    if (Math.abs(g.dx) > width * MOTION.swipeThreshold || Math.abs(velocity) > MOTION.swipeVelocity) {
      h.onCommit(g.dx < 0 ? 1 : -1, g.dx);
    } else {
      card.animate(
        [{ transform: card.style.transform }, { transform: "perspective(900px) translateX(0)" }],
        { duration: MOTION.snapBack, easing: "cubic-bezier(.2,1.3,.4,1)" },
      );
      card.style.transform = "";
      h.onCancel();
    }
  };

  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove, { passive: false });
  stage.addEventListener("pointerup", onUp);
  stage.addEventListener("pointercancel", onUp);
}

module.exports = { bindSwipe };

},
"view/autoplay": function (module, exports, require) {
// 自动播放节奏: 朗读 → 停顿 → 翻下一张。每一轮带代号, 任何打断 (手动翻页、拖动、换设置) 都让旧回调作废。

class Autoplay {
  /**
   * @param {{
   *   speak(): Promise<unknown>,        朗读当前卡 (发音关闭时立即结束)
   *   stopSpeech(): void,
   *   delayAfter(elapsed): number,      朗读用了 elapsed 秒之后还要停多久
   *   advance(): void,                  翻到下一张 (翻完会再调用 cycle)
   *   onState(on): void,
   * }} h
   */
  constructor(h) {
    this.h = h;
    this.on = false;
    this.generation = 0;
    this.timer = null;
  }

  start() {
    if (this.on) return;
    this.on = true;
    this.h.onState(true);
    this.cycle();
  }

  stop() {
    const was = this.on;
    this.on = false;
    this.interrupt();
    if (was) this.h.onState(false);
  }

  toggle() { this.on ? this.stop() : this.start(); }

  /** 打断当前这一轮但保持「正在自动播放」, 等卡片就位后再 cycle()。 */
  interrupt() {
    this.generation++;
    clearTimeout(this.timer);
    this.timer = null;
    this.h.stopSpeech();
  }

  /** 用新设置重新开始当前这一轮。 */
  restart() {
    if (!this.on) return;
    this.interrupt();
    this.cycle();
  }

  async cycle() {
    if (!this.on) return;
    const generation = ++this.generation;
    clearTimeout(this.timer);
    const started = performance.now();
    await this.h.speak();
    if (generation !== this.generation || !this.on) return;
    const delay = Math.max(this.h.delayAfter((performance.now() - started) / 1000), 0.05);
    this.timer = setTimeout(() => {
      if (generation !== this.generation || !this.on) return;
      this.h.advance();
    }, delay * 1000);
  }
}

module.exports = { Autoplay };

},
"view/dictation": function (module, exports, require) {
// 听写输入框: 放在幕布上 (卡片之外)。标签页够宽时贴在卡片右侧、与被遮住的单词同一水平线;
// 不够宽时排在卡片下面。
// 只管输入与判分结果的展示, 判分与改分由 CardView 决定。

const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 9.5v5h3.2l4.3 3.6V5.9L7.7 9.5z"/><path d="M15.6 9.2a4 4 0 0 1 0 5.6"/><path d="M18.2 6.6a7.6 7.6 0 0 1 0 10.8"/></svg>';

const GAP = 28;        // 与卡片右边缘的距离
const EDGE = 16;       // 离标签页右边缘的最小距离
const HYSTERESIS = 12; // 临界宽度附近不来回切换
const SIDE_WIDTH = 240;   // 贴在卡片右侧时的宽度, 与 CSS .mc-dict.is-side 一致

class DictationPanel {
  /**
   * @param {HTMLElement} parent
   * @param {{
   *   onSubmit(typed: string): void,   回车
   *   onReplay(): void,                再听一遍
   *   onTyping(): void,                开始输入
   *   onNav(direction: number): void,  判分后 ← / → 翻页
   *   onScore(delta: number): void,    ↑ / ↓ 看分、加减分
   * }} h
   */
  constructor(parent, h) {
    this.h = h;
    this.locked = false;   // 已判分 (拼对), 输入框只读, 回车下一张
    this.retrying = false; // 拼错了, 等着照卡片再拼对一遍
    this.el = parent.createDiv("mc-dict is-hidden");
    this.el.createDiv({ cls: "mc-dict-label", text: "听写" });
    this.field = this.el.createDiv("mc-dict-field");
    this.input = this.field.createEl("input", {
      cls: "mc-dict-input",
      attr: {
        type: "text", placeholder: "拼写单词", // 不加 aria-label: Obsidian 会把它显示成黑色悬浮提示
        autocomplete: "off", autocorrect: "off", autocapitalize: "off", spellcheck: "false", enterkeyhint: "done",
      },
    });
    this.replay = this.field.createEl("button", { cls: "mc-dict-replay", attr: { type: "button", tabindex: "-1" } });
    this.replay.innerHTML = SPEAKER;
    // 按下时不抢输入框的焦点
    this.replay.addEventListener("pointerdown", (e) => e.preventDefault());
    this.replay.addEventListener("click", () => this.h.onReplay());
    this.badge = this.field.createSpan({ cls: "mc-dict-badge", attr: { "aria-hidden": "true" } });
    this.status = this.el.createDiv({ cls: "mc-dict-status", attr: { "aria-live": "polite" } });

    this.input.addEventListener("input", () => this.h.onTyping());
    this.input.addEventListener("keydown", (e) => {
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
      let handled = true;
      if (e.key === "Enter") { if (!e.repeat) this.h.onSubmit(this.input.value); }
      else if (e.key === "ArrowUp") this.h.onScore(1);
      else if (e.key === "ArrowDown") this.h.onScore(-1);
      else if (e.key === "Tab") this.h.onReplay();
      else if (e.key === "Escape") this.input.blur();
      // 判分之后输入框只读, 左右键不再用来移动光标, 拿来翻页
      else if (this.locked && e.key === "ArrowRight") this.h.onNav(1);
      else if (this.locked && e.key === "ArrowLeft") this.h.onNav(-1);
      else handled = false;
      if (handled) { e.preventDefault(); e.stopPropagation(); }
    });
    this.reset();
  }

  get visible() { return !this.el.hasClass("is-hidden"); }

  show(on) { this.el.toggleClass("is-hidden", !on); }

  focus() { this.input.focus({ preventScroll: true }); }

  /** 新的一张卡: 清空并等待输入。 */
  reset() {
    this.locked = false;
    this.retrying = false;
    this.input.value = "";
    this.input.readOnly = false;
    this.input.placeholder = "拼写单词";
    this.el.removeClass("is-correct", "is-wrong", "is-locked", "is-shake");
    this.badge.setText("↵");
    this.status.setText("回车提交 · Tab 再听一遍");
  }

  /** 还没提交时改一下提示语 (比如这个词没有录音)。 */
  hint(note) {
    if (!this.locked && !this.retrying) this.status.setText(note);
  }

  /** 拼对: 锁住, 回车 / → 下一张。 */
  pass(note) {
    this.locked = true;
    this.retrying = false;
    this.input.readOnly = true;
    this.el.removeClass("is-wrong");
    this.el.addClass("is-locked", "is-correct");
    this.badge.setText("✓");
    this.status.setText(note);
  }

  /** 拼错: 清空, 照着揭晓的卡片再拼对一遍才能下一张 (不再计分)。 */
  retry(note) {
    this.retrying = true;
    this.input.value = "";
    this.input.placeholder = "照着再拼一遍";
    this.el.addClass("is-wrong");
    this.status.setText(note);
    this.shake();
  }

  /** 输入框左右晃一下。 */
  shake() {
    this.el.removeClass("is-shake");
    void this.el.offsetWidth; // 重新触发动画
    this.el.addClass("is-shake");
  }

  /**
   * 够宽就贴到卡片右侧 (输入框中线对齐单词), 否则留在卡片下面的文档流里。
   * 只用不受翻页动画 (transform) 影响的布局尺寸; 是否够宽按「贴右侧时卡片的宽度」估算, 两种摆法结论一致, 不会来回跳。
   */
  place({ view, root, stage, card, word }) {
    if (!this.visible || !stage.clientWidth) return;
    const el = this.el;
    const wasSide = el.hasClass("is-side");
    const flowHeight = wasSide ? 0 : el.offsetHeight + 14;
    const cardWidth = Math.min(stage.clientWidth, (stage.clientHeight + flowHeight) * 430 / 932);
    const viewBox = view.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    const centerX = stageBox.left + stageBox.width / 2;
    const room = viewBox.right - EDGE - (centerX + cardWidth / 2 + GAP + SIDE_WIDTH);
    const side = room >= (wasSide ? 0 : HYSTERESIS);
    el.toggleClass("is-side", side);
    if (!side) {
      el.style.left = "";
      el.style.top = "";
      return;
    }
    const rootBox = root.getBoundingClientRect();
    const wordCenter = stageBox.top + card.offsetTop + word.offsetTop + word.offsetHeight / 2;
    const fieldCenter = this.field.offsetTop + this.field.offsetHeight / 2;
    el.style.left = `${Math.round(centerX + card.offsetWidth / 2 + GAP - rootBox.left)}px`;
    el.style.top = `${Math.round(wordCenter - rootBox.top - fieldCenter)}px`;
  }
}

module.exports = { DictationPanel };

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

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
    let offset = 0, rootCount = 0;
    for (const range of card.rootRanges || []) {
      if (range.start < offset || range.end > card.word.length || range.end <= range.start) continue;
      word.appendText(card.word.slice(offset, range.start));
      const rootIndex = Number.isInteger(range.rootIndex) && range.rootIndex >= 0 ? range.rootIndex : 0;
      // 只给词根划线 (前缀/后缀不划); 多个词根依次下划线、上划线交替以示区分; 均不显示释义
      const entry = card.roots?.[rootIndex];
      if (entry && entry.kind !== "root") {
        word.appendText(card.word.slice(range.start, range.end));
      } else {
        const mark = word.createSpan({ cls: "mc-word-root", text: card.word.slice(range.start, range.end) });
        mark.toggleClass("is-overline", rootCount % 2 === 1);
        const hue = ((270 - rootCount * 110) % 360 + 360) % 360;
        mark.style.setProperty("--mc-root-color", `hsl(${hue} 28% 64%)`);
        rootCount++;
      }
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
    const glyphRoom = 0.56; // 与 CSS 里 .mc-word 上下 padding (0.24em + 0.32em) 一致
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
    this.wordEl.style.paddingTop = `calc(0.24em + ${aboveHeight ? aboveHeight + 8 : 0}px)`;
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

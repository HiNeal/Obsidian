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

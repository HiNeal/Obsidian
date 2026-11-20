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

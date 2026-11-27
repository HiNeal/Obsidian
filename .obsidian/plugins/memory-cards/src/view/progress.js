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

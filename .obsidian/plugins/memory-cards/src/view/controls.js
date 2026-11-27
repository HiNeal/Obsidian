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

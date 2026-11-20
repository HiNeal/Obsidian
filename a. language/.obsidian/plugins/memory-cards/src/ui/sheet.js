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

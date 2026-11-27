const { PROMOTE_CELL_SELECTOR } = require("../dom");

// 词头格右侧动作区(耳机所在)的悬浮状态。H 高亮按钮已移除: 词头高亮由评分 ≥ 1 在渲染层生成, 不再写笔记。
class PromoteMethods {
  setupPromoteButton() {
    this.lastMouse = null;
    this.registerDomEvent(document, "mousemove", (e) => {
      this.lastMouse = { x: e.clientX, y: e.clientY };
    }, true);
    // 耳机只在鼠标移到词头格右侧区域时才显示; 鼠标在词头文字一侧时不显示。
    const sync = (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (!t) return;
      this.syncActionZone(t.closest(PROMOTE_CELL_SELECTOR), e.clientX);
    };
    this.registerDomEvent(document, "mouseover", sync);
    this.registerDomEvent(document, "mousemove", sync);
  }

  // 词头格右侧按钮区域 = 格子的右内边距(耳机的地盘)。
  pointerInActionZone(td, x) {
    const rect = td.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(td).paddingRight) || 44;
    return x >= rect.right - pad;
  }

  syncActionZone(td, x) {
    if (this.zoneCell && this.zoneCell !== td) this.zoneCell.classList.remove("hd-actions-zone");
    this.zoneCell = td || null;
    if (!td) return this.hidePromote();
    const inZone = this.pointerInActionZone(td, x);
    td.classList.toggle("hd-actions-zone", inZone);
    if (inZone) this.setHoverCell(td);
    else this.hidePromote();
  }

  // 鼠标不动而内容在动(滚动、表格重绘)时浏览器不会补发 mouseover, 按鼠标最后的位置重新找它下面的单词格。
  refreshPromoteSoon() {
    if (this.unloading) return;
    cancelAnimationFrame(this.promoteRefreshFrame);
    this.promoteRefreshFrame = requestAnimationFrame(() => {
      const m = this.lastMouse;
      const stack = m ? document.elementsFromPoint(m.x, m.y) : [];
      const td = stack.map((el) => el.closest(PROMOTE_CELL_SELECTOR)).find(Boolean);
      this.syncActionZone(td || null, m ? m.x : 0);
    });
  }

  hidePromote() {
    this.setHoverCell(null);
    if (this.zoneCell) this.zoneCell.classList.remove("hd-actions-zone");
  }

  // 当前悬浮的单词格: 单词表的耳机只在这一格显示。
  setHoverCell(td) {
    if (this.hoverCell === td) return;
    if (this.hoverCell) this.hoverCell.classList.remove("hd-hover");
    this.hoverCell = td;
    if (td) td.classList.add("hd-hover");
  }
}

module.exports = { PromoteMethods };

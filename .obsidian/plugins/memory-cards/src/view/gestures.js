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

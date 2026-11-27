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

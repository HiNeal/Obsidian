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

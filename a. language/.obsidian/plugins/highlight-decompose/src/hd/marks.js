// ---- 两层词汇标记：0 基础（不标），1 高亮 ==w== ----
function splitMarks(text, preserveBold = false) {
  const metadata = text.match(/\s*<span\b[^>]*\bclass="hd-listening-source"[^>]*><\/span>\s*$/)?.[0] || "";
  if (metadata) text = text.slice(0, -metadata.length);
  let lead = text.match(/^\s*/)[0];
  let trail = text.slice(lead.length).match(/\s*$/)[0];
  let core = text.slice(lead.length, text.length - trail.length);
  const markers = new Set();
  for (;;) {
    const m = ["**", "=="].find((mk) => core.length > 4 && core.startsWith(mk) && core.endsWith(mk));
    if (!m) break;
    const inner = core.slice(2, -2);
    if (inner[0] === m[0] || inner[inner.length - 1] === m[0] || inner.includes(m)) break;
    core = inner;
    if (preserveBold && m === "**") {
      lead += m;
      trail = m + trail;
    } else markers.add(m);
  }
  return { lead, core, trail: trail + metadata, level: markers.size ? 1 : 0 };
}

function wrapLevel(core, level) {
  if (level === 1) return `==${core}==`;
  return core;
}

module.exports = { splitMarks, wrapLevel };

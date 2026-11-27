// 评分: 单词、短语及 Base 词根词缀表末尾的「评分」列, 0–5 分。≥1 的词头在渲染层高亮, 源码词头不写 ==。
// 其余笔记没有评分列, 只能看分不能打分。
// 纯文本函数, 不依赖 Obsidian, test.js 直接测; 写盘由 CardView 通过 vault.process 调用 rewriteRow。
//
// 标记规则与 highlight-decompose 的 marks.js 保持一致:
//   单词表: 整格 **word** / ==word== / **==word==** 都算高亮, 改写时统一成 ==word== 或去掉标记;
//   短语库 (03. phrase): 用户的 **加粗** 原样保留, 只增删外层 ==。

const SCORE_HEADER = "评分";
const SCORE_MAX = 5;

const clampScore = (n) => Math.min(SCORE_MAX, Math.max(0, Math.round(Number(n) || 0)));
const isPhraseLibrary = (path) => (path || "").replace(/^a\. language\//, "").startsWith("03. phrase/");

/** 与 highlight-decompose marks.js 的 splitMarks 相同。preserveBold: 短语库的 ** 是用户标记, 不算高亮。 */
function splitMarks(text, preserveBold = false) {
  // 听力集中表词头末尾可能挂着隐藏的来源标签, 它不属于词头, 必须留在 == 外面
  const metadata = text.match(/\s*<span\b[^>]*\bclass="hd-listening-source"[^>]*><\/span>\s*$/)?.[0] || "";
  if (metadata) text = text.slice(0, -metadata.length);
  let lead = text.match(/^\s*/)[0];
  let trail = text.slice(lead.length).match(/\s*$/)[0];
  let core = text.slice(lead.length, text.length - trail.length);
  let level = 0;
  for (;;) {
    const m = ["**", "=="].find((mk) => core.length > 4 && core.startsWith(mk) && core.endsWith(mk));
    if (!m) break;
    const inner = core.slice(2, -2);
    if (inner[0] === m[0] || inner[inner.length - 1] === m[0] || inner.includes(m)) break;
    core = inner;
    if (preserveBold && m === "**") { lead += m; trail = m + trail; } else level = 1;
  }
  return { lead, core, trail: trail + metadata, level };
}

/** 一行表格里每个单元格在原文中的 [start, end) 位置 (不含竖线), 跳过转义竖线 \| 。 */
function cellSpans(line) {
  const pipes = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "|" && line[i - 1] !== "\\") pipes.push(i);
  }
  const spans = [];
  for (let k = 0; k + 1 < pipes.length; k++) spans.push([pipes[k] + 1, pipes[k + 1]]);
  return spans;
}

/** 词头格只改第一行 (`word<br>/音标/` 的音标原样保留)。 */
function rewriteHead(cell, highlighted, preserveBold = false) {
  const br = cell.search(/<br\s*\/?>/i);
  const head = br < 0 ? cell : cell.slice(0, br);
  const rest = br < 0 ? "" : cell.slice(br);
  const { lead, core, trail } = splitMarks(head, preserveBold);
  return lead + (highlighted ? `==${core}==` : core) + trail + rest;
}

/**
 * 改写一行: 只改评分格, 词头不再写 == (高亮由 highlight-decompose 按评分 ≥ 1 在渲染层生成)。
 * 其余字符原样保留。
 * @returns 新行; 列数不够时返回 null (调用方据此放弃写盘)
 */
function rewriteRow(line, { scoreCol, score }) {
  const spans = cellSpans(line);
  if (scoreCol >= spans.length) return null;
  const [start, end] = spans[scoreCol];
  return line.slice(0, start) + ` ${clampScore(score)} ` + line.slice(end);
}

module.exports = { SCORE_HEADER, SCORE_MAX, clampScore, isPhraseLibrary, splitMarks, cellSpans, rewriteHead, rewriteRow };

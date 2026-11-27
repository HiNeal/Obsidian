// 只把笔记里已有的构词成分与 Base 精确匹配, 不从单词拼写或分组标题推断词根。
const { splitRow, isSeparator, isTableLine, plain, multiline, splitMemory, splitParts, memoryPart } = require("./text");

const { SCOPE_PREFIX } = require("./constants");

const ROOT_BASE_PATH = `${SCOPE_PREFIX}01. base/y.word-root.md`;
const PREFIX_BASE_PATH = `${SCOPE_PREFIX}01. base/x.word-prefix.md`;
const SUFFIX_BASE_PATH = `${SCOPE_PREFIX}01. base/z.word-suffix.md`;
const BASE_SOURCES = [
  { path: ROOT_BASE_PATH, kind: "root" },
  { path: PREFIX_BASE_PATH, kind: "prefix" },
  { path: SUFFIX_BASE_PATH, kind: "suffix" },
];

function rootForms(word) {
  const expand = form => {
    const m = form.match(/\([a-z]+\)/i);
    if (!m) return /^[a-z]+$/i.test(form) ? [form.toLowerCase()] : [];
    return ["", m[0].slice(1, -1)].flatMap(value => expand(form.slice(0, m.index) + value + form.slice(m.index + m[0].length)));
  };
  return [...new Set(word.split(/[,/]/).flatMap(form => expand(form.trim().replace(/^-+|-+$/g, ""))))];
}

/** 词根表首列表头含「词根」; 前缀/后缀文件里每张带「释义」列的表都是词缀表 (总表没有释义列, 自然跳过)。 */
function createRootIndex(markdown, kind = "root", index = new Map()) {
  const lines = markdown.split(/\r?\n/);
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) { inCode = !inCode; continue; }
    if (inCode || !isTableLine(lines[i]) || !isSeparator(lines[i + 1])) continue;
    const header = splitRow(lines[i]).map(plain);
    const meaningCol = header.indexOf("释义");
    const isRootTable = meaningCol >= 0 && (kind !== "root" || header[0].includes("词根"));
    i++;
    while (isTableLine(lines[i + 1])) {
      const cells = splitRow(lines[++i]);
      if (!isRootTable) continue;
      const word = plain(cells[0] || "");
      const meaning = multiline(cells[meaningCol] || "").replace(/\*\*|==/g, "").trim();
      if (!word || !meaning) continue;
      const root = { word, meaning, kind };
      for (const form of rootForms(word)) {
        const key = `${kind}:${form}`;
        const entries = index.get(key) || [];
        if (!entries.some(entry => entry.word === word && entry.meaning === meaning)) entries.push(root);
        index.set(key, entries);
      }
    }
  }
  return index;
}

const isConnector = ({ word, meaning }) => !word || /词:|连接/.test(meaning || "") || /→/.test(word);
const isDashed = ({ word }) => word.startsWith("-") || word.endsWith("-");

/**
 * 画线规则: 拆解行里不带连字符、也不是连接成分的成分都画 (前缀 pre-、后缀 -ion 不画)。
 * 只看拆解行本身, 不比对 Base; 只有一个成分且不带连字符 (没有真正拆开) 的行不画。
 * 返回与 parts 等长的数组, 画线的给 {word, meaning, kind}, 其余 null。
 */
function pickRoots(parts) {
  if (parts.length === 1 && !isDashed(parts[0])) return [null];
  return parts.map(part => (isConnector(part) || isDashed(part) || /-/.test(part.word) || !rootForms(part.word).length
    ? null : { word: part.word, meaning: part.meaning || "", kind: "root" }));
}

/** 必须按已有拆解完整拼回单词, 才能标出位置; 不靠子串搜索猜词根。 */
function alignParts(word, parts) {
  const options = parts.map(part => rootForms(part.word.split("→").pop().replace(/^-+|-+$/g, "")));
  const paths = [];
  const walk = (i, offset, spans) => {
    if (paths.length > 1) return;
    if (i === parts.length) {
      if (offset === word.length) paths.push(spans);
      return;
    }
    for (const form of options[i]) {
      if (word.toLowerCase().startsWith(form, offset)) walk(i + 1, offset + form.length, [...spans, { start: offset, end: offset + form.length }]);
    }
  };
  walk(0, 0, []);
  return paths.length === 1 ? paths[0] : null;
}

function resolveRootHints(memory, word, index) {
  const roots = [], rootRanges = [];
  if (!memory) return { roots, rootRanges };
  const { decomposition } = splitMemory(memory);
  for (const line of decomposition.split("\n")) {
    const parts = splitParts(line).map(memoryPart);
    const matched = pickRoots(parts);
    for (const root of matched.filter(Boolean)) {
      if (!roots.some(entry => entry.word === root.word && entry.meaning === root.meaning)) roots.push(root);
    }
    const spans = alignParts(word, parts);
    if (spans && !rootRanges.length && parts.length > 1) {
      // 每个成分 (词根、前缀、后缀、连接成分) 都画线, 各自一段范围; 词根的 rootIndex 指向 roots, 其余为 -1
      for (let i = 0; i < spans.length; i++) {
        const span = spans[i], root = matched[i];
        let end = span.end, next = i + 1;
        if (root) {
          const forms = rootForms(root.word);
          // hem + o 等连接成分, 仅当拼成 Base 已有的 hemo 形式时并入同色范围。
          for (let j = i + 1; j < parts.length && /连接(?:元音|字母|成分)/.test(parts[j].meaning); j++) {
            const combined = word.slice(span.start, spans[j].end).toLowerCase();
            if (!forms.some(form => form.startsWith(combined))) break;
            if (forms.includes(combined)) { end = spans[j].end; next = j + 1; }
          }
        }
        const rootIndex = root ? roots.findIndex(entry => entry.word === root.word && entry.meaning === root.meaning) : -1;
        const part = parts[i];
        const kind = /连接/.test(part.meaning || "") ? "link" : part.word.startsWith("-") ? "suffix" : part.word.endsWith("-") ? "prefix" : "root";
        rootRanges.push({ start: span.start, end, rootIndex, kind });
        i = next - 1;
      }
    }
  }
  return { roots, rootRanges };
}

module.exports = { ROOT_BASE_PATH, BASE_SOURCES, createRootIndex, resolveRootHints, pickRoots };

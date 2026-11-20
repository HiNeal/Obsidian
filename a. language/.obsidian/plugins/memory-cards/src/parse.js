// 笔记 → 卡片。只读 Markdown 源码, 不碰 DOM。
//
// 能上卡的表: 必须有「释义」列 (或同义改写表的「原文表达」列)。
//   单词表  | 单词 | 音标 | 释义 | 记忆 | 英意 | 意群 | 同义词 | 评分 |   (记忆用于定位词根, 其余内容在悬浮卡展示)
//   短语表  | 短语 | 释义 | 意群 |
//   语法表  | 语法词条 | 意群 | 释义 |
//   Base    | <主题> | 释义 | 例子 | 评分 |
//   同义改写 | 题目表达 | 原文表达 |       → 英英对仗卡
// 评分: 表末「评分」列 (0–5) 是唯一来源; 没有评分列的表按词头整格高亮推导 (==word== = 1, 否则 0)。

const { splitRow, isSeparator, isTableLine, stripComments, stripTags, brToNewline, plain, multiline, isPhonetic } = require("./text");
const { SCORE_HEADER, clampScore } = require("./score");
const { resolveRootHints } = require("./roots");

const headerName = (h) => plain(h).replace(/\*/g, "").trim();

function tableColumns(header) {
  const names = header.map(headerName);
  const meaning = names.indexOf("释义");
  const original = names.indexOf("原文表达");
  if (meaning < 0 && original < 0) return null;
  const word = names[0] === "意群" && names.length > 1 ? 1 : 0;
  const score = names.indexOf(SCORE_HEADER);
  // 悬浮卡片用: 英意 (旧表头「拆解」) 与意群; 意群就是词头列时不重复展示
  const english = names.findIndex((n) => n === "英意" || n === "拆解");
  const phraseCol = names.indexOf("意群");
  const phrase = phraseCol === word ? -1 : phraseCol;
  const memory = names.indexOf("记忆");
  const examples = names.indexOf("例子");
  const synonyms = names.indexOf("同义词");
  const phonetic = names.indexOf("音标"); // 独立音标列 (词头格第二行的旧写法仍可读)
  return meaning >= 0
    ? { word, meaning, score, paired: false, english, phrase, memory, examples, synonyms, phonetic }
    : { word, meaning: original, score, paired: true };
}

function parseHeadCell(raw) {
  const lines = brToNewline(stripComments(raw)).split("\n").map((l) => l.trim()).filter(Boolean);
  const bare = stripTags(lines[0] || "").trim();
  const focus = /^(\*\*)?==[^=]+==(\*\*)?$/.test(bare) || /^\*\*[^*]+\*\*$/.test(bare) ? 1 : 0;
  return {
    word: plain(lines[0] || ""),
    focus,
    phonetic: lines.slice(1).map(plain).find(isPhonetic) || "",
    source: (raw.match(/data-source="([^"]+)"/) || [])[1] || "",
  };
}

function parseMeaning(raw) {
  return multiline(raw)
    .split("\n").map((l) => l.trim())
    .filter((l) => !isPhonetic(l)) // 听力集中表把音标写在释义末尾, 卡面不显示音标
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\*\*/g, "")
    .trim();
}

/**
 * @returns {Array<{id,word,score,focus,phonetic,meaning,paired,table,memory,english,phrase,h1,source,line,wordCol,scoreCol}>}
 *   table: 所在表格的序号 (智能播放按表格隔离排序, 每张表各排各的);
 *   score: 0–5; focus: score ≥ 1 (进阶); h1: 最近的一级标题 (集中听力表定位来源文章);
 *   line: 源码行号; wordCol / scoreCol: 写回评分时定位单元格 (scoreCol = -1 表示该表没有评分列)
 */
function parseDeck(markdown, { rootIndex = null } = {}) {
  const lines = markdown.split(/\r?\n/);
  const cards = [];
  let h1 = "";
  let heading = "";
  const occurrences = new Map();
  let table = -1;
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) { inCode = !inCode; continue; }
    if (inCode) continue;
    const hm = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (hm) {
      heading = plain(hm[2]);
      if (hm[1].length === 1) {
        h1 = plain(hm[2]);
      }
      continue;
    }
    if (!isTableLine(line) || !isSeparator(lines[i + 1])) continue;
    const header = splitRow(line).map(headerName);
    const cols = tableColumns(header);
    const tableStart = i;
    const identity = JSON.stringify([heading, header[0]]);
    const occurrence = (occurrences.get(identity) || 0) + 1;
    occurrences.set(identity, occurrence);
    const tableKey = JSON.stringify([heading, header[0], occurrence]);
    table += 1;
    i += 1;
    while (isTableLine(lines[i + 1])) {
      i++;
      if (!cols) continue;
      const row = splitRow(lines[i]);
      const head = parseHeadCell(row[cols.word] || "");
      if (!head.word) continue;
      const meaningCell = row[cols.meaning] || "";
      const rawScore = cols.score >= 0 ? plain(row[cols.score] || "") : "";
      const score = /^\d+$/.test(rawScore) ? clampScore(rawScore) : head.focus;
      const memory = cols.memory >= 0 ? parseMeaning(row[cols.memory] || "") : "";
      cards.push({
        id: cards.length,
        word: head.word,
        score,
        focus: score >= 1 ? 1 : 0,
        phonetic: head.phonetic || (cols.phonetic >= 0 ? plain(row[cols.phonetic] || "").trim() : ""),
        meaning: cols.paired ? plain(meaningCell) : parseMeaning(meaningCell),
        paired: cols.paired,
        table,
        tableKey,
        tableStart,
        tableHeading: heading,
        tableHeader: header[0],
        ...(cols.paired ? { roots: [], rootRanges: [] } : resolveRootHints(memory, head.word, rootIndex)),
        memory,
        english: cols.english >= 0 ? parseMeaning(row[cols.english] || "") : "",
        synonyms: cols.synonyms >= 0 ? parseMeaning(row[cols.synonyms] || "") : "",
        phrase: cols.phrase >= 0 ? multiline(row[cols.phrase] || "").replace(/==/g, "").trim() : "",
        examples: cols.examples >= 0 ? multiline(row[cols.examples] || "").replace(/==/g, "").trim() : "",
        h1,
        source: head.source,
        line: i,
        wordCol: cols.word,
        scoreCol: cols.score,
      });
    }
  }
  return cards;
}

module.exports = { parseDeck, tableColumns };

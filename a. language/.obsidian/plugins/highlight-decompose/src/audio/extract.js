const { PLUGIN_CHROME_SELECTOR } = require("./constants");
const { getDefinitionContentRoot } = require("./dom");

function extractTargetWord(cell) {
  if (!cell) return "";
  // 从内容根克隆，而不是整个 <td>：单元格进入编辑态后，Obsidian 会在同一个 <td> 里
  // 同时留下渲染副本和可编辑副本，直接读 td 会把正文读成两遍。
  const contentRoot = getDefinitionContentRoot(cell) || cell;
  let clone = contentRoot.cloneNode ? contentRoot.cloneNode(true) : null;
  if (clone) {
    const btns = clone.querySelectorAll(PLUGIN_CHROME_SELECTOR);
    for (let i = 0; i < btns.length; i++) btns[i].remove();
  }
  let text = clone ? (clone.innerHTML || clone.textContent || "") : (contentRoot.innerHTML || contentRoot.textContent || "");
  text = text.replace(/[🎧🔊]/g, " ");
  // 开头的 <br> 只为和多行的邻格对齐，词头是第一个非空行。
  text = text.replace(/^(?:\s*<br\s*\/?>)+/i, "").split(/<br\s*\/?>/i)[0];
  text = text.replace(/&[#\w]+;/g, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.split(/[\n\r]/)[0];
  // 词头后的括注一律是词形或同义说明，不属于词头本身：
  //   "**dinghies** (单数 dinghy)" / "**cleansed** (原形 cleanse)" / "**expenses** (travel expenses)"
  // 旧实现把括号内容拼接到词头之后，生成 "dinghies dinghy" 这类根本不存在的
  // 文件名，导致这类词条的音频永远查不到。整段丢弃。
  text = text.replace(/\([^)]*\)/g, " ");
  text = text.split(/[\u4e00-\u9fa5]/)[0];
  text = text.split(/\b(n|v|adj|adv|prep|conj|pron|art|num|int|vi|vt)\.\s*/i)[0];
  text = text.replace(/[\*=_~`#]/g, "").trim();
  return text;
}

function toSlug(str) {
  if (!str) return "";
  return str
    // 先折叠重音符号，否则 é / ñ 会被后面的 [^\w\-] 整个吞掉，
    // 生成 saut / ni_o 这类既对不上原词、也无法反查的文件名。
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim()
    .replace(/[*=_~`#]/g, "")
    .replace(/['’`]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

const PHONEME_ALIASES = new Map([
  ["iː", ["iː", "i_long", "i:"]],
  ["i:", ["iː", "i_long", "i:"]],
  ["ɪ", ["ɪ", "i_short", "i"]],
  ["ʊ", ["ʊ", "u_short", "u"]],
  ["uː", ["uː", "u_long", "u:"]],
  ["u:", ["uː", "u_long", "u:"]],
  ["e", ["e"]],
  ["ə", ["ə", "schwa"]],
  ["ɜː", ["ɜː", "ɜ:", "er_long", "3:", "3_long"]],
  ["ɜ:", ["ɜː", "ɜ:", "er_long", "3:", "3_long"]],
  ["ɔː", ["ɔː", "ɔ:", "o_long"]],
  ["ɔ:", ["ɔː", "ɔ:", "o_long"]],
  ["æ", ["æ", "ae"]],
  ["ʌ", ["ʌ", "wedge", "caret"]],
  ["ɑː", ["ɑː", "ɑ:", "a_long"]],
  ["ɑ:", ["ɑː", "ɑ:", "a_long"]],
  ["ɒ", ["ɒ", "short_o"]],
  // 双元音 (8)
  ["eɪ", ["eɪ", "ei"]],
  ["ei", ["eɪ", "ei"]],
  ["aɪ", ["aɪ", "ai"]],
  ["ai", ["aɪ", "ai"]],
  ["ɔɪ", ["ɔɪ", "oi"]],
  ["oi", ["ɔɪ", "oi"]],
  ["aʊ", ["aʊ", "au"]],
  ["au", ["aʊ", "au"]],
  ["əʊ", ["əʊ", "ou", "eu"]],
  ["ou", ["əʊ", "ou", "eu"]],
  ["ʊə", ["ʊə", "uə", "ua"]],
  ["uə", ["ʊə", "uə", "ua"]],
  ["eə", ["eə", "ea", "air"]],
  ["ea", ["eə", "ea", "air"]],
  ["ɪə", ["ɪə", "iə", "ia", "ear"]],
  ["iə", ["ɪə", "iə", "ia", "ear"]],
  // 辅音
  ["p", ["p"]], ["b", ["b"]], ["t", ["t"]], ["d", ["d"]],
  ["k", ["k"]], ["g", ["g"]], ["f", ["f"]], ["v", ["v"]],
  ["s", ["s"]], ["z", ["z"]], ["m", ["m"]], ["n", ["n"]],
  ["ŋ", ["ŋ", "eng", "ng"]],
  ["h", ["h"]], ["l", ["l"]], ["ɫ", ["ɫ", "dark_l"]], ["r", ["r"]], ["w", ["w"]], ["j", ["j"]],
  ["tʃ", ["tʃ", "tch", "tf", "ch"]],
  ["tf", ["tʃ", "tch", "tf", "ch"]],
  ["dʒ", ["dʒ", "d3", "dz3", "dj"]],
  ["d3", ["dʒ", "d3", "dz3", "dj"]],
  ["θ", ["θ", "theta", "th", "th_voiceless"]],
  ["ð", ["ð", "eth", "dh", "th_voiced"]],
  ["ʃ", ["ʃ", "esh", "sh"]],
  ["ʒ", ["ʒ", "ezh", "zh", "j_voiced"]],
  ["ts", ["ts"]],
  ["dz", ["dz"]],
  ["tr", ["tr"]],
  ["dr", ["dr"]],
]);

function isKnownPhoneme(p) {
  if (!p) return false;
  const pClean = p.trim().replace(/:/g, "ː");
  return PHONEME_ALIASES.has(pClean);
}

function isPurePhonemeCell(cell) {
  if (!cell) return false;
  // 从内容根克隆，而不是整个 <td>：单元格进入编辑态后，Obsidian 会在同一个 <td> 里
  // 同时留下渲染副本和可编辑副本，直接读 td 会把正文读成两遍。
  const contentRoot = getDefinitionContentRoot(cell) || cell;
  let clone = contentRoot.cloneNode ? contentRoot.cloneNode(true) : null;
  if (clone) {
    const btns = clone.querySelectorAll(PLUGIN_CHROME_SELECTOR);
    for (let i = 0; i < btns.length; i++) btns[i].remove();
  }
  let text = clone ? (clone.innerHTML || clone.textContent || "") : (contentRoot.innerHTML || contentRoot.textContent || "");
  text = text.replace(/[🎧🔊]/g, "").trim();
  text = text.split(/<br\s*\/?>/i)[0].trim();
  text = text.replace(/&[#\w]+;/g, " ");
  text = text.replace(/<[^>]+>/g, " ");
  if (!text.trim()) return false;

  // 1. 纯音标格绝对不允许包含任何汉字（排除说明性文字与例句）
  if (/[\u4e00-\u9fa5]/.test(text)) return false;

  // 2. 去除 Markdown 粗体/斜体以及音标常见斜线与中括号
  const clean = text.replace(/[\*_~`#\[\]\/]/g, "").trim().replace(/:/g, "ː");
  if (!clean || clean.length > 8) return false;

  return isKnownPhoneme(clean);
}

function extractAllTargetPhonemes(cell, allowClusters = false) {
  if (!cell) return [];
  // 从内容根克隆，而不是整个 <td>：单元格进入编辑态后，Obsidian 会在同一个 <td> 里
  // 同时留下渲染副本和可编辑副本，直接读 td 会把正文读成两遍。
  const contentRoot = getDefinitionContentRoot(cell) || cell;
  let clone = contentRoot.cloneNode ? contentRoot.cloneNode(true) : null;
  if (clone) {
    const btns = clone.querySelectorAll(PLUGIN_CHROME_SELECTOR);
    for (let i = 0; i < btns.length; i++) btns[i].remove();
  }
  let text = clone ? (clone.innerHTML || clone.textContent || "") : (contentRoot.innerHTML || contentRoot.textContent || "");
  text = text.replace(/[🎧🔊]/g, " ");
  // 音标格开头的换行用于与邻列对齐，不是音标内容的结束。
  text = text.replace(/^(?:\s*<br\s*\/?>)+/i, "").split(/<br\s*\/?>/i)[0];
  text = text.replace(/&[#\w]+;/g, " ");
  text = text.replace(/<[^>]+>/g, " ").trim();

  const results = [];
  // 1. 优先提取所有 // 包含的音标片段: /.../
  const regex = /\/([^\/]+)\//g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const rawP = match[1].trim().replace(/:/g, "ː");
    if (isKnownPhoneme(rawP) || (allowClusters && /^[pbtdkgfvszmnŋhlrwjθðʃʒ]{2,4}$/.test(rawP))) {
      results.push(rawP);
    } else {
      const parts = rawP.split(/[\s,，、]+/).map(s => s.trim().replace(/:/g, "ː")).filter(Boolean);
      for (const part of parts) {
        if (isKnownPhoneme(part)) {
          results.push(part);
        }
      }
    }
  }

  // 2. 如果没有 /.../ 格式，尝试按换行或分隔符拆分纯文本
  if (results.length === 0) {
    const lines = text.split(/[\n\r,，、]+/).map(s => s.replace(/[\*_~`#\[\]\/]/g, "").trim().replace(/:/g, "ː")).filter(Boolean);
    for (const line of lines) {
      if (isKnownPhoneme(line)) {
        results.push(line);
      }
    }
  }

  return results;
}

function extractTargetPhoneme(cell) {
  const list = extractAllTargetPhonemes(cell);
  return list.length > 0 ? list[0] : "";
}

function extractTargetSentence(cell) {
  if (!cell) return "";
  // 从内容根克隆，而不是整个 <td>：单元格进入编辑态后，Obsidian 会在同一个 <td> 里
  // 同时留下渲染副本和可编辑副本，直接读 td 会把正文读成两遍。
  const contentRoot = getDefinitionContentRoot(cell) || cell;
  let clone = contentRoot.cloneNode ? contentRoot.cloneNode(true) : null;
  if (clone) {
    const btns = clone.querySelectorAll(PLUGIN_CHROME_SELECTOR);
    for (let i = 0; i < btns.length; i++) btns[i].remove();
  }
  let text = clone ? (clone.innerHTML || clone.textContent || "") : (contentRoot.innerHTML || contentRoot.textContent || "");
  text = text.replace(/[🎧🔊]/g, " ");
  // 阅读笔记的短语格以 <br> 开头（`<br>例句<br>(判断题)<br>`），取第一段非空内容，
  // 否则读到空串，耳机只念短语、不接短语原声。
  const segments = text.split(/<br\s*\/?>/i);
  text = segments.find((seg) => seg.replace(/<[^>]+>|&[#\w]+;/g, "").trim()) || "";
  text = text.replace(/&[#\w]+;/g, " ");
  // Inline emphasis can split a hyphenated word; removing it must not add spaces.
  text = text.replace(/<\/?(?:strong|b|em|i|mark|span|s|del|code)\b[^>]*>/gi, "");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/[*_~`#]/g, " ");
  text = text.replace(/[\u4e00-\u9fa5]/g, " ");
  text = text.replace(/^[.\s]+|[.\s]+$/g, "");
  text = text.replace(/\s+/g, " ");
  return text.trim();
}

module.exports = { extractTargetWord, toSlug, PHONEME_ALIASES, isKnownPhoneme, isPurePhonemeCell, extractAllTargetPhonemes, extractTargetPhoneme, extractTargetSentence };

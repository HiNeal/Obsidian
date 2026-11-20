const { AUDIO_COLUMN_TYPES, DEFAULT_AUDIO_COLUMNS, DEFAULT_EXCLUDE_RULES } = require("./constants");
const { invalidateAudioFileIndex } = require("./lookup");

const DEFAULT_SETTINGS = {
  // --- 表格识别 ---
  audioColumns: JSON.parse(JSON.stringify(DEFAULT_AUDIO_COLUMNS)),
  excludePathKeywords: [...DEFAULT_EXCLUDE_RULES.pathKeywords],
  excludeHeaderKeywords: [...DEFAULT_EXCLUDE_RULES.headerKeywords],
  excludeColumnKeywords: [...DEFAULT_EXCLUDE_RULES.columnExcludeKeywords],

  // --- 音频匹配 ---
  // 严格模式只认「文章级同名目录内的精确匹配」，命中不了直接报缺失，
  // 不做跨文章的全库模糊回退（对应知识库「不得跨文章回退读取同名音频」的约定）。

  // --- 高亮显示 ---
  showListeningHighlights: false,
  showReadingHighlights: false,
  showListeningQuestionHighlights: false,
  showReadingQuestionHighlights: false,
  // 听说读写各自的开关: 读听隐藏已收录词, 写说隐藏全部正文高亮; 不隐藏 ==, 卡片与朗读照常。
  hideReadingArticleHighlights: false,
  hideListeningArticleHighlights: false,
  hideWritingArticleHighlights: false,
  hideSpeakingArticleHighlights: false,

  // --- 悬停朗读 ---
  listeningHoverAudio: true,
  readingHoverAudio: false,
  writingHoverAudio: false,
  speakingHoverAudio: false,

  // --- 播放 ---
  playbackRate: 1,
  phonemeGapMs: 300,

  updateDebounceMs: 32,
};

let runtimeSettings = { ...DEFAULT_SETTINGS };

let audioColumnLookup = buildAudioColumnLookup(DEFAULT_SETTINGS.audioColumns);

// 配置按类型分组便于阅读，运行时按列名查找，因此建一份反向索引。
function buildAudioColumnLookup(grouped) {
  const lookup = new Map();
  for (const type of Object.keys(grouped || {})) {
    for (const name of grouped[type] || []) lookup.set(name, type);
  }
  return lookup;
}

function getSettings() {
  return runtimeSettings;
}

function applyRuntimeSettings(next) {
  runtimeSettings = next;
  audioColumnLookup = buildAudioColumnLookup(next.audioColumns);
  invalidateAudioFileIndex();
}

// --- 设置面板用的文本序列化助手 ---------------------------------------
function parseListText(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function serializeListText(list) {
  return (list || []).join("\n");
}

// 逗号分隔的一行列表，用于列名、关键词这类短条目。
function parseCsvList(text) {
  return String(text || "")
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function serializeCsvList(list) {
  return (list || []).join(", ");
}

// 「类型: 名称1, 名称2」逐行分组
function parseGroupedText(text) {
  const grouped = {};
  for (const line of parseListText(text)) {
    const at = line.indexOf(":");
    if (at === -1) continue;
    const type = line.slice(0, at).trim();
    if (!AUDIO_COLUMN_TYPES.includes(type)) continue;
    grouped[type] = parseCsvList(line.slice(at + 1));
  }
  return grouped;
}

function serializeGroupedText(grouped) {
  return AUDIO_COLUMN_TYPES
    .filter((type) => (grouped || {})[type] && grouped[type].length)
    .map((type) => `${type}: ${serializeCsvList(grouped[type])}`)
    .join("\n");
}

function getAudioColumnLookup() {
  return audioColumnLookup;
}

module.exports = { DEFAULT_SETTINGS, buildAudioColumnLookup, getSettings, applyRuntimeSettings, parseListText, serializeListText, parseCsvList, serializeCsvList, parseGroupedText, serializeGroupedText, getAudioColumnLookup };

// 插件入口：只负责组装。hd/ 是悬浮拆解，audio/ 是耳机点读，两边互不引用，
// 仅由 hd/plugin.js 把 audio 作为子组件挂载。
const HighlightDecomposePlugin = require("./hd/plugin");
const TableSoundPlugin = require("./audio/plugin");
const audioSettings = require("./audio/settings");
const audioConstants = require("./audio/constants");
const audioDom = require("./audio/dom");
const audioExtract = require("./audio/extract");
const reading = require("./hd/reading");
const library = require("./hd/library");
const columns = require("./hd/columns");
const tables = require("./hd/tables");
const dom = require("./hd/dom");
const marks = require("./hd/marks");

module.exports = HighlightDecomposePlugin;
module.exports.TableSound = TableSoundPlugin;
// 供 test.js 访问的纯函数（不依赖 Obsidian 运行时）。
module.exports.__test__ = {
  pairChunkColumnWithWord: audioDom.pairChunkColumnWithWord,
  extractTargetWord: audioExtract.extractTargetWord,
  toSlug: audioExtract.toSlug,
  parseListText: audioSettings.parseListText,
  serializeListText: audioSettings.serializeListText,
  parseCsvList: audioSettings.parseCsvList,
  serializeCsvList: audioSettings.serializeCsvList,
  parseGroupedText: audioSettings.parseGroupedText,
  serializeGroupedText: audioSettings.serializeGroupedText,
  AUDIO_COLUMN_TYPES: audioConstants.AUDIO_COLUMN_TYPES,
  VAULT_PREFIX: audioConstants.VAULT_PREFIX,
  AUDIO_ROOT: audioConstants.AUDIO_ROOT,
  DEFAULT_SETTINGS: audioSettings.DEFAULT_SETTINGS,
  readingNotePath: reading.readingNotePath,
  senseContext: reading.senseContext,
  chunkMatchesContext: reading.chunkMatchesContext,
  appendMeaningInline: reading.appendMeaningInline,
  sourceHighlights: reading.sourceHighlights,
  nearestSense: reading.nearestSense,
  bindReadingSenses: reading.bindReadingSenses,
  highlightReadingSense: reading.highlightReadingSense,
  readingSenseMatches: reading.readingSenseMatches,
  parseSenseId: reading.parseSenseId,
  parseEnglishSenseId: reading.parseEnglishSenseId,
  englishSenseTarget: reading.englishSenseTarget,
  parseTables: library.parseTables,
  libraryKind: library.libraryKind,
  candidates: library.candidates,
  listeningNotePath: library.listeningNotePath,
  listeningMetadata: library.listeningMetadata,
  definitionOnly: columns.definitionOnly,
  markTable: tables.markTable,
  contextCardColumn: tables.contextCardColumn,
  cellMarkdown: dom.cellMarkdown,
  hoverElement: dom.hoverElement,
  splitMarks: marks.splitMarks,
};

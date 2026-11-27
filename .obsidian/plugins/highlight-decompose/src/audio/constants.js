const WORD_COL_CLASS = "td-word-col";

const HEADPHONES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>`;

// 1. 白名单表头配置 (严格精准匹配，仅当表头完全匹配下列名称时才挂载对应类型音频)
// 音频列白名单：类型是固定的有限集合，因此按「类型 → 列名数组」组织，
// 而不是让 44 个列名各写一行等号。
const AUDIO_COLUMN_TYPES = ["auto", "word", "chunk", "phoneme", "phonetic", "sentence"];

const DEFAULT_AUDIO_COLUMNS = {
  // 自适应：无论填音标、单词还是句子都自动识别
  auto: ["音频", "读音", "朗读", "播放", "发音", "Audio", "audio"],
  // 单词单字标准发音
  word: ["单词", "音义词块", "单词短语", "词块", "原声词块", "核心表达",
         "核心词", "词汇", "生词", "答案", "答案词", "Word", "word"],
  // 听力短语切片
  chunk: ["短语", "意群", "听力短语", "语块", "Chunk", "chunk"],
  // 音标与辅音发音
  phoneme: ["清音", "浊音", "清辅音", "浊辅音"],
  phonetic: ["音标", "Phonetic", "phonetic"],
  // 整句原声
  sentence: ["原句", "句子", "例句", "整句", "Sentence", "sentence"],
};

// 2. 排除黑名单配置 (命中的路径或表头坚决不挂载耳机)
const DEFAULT_EXCLUDE_RULES = {
  pathKeywords: [],

  // 表头黑名单：只要表格包含以下列名，整表判定为纯文本分析，不挂载耳机
  headerKeywords: [
    "同义改写",
    "改写机制",
  ],

  // 解释说明列黑名单：包含这些关键词的列，坚决不挂载耳机
  columnExcludeKeywords: [
    "技巧",
    "要领",
    "方法",
    "说明",
    "解释",
    "规则",
    "接触面",
    "器官",
    "动作",
    "滑动",
    "起点",
    "释义",
    "拆解",
    "英意",
    "备注",
  ],
};

// 插件自己插进单元格的节点。任何「读正文」或「清理插件痕迹」的地方都用这一份，
// 漏掉一个就会让指纹或变更检测把自家节点当成正文。
const PLUGIN_CHROME_SELECTOR = ".audio-playback-btn";

const PLUGIN_OWNED_SELECTOR = PLUGIN_CHROME_SELECTOR;

// ==================== 库结构常量 ====================
// 这三个值描述的是「库的形状」，不是用户偏好：只有重构整个目录结构时才会变，
// 而那种改动本来就要连带改代码。暴露成可编辑设置反而是脚枪——
// 前缀少个斜杠就整条音频链路静默失效，面板不会给任何提示。
const VAULT_PREFIX = "a. language/";            // 笔记所在的库内子目录（含结尾斜杠）

const AUDIO_ROOT = "20. resource";              // 资源根目录：<根>/<笔记路径>/audio/ 与笔记路径 1:1 镜像
const AUDIO_SUBDIR = "audio";                   // 笔记文件夹内的音频类型子目录

// ==================== 正在播放高亮的抗重渲染定位 ====================
// Live Preview / 阅读视图会在编辑、滚动时整块重建表格 DOM。
// 只握着 <td> 节点引用的话，重建后手里的引用变成游离节点，
// 浅绿色的「正在播放」高亮就凭空消失（音频还在响）。
// 因此额外记一份「内容根 + 表格序号 + 行号 + 列号 + 文本指纹」的坐标，
// 重建后据此找回新节点并把高亮补回去。
const PLAYING_CELL_CLASS = "audio-is-playing";

const PAUSED_CELL_CLASS = "audio-is-paused";

module.exports = { WORD_COL_CLASS, HEADPHONES_SVG, AUDIO_COLUMN_TYPES, DEFAULT_AUDIO_COLUMNS, DEFAULT_EXCLUDE_RULES, PLUGIN_CHROME_SELECTOR, PLUGIN_OWNED_SELECTOR, VAULT_PREFIX, AUDIO_ROOT, AUDIO_SUBDIR, PLAYING_CELL_CLASS, PAUSED_CELL_CLASS };

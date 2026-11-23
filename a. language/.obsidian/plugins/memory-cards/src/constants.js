// 全插件共用的常量。改默认值只改这里。

const VIEW_TYPE = "memory-cards-view";

// 音频与笔记 1:1 镜像: 20. resource/<笔记路径去 .md>/audio/
const AUDIO_ROOT = "20. resource";
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a"];

// 卡组候选范围 (切换卡组列表与笔记标题栏按钮只在这些模块出现)
const DECK_ROOTS = ["01. base/", "02. word/", "03. phrase/", "04. grammer/", "05. listening/", "06. reading/", "07. writing/", "09. speaking/", "10. practice/"];

// 打开这些模块里的笔记时默认直接展示成卡片 (笔记里有能上卡的表才切)
const AUTO_CARD_CATEGORIES = [
  { key: "word", label: "单词", roots: ["02. word/", "03. phrase/"] },
  { key: "listening", label: "听力", roots: ["05. listening/"] },
  { key: "reading", label: "阅读", roots: ["06. reading/"] },
  { key: "writing", label: "写作", roots: ["07. writing/"] },
  { key: "speaking", label: "口语", roots: ["09. speaking/"] },
];

// 集中听力词块: 每行的音频在来源文章的镜像目录里, 来源 = 表格上方的一级标题
const LISTENING_CENTRAL = /(?:^|\/)02\. word\/m\. 剑雅听力真题\/音义词块\.md$/i;

// 每个卡组独立保存的学习偏好, 与 Memory App 的 MTAutoplaySettings 默认值一致
const DEFAULT_PREFS = Object.freeze({
  interval: 2.3,       // 读完后停顿 (秒)
  revealDelay: 0.3,    // 复习模式释义渐显延迟 (秒)
  order: "smart",      // loop 循环播放 | smart 智能播放 (默认智能)
  focus: false,        // 进阶模式, 默认关闭; 卡组没有进阶词时自动忽略
  dictation: false,
  review: false,
  progress: 0,
});

const LIMITS = Object.freeze({
  interval: { min: 0, max: 6, step: 0.1 },
  revealDelay: { min: 0.3, max: 3, step: 0.1 },
});

const RECENT_LIMIT = 6;

// 动效时长 (毫秒)。系统开启「减弱动态效果」时全部缩短。
const MOTION = Object.freeze({
  outTap: 110,
  outSwipe: 90,
  in: 200,
  snapBack: 220,
  swipeThreshold: 0.22, // 拖过舞台宽度的比例即翻页
  swipeVelocity: 0.5,   // px/ms
});

// 单条录音的安全超时, 防止某条坏音频把自动播放卡死
const AUDIO_ITEM_TIMEOUT = 15000;

module.exports = {
  VIEW_TYPE, AUDIO_ROOT, AUDIO_EXTENSIONS, DECK_ROOTS, AUTO_CARD_CATEGORIES, LISTENING_CENTRAL,
  DEFAULT_PREFS, LIMITS, RECENT_LIMIT, MOTION, AUDIO_ITEM_TIMEOUT,
};

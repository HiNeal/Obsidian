const { AUDIO_COLUMN_TYPES } = require("../constants");
const { DEFAULT_SETTINGS, applyRuntimeSettings } = require("../settings");

class SettingsStoreMethods {
  // ==================== 设置读写 ====================
  async loadSettings() {
    const stored = (await this.loadData()) || {};
    const merged = { ...DEFAULT_SETTINGS, ...stored };
    // 迁移: 旧的统一开关拆成阅读、听力两个开关。
    if (typeof stored.hideArticleHighlights === "boolean") {
      if (!("hideReadingArticleHighlights" in stored)) merged.hideReadingArticleHighlights = stored.hideArticleHighlights;
      if (!("hideListeningArticleHighlights" in stored)) merged.hideListeningArticleHighlights = stored.hideArticleHighlights;
      delete merged.hideArticleHighlights;
    }

    // 迁移：旧版把列名配置存成扁平的「列名 -> 类型」，现按「类型 -> 列名数组」组织。
    if (merged.audioColumns && typeof merged.audioColumns === "object") {
      const values = Object.values(merged.audioColumns);
      if (values.length && values.every((value) => typeof value === "string")) {
        const grouped = {};
        for (const [name, type] of Object.entries(merged.audioColumns)) {
          if (!AUDIO_COLUMN_TYPES.includes(type)) continue;
          (grouped[type] = grouped[type] || []).push(name);
        }
        merged.audioColumns = grouped;
      }
    }
    // 迁移：旧结构回退映射已整体移除，音频一律走 1:1 新结构，陈旧键直接丢弃。
    delete merged.articleAudioRoots;
    delete merged.legacyAudioRoots;
    // 迁移：三个库结构路径已固化为代码常量，不再作为可编辑设置。
    // 迁移：文章级隔离已成结构性事实，跨文章模糊回退整段移除，两个开关随之作废。
    delete merged.strictAudioMatch;
    delete merged.logMatchTier;
    delete merged.vaultPrefix;
    delete merged.audioRoot;
    delete merged.listeningPathPrefix;

    // 迁移：释义遮罩整体移除（改由 highlight-decompose 的悬浮卡片显示释义），丢弃全部遮罩配置。
    for (const key of ["maskColumns", "maskGap", "maskGapX", "maskGapBottom", "maskModes",
                       "maskAllVisibleLeaves", "revealMode"]) {
      delete merged[key];
    }

    // 旧版支持按列连续播放；现已改为只播放当前单元格，丢弃条目间隔。
    delete merged.clipGapMs;

    // 形状校验，避免旧版或手改过的 data.json 让插件崩掉。
    // 迁移：「单词表第二列」与「展示释义」开关均已移除。
    delete merged.secondColumn;
    delete merged.showMeaning;
    if (!merged.audioColumns || typeof merged.audioColumns !== "object") {
      merged.audioColumns = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.audioColumns));
    }
    for (const type of AUDIO_COLUMN_TYPES) {
      if (!Array.isArray(merged.audioColumns[type])) merged.audioColumns[type] = [];
    }
    for (const key of ["excludePathKeywords", "excludeHeaderKeywords",
                       "excludeColumnKeywords"]) {
      if (!Array.isArray(merged[key])) merged[key] = DEFAULT_SETTINGS[key];
    }
    for (const key of ["listeningHoverAudio", "readingHoverAudio", "writingHoverAudio", "speakingHoverAudio",
                       "hideListeningArticleHighlights", "hideReadingArticleHighlights",
                       "hideWritingArticleHighlights", "hideSpeakingArticleHighlights",
                       "showListeningHighlights", "showReadingHighlights",
                       "showListeningQuestionHighlights", "showReadingQuestionHighlights"]) {
      if (typeof merged[key] !== "boolean") merged[key] = DEFAULT_SETTINGS[key];
    }
    this.settings = merged;
    applyRuntimeSettings(merged);
    // Initial loading is asynchronous; update views that mounted before it finished.
    this.app.workspace.trigger("highlight-decompose:settings");
  }

  async saveSettings() {
    await this.saveData(this.settings);
    applyRuntimeSettings(this.settings);
    this.app.workspace.trigger("highlight-decompose:settings");
    this.requestUpdate(true);
  }
}

module.exports = { SettingsStoreMethods };

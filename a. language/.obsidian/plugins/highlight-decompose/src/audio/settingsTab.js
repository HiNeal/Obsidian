const { PluginSettingTab, Setting, Notice } = require("obsidian");
const { DEFAULT_SETTINGS } = require("./settings");

class TableSoundSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    const settings = this.plugin.settings;
    const save = async () => this.plugin.saveSettings();
    containerEl.empty();

    // ---------- 音频 ----------
    // ---------- 听力 ----------
    new Setting(containerEl).setName("听力").setHeading();




    new Setting(containerEl)
      .setName("悬停朗读")
      .addToggle((toggle) => toggle.setValue(settings.listeningHoverAudio).onChange(async (value) => {
        settings.listeningHoverAudio = value;
        await save();
      }));

    new Setting(containerEl)
      .setName("隐藏原文高亮")
      .addToggle((toggle) => toggle.setValue(Boolean(settings.hideListeningArticleHighlights)).onChange(async (value) => {
        settings.hideListeningArticleHighlights = value;
        await save();
      }));

    // ---------- 阅读 ----------
    new Setting(containerEl).setName("阅读").setHeading();




    new Setting(containerEl)
      .setName("悬停朗读")
      .addToggle((toggle) => toggle.setValue(settings.readingHoverAudio).onChange(async (value) => {
        settings.readingHoverAudio = value;
        await save();
      }));

    new Setting(containerEl)
      .setName("隐藏原文高亮")
      .addToggle((toggle) => toggle.setValue(Boolean(settings.hideReadingArticleHighlights)).onChange(async (value) => {
        settings.hideReadingArticleHighlights = value;
        await save();
      }));

    for (const [label, kind] of [["写作", "Writing"], ["口语", "Speaking"]]) {
      new Setting(containerEl).setName(label).setHeading();
      const audioKey = `${kind.toLowerCase()}HoverAudio`;
      const highlightKey = `hide${kind}ArticleHighlights`;
      new Setting(containerEl)
        .setName("悬停朗读")
        .addToggle(toggle => toggle.setValue(settings[audioKey]).onChange(async value => {
          settings[audioKey] = value;
          await save();
        }));
      new Setting(containerEl)
        .setName("隐藏原文高亮")
        .addToggle(toggle => toggle.setValue(settings[highlightKey]).onChange(async value => {
          settings[highlightKey] = value;
          await save();
        }));
    }

    new Setting(containerEl).setName("音频").setHeading();

    new Setting(containerEl)
      .setName("播放速度")
      .addSlider((slider) =>
        slider
          .setLimits(0.5, 1.5, 0.05)
          .setValue(settings.playbackRate)
          .setDynamicTooltip()
          .onChange(async (value) => {
            settings.playbackRate = value;
            await save();
          })
      );

    // ---------- 恢复默认 ----------
    new Setting(containerEl)
      .setName("恢复默认设置")
      .addButton((button) =>
        button
          .setButtonText("恢复默认")
          .setWarning()
          .onClick(async () => {
            this.plugin.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            await save();
            this.display();
            new Notice("已恢复默认设置", 2000);
          })
      );
  }
}

module.exports = { TableSoundSettingTab };

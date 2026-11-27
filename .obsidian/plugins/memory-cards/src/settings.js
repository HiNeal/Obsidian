const { PluginSettingTab, Setting } = require("obsidian");
const { AUTO_CARD_CATEGORIES } = require("./constants");

class MemoryCardsSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    this.containerEl.empty();
    new Setting(this.containerEl).setName("卡片显示").setHeading();
    new Setting(this.containerEl)
      .setName("词根提示")
      .addToggle(toggle => toggle
        .setValue(this.plugin.store.memoryHints)
        .onChange(async value => {
          this.plugin.setMemoryHints(value);
          await this.plugin.store.flush();
        }));
    for (const { key, label } of AUTO_CARD_CATEGORIES) {
      new Setting(this.containerEl).setName(label).setHeading();
      new Setting(this.containerEl)
        .setName("自动展示卡片")
        .addToggle(toggle => toggle
          .setValue(this.plugin.store.autoCardsEnabled(key))
          .onChange(async value => {
            this.plugin.store.setAutoCards(key, value);
            await this.plugin.store.flush();
          }));
    }
  }
}

module.exports = { MemoryCardsSettingTab };

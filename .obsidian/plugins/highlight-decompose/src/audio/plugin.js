// 耳机点读（原 table-sound 插件，2026-10-05 并入）：作为 hd 插件的子组件加载（addChild），设置存在同一份 data.json。
const { Plugin } = require("obsidian");
const { installMixins } = require("../mixin");
const { collectChangedTables, mutationHasExternalDomChange } = require("./dom");
const { invalidateAudioFileIndex } = require("./lookup");
const { getSettings } = require("./settings");
const { TableSoundSettingTab } = require("./settingsTab");
const { RuleMethods } = require("./features/rules");
const { PlaybackMethods } = require("./features/playback");
const { ResolveMethods } = require("./features/resolve");
const { TableMethods } = require("./features/tables");
const { SettingsStoreMethods } = require("./features/settingsStore");

class TableSoundPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new TableSoundSettingTab(this.app, this));

    this.scheduled = false;
    this.debounceTimer = null;
    this.viewObservers = new Map();
    this.pendingTables = new Set();
    this.pendingAudioTables = new Set();
    this.pendingFullUpdate = false;
    this.audioBindingFrame = null;
    this.updateFrame = null;

    this.queueAudioBinding = (table) => {
      this.pendingAudioTables.add(table);
      if (this.audioBindingFrame !== null) return;
      // 耳机按钮推迟到下一帧补，不和表格首帧绘制争抢。
      this.audioBindingFrame = requestAnimationFrame(() => {
        this.audioBindingFrame = null;
        const contexts = this.getManagedContexts();
        const tables = Array.from(this.pendingAudioTables);
        this.pendingAudioTables.clear();
        for (const pendingTable of tables) {
          const matchedCtx = contexts.find((ctx) => ctx.root.contains(pendingTable));
          if (matchedCtx) {
            this.bindAudioButtons(pendingTable, matchedCtx);
          }
        }
      });
    };

    this.runScheduledUpdate = () => {
      const tables = this.pendingFullUpdate ? null : Array.from(this.pendingTables);
      this.pendingTables.clear();
      this.pendingFullUpdate = false;
      try {
        this.updateManagedTables(tables);
      } catch (err) {
        console.error("[TableSound] Table update error:", err);
      } finally {
        // DOM 变动异常时也必须释放调度锁，否则后续 Live Preview 更新会永久停滞。
        this.scheduled = false;
      }
    };

    // Register exclusive audio playback state.
    this.currentPlayingAudio = null;
    this.currentPlayingCell = null;
    this.playingCellDescriptor = null;
    this.playingCellToken = 0;
    this.isPaused = false;
    this.pauseWaiters = [];
    this.currentBlobUrl = null;
    this.currentPlayRequest = null;
    this.currentPlaybackResolve = null;

    this.addCommand({
      id: "toggle-playback-pause",
      name: "暂停 / 继续当前播放",
      callback: () => this.togglePlaybackPause(),
    });

    this.addCommand({
      id: "report-missing-audio",
      name: "体检：列出当前笔记缺失音频的单元格",
      callback: () => this.reportMissingAudio(),
    });

    // 按 Escape 键停止当前正在播放的音频
    this.registerDomEvent(window, "keydown", (e) => {
      if (e.key === "Escape") {
        if (this.currentPlayingAudio || this.currentPlayRequest) {
          this.stopCurrentAudio();
        }
      }
    });

    // Debounce table processing while Markdown views update.
    this.requestUpdate = (immediate = false, tables = null) => {
      if (tables === null) {
        this.pendingFullUpdate = true;
        this.pendingTables.clear();
      } else if (!this.pendingFullUpdate) {
        for (const table of tables) this.pendingTables.add(table);
      }
      if (immediate) {
        if (!this.scheduled) {
          this.scheduled = true;
          this.updateFrame = requestAnimationFrame(() => {
            this.updateFrame = null;
            this.runScheduledUpdate();
          });
        }
        return;
      }

      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        if (!this.scheduled) {
          this.scheduled = true;
          this.updateFrame = requestAnimationFrame(() => {
            this.updateFrame = null;
            this.runScheduledUpdate();
          });
        }
      }, getSettings().updateDebounceMs);
    };

    // 为每个当前可见的 Markdown 视图各挂一个观察者。
    // 旧实现只认 .workspace-leaf.mod-active，分屏时未聚焦的那一栏
    // 从不更新，新开的第二栏在点进去之前答案是露着的。
    this.syncViewObservers = () => {
      const roots = new Set(this.getManagedContexts().map((ctx) => ctx.root));

      for (const [root, observer] of this.viewObservers) {
        if (roots.has(root)) continue;
        observer.disconnect();
        this.viewObservers.delete(root);
      }

      for (const root of roots) {
        if (this.viewObservers.has(root)) continue;
        const observer = new MutationObserver((mutations) => {
          // 忽略本插件插入/移除耳机按钮造成的变动，避免自己唤醒自己。
          if (!mutations.some(mutationHasExternalDomChange)) return;
          // 高亮先当帧补回来，不等 debounce，否则重建瞬间会闪掉一段。
          this.reassertPlayingHighlight();
          const changedTables = collectChangedTables(mutations, root);
          if (changedTables.size > 0) this.requestUpdate(false, changedTables);
        });
        observer.observe(root, { childList: true, subtree: true });
        this.viewObservers.set(root, observer);
      }
    };

    // Stop playback when leaving the current note.
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.managedContextsCache = null;
        this.stopCurrentAudio();
        this.syncViewObservers();
        this.requestUpdate(true);
      })
    );

    // 同一标签页里切换阅读 / 编辑模式不会触发 active-leaf-change，
    // 但可见容器换了一个，必须重新接管，否则切过去的那一侧没有耳机。
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.managedContextsCache = null;
        this.syncViewObservers();
        this.requestUpdate(true);
      })
    );

    this.register(() => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      for (const observer of this.viewObservers.values()) observer.disconnect();
      this.viewObservers.clear();
      if (this.audioBindingFrame !== null) cancelAnimationFrame(this.audioBindingFrame);
      if (this.updateFrame !== null) cancelAnimationFrame(this.updateFrame);
      this.pendingAudioTables.clear();
    });

    // 库结构变化（新生成音频、重命名、删除）后让音频索引失效，下次查找时重建。
    this.registerEvent(this.app.vault.on("create", invalidateAudioFileIndex));
    this.registerEvent(this.app.vault.on("delete", invalidateAudioFileIndex));
    this.registerEvent(this.app.vault.on("rename", invalidateAudioFileIndex));

    this.syncViewObservers();
    this.requestUpdate(false);
  }
  onunload() {
    this.stopCurrentAudio();
    invalidateAudioFileIndex();
    const tables = document.querySelectorAll("table");
    for (let index = 0; index < tables.length; index++) {
      this.clearAudioFromTable(tables[index]);
    }
  }
}

installMixins(TableSoundPlugin, RuleMethods, PlaybackMethods, ResolveMethods, TableMethods, SettingsStoreMethods);

module.exports = TableSoundPlugin;

const { Notice } = require("obsidian");
const { playClip, prepareClipSafe, releaseClip } = require("../clip");
const { PAUSED_CELL_CLASS, PLAYING_CELL_CLASS } = require("../constants");
const { ensureArticleAudioDirsListed, findAudioFilePath, findChunkAudioPath } = require("../lookup");
const { describePlayingCell, resolvePlayingCell } = require("../playingCell");
const { getSettings } = require("../settings");
const { listeningNotePath } = require("../../shared/notes");

class PlaybackMethods {
  // 标记某个单元格为「正在播放」，同时记下可跨重建复原的坐标。
  // 返回递增令牌，调用方在 finally 里凭令牌判断该由不由自己收尾。
  markPlayingCell(cell) {
    if (!cell) return this.playingCellToken;
    this.clearPlayingCellHighlight();
    this.currentPlayingCell = cell;
    this.playingCellDescriptor = describePlayingCell(cell);
    cell.classList.add(PLAYING_CELL_CLASS);
    return ++this.playingCellToken;
  }

  isPlayingCell(cell) {
    return Boolean(cell) && cell === this.currentPlayingCell;
  }

  clearPlayingCellHighlight() {
    const descriptor = this.playingCellDescriptor;
    this.playingCellDescriptor = null;
    if (this.currentPlayingCell) {
      this.currentPlayingCell.classList.remove(PLAYING_CELL_CLASS, PAUSED_CELL_CLASS);
      this.currentPlayingCell = null;
    }
    // 高亮可能已被补写到重建后的新节点上，按坐标再擦一次，避免残留。
    const rebuilt = resolvePlayingCell(descriptor);
    if (rebuilt) rebuilt.classList.remove(PLAYING_CELL_CLASS, PAUSED_CELL_CLASS);
  }

  // 表格被 Obsidian 重建后，把高亮补回到新的单元格节点上。
  reassertPlayingHighlight() {
    const descriptor = this.playingCellDescriptor;
    if (!descriptor) return;
    if (this.currentPlayingCell &&
        this.currentPlayingCell.isConnected &&
        this.currentPlayingCell.classList.contains(PLAYING_CELL_CLASS)) {
      return;
    }
    const cell = resolvePlayingCell(descriptor);
    if (!cell) return;
    if (this.currentPlayingCell && this.currentPlayingCell !== cell) {
      this.currentPlayingCell.classList.remove(PLAYING_CELL_CLASS);
    }
    this.currentPlayingCell = cell;
    cell.classList.add(PLAYING_CELL_CLASS);
    cell.classList.toggle(PAUSED_CELL_CLASS, this.isPaused);
  }

  // ==================== 暂停 / 继续 ====================
  // 暂停不同于停止：停止会作废当前播放任务，暂停只是把这一格按住不放，
  // 恢复后从断点接着播放，不必重新点一遍。
  togglePlaybackPause() {
    if (!this.currentPlayingAudio && !this.currentPlayRequest) {
      new Notice("当前没有正在播放的音频", 1500);
      return;
    }
    if (this.isPaused) this.resumePlayback();
    else this.pausePlayback();
  }

  pausePlayback() {
    if (this.isPaused) return;
    this.isPaused = true;
    const audio = this.currentPlayingAudio;
    // awaitClipPlayback 的 onpause 只在请求已作废时才收尾，
    // 因此这里按下去不会让挂起的 Promise 提前兑现，播放任务原地暂停。
    if (audio && !audio.paused) {
      try { audio.pause(); } catch (e) {}
    }
    if (this.currentPlayingCell) this.currentPlayingCell.classList.add(PAUSED_CELL_CLASS);
  }

  resumePlayback() {
    if (!this.isPaused) return;
    this.isPaused = false;
    if (this.currentPlayingCell) this.currentPlayingCell.classList.remove(PAUSED_CELL_CLASS);
    const audio = this.currentPlayingAudio;
    if (audio && audio.paused && !audio.ended) {
      audio.play().catch(() => {});
    }
    this.wakePauseWaiters();
  }

  wakePauseWaiters() {
    const waiters = this.pauseWaiters;
    this.pauseWaiters = [];
    for (const wake of waiters) {
      try { wake(); } catch (e) {}
    }
  }

  // 同一格包含多个音标时，音标之间的间隔必须认暂停。
  async sleepRespectingPause(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
    while (this.isPaused) {
      await new Promise((resolve) => this.pauseWaiters.push(resolve));
    }
  }

  stopCurrentAudio() {
    // 停止会作废当前任务，因此必须先解除暂停并唤醒所有等待者。
    this.isPaused = false;
    this.wakePauseWaiters();

    // 标记当前进行中的单音频异步请求已废弃
    if (this.currentPlayRequest) {
      this.currentPlayRequest.aborted = true;
      this.currentPlayRequest = null;
    }

    // 必须先兑现挂起的播放 Promise，再摘掉事件处理器，否则等待方永远醒不过来。
    if (this.currentPlaybackResolve) {
      const resolvePending = this.currentPlaybackResolve;
      this.currentPlaybackResolve = null;
      try { resolvePending(); } catch (e) {}
    }

    if (this.currentPlayingAudio) {
      const audio = this.currentPlayingAudio;
      audio.onended = null;
      audio.onerror = null;
      audio.onpause = null;
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.src = "";
      } catch (e) {}
      this.currentPlayingAudio = null;
    }

    this.clearPlayingCellHighlight();

    if (this.currentBlobUrl) {
      try {
        URL.revokeObjectURL(this.currentBlobUrl);
      } catch (e) {}
      this.currentBlobUrl = null;
    }
  }

  async playSingleCellAudio(cell, type, context) {
    // 同一格再次点击作为暂停 / 继续；点另一格则立即停止旧音频并播放新格。
    if (this.isPlayingCell(cell) && (this.currentPlayingAudio || this.currentPlayRequest)) {
      this.togglePlaybackPause();
      return;
    }

    this.stopCurrentAudio();

    await ensureArticleAudioDirsListed(this.app, context && context.file);
    const resolved = this.resolveAudioForCell(cell, type, context);
    return this.playResolvedAudio(cell, resolved);
  }

  resolveListeningAudio(entry) {
    if (!entry?.sourcePath || !listeningNotePath(entry.sourcePath)) return null;
    const file = { path: entry.sourcePath };
    const forms = [entry.word, ...entry.word.split(/\s*\/\s*/)].map(word => word.replace(/\([^)]*\)/g, "").trim());
    const word = forms.map(form => findAudioFilePath(this.app, form, file)).find(Boolean);
    const chunk = findChunkAudioPath(this.app, entry.chunk, entry.word, file);
    return { label: entry.word, paths: [...new Set([word, chunk].filter(Boolean))], word, chunk };
  }

  async playResolvedAudio(cell, resolved) {
    if (!resolved || !resolved.paths || resolved.paths.length === 0) {
      const label = resolved && resolved.label ? resolved.label : "当前单元格";
      new Notice(`⚠️ [${label}] 未找到可播放音频`, 2000);
      return;
    }

    const request = { aborted: false };
    this.currentPlayRequest = request;
    const isStillCurrent = () => !request.aborted && this.currentPlayRequest === request;
    const playingToken = this.markPlayingCell(cell);

    try {
      let prepared = prepareClipSafe(this, resolved.paths[0]);

      // 一个音标单元格可能含多个音标文件；它们仍属于当前单元格，
      // 可以逐个播放，但绝不再扫描或播放下一行。
      for (let index = 0; index < resolved.paths.length; index++) {
        if (!isStillCurrent()) {
          releaseClip(this, prepared);
          return;
        }

        const current = prepared;
        prepared = index + 1 < resolved.paths.length
          ? prepareClipSafe(this, resolved.paths[index + 1])
          : null;

        const outcome = await playClip(this, resolved.paths[index], isStillCurrent, current);
        if (outcome === "aborted" || !isStillCurrent()) {
          releaseClip(this, prepared);
          return;
        }

        if (index < resolved.paths.length - 1) {
          await this.sleepRespectingPause(getSettings().phonemeGapMs);
        }
      }
    } catch (err) {
      console.error("[TableSound] 单元格音频播放失败:", err);
    } finally {
      if (this.currentPlayRequest === request) this.currentPlayRequest = null;
      // 节点可能已被重建，因此凭令牌判断是否仍由本次播放负责收尾。
      if (this.playingCellToken === playingToken) this.clearPlayingCellHighlight();
    }
  }
}

module.exports = { PlaybackMethods };

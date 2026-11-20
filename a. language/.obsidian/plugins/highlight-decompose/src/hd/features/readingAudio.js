const { findAudioFilePath } = require("../../audio/lookup");
const { readingNotePath } = require("../reading");
const { articleModule } = require("../../shared/notes");

// 阅读原文里鼠标移到高亮词上时朗读该词（规范原形音频，取本篇音频目录）。
// 移到别的高亮词立即切换，移开立即停止；缺失音频直接跳过。
class ReadingAudioMethods {
  hoverReadingAudio(target) {
    const el = target.closest(".hd-reading-word");
    if (el === this.readingAudioEl) return;
    this.readingAudioEl = el;
    this.stopReadingAudio();
    if (!el) return;
    const file = this.fileFor(el);
    if (!file || !readingNotePath(file.path)) return;
    const occurrence = this.readingOccurrence(el, file.path);
    // 无注释时先查本篇词条, 用词头找音频(pupils → pupil.mp3)。
    const entry = occurrence?.annotation ? null : this.lookup(occurrence?.text || el.textContent || "", file.path);
    const word = occurrence?.annotation?.word || entry?.word || occurrence?.text;
    // 先取本篇音频目录; 单词已归口词库时, 再取词条所在笔记的镜像音频目录。
    let path = word && findAudioFilePath(this.app, word, file);
    if (word && !path && occurrence?.annotation) {
      const entry = this.lookupAnnotation(occurrence.annotation, file.path);
      if (entry?.path) path = findAudioFilePath(this.app, word, { path: entry.path });
    }
    const setting = `${articleModule(file.path) || "reading"}HoverAudio`;
    if (!path || !this.tableSound?.settings?.[setting]) return;
    this.readingAudioOn = true;
    this.tableSound.stopCurrentAudio();
    void this.tableSound.playResolvedAudio(el, { label: word, paths: [path], word });
  }

  stopReadingAudio() {
    if (this.readingAudioOn) this.tableSound?.stopCurrentAudio();
    this.readingAudioOn = false;
  }
}

module.exports = { ReadingAudioMethods };

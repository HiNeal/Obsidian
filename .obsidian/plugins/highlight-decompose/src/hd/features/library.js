const { TFile } = require("obsidian");
const { libraryKind, libraryPriority, parseTables } = require("../library");
const { articleNotePath, isInScope, isPluginExcludedNote } = require("../../shared/notes");

class LibraryMethods {
  async reindex(file) {
    if (!(file instanceof TFile) || file.extension !== "md") return;
    if (!isInScope(file) || isPluginExcludedNote(file)) {
      this.fileEntries.delete(file.path);
      return;
    }
    const content = await this.app.vault.cachedRead(file);
    if (this.unloading) return;
    const entries = parseTables(content, file.path);
    const firstIndex = !this.sourceContents.has(file.path);
    const changed = !firstIndex && this.sourceContents.get(file.path) !== content;
    this.sourceContents.set(file.path, content);
    if (entries.length) this.fileEntries.set(file.path, entries);
    else this.fileEntries.delete(file.path);
    if (libraryKind(file.path)) {
      this.libraryRevision++;
      if (this.libraryReady) this.refreshLibraryViews();
    }
    if (articleNotePath(file.path) && (firstIndex || changed)) {
      this.libraryRevision++;
      for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
        if (leaf.view.file?.path === file.path) leaf.view.editor?.cm?.dispatch({});
      }
    }
    if (changed) {
      this.hide();
      for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
        if (leaf.view.file?.path === file.path && leaf.view.getMode?.() === "preview") leaf.view.previewMode?.rerender(true);
      }
    }
  }

  refreshLibraryViews() {
    if (this.unloading) return;
    this.hide();
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      leaf.view.editor?.cm?.dispatch({});
      if (leaf.view.getMode?.() === "preview") leaf.view.previewMode?.rerender(true);
    }
  }

  async loadLibraries() {
    if (this.libraryReady) return;
    if (this.libraryLoad) return this.libraryLoad;
    const files = this.app.vault.getMarkdownFiles().filter(file => isInScope(file) && libraryKind(file.path))
      .sort((a, b) => a.path.localeCompare(b.path));
    this.libraryLoad = Promise.all(files.map(file => this.reindex(file))).then(() => { this.libraryReady = true; })
      .finally(() => { this.libraryLoad = null; });
    return this.libraryLoad;
  }

  entriesFor(path) {
    // 文章只查本篇自己的单词表与短语表; 直接读最新索引, 不缓存, 以免文章改动后仍用旧词条。
    if (articleNotePath(path)) return this.fileEntries.get(path) || [];
    if (!this.entriesCache) this.entriesCache = new Map();
    const revision = Number.isFinite(this.libraryRevision) ? this.libraryRevision : 0;
    const cacheKey = `${revision}:${path}`;
    if (this.entriesCache.has(cacheKey)) return this.entriesCache.get(cacheKey);
    const entries = [...(this.fileEntries.get(path) || [])];
    // Context phrases used to live beside words. Keep them ahead of generic
    // phrases when both libraries contain the same expression after migration.
    for (const [other, rows] of [...this.fileEntries].sort(([a], [b]) => libraryPriority(a) - libraryPriority(b) || a.localeCompare(b))) {
      if (other !== path && libraryKind(other)) entries.push(...rows);
    }
    if (this.entriesCache.size > 20) this.entriesCache.clear();
    this.entriesCache.set(cacheKey, entries);
    return entries;
  }

  // Index both complete library trees and the hovered note; vault events keep them current.
  async ensureIndex(file) {
    await this.loadLibraries();
    if (file && !this.sourceContents.has(file.path)) await this.reindex(file);
  }

  hasReadingEntry(text, annotation, path, library = false) {
    // 文章不再写 search 注释: 本篇表里查得到即为词条高亮。
    if (!annotation?.gloss?.trim()) return articleNotePath(path) ? Boolean(this.lookup(text, path, "", !library)) : false;
    if (!this.libraryReady && !this.fileEntries.size) return false;
    if (annotation) {
      if (this.lookupAnnotation(annotation, path)) return true;
      if (annotation.reference && this.lookup(annotation.reference, path, "", !library)) return true;
      if (annotation.word && this.lookup(annotation.word, path, "", !library)) return true;
    }
    return Boolean(this.lookup(text, path, "", !library));
  }
}

module.exports = { LibraryMethods };

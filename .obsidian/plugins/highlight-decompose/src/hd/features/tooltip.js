const { Platform } = require("obsidian");
const { QTYPE, definitionOnly } = require("../columns");
const { LEADING_BREAKS, cellMarkdown, headerText, normalize, wordCellOf } = require("../dom");
const { candidates, cellHeadword, composeDecomp, detailColumn, libraryKind, libraryPriority } = require("../library");
const { parseSenseId, parseEnglishSenseId, englishSenseTarget, EN_POS, appendInline, appendMeaningInline, chunkMatchesContext, highlightReadingSense, readingNotePath, readingSenseMatches, unwrapCardMarks } = require("../reading");
const { articleNotePath, isInScope, isPluginExcludedNote, listeningNotePath } = require("../../shared/notes");
const { contextCardColumn } = require("../tables");

// 文章没有 search 注释时, 在本篇词条里找这处高亮对应的行:
// 1. 意群原句包含这处高亮, 且词头与高亮至少有一个词同根;
// 2. 否则取词头实词全部能在高亮里找到同根词的行(took over → take over, a trusted circle → circle)。
const PLACEHOLDER = /^(?:\.\.\.\S*|…\S*|aaa|bbb|ccc|ddd|one's|someone's|sb|sth|doing|\(be\))$/;
const STOP = new Set(["a", "an", "the", "of", "to", "in", "on", "at", "for", "by", "with", "and", "or", "as", "is", "are", "was", "were", "be"]);
function wordsOf(text) {
  return normalize(text || "").replace(/[^\p{L}\p{N}'’\-. ]+/gu, " ").split(/\s+/)
    .map(w => w.replace(/^\.+(?=\p{L})/u, "").replace(/(?<=\p{L})\.+$/u, "")).filter(w => w && !/^\.$/.test(w));
}
function parts(words) {
  return words.flatMap(w => [w, ...(w.includes("-") ? w.split("-") : [])]).filter(Boolean);
}
function sameRoot(a, b) {
  if (a === b || a.replace(/-/g, "") === b.replace(/-/g, "")) return true;
  const n = Math.min(a.length, b.length);
  if (n < 4) return false;
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i >= Math.min(5, n) || (i >= 4 && i >= n - 1);
}
function articleFallback(local, text) {
  const words = wordsOf(text);
  const target = words.join(" ");
  if (!target) return null;
  const forms = parts(words).flatMap(w => candidates(w));
  const has = h => forms.some(t => sameRoot(h, t));
  let best = null, bestScore = 0;
  for (const e of local) {
    const head = wordsOf(e.word).filter(w => !PLACEHOLDER.test(w));
    const content = head.filter(w => !STOP.has(w));
    const shared = content.filter(has).length;
    const inSentence = (" " + wordsOf(e.chunk).join(" ") + " ").includes(" " + target + " ");
    const covered = content.length > 0 && shared === content.length;
    const insideHead = inSentence && words.every(w => STOP.has(w) || head.includes(w));
    if (!((inSentence && shared) || covered || insideHead)) continue;
    const score = (inSentence ? 100 : 0) + (covered ? 50 : 0) + shared * 10 - Math.abs(head.length - words.length);
    if (score > bestScore) { best = e; bestScore = score; }
  }
  return best;
}

class TooltipMethods {
  // 中文释义：每个词性一行，直接取自笔记。
  renderMeaning(meaning, annotation = null, preserveHighlights = !annotation) {
    const box = this.tip.createDiv({ cls: "hd-meaning hd-zh-block" });
    const lines = meaning.split(/<br\s*\/?>/i).map(l => l.trim()).filter(Boolean);
    lines.forEach((line, i) => {
      // 不同词性之间空一行
      const gap = i > 0 && /^[a-z]+\.\s/.test(line.replace(/<[^>]*>|\*\*|==/g, ""));
      appendMeaningInline(box.createDiv({ cls: gap ? "hd-zh-line hd-pos-gap" : "hd-zh-line" }), line, preserveHighlights);
    });
    if (annotation && !parseEnglishSenseId(annotation.gloss)) highlightReadingSense(box, annotation.gloss);
  }

  // 注释为英文编号(#e1 / #ev1.2)时, 在英文块里高亮对应的主项或子项。
  highlightEnglishSense(box, gloss) {
    const id = parseEnglishSenseId(gloss);
    if (!id) return false;
    const groups = [], holders = [];
    let current = null;
    for (const el of box.children) {
      if (el.classList.contains("hd-en-pos-tag")) {
        current = { pos: el.textContent.trim(), rows: [] };
        groups.push(current); holders.push([]);
      } else if (el.classList.contains("hd-en-body") && current) {
        for (const row of el.children) {
          const sub = row.classList.contains("hd-en-sub");
          current.rows.push(sub ? "sub" : "main");
          holders[holders.length - 1].push(sub ? row.lastElementChild : row);
        }
      }
    }
    const hit = englishSenseTarget(groups, id);
    const holder = hit && holders[hit.group][hit.row];
    if (!holder) return false;
    const mark = document.createElement("mark");
    mark.className = "hd-context-sense";
    mark.textContent = holder.textContent;
    holder.textContent = "";
    holder.appendChild(mark);
    return true;
  }

  // Explicit dictionary cross-references stay article-local. They never change
  // the primary word card or the hovered source range.
  renderSenseReference(annotation, path) {
    const entry = this.lookupAnnotation({ word: annotation.reference, gloss: annotation.gloss }, path);
    this.tip.createDiv({ cls: "hd-current-sense", text: `本文用法参见: ${annotation.reference}` });
    if (!entry) {
      this.tip.createDiv({ cls: "hd-current-sense", text: "参照词条未找到, 请核对" });
      return false;
    }
    const meaning = entry.decomp.split(/<br\s*\/?>\s*<br\s*\/?>/i).map(s => s.trim()).find(s => s && !/^\/[^/]+\/$/.test(s)) || "";
    this.renderMeaning(meaning, annotation);
    return true;
  }

  // 牛津英文释义：`v. 主项<br>&emsp;• 子项<br>主项<br>n. 主项`，不编号。
  // 整块是两列网格：左列词性，右列释义；所有词性的主项共用右列左对齐，子项圆点再缩进一级。
  renderEnglishBlock(enText, container, gloss = null) {
    const box = container.createDiv({ cls: "hd-en-block" });
    let body = null;
    const group = (pos) => {
      box.createDiv({ cls: "hd-en-pos-tag", text: pos });
      body = box.createDiv({ cls: "hd-en-body" });
    };
    for (const raw of enText.split(/<br\s*\/?>/i)) {
      const line = raw.replace(/&emsp;|&nbsp;/g, " ").trim();
      if (!line) continue;
      const sub = line.match(/^•\s*(.+)$/);
      if (sub) {
        if (!body) group("");
        const item = body.createDiv({ cls: "hd-en-sub" });
        item.createSpan({ cls: "hd-en-bullet", text: "•" });
        item.createSpan({ text: sub[1] });
        continue;
      }
      const pos = line.match(EN_POS);
      if (pos || !body) group(pos ? pos[1] : "");
      const text = pos ? pos[2] || "" : line;
      if (text) body.createDiv({ cls: "hd-en-main", text });
    }
    if (gloss) this.highlightEnglishSense(box, gloss);
  }

  fileFor(el) {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      if (leaf.view.containerEl.contains(el)) return leaf.view.file;
    }
    return this.app.workspace.getActiveFile();
  }

  // 文章只查本篇自己的表; 其余笔记查询当前笔记与整个 02. word / 03. phrase。
  // 文章本篇表里查不到时(且未要求 localOnly), 回退到 02. word 词库显示卡片; 录入时仍必须补进本篇表。
  lookup(text, path, context = "", localOnly = false) {
    const hit = this.lookupLocal(text, path, context);
    if (hit || localOnly || !articleNotePath(path) || listeningNotePath(path)) return hit;
    return this.lookupWordLibrary(text, context);
  }

  lookupWordLibrary(text, context = "") {
    const keys = candidates(text);
    const cacheKey = `wordlib:${this.libraryRevision}`;
    if (!this.entriesCache) this.entriesCache = new Map();
    let rows = this.entriesCache.get(cacheKey);
    if (!rows) {
      rows = [...this.fileEntries].filter(([p]) => libraryKind(p) === "word").sort(([a], [b]) => libraryPriority(a) - libraryPriority(b) || a.localeCompare(b)).flatMap(([, r]) => r).filter(e => e.decomp);
      if (this.entriesCache.size > 20) this.entriesCache.clear();
      this.entriesCache.set(cacheKey, rows);
    }
    const singleWord = !/\s/.test(normalize(text));
    const exact = keys.flatMap(key => rows.filter(e => e.word === key));
    let hit = exact.find(e => chunkMatchesContext(e, context)) || exact[0];
    if (!hit) for (const key of keys) {
      const hits = rows.filter(e => e.keys.has(key) && (!singleWord || !/\s/.test(e.word.replace(/\s*\/\s*/g, "/"))));
      if (hits.length) { hit = hits.find(e => chunkMatchesContext(e, context)) || hits[0]; break; }
    }
    return hit ? { ...hit, fromLibrary: true } : null;
  }

  lookupLocal(text, path, context = "") {
    const keys = candidates(text);
    const local = this.entriesFor(path).filter((e) => e.decomp);
    // Prefer an actual headword over another entry's bold-example alias.
    // Otherwise sustainable can resolve to sustain, or negotiate to a phrase.
    const exact = keys.flatMap(key => local.filter(e => e.word === key));
    if (exact.length) return exact.find(e => chunkMatchesContext(e, context)) || exact[0];
    const singleWord = !/\s/.test(normalize(text));
    for (const key of keys) {
      // `harbour / harbor` 这类英美拼写词头仍算单词。
      const hits = local.filter((e) => e.keys.has(key) && (!singleWord || !/\s/.test(e.word.replace(/\s*\/\s*/g, "/"))));
      if (hits.length) return hits.find((e) => chunkMatchesContext(e, context)) || hits[0];
    }
    return articleNotePath(path) ? articleFallback(local, text) : null;
  }

  lookupListening(text, path, context = "") {
    const source = listeningNotePath(path);
    if (!source) return null;
    const keys = candidates(text);
    const cacheKey = `listening:${this.libraryRevision}:${source}`;
    let rows = this.entriesCache.get(cacheKey);
    if (!rows) {
      rows = [...this.fileEntries.values()].flat().filter(entry => listeningNotePath(entry.sourcePath) === source);
      if (this.entriesCache.size > 20) this.entriesCache.clear();
      this.entriesCache.set(cacheKey, rows);
    }
    const entries = rows.filter(entry => entry.decomp && keys.some(key => entry.keys.has(key)));
    // Prefer a real headword, then this occurrence's complete chunk.
    const exact = entries.filter(entry => keys.includes(entry.word));
    const matches = exact.length ? exact : entries;
    return matches.find(entry => chunkMatchesContext(entry, context)) || matches[0] || null;
  }

  // Article annotations select an exact headword and a compatible part of speech.
  // Prefer a definition containing the selected sense across duplicate wordbooks.
  lookupAnnotation(annotation, path) {
    const id = parseSenseId(annotation.gloss);
    const tagged = !annotation.reference && (id?.pos ? [null, id.pos + "."] : annotation.gloss.match(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|int\.|det\.|num\.)\s+/));
    const matches = this.entriesFor(path).filter(e => e.word === normalize(annotation.word) && e.decomp).map(entry => {
      const meaning = entry.decomp.split(/<br\s*\/?>\s*<br\s*\/?>/i).map(s => s.trim()).find(s => s && !/^\/[^/]+\/$/.test(s)) || "";
      const lines = meaning.split(/<br\s*\/?>/i).map(s => s.replace(/<[^>]*>|\*\*|==/g, "").trim()).filter(Boolean);
      const positions = lines.map(s => s.match(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|int\.|det\.|num\.)\s*/)?.[1]).filter(Boolean);
      return { entry, lines, compatible: !tagged || !positions.length || positions.includes(tagged[1]) };
    }).filter(hit => hit.compatible);
    return (matches.find(hit => readingSenseMatches(hit.lines, annotation.gloss).length === 1) || matches[0])?.entry || null;
  }

  // 表格行只读取本行释义与拆解; 拆解为空时仍可单独显示本行意群。
  lookupRow(row, path) {
    const table = row.closest("table");
    const headers = Array.from(table?.querySelector("thead tr, tr")?.cells || [], headerText);
    const column = detailColumn(headers);
    if (column < 0) return null;
    let decomp = cellMarkdown(row.cells[column]).replace(LEADING_BREAKS, "");
    const meaningColumn = headers[column] === "释义" || !headers.some((h) => /拆解|英意/.test(h)) ? -1 : headers.indexOf("释义");
    const memoryColumn = headers[column] === "释义" ? -1 : headers.indexOf("记忆");
    const meaningMd = meaningColumn >= 0 && row.cells[meaningColumn] ? cellMarkdown(row.cells[meaningColumn]) : "";
    const memoryMd = memoryColumn >= 0 && row.cells[memoryColumn] ? cellMarkdown(row.cells[memoryColumn]) : "";
    if (meaningMd || memoryMd) decomp = composeDecomp(meaningMd, decomp, memoryMd);
    if (!decomp.trim()) return null;
    const synColumn = headers.indexOf("同义词");
    const syn = synColumn >= 0 && row.cells[synColumn] ? cellMarkdown(row.cells[synColumn]).trim() : "";
    const phColumn = headers.indexOf("音标");
    const phBlock = decomp.split(/<br\s*\/?>\s*<br\s*\/?>/i).find((part) => /^\/[^/]+\/$/.test(part.trim()));
    // 单词表的音标写在单词格第二行(`word<br>/音标/`), 页面上隐藏, 只在卡片显示。
    const wordLines = cellMarkdown(wordCellOf(row)).replace(LEADING_BREAKS, "").split(/<br\s*\/?>/i).map((s) => s.trim());
    const wordPh = wordLines.slice(1).find((s) => /^\/[^/]+\/$/.test(s)) || "";
    const ph = (phColumn >= 0 ? cellMarkdown(row.cells[phColumn]) : phBlock || wordPh).replace(/^\/|\/$/g, "").trim();
    return { word: normalize(cellHeadword(wordCellOf(row))), decomp, ph, path, isMeaning: headers[column] === "释义", ...(syn ? { syn } : {}) };
  }

  appendEntrySources(entry, path) {
    // 文章卡片不显示来源。
    if (!entry?.path || !readingNotePath(path) || articleNotePath(path)) return;
    const paths = new Set([entry.path]);
    for (const other of this.entriesFor(path)) {
      if (other.word === entry.word && other.path) paths.add(other.path);
    }
    const footer = this.tip.createDiv({ cls: "hd-entry-sources" });
    for (const source of paths) {
      footer.createDiv({ text: source.replace(/\.md$/i, "") });
    }
  }

  appendQuestionTypes(row) {
    const types = [];
    for (const q of row.querySelectorAll(".hd-qtype")) {
      const m = q.textContent.trim().match(QTYPE);
      if (m && !types.includes(m[1])) types.push(m[1]);
    }
    if (types.length) this.tip.createDiv({ cls: "hd-qtypes", text: types.join(" · ") });
  }

  appendRowContext(row, parent = this.tip) {
    const table = row.closest("table.hd-context-card");
    if (!table) return false;
    const names = Array.from(table.querySelector("thead tr, tr")?.cells || [], headerText);
    const column = contextCardColumn(names, this.fileFor(row)?.path || "");
    const cell = row.cells[column];
    const content = cell && (cell.querySelector(":scope > .table-cell-wrapper") || cell).cloneNode(true);
    if (!content) return false;
    content.querySelectorAll("button, .audio-playback-btn, .hd-promote, .cm-editor, .hd-br-space, .hd-qtype").forEach(node => node.remove());
    content.querySelectorAll(".hd-br-hidden").forEach(br => br.classList.remove("hd-br-hidden"));
    if (!content.textContent.trim()) return false;
    const block = parent.createDiv({ cls: "hd-card-context" });
    block.createSpan({ cls: "hd-card-context-body" }).append(...content.childNodes);
    return true;
  }

  showRowContext(row, anchor) {
    this.tip.empty();
    if (!this.appendRowContext(row)) return this.hide();
    this.appendQuestionTypes(row);
    this.tip.show();
    this.position(row, anchor);
  }

  showPhrase(row, anchor) {
    const isBase = !!row.closest(".hd-base-table");
    const cell = isBase ? row.cells[1] : row.cells[0];
    const hidden = cell && cell.querySelector(".hd-phrase-meaning");
    if (!hidden || !hidden.textContent.trim()) return this.hide();
    this.tip.empty();
    const body = this.tip.createDiv({ cls: "hd-meaning hd-phrase-body" });
    body.append(...hidden.cloneNode(true).childNodes);
    unwrapCardMarks(body);
    // The clone starts with the two <br> that separated phrase from 释义.
    Array.from(body.querySelectorAll("br")).slice(0, 2).forEach((br) => br.remove());
    if (isBase) {
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      const gloss = walker.nextNode();
      if (gloss && /[;；]/.test(gloss.nodeValue)) {
        const fragment = document.createDocumentFragment();
        gloss.nodeValue.split(/[;；]/).map((part) => part.trim()).filter(Boolean).forEach((part, i) => {
          if (i) fragment.appendChild(document.createElement("br"));
          fragment.appendChild(document.createTextNode(part));
        });
        gloss.replaceWith(fragment);
      }
    }
    const examples = row.querySelectorAll(".hd-ex-meaning");
    if (examples.length) {
      const list = this.tip.createDiv({ cls: "hd-decomp hd-examples" });
      examples.forEach((ex, i) => {
        if (i > 0) list.createEl("br");
        list.createEl("strong", { text: ex.dataset.word });
        list.appendText(" " + ex.textContent.trim());
      });
    }
    this.appendQuestionTypes(row);
    this.tip.show();
    this.position(row, anchor);
  }

  // Column tables: the hidden cells' rendered content, one block per column.
  showColumns(row, anchor) {
    const hidden = row.closest(".hd-column-table").dataset.hdHidden.split(",").map(Number);
    this.tip.empty();
    for (const i of hidden) {
      const cell = row.cells[i];
      if (!cell) continue;
      const content = (cell.querySelector(":scope > .table-cell-wrapper") || cell).cloneNode(true);
      content.querySelectorAll("button, .audio-playback-btn").forEach((b) => b.remove());
      if (!content.textContent.trim()) continue;
      const block = this.tip.createDiv({ cls: this.tip.childElementCount ? "hd-decomp" : "hd-meaning" });
      block.append(...content.childNodes);
      unwrapCardMarks(block);
    }
    if (!this.tip.childElementCount) return this.hide();
    this.tip.show();
    this.position(row, anchor);
  }

  showBaseExamples(row) {
    const cell = row.cells[2];
    const content = cell && (cell.querySelector(":scope > .table-cell-wrapper") || cell).cloneNode(true);
    if (!content) return this.hide();
    content.querySelectorAll("button, .audio-playback-btn, .cm-editor").forEach((node) => node.remove());
    if (!content.textContent.trim()) return this.hide();
    this.tip.empty();
    this.tip.createDiv({ cls: "hd-base-examples-body" }).append(...content.childNodes);
    this.tip.show();
    this.position(row, row.cells[0]);
  }

  async show(el, anchor) {
    this.cancelHide();
    // Clear the previous card before any asynchronous lookup for the new content.
    this.stopListeningHover();
    this.tip.hide();
    this.clearReadingHighlight();
    const scopeFile = this.fileFor(el);
    if (!isInScope(scopeFile)) return this.hide();
    if (isPluginExcludedNote(scopeFile)) {
      const row = el.closest(".hd-base-examples-table tr.hd-row");
      const cell = anchor && anchor.closest("td, th");
      if (!row || (cell !== row.cells[0] && cell !== row.cells[1])) return this.hide();
      ++this.hoverToken;
      this.activeEl = el;
      this.activeCell = anchor;
      return this.showBaseExamples(row);
    }
    // 高亮更新期间不弹卡片。
    if (this.promotePending) return;
    if (el.matches("tr.hd-row") && el.closest(".hd-phrase-library") && !el.closest(".hd-context-card")) return this.hide();
    const token = ++this.hoverToken;
    this.activeEl = el;
    this.activeCell = anchor || (el.matches("tr") ? wordCellOf(el) : el);
    if (el.matches("tr.hd-row") && el.closest(".hd-phrase-library.hd-context-card")) return this.showRowContext(el, anchor);
    const para = (el.closest?.("[data-hd-para]") || el.querySelector?.("[data-hd-para]"))?.dataset?.hdPara;
    if (para) return this.showParaphrase(el, anchor, para);
    if (el.matches("tr.hd-row") && el.closest(".hd-phrase-table, .hd-base-table")) return this.showPhrase(el, anchor);
    if (el.matches("tr.hd-row") && el.closest(".hd-column-table")) return this.showColumns(el, anchor);
    const isRow = el.matches("tr.hd-row");
    const text = isRow ? cellHeadword(wordCellOf(el)) : el.textContent || "";
    if (!text.trim()) return this.hide();
    const file = this.fileFor(el);
    if (!isRow) await this.ensureIndex(file);
    const path = file ? file.path : "";
    const occurrence = isRow ? null : this.readingOccurrence(el, path);
    const annotation = occurrence?.annotation || null;
    if (annotation?.changed) {
      if (token !== this.hoverToken || this.activeEl !== el) return;
      this.tip.empty();
      this.tip.createDiv({ cls: "hd-current-sense", text: "正文已改动, 请核对词义" });
      this.tip.show();
      this.position(el, anchor);
      return;
    }
    if (!annotation && text.length > 60) return this.hide();
    const context = isRow ? "" : (el.closest("p, li, blockquote, .cm-line") || el.parentElement)?.textContent || "";
    const entry = isRow ? this.lookupRow(el, path) : annotation
      ? this.lookupAnnotation(annotation, path)
      : el.matches("mark, .cm-highlight") ? this.lookup(occurrence?.text || text, path, context) : null;
    if (token !== this.hoverToken || this.activeEl !== el) return;
    if (!entry?.decomp) {
      if (isRow && el.closest(".hd-context-card")) return this.showRowContext(el, anchor);
      if (!annotation) return this.hide();
      this.tip.empty();
      this.tip.createDiv({ cls: "hd-head-row" }).createDiv({ cls: "hd-headword", text: normalize(annotation.word) });
      this.tip.createDiv({ cls: "hd-current-sense", text: parseSenseId(annotation.gloss) ? `本文义编号 ${annotation.gloss}, 词库未收录` : `本文义: ${annotation.gloss}` });
      this.highlightReadingOccurrence(el, path, occurrence);
      this.tip.show();
      this.position(el, anchor);
      return;
    }

    if (!isRow && listeningNotePath(path)) {
      this.tip.empty();
      // 听力原文卡片: 词条来自本篇词表, 释义里的 ==...== 就是本篇语境义项, 照样高亮。
      this.renderMeaning(definitionOnly(entry.decomp), null, "context");
      const resolved = this.tableSound?.resolveListeningAudio(entry);
      this.tip.show();
      this.position(el, anchor);
      if (resolved?.paths.length && this.tableSound?.settings?.listeningHoverAudio) {
        this.listeningHoverAudio = true;
        this.tableSound.stopCurrentAudio();
        void this.tableSound.playResolvedAudio(el, resolved);
      }
      return;
    }

    let parts = entry.decomp.split(/<br\s*\/?>\s*<br\s*\/?>/).map((p) => p.trim()).filter(Boolean);
    let ph = entry.ph || "";

    parts = parts.filter((part) => {
      if (!/^\/[^/]+\/$/.test(part)) return true;
      if (!ph) ph = part.slice(1, -1).trim();
      return false;
    });

    let meaning = parts[0] || "";
    let remaining = parts.slice(1);
    let enBlock = null;

    if (remaining.length > 0 && !/[\u4e00-\u9fa5]/.test(remaining[remaining.length - 1])) {
      enBlock = remaining.pop();
    }
    const decompParts = remaining;

    this.tip.empty();
    const phText = ph ? (ph.startsWith("/") ? ph : `/${ph}/`) : "";
    const headword = !isRow && readingNotePath(path) ? (annotation?.word ? normalize(annotation.word) : entry.word) : "";
    const libraryRow = isRow && !!el.closest(".hd-context-card");
    if (libraryRow) {
      const line = this.tip.createDiv({ cls: "hd-table-card-topline" });
      this.appendRowContext(el, line);
      if (phText) line.createSpan({ cls: "hd-ph", text: phText });
    } else if (headword) {
      // 阅读卡片首行: search 词在左, 音标在右, 同一行对齐。
      const head = this.tip.createDiv({ cls: "hd-head-row" });
      head.createDiv({ cls: "hd-headword", text: headword });
      if (phText) head.createDiv({ cls: "hd-ph", text: phText });
    } else if (phText) {
      this.tip.createDiv({ cls: "hd-ph", text: phText });
    }
    // Library tables already show the definition beside the headword.
    if (meaning && meaning.trim() && !(isRow && el.closest(".hd-context-card"))) {
      // 文章原文卡片 (无旧式 search 注释): 词条来自本篇词表, 释义里的 ==...== 是本篇语境义项, 高亮出来。
      const articleContext = !isRow && !annotation && articleNotePath(path) && !entry.fromLibrary ? "context" : false;
      this.renderMeaning(meaning, annotation?.reference ? null : annotation, isRow || articleContext);
    }
    if (annotation?.reference) this.renderSenseReference(annotation, path);
    if (decompParts.length) {
      // 记忆锚点与中文释义同属中文部分，不加分割线
      appendInline(this.tip.createDiv({ cls: "hd-decomp hd-anchor" }), decompParts.join("<br>"));
    }
    this.appendSynonyms(entry.syn);
    if (enBlock) {
      this.renderEnglishBlock(enBlock, this.tip, annotation?.reference ? null : annotation?.gloss);
    }
    if (el.matches("tr.hd-row")) this.appendQuestionTypes(el);
    if (!this.tip.textContent.trim()) return this.hide();
    if (!isRow) {
      this.appendEntrySources(entry, path);
      this.highlightReadingOccurrence(el, path, occurrence);
    }
    this.tip.show();
    this.position(el, anchor);
  }

  // 同义词: 来自表格「同义词」列, `n. a, b<br>v. c, d` 每个词性一行, 词典没有的词该格为空, 不显示。
  appendSynonyms(syn) {
    if (!syn || !syn.trim()) return;
    const items = syn.split(/<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;
    const box = this.tip.createDiv({ cls: "hd-synonyms" });
    for (const text of items) {
      const m = text.match(/^([a-z]+\.)\s+(.*)$/);
      const line = box.createDiv({ cls: "hd-syn-line" });
      if (m) line.createSpan({ cls: "hd-syn-pos", text: m[1] });
      line.createSpan({ cls: "hd-syn-words", text: m ? m[2] : text });
    }
  }

  // Vocabulary cards span the full table; other table cards keep their two-column width.
  position(el, anchor) {
    let target = anchor || this.activeCell || (el && el.matches("tr") ? el.cells[0] : el) || this.activeEl;
    if (!target) return;

    let row = el && el.matches("tr.hd-row") ? el : (target.closest ? target.closest("tr") : null);
    const pad = 4;

    if (row && row.cells.length >= 2) {
      const cell1 = row.cells[0];
      // 第二列可能是隐藏的音标列: 取第一个可见的非词头格。
      const cell2 = Array.from(row.cells).slice(1).find(cell => !cell.classList.contains("hd-hidden-col")) || cell1;
      const r1 = cell1.getBoundingClientRect();
      const r2 = cell2.getBoundingClientRect();
      const tableRect = row.closest(".hd-decomp-table, .hd-context-card")?.getBoundingClientRect();
      const left = tableRect ? tableRect.left : r1.left;
      const width = tableRect ? tableRect.width : r2.right - r1.left;

      this.tip.style.width = `${width}px`;
      this.tip.style.maxWidth = `${width}px`;
      this.tip.style.left = `${left}px`;

      this.placeBelow(Math.max(r1.bottom, r2.bottom), pad);
    } else {
      // In-article highlights (or non-table elements)
      const container = target.closest(".markdown-rendered, .cm-content, .markdown-preview-view") || target.parentElement;
      const cr = container ? container.getBoundingClientRect() : null;
      const r = target.getBoundingClientRect();
      const pad = 4;

      let left = r.left;
      let width = 0;

      if (cr) {
        left = cr.left;
        width = cr.width;
      } else {
        width = Math.min(window.innerWidth - 32, 720);
        left = Math.max(pad, (window.innerWidth - width) / 2);
      }

      this.tip.style.width = `${width}px`;
      this.tip.style.maxWidth = `${width}px`;
      this.tip.style.left = `${left}px`;

      this.placeBelow(r.bottom, pad);
    }
  }

  // Always tightly below the anchor (0px gap), never flipped above or shifted
  // over it; when the viewport bottom is too close, the card scrolls instead.
  placeBelow(top, pad) {
    this.tip.style.top = `${top}px`;
    this.tip.style.maxHeight = `${Math.max(0, window.innerHeight - top - pad)}px`;
    this.tip.style.overflowY = "auto";
  }

  // 对错标记的卡片: 在 ✅/❌ 正上方, 留 10px 间距, 宽度与正文列一致; 上方空间不够时卡片内部滚动。
  positionAbove(el) {
    const pad = 4;
    const container = el.closest(".markdown-rendered, .cm-content, .markdown-preview-view") || el.parentElement;
    const cr = container ? container.getBoundingClientRect() : null;
    const r = el.getBoundingClientRect();
    let left, width;
    if (cr) { left = cr.left; width = cr.width; }
    else { width = Math.min(window.innerWidth - 32, 720); left = Math.max(pad, (window.innerWidth - width) / 2); }
    this.tip.style.width = `${width}px`;
    this.tip.style.maxWidth = `${width}px`;
    this.tip.style.left = `${left}px`;
    const gap = 10;
    const room = Math.max(0, r.top - pad - gap);
    this.tip.style.maxHeight = `${room}px`;
    this.tip.style.overflowY = "auto";
    const height = Math.min(this.tip.offsetHeight, room);
    this.tip.style.top = `${r.top - gap - height}px`;
  }

  // 题目里的同义改写: 悬停显示原文表达（多个以 / 分隔, 每条后的【反】表示反义对立）。
  showParaphrase(el, anchor, text) {
    const phrases = text.split(/\s+\/\s+/).map(p => p.trim()).filter(Boolean);
    if (!phrases.length) return this.hide();
    this.tip.empty();
    const box = this.tip.createDiv({ cls: "hd-meaning hd-para-body" });
    phrases.forEach((phrase, i) => {
      if (i) box.createEl("br");
      const negated = phrase.includes("【反】");
      box.appendText((negated ? "（反）" : "") + phrase.replace(/【反】/g, "").trim());
    });
    this.tip.show();
    this.position(el, anchor);
  }

  // 离开词条后留一小段时间让鼠标移到卡片上; 期间进入卡片或回到词条就取消, 否则收起。
  scheduleHide(delay = 0) {
    // 离开即消失: 默认不留延迟, 直接收起。
    if (delay <= 0) return this.hide();
    if (this.hideTimer) return;
    this.hideTimer = setTimeout(() => { this.hideTimer = null; this.hide(); }, delay);
  }

  cancelHide() {
    clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  hide() {
    this.cancelHide();
    this.hoverToken++;
    this.stopListeningHover();
    this.clearReadingHighlight();
    this.activeEl = null;
    this.activeCell = null;
    this.tip.hide();
  }

  stopListeningHover() {
    if (this.listeningHoverAudio) this.tableSound?.stopCurrentAudio();
    this.listeningHoverAudio = false;
  }
}

module.exports = { TooltipMethods };

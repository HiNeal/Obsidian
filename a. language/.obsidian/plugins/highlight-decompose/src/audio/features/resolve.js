const { Notice } = require("obsidian");
const { getDataRows, normalizeHeaderText } = require("../dom");
const { extractAllTargetPhonemes, extractTargetPhoneme, extractTargetSentence, extractTargetWord, isKnownPhoneme } = require("../extract");
const { findAudioFilePath, findChunkAudioPath, findPhonemeAudioPath, findSentenceAudioPath } = require("../lookup");
const { listeningNotePath, sectionSourceOf } = require("../../shared/notes");

class ResolveMethods {
  resolveAudioMetadataForCell(cell, type, context) {
    if (!cell || !type) return null;

    let resolvedType = type;
    if (resolvedType === "auto") {
      const phonemes = extractAllTargetPhonemes(cell);
      if (phonemes.length > 0) {
        resolvedType = "phoneme";
      } else {
        const sentenceText = extractTargetSentence(cell);
        resolvedType = sentenceText.split(/\s+/).filter(Boolean).length >= 4
          ? "sentence"
          : "word";
      }
    }

    if (resolvedType === "word") {
      // 耳机可能挂在拆解/短语格，词头必须取配对的单词格，不能解析按钮所在格。
      const targetWord = extractTargetWord(context && context.wordCell ? context.wordCell : cell);
      if (!targetWord) return null;
      // 短语格空着时不许诺连播：整列存在不代表这一行有切片。
      const followsChunk = Boolean(
        context && context.chunkCell && extractTargetSentence(context.chunkCell)
      );
      return {
        resolvedType,
        label: targetWord,
        itemCount: followsChunk ? 2 : 1,
        followsChunk
      };
    }

    if (resolvedType === "chunk") {
      const chunkText = extractTargetSentence(cell);
      const wordCell = context ? context.wordCell : null;
      const targetWord = wordCell ? extractTargetWord(wordCell) : "";
      const label = chunkText || targetWord;
      return label ? { resolvedType, label, itemCount: 1 } : null;
    }

    if (resolvedType === "phoneme" || resolvedType === "phonetic") {
      const phonemes = extractAllTargetPhonemes(cell, resolvedType === "phonetic");
      const wordCell = context ? context.wordCell : null;
      const targetWord = wordCell ? extractTargetWord(wordCell) : "";
      if (phonemes.length === 0 && !targetWord) return null;
      return {
        resolvedType: "phoneme",
        label: phonemes.length > 0 ? phonemes.map((p) => `/${p}/`).join(" ") : targetWord,
        itemCount: Math.max(phonemes.length, 1),
      };
    }

    if (resolvedType === "sentence") {
      const sentenceText = extractTargetSentence(cell);
      return sentenceText ? { resolvedType, label: sentenceText, itemCount: 1 } : null;
    }

    return null;
  }

  resolveAudioForCell(cell, type, context) {
    if (!cell || !type) return null;
    // Central listening rows retain the original article's isolated audio directory.
    const contextFile = context?.file || this.app?.workspace?.getActiveFile?.();
    const contextPath = typeof contextFile === "string" ? contextFile : contextFile?.path || "";
    const centralListening = /(?:^|\/)02\. word\/m\. 剑雅听力真题\/音义词块\.md$/i.test(contextPath);
    const source = context?.wordCell?.querySelector?.(".hd-listening-source")?.dataset.source
      || (centralListening ? sectionSourceOf(context?.wordCell) : "");
    if (source && listeningNotePath(source)) context = { ...context, file: { path: source } };

    let resolvedType = type;
    if (resolvedType === "auto") {
      const p = extractTargetPhoneme(cell);
      if (p && (isKnownPhoneme(p) || findPhonemeAudioPath(this.app, p))) {
        resolvedType = "phoneme";
      } else {
        const w = extractTargetWord(cell);
        if (w && findAudioFilePath(this.app, w, context && context.file)) {
          resolvedType = "word";
        } else {
          const s = extractTargetSentence(cell);
          if (s && findSentenceAudioPath(this.app, s, context && context.file)) {
            resolvedType = "sentence";
          } else if (p) {
            resolvedType = "phoneme";
          } else {
            resolvedType = "word";
          }
        }
      }
    }

    if (resolvedType === "word") {
      // 耳机可能挂在拆解/短语格，词头必须取配对的单词格，不能解析按钮所在格。
      const targetWord = extractTargetWord(context && context.wordCell ? context.wordCell : cell);
      if (!targetWord) return null;
      const foundPath = findAudioFilePath(this.app, targetWord, context && context.file);
      const paths = foundPath ? [foundPath] : [];
      return {
        resolvedType: "word",
        label: targetWord,
        paths
      };
    } else if (resolvedType === "chunk") {
      const chunkText = extractTargetSentence(cell);
      const wordCell = context ? context.wordCell : null;
      const targetWord = wordCell ? extractTargetWord(wordCell) : "";
      if (!chunkText && !targetWord) return null;
      const foundPath = findChunkAudioPath(this.app, chunkText, targetWord, context && context.file);
      return {
        resolvedType: "chunk",
        label: chunkText || targetWord,
        paths: foundPath ? [foundPath] : []
      };
    } else if (resolvedType === "phoneme" || resolvedType === "phonetic") {
      const phonemes = extractAllTargetPhonemes(cell, resolvedType === "phonetic");
      const wordCell = context ? context.wordCell : null;
      const targetWord = wordCell ? extractTargetWord(wordCell) : "";

      if (phonemes.length === 0 && !targetWord) return null;

      const displayLabel = phonemes.length > 0 ? phonemes.map(p => `/${p}/`).join(" ") : targetWord;
      const foundPaths = [];
      for (const p of phonemes) {
        const pPath = findPhonemeAudioPath(this.app, p, context && context.file);
        if (pPath) foundPaths.push(pPath);
      }
      if (foundPaths.length === 0 && targetWord) {
        const wPath = findAudioFilePath(this.app, targetWord, context && context.file);
        if (wPath) foundPaths.push(wPath);
      }
      return {
        resolvedType: "phoneme",
        label: displayLabel,
        paths: foundPaths
      };
    } else if (resolvedType === "sentence") {
      const sentenceText = extractTargetSentence(cell);
      if (!sentenceText) return null;
      const foundPath = findSentenceAudioPath(this.app, sentenceText, context && context.file);
      return {
        resolvedType: "sentence",
        label: sentenceText,
        paths: foundPath ? [foundPath] : []
      };
    }

    return null;
  }

  // ==================== 缺失音频体检 ====================
  // 逐格解析当前笔记的音频列，列出解析不到文件的单元格。
  // 对应知识库「交付前必须核验词块双声音频与短语切片全覆盖」的要求。
  reportMissingAudio() {
    const contexts = this.getManagedContexts();
    if (!contexts.length) {
      new Notice("没有找到可体检的 Markdown 视图", 2000);
      return;
    }

    const missing = [];
    let checked = 0;

    for (const ctx of contexts) {
      for (const table of ctx.root.querySelectorAll("table")) {
        if (this.isAudioExcluded(table, ctx.file)) continue;

        const headerRow = table.querySelector("thead tr, tr:first-child");
        if (!headerRow) continue;
        const headers = headerRow.querySelectorAll("th, td");
        if (!headers.length) continue;

        const colTypes = [];
        for (let c = 0; c < headers.length; c++) colTypes.push(this.getColumnAudioType(headers[c]));
        const wordColIndex = this.getWordColIndex(headers);

        for (const row of getDataRows(table)) {
          const cells = row.querySelectorAll("td");
          for (let c = 0; c < colTypes.length; c++) {
            if (!colTypes[c] || c >= cells.length) continue;
            const cell = cells[c];
            const wordCell = wordColIndex !== -1 ? cells[wordColIndex] : null;
            checked++;
            let res = null;
            try {
              res = this.resolveAudioForCell(cell, colTypes[c], { wordCell, table });
            } catch (err) {
              console.error("[TableSound] 体检解析失败:", err);
            }
            if (res && res.paths && res.paths.length > 0) continue;

            const label = (cell.textContent || "").replace(/[🎧🔊]/g, "").trim().slice(0, 40);
            missing.push({
              file: ctx.file ? ctx.file.path : "(未知文件)",
              column: normalizeHeaderText(headers[c]),
              text: label || "(空单元格)",
            });
          }
        }
      }
    }

    if (!missing.length) {
      new Notice(`音频体检通过：${checked} 个单元格全部可解析`, 3000);
      console.info(`[TableSound] 音频体检通过，共检查 ${checked} 个单元格。`);
      return;
    }

    console.group(`[TableSound] 音频体检：${checked} 个单元格中有 ${missing.length} 个缺失`);
    console.table(missing);
    console.groupEnd();
    new Notice(`音频体检：${missing.length}/${checked} 个单元格缺失音频，明细见控制台`, 5000);
  }
}

module.exports = { ResolveMethods };

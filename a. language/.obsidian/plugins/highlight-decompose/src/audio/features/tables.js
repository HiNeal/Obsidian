const { PLAYING_CELL_CLASS, PLUGIN_CHROME_SELECTOR, WORD_COL_CLASS } = require("../constants");
const { createAudioBtn, getAudioBindingKey, getDataRows, isPhraseHeaderText, isVocabularyHeaderRow } = require("../dom");
const { isKnownPhoneme, isPurePhonemeCell } = require("../extract");
const { getAudioColumnLookup, getSettings } = require("../settings");
const { isPluginExcludedNote } = require("../../shared/notes");

class TableMethods {
  updateManagedTables(tables = null) {
    this.syncViewObservers();
    // 重建后的新节点先认领高亮，后面的解绑逻辑才知道哪一格不能擦。
    this.reassertPlayingHighlight();
    const contexts = this.getManagedContexts();
    if (!contexts.length) return;

    for (const ctx of contexts) {
      const scoped = tables === null
        ? Array.from(ctx.root.querySelectorAll("table"))
        : tables.filter((table) => ctx.root.contains(table));

      for (let i = 0; i < scoped.length; i++) {
        try {
          this.processTable(scoped[i], ctx);
        } catch (err) {
          console.error("[TableSound] Error processing table index " + i + ":", err);
        }
      }
    }

    this.reassertPlayingHighlight();
  }

  processTable(table, ctx) {
    const file = ctx && ctx.file ? ctx.file : null;

    // 表头黑名单：整表判定为纯文本分析，不挂耳机，保持纯净文本。
    if (this.hasExcludedHeader(table)) {
      this.clearAudioFromTable(table);
      return;
    }

    // 路径黑名单：整篇不挂耳机。
    if (this.isPathExcluded(file)) {
      this.clearAudioFromTable(table);
      return;
    }

    const headerRow = table.querySelector("thead tr, tr:first-child");
    if (!headerRow) return;
    const headers = headerRow.querySelectorAll("th, td");
    if (headers.length < 1) return;

    // 首次打开表格时耳机推迟一帧挂载；已有绑定的编辑刷新仍走同步 O(1) 指纹快路。
    if (table.querySelector("[data-audio-bound]")) {
      this.bindAudioButtons(table, ctx);
    } else {
      this.queueAudioBinding(table);
    }
  }

  getWordColIndex(headers) {
    if (!headers) return -1;
    for (let i = 0; i < headers.length; i++) {
      const text = (headers[i].textContent || "").replace(/[\*_~`#]/g, "").trim();
      if (
        getAudioColumnLookup().get(text) === "word" ||
        text.includes("单词") ||
        text.includes("答案词") ||
        text.includes("核心词") ||
        text.includes("考点词") ||
        text.includes("词块") ||
        text.includes("介词") ||
        text.includes("连词") ||
        text.includes("副词") ||
        isPhraseHeaderText(text) ||
        text.toLowerCase().includes("word") ||
        text.includes("答案") ||
        text.includes("语料") ||
        text.includes("例子") ||
        text.includes("表达")
      ) {
        return i;
      }
    }
    return -1;
  }

  clearAudioFromTable(table) {
    const btns = table.querySelectorAll(PLUGIN_CHROME_SELECTOR);
    for (let i = 0; i < btns.length; i++) btns[i].remove();
    const boundCells = table.querySelectorAll("[data-audio-bound], [data-sentence-audio-bound]");
    for (let i = 0; i < boundCells.length; i++) {
      boundCells[i].removeAttribute("data-audio-bound");
      boundCells[i].removeAttribute("data-sentence-audio-bound");
      boundCells[i].removeAttribute("data-audio-source-key");
      boundCells[i].__tableSoundPlayFn = null;
      boundCells[i].style.cursor = "";
      // 解绑按钮不等于播放结束：正在播放的那一格必须保住浅绿色高亮。
      if (!this.isPlayingCell(boundCells[i])) {
        boundCells[i].classList.remove(PLAYING_CELL_CLASS);
      }
    }
  }

  removeAudioFromCell(cell) {
    const btns = cell.querySelectorAll(PLUGIN_CHROME_SELECTOR);
    for (let i = 0; i < btns.length; i++) btns[i].remove();
    cell.removeAttribute("data-audio-bound");
    cell.removeAttribute("data-sentence-audio-bound");
    cell.removeAttribute("data-audio-source-key");
    cell.__tableSoundPlayFn = null;
    cell.style.cursor = "";
    if (!this.isPlayingCell(cell)) {
      cell.classList.remove(PLAYING_CELL_CLASS);
    }
  }

  getColumnAudioType(headerCell) {
    if (!headerCell) return null;
    const raw = (headerCell.textContent || "").trim();
    // 清洗掉 Markdown 格式符号 (如 **单词** -> 单词)
    const clean = raw.replace(/[\*_~`#]/g, "").trim();

    // 0. 词汇表（`单词 | 短语 | 拆解 | 音标`）的音标列只供悬浮卡片读取，不挂耳机。
    if (clean === "音标" && isVocabularyHeaderRow(headerCell.closest("tr"))) return null;

    // 1. 优先精确匹配白名单
    const matched = getAudioColumnLookup().get(clean);
    // 「短语」既是第一列的词条列表头，也是第二列的短语（原意群）列表头：第一列算 word，第二列起算 chunk。
    // 意群列在首列的表（`意群 | 短语 | 释义`）里，「短语」是第二列的词条列。
    const firstHeaderCell = headerCell.parentElement && headerCell.parentElement.firstElementChild;
    const chunkLeads = !!firstHeaderCell && firstHeaderCell !== headerCell
      && (firstHeaderCell.textContent || "").replace(/[\*_~`#]/g, "").trim() === "意群";
    if (matched === "chunk" && clean === "短语" && headerCell.parentElement && (firstHeaderCell === headerCell || chunkLeads)) return "word";
    if (matched) return matched;

    // 2. 包含“单词”“核心词”或以“短语”收尾的表头默认判定为 word 列。
    // 必须排在黑名单之前：词书表头形如「行为动作单词」「滑动练习单词」，
    // 前缀是主题名，可能正好撞上「动作」「说明」这类给解释列准备的黑名单词；
    // 一旦让黑名单先跑，整列会被判空，耳机与 R / L 标记会一起消失。
    // 带「单词 / 核心词」或以「短语」收尾的表头是词条列，语义上已无歧义，直接放行。
    if (clean.includes("单词") || clean.includes("答案词") || clean.includes("核心词") || clean === "表达" || isPhraseHeaderText(clean)) {
      return "word";
    }

    // 2.5 第二列是「短语」，第一列就是词条列——表头叫什么随便（系列名、分类名都算）。
    // 这条必须排在黑名单与斜杠规则之前，否则两头都会漏：
    //   - 黑名单：「for 系列（目的 ➔ 原因 / 解释 / 追求）」「解释副词」撞上「解释」被判空，整列没按钮；
    //   - 斜杠规则：「to 系列（方向 ➔ 目标 / 顺应 / 导致）」里的 / 是顿隔符不是音标公式，
    //     被判成 auto 后整表没有 word 列，短语列于是保住了本该并入词条格连播的耳机。
    // 放在白名单之后是关键：音标 / 清音 / 浊音 这类发音列已在第 1 条精确匹配走，不会误伤。
    const ownRow = headerCell.closest("tr");
    if (ownRow) {
      const ownCells = ownRow.querySelectorAll("th, td");
      if (ownCells.length >= 2 && headerCell === ownCells[0]) {
        const secondClean = (ownCells[1].textContent || "").replace(/[\*_~`#]/g, "").trim();
        if (getAudioColumnLookup().get(secondClean) === "chunk") return "word";
      }
    }

    // 3. 检查解释说明类黑名单 (如 "发音技巧", "两个接触面", "释义", "解释", "拆解", "机制" 等坚决排除)
    for (const exKw of getSettings().excludeColumnKeywords) {
      if (clean.includes(exKw)) {
        return null;
      }
    }

    // 4. 用户核心规则：只要表头包含“音”（连音、加音、爆破音、浊音、清音、读音、发音、语音、音标、音素、省音、重音等），判定为 auto 音频列
    if (clean.includes("音")) {
      return "auto";
    }

    // 5. 包含音标斜杠或加号公式（如 /ə/ + /r/、/u:/ + /w/）判定为 auto 音频列
    if (clean.includes("/") || clean.includes("+")) {
      return "auto";
    }

    // 6. 双列表格智能推断：如果表格只有 2 列，且第二列为解释/说明/释义列，
    // 第一列非解释黑名单时，判定为 auto 音频列（挂载耳机与朗读）
    const headerRow = headerCell.closest("tr");
    if (headerRow) {
      const rowHeaders = headerRow.querySelectorAll("th, td");
      if (rowHeaders.length === 2 && headerCell === rowHeaders[0]) {
        const nextClean = (rowHeaders[1].textContent || "").replace(/[\*_~`#]/g, "").trim();
        if (nextClean.includes("解释") || nextClean.includes("说明") || nextClean.includes("释义") || nextClean.includes("原理") || nextClean.includes("机制")) {
          return "auto";
        }
      }
    }

    return null;
  }

  lastVisibleColumnIndex(headers, lastColIndex) {
    const plugins = this.app.plugins;
    if (!plugins || !plugins.enabledPlugins || !plugins.enabledPlugins.has("highlight-decompose")) {
      return lastColIndex;
    }
    const names = Array.from(headers).map((h) => (h.textContent || "").replace(/[\*_~`#]/g, "").trim());
    const hidden = new Set();
    const hasChunk = names.includes("短语") || names.includes("意群");
    const table = headers[0] && headers[0].closest ? headers[0].closest("table") : null;
    // 03. phrase 与 02. word 单词表的「释义」列是直接显示的列（后者拆解列才是卡片源），不能算作隐藏列。
    const meaningVisible = (table && table.classList.contains("hd-meaning-visible")) || names.some((n) => /拆解|英意/.test(n));
    names.forEach((name, i) => /拆解|英意/.test(name) && hasChunk && hidden.add(i));
    // 评分列在显示层隐藏, 耳机不能挂到它上面
    if (names.includes("评分")) hidden.add(names.indexOf("评分"));
    if (names.includes("同义词")) hidden.add(names.indexOf("同义词"));
    if (names.some((n) => /拆解|英意/.test(n)) && hasChunk && names.includes("音标")) hidden.add(names.indexOf("音标"));
    if ((names[1] === "短语" || names[1] === "意群") && names.includes("释义") && !meaningVisible) hidden.add(names.indexOf("释义"));
    if (names[1] === "释义" && !meaningVisible) hidden.add(1);
    for (let i = lastColIndex; i >= 0; i--) if (!hidden.has(i)) return i;
    return lastColIndex;
  }

  mountAudioToCell(cell, type, context) {
    if (!cell || !type) return;

    const bindingKey = getAudioBindingKey(cell, type, context);
    const directBtn = cell.querySelector(":scope > .audio-playback-btn");
    if (
      cell.dataset.audioBound === type &&
      cell.dataset.audioSourceKey === bindingKey &&
      directBtn
    ) {
      return;
    }

    // 首次挂载和编辑刷新只解析文字；真正点击时再查找音频文件。
    const metadata = this.resolveAudioMetadataForCell(cell, type, context);
    if (!metadata) {
      this.removeAudioFromCell(cell);
      return;
    }

    const { label } = metadata;
    const tooltip = metadata.followsChunk
      ? `🎧 播放 [${label}] → 本行短语原声（播放时点它可暂停 / 继续）`
      : `🎧 播放 [${label}]（播放时点它可暂停 / 继续）`;
    cell.__tableSoundPlayFn = () => this.playSingleCellAudio(cell, type, context);

    // 清理旧按钮
    const existingDirectAudio = cell.querySelectorAll(":scope > .audio-playback-btn");
    for (const audioButton of existingDirectAudio) audioButton.remove();

    const btn = createAudioBtn(tooltip, () => {
      if (typeof cell.__tableSoundPlayFn === "function") cell.__tableSoundPlayFn();
    });
    cell.appendChild(btn);

    // 绑定单元格点击事件；清理并重新挂载按钮时不重复注册监听器。
    cell.style.position = "relative";
    const wrapper = cell.querySelector(".table-cell-wrapper");
    if (wrapper) wrapper.style.position = "relative";
    // 正文区不挂任何监听：单元格本来就是编辑区域，点它就该正常进编辑模式。
    // 播放与暂停全部收进 🎧 按钮，与编辑动作天然分开。
    // 早期版本在这里留过 inline cursor:pointer，必须清掉，否则光标仍在暗示可点播放。
    cell.style.cursor = "";
    cell.dataset.audioBound = type;
    cell.dataset.audioSourceKey = bindingKey;
  }

  // 单词列不换行：表头含「单词 / 核心词」的那一列打上 WORD_COL_CLASS，
  // 样式只作用在这个类上（见 styles.css），普通表格不受影响。
  markWordColumn(table, headers) {
    let wordCol = -1;
    for (let c = 0; c < headers.length; c++) {
      const clean = (headers[c].textContent || "").replace(/[\*_~`#]/g, "").trim();
      if (clean.includes("单词") || clean.includes("答案词") || clean.includes("核心词")) { wordCol = c; break; }
    }
    for (const row of table.querySelectorAll("tr")) {
      const cells = row.querySelectorAll("th, td");
      for (let i = 0; i < cells.length; i++) cells[i].classList.toggle(WORD_COL_CLASS, i === wordCol);
    }
  }

  // Base reference notes only need the matching entry, not audio resolution.
  bindBaseReferenceEntry(table) {
    if (!table.classList.contains("hd-base-examples-table")) return;
    table.classList.add("ts-word-led");
    for (const row of getDataRows(table)) {
      const cell = row.cells[0];
      if (!cell || cell.querySelector(":scope > .audio-playback-btn")) continue;
      const btn = createAudioBtn("耳机", () => {});
      btn.setAttribute("aria-disabled", "true");
      cell.appendChild(btn);
      cell.dataset.audioBound = "base-reference";
    }
  }

  bindAudioButtons(table, ctx = null) {
    const contextFile = (ctx && ctx.file) || (this.getManagedContexts().find((c) => c.root.contains(table)) || {}).file;
    if (isPluginExcludedNote(contextFile)) {
      this.clearAudioFromTable(table);
      return;
    }
    const headerRow = table.querySelector("thead tr, tr:first-child");
    if (!headerRow) return;
    const headers = headerRow.querySelectorAll("th, td");
    if (!headers.length) return;
    this.markWordColumn(table, headers);

    if (this.isAudioExcluded(table, contextFile)) {
      this.clearAudioFromTable(table);
      return;
    }

    // 1. 解析每一列的白名单类型，并检测表头是否为常规文字表头
    const colTypes = [];
    let wordColIndex = this.getWordColIndex(headers);
    let hasAnyWhitelistedCol = false;
    let hasAnyStandardHeader = false;

    for (let c = 0; c < headers.length; c++) {
      const type = this.getColumnAudioType(headers[c]);
      colTypes.push(type);
      if (type) hasAnyWhitelistedCol = true;

      const raw = (headers[c].textContent || "").replace(/[\*_~`#]/g, "").trim();
      if (raw.length > 0 && !isKnownPhoneme(raw) && !getAudioColumnLookup().has(raw)) {
        hasAnyStandardHeader = true;
      }
    }

    // 2. 如果整表没有任何一列命中白名单：
    if (!hasAnyWhitelistedCol) {
      if (!hasAnyStandardHeader) {
        const allCells = Array.from(table.querySelectorAll("th, td"));
        const purePhonemeCells = new Set();

        for (let i = 0; i < allCells.length; i++) {
          const cell = allCells[i];
          if (isPurePhonemeCell(cell)) {
            purePhonemeCells.add(cell);
          }
        }

        if (purePhonemeCells.size >= 8) {
          const rows = getDataRows(table);
          for (let i = 0; i < allCells.length; i++) {
            const cell = allCells[i];
            if (purePhonemeCells.has(cell)) {
              const rowIndex = rows.indexOf(cell.closest("tr"));
              if (rowIndex === -1) {
                // 第一行仍是表头：不在表头放耳机。
                this.removeAudioFromCell(cell);
              } else {
                this.mountAudioToCell(cell, "phoneme", {
                  table,
                  colIndex: cell.cellIndex,
                  rowIndex,
                  file: contextFile,
                });
              }
            } else {
              this.removeAudioFromCell(cell);
            }
          }
          return;
        }
      }

      this.clearAudioFromTable(table);
      return;
    }

    // 3. 表头只保留列名；音频只由正文单元格里的耳机按钮触发。
    for (let c = 0; c < headers.length; c++) {
      this.removeAudioFromCell(headers[c]);
    }

    // 4. 判定是否为发音/音标专项目录或表格
    // 词汇表(单词 | 音标 | ... | 英意)的音标列只供悬浮卡片读取, 不能让整表被当成发音表。
    const isVocabTable = isVocabularyHeaderRow(headerRow);
    const isPhoneticsTable = colTypes.some((t) => t === "phoneme" || t === "phonetic") ||
      !isVocabTable && Array.from(headers).some((h) => {
        const text = (h.textContent || "").replace(/[\*_~`#]/g, "").trim();
        return text === "清音" || text === "浊音" || text === "清辅音" || text === "浊辅音" || text === "音标";
      });

    const isPronunciationDoc = this.isPronunciationFile(contextFile);

    const rows = getDataRows(table);

    if (isPhoneticsTable) {
      // 发音专项目录：按列白名单类型分别挂载（如清音列挂清音、浊音列挂浊音、音标列挂音标）
      for (let r = 0; r < rows.length; r++) {
        const cells = rows[r].querySelectorAll("td");
        for (let c = 0; c < cells.length; c++) {
          const cell = cells[c];
          const type = colTypes[c];
          if (!type || (type !== "phoneme" && type !== "phonetic")) {
            this.removeAudioFromCell(cell);
            continue;
          }
          this.mountAudioToCell(cell, type, {
            table,
            colIndex: c,
            rowIndex: r,
            file: contextFile,
          });
        }
      }
      return;
    }

    // 音标篇只给音标表与例词/例句表挂耳机，基础机制表保持纯文本。
    if (isPronunciationDoc && !this.isPronunciationExampleTable(table)) {
      this.clearAudioFromTable(table);
      return;
    }

    // 5. 非发音通用表格（词汇/短语/语法/阅读/听力等）：
    // 耳机挂在第一列（单词/词块格），悬浮才显示；只有 01. base 仍挂在最后一个可见列。
    // 播放严格按序连播：先念单词/短语标准发音，再念短语语流原声
    const lastColIndex = headers.length - 1;
    wordColIndex = this.getWordColIndex(headers);
    if (wordColIndex === -1 || wordColIndex === lastColIndex) {
      const candidateIndex = Array.from(headers).findIndex((h, idx) => {
        if (idx === lastColIndex) return false;
        const text = (h.textContent || "").replace(/[\*_~`#]/g, "").trim();
        return !(idx >= 1 && (text.includes("短语") || text.includes("意群"))) && !text.includes("例子");
      });
      if (candidateIndex !== -1) wordColIndex = candidateIndex;
      else if (wordColIndex === -1) wordColIndex = 0;
    }
    const chunkColIndex = Array.from(headers).findIndex((h, idx) => {
      const text = (h.textContent || "").replace(/[\*_~`#]/g, "").trim();
      return (idx >= 1 && (text.includes("短语") || text.includes("意群"))) || text.includes("语块") || text.includes("Chunk");
    });

    // highlight-decompose 会把部分列收起、改为悬浮卡片（规则须与它的 hiddenColumnsFor 一致）：
    // 拆解列；短语表的「释义」列；第 2 列为「释义」的释义列。
    // 耳机挂到最后一个仍可见的列上，否则会跟着被收起的列一起消失。
    // 01. base 以外的笔记（以及任何带「拆解」列的词汇表）挂在单词列，
    // 悬浮该单词格时才显示（见 styles.css 的 table.ts-word-led）。
    const isWordLed = !this.isBaseFile(contextFile) ||
      this.isPhonemesFile(contextFile) ||
      Array.from(headers).some((h) => (h.textContent || "").replace(/[\*_~`#]/g, "").trim().match(/拆解|英意/));
    table.classList.toggle("ts-word-led", isWordLed && wordColIndex !== -1);
    const audioColIndex = isWordLed && wordColIndex !== -1
      ? wordColIndex
      : this.lastVisibleColumnIndex(headers, lastColIndex);

    for (let r = 0; r < rows.length; r++) {
      const cells = rows[r].querySelectorAll("td");
      const wordCell = wordColIndex !== -1 && wordColIndex < cells.length ? cells[wordColIndex] : null;
      const chunkCell = chunkColIndex !== -1 && chunkColIndex < cells.length ? cells[chunkColIndex] : null;

      for (let c = 0; c < cells.length; c++) {
        const cell = cells[c];
        if (c === audioColIndex) {
          this.mountAudioToCell(cell, "word", {
            wordCell,
            chunkCell,
            table,
            colIndex: c,
            rowIndex: r,
            file: contextFile,
          });
        } else {
          this.removeAudioFromCell(cell);
        }
      }
    }
  }
}

module.exports = { TableMethods };

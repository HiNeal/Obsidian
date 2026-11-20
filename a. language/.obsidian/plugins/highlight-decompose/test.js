// 纯函数单元测试：node test.js
// 这些函数不碰 DOM，却是最容易藏隐蔽 bug 的地方（slug 归一化、设置解析）。
const Module = require("module");

// main.js 顶部 require("obsidian")，在 node 里跑需要一个最小桩。
const obsidianStub = {
  MarkdownView: class {},
  TFile: class {},
  Platform: { isMobile: false },
  Plugin: class { },
  PluginSettingTab: class { },
  Setting: class { },
  Notice: class { },
  setIcon: () => {},
};
const originalLoad = Module._load;
Module._load = function (request) {
  if (request === "obsidian") return obsidianStub;
  return originalLoad.apply(this, arguments);
};

const {
  extractTargetWord, toSlug, parseCsvList, serializeCsvList,
  parseGroupedText, serializeGroupedText,
  parseListText,
  DEFAULT_SETTINGS, AUDIO_COLUMN_TYPES, pairChunkColumnWithWord,
  VAULT_PREFIX, AUDIO_ROOT,
  readingNotePath, senseContext, chunkMatchesContext, parseTables,
  readingSenseMatches, bindReadingSenses, sourceHighlights, appendMeaningInline,
  libraryKind,
  definitionOnly, hoverElement, contextCardColumn,
} = require("./main.js").__test__;
const { nearestSense, parseSenseId, parseEnglishSenseId, englishSenseTarget } = require("./main.js").__test__;

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed++; return; }
  failures.push(`  ✗ ${name}\n      期望: ${e}\n      实际: ${a}`);
}

// Context cards belong to word / phrase libraries; grammar keeps its examples.
check("单词表意群进入卡片", contextCardColumn(["单词", "释义", "意群", "拆解"], "02. word/example.md"), 2);
check("短语表意群直接显示不进卡片", contextCardColumn(["短语", "释义", "意群"], "03. phrase/example.md"), -1);
check("未整理短语意群直接显示不进卡片", contextCardColumn(["短语", "释义", "意群"], "03. phrase/未整理短语.md"), -1);
check("兼容意群在首列与库内父目录", contextCardColumn(["意群", "单词", "释义"], "a. language/02. word/example.md"), 0);
check("兼容旧词表的短语列", contextCardColumn(["单词", "短语", "释义"], "02. word/example.md"), 1);
check("不隐藏语法表意群", contextCardColumn(["语法词条", "意群", "释义"], "04. grammer/example.md"), -1);
check("文章单词表意群同词表进入卡片", contextCardColumn(["单词", "释义", "意群"], "06. reading/example.md"), 2);
check("文章短语表意群同短语库直接显示", contextCardColumn(["短语", "释义", "意群"], "06. reading/example.md"), -1);
check("不把词头当成意群", contextCardColumn(["短语", "释义"], "03. phrase/example.md"), -1);
check("无独立释义列时保持旧显示", contextCardColumn(["单词", "短语", "拆解"], "02. word/example.md"), -1);

// Mobile shows the current row's definition, without IPA, anchors or English.
check("手机释义跳过音标和后续拆解", definitionOnly('/wɜːd/<br><br>n. 词; 话语<br>v. 措辞<br><br>记忆锚点<br><br>n. a unit of language'), 'n. 词; 话语<br>v. 措辞');
check("无音标时保留首段释义", definitionOnly('n. 地图<br><br>记忆锚点'), 'n. 地图');
check("兼容释义后的音标", definitionOnly('n. 小艇<br><br>/bəʊt/'), 'n. 小艇');
check("空释义不借用其他词条", definitionOnly(''), '');
check("只有音标时不冒充释义", definitionOnly('/wɜːd/'), '');
check("兼容大小写与自闭合换行", definitionOnly('/wɜːd/<BR /><BR />n. 词'), 'n. 词');

// ---- toSlug：文件名归一化 ----
check("小写化并下划线", toSlug("Life Jacket"), "life_jacket");
check("剥离 Markdown 记号", toSlug("**rough**"), "rough");
check("撇号转下划线", toSlug("don't"), "don_t");
check("折叠连续下划线", toSlug("a   b"), "a_b");
check("去掉首尾下划线", toSlug(" _word_ "), "word");
check("空输入", toSlug(""), "");
check("重音折叠 é→e", toSlug("sauté diced onions"), "saute_diced_onions");
check("重音折叠 ñ→n", toSlug("el niño phenomenon"), "el_nino_phenomenon");
check("连字符保留", toSlug("co-founder"), "co-founder");
check("连字符不生成多余下划线", toSlug("multiple-choice questions"), "multiple-choice_questions");

// ---- extractTargetWord：词头提取 ----
{
  const cell = (html) => ({ innerHTML: html, textContent: html,
    cloneNode: () => ({ innerHTML: html, textContent: html, querySelectorAll: () => [] }) });
  check("普通词头", extractTargetWord(cell("**instructor**<br><br>n. 教练")), "instructor");
  // 中文括注是词形说明，不能拼进词头，否则会去找 dinghies_dinghy.mp3 这种不存在的文件
  check("丢弃单数括注", extractTargetWord(cell("**dinghies** (单数 dinghy)<br><br>n. 小艇")), "dinghies");
  check("丢弃原形括注", extractTargetWord(cell("**cleansed** (原形 cleanse)<br><br>v. 清洁")), "cleansed");
  check("多词短语", extractTargetWord(cell("travel expenses<br><br>phr. 差旅费")), "travel expenses");
  check("丢弃英文括注", extractTargetWord(cell("**expenses** (travel expenses)<br><br>n. 开支")), "expenses");
  check("丢弃复数括注", extractTargetWord(cell("fungus (复数 fungi)<br><br>n. 真菌")), "fungus");
  check("释义不混入词头", extractTargetWord(cell("café<br><br>n. 咖啡馆")), "café");
}

// ---- 耳机在拆解/短语列时仍从单词列取词头并组成连播队列 ----
{
  const PluginClass = require("./main.js").TableSound;
  const plugin = new PluginClass();
  const cell = (html) => ({ innerHTML: html, textContent: html,
    cloneNode: () => ({ innerHTML: html, textContent: html, querySelectorAll: () => [] }) });
  const root = `${VAULT_PREFIX}${AUDIO_ROOT}/02. word/test/audio`;
  const wordPath = `${root}/helpful.mp3`;
  const chunkPath = `${root}/chunk_a_helpful_person.mp3`;
  const files = new Set([wordPath, chunkPath, `${root}/help,_-ful.mp3`]);
  plugin.app = {
    workspace: { getActiveFile: () => ({ path: `${VAULT_PREFIX}02. word/test.md` }) },
    vault: { getAbstractFileByPath: (path) => files.has(path) ? { path } : null },
  };
  const wordCell = cell("**helpful**<br><br>/ˈhelpfəl/<br><br>adj. 有帮助的");
  const chunkCell = cell("a <strong>helpful</strong> person");
  const decompositionCell = cell("help(词: 帮助), -ful(充满…的)<br>给人帮助");
  const context = { wordCell, chunkCell };
  check("拆解耳机标签使用单词词头",
    plugin.resolveAudioMetadataForCell(decompositionCell, "word", context).label, "helpful");
  check("拆解耳机先单词后短语，忽略同名拆解音频",
    plugin.resolveAudioForCell(decompositionCell, "word", context).paths, [wordPath, chunkPath]);
  check("双列表短语耳机也先单词后短语",
    plugin.resolveAudioForCell(chunkCell, "word", context).paths, [wordPath, chunkPath]);
  check("无配对单词格仍可直接播放词头",
    plugin.resolveAudioForCell(wordCell, "word", null).paths, [wordPath]);
  files.delete(wordPath);
  check("单词音频缺失时仍播放可用短语",
    plugin.resolveAudioForCell(decompositionCell, "word", context).paths, [chunkPath]);
  check("空单词格不误播拆解里的词根",
    plugin.resolveAudioForCell(decompositionCell, "word", { wordCell: cell(""), chunkCell }), null);

  // Real DOM cells have closest(); ordinary vocabulary tables must never infer
  // a listening source from an empty or unrelated preceding heading.
  files.add(wordPath);
  const inTable = (html, title = "") => {
    const table = { tagName: "TABLE", closest: () => root };
    const root = { querySelectorAll: () => title ? [{ tagName: "H1", textContent: title }, table] : [table] };
    return { ...cell(html), closest: () => table };
  };
  const vocabularyFile = { path: `${VAULT_PREFIX}02. word/test.md` };
  for (const title of ["", "02. 咨询办理/Accommodation Options"]) {
    const word = inTable("helpful", title);
    check(`普通词库不被分节标题重定向到听力目录: ${title || "无标题"}`,
      plugin.resolveAudioForCell(word, "word", { wordCell: word, chunkCell, file: vocabularyFile }).paths,
      [wordPath, chunkPath]);
  }
  const listeningWord = `${AUDIO_ROOT}/05. listening/02. Part One/Accommodation Options/audio/helpful.mp3`;
  const listeningChunk = `${AUDIO_ROOT}/05. listening/02. Part One/Accommodation Options/audio/chunk_a_helpful_person.mp3`;
  files.add(listeningWord);
  files.add(listeningChunk);
  const listeningCell = inTable("helpful", "02. Part One/Accommodation Options");
  check("听力集中词库仍按真实篇章分节定位原声目录",
    plugin.resolveAudioForCell(listeningCell, "word", {
      wordCell: listeningCell, chunkCell, file: { path: "02. word/m. 剑雅听力真题/音义词块.md" }
    }).paths, [listeningWord, listeningChunk]);
  const { sectionSourceOf } = require("./src/shared/notes");
  check("无标题表格不生成空的听力文章路径", sectionSourceOf(inTable("helpful")), "");
  const { extractTargetSentence } = require("./src/audio/extract");
  check("短语内加粗不拆开连字符词", extractTargetSentence(cell("a market-<strong>oriented</strong> economy")), "a market-oriented economy");
  check("短语内加粗不添加连字符前空格", extractTargetSentence(cell("an <strong>eco</strong>-friendly policy")), "an eco-friendly policy");

  // 短语表音频解析：短语表中第一列短语的音频文件使用 chunk_${slug}.mp3
  const phraseRoot = `${AUDIO_ROOT}/03. phrase/a. 剑雅通用短语/02-动作/audio`;
  const goForPath = `${phraseRoot}/chunk_go_for.mp3`;
  const meetDemandsPath = `${phraseRoot}/chunk_meet_someone_s_demands.mp3`;
  files.add(goForPath);
  files.add(meetDemandsPath);
  const phraseFile = { path: "03. phrase/a. 剑雅通用短语/02-动作.md" };
  const goForCell = cell("go for ...");
  check("短语表查找以 chunk_ 开头的短语音频",
    plugin.resolveAudioForCell(goForCell, "word", { wordCell: goForCell, file: phraseFile }).paths,
    [goForPath]);
  const meetCell = cell("meet ...'s demands");
  check("短语表带 ...'s 占位符匹配 someone_s 音频",
    plugin.resolveAudioForCell(meetCell, "word", { wordCell: meetCell, file: phraseFile }).paths,
    [meetDemandsPath]);
}

// ---- 设置文本序列化：往返一致 ----
check("逗号列表解析", parseCsvList("单词, 词汇 , 核心词"), ["单词", "词汇", "核心词"]);
check("逗号列表兼容中文逗号", parseCsvList("单词，词汇"), ["单词", "词汇"]);
check("逗号列表跳过空项", parseCsvList("a,,  ,b"), ["a", "b"]);
check("逗号列表往返", parseCsvList(serializeCsvList(["a", "b"])), ["a", "b"]);

// ---- 分组列名配置：类型 -> 名称数组 ----
check("分组解析", parseGroupedText("word: 单词, 词汇\nchunk: 短语"),
  { word: ["单词", "词汇"], chunk: ["短语"] });
check("分组忽略未知类型", parseGroupedText("word: 单词\n乱写: x\nnope: y"), { word: ["单词"] });
check("分组往返",
  parseGroupedText(serializeGroupedText(DEFAULT_SETTINGS.audioColumns)),
  DEFAULT_SETTINGS.audioColumns);
check("分组覆盖全部类型",
  Object.keys(DEFAULT_SETTINGS.audioColumns).sort(),
  [...AUDIO_COLUMN_TYPES].sort());
{
  // 反向索引不应出现同名列归属两个类型的情况。
  const seen = new Map();
  const dupes = [];
  for (const type of AUDIO_COLUMN_TYPES) {
    for (const name of DEFAULT_SETTINGS.audioColumns[type]) {
      if (seen.has(name)) dupes.push(name);
      seen.set(name, type);
    }
  }
  check("列名无跨类型重复", dupes, []);
  check("列名总数", seen.size, 39);
}

check("列表跳过空行", parseListText("a\n\n  b  \n"), ["a", "b"]);

// ---- 默认设置的形状 ----
check("揭示模式固定为悬停", Object.hasOwn(DEFAULT_SETTINGS, "revealMode"), false);
check("展示释义开关已移除", Object.hasOwn(DEFAULT_SETTINGS, "showMeaning"), false);
check("旧的单词表第二列选项已移除", "secondColumn" in DEFAULT_SETTINGS, false);
check("顺序播放条目间隔已移出设置", Object.hasOwn(DEFAULT_SETTINGS, "clipGapMs"), false);
check("音频根目录常量", AUDIO_ROOT, "20. resource");
check("库内路径前缀常量", VAULT_PREFIX, "a. language/");
// 这四项已固化为代码常量，不该再回流成可编辑设置
for (const key of ["legacyAudioRoots", "vaultPrefix", "audioRoot", "listeningPathPrefix",
                   "strictAudioMatch", "logMatchTier"]) {
  check(`${key} 已移出设置`, Object.hasOwn(DEFAULT_SETTINGS, key), false);
}

// 短语列不再自带耳机，其原声接在单词列之后连播；配对只看音频类型，不看表头字面。
check("词汇表 单词|短语|拆解", pairChunkColumnWithWord(["word", "chunk", null]),
      { wordColIndex: 0, chunkColIndex: 1 });
check("听力表 短语|音义词块", pairChunkColumnWithWord(["chunk", "word"]),
      { wordColIndex: 1, chunkColIndex: 0 });
check("无单词列时短语保留耳机", pairChunkColumnWithWord(["chunk", null]),
      { wordColIndex: -1, chunkColIndex: -1 });
check("无短语列不受影响", pairChunkColumnWithWord(["word", "phonetic"]),
      { wordColIndex: 0, chunkColIndex: -1 });

// 释义遮罩已整体移除（改由 highlight-decompose 的悬浮卡片显示），配置里不该再有遮罩项。
for (const key of ["maskColumns", "maskGap", "maskModes", "maskAllVisibleLeaves"]) {
  check(`${key} 已移出设置`, Object.hasOwn(DEFAULT_SETTINGS, key), false);
}

// 阅读语境直接来自当前行中文释义里的 ==...==, 不依赖插件 JSON。
{
  const PluginClass = require("./main.js");
  const path = "06. reading/example.md";
  const entry = { path, word: "figure", chunk: "was a major figure in American art" };
  const meaning = "n. 数字(数码, 金额); 身材(人影, 塑像); ==人物==<br>v. 认为; 描绘";
  check("阅读路径兼容库内父目录", readingNotePath("a. language/" + path), path);
  check("阅读练习路径", readingNotePath("a. language/10. practice/reading/example.md"), "10. practice/reading/example.md");
  check("非阅读目录不启用", readingNotePath("02. word/example.md"), "");
  check("短语忽略高亮、标点和大小写", senseContext("A **major** figure, in art"), "a major figure in art");
  check("原句中完整短语匹配", chunkMatchesContext(entry, "She was a major figure in American art."), true);
  check("其他句子不套用短语", chunkMatchesContext(entry, "He drew a figure."), false);
  check("匹配以单词为边界", chunkMatchesContext({ chunk: "art" }, "cart"), false);
  const plugin = new PluginClass();
  plugin.fileEntries = new Map([[path, [
    { ...entry, decomp: meaning, keys: new Set(["figure", "figures"]) },
    { ...entry, chunk: "a reclining figure", decomp: "n. 身材(人影, ==塑像==); 人物", keys: new Set(["figure", "figures"]) },
  ]]]);
  check("原文同词多行按所在句选行", plugin.lookup("figures", path, "I see a reclining figure here.").chunk, "a reclining figure");
  check("原文词头还原兼容", plugin.lookup("figures", path, "She was a major figure in American art.").chunk, entry.chunk);
  check("不跨笔记查卡片", plugin.lookup("figure", "06. reading/other.md"), null);

  class Element {
    constructor(tag = "div", options = {}) { this.tag = tag; this.cls = options.cls; this.children = []; this.attributes = {}; if (options.text) this.children.push(options.text); }
    createDiv(options) { return this.createEl("div", options); }
    createEl(tag, options) { const child = new Element(tag, options); this.children.push(child); return child; }
    appendText(text) { this.children.push(text); }
    setAttribute(key, value) { this.attributes[key] = value; }
    get textContent() { return this.children.map(c => typeof c === "string" ? c : c.textContent).join(""); }
  }
  {
    const originalElement = global.Element;
    global.Element = Element;
    try {
      const target = new Element("mark"), row = new Element("tr");
      let inTable = true, inTooltip = false;
      target.closest = selector => selector === ".hd-tooltip" ? (inTooltip ? {} : null)
        : selector === "tr.hd-row" ? (inTable ? row : null)
        : selector === "mark, .cm-highlight" ? target : null;
      check("进阶词头的高亮仍使用当前行卡片", hoverElement(target) === row, true);
      inTable = false;
      check("正文高亮仍使用当前文章的卡片", hoverElement(target) === target, true);
      inTable = true;
      inTooltip = true;
      check("卡片内高亮不触发另一张卡片", hoverElement(target), null);
    } finally {
      if (originalElement === undefined) delete global.Element;
      else global.Element = originalElement;
    }
  }
  {
    const marked = (root, tag) => root.children.flatMap(child => typeof child === "string" ? []
      : [...(child.tag === tag ? [child.textContent] : []), ...marked(child, tag)]);
    const definition = "n. ==数字==, 数码; **==人物==**; ==**塑像**==";
    plugin.tip = new Element();
    plugin.renderMeaning(definition);
    check("单词卡片保留全部阅读考过的译词", marked(plugin.tip, "mark"), ["数字", "人物", "塑像"]);
    check("释义高亮不显示 Markdown 标记", plugin.tip.textContent, "n. 数字, 数码; 人物; 塑像");
    check("释义高亮保留用户的嵌套加粗", marked(plugin.tip, "strong"), ["人物", "塑像"]);
    const mobile = new Element();
    appendMeaningInline(mobile, definition);
    check("移动端释义保留同一组阅读高亮", marked(mobile, "mark"), ["数字", "人物", "塑像"]);
    plugin.tip = new Element();
    plugin.renderMeaning(definition, { word: "figure", gloss: "zh#n99" });
    check("阅读编号无效时不回退累计高亮", marked(plugin.tip, "mark"), []);
    plugin.tip = new Element();
    plugin.renderMeaning(definition, { word: "figure", gloss: "en#n1" });
    check("阅读英文义项不附带中文累计高亮", marked(plugin.tip, "mark"), []);
    plugin.tip = new Element();
    plugin.renderMeaning(definition, null, false);
    check("文章无语境义或主词条参见其他词时不附带累计高亮", marked(plugin.tip, "mark"), []);
    check("文章隐藏累计高亮仍保留加粗", marked(plugin.tip, "strong"), ["人物", "塑像"]);
    plugin.tip = new Element();
    plugin.renderMeaning("n. 数字(数码); ==人物==<br>v. 认为", null, "context");
    check("文章原文卡片高亮本篇语境义项", marked(plugin.tip, "mark"), ["人物"]);
    plugin.tip = new Element();
    plugin.renderMeaning("n. 数字, 数码; 人物");
    check("未标注的释义不会自动扩展高亮", marked(plugin.tip, "mark"), []);
  }
  {
    const g = [{ pos: "n.", rows: ["main", "sub", "main"] }, { pos: "v.", rows: ["main", "sub", "sub", "main"] }];
    check("英文编号解析", parseEnglishSenseId("en#v1.2"), { pos: "v", main: 1, sub: 2 });
    check("裸 # 与 zh# 都按中文编号", [parseSenseId("#v1"), parseSenseId("zh#v1.2")], [{ pos: "v", main: 1, sub: 0 }, { pos: "v", main: 1, sub: 2 }]);
    check("中文编号不被当作英文编号", parseEnglishSenseId("zh#v1"), null);
    check("英文无词性编号跨词性累计", englishSenseTarget(g, parseEnglishSenseId("en#3")), { group: 1, row: 0 });
    check("英文带词性主项", englishSenseTarget(g, parseEnglishSenseId("en#v2")), { group: 1, row: 3 });
    check("英文子项", englishSenseTarget(g, parseEnglishSenseId("en#v1.2")), { group: 1, row: 2 });
    check("英文子项越界", englishSenseTarget(g, parseEnglishSenseId("en#v2.1")), null);
    check("英文主项越界", englishSenseTarget(g, parseEnglishSenseId("en#n3")), null);
  }
  check("可标主项", readingSenseMatches(["n. 数字", "n. 人物"], "人物").length, 1);
  check("括号内文字作为普通文字可标", readingSenseMatches(["v. 依偎(半隐半现地坐落)"], "半隐半现地坐落").length, 1);
  check("可按词性区分义项", readingSenseMatches(["n. 描绘", "v. 描绘"], "v. 描绘").map(h => h.lineIndex), [1]);
  check("未收录义项不误选", readingSenseMatches(["n. 画笔; 漆刷"], "不存在的义项").length, 0);
  check("无匹配时选字面最接近的义项", nearestSense(["adj. 空心的(凹陷的, 空洞的); 无意义的"], "中空的"), { lineIndex: 0, from: 5, to: 8 });
  check("完全无重合时不选义项", nearestSense(["n. 画笔; 漆刷"], "步枪"), null);
  const idLines = ["adj. 令人向往的(引起欲望的, 诱人的); 理想的", "n. 理想的人或物", "v. 依偎(半隐半现地坐落)"];
  const idAt = (id) => { const h = readingSenseMatches(idLines, id)[0]; return h && idLines[h.lineIndex].slice(h.from, h.to); };
  check("编号选词性主项", idAt("#adj1"), "令人向往的(引起欲望的, 诱人的)");
  check("编号选第二主项", idAt("#adj2"), "理想的");
  check("括号内分号也切分主项", idAt("#v2"), undefined);
  check("译词编号越界不回退主项", idAt("#adj1.2"), undefined);
  const caneLines = ["n. 茎; 藤条, 竹竿, 甘蔗; 主茎", "v. 用笞条打; 打败"];
  const caneAt = id => { const h = readingSenseMatches(caneLines, id)[0]; return h && caneLines[h.lineIndex].slice(h.from, h.to); };
  check("甘蔗只选组内第三个译词", caneAt("#n2.3"), "甘蔗");
  check("藤条与竹竿可以各自精确定位", [caneAt("#n2.1"), caneAt("#n2.2")], ["藤条", "竹竿"]);
  check("未指定译词时不高亮整个多译词组", caneAt("#n2"), undefined);
  check("译词越界不退回整组或近义匹配", caneAt("#n2.4"), undefined);
  check("无词性编号也能精确选译词", caneAt("#2.3"), "甘蔗");
  check("编号按词性区分", idAt("#n1"), "理想的人或物");
  check("编号越界不高亮", readingSenseMatches(idLines, "#adj3").length, 0);
  check("编号不走最接近匹配", nearestSense(idLines, "#adj1"), null);
  check("空注释安全返回空匹配", readingSenseMatches(["n. 画笔"], "").length, 0);
  check("未传注释安全返回空匹配", readingSenseMatches(["n. 画笔"], undefined).length, 0);

  // 文章不写 search 注释: 本篇查得到即为词条高亮, 查不到保持纯高亮。
  check("文章无注释时按本篇词条判断", plugin.hasReadingEntry("figures", null, path), true);
  check("注释为空时同样按本篇词条判断", plugin.hasReadingEntry("figures", { word: "figure", gloss: "  " }, path), true);
  check("带注释且收录的词能对上", plugin.hasReadingEntry("figures", { word: "figure", gloss: "人物" }, path), true);
  check("词库中未收录的词找不到", plugin.hasReadingEntry("unrecordedword", null, path), false);
  check("带注释但未收录的词找不到", plugin.hasReadingEntry("unrecordedword", { word: "unrecordedword", gloss: "假义" }, path), false);
  const classEl = text => { const el = { textContent: text, cls: {}, closest: () => null, dataset: {} }; el.classList = { toggle: (c, v) => { el.cls[c] = v; } }; return el; };
  const matchedEl = classEl("figures");
  bindReadingSenses({ matches: () => false, querySelectorAll: () => [matchedEl] }, "==figures==", path, (t, a) => plugin.hasReadingEntry(t, a, path));
  check("无注释但本篇收录即为词条高亮", [matchedEl.cls["hd-reading-word"], matchedEl.cls["hd-plain-highlight"]], [true, false]);
  const unrecordedEl = classEl("unrecordedword");
  bindReadingSenses({ matches: () => false, querySelectorAll: () => [unrecordedEl] }, "==unrecordedword==", path, (t, a) => plugin.hasReadingEntry(t, a, path));
  check("本篇未收录保持纯高亮", [unrecordedEl.cls["hd-reading-word"], unrecordedEl.cls["hd-plain-highlight"]], [false, true]);
  bindReadingSenses({ matches: () => false, querySelectorAll: () => [matchedEl] }, "==figures==<!--search: figure | -->", path, (t, a) => plugin.hasReadingEntry(t, a, path));
  check("清空注释后仍按本篇词条判断", matchedEl.cls["hd-reading-word"], true);

  const plainEl = { textContent: "plain", classList: { toggle: (cls, val) => { plainEl[cls] = val; } }, closest: () => null, dataset: {} };
  bindReadingSenses({ matches: () => false, querySelectorAll: () => [plainEl] }, "==plain==", path, (t, a) => plugin.hasReadingEntry(t, a, path));
  check("纯高亮不带 search 标记为 hd-plain-highlight", plainEl["hd-plain-highlight"], true);
  const annotatedEl = { textContent: "figures", classList: { toggle: (cls, val) => { annotatedEl[cls] = val; } }, closest: () => null, dataset: {} };
  bindReadingSenses({ matches: () => false, querySelectorAll: () => [annotatedEl] }, "==figures==<!--search: figure | 人物-->", path, (t, a) => plugin.hasReadingEntry(t, a, path));
  check("带注释的高亮不标记为 hd-plain-highlight", annotatedEl["hd-plain-highlight"], false);

  const table = "| 单词 | 短语 | 拆解 |\n| --- | --- | --- |\n| **==figure==** | major **figures** | /ˈfɪgə/<br><br>" + meaning + "<br><br>记忆锚点 |";
  const entries = parseTables(table, path);
  check("词形仍关联原形行", entries[0].keys.has("figures"), true);
  check("单词等级与释义标记互不干扰", entries[0].word, "figure");

  // 记忆列(第三列)在卡片里排回「音标 / 释义 / 记忆锚点 / 英文释义」。
  const memoryTable = "| 单词 | 释义 | 记忆 | 意群 | 拆解 |\n| --- | --- | --- | --- | --- |\n| weave | v. 织 | 线来回交错穿插 | **woven** into the literature | /wiːv/<br><br>v. form fabric |";
  check("记忆列插回释义之后", parseTables(memoryTable, path)[0].decomp, "/wiːv/<br><br>v. 织<br><br>线来回交错穿插<br><br>v. form fabric");
  // 同义词列只进 entry.syn, 不混进 decomp (否则会被当成英文释义块)。
  const synTable = "| 单词 | 释义 | 记忆 | 英意 | 意群 | 同义词 | 评分 |\n| --- | --- | --- | --- | --- | --- | --- |\n| curtail<br>/kɜːˈteɪl/ | v. 削减 | 截短 | v. reduce | **curtail** spending | v. reduce, shorten | 0 |";
  const synEntry = parseTables(synTable, path)[0];
  check("同义词列写入 syn", synEntry.syn, "v. reduce, shorten");
  check("同义词不混进卡片正文", synEntry.decomp.includes("shorten"), false);
  // 现行版式: 音标在单词格第二行, 「英意」列(原拆解)在意群之前。
  const englishTable = "| 单词 | 释义 | 记忆 | 英意 | 意群 |\n| --- | --- | --- | --- | --- |\n| weave<br>/wiːv/ | v. 织 | 线来回交错穿插 | v. form fabric | **woven** into the literature |";
  const english = parseTables(englishTable, path)[0];
  check("英意表头等同拆解", english.decomp, "v. 织<br><br>线来回交错穿插<br><br>v. form fabric");
  check("单词格第二行音标进卡片", english.ph, "wiːv");
  check("单词格音标不进词头", english.word, "weave");
}

// Passage marks must respect source annotations and code block boundaries.
{
  const content = `# 原文
Some people think that ==fairy==<!--search: fairy | 仙女--> ==tales==<!--search: tale | 故事--> are just stories to ==amuse== children.
\`\`\`mermaid
flowchart TD
==skip==
\`\`\`
`;
  const ranges = sourceHighlights(content);
  check("正确提取正文高亮及注释数量", ranges.length, 3);
  check("提取注释原形", ranges[0].annotation.word, "fairy");
  check("提取注释词义", ranges[0].annotation.gloss, "仙女");
  check("两项注释无需词形备份", ranges[0].annotation.surface, null);
  check("无注释高亮仍提取文字", ranges[2].text, "amuse");
  check("无注释高亮annotation为null", ranges[2].annotation, null);
  check("跳过代码块内的高亮", ranges.every(r => r.text !== "skip"), true);

  const q = "- ==one of the worst problems==<!--para: among the greatest threats / a major danger【反】--> here\n- ==plain== word";
  const pr = sourceHighlights(q);
  check("题目同义改写提取原文表达", pr[0].para, "among the greatest threats / a major danger【反】");
  check("题目同义改写不当作词义注释", pr[0].annotation, null);
  check("题目同义改写注释范围可隐藏", q.slice(pr[0].annotationRange.from, pr[0].annotationRange.to).startsWith("<!--para:"), true);
  check("普通高亮不带 para", pr[1].para, undefined);
  const sections = sourceHighlights("# 原文\n==source==\n# 题目\n==question==\n# 分析\n==review==");
  check("仅题目章节高亮始终采用悬停模式", sections.map(r => !!r.question), [false, true, false]);
  check("同义改写标记使用题目悬停模式", pr[0].question, true);
  const { questionBlanks } = require("./src/hd/reading");
  const blanks = "# 原文\n________\n# 题目\nfill " + "\\_".repeat(8) + " here\n`________` <!-- ________ -->\n```\n________\n```\n# 分析\n________";
  check("实线填空仅替换题目正文并跳过代码与注释", questionBlanks(blanks).map(r => blanks.slice(r.from, r.to)), ["\\_".repeat(8)]);
}

// 填空横线的编号读取(保留; 做题辅助的卡片与对错标记已移除)。
{
  const fill = "# 题目\n**Questions 31–32**: Complete the notes.\n- Pollution <!--q: 31-->" + "\\_".repeat(8) + " here\n- Other <!--q: 32-->" + "\\_".repeat(8) + "\n**答案**: yes, no\n";
  const { questionBlanks } = require("./src/hd/reading");
  check("填空渲染读取原试卷编号", questionBlanks(fill).map(r => r.number), ["31", "32"]);
  check("隐藏题号注释范围保持原文位置", questionBlanks(fill).map(r => fill.slice(r.labelFrom, r.labelTo)), ["<!--q: 31-->", "<!--q: 32-->"]);
  const trailing = "# 题目\n- " + "\\_".repeat(8) + "<!--q: 31--> is a problem";
  check("后置题号不影响Markdown列表解析", questionBlanks(trailing).map(r => [r.number, trailing.slice(r.labelFrom, r.labelTo)]), [["31", "<!--q: 31-->"]]);
}

async function checkCentralLibraries() {
  const PluginClass = require("./main.js");
  const plugin = new PluginClass();
  const path = "06. reading/example.md";
  const wordPath = "02. word/b. 剑雅阅读真题/03-动物保护.md";
  const phrasePath = "03. phrase/a. 剑雅通用短语/01-剑雅短语.md";
  const contextPath = "03. phrase/未整理短语.md";
  const table = (header, rows) => `| ${header} |\n| --- | --- | --- |\n${rows}`;
  const words = parseTables(table("单词 | 短语 | 拆解", "| cling | **cling** to life | v. ==紧握==; ==坚持== |"), wordPath);
  const phrases = parseTables(table("短语 | 短语 | 释义", "| put together | **putting together** reports | 汇编 |"), phrasePath);
  const contextPhrases = parseTables(table("短语 | 短语 | 释义", "| wild population | these **wild populations** | 野生种群 |"), contextPath);
  const local = parseTables(table("原文语境短语 | 短语 | 释义", "| coral reef | a **coral reef** | 珊瑚礁 |"), path);
  plugin.fileEntries = new Map([[path, local], [wordPath, words], [phrasePath, phrases], [contextPath, contextPhrases], ["06. reading/other.md", parseTables(table("单词 | 短语 | 拆解", "| absent | **absent** | 缺席 |"), "06. reading/other.md")]]);
  // 意群列在首列的新版式: `意群 | 单词 | 释义 | 拆解` 与 `意群 | 短语 | 释义`
  {
    const swappedWords = parseTables("| 意群 | 单词 | 释义 | 拆解 |\n| --- | --- | --- | --- |\n| **cling** to life | cling | v. ==紧握== | /klɪŋ/<br><br>v. ==紧握==<br><br>anchor |", wordPath);
    check("意群首列的单词表词头取第 2 列", swappedWords.map(e => e.word), ["cling"]);
    check("意群首列的单词表释义取拆解列", swappedWords[0].decomp.startsWith("/klɪŋ/"), true);
    check("意群首列的单词表仍收录意群里的加粗词形", swappedWords[0].keys.has("cling"), true);
    const swappedPhrases = parseTables("| 意群 | 短语 | 释义 |\n| --- | --- | --- |\n| **putting together** reports | put together | 汇编 |", phrasePath);
    check("意群首列的短语表词头取第 2 列", swappedPhrases.map(e => e.word), ["put together"]);
    check("意群首列的短语表释义取释义列", swappedPhrases[0].decomp, "汇编");
  }
  const libNote = "99. notes/example.md";
  check("文章不再查询中央词库", plugin.lookup("put together", path), null);
  check("本篇查询不借用中央单词", plugin.lookup("cling", path, "", true), null);
  check("阅读卡片回退 02. word 词库", plugin.lookup("cling", path)?.fromLibrary, true);
  check("中央词库支持原文不规则过去式", plugin.lookup("clung", libNote).word, "cling");
  check("中央词库保留多个语境义高亮", plugin.lookup("cling", libNote).decomp, "v. ==紧握==; ==坚持==");
  check("中央短语库可直接查询", plugin.lookup("put together", libNote).word, "put together");
  check("迁出的语境短语库可直接查询", plugin.lookup("wild population", libNote).decomp, "野生种群");
  check("语境短语原文变形可查询", plugin.lookup("wild populations", libNote).word, "wild population");
  check("语境短语库路径识别", libraryKind(contextPath), "context");
  check("语境短语库兼容父目录", libraryKind("a. language/" + contextPath), "context");
  check("本文语境短语仍可查询", plugin.lookup("coral reef", path).word, "coral reef");
  check("不借用其他阅读文章", plugin.lookup("absent", path), null);
  plugin.fileEntries.delete(phrasePath);
  plugin.libraryRevision++;
  check("删除短语分册立即撤销查询", plugin.lookup("put together", libNote), null);
  plugin.fileEntries.set(phrasePath, phrases);
  plugin.fileEntries.set(contextPath, [...contextPhrases, ...parseTables(table("短语 | 短语 | 释义", "| put together | **putting together** reports | 语境库释义 |"), contextPath)]);
  plugin.libraryRevision++;
  check("迁移后语境短语仍优先于通用同词短语", plugin.lookup("put together", libNote).decomp, "语境库释义");
  plugin.fileEntries.delete(contextPath);
  plugin.libraryRevision++;
  check("删除语境短语文件撤销查询", plugin.lookup("wild population", libNote), null);
  plugin.fileEntries.set(contextPath, contextPhrases);
  plugin.libraryRevision++;
  check("集中库路径兼容父目录", libraryKind("a. language/" + wordPath), "word");
  check("02.word词书均参与全局检索", libraryKind("02. word/a. 雅思词汇真经/03-动物保护.md"), "word");

  plugin.fileEntries = new Map();
  plugin.sourceContents = new Map();
  plugin.libraryReady = false;
  const calls = [];
  plugin.app = { vault: { getMarkdownFiles: () => [{ path: wordPath }, { path: phrasePath }, { path: contextPath }, { path: "02. word/other.md" }, { path: "99. unrelated/other.md" }] } };
  plugin.reindex = async file => { calls.push(file.path); plugin.fileEntries.set(file.path, []); plugin.sourceContents.set(file.path, ""); };
  await Promise.all([plugin.ensureIndex({ path }), plugin.ensureIndex({ path })]);
  check("预加载词书、短语库和当前文章", calls.slice().sort(), [wordPath, contextPath, phrasePath, "02. word/other.md", path].sort());
  await plugin.ensureIndex({ path });
  check("词库和当前文章只加载一次", calls.length, 5);

  const SoundClass = require("./main.js").TableSound;
  const sound = new SoundClass();
  const audioRoot = `${AUDIO_ROOT}/${wordPath.replace(/\.md$/, "")}/audio`;
  const expected = [`${audioRoot}/cling.mp3`, `${audioRoot}/chunk_cling_to_life.mp3`];
  sound.app = { workspace: { getActiveFile: () => ({ path }) }, vault: { getAbstractFileByPath: p => expected.includes(p) ? { path: p } : null } };
  const cell = html => ({ innerHTML: html, textContent: html, cloneNode: () => ({ innerHTML: html, textContent: html, querySelectorAll: () => [] }) });
  check("分屏词库耳机使用所在笔记目录", sound.resolveAudioForCell(cell("cling"), "word", { wordCell: cell("cling"), chunkCell: cell("cling to life"), file: { path: wordPath } }).paths, expected);
  const contextRoot = `${AUDIO_ROOT}/${contextPath.replace(/\.md$/, "")}/audio`;
  const contextAudio = [`${contextRoot}/wild_population.mp3`, `${contextRoot}/chunk_these_wild_populations.mp3`];
  expected.push(...contextAudio);
  check("语境短语耳机按迁移后路径连播词条与短语", sound.resolveAudioForCell(cell("wild population"), "word", { wordCell: cell("wild population"), chunkCell: cell("these wild populations"), file: { path: contextPath } }).paths, contextAudio);
}

async function checkCardSources() {
  const PluginClass = require("./main.js");
  const plugin = new PluginClass();
  const path = "12. books/example.md";
  const wordPath = "02. word/b. 剑雅阅读真题/03-动物保护.md";
  const otherPath = "02. word/a. 雅思词汇真经/03-动物保护.md";
  const phrasePath = "03. phrase/未整理短语.md";
  const entry = (word, source) => ({ word, path: source, decomp: "n. 释义", keys: new Set([word]) });
  const word = entry("cling", wordPath);
  const phrase = entry("put together", phrasePath);
  plugin.fileEntries = new Map([
    [wordPath, [word, { ...word }]],
    [otherPath, [entry("cling", otherPath), entry("cling to", otherPath)]],
    [phrasePath, [phrase]],
    ["06. reading/other.md", [entry("cling", "06. reading/other.md")]],
  ]);
  const node = (options = {}) => ({
    cls: options.cls, children: options.text ? [options.text] : [],
    createDiv(options) { const child = node(options); this.children.push(child); return child; },
    appendText(text) { this.children.push(text); },
    empty() { this.children = []; }, hide() {}, show() {},
    get textContent() { return this.children.map(child => typeof child === "string" ? child : child.textContent).join(""); },
  });
  plugin.tip = node();
  plugin.tip.createDiv({ text: "卡片内容" });
  plugin.appendEntrySources(word, path);
  let footer = plugin.tip.children.at(-1);
  check("来源置于卡片最后", footer.cls, "hd-entry-sources");
  check("来源去重且每个来源独占一行, 不添加前缀", footer.children.map(child => child.textContent),
    [wordPath.replace(/\.md$/, ""), otherPath.replace(/\.md$/, "")]);
  check("多个来源分别使用独立行元素", footer.children.length, 2);
  plugin.tip.empty();
  plugin.appendEntrySources(entry("cling", otherPath), path);
  check("当前卡片实际采用的来源排在首位", plugin.tip.children[0].children[0].textContent, otherPath.replace(/\.md$/, ""));
  plugin.tip.empty();
  plugin.appendEntrySources(phrase, path);
  check("短语卡片也显示来源", plugin.tip.textContent, phrasePath.replace(/\.md$/, ""));
  plugin.tip.empty();
  plugin.appendEntrySources(null, path);
  plugin.appendEntrySources(word, wordPath);
  check("无匹配词条及非阅读卡片不添加来源", plugin.tip.children.length, 0);

  plugin.tip.empty();
  plugin.fileEntries.set("06. reading/example.md", [entry("cling", "06. reading/example.md")]);
  plugin.appendEntrySources(plugin.lookup("cling", "06. reading/example.md"), "06. reading/example.md");
  check("文章卡片不显示来源", plugin.tip.children.length, 0);
  plugin.fileEntries.set("06. reading/example.md", [entry("cling", "06. reading/example.md"), entry("weave", "06. reading/example.md")]);
  check("文章改动后立即查到新词条", plugin.lookup("weave", "06. reading/example.md")?.word, "weave");
  plugin.fileEntries.delete("06. reading/example.md");

  // Exercise the actual asynchronous card rendering path, including clearing
  // the previous card when the next occurrence has no library entry.
  plugin.hoverToken = 0;
  plugin.fileFor = () => ({ path });
  plugin.ensureIndex = async () => {};
  plugin.readingOccurrence = () => null;
  plugin.clearReadingHighlight = () => {};
  plugin.highlightReadingOccurrence = () => {};
  plugin.position = () => {};
  const mark = text => ({ textContent: text, matches: selector => selector === "mark, .cm-highlight", closest: () => ({ textContent: text }) });
  await plugin.show(mark("cling"));
  check("阅读卡片完整渲染后底部显示来源", plugin.tip.children.at(-1).cls, "hd-entry-sources");
  await plugin.show(mark("put together"));
  check("切换到短语卡片更新来源", plugin.tip.children.at(-1).textContent, phrasePath.replace(/\.md$/, ""));
  plugin.readingOccurrence = () => ({ annotation: { word: "unknown", gloss: "待核对" } });
  await plugin.show(mark("unknown"));
  check("无词条的本文义卡片不残留前词来源", plugin.tip.children.some(child => child.cls === "hd-entry-sources"), false);
}

async function checkListeningCards() {
  const PluginClass = require("./main.js");
  const first = "05. listening/b. Part One/First.md";
  const second = "05. listening/b. Part One/Second.md";
  const head = "| 单词 | 释义 | 意群 | 评分 |\n| :--- | :--- | :--- | --- |\n";
  const entries = parseTables(`# 单词\n\n${head}`
    + "| weather | 天气 | the **weather** today | 0 |\n"
    + "| harbour / harbor | 港口 | the **harbour** | 0 |\n\n"
    + "# 短语\n\n| 短语 | 释义 | 意群 | 评分 |\n| :--- | :--- | :--- | --- |\n"
    + "| life jacket | 救生衣 | bring **life jackets** | 0 |", first);
  const secondEntries = parseTables(`# 单词\n\n${head}| weather | 恶劣天气 | bad **weather** | 0 |`, second);
  const scored = " ==weather== ";
  const marks = PluginClass.__test__.splitMarks(scored);
  check("听力词头等级", marks.level, 1);
  check("切换等级只操作词头", marks.core, "weather");
  const plugin = new PluginClass();
  plugin.fileEntries.set(first, entries);
  plugin.fileEntries.set(second, secondEntries);
  plugin.fileEntries.set("02. word/example.md", parseTables("| 单词 | 释义 | 意群 | 评分 |\n| --- | --- | --- | --- |\n| weather | 词库天气 | **weather** | 0 |", "02. word/example.md"));
  check("听力本篇行以本篇为来源", entries[0].sourcePath, first);
  check("听力原文只查询本篇释义", plugin.lookup("weather", second).decomp, "恶劣天气");
  check("听力原文不借用其他文章", plugin.lookup("weather", "05. listening/other.md"), null);
  check("听力支持词块的复数词形", plugin.lookup("life jackets", first).word, "life jacket");
  check("听力支持英美拼写词头", plugin.lookup("harbor", first).decomp, "港口");
  check("听力不查询 02. word", plugin.lookup("weather", "05. listening/other.md"), null);
  check("阅读本篇查询不借用听力笔记", plugin.lookup("weather", "06. reading/example.md", "", true), null);
  const sound = new PluginClass.TableSound();
  const root = `${AUDIO_ROOT}/${first.replace(/\.md$/, "")}/audio`;
  const files = new Set([`${root}/weather.mp3`, `${root}/chunk_the_weather_today.mp3`]);
  sound.app = { vault: { getAbstractFileByPath: path => files.has(path) ? { path } : null } };
  check("悬浮音频按本篇单词再短语顺序", sound.resolveListeningAudio(entries[0]).paths, [...files]);
  check("缺失音频不跨篇借用", sound.resolveListeningAudio(secondEntries[0]).paths, []);
  check("非来源词条不启动听力音频", sound.resolveListeningAudio({ word: "weather" }), null);
  files.delete(`${root}/weather.mp3`);
  check("缺单词音频仍播放已有短语", sound.resolveListeningAudio(entries[0]).paths, [`${root}/chunk_the_weather_today.mp3`]);

  let stops = 0, plays = [];
  plugin.tableSound = { settings: { listeningHoverAudio: true }, stopCurrentAudio: () => { stops++; }, resolveListeningAudio: entry => ({ label: entry.word, paths: ["word.mp3", "chunk.mp3"], word: "word.mp3", chunk: "chunk.mp3" }), playResolvedAudio: (el, audio) => plays.push(audio.paths) };
  class Box {
    constructor(options = {}) { this.children = []; this.cls = options.cls; this.text = options.text || ""; }
    createDiv(options) { return this.createEl("div", options); }
    createEl(tag, options) { const child = new Box(options); this.children.push(child); return child; }
    appendText(text) { this.text += text; }
    empty() { this.children = []; this.text = ""; }
    show() {} hide() {}
    get textContent() { return this.text + this.children.map(c => c.textContent).join(""); }
  }
  plugin.tip = new Box();
  plugin.hoverToken = 0;
  plugin.fileFor = () => ({path: first});
  plugin.ensureIndex = async () => {};
  plugin.position = () => {};
  plugin.readingOccurrence = () => null;
  plugin.clearReadingHighlight = () => {};
  const mark = { textContent: "weather", matches: selector => selector === "mark, .cm-highlight", closest: () => ({ textContent: "the weather today" }) };
  await plugin.show(mark);
  check("听力悬浮卡片仅显示中文释义", plugin.tip.textContent, "天气");
  check("听力悬浮自动连播", plays, [["word.mp3", "chunk.mp3"]]);
  plugin.hide();
  check("移开立即停止听力悬浮音频", stops, 2);
  check("移开清除悬浮状态", plugin.listeningHoverAudio, false);
  plugin.tableSound.settings.listeningHoverAudio = false;
  await plugin.show(mark);
  check("听力悬浮朗读开关关闭时不播放", plays.length, 1);
  plugin.hide();
  plugin.tableSound.settings.listeningHoverAudio = true;
}

async function checkInitialHighlightSettings() {
  const PluginClass = require("./main.js");
  for (const shown of [false, true]) {
    const plugin = new PluginClass();
    const sound = new PluginClass.TableSound();
    const handlers = new Map();
    const classes = new Set();
    let refreshed = 0, resolveData;
    const view = {
      file: { path: "06. reading/example.md" },
      containerEl: { classList: { toggle(name, on) { on ? classes.add(name) : classes.delete(name); } } },
      editor: { cm: { dispatch() { refreshed++; } } },
    };
    const workspace = {
      on(name, handler) { handlers.set(name, handler); },
      onLayoutReady(handler) { handler(); },
      trigger(name) { handlers.get(name)?.(); },
      getLeavesOfType() { return [{ view }]; },
    };
    plugin.app = sound.app = { workspace };
    plugin.tableSound = sound;
    plugin.registerEvent = () => {};
    sound.loadData = () => new Promise(resolve => { resolveData = resolve; });
    // Match addChild(): async settings loading starts before the parent mounts views.
    const loading = sound.loadSettings();
    plugin.setupHighlightVisibility();
    resolveData({ showReadingHighlights: shown, showReadingQuestionHighlights: shown });
    await loading;
    check(`默认不隐藏原文高亮 ${shown}`, classes.has("hd-highlight-hidden"), false);
    check(`题目高亮交给原生样式 ${shown}`, classes.has("hd-question-shown"), false);
    check(`配置读完自动重算编辑器 ${shown}`, refreshed, 1);
  }
}

function checkWritingSpeaking() {
  const PluginClass = require("./main.js");
  const { articleNotePath, articleHighlightSetting } = require("./src/shared/notes");
  const plugin = new PluginClass();
  const libraryPath = "02. word/example.md";
  plugin.fileEntries.set(libraryPath, parseTables("| 单词 | 释义 |\n| --- | --- |\n| outside | 外部 |", libraryPath));
  const modules = ["06. reading", "07. writing", "09. speaking"];
  const views = modules.map(root => {
    const path = `${root}/example.md`;
    const classes = new Set();
    return { file: { path }, classes, containerEl: { classList: { toggle(key, value) { value ? classes.add(key) : classes.delete(key); } } } };
  });
  plugin.app = { workspace: { getLeavesOfType: () => views.map(view => ({ view })) } };
  plugin.tableSound = { settings: {} };
  for (const view of views) {
    const path = view.file.path;
    check(`${path} 篇章路径兼容父目录`, articleNotePath(`a. language/${path}`), path);
    check(`${path} 正文交互启用`, readingNotePath(path), path);
    plugin.fileEntries.set(path, parseTables("# 单词\n| 单词 | 释义 | 意群 | 评分 |\n| --- | --- | --- | --- |\n| pupil | n. 学生 | **pupils** at school | 0 |\n\n# 短语\n| 短语 | 释义 | 意群 | 评分 |\n| --- | --- | --- | --- |\n| take part in | 参加 | **take part in** activities | 0 |", path));
    check(`${path} 无注释词形匹配`, plugin.lookup("pupils", path)?.word, "pupil");
    check(`${path} 短语匹配`, plugin.lookup("take part in", path)?.decomp, "参加");
    check(`${path} 本篇查询不回退全库`, plugin.lookup("outside", path, "", true), null);
    check(`${path} 未收录不误认`, plugin.hasReadingEntry("outside", null, path), false);
    check(`${path} 单词意群进入卡片`, contextCardColumn(["单词", "释义", "意群", "评分"], path), 2);
    plugin.tableSound.settings = { [articleHighlightSetting(path)]: true };
    plugin.syncHighlightVisibility();
    check(`${path} 独立隐藏高亮`, views.map(v => v.classes.has("hd-highlight-hidden")), views.map(v => v === view));
    check(`${path} 写说隐藏未收录正文高亮`, view.classes.has("hd-hide-unlisted-highlights"), !path.startsWith("06. reading/"));
    plugin.tableSound.settings = {};
    plugin.syncHighlightVisibility();
    check(`${path} 取消隐藏`, view.classes.has("hd-highlight-hidden"), false);
    check(`${path} 取消隐藏恢复未收录词底色`, view.classes.has("hd-hide-unlisted-highlights"), false);
  }
  const path = "09. speaking/example.md";
  plugin.fileEntries.set(path, parseTables("| 表达 | 释义 | 类型 |\n| --- | --- | --- |\n| **a piece of cake** | 小菜一碟 | 口语 |", path));
  check("口语旧表达表按本篇查询", plugin.lookup("a piece of cake", path)?.decomp, "小菜一碟");

  const { previewHighlightChanges, toggleHighlightChange, selectionChanges } = require("./src/hd/features/doubleClickHighlight");
  const apply = (text, changes) => changes.slice().sort((a, b) => b.from - a.from).reduce((s, c) => s.slice(0, c.from) + c.insert + s.slice(c.to), text);
  for (const text of ["He is brilliant.", "He is **brilliant**.", "**He is brilliant.**"]) {
    const spec = [{ visible: "He is brilliant.", offset: 6, length: 9 }];
    const marked = apply(text, previewHighlightChanges(text, spec));
    check(`阅读视图双击加高亮 ${text}`, marked, text.replace("brilliant", "==brilliant=="));
    check(`阅读视图双击取消保留加粗 ${text}`, apply(marked, previewHighlightChanges(marked, spec)), text);
  }
  const phrase = "He is **a piece of cake**.";
  check("阅读视图选中短语保留加粗", apply(phrase, previewHighlightChanges(phrase, [{visible: "He is a piece of cake.", offset: 6, length: 15}], true)), "He is **==a piece of cake==**.");
  check("重复段落不会误改", previewHighlightChanges("He is brilliant.\n\nHe is brilliant.", [{visible: "He is brilliant.", offset: 6, length: 9}]), []);
  const marked = "He is **==a piece of cake==**.";
  check("双击短语内单词取消整个高亮", apply(marked, [toggleHighlightChange(marked, {from: marked.indexOf("piece"), to: marked.indexOf("piece") + 5})]), phrase);
  check("已高亮选区不重复加标记", selectionChanges(marked, {from: marked.indexOf("piece"), to: marked.indexOf("piece") + 5}), []);
}
checkWritingSpeaking();

async function checkArticleRefresh() {
  const PluginClass = require("./main.js");
  for (const root of ["07. writing", "09. speaking"]) {
    const plugin = new PluginClass();
    const file = Object.assign(new obsidianStub.TFile(), {path: `${root}/example.md`, extension: "md"});
    let content = '| 表达 | 释义 |\n| --- | --- |\n| brilliant | 聪明的 |';
    let refreshes = 0;
    plugin.app = {vault: {cachedRead: async () => content}, workspace: {getLeavesOfType: () => [{view: {file, editor: {cm: {dispatch() {refreshes++;}}}}}]}};
    plugin.hide = () => {};
    await plugin.reindex(file);
    check(`${root} 首次索引刷新实时预览`, refreshes, 1);
    check(`${root} 首次索引后识别本篇高亮`, plugin.hasReadingEntry("brilliant", null, file.path), true);
    content += '\n| familiar | 熟悉的 |';
    await plugin.reindex(file);
    check(`${root} 更新词表后刷新实时预览`, refreshes, 2);
    check(`${root} 更新后识别新增词条`, plugin.hasReadingEntry("familiar", null, file.path), true);
    await plugin.reindex(file);
    check(`${root} 相同内容不重复刷新`, refreshes, 2);

    const audioPath = `20. resource/${root}/example/audio/brilliant.mp3`;
    plugin.app.vault.getAbstractFileByPath = path => path === audioPath ? {path} : null;
    plugin.fileFor = () => file;
    plugin.readingOccurrence = () => ({text: "brilliant", annotation: null});
    let plays = [];
    const kind = root.split('. ')[1];
    plugin.tableSound = {settings: {readingHoverAudio: true, [`${kind}HoverAudio`]: false}, stopCurrentAudio() {}, playResolvedAudio(el, resolved) {plays.push(resolved.paths);}};
    plugin.hoverReadingAudio({closest: () => ({textContent: "brilliant"})});
    check(`${root} 不借用阅读朗读开关`, plays, []);
    plugin.tableSound.settings[`${kind}HoverAudio`] = true;
    plugin.hoverReadingAudio({closest: () => ({textContent: "brilliant"})});
    check(`${root} 朗读只取所属篇章音频`, plays, [[audioPath]]);
  }
}

checkArticleRefresh().then(checkCentralLibraries).then(checkCardSources).then(checkListeningCards).then(checkInitialHighlightSettings).then(() => {
if (failures.length) {
  console.error(`\n✗ ${failures.length} 个用例失败（共 ${passed + failures.length} 个）：\n`);
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`✓ 全部 ${passed} 个用例通过`);
}).catch(error => { console.error(error); process.exitCode = 1; });

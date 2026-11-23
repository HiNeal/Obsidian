// node test.js —— 测纯逻辑 (解析、排牌、slug), 并用真实笔记做冒烟测试。无第三方依赖。
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { parseDeck } = require("./src/parse");
const { arrangeDeck, StudySession } = require("./src/session");
const { toSlug, slugVariants, meaningHtml, multiline, englishHtml, phraseHtml, memoryHtml, splitParts, spellKey } = require("./src/text");
const { rewriteRow, cellSpans, clampScore } = require("./src/score");
const { removeCardRow } = require("./src/delete");
const { createRootIndex, resolveRootHints } = require("./src/roots");
const { exampleWords } = require("./src/text");

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exitCode = 1; }
};

const WORD_TABLE = `# 未整理单词

| 单词 | 释义 | 记忆 | 英意 | 意群 |
| :--- | --- | :--- | :--- | :--- |
| ==outcry==<br>/ˈaʊtkraɪ/ | n. 呼喊(==强烈抗议==) | 记忆 | n. an exclamation | elicit huge **outcries** |
| juggernaut<br>/ˈdʒʌgənɔːt/ | n. 不可抗拒的力量<br><br>v. 碾压 | 记忆 | n. a huge force | a policy **juggernaut** |
| **legacy** | n. 遗产 | | | |
`;

test("删除卡片: 整行移除, 其余内容逐字保留", () => {
  const cards = parseDeck(WORD_TABLE);
  const expected = WORD_TABLE.split("\n").filter((_, i) => i !== cards[0].line).join("\n");
  assert.strictEqual(removeCardRow(WORD_TABLE, cards[0], cards), expected);
});

test("划线范围: 每个成分 (含前缀、后缀、连接成分) 都画, 不比对 Base", () => {
  const range = (memory, word) => resolveRootHints(memory, word).rootRanges.map(r => [r.start, r.end]);
  assert.deepStrictEqual(range("speci(种类), -al(…的), -ise(…化, 使成)", "specialise"), [[0, 5], [5, 7], [7, 10]]);
  assert.deepStrictEqual(range("vent(风), -il(连接成分), -at(做, 使), -ion(行为, 结果)", "ventilation"), [[0, 4], [4, 6], [6, 8], [8, 11]]);
  assert.deepStrictEqual(range("ap-(到), plic, ply(折, 折叠), -ation(行为)", "application"), [[0, 2], [2, 6], [6, 11]]);
  assert.deepStrictEqual(range("rain(雨), coat(外衣)", "raincoat"), [[0, 4], [4, 8]]);
  assert.deepStrictEqual(range("calcul(词: 计算), -ate(做)", "calculate"), [[0, 6], [6, 9]]);
  assert.deepStrictEqual(range("core(基础词)", "core"), []);
  assert.deepStrictEqual(resolveRootHints("只描述词义", "calculus").roots, []);
});
test("删除卡片: 同名词只删除当前表的当前一行", () => {
  const table = "| 单词 | 释义 | 评分 |\n| --- | --- | --- |\n| same | 甲 | 0 |\n| same | 甲 | 0 |\n";
  const text = "# 一\n" + table + "\n# 二\n" + table;
  const cards = parseDeck(text);
  const result = removeCardRow(text, cards[1], cards);
  const expected = text.split("\n");
  expected.splice(cards[1].line, 1);
  assert.strictEqual(result, expected.join("\n"));
  assert.strictEqual(parseDeck(result).filter(c => c.tableKey === cards[2].tableKey).length, 2);
});

test("删除卡片: 外部插行与待写评分不影响定位", () => {
  const cards = parseDeck(WORD_TABLE);
  const lines = WORD_TABLE.split("\n");
  lines[cards[0].line] = lines[cards[0].line].replace("==outcry==", "outcry");
  const fresh = "前言\n" + lines.join("\n");
  assert.deepStrictEqual(parseDeck(removeCardRow(fresh, cards[0], cards)).map(c => c.word), ["juggernaut", "legacy"]);
});

test("删除卡片: 同名行被增删或内容变化时拒绝误删", () => {
  const cards = parseDeck(WORD_TABLE);
  assert.strictEqual(removeCardRow(WORD_TABLE.replace("n. 呼喊", "n. 修改"), cards[0], cards), null);
  assert.strictEqual(removeCardRow(WORD_TABLE.replace("| juggernaut", "| outcry"), cards[0], cards), null);
  const removed = removeCardRow(WORD_TABLE, cards[0], cards);
  assert.strictEqual(removeCardRow(removed, cards[0], cards), null);
});

test("删除卡片: 无评分表最后一行与 CRLF 保持正确", () => {
  const text = "# 短语\r\n| 短语 | 释义 |\r\n| --- | --- |\r\n| in fact | 事实上 |";
  const cards = parseDeck(text);
  const result = removeCardRow(text, cards[0], cards);
  assert.strictEqual(result, text.slice(0, text.lastIndexOf("\n")));
  assert.deepStrictEqual(parseDeck(result), []);
});

test("单词表: 独立音标列", () => {
  const text = "# 单词\n\n| 单词 | 音标 | 释义 | 记忆 | 英意 | 意群 | 同义词 | 评分 |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- | --- |\n| ==outcry== | /ˈaʊtkraɪ/ | n. 呼喊 | 记忆 | n. a loud cry | public **outcry** | | 2 |\n| force | | n. 力 | | n. strength | **force** | | 0 |";
  const cards = parseDeck(text);
  assert.strictEqual(cards.length, 2);
  assert.deepStrictEqual([cards[0].word, cards[0].score, cards[0].phonetic, cards[0].meaning], ["outcry", 2, "/ˈaʊtkraɪ/", "n. 呼喊"]);
  assert.strictEqual(cards[0].memory, "记忆");
  assert.strictEqual(cards[1].phonetic, "");
  assert.strictEqual(cards[0].scoreCol, 7);
});

test("单词表: 词头、音标、进阶、释义", () => {
  const cards = parseDeck(WORD_TABLE);
  assert.strictEqual(cards.length, 3);
  assert.deepStrictEqual(
    [cards[0].word, cards[0].focus, cards[0].phonetic],
    ["outcry", 1, "/ˈaʊtkraɪ/"],
  );
  assert.strictEqual(cards[0].meaning, "n. 呼喊(==强烈抗议==)");
  assert.strictEqual(cards[1].focus, 0);
  assert.strictEqual(cards[1].meaning, "n. 不可抗拒的力量\n\nv. 碾压");
  assert.strictEqual(cards[2].focus, 1, "旧整格加粗按进阶");
  assert.strictEqual(cards[0].h1, "未整理单词");
  assert.strictEqual(cards[0].line, 4);
});

test("悬浮: 英意与意群", () => {
  const cards = parseDeck(WORD_TABLE);
  assert.strictEqual(cards[0].english, "n. an exclamation");
  assert.strictEqual(cards[0].phrase, "elicit huge **outcries**");
  assert.strictEqual(cards[2].english, "");
  const en = parseDeck("| 单词 | 释义 | 英意 |\n| --- | --- | --- |\n| a | x | n. one<br>&emsp;• sub <b> |\n")[0].english;
  assert.strictEqual(en, "n. one\n• sub");
  assert.ok(englishHtml(en).includes('class="mc-en is-sub">sub'));
  assert.strictEqual(phraseHtml("elicit huge **outcries**"), '<div class="mc-phrase-line">elicit huge <strong>outcries</strong></div>');
  const g = parseDeck("| 语法词条 | 意群 | 释义 |\n| --- | --- | --- |\n| at | **at** home | 在 |\n")[0];
  assert.strictEqual(g.phrase, "**at** home");
});

test("悬浮: 记忆列与构词切分", () => {
  const cards = parseDeck(WORD_TABLE);
  assert.strictEqual(cards[0].memory, "记忆");
  assert.deepStrictEqual(splitParts("muscl, muscul(根: 肌肉), -ar(…的)"), ["muscl, muscul(根: 肌肉)", "-ar(…的)"]);
  const html = memoryHtml("out(词: 向外), cry(词: 喊叫)\n\n向外猛然喊出一声");
  assert.ok(html.includes('<b>out</b><span>词: 向外</span>'));
  assert.ok(html.includes('<div class="mc-mem-line">向外猛然喊出一声</div>'));
  assert.ok(memoryHtml("以某一点为中心(比喻)").includes("mc-mem-line"), "中文开头的行不当构词");
});

test("词根释义定位不读取翻页变换后的屏幕坐标", () => {
  const { CardFace } = require("./src/view/cardFace");
  const parent = {};
  const node = (left, top, width, height, offsetParent) => ({
    offsetLeft: left, offsetTop: top, offsetWidth: width, offsetHeight: height, offsetParent,
    style: {},
    getBoundingClientRect() { throw new Error("翻页中的屏幕坐标不可用于释义布局"); },
  });
  let ready = false;
  const annotationEl = Object.assign(node(22, 0, 396, 420, parent), {
    clientWidth: 396, removeClass() {}, addClass() { ready = true; },
  });
  const makeEntry = (left, above, width) => {
    const mark = node(left, 293, 104, 58, parent);
    mark.ownerDocument = { defaultView: { getComputedStyle: () => ({ borderBottomWidth: "5px", top: "-4.4px", bottom: "-4.4px" }) } };
    return { mark, label: node(0, 0, width, 18, annotationEl), above };
  };
  const lower = makeEntry(104, false, 110), upper = makeEntry(208, true, 22);
  CardFace.prototype.placeRootMeanings.call({
    annotationEl, rootAnnotations: [lower, upper], memoryHints: true, wordEl: { style: {} }, fitRootLines() {},
  });
  assert.ok(ready);
  assert.ok(parseFloat(lower.label.style.top) > lower.mark.offsetTop + lower.mark.offsetHeight + 4.4);
  assert.ok(parseFloat(upper.label.style.top) + upper.label.offsetHeight < upper.mark.offsetTop - 4.4);
  for (const { mark, label } of [lower, upper]) {
    assert.strictEqual(parseFloat(label.style.left) + label.offsetWidth / 2 + annotationEl.offsetLeft, mark.offsetLeft + mark.offsetWidth / 2);
  }
});

test("词根词缀卡对应单词: 保留原词形和顺序, 去掉释义与重复词头", () => {
  assert.deepStrictEqual(exampleWords("**acupuncture**  n. 针灸<br><br>acute adj.敏锐的\nACUTE adj. 急性的\ngood-hearted adj. 好心的\nin front of prep. 在前面\n仅有说明文字\nbareword"), [
    "acupuncture", "acute", "good-hearted", "in front of", "bareword",
  ]);
  assert.deepStrictEqual(exampleWords(), []);
});

test("词根与记忆开关: 默认开启, 关闭后可持久化并恢复", () => {
  const { PrefsStore } = require("./src/store");
  let saved;
  const plugin = { saveData: data => { saved = JSON.parse(JSON.stringify(data)); } };
  const store = new PrefsStore(plugin, { prefsVersion: 2 });
  assert.strictEqual(store.memoryHints, true);
  store.memoryHints = false;
  store.flush();
  const loaded = new PrefsStore(plugin, saved);
  assert.strictEqual(loaded.memoryHints, false);
  loaded.memoryHints = true;
  loaded.flush();
  assert.strictEqual(new PrefsStore(plugin, saved).memoryHints, true);
});

test("局部高亮不算进阶", () => {
  const cards = parseDeck("| 单词 | 释义 |\n| --- | --- |\n| a ==b== c | x |\n");
  assert.strictEqual(cards[0].focus, 0);
});

test("没有释义列的表不上卡, 代码块里的表忽略", () => {
  const md = "| 词根 | 例子 |\n| --- | --- |\n| ac | acid |\n\n```\n| 单词 | 释义 |\n| --- | --- |\n| x | y |\n```\n";
  assert.strictEqual(parseDeck(md).length, 0);
});

test("集中听力表: 释义末尾音标不上卡, h1 记录来源", () => {
  const md = "# 02. 咨询办理/Accommodation Options\n\n| 单词 | 释义 | 意群 |\n| :--- | :--- | :--- |\n| cross | n. 叉形<br><br>/krɒs/ | **cross** road |\n";
  const [card] = parseDeck(md);
  assert.strictEqual(card.meaning, "n. 叉形");
  assert.strictEqual(card.h1, "02. 咨询办理/Accommodation Options");
});

test("语法表 (意群在第二列) 与同义改写表", () => {
  const grammar = parseDeck("| 语法词条 | 意群 | 释义 |\n| --- | --- | --- |\n| **as** | as **as** | 像 |\n");
  assert.deepStrictEqual([grammar[0].word, grammar[0].meaning], ["as", "像"]);
  const para = parseDeck("| 题目表达 | 原文表达 |\n| --- | --- |\n| decline | fall |\n");
  assert.deepStrictEqual([para[0].word, para[0].meaning, para[0].paired], ["decline", "fall", true]);
});

test("单元格内转义竖线", () => {
  const [card] = parseDeck("| 单词 | 释义 |\n| --- | --- |\n| either \\| or | 或者 |\n");
  assert.strictEqual(card.word, "either | or");
});

test("智能播放: 按评分 5 → 0, 同分保持笔记顺序", () => {
  const cards = [0, 3, 1, 5, 3, 0].map((score, id) => ({ id, score, focus: score >= 1 ? 1 : 0 }));
  const { deck } = arrangeDeck(cards, { order: "smart", focus: false });
  assert.deepStrictEqual(deck.map((c) => c.id), [3, 1, 4, 2, 0, 5]);
});

test("智能播放: 按表格隔离, 各表内按评分排", () => {
  const md = `# 单词

| 单词 | 释义 | 记忆 | 英意 | 意群 | 评分 |
| --- | --- | --- | --- | --- | --- |
| alpha | n. 甲 | | | | 0 |
| ==beta== | n. 乙 | | | | 2 |

# 短语

| 短语 | 释义 | 意群 | 评分 |
| --- | --- | --- | --- |
| a lot of ... | 许多 ... | | 1 |
| ==in terms of ...== | 就 ... 而言 | | 5 |

# 同义改写

| 题目表达 | 原文表达 | 评分 |
| --- | --- | --- |
| big | large | 0 |
| quick | rapid | 3 |

# 单词二

| 单词 | 释义 | 评分 |
| --- | --- | --- |
| gamma | n. 丙 | 0 |
| ==delta== | n. 丁 | 4 |
`;
  const cards = parseDeck(md);
  assert.deepStrictEqual(cards.map((c) => c.table), [0, 0, 1, 1, 2, 2, 3, 3]);
  const { deck } = arrangeDeck(cards, { order: "smart", focus: false });
  assert.deepStrictEqual(deck.map((c) => c.word), ["beta", "alpha", "in terms of ...", "a lot of ...", "quick", "big", "delta", "gamma"]);
});

test("评分列: 数字为准, 缺失时按高亮推导, 超界截断", () => {
  const md = "| 单词 | 释义 | 评分 |\n| --- | --- | --- |\n| a | x | 3 |\n| ==b== | y |  |\n| c | z | 9 |\n";
  const cards = parseDeck(md);
  assert.deepStrictEqual(cards.map((c) => [c.score, c.focus, c.scoreCol]), [[3, 1, 2], [1, 1, 2], [5, 1, 2]]);
  assert.strictEqual(parseDeck("| 单词 | 释义 |\n| --- | --- |\n| a | x |\n")[0].scoreCol, -1);
  assert.deepStrictEqual([clampScore(-2), clampScore(7), clampScore("2")], [0, 5, 2]);
});

test("写回评分: 只改评分格, 词头与其余格原样", () => {
  const row = "| outcry<br>/ˈaʊtkraɪ/ | n. 呼喊 | 记忆 | eng | elicit **outcries** | 0 |";
  const up = rewriteRow(row, { wordCol: 0, scoreCol: 5, score: 3 });
  assert.strictEqual(up, "| outcry<br>/ˈaʊtkraɪ/ | n. 呼喊 | 记忆 | eng | elicit **outcries** | 3 |");
  assert.strictEqual(rewriteRow(up, { wordCol: 0, scoreCol: 5, score: 0 }), row);
  // 短语库的用户加粗不动
  assert.strictEqual(rewriteRow("| **at all** | 哪怕 | x | 0 |", { wordCol: 0, scoreCol: 3, score: 1 }), "| **at all** | 哪怕 | x | 1 |");
  // 转义竖线不算列分隔
  assert.strictEqual(cellSpans("| a \\| b | c |").length, 2);
  assert.strictEqual(rewriteRow("| a | b |", { wordCol: 0, scoreCol: 5, score: 1 }), null, "列数不够时放弃写盘");
});

test("进阶模式: 有进阶词才生效", () => {
  const some = [{ id: 0, focus: 0 }, { id: 1, focus: 1 }];
  assert.deepStrictEqual(arrangeDeck(some, { order: "loop", focus: true }).deck.map((c) => c.id), [1]);
  const none = [{ id: 0, focus: 0 }];
  const r = arrangeDeck(none, { order: "loop", focus: true });
  assert.deepStrictEqual([r.focusActive, r.deck.length], [false, 1]);
});

test("牌堆首尾循环与编辑后留在原词", () => {
  const cards = ["a", "b", "c"].map((word, id) => ({ id, word, focus: 0 }));
  const s = new StudySession().arrange(cards, { order: "loop", focus: false }, { index: 2 });
  assert.strictEqual(s.offset(1), 0);
  s.index = 0;
  assert.strictEqual(s.offset(-1), 2);
  s.index = 1;
  s.arrange([{ id: 9, word: "z", focus: 0 }, ...cards], { order: "loop", focus: false }, { keepWord: "b" });
  assert.strictEqual(s.card.word, "b");
  assert.strictEqual(new StudySession().arrange(cards, {}, { index: 99 }).index, 2);
});

test("智能播放刷到头循环时按最新评分重排", () => {
  const prefs = { order: "smart", focus: false };
  const cards = [1, 3, 0].map((score, id) => ({ id, word: String(id), score, focus: score >= 1 ? 1 : 0 }));
  const s = new StudySession().arrange(cards, prefs);
  assert.deepStrictEqual(s.deck.map((c) => c.id), [1, 0, 2]);
  cards[2].score = 5; // 打分: 当前这一轮不重排
  s.advance(1, prefs);
  assert.deepStrictEqual([s.index, s.deck.map((c) => c.id)], [1, [1, 0, 2]]);
  s.advance(1, prefs);
  s.advance(1, prefs); // 走到头循环 → 重排
  assert.deepStrictEqual([s.index, s.deck.map((c) => c.id)], [0, [2, 1, 0]]);
  s.advance(-1, prefs); // 往回越过开头同样重排, 落在最后一张
  assert.strictEqual(s.card.id, 0);
  const loop = new StudySession().arrange(cards, { order: "loop" }, { index: 2 });
  loop.advance(1, { order: "loop" });
  assert.deepStrictEqual([loop.index, loop.deck.map((c) => c.id)], [0, [0, 1, 2]]);
});

test("笔记内容变了但表格结构没变: 原地更新, 牌堆顺序不动", () => {
  const prefs = { order: "smart", focus: false };
  const make = (scores) => scores.map((score, id) => ({ id, word: String(id), table: 0, score, focus: score >= 1 ? 1 : 0 }));
  const s = new StudySession().arrange(make([1, 3, 0]), prefs);
  s.advance(1, prefs);
  const pending = new Set([s.cards[0]]);
  s.cards[0].score = 4; // 还没写盘的评分
  assert.strictEqual(s.refresh(make([1, 3, 5]), pending), true);
  assert.deepStrictEqual([s.index, s.deck.map((c) => c.id)], [1, [1, 0, 2]]);
  assert.deepStrictEqual(s.cards.map((c) => c.score), [4, 3, 5]);
  s.advance(1, prefs);
  s.advance(1, prefs); // 回到第一张才按新分数重排
  assert.deepStrictEqual([s.index, s.deck.map((c) => c.id)], [0, [2, 0, 1]]);
  assert.strictEqual(s.refresh(make([1, 3]), null), false); // 少了一行: 交给调用方重排
});

test("听写判分: 忽略大小写、空格与连字符", () => {
  assert.strictEqual(spellKey("Well Known"), spellKey("well-known"));
  assert.strictEqual(spellKey("part\u2013time"), spellKey("part time"));
  assert.strictEqual(spellKey("  "), "");
  assert.strictEqual(spellKey("  Take  Off "), spellKey("take off"));
  assert.strictEqual(spellKey("don\u2019t"), "don't");
  assert.notStrictEqual(spellKey("recieve"), spellKey("receive"));
});

test("只重刷一部分卡: 刷到头回到整副牌", () => {
  const cards = ["a", "b", "c", "d"].map((word) => ({ word, focus: 0, score: 0 }));
  const s = new StudySession().arrange(cards, { order: "loop", focus: false });
  assert.strictEqual(s.drill([]), false);
  assert.strictEqual(s.drill([cards[1], cards[3]]), true);
  assert.deepStrictEqual([s.size, s.card.word, s.drilling], [2, "b", true]);
  s.advance(1, { order: "loop", focus: false });
  assert.strictEqual(s.card.word, "d");
  s.advance(1, { order: "loop", focus: false });
  assert.deepStrictEqual([s.size, s.card.word, s.drilling], [4, "a", false]);
});

test("slug 与 tts-audio-engine 一致", () => {
  assert.strictEqual(toSlug("the **vicissitudes** of life"), "the_vicissitudes_of_life");
  assert.strictEqual(toSlug("don't"), "don_t");
  assert.strictEqual(toSlug("naïve café"), "naive_cafe");
  assert.deepStrictEqual(slugVariants("one's own"), ["one_s_own", "one_someone_s_own"]);
});

test("释义 HTML: 词性单独成列、转义、考过义项、空行分段", () => {
  assert.strictEqual(
    meaningHtml(multiline("n. 地球 ==泥土==<br><br>adj. 土的<br>v. 掩埋")),
    '<div class="mc-sense"><span class="mc-pos">n.</span><span class="mc-def">地球 <mark class="mc-exam">泥土</mark></span></div>'
    + '<div class="mc-sense is-gap"><span class="mc-pos">adj.</span><span class="mc-def">土的</span></div>'
    + '<div class="mc-sense"><span class="mc-pos">v.</span><span class="mc-def">掩埋</span></div>',
  );
  assert.strictEqual(meaningHtml("a < b"), '<div class="mc-sense is-plain"><span class="mc-def">a &lt; b</span></div>');
});

// 真实笔记冒烟: 每张卡都有词头和释义
const vault = path.resolve(__dirname, "../../..");
for (const rel of ["02. word/未整理单词.md", "03. phrase/未整理短语.md", "02. word/m. 剑雅听力真题/音义词块.md"]) {
  const file = path.join(vault, rel);
  if (!fs.existsSync(file)) continue;
  test(`真实笔记 ${rel}`, () => {
    const cards = parseDeck(fs.readFileSync(file, "utf8"));
    assert.ok(cards.length > 0, "没有解析出卡片");
    for (const c of cards) {
      assert.ok(c.word && !/[<>*=]/.test(c.word), `词头不干净: ${c.word}`);
      assert.ok(!/<br|<!--/.test(c.meaning), `释义残留标签: ${c.word}`);
    }
  });
}

// Base 评分必须可写回, 且不能把例子或释义当成评分格。
for (const name of ["x.word-prefix", "y.word-root", "z.word-suffix"]) {
  test(`Base 评分往返: ${name}`, () => {
    const text = fs.readFileSync(path.join(vault, "01. base", name + ".md"), "utf8");
    const lines = text.split("\n");
    const cards = parseDeck(text);
    assert.ok(cards.length > 0);
    for (const card of cards) {
      assert.strictEqual(card.scoreCol, 3);
      for (const score of [5, 0]) {
        const rewritten = rewriteRow(lines[card.line], { ...card, score });
        const changed = lines.slice();
        changed[card.line] = rewritten;
        const result = parseDeck(changed.join("\n"))[card.id];
        assert.deepStrictEqual([result.word, result.meaning, result.score, result.focus],
          [card.word, card.meaning, score, score > 0 ? 1 : 0]);
        const spans = cellSpans(lines[card.line]), next = cellSpans(rewritten);
        for (const col of [1, 2]) assert.strictEqual(rewritten.slice(...next[col]), lines[card.line].slice(...spans[col]));
      }
    }
  });
}

test("单表范围: 同标题分表、重复表名、源码定位与独立评分", () => {
  const { tableScopes, scopeCards } = require("./src/tableScopes");
  const text = "# 练习\n\n| 总览 | 内容 |\n| --- | --- |\n| a | b |\n\n## 词汇\n\n| 单词 | 释义 | 评分 |\n| --- | --- | --- |\n| same | 第一表 | 0 |\n\n| 短语 | 释义 | 评分 |\n| --- | --- | --- |\n| same | 第二表 | 2 |\n\n| 单词 | 释义 | 评分 |\n| --- | --- | --- |\n| third | 第三表 | 0 |";
  const cards = parseDeck(text), tables = tableScopes(cards);
  assert.deepStrictEqual(tables.map(t => t.label), ["词汇 · 单词 1", "词汇 · 短语", "词汇 · 单词 2"]);
  assert.strictEqual(scopeCards(cards, null).length, 3);
  assert.strictEqual(scopeCards(cards, "missing").length, 0);
  const selected = scopeCards(cards, tables[1].key);
  assert.strictEqual(selected.length, 1);
  const lines = text.split("\n");
  lines[selected[0].line] = rewriteRow(lines[selected[0].line], {...selected[0], score: 5});
  assert.deepStrictEqual(parseDeck(lines.join("\n")).map(c => c.score), [0, 5, 0]);
  assert.deepStrictEqual(tableScopes(parseDeck("前言\n" + text)).map(t=>t.key), tables.map(t=>t.key));
  assert.strictEqual(lines[tables[1].line], "| 短语 | 释义 | 评分 |");
});

test("进度书签: 排序变化后仍回到同表同词, 删除时安全回退", () => {
  const { makeBookmark, restorePosition } = require("./src/progress");
  const cards = [
    { word: "same", tableKey: "A", table: 0, score: 0 },
    { word: "other", tableKey: "A", table: 0, score: 3 },
    { word: "same", tableKey: "B", table: 1, score: 1 },
  ];
  const session = new StudySession();
  session.arrange(cards, {order: "loop", focus: false}, {index: 2});
  const bookmark = makeBookmark(session);
  session.arrange([{word: "new", tableKey: "A", table: 0, score: 5}, ...cards], {order: "smart", focus: false});
  session.index = restorePosition(session, bookmark, 2);
  assert.strictEqual(session.card, cards[2]);
  session.arrange(cards.slice(0, 2), {order: "loop", focus: false});
  assert.strictEqual(restorePosition(session, bookmark, 99), 1);
  assert.strictEqual(restorePosition(session, null, 0), 0);
});

test("进度写入: 整篇与单表互不覆盖, 临时错词练习不保存进度", () => {
  const { progressPatch } = require("./src/progress");
  const cards = [{word: "a", tableKey: "A", table: 0}, {word: "b", tableKey: "A", table: 0}];
  const session = new StudySession();
  session.arrange(cards, {order: "loop", focus: false}, {index: 1});
  let prefs = { progress: 40, tableProgress: { B: 8 }, tableBookmarks: { B: {word: "old"} } };
  prefs = {...prefs, ...progressPatch(prefs, "A", session)};
  assert.strictEqual(prefs.progress, 40);
  assert.deepStrictEqual(prefs.tableProgress, {B: 8, A: 1});
  assert.strictEqual(prefs.tableBookmarks.A.word, "b");
  const whole = progressPatch(prefs, null, session);
  assert.strictEqual(whole.progress, 1);
  assert.strictEqual(whole.tableProgress, undefined);
  session.drill([cards[0]]);
  assert.strictEqual(progressPatch(prefs, "A", session), null);
});

test("写作、口语卡组包含未高亮词且不改用户偏好", () => {
  const Module = require("module");
  const originalLoad = Module._load;
  let CardView;
  try {
    Module._load = function(name) {
      if (name === "obsidian") return {ItemView: class {}, Modal: class {}};
      return originalLoad.apply(this, arguments);
    };
    CardView = require("./src/view/CardView").CardView;
  } finally { Module._load = originalLoad; }
  const { DECK_ROOTS } = require("./src/constants");
  const cards = parseDeck(WORD_TABLE);
  for (const root of ["06. reading/", "07. writing/", "09. speaking/"]) {
    assert.ok(DECK_ROOTS.includes(root));
    const prefs = {focus: true, order: "loop"};
    const effective = CardView.prototype.arrangePrefs.call({deckPath: root + "example.md", prefs});
    assert.strictEqual(arrangeDeck(cards, effective).deck.length, cards.length);
    assert.strictEqual(prefs.focus, true);
  }
  const prefs = {focus: true, order: "loop"};
  assert.strictEqual(CardView.prototype.arrangePrefs.call({deckPath: "02. word/example.md", prefs}), prefs);
});

test("轻量表范围扫描与完整解析结果一致", () => {
  const { hasDeckCards } = require("./src/parse");
  const { tableScopes, scanTableScopes } = require("./src/tableScopes");
  const md = "# 练习\n\n| 总览 | 内容 |\n| --- | --- |\n| a | b |\n\n## 词汇\n\n| 单词 | 释义 | 评分 |\n| --- | --- | --- |\n| same | 第一表 | 0 |\n| | 空词头跳过 | 0 |\n\n| 短语 | 释义 | 评分 |\n| --- | --- | --- |\n| same | 第二表 | 2 |\n";
  assert.deepStrictEqual(scanTableScopes(md), tableScopes(parseDeck(md)));
  assert.strictEqual(hasDeckCards(md), true);
  assert.strictEqual(hasDeckCards("| 词根 | 例子 |\n| --- | --- |\n| ac | acid |\n"), false);
  const real = path.join(vault, "05. listening/01. 听力词汇/13. 答案词.md");
  if (fs.existsSync(real)) {
    const content = fs.readFileSync(real, "utf8");
    assert.deepStrictEqual(scanTableScopes(content), tableScopes(parseDeck(content)));
  }
});

console.log(process.exitCode ? `有失败, 通过 ${passed} 项` : `全部通过 ${passed} 项`);

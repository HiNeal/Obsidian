const { parseDeck } = require("./parse");

// 重读当前表, 按同名词的出现次序定位。行号会随外部插入漂移, 不能直接拿旧行号删除。
function removeCardRow(markdown, target, expectedCards) {
  const sameWord = card => card.tableKey === target.tableKey && card.word === target.word;
  const before = expectedCards.filter(sameWord);
  const fresh = parseDeck(markdown).filter(sameWord);
  const occurrence = before.indexOf(target);
  const fields = ["meaning", "phonetic", "paired", "memory", "english", "phrase", "examples", "source"];
  // 同名行数量或内容变了就停止, 交给界面重读, 不猜要删哪一条。评分与高亮可由待写队列更新。
  if (occurrence < 0 || before.length !== fresh.length ||
      !before.every((card, i) => fields.every(key => card[key] === fresh[i][key]))) return null;
  const lines = markdown.split("\n");
  lines.splice(fresh[occurrence].line, 1);
  return lines.join("\n");
}

module.exports = { removeCardRow };

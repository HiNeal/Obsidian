// 表格身份来自标题、首列表头与同名表顺序; 不依赖渲染出的表格数量。
function tableScopes(cards) {
  const groups = new Map();
  for (const card of cards) {
    if (!groups.has(card.tableKey)) groups.set(card.tableKey, {
      key: card.tableKey, heading: card.tableHeading, header: card.tableHeader,
      line: card.tableStart, end: card.line, count: 0,
    });
    const group = groups.get(card.tableKey);
    group.count++;
    group.end = card.line;
  }
  const tables = [...groups.values()];
  for (const table of tables) {
    const siblings = tables.filter(t => t.heading === table.heading);
    table.label = table.heading || table.header;
    if (table.heading && siblings.length > 1) table.label += ` · ${table.header}`;
    const same = siblings.filter(t => t.header === table.header);
    if (same.length > 1) table.label += ` ${same.indexOf(table) + 1}`;
  }
  return tables;
}
const scopeCards = (cards, key) => key == null ? cards : cards.filter(c => c.tableKey === key);
module.exports = { tableScopes, scopeCards };

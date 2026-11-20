// 序号兼容旧进度; 书签优先跟随同一表中的同一个词, 不随智能排序漂移。
function makeBookmark(session) {
  const card = session.card;
  if (!card) return null;
  const same = session.cards.filter(c => c.tableKey === card.tableKey && c.word === card.word);
  return { tableKey: card.tableKey, word: card.word, occurrence: same.indexOf(card) };
}
function restorePosition(session, bookmark, fallback = 0) {
  if (bookmark) {
    const same = session.cards.filter(c => c.tableKey === bookmark.tableKey && c.word === bookmark.word);
    const card = same[bookmark.occurrence || 0];
    const index = session.deck.indexOf(card);
    if (index >= 0) return index;
  }
  return session.clamp(fallback);
}
function progressPatch(prefs, tableKey, session) {
  // 错词小牌堆是临时练习, 不能把它的序号存成正常牌堆的进度。
  if (session.drilling || !session.card) return null;
  const bookmark = makeBookmark(session);
  if (tableKey == null) return { progress: session.index, bookmark };
  return {
    tableProgress: { ...prefs.tableProgress, [tableKey]: session.index },
    tableBookmarks: { ...prefs.tableBookmarks, [tableKey]: bookmark },
  };
}
module.exports = { makeBookmark, restorePosition, progressPatch };

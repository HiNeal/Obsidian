const { getAudioBindingText, getContentRootOfNode, getDataRows } = require("./dom");

// 指纹只取正文文本：插件自己插入的耳机和挡板都是空文本节点，
// 因此重建前后（有无按钮）算出来的指纹一致。
function playingCellFingerprint(cell) {
  return getAudioBindingText(cell).slice(0, 160);
}

function describePlayingCell(cell) {
  if (!cell || !cell.closest) return null;
  const table = cell.closest("table");
  const root = getContentRootOfNode(cell);
  if (!table || !root) return null;
  const tableIndex = Array.from(root.querySelectorAll("table")).indexOf(table);
  const rowIndex = getDataRows(table).indexOf(cell.closest("tr"));
  if (tableIndex === -1 || rowIndex === -1) return null;
  return {
    root,
    tableIndex,
    rowIndex,
    colIndex: cell.cellIndex,
    fingerprint: playingCellFingerprint(cell),
  };
}

function resolvePlayingCell(descriptor) {
  if (!descriptor || !descriptor.root || !descriptor.root.isConnected) return null;
  const table = descriptor.root.querySelectorAll("table")[descriptor.tableIndex];
  if (!table) return null;
  const row = getDataRows(table)[descriptor.rowIndex];
  if (!row) return null;
  const cell = row.querySelectorAll("td, th")[descriptor.colIndex];
  if (!cell) return null;
  // 指纹不符说明表格结构真的改了（增删行列），宁可不高亮也不要点亮错误的格子。
  if (playingCellFingerprint(cell) !== descriptor.fingerprint) return null;
  return cell;
}

module.exports = { playingCellFingerprint, describePlayingCell, resolvePlayingCell };

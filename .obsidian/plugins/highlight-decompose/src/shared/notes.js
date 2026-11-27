const SCOPE_PREFIX = "a. language/";

function isInScope(fileOrPath) {
  const path = typeof fileOrPath === "string" ? fileOrPath : (fileOrPath && fileOrPath.path) || "";
  return path.startsWith(SCOPE_PREFIX);
}

function listeningNotePath(path) {
  return String(path || "").match(/(?:^|\/)(05\. listening\/.*\.md)$/i)?.[1] || "";
}

// 听力集中表按文章分节: 表格前最近的一级标题即来源笔记 `文件夹/笔记名`。
function sectionSourceOf(cell) {
  const table = cell?.closest?.("table");
  if (!table) return "";
  const root = table.closest(".markdown-preview-view, .markdown-source-view, .view-content") || table.ownerDocument;
  let title = "";
  for (const node of root.querySelectorAll("h1, .cm-header-1, table")) {
    if (node === table) break;
    if (node.tagName !== "TABLE") title = node.textContent.replace(/^#\s*/, "").trim();
  }
  return title ? listeningNotePath(`05. listening/${title}.md`) : "";
}

// Match these three reference notes, including a vault-relative parent folder.
// These notes opt out of normal features; only their dedicated example cards run.
// This is separate from the configurable audio-only exclusions.
function isPluginExcludedNote(file) {
  const path = typeof file === "string" ? file : (file && file.path) || "";
  return /(?:^|\/)01\. base\/(?:x\.word-prefix|y\.word-root|z\.word-suffix)\.md$/i.test(path);
}

// 听说读写篇章共用本篇词表、卡片与高亮交互。
function articleNotePath(path) {
  return String(path || "").match(/(?:^|\/)((?:05\. listening|06\. reading|07\. writing|09\. speaking)\/.*\.md)$/i)?.[1] || "";
}

function articleModule(path) {
  return articleNotePath(path).match(/^\d+\. (listening|reading|writing|speaking)\//i)?.[1].toLowerCase() || "";
}

function articleHighlightSetting(path) {
  const kind = articleModule(path);
  return kind ? `hide${kind[0].toUpperCase()}${kind.slice(1)}ArticleHighlights` : "";
}

module.exports = { SCOPE_PREFIX, isInScope, sectionSourceOf, listeningNotePath, articleNotePath, articleModule, articleHighlightSetting, isPluginExcludedNote };

const { markTable } = require("../tables");

class TableSessionMethods {
  // Finalize presentation as part of rendering, before native code measures
  // a cell, locks its dimensions, focuses its editor or scrolls to it.
  patchTableRender(table) {
    if (this.tableRenderProto) return;
    let widget = null;
    for (let n = table; n && !widget; n = n.parentElement) {
      const w = n.cmTile && n.cmTile.widget;
      if (w && typeof w.getClosestCell === "function") widget = w;
    }
    if (!widget) return;
    const proto = Object.getPrototypeOf(widget);
    if (typeof proto.render !== "function") return;
    const plugin = this;
    const originalRender = proto.render;
    proto.render = function (...args) {
      const result = originalRender.apply(this, args);
      if (this.tableEl) plugin.markTableNow(this.tableEl);
      return result;
    };
    this.tableRenderProto = { proto, original: originalRender };
  }

  markTableNow(table) {
    const leaf = this.app.workspace.getLeavesOfType("markdown").find((l) => l.view.containerEl.contains(table));
    const path = (leaf && leaf.view.file && leaf.view.file.path) || "";
    markTable(table, path);
  }
}

module.exports = { TableSessionMethods };

# Highlight Decompose 架构

`main.js` 由 `build.js` 从 `src/` 生成, 改代码只改 `src/`, 然后运行 `node build.js`, 再 `node test.js`。

阅读、写作、口语共用正文双击高亮/取消高亮、选中后点击添加高亮、本篇词表匹配、悬浮卡片和本篇音频。听说读写各有独立的隐藏高亮开关; 写作与口语也有独立的悬停朗读开关。阅读、听力隐藏本篇已收录词的底色; 写作、口语隐藏全部正文高亮, 不要求词表收录。隐藏不修改源码或表格高亮。口语既有的「表达 | 释义」表兼容本篇查词。高亮切换保留范文中的加粗。

`02. word/` 与 `03. phrase/` 中带独立释义列的表格隐藏意群列, 悬停词条时在卡片中直接显示当前行的完整意群, 不显示词条前缀或中文标题。中文释义只在表格中展示, 不在卡片中重复。单词卡片保留音标、拆解与英文释义; 短语卡片显示意群。此处理只改变显示, 不改笔记源码或音频配对, 语法表保持原样。

```text
src/
  index.js          入口: 只组装, 并导出 test.js 用的纯函数
  mixin.js          installMixins: 把功能文件里的方法安装到插件类上, 重名直接报错
  shared/notes.js   两边都要用的笔记路径判断 (听力篇, 不参与功能的笔记)
  hd/               悬浮拆解 (HighlightDecomposePlugin)
    plugin.js       生命周期 (onload/onunload) + 装配
    dom.js          DOM / 表格单元格通用工具
    library.js      词库路径、表格解析、候选词
    columns.js      表格列的显示层处理 (隐藏拆解列、移动端释义等)
    tables.js       把上面两个组合成 markTable
    reading.js      阅读原文高亮与语境释义
    marks.js        标记拆分工具; 词头高亮由评分 ≥ 1 在渲染层生成 (tables.js markScoreHighlight)
    features/       挂在插件实例上的功能, 每个文件一组方法
      tableSession.js   表格重绘后重新应用显示层
      library.js        词库索引与重建
      readingWords.js   阅读原文里的悬浮词
      tooltip.js        卡片的查询、渲染与定位
  audio/            耳机点读 (TableSoundPlugin), 作为 hd 的子组件加载
    plugin.js       生命周期 + 装配
    constants.js / settings.js / settingsTab.js
    dom.js / extract.js / lookup.js / clip.js / playingCell.js
    features/       rules.js 排除规则, playback.js 播放控制, resolve.js 音频解析,
                    tables.js 表格挂载按钮, settingsStore.js 设置读写
```

依赖方向: `features/*` 与 `plugin.js` 依赖同目录的工具模块, 工具模块之间无循环;
`audio/` 不引用 `hd/`, 只共用 `shared/`; `hd/plugin.js` 是唯一同时知道两边的地方。

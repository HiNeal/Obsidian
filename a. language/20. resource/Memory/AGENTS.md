# Memory - 背单词 iOS App

本文件是 Memory 工程专用规则, 承接 [笔记库 AGENTS.md](../../../AGENTS.md)。正文唯一维护在本工程 `AGENTS.md`, 同目录 `CLAUDE.md` 必须是指向它的相对符号链接。

## 项目概览

Memory 是一款基于纯文本 `.md` 文件的背单词 iOS App。用户将词汇写入 `.md` 文件，App 自动解析并以卡片形式展示学习。左右滑动翻页; 评分读取 Obsidian 表格「评分」列; 单词、短语和进阶模式统一在右下角设置中调整, 不提供听写模式。

## 编码规范（强制执行）

### 视图开发规范
- **所有自动布局必须使用 SnapKit**，禁止使用 `NSLayoutConstraint`、`translatesAutoresizingMaskIntoConstraints`、`NSLayoutAnchor`
- 点击事件命名：`xxxClick`（如 `sampleButtonClick`）
- 对外暴露的点击回调使用闭包：`xxxAction`，参数为视图自身
- 整个视图的点击事件继承 `UIControl`，外部通过 `addTarget` 添加
- 视图模板结构：
```
// MARK: data property
// MARK: setup
// MARK: private methods
// MARK: action
// MARK: refresh
// MARK: getter lazy view
```

### 命名规范
- 变量/函数：camelCase，类型名：PascalCase
- 方法名动词开头（如 `fetchData`），布尔值 `is/has/should` 前缀
- 前缀统一使用 `MT`（Memory 的缩写）

### Swift 最佳实践
- 优先 `let` 而非 `var`
- 禁止使用 `!` 强制解包
- 优先值类型（struct）而非 class
- 异步操作使用 async/await

## 技术栈

- **语言**: Swift 5.0
- **UI 框架**: UIKit + SnapKit（纯代码布局，禁止 Storyboard）
- **依赖管理**: CocoaPods（SnapKit, LookinServer, MMKV）
- **最低部署**: 当前 iOS 26.2, 后续以工程配置为准
- **Bundle ID**: com.oyca168.www.Memory

## 运行 / 调试

- 编译入口固定为 `Memory.xcworkspace` 与 `Memory` Scheme; 真机使用当前标识 `-destination 'platform=iOS,id=<设备标识>'`, 用户明确指定的设备优先。
- **优先真机**：`xcrun devicectl list devices` 有 `connected` 或 `available` 的物理设备就优先用真机跑; 没有可用真机再退回兼容工程部署版本的模拟器
- 模拟器需要 iOS 26.2 runtime（`xcrun simctl list runtimes` 确认），低版本模拟器装不上（最低部署 iOS 26.2）
- 验证改动优先 `xcodebuild ... build` 编译过，能跑真机就直接装到真机上实测，而不是只看编译通过
- **不写单元测试**：这个工程不要单元测试，`MemoryTests/` 已经清空。验证靠编译 + 真机实测，
  不要主动补测试文件, 也不要在改动里顺手加断言式的测试。仅修改规则文档或同步卡组数据无需重新编译 App。

### 构建产物落点（强制，不可违背）

本工程位于 Dropbox 同步目录内。**构建产物一律不许写进工程目录或笔记库任何位置。**

- **禁止**给 `xcodebuild` 传指向 `~/Library/CloudStorage/` 或 `~/Library/Mobile Documents/` 的 `-derivedDataPath`
- 不传该参数用 Xcode 默认位置即可；必须显式指定时：

```bash
-derivedDataPath ~/Library/Developer/Xcode/DerivedData/Memory
```

- 同样禁止把 `Pods/`、`build/`、`*.xcuserstate` 及 App/Xcode 构建缓存重定向到同步目录; 笔记脚本缓存、设备诊断与同步报告按根规则使用笔记库 `.cache/`
- 起名不要绕过忽略规则：`memory-device-derived-data` 这类名字不匹配 `.gitignore` 里的 `DerivedData/`，曾因此漏进 Dropbox

**为什么**：`.gitignore` 只约束 git，Dropbox / iCloud 完全不看它。1835 个构建产物文件曾经由 Dropbox 同步、再经 rsync 转发进 iCloud，把 macOS File Provider 的队列打爆——累积 30 万条失败重试，Dropbox 卡在 "Syncing..." 数月。

## 目录结构

下列 Swift 源文件位于工程根目录的 `Memory/` 子目录内。

```
Memory/
├── AppDelegate.swift
├── SceneDelegate.swift
├── Info.plist
├── Memory.entitlements
├── CLAUDE.md
│
├── Modules/
│   ├── CardLibrary/
│   │   ├── MTCardLibraryViewController.swift
│   │   ├── MTCardManager.swift
│   │   └── Models/MTCardLibraryModels.swift
│   │
│   └── StudyCards/
│       ├── Controllers/
│       │   ├── MTLearningCardsViewController.swift
│       │   └── MTStudySettingsViewController.swift
│       ├── Views/
│       │   ├── MTLearningCardView.swift
│       │   └── MTIconControlButton.swift
│       ├── Models/
│       │   ├── MTLearningCardModels.swift
│       │   └── MTAutoplaySettings.swift
│       └── Data/
│           ├── MTTextCardParser.swift
│           └── MTDeckAudioIndex.swift
│
└── MemoryShareExtension/
```

## 卡片格式与解析规则（纯表格）

```
| 单词 | 释义 | 记忆 | 英意 | 意群 |                                ← 表头自动跳过
| --- | --- | --- | --- | --- |
| nutmeg<br>/ˈnʌtmeɡ/ | n. 肉豆蔻 | 记忆锚点… | n. the hard seed… | The **nutmeg** tree |   ← 每行一张卡片
```

- **只解析以 `|` 开头的表格行**，其他行（标题、正文、空行）全部忽略
- 表头 = 紧邻 `|---|` 分隔行之前的那一行，自动跳过；仅已声明的词汇表头可生成卡片，参考表不进入学习队列
- **现行标准版式**：
  - 通用词汇表为统一五列 `| 单词 | 释义 | 记忆 | 英意 | 意群 |`：第一列为单词原形, 换行后接音标（`word<br>/音标/`, 词头只取第一行, 卡面不展示音标），第二列为独立中文释义列，第三列为记忆锚点，第四列「英意」为 ODE 英文释义（原「拆解」，显示层收起隐藏，悬浮弹卡片），第五列为意群（原文例句并加粗靶心词）；意群列按表头名定位；
  - 集中听力词块表与通用短语表为三列 `| 单词/短语 | 释义 | 意群 |`：第一列为单词或短语，第二列为中文释义，第三列为意群；
  - 语法表（`04. grammer/`）为 `| 语法词条 | 意群 | 释义 |`：词条在第一列，意群在第二列，释义在第三列。
- **卡片字段映射**：
  - 现行版式：第一列为词头（`word`），第二列为释义（`meaning`），第三列为意群（`meaningUnit`，加粗文字提取为听写靶心）；
  - 兼容旧版：`意群 | 单词 | 释义 | 拆解`、`单词 | 短语 | 拆解`、`单词 | 意群 | 释义 | 拆解`、`短语 | 单词 | 拆解` 及合并单元格 `核心词<br><br>释义`；
  - 释义取「释义」列（没有该列的表取「拆解」列首个 `<br><br>` 前的部分，若首段为音标则连同下一段一起取）；
- 例外：`词根 / 前缀 / 后缀 | 例子` 的第二列装的是派生词表不是例句，按无短语处理，不上卡
- 第一列若不是合并单元格（如 `题目表达 | 原文表达`），两侧都是英文，按英英对仗卡片处理
- 单元格内 `<br>` 转为换行，`**加粗**` 剥除；释义里的 Obsidian `==考过义项==` 保留内容并在卡面显示浅绿色底色，允许一格多处高亮。词头和短语中的标记仍按各自规则剥除。

### 不可违背
- **卡组只用 Markdown 表格**：不引入 JSON 卡组或逐文章义项映射。设备诊断 JSON 与同步核对报告允许存于笔记库 `.cache/`。
- **统一格式**：所有卡片同一规则
- **零心智负担**：从 Obsidian 直接拷贝表格即可用

## 数据流

```
.md 文件 (Documents/decks/，电脑经 USB 直接导入：笔记库 .cache/import_to_memory.py)
    ↓
MTTextCardParser.parse(url:)
    ↓
MTLearningCardsConfiguration + [MTLearningStudyCard]
    ↓
MTLearningCardsViewController（卡片）
    ↓
MTSpeechPlayer ← MTDeckAudioIndex（卡组目录下的 audio/）
```

## 交互与按钮布局

- 学习页顶部导航栏中央不显示标题或章节徽章; 切换卡片与表格时不恢复。
- 翻页：左右滑动卡片（左滑下一张，右滑上一张，首尾循环）
- 单词模式、短语模式和进阶开关统一在右下角设置页调整; 不设右上角模式按钮或听写模式。App 内不提供加/删收藏的按钮（见决策 7）。
- 控制栏 5 按钮，上一张/下一张分列播放键两侧：

```
[🔁/🔀]  [‹]  [▶⏸]  [›]  [⚙]
 48pt    50pt  72pt  50pt  48pt
```
- 手势分区：左边缘 44pt 以内右滑 = 系统返回；其余区域滑动 = 翻页（挂在整个页面，卡片外起手也能翻）

## 本地录音与同步

- 唯一同步入口是笔记库 `.cache/import_to_memory.py`, 选表规则为 `.cache/migrate_to_memory.py`; 不恢复 MemoryData 中间目录或 App 内云下载。
- 用户要求同步时使用 `--only` 限定相关笔记或模块; 音频未变用 `--no-audio`, 不默认全量推送。Python / uv 缓存使用笔记库 `.cache/uv`。
- 用户只说「加入单词」时先在整个 `02. word/` 查规范原形; 已收录则跳过, 未收录则插入 `02. word/未整理单词.md` 的 `# 未整理单词` 表格首行; 短语先入 `03. phrase/未整理短语.md`, 不录回文章或另建重复卡组; 明确指定其他目标时仍先全库查重。
- 手机路径与笔记严格镜像: `Documents/decks/<笔记相对路径去掉.md>/<笔记文件名>`。按现有源笔记及根规则限定的模块导入, 新单词和短语先进入各自的未整理笔记。阅读文章不重复积累词汇, 同义改写统一从 `# 题目` 的高亮注释提取, 不保留独立表。
- 词库目录名为 `02. word/a. 剑雅阅读真题/`、`b. 雅思词汇真经/`、`d. 剑桥学术词汇/`、`e. 538 同义替换/`、`f. 巴朗核心词汇/`、`z. 基础核心词汇/`。
- 改名或清理前备份卡组文本、学习状态与源清单; 旧卡组整目录改名, `state` / `state.crc` 和 `audio/` 跟随移动。不能仅新建同内容卡组就声称进度已迁移。
- USB 同步可改名与清理所选范围; 无线 devicectl 仅合并同路径文件, 改名任务须另行核对状态。`.source-decks` 始终写完整当前源卡组清单, App 只加载清单中的卡组。
- 交付前回读文本, 核对所推音频文件名、大小并抽样校验内容, 核对有效卡组学习状态; 过期目录的状态保留备份。
- 电脑音频源唯一保存在 `20. resource/<笔记完整相对路径>/audio/`, 按笔记路径镜像; 已有录音直推手机卡组 `audio/`, 不在云端建立卡组音频副本。
- App 只播放当前卡组 `audio/` 的本地录音。缺失、损坏或不可读就跳过, 不调用系统语音合成、不跨卡组查找、不朗读释义。
- 单词模式只播放词头; 短语模式按「短语 → 词头」播放。自动播放计时与实际可用录音清单一致。Obsidian 表格耳机仍按自己的「词头 → 短语」顺序。
- 阅读仅导入单词、短语和同义改写, 保留相应现有音频与卡片顺序; 不导入篇章音频卡及文章朗读音频。集中听力词块的音频来源按原笔记一级标题解析。
- 生成音频必须有用户当次明确授权; 词头、词块、短语与篇章统一用 Emma `bf_emma`, 各读一次。听力真题短语仍取原声切片, 不以 TTS 替换。
- slug 与生成器和 Obsidian 插件一致: 小写、NFD 去变音符、删除 Markdown 标记（包括 `==`）、撇号转 `_`、空白与其他标点转 `_`、合并下划线, 保留连字符。
- `MTDeckAudioIndex` 只索引本卡组目录, 先试 `<slug>.mp3`, 再试 `chunk_<slug>.mp3`; `audio/` 不作为子卡组, 不自动淘汰, 标记为不进入 iCloud 备份。
- 替换卡组时整目录保留音频, 不把大音频目录读入内存备份。

## 播放顺序与评分

- 默认播放参数以 `MTAutoplaySettings` 的现行实现为准, 不从旧说明恢复默认值。
- 循环播放保持源笔记顺序; 智能播放按评分 5 → 0 分组, 同分保持源顺序, 不按字母排序。
- 所有卡组默认智能排序; 旧卡组首次升级时统一切为智能排序, 之后保留用户手动选择。
- Obsidian 是唯一评分来源: 优先按表头读取「评分」列的 0–5 分, 空值或无效值按 0 分处理, 超出范围限制到 0–5。无评分列的旧表兼容词头高亮或整格加粗的 0 / 1 分。不读取旧 `score.*` / `tierScore.*`。进阶模式包含所有评分大于 0 的卡片。
- App 点击仅查看当前分数或按学习模式揭晓答案, 不加减分、不另存评分覆盖源笔记。
- 进阶开关关闭则刷全量; 卡组里没有大于 0 分的词时该开关不可用。设置页只保留标题和控件, 不显示解释性页脚。
- 短语中的局部加粗是听写靶心, 中文释义中的局部 `==语境义==` 以浅绿色底色显示且不改变词头分数。不重建旧的行为推断评分或轮休机制。

## 动画参数

- 卡片切换：`CATransform3D` + `m34 = -1.0/900`，`damping: 0.72, velocity: 0.8`

## 换表提示（覆盖物，不进牌堆）

循环播放（笔记顺序）下换到下一张表时，整屏铺开这张表的表头，停一拍，再收拢成胶囊
飞进导航栏的徽章。约 3.6 秒，其中 3.1 秒在动、0.5 秒静止。

- **它是覆盖物，不是卡片**。做成真卡片插进牌堆试过：索引、进度、打分、智能排序四条
  主干全要为一张没有词的卡开特例，放弃。覆盖物挂在 `view.window` 上，收完就没了，
  牌堆里根本不存在它。
- **演出期间吃掉所有触摸，且卡片周期不开始**：朗读、复习揭晓、自动播放计时都等它
  收完才起算（`isAwaitingSectionHerald` → `startCurrentCardCycle()`）。否则封面底下
  已经在念词，这一下等于白演。
- **智能播放不演**：那边按熟悉度重排，同一张表的词被打散在整副牌里，换表变成每隔
  几张一次（剑雅15 Test1-1 实测：笔记顺序全程 4 次，智能播放刷开后每 4.7 张一次），
  而且那不是章节推进，只是这张卡碰巧来自哪张表。
- **横屏沉浸阅读照演**，只是导航栏藏着没有徽章，终点改到顶部安全区中间再淡出。
  转屏一律撤销半路的演出并放行卡片周期——尺寸和落点都是按旧版式算的，留着必然错位。

踩过的坑，改这段前先读：

- **三段动画必须串行**（入场 → 收拢 → 飞行，各自在上一段的 completion 里起）。
  `UIView.animate(delay:)` 会立刻把模型值写成终点，延迟期间靠 backwards fill 显示起点；
  同一个属性上叠两段带 delay 的动画，后一段记下的起点已经是前一段写好的终点，于是
  延迟期间只补得回后一段的位移——实测底板从第一帧起就停在 y = −288，屏幕下半截整场露着。
- **收拢时不能调 `layoutIfNeeded()`**，`isCollapsing` 期间 `layoutSubviews` 直接返回。
  那时 panel 的宽度已经是胶囊的宽度，再排一次标题会被挤到左上角并折行。
- **`addSubview` 之后要 `setNeedsLayout()` 再 `layoutIfNeeded()`**。加进去时 panel 的
  bounds 还是零，第一次布局已按零宽给标题算过一个畸形尺寸（实测 374×745），不标脏
  的话它会一直留到上屏。
- **收尾回调里先绑定再 `removeFromSuperview()`**。覆盖层唯一的强引用是父视图，
  `sectionHeraldView` 和闭包捕获都是 weak，先移除的话对象当场析构，后面的
  `guard let` 必然失败，放行卡片周期那一句永远执行不到——表现是换表后不朗读、
  自动播放停住不动。
- **整屏直接缩到徽章不行**：屏幕是竖的、徽章是扁的，等比缩把宽度压成一条线，
  不等比缩把字拉变形。所以先收成同构的胶囊，第二程才只是位移加等比缩放。
- **满屏用表头的实色**（不是徽章那种浅色底）：浅色铺满整屏和白卡片分不出边界，
  确实盖住了但看不出来，观感就是「只盖了卡片那一块」。

## 关键决策

0. **没有云同步（2026-10-02）**：Dropbox / iCloud 同步代码全部删除，MemoryData 中间目录也已删除。卡组和音频统一通过笔记库 `.cache/import_to_memory.py` 写入 `Documents/decks/`, USB 优先、无线合并作补充, 路径与笔记库 1:1。首页下拉只重新扫描本地卡组。

1. **不用 JSON**：纯文本更简单
2. **Share Extension**：UTI 声明在 iOS 上不可靠
3. **5 按钮控制栏**：顺序 / 上一张 / 播放 / 下一张 / 设置。单词模式、短语模式和进阶开关合并到右下角设置页
4. **半屏弹窗设置**：只剩自动播放间隔
5. **进阶标记来自 Obsidian**: 新标记使用词头整格 `==word==`, 无标记为基础; 旧整格加粗仅作兼容, 不再指导新增; App 不提供星标或评分修改（见决策 7）
6. **手动操作停 autoplay**：拖进度条/切顺序都停
7. **学习状态存 MMKV**（`MTAutoplaySettings`）:
   - 分层名单每次解析源笔记时按词头整格标记计算, 不单独保存或从旧评分转换。
   - 每个卡组文件夹独立保存自动播放间隔、播放顺序、进阶开关及当前卡片位置, `state` / `state.crc` 与 `.md` 同级。
   - 合并卡组的卡片仍引用其来源卡组; 移动目录或替换文本时保留学习状态, 不清空 Documents。
   - 卡面不显示音标, 释义保持同一套中文释义样式。

8. **布局只允许 SnapKit**：禁止系统 NSLayoutConstraint

9. **本地录音跟随卡组**: `audio/` 是卡组的一部分, 不设独立下载、LRU 或自动淘汰机制; 缺失录音跳过, 不启用系统合成兜底。

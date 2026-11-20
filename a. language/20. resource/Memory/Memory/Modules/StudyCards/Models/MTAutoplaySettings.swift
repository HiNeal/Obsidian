//
//  MTAutoplaySettings.swift
//  Memory
//
//  Created by GPT-5.5 on 5/7/26.
//

import Foundation
import MMKV

/// MMKV unconditionally creates this subdirectory inside any custom
/// `rootPath` the first time it's opened (see `MMKV::getMMKVWithID` in
/// MMKVCore), regardless of whether any key ever needs it. Since every deck
/// folder is opened as a custom MMKV rootPath (for familiarity level /
/// autoplay settings), this folder appears as a side effect inside every
/// deck folder and must be excluded from deck listing/import — otherwise
/// listing it triggers computing its own familiarity level, which opens
/// *its* path as an MMKV rootPath too, spawning another one nested inside,
/// forever.
nonisolated let mtMMKVReservedDirectoryName = "specialCharacter"

nonisolated enum MTPlayOrder: String, CaseIterable, Sendable {
    /// 按笔记里的原始顺序循环。
    case loop = "loop"
    /// 按 2、1、0 分排序，同分保持笔记顺序。
    case smart = "smart"

    var title: String {
        switch self {
        case .loop: return "循环播放"
        case .smart: return "智能播放"
        }
    }

    var iconName: String {
        switch self {
        case .loop: return "repeat"
        case .smart: return "wand.and.stars"
        }
    }
}

nonisolated enum MTStudyContentMode: String, CaseIterable, Sendable {
    case word
    case meaningUnit

    var title: String {
        switch self {
        case .meaningUnit: return "短语模式"
        case .word: return "单词模式"
        }
    }

    var iconName: String {
        switch self {
        case .meaningUnit: return "text.quote"
        case .word: return "textformat.abc"
        }
    }
}

nonisolated enum MTFamiliarityLevel: Int, CaseIterable, Codable, Sendable {
    case none = 0
    case unfamiliar = 1 // 1阶段：陌生
    case familiar = 2   // 2阶段：熟悉
    case mastered = 3   // 3阶段：精通

    var title: String {
        switch self {
        case .none: return "未标记"
        case .unfamiliar: return "陌生"
        case .familiar: return "熟悉"
        case .mastered: return "精通"
        }
    }

    var detailDescription: String {
        switch self {
        case .none: return "未标记"
        case .unfamiliar: return "待巩固"
        case .familiar: return "复习中"
        case .mastered: return "已精通"
        }
    }

    /// 品牌标配色 (小红书红 #FF2442 / 淘宝黄 #FF5000 / 豆瓣绿 #00B51D)
    var color: UIColor {
        switch self {
        case .none:
            // 默认系统蓝 (#007AFF)
            return .systemBlue
        case .unfamiliar:
            // 小红书红 (#FF2442)
            return UIColor(red: 255/255.0, green: 36/255.0, blue: 66/255.0, alpha: 1.0)
        case .familiar:
            // 淘宝黄/橙 (#FF5000)
            return UIColor(red: 255/255.0, green: 80/255.0, blue: 0/255.0, alpha: 1.0)
        case .mastered:
            // 豆瓣绿 (#00B51D)
            return UIColor(red: 0/255.0, green: 181/255.0, blue: 29/255.0, alpha: 1.0)
        }
    }

    /// 精致徽章高感半透明背景
    var badgeBackgroundColor: UIColor {
        return color.withAlphaComponent(0.12)
    }

    /// 精致徽章微边框颜色
    var badgeBorderColor: UIColor {
        return color.withAlphaComponent(0.28)
    }

    /// 极简圆点标识
    var iconName: String {
        switch self {
        case .none: return "circle"
        default: return "circle.fill"
        }
    }
}

/// Per-deck study state: autoplay interval/order, focus mode and reading
/// progress are backed by one MMKV instance per deck, mapped inside the
/// deck's own folder (`<deck folder>/state`) — renaming/moving/re-importing
/// the folder carries that state along automatically (see
/// `MTCardLibraryViewController.replaceKeepingStudyState`).
///
/// Obsidian 是唯一评分来源: 优先读取导入表格的 0–5 分评分列。
/// 旧 `score.*` / `tierScore.*` 均不读取，也不通过 App 点击另存评分。
nonisolated enum MTAutoplaySettings {
    static let minimumInterval: TimeInterval = 0
    static let maximumInterval: TimeInterval = 6
    static let defaultInterval: TimeInterval = 2.3

    // MARK: - Interval

    /// 下限放到 0 之后不能再拿 `saved == 0` 当「没设置过」的哨兵——那样用户把
    /// 停顿调成 0 会被当成未设置、弹回默认的 3 秒。改用 `contains(key:)` 判断。
    static func interval(for directory: URL?) -> TimeInterval {
        guard let store = store(for: directory), store.contains(key: Key.interval) else {
            return defaultInterval
        }
        return clamp(store.double(forKey: Key.interval))
    }

    static func setInterval(_ value: TimeInterval, for directory: URL?) {
        store(for: directory)?.set(clamp(value), forKey: Key.interval)
    }

    static func displayText(for interval: TimeInterval) -> String {
        let clampedValue = clamp(interval)
        if clampedValue == 0 { return "不停顿" }
        return clampedValue == floor(clampedValue)
            ? "\(Int(clampedValue)) 秒 / 张"
            : String(format: "%.1f 秒 / 张", clampedValue)
    }

    // MARK: - Play order

    static func playOrder(for directory: URL?) -> MTPlayOrder {
        guard let raw = store(for: directory)?.string(forKey: Key.playOrder),
              let order = MTPlayOrder(rawValue: raw) else { return .smart }
        return order
    }

    static func setPlayOrder(_ order: MTPlayOrder, for directory: URL?) {
        store(for: directory)?.set(order.rawValue, forKey: Key.playOrder)
    }

    /// Apply play order to a deck of cards.
    ///
    /// 旧的「乱序循环」已经移除：纯随机既不照顾难词，也破坏笔记里按主题编排的
    /// 相邻关系，智能播放在这两件事上都严格更好。存过 `shuffleLoop` 的卡组读不出
    /// 合法值，会退回默认的 `.smart`。
    static func applyPlayOrder(_ order: MTPlayOrder,
                               to cards: [MTLearningStudyCard],
                               for directory: URL?) -> [MTLearningStudyCard] {
        switch order {
        case .loop: return cards
        case .smart:
            return rebuildSmartOrder(cards, for: directory)
        }
    }

    // MARK: - Obsidian 标记评分

    /// 读取源笔记的 0–5 分; 无评分列的旧表兼容词头标记的 0 / 1 分。
    static func score(for card: MTLearningStudyCard) -> Int {
        min(5, max(0, card.focusLevel))
    }

    /// 智能播放的牌序：按 Obsidian 标记分数从高到低，同分保持笔记原顺序。
    ///
    /// 同分必须显式兜住——Swift 的 `sorted` 不保证稳定，不兜的话同分卡片每轮
    /// 排出来的先后都不一样，看着像在乱跳。
    static func rebuildSmartOrder(_ cards: [MTLearningStudyCard],
                                  for directory: URL?) -> [MTLearningStudyCard] {
        var buckets: [Int: [MTLearningStudyCard]] = [:]
        for card in cards {
            let score = score(for: card)
            buckets[score, default: []].append(card)
        }
        // 0–5 分降序排列, 同分保持笔记原顺序。
        return buckets.keys.sorted(by: >).flatMap { buckets[$0] ?? [] }
    }


    // MARK: - Focus mode

    /// 进阶模式筛选评分大于 0 的卡片, 使用独立开关。
    /// 可以同时开。**默认开**：没存过就沿用旧的聚焦开关（它本身默认开）——进卡组先刷
    /// 自己标过的重点，想看全量再手动关掉。卡组里没有这一层的词时，卡片页会自行忽略
    /// 这个开关（见 `MTLearningCardsViewController.enabledFocusTiers()`），不会锁在空牌堆里。
    static func isFocusTierEnabled(_ level: Int, for directory: URL?) -> Bool {
        guard let mmkv = store(for: directory) else { return true }
        let key = Key.focusTier(level)
        if mmkv.contains(key: key) { return mmkv.bool(forKey: key) }
        return mmkv.contains(key: Key.focusMode) ? mmkv.bool(forKey: Key.focusMode) : true
    }

    static func setFocusTierEnabled(_ enabled: Bool, level: Int, for directory: URL?) {
        store(for: directory)?.set(enabled, forKey: Key.focusTier(level))
    }

    // MARK: - Dictation mode (per-deck, default OFF)

    static func isDictationModeEnabled(for directory: URL?) -> Bool {
        store(for: directory)?.bool(forKey: Key.dictationMode) ?? false
    }

    static func setDictationModeEnabled(_ enabled: Bool, for directory: URL?) {
        store(for: directory)?.set(enabled, forKey: Key.dictationMode)
    }

    // MARK: - Card content mode (per-deck, default word)

    static func contentMode(for directory: URL?) -> MTStudyContentMode {
        guard let raw = store(for: directory)?.string(forKey: Key.contentMode),
              let mode = MTStudyContentMode(rawValue: raw) else { return .word }
        return mode
    }

    static func setContentMode(_ mode: MTStudyContentMode, for directory: URL?) {
        store(for: directory)?.set(mode.rawValue, forKey: Key.contentMode)
    }

    // MARK: - Review mode (per-deck, default OFF)

    /// 复习模式：卡片先只露单词，过 revealDelay 秒后释义自动淡入，留出主动回忆时间。
    /// 未设置过开关时默认关闭；明确保存过的开关状态仍按反向存储值读取。
    static func isReviewModeEnabled(for directory: URL?) -> Bool {
        guard let store = store(for: directory),
              store.contains(key: Key.reviewModeDisabled) else { return false }
        return !store.bool(forKey: Key.reviewModeDisabled)
    }

    static func setReviewModeEnabled(_ enabled: Bool, for directory: URL?) {
        store(for: directory)?.set(!enabled, forKey: Key.reviewModeDisabled)
    }

    static let minimumRevealDelay: TimeInterval = 0.3
    static let maximumRevealDelay: TimeInterval = 3
    static let defaultRevealDelay: TimeInterval = 0.3

    static func revealDelay(for directory: URL?) -> TimeInterval {
        let saved = store(for: directory)?.double(forKey: Key.revealDelay) ?? 0
        return clampReveal(saved == 0 ? defaultRevealDelay : saved)
    }

    static func setRevealDelay(_ value: TimeInterval, for directory: URL?) {
        store(for: directory)?.set(clampReveal(value), forKey: Key.revealDelay)
    }

    static func revealDelayText(for delay: TimeInterval) -> String {
        let value = clampReveal(delay)
        return value == floor(value)
            ? "\(Int(value)) 秒"
            : String(format: "%.1f 秒", value)
    }

    private static func clampReveal(_ value: TimeInterval) -> TimeInterval {
        min(max(value, minimumRevealDelay), maximumRevealDelay)
    }

    // MARK: - Reading progress (current card index)

    static func progressIndex(for directory: URL?) -> Int {
        Int(store(for: directory)?.int32(forKey: Key.progressIndex) ?? 0)
    }

    static func setProgressIndex(_ index: Int, for directory: URL?) {
        store(for: directory)?.set(Int32(index), forKey: Key.progressIndex)
    }

    static func clearProgressIndex(for directory: URL?) {
        store(for: directory)?.removeValue(forKey: Key.progressIndex)
    }

    // MARK: - Last opened deck (global — for the home screen's quick-resume entry)

    /// 上次打开的那副牌由哪几个卡组组成（`MTCardManagerItem.id`）。
    ///
    /// 存的是**列表**而不是单个 ID：合并卡组是由一组卡组临时拼出来的，没有单一
    /// 的 id 可记，`deckDirectoryURL` 也是 nil——之前因此完全进不了「回到上次现场」。
    ///
    /// 旧版本存的是单个 ID，这里读不到新键就退回去读它，不丢已有的入口。
    static func lastOpenedDeckIDs() -> [String] {
        if let raw = globalStore?.string(forKey: Key.lastOpenedDeckIDs), !raw.isEmpty {
            return raw.components(separatedBy: "\n").filter { !$0.isEmpty }
        }
        guard let legacy = globalStore?.string(forKey: Key.lastOpenedDeckID), !legacy.isEmpty else {
            return []
        }
        return [legacy]
    }

    static func setLastOpenedDeckIDs(_ ids: [String]) {
        let cleaned = ids.filter { !$0.isEmpty }
        guard !cleaned.isEmpty else {
            globalStore?.removeValue(forKey: Key.lastOpenedDeckIDs)
            return
        }
        globalStore?.set(cleaned.joined(separator: "\n"), forKey: Key.lastOpenedDeckIDs)
    }

    // MARK: - Active deck (状态恢复)

    /// **退出 App 的那一刻正开着**的那副牌，和 `lastOpenedDeckIDs`（曾经打开过）不是一回事。
    ///
    /// iOS 会在后台回收 App，这很正常，不该靠"后台常驻"去对抗。要解决的是回来之后
    /// 还得重新翻目录选卡组——所以记下"离开时正开着哪一副牌"，下次启动直接落回去，
    /// 配合每张卡都在存的 `progressIndex`，连位置都不会丢。合并牌堆同等对待。
    ///
    /// 卡片页出现时写入，**返回卡片库时清掉**：你自己退出来的，下次就该看到列表。
    static func activeDeckIDs() -> [String] {
        if let raw = globalStore?.string(forKey: Key.activeDeckIDs), !raw.isEmpty {
            return raw.components(separatedBy: "\n").filter { !$0.isEmpty }
        }
        guard let legacy = globalStore?.string(forKey: Key.activeDeckID), !legacy.isEmpty else {
            return []
        }
        return [legacy]
    }

    static func setActiveDeckIDs(_ ids: [String]) {
        let cleaned = ids.filter { !$0.isEmpty }
        guard !cleaned.isEmpty else {
            globalStore?.removeValue(forKey: Key.activeDeckIDs)
            globalStore?.removeValue(forKey: Key.activeDeckID)
            return
        }
        globalStore?.set(cleaned.joined(separator: "\n"), forKey: Key.activeDeckIDs)
    }

    // MARK: - Speech playback (global, default OFF)

    /// **默认关**。翻卡时默认安静，想听再自己打开。
    ///
    /// 键名仍是 `speechPlaybackDisabled`（反向），改名要迁移存量数据，不值当；
    /// 默认值从「没存过 = 开」翻成「没存过 = 关」即可。
    static func isSpeechPlaybackEnabled() -> Bool {
        globalStore?.contains(key: Key.speechPlaybackDisabled) == true
            ? !(globalStore?.bool(forKey: Key.speechPlaybackDisabled) ?? false)
            : false
    }

    static func setSpeechPlaybackEnabled(_ enabled: Bool) {
        globalStore?.set(!enabled, forKey: Key.speechPlaybackDisabled)
    }

    /// Applies the current timing defaults once. Saved 5-second and 3-second values
    /// came from earlier app defaults, so they move to the current 2.3-second default;
    /// any other saved interval remains the user's deliberate choice.
    /// 一次性清理：聚焦改成解析时当场算（`MTLearningStudyCard.isFocused`）之后，
    /// 老版本在全局 MMKV 里留下的那份收藏词表再没人读写，开机顺手删掉。
    static func removeLegacyFavoritesStore() {
        globalStore?.removeValue(forKey: Key.legacyFavorites)
    }

    static func applyStudyTimingDefaults() {
        // 默认值每变一次就换一个新键，让这次迁移在每台装机上重新跑一遍。
        guard !(globalStore?.bool(forKey: Key.studyTimingDefaultsApplied) ?? false) else { return }
        guard let documentsDirectory = FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        ).first else { return }

        let decksRoot = documentsDirectory.appendingPathComponent("decks", isDirectory: true)
        var directories = [decksRoot]
        if let enumerator = FileManager.default.enumerator(
            at: decksRoot,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) {
            for case let url as URL in enumerator {
                if (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true {
                    // 不钻进 audio/：里面是几万个 mp3，枚举它们纯属白走。
                    if url.lastPathComponent == "audio" {
                        enumerator.skipDescendants()
                        continue
                    }
                    directories.append(url)
                }
            }
        }

        for directory in directories where containsCardFile(in: directory) {
            prepareStore(for: directory)
            guard let mmkv = store(for: directory), mmkv.contains(key: Key.interval) else { continue }
            // 旧默认（5 秒、以及上一版写进来的 3 秒）统一换成现行默认；其他值是用户自己调的，不动。
            let savedInterval = mmkv.double(forKey: Key.interval)
            if savedInterval == 5 || savedInterval == 3 {
                mmkv.set(defaultInterval, forKey: Key.interval)
            }
        }
        globalStore?.set(true, forKey: Key.studyTimingDefaultsApplied)
    }

    /// One instance for the whole app (default MMKV root, outside
    /// `Documents/decks/` so it's never mistaken for a deck folder).
    private static var globalStore: MTMemoryStudyStore? {
        instancesLock.lock()
        defer { instancesLock.unlock() }
        return cachedGlobalStore
    }
    private static var cachedGlobalStore: MTMemoryStudyStore?

    static func prepareGlobalStore() {
        guard let disk = MMKV.default() else { return }
        let memory = MTMemoryStudyStore(disk)
        instancesLock.lock()
        cachedGlobalStore = memory
        instancesLock.unlock()
    }

    // MARK: - Familiarity level (per-deck)

    static func familiarityLevel(for directory: URL?) -> MTFamiliarityLevel {
        let raw = Int(store(for: directory)?.int32(forKey: Key.familiarityLevel) ?? 0)
        return MTFamiliarityLevel(rawValue: raw) ?? .none
    }

    static func setFamiliarityLevel(_ level: MTFamiliarityLevel, for directory: URL?) {
        if level == .none {
            store(for: directory)?.removeValue(forKey: Key.familiarityLevel)
        } else {
            store(for: directory)?.set(Int32(level.rawValue), forKey: Key.familiarityLevel)
        }
    }

    // MARK: - Store

    private nonisolated enum Key {
        static let interval = "interval"
        static let playOrder = "playOrder"
        static let smartOrderDefaultApplied = "smartOrderDefaultAppliedV1"
        /// 旧的单一聚焦开关，只读：作为两个分层开关没存过时的默认值。
        static let focusMode = "focusMode"
        static func focusTier(_ level: Int) -> String { "focusTier\(level)" }
        static let dictationMode = "dictationMode"
        static let contentMode = "contentMode"
        static let reviewModeDisabled = "reviewModeDisabled"
        static let revealDelay = "revealDelay"
        static let progressIndex = "progressIndex"
        static let lastOpenedDeckID = "lastOpenedDeckID"          // 旧版：单个
        static let lastOpenedDeckIDs = "lastOpenedDeckIDs"
        static let activeDeckID = "activeDeckID"                  // 旧版：单个
        static let activeDeckIDs = "activeDeckIDs"
        /// 已废弃：旧的全局收藏词表，只在 `removeLegacyFavoritesStore()` 里出现一次。
        static let legacyFavorites = "favorites"
        static let speechPlaybackDisabled = "speechPlaybackDisabled"
        static let familiarityLevel = "familiarityLevel"
        static let studyTimingDefaultsApplied = "studyTimingDefaultsApplied.2_3s"
    }

    // Deck directories always already exist by the time a configuration is
    // built (they contain the deck's own .md files), and MMKV instances are
    // cheap to keep once open — cache by path so hot paths (every swipe,
    // every autoplay tick) don't pay for a fresh mmap + lookup each call.
    private static var instances: [String: MTMemoryStudyStore] = [:]
    // Detached library refreshes can overlap, including after cancellation.
    // MMKV's internal locking does not protect this Swift cache.
    private static let instancesLock = NSLock()

    private static var ephemeralStore: MTMemoryStudyStore?

    private static func store(for directory: URL?) -> MTMemoryStudyStore? {
        instancesLock.lock()
        defer { instancesLock.unlock() }
        return directory.map { instances[$0.path] } ?? ephemeralStore
    }

    /// 仅从后台工作队列调用：打开磁盘并构建快照，锁内只发布内存引用。
    static func prepareStore(for directory: URL?) {
        if store(for: directory) != nil { return }
        let disk: MMKV?
        if let directory {
            disk = MMKV(mmapID: "state", rootPath: directory.path)
        } else {
            disk = MMKV(mmapID: "ephemeral_combined_deck_state", mode: .singleProcess)
        }
        guard let disk else { return }
        let memory = MTMemoryStudyStore(disk)
        // 现有卡组首次升级时也统一切到智能排序, 此后保留用户手动选择。
        if !memory.bool(forKey: Key.smartOrderDefaultApplied) {
            memory.set(MTPlayOrder.smart.rawValue, forKey: Key.playOrder)
            memory.set(true, forKey: Key.smartOrderDefaultApplied)
        }
        instancesLock.lock()
        if let directory { instances[directory.path] = memory }
        else { ephemeralStore = memory }
        instancesLock.unlock()
    }

    static func syncStores() {
        instancesLock.lock()
        let stores = Array(instances.values) + [cachedGlobalStore, ephemeralStore].compactMap { $0 }
        instancesLock.unlock()
        stores.forEach { $0.sync() }
    }

    private static func containsCardFile(in directory: URL) -> Bool {
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil
        ) else { return false }
        return files.contains { $0.pathExtension.lowercased() == "md" }
    }

    /// Closes and evicts the cached MMKV instance for a directory. Call this
    /// before the directory's `state`/`state.crc` files are deleted out from
    /// under it (e.g. re-importing a deck folder) — otherwise a later read/
    /// write in this session could keep hitting the stale in-memory instance
    /// instead of the freshly restored file on disk.
    static func closeInstance(for directory: URL?) {
        instancesLock.lock()
        let cached = directory.map { instances.removeValue(forKey: $0.path) } ?? ephemeralStore
        instancesLock.unlock()
        if directory == nil { cached?.clearAll() }
        else { cached?.close() }
    }

    /// 文件夹改名时，先落盘并关闭旧路径下的映射，新路径随后重新预热。
    static func closeStores(under directory: URL) {
        let prefix = directory.path + "/"
        instancesLock.lock()
        let paths = instances.keys.filter { $0 == directory.path || $0.hasPrefix(prefix) }
        let stores = paths.compactMap { instances.removeValue(forKey: $0) }
        instancesLock.unlock()
        stores.forEach { $0.sync(); $0.close() }
    }

    // MARK: - Private

    private static func clamp(_ interval: TimeInterval) -> TimeInterval {
        min(max(interval, minimumInterval), maximumInterval)
    }
}

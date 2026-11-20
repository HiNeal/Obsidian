//
//  MTCardManager.swift
//  Memory
//
//  Created by Claude on 5/15/26.
//

import Foundation
import MMKV
import UIKit

nonisolated struct MTCardManagerItem: Sendable {
    let id: String
    let title: String
    let subtitle: String
    let cardCount: Int
    /// 其中当前评分为 1 或 2 的张数。
    let focusedCount: Int
    let isEmpty: Bool
    let familiarityLevel: MTFamiliarityLevel
}

nonisolated enum MTCardManager {
    static let cardListChangedNotification = Notification.Name("MTCardListChanged")

    // MARK: - Listing

    static func listCards(at path: String? = nil) -> [MTCardManagerItem] {
        ensureLocalCardsDirectory()
        var items: [MTCardManagerItem] = []

        guard let root = localCardsRoot else { return items }
        let baseDir = path.map { root.appendingPathComponent($0) } ?? root
        let folderNames = subdirectoryNames(at: baseDir)
        for name in folderNames.sorted() {
            let folderURL = baseDir.appendingPathComponent(name)
            let mdFiles = cardFiles(at: folderURL)
            let counts = cardCounts(in: mdFiles)
            let childFolders = subdirectoryNames(at: folderURL)
            let hasContent = counts.total > 0 || !childFolders.isEmpty
            let subPath = path.map { "\($0)/\(name)" } ?? name
            MTAutoplaySettings.prepareStore(for: folderURL)
            let level = MTAutoplaySettings.familiarityLevel(for: folderURL)
            items.append(MTCardManagerItem(
                id: subPath,
                title: name,
                subtitle: hasContent
                    ? (counts.total > 0
                        ? subtitle(total: counts.total, focused: counts.focused)
                        : "\(childFolders.count) 个子文件夹")
                    : "空文件夹",
                cardCount: counts.total,
                focusedCount: counts.focused,
                isEmpty: !hasContent,
                familiarityLevel: level
            ))
        }
        return items
    }

    /// 「本地有没有卡组」的轻量判断。
    ///
    /// 别用 `!listCards().isEmpty` 代替它：`listCards()` 会把整个库建一遍——每个卡组
    /// 一次 contentsOfDirectory，每个 `.md` 再各一次 stat + MMKV 查缓存。291 个卡组就是
    /// 几千次同步 I/O。它有三处调用只为判空，却全压在主线程上，列表每刷新一次就冻一次；
    /// 期间排队的点击会在解冻后一起投递，表现就是「进一个页面重复进入多次」。
    ///
    /// 这里只问一句「根目录下有没有子目录」，一次 contentsOfDirectory 就够。
    static func hasAnyLocalDeck() -> Bool {
        ensureLocalCardsDirectory()
        guard let root = localCardsRoot else { return false }
        return !subdirectoryNames(at: root).isEmpty
    }

    /// Rebuild an item from a previously-saved `id` (a path relative to the
    /// decks root, possibly nested). Returns nil if the folder was deleted,
    /// renamed, or no longer contains any cards — callers use that to hide
    /// stale "resume last deck" entries instead of pointing at nothing.
    static func item(forID id: String) -> MTCardManagerItem? {
        guard let root = localCardsRoot else { return nil }
        let folderURL = root.appendingPathComponent(id)
        let counts = cardCounts(in: cardFiles(at: folderURL))
        guard counts.total > 0 else { return nil }
        let title = (id as NSString).lastPathComponent
        MTAutoplaySettings.prepareStore(for: folderURL)
        let level = MTAutoplaySettings.familiarityLevel(for: folderURL)
        return MTCardManagerItem(
            id: id, title: title,
            subtitle: subtitle(total: counts.total, focused: counts.focused),
            cardCount: counts.total, focusedCount: counts.focused,
            isEmpty: false, familiarityLevel: level
        )
    }

    static func setFamiliarityLevel(_ level: MTFamiliarityLevel, forItemID id: String) {
        guard let root = localCardsRoot else { return }
        let folderURL = root.appendingPathComponent(id)
        MTAutoplaySettings.setFamiliarityLevel(level, for: folderURL)
        notify()
    }

    // MARK: - Loading

    static func loadConfiguration(for item: MTCardManagerItem) -> MTLearningCardsConfiguration? {
        guard let root = localCardsRoot else { return nil }
        let folderURL = root.appendingPathComponent(item.id)
        let files = cardFiles(at: folderURL)
        guard !files.isEmpty else { return nil }

        var allCards: [MTLearningStudyCard] = []
        for url in files {
            let config = MTTextCardParser.parse(url: url)
            allCards.append(contentsOf: config.cards)
        }

        return MTLearningCardsConfiguration(
            navigationTitle: item.title,
            subtitle: "\(allCards.count) 张卡片",
            cards: allCards,
            deckDirectoryURL: folderURL,
            sourceDeckIDs: [item.id]
        )
    }

    /// Builds an ephemeral deck from every card in the selected folders.
    /// No folder state is inherited or persisted for the combined deck.
    static func loadCombinedConfiguration(for items: [MTCardManagerItem]) -> MTLearningCardsConfiguration? {
        guard let root = localCardsRoot else { return nil }

        var cards: [MTLearningStudyCard] = []
        for item in items {
            let folderURL = root.appendingPathComponent(item.id)
            for url in cardFilesRecursively(at: folderURL) {
                cards.append(contentsOf: MTTextCardParser.parse(url: url).cards)
            }
        }

        cards = deduplicatedCards(cards)
        guard !cards.isEmpty else { return nil }
        return MTLearningCardsConfiguration(
            navigationTitle: "合并卡组",
            subtitle: "\(cards.count) 张卡片",
            cards: cards,
            deckDirectoryURL: nil,
            sourceDeckIDs: items.map(\.id)
        )
    }

    // MARK: - Folder management

    static func renameFolder(from oldName: String, to newName: String) {
        guard let root = localCardsRoot else { return }
        let oldURL = root.appendingPathComponent(oldName)
        let newURL = root.appendingPathComponent(newName)
        MTAutoplaySettings.closeStores(under: oldURL)
        try? FileManager.default.moveItem(at: oldURL, to: newURL)
        notify()
    }

    // MARK: - Import

    @discardableResult
    static func importFileToRoot(from sourceURL: URL) -> Bool {
        guard let root = localCardsRoot else { return false }
        ensureLocalCardsDirectory()
        let destURL = root.appendingPathComponent(sourceURL.lastPathComponent)
        try? FileManager.default.removeItem(at: destURL)
        let accessed = sourceURL.startAccessingSecurityScopedResource()
        defer { if accessed { sourceURL.stopAccessingSecurityScopedResource() } }
        do {
            try FileManager.default.copyItem(at: sourceURL, to: destURL)
            notify()
            return true
        } catch { return false }
    }

    // MARK: - Share Extension

    static func importPendingSharedFiles() {
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.oyca168.www.Memory"
        ), let root = localCardsRoot else { return }
        let sharedDir = container.appendingPathComponent("Shared")
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: sharedDir, includingPropertiesForKeys: nil) else { return }
        var imported = false
        for url in files where url.pathExtension.lowercased() == "md" {
            let destURL = root.appendingPathComponent(url.lastPathComponent)
            try? FileManager.default.removeItem(at: destURL)
            try? FileManager.default.copyItem(at: url, to: destURL)
            try? FileManager.default.removeItem(at: url)
            imported = true
        }
        if imported { notify() }
    }

    /// 所有卡组的 `audio/` 目录标成不进 iCloud 备份：音频由电脑经 USB 推入，随时可重推。
    static func excludeAllDeckAudioFromBackup() {
        DispatchQueue.global(qos: .utility).async {
            guard let root = localCardsRoot,
                  let walker = FileManager.default.enumerator(
                      at: root,
                      includingPropertiesForKeys: [.isDirectoryKey],
                      options: [.skipsHiddenFiles]
                  )
            else { return }
            for case let url as URL in walker {
                guard (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true,
                      url.lastPathComponent == MTDeckAudio.directoryName
                else { continue }
                // 标记打在目录上，里面的文件跟着继承，没必要下去。
                walker.skipDescendants()
                var directory = url
                var values = URLResourceValues()
                values.isExcludedFromBackup = true
                try? directory.setResourceValues(values)
            }
        }
    }

    // MARK: - Private

    static var localCardsRoot: URL? {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?
            .appendingPathComponent("decks")
    }

    /// 卡组目录 → 卡片库里的 id（相对 `decks/` 的路径）。合并卡组没有目录，返回 nil。
    static func itemID(forDirectory directoryURL: URL?) -> String? {
        guard let directoryURL, let root = localCardsRoot else { return nil }
        let rootComponents = root.standardizedFileURL.pathComponents
        let deckComponents = directoryURL.standardizedFileURL.pathComponents
        guard deckComponents.count > rootComponents.count,
              Array(deckComponents.prefix(rootComponents.count)) == rootComponents else { return nil }
        return deckComponents.dropFirst(rootComponents.count).joined(separator: "/")
    }

    private static func ensureLocalCardsDirectory() {
        guard let dir = localCardsRoot else { return }
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }

    static func notify() {
        if Thread.isMainThread {
            NotificationCenter.default.post(name: cardListChangedNotification, object: nil)
        } else {
            DispatchQueue.main.async {
                NotificationCenter.default.post(name: cardListChangedNotification, object: nil)
            }
        }
    }

    private static func subdirectoryNames(at dir: URL) -> [String] {
        let sources = currentSourceDeckFiles()
        guard let contents = try? FileManager.default.contentsOfDirectory(
            at: dir, includingPropertiesForKeys: [.isDirectoryKey]) else { return [] }
        return contents.compactMap { url in
            guard let values = try? url.resourceValues(forKeys: [.isDirectoryKey]),
                  values.isDirectory == true else { return nil }
            let name = url.lastPathComponent
            guard name != mtMMKVReservedDirectoryName else {
                try? FileManager.default.removeItem(at: url)
                return nil
            }
            // 卡组自带的真人音频目录：它不是子卡组，只是这个卡组的素材。
            // 和上面 MMKV 那条不同，这里绝对不能顺手删——删掉就要回到电脑上
            // 重新经 USB 推一整章回来。
            guard name != MTDeckAudio.directoryName else { return nil }
            if let sources, let relative = itemID(forDirectory: url),
               !sources.contains(where: { $0.hasPrefix(relative + "/") }) { return nil }
            return name
        }
    }

    private static func cardFiles(at dir: URL) -> [URL] {
        let sources = currentSourceDeckFiles()
        guard let contents = try? FileManager.default.contentsOfDirectory(
            at: dir, includingPropertiesForKeys: nil) else { return [] }
        return contents.filter {
            $0.pathExtension.lowercased() == "md"
                // A previous sync created files such as ` .md`. They are stale
                // duplicates with no valid deck name and must not become cards.
                && !$0.deletingPathExtension().lastPathComponent
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .isEmpty
                && (sources == nil || sources?.contains(itemID(forDirectory: $0) ?? "") == true)
        }
    }

    private static func cardFilesRecursively(at dir: URL) -> [URL] {
        let sources = currentSourceDeckFiles()
        guard let enumerator = FileManager.default.enumerator(
            at: dir,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else { return [] }
        return enumerator.compactMap { url in
            guard let url = url as? URL else { return nil }
            // 音频目录里一张卡都没有，几百个文件没必要逐个过一遍。
            if url.lastPathComponent == MTDeckAudio.directoryName,
               (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true {
                enumerator.skipDescendants()
                return nil
            }
            guard url.pathExtension.lowercased() == "md",
                  sources == nil || sources?.contains(itemID(forDirectory: url) ?? "") == true,
                  !url.deletingPathExtension().lastPathComponent
                    .trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
            return url
        }
    }

    /// 同步器写入当前 Obsidian 卡组清单，历史副本保留在磁盘但不进入学习队列。
    /// 旧安装尚无清单时兼容原来的本地导入；重新同步即可切换到源清单。
    private static func currentSourceDeckFiles() -> Set<String>? {
        guard let root = localCardsRoot,
              let text = try? String(contentsOf: root.appendingPathComponent(".source-decks"), encoding: .utf8)
        else { return nil }
        return Set(text.split(separator: "\n").map(String.init))
    }

    private static func cardCounts(in files: [URL]) -> (total: Int, focused: Int) {
        files.reduce(into: (total: 0, focused: 0)) { result, file in
            let counts = cachedCounts(of: file)
            result.total += counts.total
            result.focused += counts.focused
        }
    }

    /// 列表右侧显示总张数，括号里是当前 1–2 分的张数；0 张时省略括号。
    private static func subtitle(total: Int, focused: Int) -> String {
        focused > 0 ? "\(total) 张卡片(\(focused))" : "\(total) 张卡片"
    }

    /// 列表里那两个数字的来源，**带缓存**。
    ///
    /// 这个数字本身只能靠完整解析算出来（哪几行成卡片是解析器说了算）。但《雅思词汇真经》
    /// 这种一层 23 章、2 MB Markdown、上万张卡的目录，每进一次列表就全量解析一遍
    /// 再把卡片全扔掉，光为了显示一个数字——列表要等好几秒才出得来。
    ///
    /// 所以按「文件大小 + 修改时间」缓存：文件没变就直接用上次的数，变了才重算。
    /// 经 USB 重新导入的章节 mtime 会变，自然会重新计数，不会显示陈旧数字。
    private static func cachedCounts(of fileURL: URL) -> (total: Int, focused: Int) {
        // 缓存是否新鲜，只认这一个指纹：文件大小 + 修改时间（精确到毫秒）。
        // 取不到属性就写 -1，和任何真实值都对不上，于是必定重算——宁可慢，不给错数。
        let attributes = try? FileManager.default.attributesOfItem(atPath: fileURL.path)
        let size = (attributes?[.size] as? NSNumber)?.int64Value ?? -1
        let modified = (attributes?[.modificationDate] as? Date)?.timeIntervalSince1970 ?? -1
        let stamp = String(format: "%lld:%.3f", size, modified)
        let key = cardCountKeyPrefix + (itemID(forDirectory: fileURL) ?? fileURL.path)

        // 格式对不上（老版本写的值、或者存坏了）一律当缓存失效，照常重算。
        if let cached = MMKV.default()?.string(forKey: key) {
            let parts = cached.split(separator: "|")
            if parts.count == 3, parts[0] == stamp,
               let total = Int(parts[1]), let focused = Int(parts[2]) {
                return (total, focused)
            }
        }

        let counts = MTTextCardParser.counts(url: fileURL)
        MMKV.default()?.set("\(stamp)|\(counts.total)|\(counts.focused)", forKey: key)
        return counts
    }

    // 现行三列表与独立释义列的解析规则已更新, 重新计算旧解析器缓存的 0 张卡。
    private static let cardCountKeyPrefix = "cardCount.v5.tableGloss."

    /// Combined decks are an ephemeral view, so repeated cards can be removed
    /// without changing any source Markdown file. The first occurrence wins,
    /// preserving the selected-folder/file traversal order and its full card
    /// content (meaning, section and accent).
    ///
    /// **只有前缀卡把释义也算进键里，其余仍然按词去重。**
    ///
    /// 前缀这边：`01. base` 改成「一行一义」之后，同一个词头在不同主题下各有一张卡
    /// ——`ob-` 三张（反对, 阻碍 / 彻底, 完全, 加强 / 对着, 朝向, 在前），
    /// `de-` `re-` `ana-` `par(a)-` 各四张。只按词去重会把 215 张前缀卡砍成 143 张，
    /// 丢掉 72 张，而且一声不响，表现就是「合并之后某个前缀不见了」。
    ///
    /// 普通词书这边不能同样放宽：同一个词在两本书里释义措辞常常不一样
    /// （`derive` 一边写「源自; 得出」、一边写「派生; 衍生」），键带上释义就去不掉了，
    /// 合并后会连着刷两遍同一个词——那正是这个去重最初要解决的问题。
    ///
    /// 判定走**词形**而不是卡组路径：前缀天然以连字符收尾，这个特征跟着数据走，
    /// 卡组改名、搬家、从别处导入都不会失效。
    private static func deduplicatedCards(_ cards: [MTLearningStudyCard]) -> [MTLearningStudyCard] {
        var seen = Set<String>()
        return cards.filter { card in
            let word = collapsedWhitespace(card.word)
            guard !word.isEmpty else { return true }
            // U+001F 是单元分隔符，正文里不会出现，用它拼键不会和内容撞上。
            let key = word.hasSuffix("-")
                ? word + "\u{1F}" + collapsedWhitespace(card.meaning)
                : word
            return seen.insert(key).inserted
        }
    }

    private static func collapsedWhitespace(_ text: String) -> String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
            .split(whereSeparator: { $0.isWhitespace })
            .joined(separator: " ")
            .lowercased()
    }
}

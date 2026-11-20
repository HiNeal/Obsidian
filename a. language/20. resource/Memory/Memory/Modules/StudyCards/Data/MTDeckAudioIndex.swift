//
//  MTDeckAudioIndex.swift
//  Memory
//
//  卡组自带的真人音频：`<卡组目录>/audio/<slug>.mp3`。
//  命名规则和 Obsidian vault 里 `tts-audio-engine` 的 `to_slug()` 完全一致，
//  所以笔记那边生成好的文件原样拷进卡组就能用，App 侧不做任何路径映射。
//

import Foundation

nonisolated enum MTDeckAudio {

    /// 卡组目录下存放真人音频的子目录名。它不是子卡组，列卡片库、
    /// 递归找 `.md` 时都要跳过（见 `MTCardManager.subdirectoryNames`）。
    ///
    /// 卡组目录下的真人音频，由电脑上的 `import_to_memory.py` 从笔记库
    /// `20. resource/b. audio/` 经 USB 直接推进来，随时可重推。
    static let directoryName = "audio"



    /// 与 vault 里 `tts-audio-engine` 的 `to_slug()` 逐条对齐：
    /// NFD 分解后去变音符 → 删 Markdown 记号 `*_~`#` → 撇号变 `_` →
    /// 空白变 `_` → 其余非「字母/数字/`-`/`_`」变 `_` → 合并连续 `_` → 去首尾 `_`。
    ///
    /// 这套规则实测在 6646 张卡上让单词和短语同时命中 6026 张（另外 616 张是
    /// 笔记那边压根没生成音频，不是匹配失败），所以它是对的，不要顺手改。
    /// 逐 Unicode 标量处理而不是逐 Character，是为了和 Python 的按码点语义一致。
    static func slug(_ text: String) -> String {
        let lowered = text.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        var result = String.UnicodeScalarView()
        for scalar in lowered.decomposedStringWithCanonicalMapping.unicodeScalars {
            if (0x0300...0x036F).contains(scalar.value) { continue }   // 组合变音符
            if markdownMarks.contains(scalar) { continue }             // * _ ~ ` #
            if apostrophes.contains(scalar) || CharacterSet.whitespacesAndNewlines.contains(scalar) {
                result.append(separator)
                continue
            }
            let character = Character(scalar)
            if character.isLetter || character.isNumber || scalar == "-" || scalar == separator {
                result.append(scalar)
            } else {
                result.append(separator)
            }
        }
        return collapsedSeparators(in: String(result))
    }

    private static let separator: Unicode.Scalar = "_"
    private static let markdownMarks = CharacterSet(charactersIn: "*_~`#")
    private static let apostrophes = CharacterSet(charactersIn: "'\u{2019}")

    /// `_+` → `_`，再去掉首尾。
    private static func collapsedSeparators(in text: String) -> String {
        var result = ""
        var previousWasSeparator = false
        for character in text {
            let isSeparator = character == Character(separator)
            if isSeparator && previousWasSeparator { continue }
            result.append(character)
            previousWasSeparator = isSeparator
        }
        while result.first == Character(separator) { result.removeFirst() }
        while result.last == Character(separator) { result.removeLast() }
        return result
    }
}

/// 一个卡组的音频清单。卡组打开时把 `audio/` 列一次进内存，之后每张卡
/// 的查找都是 O(1)——翻页和自动播放是热路径，不能每次都去碰文件系统。
nonisolated struct MTDeckAudioIndex: Sendable {

    // MARK: data property

    private let directoryURL: URL
    private let fileNames: Set<String>

    var fileCount: Int { fileNames.count }

    // MARK: setup

    /// 卡组没有 `audio/` 或目录是空的就返回 nil，播放端跳过，不合成语音。
    init?(deckDirectoryURL: URL?) {
        guard let deckDirectoryURL else { return nil }
        let directoryURL = deckDirectoryURL.appendingPathComponent(
            MTDeckAudio.directoryName, isDirectory: true
        )
        guard let names = try? FileManager.default.contentsOfDirectory(atPath: directoryURL.path),
              !names.isEmpty else { return nil }
        self.directoryURL = directoryURL
        // 文件名和 slug 都统一成预组合形式再比，避免同一个名字因为
        // NFC/NFD 写法不同而查不到。
        self.fileNames = Set(names.map { $0.precomposedStringWithCanonicalMapping })
    }

    // MARK: public methods

    /// 所有发声位置共用这一条查找规则，依次试三种前缀：
    ///
    /// - `<slug>.mp3`        单词
    /// - `chunk_<slug>.mp3`  短语
    /// - `cs_<slug>.mp3`     连读（connected speech）
    ///
    /// 前缀之间撞车的可能可以忽略，所以调用方不必说明这段文本来自哪一栏，
    /// 播放端每个位置一视同仁。新增一类音频就在这里加一个前缀，
    /// 播放端和解析器都不用动。
    func audioURL(for text: String) -> URL? {
        let slug = MTDeckAudio.slug(text).precomposedStringWithCanonicalMapping
        guard !slug.isEmpty else { return nil }
        for prefix in Self.namePrefixes where fileNames.contains("\(prefix)\(slug).mp3") {
            return directoryURL.appendingPathComponent("\(prefix)\(slug).mp3")
        }
        return nil
    }

    private static let namePrefixes = ["", "chunk_", "cs_"]
}

/// 一副牌里可能混着来自多个卡组的卡（合并卡组），每个卡组各有自己的 `audio/`。
/// 这里按卡组目录缓存 `MTDeckAudioIndex`，让每张卡回自己出身的那一章取录音。
///
/// 单卡组是它的退化情形：只有一个目录，缓存里也就一条。所以播放端不必分两套
/// 逻辑——一律问这个库要 URL。
nonisolated struct MTDeckAudioLibrary: Sendable {

    // MARK: data property

    /// nil 值是「这个目录查过了，没有音频」的记号，避免每张卡都去列一次目录。
    private var indexes: [URL: MTDeckAudioIndex?] = [:]

    // MARK: setup

    /// 预热：把这副牌里出现过的卡组目录一次性列完。卡组打开时做一次，
    /// 之后翻页和自动播放都是纯查表。
    init(cards: [MTLearningStudyCard], deckDirectoryURL: URL?) {
        for directory in Self.audioDirectories(in: cards, deckDirectoryURL: deckDirectoryURL) {
            indexes[directory] = MTDeckAudioIndex(deckDirectoryURL: directory)
        }
    }

    // MARK: public methods

    /// 这副牌里所有出现过的卡组目录，去重后按路径排序。
    /// 顺序稳定一点便于排查。
    static func audioDirectories(in cards: [MTLearningStudyCard], deckDirectoryURL: URL?) -> [URL] {
        var directories = Set(cards.compactMap(\.audioDirectoryURL))
        if let deckDirectoryURL { directories.insert(deckDirectoryURL) }
        return directories.sorted { $0.path < $1.path }
    }

    /// 这副牌里有没有任何一张卡能播到真人音频。设置页据此决定显不显示
    /// 「优先真人音频」那一行。
    var hasAnyAudio: Bool {
        indexes.values.contains { $0 != nil }
    }

    /// 某张卡该用的音频清单。卡没带出身目录（历史数据）就没有真人音频。
    func index(for card: MTLearningStudyCard) -> MTDeckAudioIndex? {
        guard let directory = card.audioDirectoryURL else { return nil }
        return indexes[directory] ?? nil
    }
}

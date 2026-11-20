//
//  MTTextCardParser.swift
//  Memory
//
//  Created by Claude on 5/15/26.
//

import Foundation
import UIKit

nonisolated enum MTTextCardParser {
    private static let boldExpression = try? NSRegularExpression(pattern: #"\*\*(.+?)\*\*"#)
    private static let combinedBreakExpression = try? NSRegularExpression(
        pattern: #"<br\s*/?>\s*<br\s*/?>"#, options: [.caseInsensitive]
    )
    static func parse(url: URL) -> MTLearningCardsConfiguration {
        let filename = url.deletingPathExtension().lastPathComponent
        guard let content = try? String(contentsOf: url, encoding: .utf8) else {
            return MTLearningCardsConfiguration(
                navigationTitle: filename,
                subtitle: "读取失败",
                cards: [],
                deckDirectoryURL: url.deletingLastPathComponent(),
                sourceDeckIDs: []
            )
        }

        let cards = parseCards(from: content)

        let studyCards = cards.enumerated().map { index, card -> MTLearningStudyCard in
            let (phonetic, meaningBody) = splitPhonetic(from: card.meaning)
            return MTLearningStudyCard(
                meaningUnit: card.meaningUnit,
                dictationTargets: card.dictationTargets,
                word: card.word,
                meaning: card.meaning,
                meaningUsesWordStyle: card.meaningUsesWordStyle,
                meaningIsPhonetic: card.meaningIsPhonetic,
                focusLevel: card.focusLevel,
                meaningSections: parseMeaningSections(from: meaningBody),
                sectionTitle: card.sectionTitle,
                audioDirectoryURL: url.deletingLastPathComponent(),
                phonetic: phonetic,
                accent: accent(at: index)
            )
        }

        return MTLearningCardsConfiguration(
            navigationTitle: filename,
            subtitle: "\(cards.count) 张卡片",
            cards: studyCards,
            deckDirectoryURL: url.deletingLastPathComponent(),
            // 解析单个 .md 时还不知道它属于哪个卡组，由 MTCardManager 的两个
            // loader 在组装成一副牌时填上。
            sourceDeckIDs: []
        )
    }

    /// 只数卡片数，不把卡片造出来。聚焦张数只按源笔记标记计算。
    ///
    /// 卡片库列表里那句「N 张卡片」只要两个数字，但 `parse(url:)` 会顺带做
    /// 释义分段、配色、听写目标这些只有展示时才用得上的事——《雅思词汇真经》
    /// 一层 23 章上万张卡，白做一遍代价不小。行的判定逻辑完全复用，数字和
    /// `parse(url:).cards` 数出来的严格相等。
    static func counts(url: URL) -> (total: Int, focused: Int) {
        guard let content = try? String(contentsOf: url, encoding: .utf8) else { return (0, 0) }
        let cards = parseCards(from: content)
        return (cards.count, cards.filter(\.isFocused).count)
    }

    // MARK: - Parsing

    private nonisolated struct ParsedCard {
        let meaningUnit: String
        let dictationTargets: [String]
        let word: String
        let meaning: String
        let meaningUsesWordStyle: Bool
        var meaningIsPhonetic: Bool
        /// 优先使用源表格评分列, 缺列时兼容词头高亮和旧加粗标记。
        /// 每次解析重新读取, 不保存独立评分。
        var focusLevel: Int
        var isFocused: Bool { focusLevel > 0 }
        var sectionTitle: String

        init(meaningUnit: String,
             dictationTargets: [String],
             word: String,
             meaning: String,
             meaningUsesWordStyle: Bool = false,
             meaningIsPhonetic: Bool = false,
             focusLevel: Int = 0,
             sectionTitle: String = "") {
            self.meaningUnit = meaningUnit
            self.dictationTargets = dictationTargets
            self.word = word
            self.meaning = meaning
            self.meaningUsesWordStyle = meaningUsesWordStyle
            self.meaningIsPhonetic = meaningIsPhonetic
            self.focusLevel = focusLevel
            self.sectionTitle = sectionTitle
        }
    }

    /// 只解析表格行。表的形状由「第二列表头是不是短语」决定，认不出的表头
    /// 交给 `inferred` 按单元格结构兜底。
    private static func parseCards(from content: String) -> [ParsedCard] {
        let normalized = content.replacingOccurrences(of: "\r\n", with: "\n")
        let lines = normalized
            .components(separatedBy: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }

        var cards: [ParsedCard] = []
        var activeTableKind: TableKind?
        var activeSectionTitle = ""
        var activeScoreColumn: Int?
        var index = 0
        while index < lines.count {
            let line = lines[index]
            guard isTableRow(line) else {
                activeTableKind = nil
                activeSectionTitle = ""
                activeScoreColumn = nil
                index += 1
                continue
            }
            // Header row: the next line is the `|---|---|` separator
            if index + 1 < lines.count, isTableSeparator(lines[index + 1]) {
                let header = tableCells(line)
                activeTableKind = tableKind(for: header)
                activeSectionTitle = studyCardSectionTitle(for: header)
                activeScoreColumn = header.firstIndex(of: "评分")
                index += 2
                continue
            }
            if isTableSeparator(line) {
                index += 1
                continue
            }
            if var card = parseTableRow(line, kind: activeTableKind) {
                if let column = activeScoreColumn {
                    let cells = tableCells(line)
                    // 有评分列时以该列为准; 空值或无效值按 0 分处理。
                    let value = column < cells.count ? Int(cells[column]) ?? 0 : 0
                    card.focusLevel = min(5, max(0, value))
                }
                // 音标按内容认，不按列名——合并单元格里也只有内容可看。
                card.meaningIsPhonetic = isPhoneticMeaning(card.meaning)
                guard card.meaningUsesWordStyle || card.meaningIsPhonetic
                    || containsChineseText(card.meaning) else {
                    index += 1
                    continue
                }
                card.sectionTitle = activeSectionTitle
                cards.append(card)
            }
            index += 1
        }
        return cards
    }

    /// 释义整段被 `/…/` 包住 = 这是音标，不是中文释义。按内容判断而不是按
    /// 列名，所以 `例子 | 音标`、单列合并格 `not at all<br><br>/nɒtətɔːl/`
    /// 都能认出来，解析器里一个专用表型都不用留。
    private static func isPhoneticMeaning(_ meaning: String) -> Bool {
        let text = meaning.trimmingCharacters(in: .whitespacesAndNewlines)
        return text.count > 2 && text.hasPrefix("/") && text.hasSuffix("/")
            && !containsChineseText(text)
    }

    /// Definition labels are Chinese for every deck except the explicit
    /// `题目表达 | 原文表达` paraphrase layout. Ignore malformed source rows
    /// instead of presenting an English note or part-of-speech as a meaning.
    private static func containsChineseText(_ text: String) -> Bool {
        text.unicodeScalars.contains { scalar in
            switch scalar.value {
            case 0x3400...0x4DBF, 0x4E00...0x9FFF, 0xF900...0xFAFF:
                return true
            default:
                return false
            }
        }
    }

    private static func isTableRow(_ line: String) -> Bool {
        line.hasPrefix("|")
    }

    private static func isTableSeparator(_ line: String) -> Bool {
        guard isTableRow(line) else { return false }
        let stripped = line.filter { !" |:-".contains($0) }
        return stripped.isEmpty && line.contains("-")
    }

    private static func tableCells(_ line: String) -> [String] {
        rawTableCells(line).map { cleanCell($0) }
    }

    private static func rawTableCells(_ line: String) -> [String] {
        var trimmed = line
        if trimmed.hasPrefix("|") { trimmed.removeFirst() }
        if trimmed.hasSuffix("|") { trimmed.removeLast() }
        return trimmed.components(separatedBy: "|")
    }

    /// Meaning-unit tables bold the exact surface form that represents the
    /// card's target. Preserve it before `cleanCell` removes Markdown marks.
    private static func boldTexts(in rawCell: String) -> [String] {
        guard let expression = boldExpression else {
            return []
        }
        let fullRange = NSRange(rawCell.startIndex..<rawCell.endIndex, in: rawCell)
        return expression.matches(in: rawCell, range: fullRange).compactMap { match in
            guard match.numberOfRanges > 1,
                  let range = Range(match.range(at: 1), in: rawCell) else { return nil }
            let text = cleanCell(String(rawCell[range]))
            return text.isEmpty ? nil : text
        }
    }

    /// 词格从头包到尾的标记 = 用户标的生词，决定这张卡进不进聚焦队列：
    /// - 0 基础：不标记；
    /// - 1 进阶：整格高亮 `==merchant==`（现行写法）或整格加粗 `**merchant**`（旧写法）；
    ///   旧的两层叠用 `**==merchant==**` 也按进阶处理，只分基础与进阶两级。
    /// 内层不许再出现同一标记，否则 `**a** 和 **b**` 这种格内多处加粗会被
    /// 误判成整格——那是听写目标（见 `boldTexts`），不是聚焦标记。
    private static func focusLevel(of rawCell: String) -> Int {
        var cell = Substring(rawCell.trimmingCharacters(in: .whitespacesAndNewlines))
        var markers: Set<String> = []
        while let marker = ["**", "=="].first(where: { cell.hasPrefix($0) && cell.hasSuffix($0) && cell.count > 4 }) {
            let inner = cell.dropFirst(2).dropLast(2)
            let markerChar = marker.first ?? "*"
            guard inner.first != markerChar, inner.last != markerChar, !inner.contains(marker) else { break }
            cell = inner
            markers.insert(marker)
        }
        return markers.isEmpty ? 0 : 1
    }

    /// Cells may carry markdown noise: `<br>` line breaks, `**bold**`/`*italic*` emphasis
    /// and Obsidian `==highlight==`. Meaning cells can retain highlights for rendering.
    private static func cleanCell(_ raw: String, preserveHighlights: Bool = false) -> String {
        var text = raw
        for tag in ["<br/>", "<br />", "<br>"] {
            text = text.replacingOccurrences(of: tag, with: "\n", options: .caseInsensitive)
        }
        text = text.replacingOccurrences(of: "*", with: "")
        if !preserveHighlights {
            text = text.replacingOccurrences(of: "=", with: "")
        }
        return text
            .components(separatedBy: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n")
            // Canonical Unicode form so the same word re-typed/re-exported
            // from a different source still compares equal.
            .precomposedStringWithCanonicalMapping
    }

    /// 每张表只会落进这四种之一。`inferred` 是结构兜底：表头认不出来时
    /// 按单元格自身的形状（有没有 `<br><br>`、有没有加粗）判断，旧版列序
    /// （`短语 | 单词 | 拆解`）也由它接住，不再单列一种 kind。
    private nonisolated enum TableKind {
        /// `meaningColumn`：单词格不带释义时，从这一列开头（第一个空行之前）取释义。
        /// 现行版式 `单词 | 短语 | 拆解` 的释义写在拆解格开头：`n. 生物学家<br><br>bio(…), -logist(…)`。
        case trailingMeaningUnit(meaningColumn: Int?)
        /// 现行主流版式：首列为词（单词/短语），第二列是独立释义列，第三列是意群列（`单词 | 释义 | 意群 | 拆解`、`短语 | 释义 | 意群`）
        case wordMeaningUnit(meaningColumn: Int, meaningUnitColumn: Int)
        /// 兼容历史版式：意群列在首列，第二列是词（单词/短语），第三列是独立释义列（`意群 | 单词 | 释义 | 拆解`、`意群 | 短语 | 释义`）
        case leadingMeaningUnit(meaningColumn: Int, wordColumn: Int)
        case compactVocabulary
        case englishExpressionPair
        case explicitMeaningPair
        case inferred
    }

    private static func tableKind(for header: [String]) -> TableKind {
        guard let firstHeader = header.first else { return .inferred }
        // 现行版式（`单词 | 释义 | 意群 | 拆解`、`短语 | 释义 | 意群`）：词在第一列，释义在第二列，意群在第三列。
        if header.count >= 3,
           (firstHeader.contains("单词") || firstHeader == "短语" || firstHeader.contains("词块")),
           header[1] == "释义",
           header.contains("意群") {
            let chunkCol = header.firstIndex(of: "意群") ?? 2
            return .wordMeaningUnit(meaningColumn: 1, meaningUnitColumn: chunkCol)
        }
        // 兼容历史版式：意群列在首列（`意群 | 单词 | 释义 | 拆解`、`意群 | 短语 | 释义`）
        if firstHeader == "意群", header.count >= 3 {
            let meaningCol = header.firstIndex(of: "释义") ?? 2
            let wordCol = header.firstIndex(where: { $0.contains("单词") || $0 == "短语" }) ?? 1
            return .leadingMeaningUnit(meaningColumn: meaningCol, wordColumn: wordCol)
        }
        if header.count >= 2, firstHeader == "单词", header[1] == "释义" {
            return .explicitMeaningPair
        }
        // 英英改写对：两侧都是英文。阅读和听力用同一组列名，第三列（听力
        // 那边的改写机制分析）和其他表一样不看。
        if header.count >= 2,
           ["同义改写", "题目表达", "同义替换"].contains(firstHeader),
           header[1] == "原文表达" {
            return .englishExpressionPair
        }
        // Base tables (`词根 / 前缀 / 后缀 / 各主题小节 | 例子 | 出处/路径`)：
        // 例子列装的是派生词表不是例句，按无短语处理，不上卡。
        if isDerivedExampleHeader(header) {
            return .compactVocabulary
        }
        // Vocabulary, reading and grammar tables lead with the combined term
        // and keep the source sentence in their second column: `单词 | 短语 |
        // 拆解`, `介词动词 | 短语`, `原文语境短语 | 短语`. The headword column
        // is deliberately not matched by name — every deck that names its
        // second column after the meaning unit uses this layout, so grammar
        // decks keep their example sentences without being whitelisted one
        // part of speech at a time. Their legacy `短语 | 单词 | 拆解` form is
        // handled above and still parses.
        if header.count >= 2,
           meaningUnitHeaders.contains(header[1]),
           // 03 词库首列也叫「短语」（词条列），所以首列只排除旧版的意思单位/意思单元。
           !(["意思单位", "意思单元", "例子", "例句"].contains(firstHeader)) {
            // 短语、语法、听力表的第三列叫「释义」（`短语 | 短语 | 释义`），格式同拆解格：
            // 释义在开头，`<br><br>` 之后是考点解析之类的补充。
            return .trailingMeaningUnit(meaningColumn: header.firstIndex(of: "拆解") ?? header.firstIndex(of: "释义"))
        }
        // 单列表只可能是「词和释义挤在同一格」这一种形状，不必再看列名——
        // 和「表的形状只看第二列是不是短语」是同一条原则。这样音标、连读
        // 这些新卡组不用逐个往白名单里加名字（当年 MTMarkdownFavoriteScanner
        // 就是栽在按列名精确匹配上）。没有 `<br>` 的单格拆不出释义，
        // 自然会被后面那道过滤挡掉，放宽这里不会凭空多出坏卡。
        if header.count == 1 {
            return .compactVocabulary
        }
        if firstHeader == "单词", header[1] != "释义" {
            return .compactVocabulary
        }
        return .inferred
    }

    private static func isDerivedExampleHeader(_ header: [String]) -> Bool {
        guard header.count >= 2, header[1] == "例子" else { return false }
        if header.count >= 3 && ["路径", "出处"].contains(header[2]) { return true }
        guard let first = header.first else { return false }
        return derivedExampleHeaders.contains(first)
    }

    /// Column names a deck may use for its meaning-unit column. `例子` is a
    /// legacy spelling: the source notes now name every such column `短语`,
    /// but decks exported before that rename still carry the old word.
    private static let meaningUnitHeaders: Set<String> = [
        "短语", "意群", "意思单位", "意思单元", "例子", "例句"
    ]

    /// `词根 / 前缀 / 后缀` decks also name their second column `例子`, but it
    /// lists derived words rather than a source sentence. They keep the
    /// compact single-cell layout so that list stays off the card.
    private static let derivedExampleHeaders: Set<String> = ["词根", "前缀", "后缀"]

    /// 标题一律是表格第一列的表头，没有例外：新表头不用改代码就有标题，
    /// 卡片顶部显示的名字和笔记里那一列的列名永远对得上。
    private static func studyCardSectionTitle(for header: [String]) -> String {
        header.first ?? ""
    }

    /// Splits a current combined card cell at its first Markdown line break:
    /// its first line is the core word and the remaining text is its meaning.
    private static func splitCombinedWordAndMeaning(_ cell: String) -> (word: String, meaning: String)? {
        let parts = cell.split(separator: "\n", maxSplits: 1, omittingEmptySubsequences: false)
        guard let first = parts.first else { return nil }
        let word = first.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !word.isEmpty else { return nil }
        let meaning = parts.count > 1
            ? String(parts[1]).trimmingCharacters(in: .whitespacesAndNewlines)
            : ""
        return (word, meaning)
    }

    /// 每行只看前两列：第一列是 `词<br><br>释义` 的合并单元格，第二列按
    /// 表头决定是短语还是补充列。第三列起一律不看。
    private static func parseTableRow(_ line: String, kind: TableKind?) -> ParsedCard? {
        let rawCells = rawTableCells(line)
        let cells = rawCells.map { cleanCell($0) }
        switch kind {
        case .wordMeaningUnit(let meaningColumn, let meaningUnitColumn):
            guard cells.count > max(meaningColumn, meaningUnitColumn),
                  !cells[0].isEmpty,
                  !cells[meaningColumn].isEmpty else { return nil }
            let rawWord = rawCells[0]
            // 单词格可写成 `word<br>/音标/`：词头只取第一行，音标不进卡面（卡片界面不展示音标）。
            let word = cleanCell(rawWord).components(separatedBy: "\n").first ?? ""
            let bolds = boldTexts(in: rawCells[meaningUnitColumn])
            return ParsedCard(
                meaningUnit: cells[meaningUnitColumn],
                dictationTargets: bolds.isEmpty ? [word] : bolds,
                word: word,
                meaning: cleanCell(rawCells[meaningColumn], preserveHighlights: true),
                focusLevel: focusLevel(of: rawWord)
            )
        case .leadingMeaningUnit(let meaningColumn, let wordColumn):
            guard cells.count > max(wordColumn, meaningColumn),
                  !cells[wordColumn].isEmpty,
                  !cells[meaningColumn].isEmpty else { return nil }
            let rawWord = rawCells[wordColumn]
            let word = cleanCell(rawWord)
            let bolds = boldTexts(in: rawCells[0])
            return ParsedCard(
                meaningUnit: cells[0],
                dictationTargets: bolds.isEmpty ? [word] : bolds,
                word: word,
                meaning: cleanCell(rawCells[meaningColumn], preserveHighlights: true),
                focusLevel: focusLevel(of: rawWord)
            )
        case .trailingMeaningUnit(let meaningColumn):
            guard cells.count >= 2,
                  let combined = splitCombinedWordAndMeaning(cells[0]) else { return nil }
            let sourceMeaning = rawCells.first
                .flatMap { splitCombinedWordAndMeaning(cleanCell($0, preserveHighlights: true))?.meaning }
            var meaning = sourceMeaning ?? combined.meaning
            var meaningUnit = cells[1]
            if meaning.isEmpty, let column = meaningColumn, column < rawCells.count {
                meaning = leadingMeaning(in: rawCells[column])
            } else if meaning.isEmpty {
                // Base 现行版式 `| a- | 无, 不, 非<br><br>apathy n.冷漠 |`：释义写在第二列开头，
                // 后面是例词。中文开头的段落是释义，第一个英文开头的段落起是例词。
                let split = splitLeadingGloss(cleanCell(rawCells[1], preserveHighlights: true))
                meaning = split.gloss
                meaningUnit = split.rest
            }
            return ParsedCard(
                meaningUnit: meaningUnit,
                dictationTargets: boldTexts(in: rawCells[1]),
                word: combined.word,
                meaning: meaning,
                focusLevel: focusLevel(of: rawCells[0])
            )
        case .compactVocabulary:
            guard let first = cells.first,
                  let combined = splitCombinedWordAndMeaning(first) else { return nil }
            // Base 当前把释义放在第二列开头，随后才是派生例词。
            // 旧版合并词格仍优先使用第一列自带的释义。
            let sourceCombined = rawCells.first.map { cleanCell($0, preserveHighlights: true) } ?? ""
            let sourceMeaning = splitCombinedWordAndMeaning(sourceCombined)?.meaning ?? combined.meaning
            let meaning = sourceMeaning.isEmpty && cells.count >= 2
                ? splitLeadingGloss(cleanCell(rawCells[1], preserveHighlights: true)).gloss
                : sourceMeaning
            return ParsedCard(
                meaningUnit: "",
                dictationTargets: [],
                word: combined.word,
                meaning: meaning,
                focusLevel: focusLevel(of: rawCells[0])
            )
        case .englishExpressionPair, .explicitMeaningPair:
            guard cells.count >= 2,
                  !cells[0].isEmpty,
                  !cells[1].isEmpty else { return nil }
            return ParsedCard(
                meaningUnit: "",
                dictationTargets: [],
                word: cells[0],
                meaning: cleanCell(rawCells[1], preserveHighlights: true),
                meaningUsesWordStyle: !containsChineseText(cells[1]),
                focusLevel: focusLevel(of: rawCells[0])
            )
        case .inferred:
            return parseInferredTableRow(rawCells: rawCells, cells: cells)
        case nil:
            return nil
        }
    }

    /// Infers the card layout from cell structure when a table uses an
    /// unfamiliar header. Meaning-unit rows have a bold target in the first
    /// cell and a combined `word<br><br>meaning` value in the second cell.
    private static func parseInferredTableRow(rawCells: [String], cells: [String]) -> ParsedCard? {
        guard cells.count >= 2,
              !cells[0].isEmpty,
              !cells[1].isEmpty else { return nil }

        if hasCombinedBreak(in: rawCells[1]),
           !hasCombinedBreak(in: rawCells[0]),
           !boldTexts(in: rawCells[0]).isEmpty,
           let combined = splitCombinedWordAndMeaning(cleanCell(rawCells[1], preserveHighlights: true)) {
            return ParsedCard(
                meaningUnit: cells[0],
                dictationTargets: boldTexts(in: rawCells[0]),
                word: combined.word,
                meaning: combined.meaning,
                focusLevel: focusLevel(of: rawCells[1])
            )
        }

        if cells.count >= 3,
           !hasCombinedBreak(in: rawCells[0]),
           !hasCombinedBreak(in: rawCells[1]),
           !cells[2].isEmpty,
           !boldTexts(in: rawCells[0]).isEmpty {
            return ParsedCard(
                meaningUnit: cells[0],
                dictationTargets: boldTexts(in: rawCells[0]),
                word: cells[1],
                meaning: cleanCell(rawCells[2], preserveHighlights: true),
                focusLevel: focusLevel(of: rawCells[1])
            )
        }

        if hasCombinedBreak(in: rawCells[0]),
           let combined = splitCombinedWordAndMeaning(cleanCell(rawCells[0], preserveHighlights: true)),
           !combined.meaning.isEmpty {
            return ParsedCard(
                meaningUnit: "",
                dictationTargets: [],
                word: combined.word,
                meaning: combined.meaning,
                focusLevel: focusLevel(of: rawCells[0])
            )
        }

        return ParsedCard(
            meaningUnit: "",
            dictationTargets: [],
            word: cells[0],
            meaning: cleanCell(rawCells[1], preserveHighlights: true),
            focusLevel: focusLevel(of: rawCells[0])
        )
    }

    /// 把 `无, 不, 非\napathy n.冷漠` 拆成释义和例词：开头不以英文字母起头的行是释义。
    private static func splitLeadingGloss(_ cell: String) -> (gloss: String, rest: String) {
        let lines = cell.components(separatedBy: "\n")
        var index = 0
        while index < lines.count, let first = lines[index].unicodeScalars.first,
              !(CharacterSet.letters.contains(first) && first.isASCII) {
            index += 1
        }
        return (lines[..<index].joined(separator: "\n"), lines[index...].joined(separator: "\n"))
    }

    /// `释义<br><br>拆解…` 取第一个空行（`<br><br>`）之前的释义；没有空行就整格都是释义。
    /// 现行单词表在释义前还有一段音标：`/baɪˈɒlədʒi/<br><br>n. 生物学<br><br>拆解…`，
    /// 这时第一段只是音标，要连同下一段一起取，交给 `splitPhonetic` 再剥开。
    private static func leadingMeaning(in rawCell: String) -> String {
        // 开头的 <br> 只为和多行的邻格对齐，释义从第一个非空行算起。
        let rawCell = rawCell.replacingOccurrences(
            of: #"^(?:\s*<br\s*/?>)+"#, with: "", options: [.regularExpression, .caseInsensitive]
        )
        let paragraphs = rawCell
            .replacingOccurrences(
                of: #"<br\s*/?>\s*<br\s*/?>"#, with: "\u{0}",
                options: [.regularExpression, .caseInsensitive]
            )
            .components(separatedBy: "\u{0}")
        guard let first = paragraphs.first else { return cleanCell(rawCell) }
        let head = cleanCell(first, preserveHighlights: true)
        if paragraphs.count > 1, isPhoneticMeaning(head) {
            let body = cleanCell(paragraphs[1], preserveHighlights: true)
            return body.isEmpty ? head : head + "\n" + body
        }
        return head
    }

    private static func hasCombinedBreak(in rawCell: String) -> Bool {
        guard let expression = combinedBreakExpression else { return false }
        let range = NSRange(rawCell.startIndex..<rawCell.endIndex, in: rawCell)
        return expression.firstMatch(in: rawCell, range: range) != nil
    }

    /// 把释义开头的 DJ 音标剥下来。源笔记的格式是
    /// `核心词<br><br>/音标/<br><br>释义`，`<br>` 在更早一步已转成换行，
    /// 所以这里看到的是首行独占一个 `/.../`。
    ///
    /// 只认**整行就是一对斜杠包起来的音标**，不碰释义正文里出现的斜杠
    /// （`and/or`、`n. 甲/乙` 这类），避免误伤。
    static func splitPhonetic(from meaning: String) -> (phonetic: String, body: String) {
        let lines = meaning.components(separatedBy: "\n")
        guard let first = lines.first else { return ("", meaning) }
        let candidate = first.trimmingCharacters(in: .whitespaces)
        guard candidate.count >= 3,
              candidate.hasPrefix("/"), candidate.hasSuffix("/"),
              candidate.dropFirst().dropLast().contains("/") == false else {
            return ("", meaning)
        }
        let body = lines.dropFirst()
            .joined(separator: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        // 整格只有音标没有释义时不剥, 否则卡片下半部分会空掉。
        return body.isEmpty ? ("", meaning) : (candidate, body)
    }

    /// Uses `;` / `；` / `<br>` to find POS boundaries. Definitions belonging
    /// to the same POS stay on one semicolon-separated line; different POS
    /// blocks become separate lines while retaining their source order.
    private static func parseMeaningSections(from meaning: String) -> [String] {
        let items = meaning
            .replacingOccurrences(of: "；", with: ";")
            .components(separatedBy: CharacterSet(charactersIn: ";\n"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard !items.isEmpty else { return [] }

        var sections: [String] = []
        var currentItems: [String] = []
        var currentPartOfSpeech: String?

        func appendCurrentSection() {
            guard !currentItems.isEmpty else { return }
            sections.append(currentItems.joined(separator: "; "))
        }

        for item in items {
            if let partOfSpeech = partOfSpeechPrefix(in: item) {
                if currentPartOfSpeech != nil,
                   partOfSpeech.caseInsensitiveCompare(currentPartOfSpeech ?? "") != .orderedSame {
                    appendCurrentSection()
                    currentItems = []
                }
                currentPartOfSpeech = partOfSpeech
            }
            currentItems.append(item)
        }
        appendCurrentSection()

        return sections.isEmpty ? [items.joined(separator: "; ")] : sections
    }

    private static func partOfSpeechPrefix(in text: String) -> String? {
        let markers = [
            "phrasal v.", "modal v.", "phr.v.", "aux.v.",
            "interj.", "pron.", "prep.", "conj.", "det.",
            "adj.", "adv.", "abbr.", "prefix.", "suffix.",
            "noun.", "verb.", "num.", "art.", "n.", "v."
        ]
        let lowercased = text.lowercased()
        return markers.first { lowercased.hasPrefix($0) }
    }

    // MARK: - Accent

    static func accent(at index: Int) -> MTCardAccent {
        let accents = [
            MTCardAccent(
                primary: UIColor(red: 0.13, green: 0.22, blue: 0.17, alpha: 1),
                secondary: UIColor(red: 0.69, green: 0.93, blue: 0.72, alpha: 1),
                surface: UIColor(red: 0.39, green: 0.82, blue: 0.49, alpha: 1),
                gradientStart: UIColor(red: 0.37, green: 0.78, blue: 0.43, alpha: 1),
                gradientEnd: UIColor(red: 0.52, green: 0.91, blue: 0.61, alpha: 1)
            ),
            MTCardAccent(
                primary: UIColor(red: 0.15, green: 0.20, blue: 0.39, alpha: 1),
                secondary: UIColor(red: 0.76, green: 0.83, blue: 1.00, alpha: 1),
                surface: UIColor(red: 0.43, green: 0.54, blue: 0.96, alpha: 1),
                gradientStart: UIColor(red: 0.37, green: 0.47, blue: 0.92, alpha: 1),
                gradientEnd: UIColor(red: 0.66, green: 0.72, blue: 1.00, alpha: 1)
            ),
            MTCardAccent(
                primary: UIColor(red: 0.34, green: 0.20, blue: 0.11, alpha: 1),
                secondary: UIColor(red: 1.00, green: 0.78, blue: 0.54, alpha: 1),
                surface: UIColor(red: 0.97, green: 0.56, blue: 0.31, alpha: 1),
                gradientStart: UIColor(red: 0.95, green: 0.48, blue: 0.28, alpha: 1),
                gradientEnd: UIColor(red: 1.00, green: 0.74, blue: 0.42, alpha: 1)
            ),
            MTCardAccent(
                primary: UIColor(red: 0.21, green: 0.15, blue: 0.33, alpha: 1),
                secondary: UIColor(red: 0.89, green: 0.72, blue: 1.00, alpha: 1),
                surface: UIColor(red: 0.65, green: 0.47, blue: 0.93, alpha: 1),
                gradientStart: UIColor(red: 0.53, green: 0.42, blue: 0.88, alpha: 1),
                gradientEnd: UIColor(red: 0.79, green: 0.58, blue: 0.95, alpha: 1)
            ),
            MTCardAccent(
                primary: UIColor(red: 0.10, green: 0.28, blue: 0.34, alpha: 1),
                secondary: UIColor(red: 0.69, green: 0.93, blue: 0.98, alpha: 1),
                surface: UIColor(red: 0.29, green: 0.72, blue: 0.82, alpha: 1),
                gradientStart: UIColor(red: 0.22, green: 0.64, blue: 0.76, alpha: 1),
                gradientEnd: UIColor(red: 0.45, green: 0.86, blue: 0.90, alpha: 1)
            )
        ]
        return accents[index % accents.count]
    }
}

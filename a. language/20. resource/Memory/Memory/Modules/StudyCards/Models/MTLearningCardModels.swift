//
//  MTLearningCardModels.swift
//  Memory
//
//  Created by GPT-5.5 on 5/7/26.
//

import UIKit

nonisolated struct MTCardAccent: Sendable {
    let primary: UIColor
    let secondary: UIColor
    let surface: UIColor
    let gradientStart: UIColor
    let gradientEnd: UIColor
}

nonisolated struct MTLearningStudyCard: Sendable {
    /// Optional memory anchor from the first column of a three-column deck.
    /// Legacy two-column decks leave this empty and retain their old appearance.
    let meaningUnit: String
    /// Exact target forms emphasized in the source meaning unit. A deck may
    /// use an inflected or derived form (for example `attend` → `attended`),
    /// so dictation mode must mask these source forms instead of guessing.
    let dictationTargets: [String]
    let word: String
    let meaning: String
    /// 英英改写卡的内容类型。释义仍用统一样式, 不参与音频播放。
    let meaningUsesWordStyle: Bool
    /// `例子 | 音标` / `单词 | 音标` 卡：下半部分是音标而不是中文释义。
    /// 仅用于识别内容类型。所有释义区域都只显示, 不参与音频播放。
    let meaningIsPhonetic: Bool

    /// 用于词头区域的英文表达排版判断, 不改变释义样式或播放内容。
    var meaningUsesWordTypeface: Bool { meaningUsesWordStyle || meaningIsPhonetic }
    /// 源表格评分列的 0–5 分; 无评分列时兼容词头标记的 0 / 1 分。
    /// Obsidian 是唯一数据来源，App 不存独立评分来覆盖它。
    let focusLevel: Int
    var isFocused: Bool { focusLevel > 0 }
    /// Render-ready POS sections. The card keeps one meaning UILabel and
    /// preserves the source order of these text blocks when it is shown.
    let meaningSections: [String]
    /// The source table's first column name, shown as the navigation title
    /// so the card is labelled exactly as the note it came from. Empty when
    /// the table has no header.
    let sectionTitle: String
    /// 这张卡出身的卡组目录，真人音频就在它的 `audio/` 里。
    ///
    /// 卡片自己带着它，是因为**合并卡组没有单一的卡组目录**：把 23 章合成一副牌之后
    /// `MTLearningCardsConfiguration.deckDirectoryURL` 是 nil，只有逐张卡才说得清
    /// 这个词的录音该去哪一章找（见 `MTDeckAudioLibrary`）。
    let audioDirectoryURL: URL?
    /// 源笔记里夹在 `核心词<br><br>` 与释义之间的 DJ 音标（含首尾斜杠），
    /// 例如 `/ˈætməsfɪə/`。没有音标时为空串。
    ///
    /// 它从释义里**剥离**出来单独存：留在释义里会被 `parseMeaningSections`
    /// 当成一个词性段落，既排错版也会被朗读成一串乱码。
    let phonetic: String
    let accent: MTCardAccent

    init(meaningUnit: String,
         dictationTargets: [String] = [],
         word: String,
         meaning: String,
         meaningUsesWordStyle: Bool = false,
         meaningIsPhonetic: Bool = false,
         focusLevel: Int = 0,
         meaningSections: [String],
         sectionTitle: String = "",
         audioDirectoryURL: URL? = nil,
         phonetic: String = "",
         accent: MTCardAccent) {
        self.meaningUnit = meaningUnit
        self.dictationTargets = dictationTargets
        self.word = word
        self.meaning = meaning
        self.meaningUsesWordStyle = meaningUsesWordStyle
        self.meaningIsPhonetic = meaningIsPhonetic
        self.focusLevel = focusLevel
        self.meaningSections = meaningSections
        self.sectionTitle = sectionTitle
        self.audioDirectoryURL = audioDirectoryURL
        self.phonetic = phonetic
        self.accent = accent
    }
}

nonisolated struct MTLearningCardsConfiguration: Sendable {
    let navigationTitle: String
    let subtitle: String
    let cards: [MTLearningStudyCard]
    /// Folder the deck's `.md` file(s) live in. Study state (progress,
    /// autoplay settings, focus toggle) is persisted here via MMKV instead of
    /// UserDefaults, so it travels with the deck across app updates and
    /// folder renames/moves. Scores and focus tiers are always re-derived
    /// from the source Markdown marks, never from a separate saved score.
    let deckDirectoryURL: URL?
    /// 这副牌由哪几个卡组组成（`MTCardManagerItem.id`）。单卡组 1 个，合并卡组 N 个。
    ///
    /// 「回到上次现场」要靠它把牌堆原样拼回来。合并卡组的 `deckDirectoryURL` 是 nil，
    /// 光靠它没法记录，之前合并牌堆因此完全进不了恢复入口。
    let sourceDeckIDs: [String]
}

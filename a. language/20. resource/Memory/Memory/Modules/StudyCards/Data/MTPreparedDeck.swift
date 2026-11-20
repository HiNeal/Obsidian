import Foundation

/// 排序和各层词库在后台一次构建；每次翻页只取数组，不再全量 filter。
nonisolated struct MTPreparedCardOrder: Sendable {
    let allCards: [MTLearningStudyCard]
    private let tierOne: [MTLearningStudyCard]
    let availableTiers: Set<Int>

    init(cards: [MTLearningStudyCard]) {
        allCards = cards
        let one = cards.filter { MTAutoplaySettings.score(for: $0) > 0 }
        tierOne = one
        availableTiers = one.isEmpty ? [] : [1]
    }

    func cards(for tiers: Set<Int>) -> [MTLearningStudyCard] {
        tiers.contains(1) ? tierOne : allCards
    }
}

nonisolated struct MTPreparedDeck: Sendable {
    let configuration: MTLearningCardsConfiguration
    let order: MTPreparedCardOrder
    let audioLibrary: MTDeckAudioLibrary

    init(configuration: MTLearningCardsConfiguration) {
        self.configuration = configuration
        MTAutoplaySettings.prepareStore(for: configuration.deckDirectoryURL)
        let audio = MTDeckAudioLibrary(cards: configuration.cards, deckDirectoryURL: configuration.deckDirectoryURL)
        for directory in MTDeckAudioLibrary.audioDirectories(in: configuration.cards,
                                                           deckDirectoryURL: configuration.deckDirectoryURL) {
            MTAutoplaySettings.prepareStore(for: directory)
        }
        audioLibrary = audio
        order = MTPreparedCardOrder(cards: MTAutoplaySettings.applyPlayOrder(
            MTAutoplaySettings.playOrder(for: configuration.deckDirectoryURL),
            to: configuration.cards, for: configuration.deckDirectoryURL
        ))
    }
}

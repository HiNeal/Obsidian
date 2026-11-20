//
//  MTCardLibraryModels.swift
//  Memory
//
//  Created by GPT-5.5 on 5/3/26.
//

import UIKit

nonisolated struct MTCardLibraryUIItem: Sendable {
    let managerItem: MTCardManagerItem
    let title: String
    let subtitle: String
    let canDelete: Bool

    var familiarityLevel: MTFamiliarityLevel {
        managerItem.familiarityLevel
    }
}

nonisolated enum MTCardLibraryData {
    static func makeItems(in path: String? = nil) -> [MTCardLibraryUIItem] {
        let items = MTCardManager.listCards(at: path).map { item in
            MTCardLibraryUIItem(
                managerItem: item,
                title: item.title,
                subtitle: item.subtitle,
                canDelete: true
            )
        }
        let saved = UserDefaults.standard.stringArray(forKey: "MTCardOrder") ?? []
        let positions = Dictionary(saved.enumerated().map { ($0.element, $0.offset) }, uniquingKeysWith: min)
        return items.enumerated().sorted {
            let left = positions[$0.element.managerItem.id] ?? Int.max
            let right = positions[$1.element.managerItem.id] ?? Int.max
            return left == right ? $0.offset < $1.offset : left < right
        }.map(\.element)
    }
}

//
//  MTStudyLayoutMode.swift
//  Memory
//

import CoreGraphics

enum MTStudyLayoutMode: Equatable {
    case portrait
    case landscapeReading

    init(size: CGSize) {
        self = size.width > size.height ? .landscapeReading : .portrait
    }

    var isLandscapeReadingMode: Bool {
        self == .landscapeReading
    }
}

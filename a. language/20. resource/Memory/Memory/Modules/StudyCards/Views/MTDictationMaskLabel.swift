//
//  MTDictationMaskLabel.swift
//  Memory
//
//  Created by Codex on 8/22/26.
//

import UIKit

/// A UILabel that keeps its source text layout intact and covers selected
/// glyph rectangles directly with opaque mask views.
final class MTDictationMaskLabel: UILabel {

    /// Retains one complete TextKit layout so dictation text and its mask use
    /// exactly the same font metrics, wrapping decisions, and glyph origins.
    private final class TextLayout {
        let textStorage: NSTextStorage
        let layoutManager: NSLayoutManager
        let textContainer: NSTextContainer
        let drawingOrigin: CGPoint

        init(textStorage: NSTextStorage,
             layoutManager: NSLayoutManager,
             textContainer: NSTextContainer,
             drawingOrigin: CGPoint) {
            self.textStorage = textStorage
            self.layoutManager = layoutManager
            self.textContainer = textContainer
            self.drawingOrigin = drawingOrigin
        }
    }

    enum Appearance: Equatable {
        case light
        case dark

        var backgroundColor: UIColor {
            switch self {
            case .light: return UIColor(white: 0.86, alpha: 0.78)
            case .dark: return UIColor(white: 0.20, alpha: 0.78)
            }
        }

    }

    private var maskedRanges: [NSRange] = []
    private var maskAppearance: Appearance = .light
    private var maskViews: [UIView] = []
    private var activeTextLayout: TextLayout?
    private var maskLayoutIsDirty = true
    private var maskLayoutSize: CGSize = .zero
    private var maskLayoutAlignment: NSTextAlignment = .natural
    private var maskLayoutLineBreak: NSLineBreakMode = .byWordWrapping
    private var maskLayoutLineCount = -1
    private var maskLayoutScale: CGFloat = 0

    func setDictationMask(ranges: [NSRange], appearance: Appearance) {
        guard maskedRanges != ranges || maskAppearance != appearance else { return }
        maskedRanges = ranges
        maskAppearance = appearance
        maskLayoutIsDirty = true
        setNeedsLayout()
        setNeedsDisplay()
    }

    /// Returns whether a point falls inside one of the visible dictation masks.
    /// The mask views deliberately do not receive touches themselves, so the
    /// card's tap gesture can decide whether this was a reveal tap or a score tap.
    func containsMask(at point: CGPoint) -> Bool {
        // Add forgiving padding around the visible material so the answer is
        // easy to hit without changing the mask's rendered size.
        maskViews.contains { $0.frame.insetBy(dx: -12, dy: -12).contains(point) }
    }

    override var attributedText: NSAttributedString? {
        didSet {
            activeTextLayout = nil
            maskLayoutIsDirty = true
            setNeedsLayout()
            setNeedsDisplay()
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let scale = window?.screen.scale ?? traitCollection.displayScale
        guard maskLayoutIsDirty || maskLayoutSize != bounds.size
                || maskLayoutAlignment != textAlignment || maskLayoutLineBreak != lineBreakMode
                || maskLayoutLineCount != numberOfLines || maskLayoutScale != scale else { return }
        maskLayoutIsDirty = false
        maskLayoutSize = bounds.size
        maskLayoutAlignment = textAlignment
        maskLayoutLineBreak = lineBreakMode
        maskLayoutLineCount = numberOfLines
        maskLayoutScale = scale
        rebuildMaskViews()
    }

    override func drawText(in rect: CGRect) {
        guard let activeTextLayout else {
            super.drawText(in: rect)
            return
        }

        let glyphRange = activeTextLayout.layoutManager.glyphRange(
            for: activeTextLayout.textContainer
        )
        activeTextLayout.layoutManager.drawBackground(
            forGlyphRange: glyphRange,
            at: activeTextLayout.drawingOrigin
        )
        activeTextLayout.layoutManager.drawGlyphs(
            forGlyphRange: glyphRange,
            at: activeTextLayout.drawingOrigin
        )
    }

    private func rebuildMaskViews() {
        maskViews.forEach { $0.removeFromSuperview() }
        maskViews.removeAll()
        activeTextLayout = nil

        guard !maskedRanges.isEmpty,
              let attributedText,
              attributedText.length > 0,
              bounds.width > 0,
              bounds.height > 0 else { return }

        let laidOutText = NSMutableAttributedString(attributedString: attributedText)
        let fullRange = NSRange(location: 0, length: laidOutText.length)
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.alignment = textAlignment
        paragraphStyle.lineBreakMode = lineBreakMode
        laidOutText.addAttribute(.paragraphStyle, value: paragraphStyle, range: fullRange)

        let textStorage = NSTextStorage(attributedString: laidOutText)
        let layoutManager = NSLayoutManager()
        let textContainer = NSTextContainer(size: bounds.size)
        textContainer.lineFragmentPadding = 0
        textContainer.maximumNumberOfLines = numberOfLines
        textContainer.lineBreakMode = lineBreakMode
        layoutManager.addTextContainer(textContainer)
        textStorage.addLayoutManager(layoutManager)
        layoutManager.ensureLayout(for: textContainer)

        let usedRect = layoutManager.usedRect(for: textContainer)
        let verticalOffset = (bounds.height - usedRect.height) / 2 - usedRect.minY
        let drawingOrigin = CGPoint(x: 0, y: verticalOffset)
        activeTextLayout = TextLayout(
            textStorage: textStorage,
            layoutManager: layoutManager,
            textContainer: textContainer,
            drawingOrigin: drawingOrigin
        )
        setNeedsDisplay()

        for requestedRange in maskedRanges {
            let characterRange = NSIntersectionRange(requestedRange, fullRange)
            guard characterRange.length > 0 else { continue }
            let glyphRange = layoutManager.glyphRange(
                forCharacterRange: characterRange,
                actualCharacterRange: nil
            )
            var glyphIndex = glyphRange.location
            let glyphEnd = NSMaxRange(glyphRange)

            while glyphIndex < glyphEnd {
                var lineGlyphRange = NSRange()
                layoutManager.lineFragmentUsedRect(
                    forGlyphAt: glyphIndex,
                    effectiveRange: &lineGlyphRange
                )
                let lineSegment = NSIntersectionRange(glyphRange, lineGlyphRange)
                guard lineSegment.length > 0 else { break }

                let glyphBounds = layoutManager.boundingRect(
                    forGlyphRange: lineSegment,
                    in: textContainer
                )
                let frame = pixelAlignedFrame(
                    glyphBounds.offsetBy(dx: drawingOrigin.x, dy: drawingOrigin.y)
                )
                if frame.width > 0, frame.height > 0 {
                    addMaskView(frame: frame)
                }
                glyphIndex = NSMaxRange(lineSegment)
            }
        }
    }

    /// Text glyphs and UIKit mask views can otherwise round fractional
    /// coordinates in opposite directions. Round outward on the actual screen
    /// grid so the material always covers the complete layout rectangle.
    private func pixelAlignedFrame(_ frame: CGRect) -> CGRect {
        let scale = window?.screen.scale ?? traitCollection.displayScale
        let minX = floor(frame.minX * scale) / scale
        let minY = floor(frame.minY * scale) / scale
        let maxX = ceil(frame.maxX * scale) / scale
        let maxY = ceil(frame.maxY * scale) / scale
        return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }

    private func addMaskView(frame: CGRect) {
        let maskView = UIView(frame: frame)
        maskView.isUserInteractionEnabled = false
        maskView.backgroundColor = maskAppearance.backgroundColor
        maskView.layer.cornerCurve = .continuous
        maskView.layer.cornerRadius = min(12, frame.height * 0.16)
        maskView.clipsToBounds = true

        addSubview(maskView)
        maskViews.append(maskView)
    }
}

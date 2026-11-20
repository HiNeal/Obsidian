//
//  MTLearningCardView.swift
//  Memory
//
//  Created by GPT-5.5 on 5/7/26.
//

import UIKit
import SnapKit

final class MTLearningCardView: UIView {

    // MARK: data property

    var studyCard: MTLearningStudyCard? {
        didSet {
            refreshView(with: studyCard)
        }
    }

    // MARK: getter lazy view

    private let wordLabel = MTDictationMaskLabel()
    private let dividerView = UIView()
    /// 夹在分割线与释义之间的 DJ 音标。听写模式下必须隐藏——那时词头是遮住的,
    /// 音标等于直接把答案写在旁边。
    private let phoneticLabel = UILabel()
    private var wordBottomConstraint: Constraint?
    /// `isHidden` 不会让普通 subview 退出 Auto Layout（只有 UIStackView 的
    /// arranged subview 才塌缩），空 UILabel 照样占一个行高。所以必须显式把
    /// 高度压到 0，否则关掉音标后版面比原来矮一截。
    private var phoneticHeightConstraint: Constraint?
    private var showsPhonetic = false
    private let meaningLabel = UILabel()
    private let swipeHintLabel = UILabel()
    /// Obsidian 标记分数。只在点击后短暂出现，随后淡出。
    private let scoreBadgeLabel = UILabel()
    private var scoreBadgeHide: DispatchWorkItem?
    private let readingWordLabel = MTDictationMaskLabel()
    private let readingMeaningLabel = UILabel()
    private let readingContentStackView = UIStackView()
    private var currentCard: MTLearningStudyCard?
    private var isReadingOnlyMode = false
    private var isDictationMode = false
    private var studyContentMode: MTStudyContentMode = .word
    private var hasMeaningUnit = false
    private var primaryText = ""
    private var secondaryText = ""
    private var highlightedWord = ""
    private var dictationTargets: [String] = []
    private var isDictationAnswerRevealed = false
    private var meaningUsesWordStyle = false
    private var cachedTargetRanges: [Range<String.Index>] = []
    private var typographyIsDirty = true
    private var typographySize: CGSize = .zero
    private var typographyInsets: UIEdgeInsets = .zero

    /// wordLabel 的显式高度：min(文字自然高度, 分割线上方的固定可用高度)。
    /// 见 updateWordHeight()。
    private var wordHeightConstraint: Constraint?

    // MARK: color

    private enum Metric {
        /// 改造前词头到分割线的间距, 是「没有音标」时必须还原到的基准。
        static let wordToDivider: CGFloat = 24
        /// 音标下沿到分割线的间距。
        static let phoneticToDivider: CGFloat = 6
        /// 音标显示时词头与音标之间的间距, 贴得近以示同属一组。
        static let wordToPhonetic: CGFloat = 8
    }

    private enum Color {
        static let background = UIColor.white
        static let wordText = UIColor(red: 0.05, green: 0.05, blue: 0.05, alpha: 1)
        static let wordHighlight = UIColor(red: 0.72, green: 0.31, blue: 0.14, alpha: 1)
        static let divider = UIColor(red: 0.85, green: 0.84, blue: 0.82, alpha: 1)
        static let meaningText = UIColor(red: 0.35, green: 0.34, blue: 0.33, alpha: 1)
        static let examMeaningHighlight = UIColor(red: 0.84, green: 0.95, blue: 0.83, alpha: 1)
        /// 音标比释义再淡一档：它是辅助信息，不该跟释义抢注意力。
        static let phoneticText = UIColor(red: 0.52, green: 0.51, blue: 0.49, alpha: 1)
        static let swipeHintText = UIColor(red: 0.45, green: 0.44, blue: 0.42, alpha: 1)
        static let swipeHintBorder = UIColor(red: 0.82, green: 0.81, blue: 0.78, alpha: 1)
        // 横屏沉浸阅读沿用竖屏的浅色主题，只是去掉卡片圆角、铺满整屏
        static let readingBackground = background
        static let readingText = wordText
        static let readingWordHighlight = wordHighlight
        static let readingMeaningText = meaningText
    }

    // MARK: setup

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupSubviews()
        setupViewConstraints()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupSubviews() {
        isAccessibilityElement = true
        backgroundColor = Color.background
        layer.cornerRadius = 24
        layer.cornerCurve = .continuous
        layer.masksToBounds = true

        // Word — pure white/black, hero. Unlimited lines; height comes from an explicit
        // constraint (natural height capped at the space above the divider) so the label
        // grows upward from the divider, and auto-shrinks once the cap kicks in.
        wordLabel.textColor = Color.wordText
        wordLabel.textAlignment = .center
        wordLabel.numberOfLines = 0
        wordLabel.adjustsFontSizeToFitWidth = true
        wordLabel.minimumScaleFactor = 0.18
        wordLabel.lineBreakMode = .byTruncatingTail

        // Divider — ghost of a line
        dividerView.backgroundColor = Color.divider

        // Meaning — secondary. Wraps freely, no line cap, no shrink
        phoneticLabel.textColor = Color.phoneticText
        phoneticLabel.textAlignment = .center
        phoneticLabel.numberOfLines = 1
        phoneticLabel.adjustsFontSizeToFitWidth = true
        phoneticLabel.minimumScaleFactor = 0.5
        phoneticLabel.isHidden = true

        meaningLabel.textColor = Color.meaningText
        meaningLabel.textAlignment = .center
        meaningLabel.numberOfLines = 0
        meaningLabel.lineBreakMode = .byWordWrapping

        readingWordLabel.textColor = Color.readingText
        readingWordLabel.textAlignment = .center
        readingWordLabel.numberOfLines = 1
        readingWordLabel.adjustsFontSizeToFitWidth = true
        readingWordLabel.minimumScaleFactor = 0.25
        readingWordLabel.lineBreakMode = .byWordWrapping
        readingWordLabel.font = readingWordFont

        readingMeaningLabel.textColor = Color.readingMeaningText
        readingMeaningLabel.textAlignment = .center
        readingMeaningLabel.numberOfLines = 0
        readingMeaningLabel.lineBreakMode = .byWordWrapping
        readingMeaningLabel.font = readingMeaningFont

        readingContentStackView.axis = .vertical
        readingContentStackView.alignment = .fill
        readingContentStackView.spacing = 42
        readingContentStackView.isHidden = true

        // Swipe hint
        swipeHintLabel.alpha = 0
        swipeHintLabel.font = MTAppFont.font(ofSize: 13, weight: .medium)
        swipeHintLabel.textColor = Color.swipeHintText
        swipeHintLabel.textAlignment = .center
        swipeHintLabel.layer.cornerRadius = 13
        swipeHintLabel.layer.borderWidth = 1
        swipeHintLabel.layer.borderColor = Color.swipeHintBorder.cgColor

        // 点击时显示源笔记标记对应的 0、1、2 分。
        scoreBadgeLabel.font = MTAppFont.font(ofSize: 13, weight: .bold)
        scoreBadgeLabel.textColor = .secondaryLabel
        scoreBadgeLabel.backgroundColor = .secondarySystemBackground
        scoreBadgeLabel.textAlignment = .center
        scoreBadgeLabel.layer.cornerRadius = 14
        scoreBadgeLabel.layer.masksToBounds = true
        scoreBadgeLabel.isHidden = true
        scoreBadgeLabel.alpha = 0

        [wordLabel, dividerView, phoneticLabel, meaningLabel, swipeHintLabel, scoreBadgeLabel, readingContentStackView].forEach {
            addSubview($0)
        }
        readingContentStackView.addArrangedSubview(readingWordLabel)
        readingContentStackView.addArrangedSubview(readingMeaningLabel)
    }

    private func setupViewConstraints() {
        dividerView.snp.makeConstraints { make in
            make.centerX.equalToSuperview()
            make.centerY.equalToSuperview()
            make.width.equalTo(140)
            make.height.equalTo(1)
        }

        // 音标属于词头, 所以跟词头一组放在分割线**上方**; 分割线仍然只分隔
        // 「词」与「释义」两件事。
        phoneticLabel.snp.makeConstraints { make in
            make.bottom.equalTo(dividerView.snp.top).offset(-Metric.phoneticToDivider)
            make.leading.trailing.equalToSuperview().inset(20)
            phoneticHeightConstraint = make.height.equalTo(0).constraint
        }

        wordLabel.snp.makeConstraints { make in
            // 音标隐藏时其高度为 0, 间距取 18, 合起来正好是原来的 24, 版面不变。
            wordBottomConstraint = make.bottom.equalTo(phoneticLabel.snp.top)
                .offset(-(Metric.wordToDivider - Metric.phoneticToDivider)).constraint
            make.leading.trailing.equalToSuperview().inset(20)
            // 约束只定位置；高度不由约束推导，由 updateWordHeight() 手动算好后写入
            wordHeightConstraint = make.height.equalTo(0).constraint
        }

        meaningLabel.snp.makeConstraints { make in
            make.top.equalTo(dividerView.snp.bottom).offset(32)
            make.leading.trailing.equalToSuperview().inset(20)
            make.bottom.lessThanOrEqualToSuperview().offset(-28)
        }

        scoreBadgeLabel.snp.makeConstraints { make in
            make.top.equalToSuperview().offset(18)
            make.centerX.equalToSuperview()
            // 正圆：高宽都钉死 28，数字靠 textAlignment 居中。
            // 之前用 `"  3  "` 加空格撑宽度，尾部空格渲染时被吞掉，看着就偏左了。
            make.height.equalTo(28)
            make.width.greaterThanOrEqualTo(28)
        }

        swipeHintLabel.snp.makeConstraints { make in
            make.top.equalToSuperview().offset(18)
            make.trailing.equalToSuperview().inset(18)
            make.width.equalTo(56)
            make.height.equalTo(26)
        }

        readingContentStackView.snp.makeConstraints { make in
            make.center.equalTo(safeAreaLayoutGuide)
            make.leading.trailing.equalTo(safeAreaLayoutGuide).inset(36)
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        updateTypographyIfNeeded()
    }

    // MARK: refresh

    func setDictationMode(_ enabled: Bool) {
        guard isDictationMode != enabled else { return }
        isDictationMode = enabled
        refreshView(with: currentCard)
    }

    func setContentMode(_ mode: MTStudyContentMode) {
        guard studyContentMode != mode else { return }
        studyContentMode = mode
        refreshView(with: currentCard)
    }

    func refreshView(with card: MTLearningStudyCard?,
                     contentMode: MTStudyContentMode? = nil,
                     dictationMode: Bool? = nil) {
        if let contentMode { studyContentMode = contentMode }
        if let dictationMode { isDictationMode = dictationMode }
        guard let card else { return }
        currentCard = card
        typographyIsDirty = true
        isDictationAnswerRevealed = false

        let meaningUnit = card.meaningUnit.trimmingCharacters(in: .whitespacesAndNewlines)
        let renderedMeaning = card.meaningSections.joined(separator: "\n")
        hasMeaningUnit = studyContentMode == .meaningUnit && !meaningUnit.isEmpty

        primaryText = hasMeaningUnit ? meaningUnit : card.word
        secondaryText = renderedMeaning
        highlightedWord = card.word
        dictationTargets = card.dictationTargets.isEmpty ? [card.word] : card.dictationTargets
        let targetRanges = dictationTargets.flatMap { wholeWordRanges(in: primaryText, matching: $0) }
        cachedTargetRanges = Array(Set(targetRanges)).sorted { $0.lowerBound < $1.lowerBound }
        meaningUsesWordStyle = card.meaningUsesWordTypeface
        wordLabel.numberOfLines = 0
        wordLabel.adjustsFontSizeToFitWidth = !meaningUsesWordStyle && !hasMeaningUnit && !isDictationMode
        wordLabel.lineBreakMode = hasMeaningUnit ? .byWordWrapping : .byTruncatingTail
        phoneticLabel.font = phoneticFont
        meaningLabel.font = meaningFont
        meaningLabel.textColor = Color.meaningText
        meaningLabel.adjustsFontSizeToFitWidth = false
        meaningLabel.minimumScaleFactor = wordLabel.minimumScaleFactor
        meaningLabel.lineBreakMode = .byWordWrapping
        meaningLabel.numberOfLines = 0
        meaningLabel.attributedText = meaningAttributedText(font: meaningFont, textColor: Color.meaningText)

        // 卡片不再展示音标（2026-10-03 去掉了「显示音标」开关）；笔记里的音标
        // 仍由解析器从释义里剥掉，不会混进释义。
        showsPhonetic = false
        phoneticLabel.text = nil
        phoneticLabel.isHidden = true
        phoneticHeightConstraint?.update(offset: phoneticBlockHeight)
        // 必须用 offset 而不是 inset: 这条约束的目标是另一个视图的 top,
        // 不是父视图边缘, SnapKit 的 inset 不会做符号翻转, 用 inset 会把
        // 词头推到分割线下方去。
        wordBottomConstraint?.update(offset: -(Metric.wordToDivider - Metric.phoneticToDivider))

        readingWordLabel.numberOfLines = hasMeaningUnit ? 0 : 1
        readingMeaningLabel.textColor = Color.readingMeaningText
        readingMeaningLabel.adjustsFontSizeToFitWidth = false
        readingMeaningLabel.minimumScaleFactor = readingWordLabel.minimumScaleFactor
        readingMeaningLabel.lineBreakMode = .byWordWrapping
        readingMeaningLabel.attributedText = meaningAttributedText(font: readingMeaningFont, textColor: Color.readingMeaningText)
        let accessibleMeaning = card.meaning.replacingOccurrences(of: "==", with: "")
        accessibilityLabel = [card.sectionTitle, isDictationMode ? "目标单词已遮挡" : renderedPrimaryText, accessibleMeaning]
            .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .joined(separator: ", ")

        updateContentVisibility()
        updateTypographyIfNeeded()
    }

    /// Obsidian `==...==` in a gloss marks an exam-tested sense. Keep every
    /// occurrence and render it as a soft green background on both card layouts.
    private func meaningAttributedText(font: UIFont, textColor: UIColor) -> NSAttributedString {
        let source = secondaryText
        let result = NSMutableAttributedString(string: "")
        let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: textColor]
        let pattern = #"==(.*?)=="#
        guard let expression = try? NSRegularExpression(pattern: pattern) else {
            return NSAttributedString(string: source, attributes: attributes)
        }
        let fullRange = NSRange(source.startIndex..<source.endIndex, in: source)
        let matches = expression.matches(in: source, range: fullRange)
        var cursor = source.startIndex
        for match in matches {
            guard match.numberOfRanges > 1,
                  let wholeRange = Range(match.range, in: source),
                  let markedRange = Range(match.range(at: 1), in: source) else { continue }
            if cursor < wholeRange.lowerBound {
                result.append(NSAttributedString(string: String(source[cursor..<wholeRange.lowerBound]), attributes: attributes))
            }
            let highlighted = NSMutableAttributedString(string: String(source[markedRange]), attributes: attributes)
            highlighted.addAttribute(.backgroundColor, value: Color.examMeaningHighlight, range: NSRange(location: 0, length: highlighted.length))
            result.append(highlighted)
            cursor = wholeRange.upperBound
        }
        if cursor < source.endIndex {
            result.append(NSAttributedString(string: String(source[cursor...]), attributes: attributes))
        }
        return result
    }

    private func updateContentVisibility() {
        let showsCard = !isReadingOnlyMode

        wordLabel.isHidden = !showsCard
        dividerView.isHidden = !showsCard
        meaningLabel.isHidden = !showsCard
        readingContentStackView.isHidden = !isReadingOnlyMode
    }

    private func updateTypographyIfNeeded() {
        guard bounds.width > 0, bounds.height > 0,
              typographyIsDirty || typographySize != bounds.size || typographyInsets != safeAreaInsets else { return }
        typographyIsDirty = false
        typographySize = bounds.size
        typographyInsets = safeAreaInsets
        // 只排版可见的模式，避免每次布局同时测量竖屏和隐藏的横屏文字。
        if isReadingOnlyMode { updateReadingTypography() }
        else { updateWordHeight() }
    }

    // MARK: word height

    /// 手动计算 wordLabel 的高度：
    /// 意思单元卡将原句放在单词区域里，以核心词的柔和色号标注；
    /// 无意思单元时完全保留旧的「单词／释义」排版。
    /// 音标块自身的高度: 隐藏时为 0。
    private var phoneticBlockHeight: CGFloat {
        showsPhonetic ? phoneticFont.lineHeight.rounded(.up) : 0
    }

    /// 词头下沿到分割线之间被占掉的总高度。没有音标时等于改造前的 24,
    /// 版面完全还原; 有音标时把音标本身与两段间距都算进去。
    ///
    /// `updateWordHeight()` 要拿它算词头的可用高度, 布局约束也用它,
    /// 两边共用同一个来源, 免得将来改了一处忘了另一处。
    private var wordToDividerSpacing: CGFloat {
        showsPhonetic
            ? Metric.wordToPhonetic + phoneticBlockHeight + Metric.phoneticToDivider
            : Metric.wordToDivider
    }

    private func updateWordHeight() {
        // 控制器直接调 refreshView(with:) 而不设置 studyCard 属性，
        // 所以这里必须从 wordLabel.text 取词，不能依赖 studyCard
        guard !primaryText.isEmpty,
              bounds.width > 0,
              bounds.height > 0 else { return }

        let maxHeight = bounds.height / 2 - wordToDividerSpacing - 40 // 分割线上沿 − 词头下方占用 − 顶部留白 40
        let font: UIFont
        if hasMeaningUnit {
            let fontSize = MTMeaningUnitTypography.unitFontSize(
                for: renderedPrimaryText,
                maxWidth: bounds.width - 40,
                maxHeight: maxHeight,
                preferredSize: 60,
                minimumSize: 16,
                maximumLineCount: .max
            )
            font = meaningUnitPrimaryFont(ofSize: fontSize)
            wordLabel.numberOfLines = 0
            wordLabel.attributedText = primaryAttributedText(
                font: font,
                textColor: Color.wordText,
                highlightColor: Color.wordHighlight
            )
        } else if meaningUsesWordStyle {
            font = pairedEnglishFont(preferredSize: 120, maxWidth: bounds.width - 40)
            wordLabel.numberOfLines = 1
            wordLabel.adjustsFontSizeToFitWidth = false
            wordLabel.lineBreakMode = .byClipping
            meaningLabel.font = font
            meaningLabel.textColor = Color.wordText
            meaningLabel.attributedText = meaningAttributedText(font: font, textColor: Color.wordText)
            meaningLabel.numberOfLines = 1
            meaningLabel.lineBreakMode = .byClipping
            wordLabel.attributedText = primaryAttributedText(
                font: font,
                textColor: Color.wordText,
                highlightColor: Color.wordHighlight
            )
        } else {
            font = fittedSingleWordFont(
                wordFont,
                maxWidth: bounds.width - 40,
                minimumScaleFactor: wordLabel.minimumScaleFactor
            )
            wordLabel.numberOfLines = 0
            wordLabel.attributedText = primaryAttributedText(
                font: font,
                textColor: Color.wordText,
                highlightColor: Color.wordHighlight
            )
        }
        wordLabel.setDictationMask(ranges: dictationMaskRanges, appearance: .light)
        wordLabel.font = font
        let actualHeight = ceil(renderedPrimaryText.rect(
            with: font,
            maxWidth: bounds.width - 40 // 左右各 20 边距
        ).height)
        wordHeightConstraint?.update(offset: min(actualHeight, maxHeight))
    }

    private func updateReadingTypography() {
        guard bounds.width > 0, bounds.height > 0 else { return }

        guard hasMeaningUnit else {
            readingContentStackView.spacing = 42
            if meaningUsesWordStyle {
                let contentWidth = max(safeAreaLayoutGuide.layoutFrame.width - 72, 1)
                let font = pairedEnglishFont(preferredSize: 72, maxWidth: contentWidth)
                readingWordLabel.adjustsFontSizeToFitWidth = false
                readingWordLabel.numberOfLines = 1
                readingWordLabel.lineBreakMode = .byClipping
                readingWordLabel.font = font
                readingWordLabel.attributedText = primaryAttributedText(
                    font: font,
                    textColor: Color.readingText,
                    highlightColor: Color.readingWordHighlight
                )
                readingWordLabel.setDictationMask(ranges: dictationMaskRanges, appearance: .light)
                readingMeaningLabel.adjustsFontSizeToFitWidth = false
                readingMeaningLabel.numberOfLines = 1
                readingMeaningLabel.lineBreakMode = .byClipping
                readingMeaningLabel.font = font
                readingMeaningLabel.textColor = Color.readingText
                readingMeaningLabel.attributedText = meaningAttributedText(font: font, textColor: Color.readingText)
                return
            }
            let font = fittedSingleWordFont(
                readingWordFont,
                maxWidth: max(safeAreaLayoutGuide.layoutFrame.width - 72, 1),
                minimumScaleFactor: readingWordLabel.minimumScaleFactor
            )
            readingWordLabel.adjustsFontSizeToFitWidth = !isDictationMode
            readingWordLabel.font = font
            readingWordLabel.numberOfLines = 1
            readingWordLabel.attributedText = primaryAttributedText(
                font: font,
                textColor: Color.readingText,
                highlightColor: Color.readingWordHighlight
            )
            readingWordLabel.setDictationMask(ranges: dictationMaskRanges, appearance: .light)
            readingMeaningLabel.numberOfLines = 0
            readingMeaningLabel.adjustsFontSizeToFitWidth = false
            readingMeaningLabel.lineBreakMode = .byWordWrapping
            readingMeaningLabel.textColor = Color.readingMeaningText
            readingMeaningLabel.font = readingMeaningFont
            readingMeaningLabel.attributedText = meaningAttributedText(font: readingMeaningFont, textColor: Color.readingMeaningText)
            return
        }

        let contentWidth = max(safeAreaLayoutGuide.layoutFrame.width - 72, 1)
        let availableHeight = max(bounds.height / 2 - 48, 1)
        let meaningFont = self.meaningFont
        let unitFontSize = MTMeaningUnitTypography.unitFontSize(
            for: renderedPrimaryText,
            maxWidth: contentWidth,
            maxHeight: availableHeight,
            preferredSize: 72,
            minimumSize: 28,
            maximumLineCount: .max
        )

        let unitFont = meaningUnitPrimaryFont(ofSize: unitFontSize)
        readingContentStackView.spacing = 42
        readingWordLabel.numberOfLines = 0
        readingWordLabel.font = unitFont
        readingWordLabel.attributedText = primaryAttributedText(
            font: unitFont,
            textColor: Color.readingText,
            highlightColor: Color.readingWordHighlight
        )
        readingWordLabel.setDictationMask(ranges: dictationMaskRanges, appearance: .light)
        readingMeaningLabel.font = meaningFont
        readingMeaningLabel.attributedText = meaningAttributedText(font: meaningFont, textColor: Color.readingMeaningText)
    }

    // MARK: meaning visibility (复习模式)

    func setReadingOnlyMode(_ enabled: Bool) {
        guard isReadingOnlyMode != enabled else { return }
        isReadingOnlyMode = enabled
        typographyIsDirty = true

        backgroundColor = enabled ? Color.readingBackground : Color.background
        layer.cornerRadius = enabled ? 0 : 24
        wordLabel.font = wordFont
        wordLabel.textColor = enabled ? Color.readingText : Color.wordText
        meaningLabel.font = meaningFont
        meaningLabel.textColor = Color.meaningText
        meaningLabel.attributedText = meaningAttributedText(font: meaningFont, textColor: Color.meaningText)
        updateContentVisibility()
        swipeHintLabel.isHidden = enabled
        if enabled {
            swipeHintLabel.alpha = 0
        }
        updateTypographyIfNeeded()
        setNeedsLayout()
    }

    private var wordFont: UIFont {
        meaningUnitPrimaryFont(ofSize: 120)
    }

    private var meaningFont: UIFont {
        meaningFont(ofSize: 21)
    }

    /// Maple 包含 IPA 字形；音标用常规字重，作为词头的附注。
    private var phoneticFont: UIFont {
        MTAppFont.font(ofSize: 24)
    }

    private var readingWordFont: UIFont {
        MTAppFont.font(ofSize: 120, weight: .bold)
    }

    private var readingMeaningFont: UIFont {
        meaningFont
    }

    private func meaningFont(ofSize size: CGFloat) -> UIFont {
        MTAppFont.font(ofSize: size, weight: .medium)
    }

    /// 英文表达卡（同义改写）两行都单行显示，和单词卡一样不换行；
    /// 字号按较宽的那一行缩到刚好放下，两行共用同一字号。
    private func pairedEnglishFont(preferredSize: CGFloat, maxWidth: CGFloat) -> UIFont {
        let preferred = meaningUnitPrimaryFont(ofSize: preferredSize)
        let lines = ([primaryText] + secondaryText.components(separatedBy: "\n")).filter { !$0.isEmpty }
        let widest = lines
            .map { ($0 as NSString).size(withAttributes: [.font: preferred]).width }
            .max() ?? 0
        guard widest > maxWidth, maxWidth > 0 else { return preferred }
        return meaningUnitPrimaryFont(ofSize: max(preferredSize * maxWidth / widest, 8))
    }

    private func meaningUnitPrimaryFont(ofSize size: CGFloat) -> UIFont {
        MTAppFont.font(ofSize: size, weight: .bold)
    }

    private var visibleMeaningLabel: UILabel {
        meaningLabel
    }

    private var renderedPrimaryText: String {
        guard isDictationMode else {
            guard hasMeaningUnit,
                  dictationRanges(in: primaryText).isEmpty else {
                return primaryText
            }
            return "\(primaryText) · \(highlightedWord)"
        }

        guard hasMeaningUnit else { return primaryText }
        let ranges = dictationRanges(in: primaryText)
        guard !ranges.isEmpty else {
            return "\(primaryText) · \(highlightedWord)"
        }
        return primaryText
    }

    private func dictationRanges(in text: String) -> [Range<String.Index>] {
        if text == primaryText { return cachedTargetRanges }
        let ranges = dictationTargets.flatMap { wholeWordRanges(in: text, matching: $0) }
        return Array(Set(ranges)).sorted { $0.lowerBound < $1.lowerBound }
    }

    private var dictationMaskRanges: [NSRange] {
        guard isDictationMode, !isDictationAnswerRevealed else { return [] }
        guard hasMeaningUnit else {
            return [NSRange(location: 0, length: (primaryText as NSString).length)]
        }

        let ranges = dictationRanges(in: primaryText)
        if !ranges.isEmpty {
            return ranges.map { NSRange($0, in: primaryText) }
        }

        let prefixLength = ("\(primaryText) · " as NSString).length
        return [NSRange(location: prefixLength, length: (highlightedWord as NSString).length)]
    }

    private func fittedSingleWordFont(_ preferredFont: UIFont,
                                      maxWidth: CGFloat,
                                      minimumScaleFactor: CGFloat) -> UIFont {
        guard isDictationMode, maxWidth > 0 else { return preferredFont }
        let width = (primaryText as NSString).size(withAttributes: [.font: preferredFont]).width
        guard width > maxWidth else { return preferredFont }
        let scale = max(minimumScaleFactor, maxWidth / width)
        return preferredFont.withSize(preferredFont.pointSize * scale)
    }

    /// Prefer complete word or phrase matches so a target such as `of` does
    /// not highlight the tail of `roof`. If the source deliberately bolded a
    /// word fragment (for example `**circum**navigate`), fall back to its
    /// exact substring because that bold source text is the display contract.
    private func wholeWordRanges(in text: String, matching word: String) -> [Range<String.Index>] {
        guard !word.isEmpty else { return [] }

        var ranges: [Range<String.Index>] = []
        var substringRanges: [Range<String.Index>] = []
        var searchRange = text.startIndex..<text.endIndex
        while let range = text.range(
            of: word,
            options: [.caseInsensitive, .diacriticInsensitive],
            range: searchRange
        ) {
            let hasWordCharacterBefore = range.lowerBound > text.startIndex
                && isWordCharacter(text[text.index(before: range.lowerBound)])
            let hasWordCharacterAfter = range.upperBound < text.endIndex
                && isWordCharacter(text[range.upperBound])
            substringRanges.append(range)
            if !hasWordCharacterBefore, !hasWordCharacterAfter {
                ranges.append(range)
            }

            guard range.upperBound < text.endIndex else { break }
            searchRange = range.upperBound..<text.endIndex
        }
        return ranges.isEmpty ? substringRanges : ranges
    }

    private func isWordCharacter(_ character: Character) -> Bool {
        character.unicodeScalars.contains {
            CharacterSet.alphanumerics.contains($0) || $0 == "_"
        }
    }

    private func primaryAttributedText(font: UIFont,
                                       textColor: UIColor,
                                       highlightColor: UIColor) -> NSAttributedString {
        guard isDictationMode else {
            guard hasMeaningUnit else {
                return NSAttributedString(
                    string: primaryText,
                    attributes: [.font: font, .foregroundColor: textColor]
                )
            }
            return highlightedText(
                primaryText,
                font: font,
                textColor: textColor,
                highlightColor: highlightColor
            )
        }

        let result = NSMutableAttributedString(
            string: primaryText,
            attributes: [.font: font, .foregroundColor: textColor]
        )

        if hasMeaningUnit, dictationRanges(in: primaryText).isEmpty {
            result.append(NSAttributedString(
                string: " · \(highlightedWord)",
                attributes: [.font: font, .foregroundColor: highlightColor]
            ))
        }
        for range in dictationMaskRanges where NSMaxRange(range) <= result.length {
            // The characters stay in the attributed string so width, wrapping,
            // and baselines are unchanged. Clearing only their foreground is
            // the final guard against italic overhang and antialiased pixels
            // escaping a rounded material edge.
            result.addAttribute(.foregroundColor, value: UIColor.clear, range: range)
        }
        return result
    }

    private func highlightedText(_ text: String,
                                 font: UIFont,
                                 textColor: UIColor,
                                 highlightColor: UIColor) -> NSAttributedString {
        let result = NSMutableAttributedString(
            string: text,
            attributes: [.font: font, .foregroundColor: textColor]
        )

        let ranges = dictationRanges(in: text)
        for range in ranges {
            result.addAttributes(
                [.font: font, .foregroundColor: highlightColor],
                range: NSRange(range, in: text)
            )
        }
        if ranges.isEmpty, !highlightedWord.isEmpty {
            result.append(NSAttributedString(
                string: " · \(highlightedWord)",
                attributes: [.font: font, .foregroundColor: highlightColor]
            ))
        }
        return result
    }

    /// 藏起释义时略微下沉一点，揭晓时再上浮回位，做出"淡入 + 轻抬"的观感。
    private static let meaningHiddenOffset: CGFloat = 14

    /// 立刻藏起释义（换卡时用），不带动画。
    func hideMeaning() {
        let label = visibleMeaningLabel
        label.layer.removeAllAnimations()
        label.alpha = 0
        label.transform = CGAffineTransform(translationX: 0, y: Self.meaningHiddenOffset)
    }

    /// 立刻显示释义（非复习模式的常态）。
    func showMeaningImmediately() {
        let label = visibleMeaningLabel
        label.layer.removeAllAnimations()
        label.alpha = 1
        label.transform = .identity
    }

    /// Whether the tap landed on the word material in dictation mode.
    /// In landscape reading mode the visible word label is different, so keep
    /// the hit test next to the label selection used by the card itself.
    func containsDictationMask(at point: CGPoint) -> Bool {
        guard isDictationMode else { return false }
        let label = isReadingOnlyMode ? readingWordLabel : wordLabel
        let labelPoint = convert(point, to: label)
        return label.containsMask(at: labelPoint)
    }

    /// Reveals the masked answer for the current card. Refreshing the card
    /// resets this state, so the next card starts masked again.
    func revealDictationAnswer() {
        guard isDictationMode, !isDictationAnswerRevealed else { return }
        isDictationAnswerRevealed = true
        typographyIsDirty = true
        updateTypographyIfNeeded()
    }

    /// 释义揭晓：淡入 + 从下方轻轻上浮归位，带柔和弹性。
    func revealMeaning() {
        let label = visibleMeaningLabel
        guard label.alpha < 1 else { return }
        UIView.animate(withDuration: 0.62, delay: 0,
                       usingSpringWithDamping: 0.82, initialSpringVelocity: 0.3,
                       options: [.curveEaseOut, .allowUserInteraction]) {
            label.alpha = 1
            label.transform = .identity
        }
    }

    // MARK: Obsidian 标记分数

    /// 点击后短暂亮出当前分数，1.2 秒后自己淡走。
    ///
    /// 不常驻：绝大多数词是 0 分，每张卡都挂个数字只是噪音；而刚点完那一下你
    /// 恰好需要确认一眼，看完就该让位给卡片内容。
    func flashScoreBadge(_ score: Int) {
        scoreBadgeHide?.cancel()
        scoreBadgeLabel.text = "\(score)"
        let tint: UIColor = score > 0 ? Color.wordHighlight : .secondaryLabel
        scoreBadgeLabel.textColor = tint
        scoreBadgeLabel.backgroundColor = tint.withAlphaComponent(0.10)
        scoreBadgeLabel.isHidden = false
        UIView.animate(withDuration: 0.16) { self.scoreBadgeLabel.alpha = 1 }

        let hide = DispatchWorkItem { [weak self] in
            guard let self else { return }
            UIView.animate(withDuration: 0.45) {
                self.scoreBadgeLabel.alpha = 0
            } completion: { _ in
                self.scoreBadgeLabel.isHidden = true
            }
        }
        scoreBadgeHide = hide
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2, execute: hide)
    }

    /// 换卡时立刻收起，别把上一张的分数带到下一张。
    func hideScoreBadge() {
        scoreBadgeHide?.cancel()
        scoreBadgeLabel.alpha = 0
        scoreBadgeLabel.isHidden = true
    }

    // MARK: swipe hint

    func updateSwipeHint(progress: CGFloat) {
        guard !swipeHintLabel.isHidden else { return }
        let clampedProgress = max(-1, min(1, progress))
        swipeHintLabel.alpha = min(1, abs(clampedProgress) * 1.2)
        swipeHintLabel.text = clampedProgress > 0 ? "下一张" : "上一张"
    }
}

struct MTMeaningUnitTypography {
    static func unitFontSize(for text: String,
                             maxWidth: CGFloat,
                             maxHeight: CGFloat,
                             preferredSize: CGFloat,
                             minimumSize: CGFloat,
                             maximumLineCount: Int = .max,
                             weight: UIFont.Weight = .bold) -> CGFloat {
        guard !text.isEmpty, maxWidth > 0, maxHeight > 0 else { return minimumSize }

        var low = 0
        var high = max(0, Int(floor(preferredSize - minimumSize)))
        var fitted = minimumSize
        // 从逐号测量改为二分查找；长短语最多约 7 次测量就能找到最大可用字号。
        while low <= high {
            let step = (low + high) / 2
            let size = preferredSize - CGFloat(step)
            let font = MTAppFont.font(ofSize: size, weight: weight)
            let textHeight = ceil(text.rect(with: font, maxWidth: maxWidth).height)
            let lineCount = Int(ceil(textHeight / font.lineHeight))
            if textHeight <= maxHeight, lineCount <= maximumLineCount {
                fitted = size
                high = step - 1
            } else {
                low = step + 1
            }
        }
        return fitted
    }
}

// MARK: - String 宽高计算

extension String {

    /// 获取字符串宽高
    func rect(with font: UIFont?,
              maxWidth: CGFloat = CGFloat.greatestFiniteMagnitude,
              maxHeight: CGFloat = CGFloat.greatestFiniteMagnitude) -> CGRect {

        guard !isEmpty, let font else {
            return .zero
        }
        let size = CGSize(width: maxWidth, height: maxHeight)
        let options: NSStringDrawingOptions = [.usesLineFragmentOrigin]
        let attribute: [NSAttributedString.Key: Any] = [.font: font]

        return (self as NSString).boundingRect(with: size, options: options, attributes: attribute, context: nil)
    }
}

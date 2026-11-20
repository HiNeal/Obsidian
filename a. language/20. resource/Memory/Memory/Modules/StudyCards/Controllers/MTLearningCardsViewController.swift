//
//  MTLearningCardsViewController.swift
//  Memory
//
//  Created by GPT-5.5 on 5/7/26.
//

import UIKit
import AVFoundation
import SnapKit

class MTLearningCardsViewController: UIViewController, UISheetPresentationControllerDelegate {
    private let configuration: MTLearningCardsConfiguration
    private var cardOrder: MTPreparedCardOrder
    private var deck: [MTLearningStudyCard] { cardOrder.allCards }
    private var orderTask: Task<Void, Never>?
    private var orderGeneration = 0
    private let deckDirectoryURL: URL?
    /// 这副牌用到的真人音频清单，进卡组时把涉及的卡组目录列一遍就定下来。
    /// 合并卡组里每张卡回自己出身的那一章取录音，所以这里按目录存多份索引。
    private let audioLibrary: MTDeckAudioLibrary
    /// 学习信号采集：一张卡从上屏到翻走之间发生了什么，翻走时落一条事件。

    private var currentIndex = 0
    private var isTransitioning = false
    /// 当前开着的分层模式：1 = 进阶模式；空集 = 刷全量。
    private var focusTiers: Set<Int> = []
    private var isFocusMode: Bool { !focusTiers.isEmpty }
    private var contentMode: MTStudyContentMode
    private var shouldStartAutoplayOnAppear: Bool
    private var appliedLayoutMode: MTStudyLayoutMode?
    private var isLandscapeReadingMode: Bool {
        appliedLayoutMode?.isLandscapeReadingMode == true
    }
    private let progressSlider = UISlider()
    private let progressContainerView = UIView()
    /// 单卡卡组(整篇听力)的进度条改显示音频播放进度。
    private var audioProgressTimer: Timer?
    private var cachedAudioDuration: TimeInterval?
    private var activeCardView = MTLearningCardView()
    private var standbyCardView = MTLearningCardView()
    private var autoplayTimer: Timer?
    private var isAutoplaying = false
    private var landscapeStartedAutoplay = false
    /// 当前卡片尚未执行的额外周期。点击只入队，不打断当前语音或计时。
    /// 每安排一次"下一张"就自增，用来作废在途的发音完成回调/安全定时，
    /// 防止翻页后旧回调再触发一次多余的前进。
    private var autoplayGeneration = 0
    /// 真人音频是男女双声连读，同一句比合成慢不少（实测最长的短语 12.5 秒），
    /// 8 秒的估算会在还没播完时就把卡翻走。兜底只在完成回调丢失时才真正生效，
    /// 给宽一点在正常路径上没有任何代价。
    private static let speechSafetyTimeoutPerLocalAudioItem: TimeInterval = 20
    /// 复习模式：到点后让当前卡片的释义淡入。
    private var revealTimer: Timer?
    private let controlStackView = UIStackView()
    private var displayDeck: [MTLearningStudyCard] { cardOrder.cards(for: focusTiers) }
    private let playButton = MTIconControlButton(
        systemName: "play.fill",
        tintColor: UIColor(red: 0.58, green: 0.50, blue: 0.86, alpha: 1),
        accessibilityTitle: "自动播放",
        diameter: 72
    )
    private let orderButton = MTIconControlButton(
        systemName: "repeat",
        tintColor: UIColor(red: 0.55, green: 0.58, blue: 0.62, alpha: 1),
        accessibilityTitle: "播放顺序",
        diameter: 48
    )
    private let previousButton = MTIconControlButton(
        systemName: "arrow.uturn.backward",
        tintColor: UIColor(red: 0.55, green: 0.58, blue: 0.62, alpha: 1),
        accessibilityTitle: "上一张",
        diameter: 50
    )
    private let nextButton = MTIconControlButton(
        systemName: "arrow.uturn.forward",
        tintColor: UIColor(red: 0.55, green: 0.58, blue: 0.62, alpha: 1),
        accessibilityTitle: "下一张",
        diameter: 50
    )
    private let settingsButton = MTIconControlButton(
        systemName: "gearshape",
        tintColor: UIColor(red: 0.55, green: 0.58, blue: 0.62, alpha: 1),
        accessibilityTitle: "设置",
        diameter: 48
    )
    init(preparedDeck: MTPreparedDeck, autoStartAutoplay: Bool = false) {
        let configuration = preparedDeck.configuration
        self.configuration = configuration
        self.deckDirectoryURL = configuration.deckDirectoryURL
        self.audioLibrary = preparedDeck.audioLibrary
        self.cardOrder = preparedDeck.order
        self.shouldStartAutoplayOnAppear = autoStartAutoplay
        self.contentMode = MTAutoplaySettings.contentMode(for: configuration.deckDirectoryURL)
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        focusTiers = enabledFocusTiers()
        currentIndex = displayDeck.isEmpty ? 0 : min(max(MTAutoplaySettings.progressIndex(for: deckDirectoryURL), 0), displayDeck.count - 1)
        configureInterface()
        configureGesture()
        renderCurrentCard(animated: false)
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        // 记下「现在正开着这一副牌」。App 被系统回收后重新启动会直接落回这里，
        // 省掉重新翻目录选卡组这一步（见 MTAutoplaySettings.activeDeckID）。
        // 合并牌堆没有单一目录，所以记的是组成它的那几个卡组 id。
        MTAutoplaySettings.setActiveDeckIDs(configuration.sourceDeckIDs)
        navigationController?.setNavigationBarHidden(false, animated: animated)
        appliedLayoutMode = nil
        navigationController?.navigationBar.prefersLargeTitles = true
        refreshFocusState()
        startAudioProgressTimerIfNeeded()
        if shouldStartAutoplayOnAppear {
            shouldStartAutoplayOnAppear = false
            startAutoplay()
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        applyLayoutModeIfNeeded()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        revealTimer?.invalidate()
        revealTimer = nil
        audioProgressTimer?.invalidate()
        audioProgressTimer = nil
        stopAutoplay()
        cancelOrderPreparation()
        // 自己返回卡片库 = 不想再待在这副牌里，下次启动就该看到列表。
        // 注意：切后台不会走到这里，所以「被系统回收」和「主动退出」能分得开。
        if isMovingFromParent {
            MTAutoplaySettings.setActiveDeckIDs([])
        }
    }

    deinit {
        orderTask?.cancel()
        autoplayTimer?.invalidate()
        revealTimer?.invalidate()
        audioProgressTimer?.invalidate()
    }

    private func configureInterface() {
        view.backgroundColor = .white
        configureNavigation()
        configureControls()
        configureProgressControl()
        configureCard()
    }

    private func configureNavigation() {
        navigationItem.title = ""
        navigationItem.largeTitleDisplayMode = .never
        navigationController?.navigationBar.tintColor = UIColor(red: 0.08, green: 0.09, blue: 0.12, alpha: 1)

        navigationItem.titleView = nil
    }

    private func applyLayoutModeIfNeeded() {
        let mode = MTStudyLayoutMode(size: view.bounds.size)
        guard appliedLayoutMode != mode else { return }
        let wasLandscapeReadingMode = isLandscapeReadingMode
        appliedLayoutMode = mode

        let readingOnly = mode.isLandscapeReadingMode
        view.backgroundColor = .white
        navigationController?.setNavigationBarHidden(readingOnly, animated: false)
        controlStackView.isHidden = readingOnly
        progressContainerView.isHidden = readingOnly
        activeCardView.setReadingOnlyMode(readingOnly)
        standbyCardView.setReadingOnlyMode(readingOnly)
        pinCard(activeCardView, readingOnly: readingOnly)
        pinCard(standbyCardView, readingOnly: readingOnly)
        setNeedsStatusBarAppearanceUpdate()

        if readingOnly {
            revealTimer?.invalidate()
            revealTimer = nil
            activeCardView.showMeaningImmediately()
            if !isAutoplaying {
                landscapeStartedAutoplay = true
                startAutoplay()
            }
        } else {
            applyMeaningVisibility(to: activeCardView)
            scheduleMeaningReveal()
            if wasLandscapeReadingMode && landscapeStartedAutoplay {
                landscapeStartedAutoplay = false
                stopAutoplay()
            }
        }
    }

    // MARK: - Focus mode

    private func hasCards(inTier level: Int) -> Bool {
        cardOrder.availableTiers.contains(level)
    }

    /// 存着的开关里，卡组确实有词的那几层。没有词的层不算开，免得刷到空牌堆。
    private func enabledFocusTiers() -> Set<Int> {
        Set([1].filter {
            hasCards(inTier: $0) && MTAutoplaySettings.isFocusTierEnabled($0, for: deckDirectoryURL)
        })
    }

    private func refreshFocusState() {
        let tiers = enabledFocusTiers()
        if tiers != focusTiers {
            applyFocusTiers(tiers)
        } else {
            renderCurrentCard(animated: false)
        }
    }

    private func applyFocusTiers(_ tiers: Set<Int>) {
        cancelOrderPreparation()
        focusTiers = tiers
        stopAutoplay()
        currentIndex = 0
        MTAutoplaySettings.clearProgressIndex(for: deckDirectoryURL)
        renderCurrentCard(animated: false)
    }

    // MARK: - Audio progress (single-card listening decks)

    /// 只有一张卡且有本地音频(整篇听力)时, 进度条显示音频进度。
    private var audioProgressURL: URL? {
        guard displayDeck.count == 1, let card = displayDeck.first else { return nil }
        return MTSpeechPlayer.audioURLs(
            meaningUnit: card.meaningUnit, word: card.word,
            contentMode: .word, audioIndex: audioLibrary.index(for: card)
        ).first
    }

    private func startAudioProgressTimerIfNeeded() {
        guard audioProgressTimer == nil, audioProgressURL != nil else { return }
        let timer = Timer(timeInterval: 0.25, repeats: true) { [weak self] _ in
            self?.refreshAudioProgress()
        }
        audioProgressTimer = timer
        RunLoop.main.add(timer, forMode: .common)
        refreshAudioProgress()
    }

    private func refreshAudioProgress() {
        guard let url = audioProgressURL, !progressSlider.isTracking else { return }
        let position = MTSpeechPlayer.shared.playbackPosition
        let duration: TimeInterval
        if let position, position.url == url {
            duration = position.duration
            cachedAudioDuration = duration
        } else {
            if cachedAudioDuration == nil {
                cachedAudioDuration = (try? AVAudioPlayer(contentsOf: url))?.duration
            }
            duration = cachedAudioDuration ?? 0
        }
        let time = position?.url == url ? (position?.time ?? 0) : progressSlider.value.isFinite ? TimeInterval(progressSlider.value) : 0
        updateSliderThumb(text: "\(Self.clockText(time))/\(Self.clockText(duration))")
        progressSlider.maximumValue = Float(max(duration, 1))
        progressSlider.setValue(Float(min(time, duration)), animated: false)
    }

    private static func clockText(_ seconds: TimeInterval) -> String {
        let total = Int(max(0, seconds).rounded(.down))
        return String(format: "%d:%02d", total / 60, total % 60)
    }

    // MARK: - Progress control

    private func configureProgressControl() {
        let accentColor = UIColor(red: 0.58, green: 0.50, blue: 0.86, alpha: 1)

        progressContainerView.backgroundColor = .clear

        progressSlider.minimumValue = 0
        progressSlider.maximumValue = Float(max(displayDeck.count - 1, 0))
        progressSlider.isContinuous = true
        progressSlider.minimumTrackTintColor = accentColor
        progressSlider.maximumTrackTintColor = accentColor.withAlphaComponent(0.16)
        progressSlider.addTarget(self, action: #selector(progressSliderValueChanged(_:)), for: .valueChanged)

        view.addSubview(progressContainerView)
        progressContainerView.addSubview(progressSlider)

        progressContainerView.snp.makeConstraints { make in
            make.leading.trailing.equalToSuperview().inset(28)
            make.bottom.equalTo(controlStackView.snp.top).offset(-32)
            make.height.equalTo(36)
        }

        progressSlider.snp.makeConstraints { make in
            make.edges.equalToSuperview()
        }
    }

    /// 滑块上那颗带页码的圆角标签。两张图（常态 + 按下）都是带阴影的离屏光栅化，
    /// 而 `updateProgress` 在一次翻页里会被调三遍（`beginTransition`、`moveCard`、
    /// `finishTransition`），等于每翻一张卡就画六次——文字没变就别重画。
    ///
    /// 再缓存最近几页的结果：来回翻页时文字会重复出现，翻回去就不必再画一遍。
    private func updateSliderThumb(text: String) {
        guard text != lastSliderThumbText else { return }
        lastSliderThumbText = text
        let accentColor = UIColor(red: 0.58, green: 0.50, blue: 0.86, alpha: 1)
        // `setThumbImage` 会让 UISlider 重建 thumb 视图。不关掉隐式动画的话，
        // 它正好撞上紧随其后的 `setValue(animated:)`，翻页时就看到滑块闪一下。
        UIView.performWithoutAnimation {
            for highlighted in [false, true] {
                let key = "\(text)|\(highlighted)" as NSString
                let image = sliderThumbCache.object(forKey: key)
                    ?? makeSliderThumbImage(text: text, accentColor: accentColor, isHighlighted: highlighted)
                sliderThumbCache.setObject(image, forKey: key)
                progressSlider.setThumbImage(image, for: highlighted ? .highlighted : .normal)
            }
            progressSlider.layoutIfNeeded()
        }
    }

    private var lastSliderThumbText: String?
    private let sliderThumbCache: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.countLimit = 40
        return cache
    }()

    private func makeSliderThumbImage(text: String, accentColor: UIColor, isHighlighted: Bool) -> UIImage {
        let size = CGSize(width: isHighlighted ? 68 : 62, height: isHighlighted ? 32 : 30)
        let canvasSize = CGSize(width: size.width + 8, height: size.height + 8)
        let renderer = UIGraphicsImageRenderer(size: canvasSize)
        return renderer.image { context in
            let rect = CGRect(
                x: (canvasSize.width - size.width) / 2,
                y: (canvasSize.height - size.height) / 2,
                width: size.width,
                height: size.height
            )

            context.cgContext.setShadow(
                offset: CGSize(width: 0, height: 3),
                blur: 6,
                color: UIColor.black.withAlphaComponent(0.12).cgColor
            )
            accentColor.setFill()
            UIBezierPath(roundedRect: rect, cornerRadius: rect.height / 2).fill()

            context.cgContext.setShadow(offset: .zero, blur: 0, color: nil)
            let attributes: [NSAttributedString.Key: Any] = [
                .font: MTAppFont.font(ofSize: 11, weight: .bold),
                .foregroundColor: UIColor.white
            ]
            let textSize = text.size(withAttributes: attributes)
            let textRect = CGRect(
                x: rect.midX - textSize.width / 2,
                y: rect.midY - textSize.height / 2,
                width: textSize.width,
                height: textSize.height
            )
            text.draw(in: textRect, withAttributes: attributes)
        }
    }

    // MARK: - Cards

    private func configureCard() {
        standbyCardView.alpha = 0
        standbyCardView.isHidden = true
        // 卡片必须沉在进度条和控制栏**下面**。它的底边虽然正好贴着进度条顶边，
        // 但转场动画里两张卡都会向下位移（进场 y:10、出场 y:28），一挪就压住
        // 滑块、动画结束又弹回来——看着就是「翻页时滑块闪一下」。
        // 这两句不能换成 addSubview：那样卡片会排在最上层。
        view.insertSubview(standbyCardView, at: 0)
        view.insertSubview(activeCardView, aboveSubview: standbyCardView)

        pinCard(standbyCardView)
        pinCard(activeCardView)
    }

    private func pinCard(_ cardView: MTLearningCardView, readingOnly: Bool = false) {
        cardView.snp.remakeConstraints { make in
            make.leading.trailing.equalToSuperview()
            make.top.equalTo(view.safeAreaLayoutGuide)
            if readingOnly {
                make.bottom.equalTo(view.safeAreaLayoutGuide)
            } else {
                make.bottom.equalTo(progressContainerView.snp.top)
            }
        }
    }

    private func configureControls() {
        playButton.addTarget(self, action: #selector(playButtonClick), for: .touchUpInside)
        orderButton.showsMenuAsPrimaryAction = true
        orderButton.changesSelectionAsPrimaryAction = false
        settingsButton.addTarget(self, action: #selector(settingsButtonClick), for: .touchUpInside)
        previousButton.addTarget(self, action: #selector(previousButtonClick), for: .touchUpInside)
        nextButton.addTarget(self, action: #selector(nextButtonClick), for: .touchUpInside)

        controlStackView.addArrangedSubview(orderButton)
        controlStackView.addArrangedSubview(previousButton)
        controlStackView.addArrangedSubview(playButton)
        controlStackView.addArrangedSubview(nextButton)
        controlStackView.addArrangedSubview(settingsButton)
        controlStackView.axis = .horizontal
        controlStackView.spacing = 18
        controlStackView.alignment = .center
        controlStackView.distribution = .equalSpacing
        view.addSubview(controlStackView)

        controlStackView.snp.makeConstraints { make in
            make.leading.equalToSuperview().inset(28)
            make.trailing.equalToSuperview().inset(28)
            make.bottom.equalTo(view.safeAreaLayoutGuide).inset(36)
        }

        updateOrderButtonIcon()
    }

    /// 左边缘保留给系统返回手势，其余区域的滑动都归卡片翻页
    private static let backGestureEdgeWidth: CGFloat = 44

    private func configureGesture() {
        let pageTapGesture = UITapGestureRecognizer(target: self, action: #selector(handleCardTap(_:)))
        pageTapGesture.cancelsTouchesInView = false
        pageTapGesture.delegate = self
        view.addGestureRecognizer(pageTapGesture)

        [activeCardView, standbyCardView].forEach {
            let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleCardTap(_:)))
            tapGesture.delegate = self
            $0.addGestureRecognizer(tapGesture)
        }

        // 按住卡片不动 = 「我卡在这个词上了」。这是难度判定的两个信号之一，
        // 所以给一次轻震动回执，让你知道这一下确实记上了。

        // 翻页手势挂在整个页面上，卡片外起手也能翻页
        let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        panGesture.delegate = self
        view.addGestureRecognizer(panGesture)
    }

    /// 上一次翻页是不是「往回翻」。往回翻的证据属于**回到的那张卡**——
    /// 你特地翻回去，是因为要看的那个没吃透，不是因为刚离开的那张难。
    private var didArriveByGoingBack = false

    private func renderCurrentCard(animated: Bool) {
        guard !displayDeck.isEmpty else { return }
        currentIndex = min(currentIndex, displayDeck.count - 1)
        let card = displayDeck[currentIndex]
        activeCardView.refreshView(with: card, contentMode: contentMode)
        activeCardView.hideScoreBadge()
        applyMeaningVisibility(to: activeCardView)
        scheduleMeaningReveal()
        updateProgress(animated: animated)
    }

    // MARK: - Review mode (释义渐显)

    private var isReviewModeActive: Bool {
        !isLandscapeReadingMode && MTAutoplaySettings.isReviewModeEnabled(for: deckDirectoryURL)
    }

    /// 换卡时按复习模式决定释义先藏还是直接显示。
    private func applyMeaningVisibility(to cardView: MTLearningCardView) {
        if isReviewModeActive {
            cardView.hideMeaning()
        } else {
            cardView.showMeaningImmediately()
        }
    }

    /// 复习模式下，为当前卡片安排"释义到点淡入"；非复习模式直接作废定时。
    private func scheduleMeaningReveal() {
        revealTimer?.invalidate()
        revealTimer = nil
        guard isReviewModeActive else { return }
        let delay = MTAutoplaySettings.revealDelay(for: deckDirectoryURL)
        let timer = Timer(timeInterval: max(delay, 0.05), repeats: false) { [weak self] _ in
            guard let self else { return }
            self.revealTimer = nil
            self.activeCardView.revealMeaning()
        }
        revealTimer = timer
        RunLoop.main.add(timer, forMode: .common)
    }

    private func updateProgress(animated: Bool) {
        updateProgress(for: currentIndex, animated: animated)
    }

    /// Lets the progress row preview the incoming card the instant a swipe
    /// commits, instead of waiting for the card-swap animation to finish.
    private func updateProgress(for index: Int, animated: Bool) {
        if audioProgressURL != nil {
            refreshAudioProgress()
            updatePlayButton()
            return
        }
        let progressText = "\(index + 1)/\(displayDeck.count)"
        updateSliderThumb(text: progressText)
        progressSlider.maximumValue = Float(max(displayDeck.count - 1, 0))
        // 值没变就别再 setValue：一次翻页里这个方法被调三次（beginTransition、
        // moveCard、finishTransition），后两次是同一个值，重复触发动画会让
        // 滑块又抖一下。
        if progressSlider.value != Float(index) {
            progressSlider.setValue(Float(index), animated: animated)
        }
        updatePlayButton()
    }

    // MARK: - Actions

    @objc private func playButtonClick() {
        isAutoplaying ? stopAutoplay() : startAutoplay()
    }

    private func selectContentMode(_ mode: MTStudyContentMode) {
        guard contentMode != mode else { return }
        contentMode = mode
        MTAutoplaySettings.setContentMode(mode, for: deckDirectoryURL)
        activeCardView.setContentMode(mode)
        standbyCardView.setContentMode(mode)
    }

    /// 进阶独立开关；关 = 刷全量。
    private func toggleFocusTier(_ level: Int) {
        let enabled = !focusTiers.contains(level)
        guard !enabled || hasCards(inTier: level) else { return }
        MTAutoplaySettings.setFocusTierEnabled(enabled, level: level, for: deckDirectoryURL)
        applyFocusTiers(enabledFocusTiers())
    }

    @objc private func settingsButtonClick() {
        let vc = MTStudySettingsViewController(
            deckDirectoryURL: deckDirectoryURL,
            hasFocusedCards: hasCards(inTier: 1)
        )
        vc.contentModeDidChange = { [weak self] mode in
            self?.selectContentMode(mode)
        }
        vc.focusModeDidChange = { [weak self] in
            self?.toggleFocusTier(1)
        }
        vc.intervalDidChange = { [weak self] in
            guard let self, self.isAutoplaying else { return }
            self.stopAutoplay()
            self.startAutoplay()
        }
        vc.reviewModeDidChange = { [weak self] in
            guard let self else { return }
            // 重新渲染当前卡片以套用/取消"释义先藏"，并按新节奏重启在放的自动播放
            self.renderCurrentCard(animated: false)
            if self.isAutoplaying {
                self.stopAutoplay()
                self.startAutoplay()
            }
        }
        vc.speechPlaybackDidChange = { [weak self] in
            guard let self, self.isAutoplaying else { return }
            self.stopAutoplay()
            self.startAutoplay()
        }
        if let sheet = vc.sheetPresentationController {
            sheet.detents = [.medium(), .large()]
            sheet.prefersGrabberVisible = true
            sheet.preferredCornerRadius = 20
            sheet.delegate = self
        }
        present(vc, animated: true)
    }

    /// 播放顺序从「点一下轮换」改成弹窗选单：只有两档时轮换还算直观，
    /// 但它不告诉你有哪些选项、当前是哪个，也没地方写「智能播放」到底在干什么。
    private func makeOrderMenu() -> UIMenu {
        let current = MTAutoplaySettings.playOrder(for: deckDirectoryURL)
        let actions = MTPlayOrder.allCases.map { order in
            UIAction(
                title: order.title,
                image: UIImage(systemName: order.iconName),
                state: order == current ? .on : .off
            ) { [weak self] _ in
                guard let self else { return }
                self.selectPlayOrder(order)
            }
        }
        return UIMenu(
            title: "播放顺序",
            options: [.displayInline, .singleSelection],
            children: actions
        )
    }

    private func selectPlayOrder(_ order: MTPlayOrder) {
        stopAutoplay()
        guard order != MTAutoplaySettings.playOrder(for: deckDirectoryURL) else { return }
        MTAutoplaySettings.setPlayOrder(order, for: deckDirectoryURL)
        updateOrderButtonIcon()
        rebuildDeckWithPlayOrder()
    }

    private func updateOrderButtonIcon() {
        let order = MTAutoplaySettings.playOrder(for: deckDirectoryURL)
        var config = orderButton.configuration ?? .plain()
        config.image = UIImage(systemName: order.iconName)
        orderButton.configuration = config
        orderButton.accessibilityLabel = "播放顺序"
        orderButton.accessibilityValue = order.title
        orderButton.menu = makeOrderMenu()
    }

    private func rebuildDeckWithPlayOrder() {
        stopAutoplay()
        prepareCardOrder { [weak self] in
            guard let self else { return }
            self.currentIndex = 0
            MTAutoplaySettings.clearProgressIndex(for: self.deckDirectoryURL)
            self.renderCurrentCard(animated: false)
        }
    }

    private func cancelOrderPreparation() {
        orderGeneration &+= 1
        orderTask?.cancel()
        orderTask = nil
    }

    private func prepareCardOrder(completion: @escaping () -> Void) {
        cancelOrderPreparation()
        let generation = orderGeneration
        let cards = configuration.cards
        let directory = deckDirectoryURL
        let order = MTAutoplaySettings.playOrder(for: directory)
        orderTask = Task { [weak self] in
            let prepared = await MTBackgroundWork.runCancellable {
                MTPreparedCardOrder(cards: MTAutoplaySettings.applyPlayOrder(order, to: cards, for: directory))
            }
            guard !Task.isCancelled, let prepared, let self, self.orderGeneration == generation else { return }
            self.orderTask = nil
            self.cardOrder = prepared
            self.focusTiers = self.enabledFocusTiers()
            completion()
        }
    }

    @objc private func previousButtonClick() {
        // 与手势滑动一致：手动切卡前先打断在播的语音/旧定时器，避免上一个词的音频拖到新卡片飞入动画结束才被打断
        pauseAutoplayForInteraction()
        showPreviousCard()
    }

    @objc private func nextButtonClick() {
        pauseAutoplayForInteraction()
        showNextCard()
    }

    @objc private func progressSliderValueChanged(_ sender: UISlider) {
        if let url = audioProgressURL {
            MTSpeechPlayer.shared.seek(url: url, to: TimeInterval(sender.value))
            updateSliderThumb(text: "\(Self.clockText(TimeInterval(sender.value)))/\(Self.clockText(TimeInterval(sender.maximumValue)))")
            return
        }
        stopAutoplay()
        guard !isTransitioning else {
            sender.setValue(Float(currentIndex), animated: true)
            return
        }

        let targetIndex = Int(round(sender.value))
        guard displayDeck.indices.contains(targetIndex) else { return }
        sender.setValue(Float(targetIndex), animated: false)

        guard targetIndex != currentIndex else {
            updateProgress(animated: false)
            return
        }

        jumpToCard(at: targetIndex)
    }


    /// 点击只查看 Obsidian 标记对应的分数；复习时仍可揭晓答案。
    /// 不加减分、不保存独立评分，也不打断当前朗读和自动播放。
    @objc private func handleCardTap(_ gesture: UITapGestureRecognizer) {
        guard gesture.state == .ended, !isTransitioning, orderTask == nil else { return }
        guard displayDeck.indices.contains(currentIndex) else { return }

        if isReviewModeActive {
            revealTimer?.invalidate()
            revealTimer = nil
            activeCardView.revealMeaning()
        }

        let card = displayDeck[currentIndex]
        activeCardView.flashScoreBadge(MTAutoplaySettings.score(for: card))
    }

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        guard !isTransitioning else { return }

        let translation = gesture.translation(in: view)
        let velocity = gesture.velocity(in: view)
        let rotation = translation.x / view.bounds.width * 0.18

        switch gesture.state {
        case .began:
            pauseAutoplayForInteraction()
        case .changed:
            activeCardView.transform = CGAffineTransform(translationX: translation.x, y: translation.y * 0.14)
                .rotated(by: rotation)
            activeCardView.updateSwipeHint(progress: -translation.x / 130)
        case .ended, .cancelled:
            let shouldMove = abs(translation.x) > 96 || abs(velocity.x) > 720
            guard shouldMove, displayDeck.count > 1 else {
                restoreCardPosition()
                resumeAutoplayAfterInteraction()
                return
            }

            // 左滑 / 上滑 ➔ 下一张（新卡从相反侧进场）；右滑 / 下滑 ➔ 上一张
            let direction = swipeDirection(translation: translation, velocity: velocity)
            if direction < 0 {
                showNextCard()
            } else {
                showPreviousCard()
            }
        default:
            break
        }
    }

    /// Advance with wraparound; 智能播放在一轮结束时按最新学习记录重排。
    private func showNextCard() {
        guard orderTask == nil else { return }
        if currentIndex >= displayDeck.count - 1 {
            if MTAutoplaySettings.playOrder(for: deckDirectoryURL) == .smart {
                prepareCardOrder { [weak self] in self?.moveCard(to: 0, exitDirection: 1) }
            } else {
                moveCard(to: 0, exitDirection: 1)
            }
        } else {
            moveCard(to: currentIndex + 1, exitDirection: 1)
        }
    }

    private func showPreviousCard() {
        cancelOrderPreparation()
        if currentIndex <= 0 {
            moveCard(to: displayDeck.count - 1, exitDirection: -1)
        } else {
            moveCard(to: currentIndex - 1, exitDirection: -1)
        }
    }

    private func moveCard(to nextIndex: Int,
                          exitDirection: CGFloat) {
        guard beginTransition(), !displayDeck.isEmpty else { return }
        didArriveByGoingBack = exitDirection < 0

        guard displayDeck.indices.contains(nextIndex), nextIndex != currentIndex else {
            finishTransition()
            restoreCardPosition()
            return
        }

        let outgoingCard = activeCardView
        let incomingCard = standbyCardView
        incomingCard.refreshView(with: displayDeck[nextIndex], contentMode: contentMode)
        incomingCard.hideScoreBadge()
        applyMeaningVisibility(to: incomingCard)
        updateProgress(for: nextIndex, animated: true)
        // 标题跟着进场的卡片换：翻页和自动播放都只走这里，不经过
        // renderCurrentCard，漏掉就会一直停在进卡组时那张卡的表头。
        incomingCard.isHidden = false
        incomingCard.alpha = 0
        incomingCard.transform = CGAffineTransform(translationX: exitDirection * 64, y: 10)
            .scaledBy(x: 0.92, y: 0.92)
        view.insertSubview(incomingCard, belowSubview: outgoingCard)

        // Outgoing card keeps flying along the swipe direction until fully
        // off-screen (continuing the drag rotation); incoming settles in
        // from the opposite side with a spring
        let flyDistance = view.bounds.width * 1.15
        UIView.animate(withDuration: 0.45, delay: 0,
                       usingSpringWithDamping: 0.82, initialSpringVelocity: 0.6,
                       options: [.curveEaseOut, .allowUserInteraction]) {
            outgoingCard.transform = CGAffineTransform(translationX: -exitDirection * flyDistance, y: 28)
                .rotated(by: -exitDirection * 0.12)
            incomingCard.transform = .identity
            incomingCard.alpha = 1
        } completion: { [weak self] _ in
            guard let self else { return }
            outgoingCard.alpha = 1
            outgoingCard.transform = .identity
            self.currentIndex = nextIndex
            MTAutoplaySettings.setProgressIndex(self.currentIndex, for: self.deckDirectoryURL)
            swap(&self.activeCardView, &self.standbyCardView)
            self.view.insertSubview(self.activeCardView, aboveSubview: self.standbyCardView)
            self.standbyCardView.isHidden = true
            self.standbyCardView.alpha = 0
            self.standbyCardView.transform = .identity
            self.standbyCardView.updateSwipeHint(progress: 0)
            self.activeCardView.updateSwipeHint(progress: 0)
            self.finishTransition()
        }
    }

    private func jumpToCard(at index: Int) {
        cancelOrderPreparation()
        currentIndex = index
        MTAutoplaySettings.setProgressIndex(currentIndex, for: deckDirectoryURL)

        standbyCardView.isHidden = true
        standbyCardView.alpha = 0
        standbyCardView.transform = .identity
        activeCardView.transform = .identity
        activeCardView.alpha = 1
        activeCardView.updateSwipeHint(progress: 0)
        renderCurrentCard(animated: false)
    }

    // MARK: - Loop

    // MARK: - Autoplay

    private func startAutoplay() {
        guard !displayDeck.isEmpty else { return }
        // 整轮按住音频会话，卡间停顿才不会让 App 在后台被挂起（锁屏继续念靠这个）。
        MTSpeechPlayer.shared.keepsSessionActiveBetweenCards = true
        isAutoplaying = true
        updatePlayButton()
        scheduleNextAdvance()
    }

    /// 当前卡片就位后安排"下一张"：
    /// - 按当前模式（短语模式/单词模式）朗读，读完停 gap 秒再翻；另设安全超时防止发音异常卡死。
    /// 每次调用都自增 generation，任何在途的旧回调/旧定时都作废。
    private func scheduleNextAdvance() {
        guard isAutoplaying, displayDeck.indices.contains(currentIndex) else { return }
        autoplayGeneration &+= 1
        let generation = autoplayGeneration
        let gap = MTAutoplaySettings.interval(for: deckDirectoryURL)

        // 复习模式：先给回忆时间（释义按 revealTimer 自行淡入），
        // 前进时机 = 渐显延迟 + gap（读完/看完释义后再停 gap 秒），发音在开头读。
        if isReviewModeActive {
            let reveal = MTAutoplaySettings.revealDelay(for: deckDirectoryURL)
            let startedAt = Date()
            let card = displayDeck[currentIndex]
            scheduleSpeechSafetyTimer(generation: generation, card: card, minimumDelay: reveal + gap)
            MTSpeechPlayer.shared.speak(
                meaningUnit: card.meaningUnit,
                word: card.word,
                contentMode: contentMode,
                audioIndex: audioLibrary.index(for: card)
            ) { [weak self] in
                guard let self, self.isAutoplaying, generation == self.autoplayGeneration else { return }
                let elapsed = Date().timeIntervalSince(startedAt)
                self.scheduleAutoplayTimer(after: max(0, reveal - elapsed) + gap) { [weak self] in
                    guard let self else { return }
                    self.finishCurrentCard(generation)
                }
            }
            return
        }

        // 安全兜底：万一发音不触发完成回调，也不会卡在一张不动
        let card = displayDeck[currentIndex]
        scheduleSpeechSafetyTimer(generation: generation, card: card)
        MTSpeechPlayer.shared.speak(
            meaningUnit: card.meaningUnit,
            word: card.word,
            contentMode: contentMode,
            audioIndex: audioLibrary.index(for: card)
        ) { [weak self] in
            guard let self, self.isAutoplaying, generation == self.autoplayGeneration else { return }
            if self.audioProgressURL != nil {
                self.stopAutoplay()
                self.progressSlider.setValue(0, animated: false)
                self.refreshAudioProgress()
                return
            }
            self.scheduleAutoplayTimer(after: gap) { [weak self] in
                guard let self else { return }
                self.finishCurrentCard(generation)
            }
        }
    }

    /// 安全兜底时长按本张卡实际启用的朗读段数估算，避免还没读完就被强制翻页。
    private func scheduleSpeechSafetyTimer(generation: Int,
                                           card: MTLearningStudyCard,
                                           minimumDelay: TimeInterval = 0) {
        // 整篇长音频(进度条显示音频进度的卡组)靠播放完成回调推进。20 秒的估算
        // 会在中途把唯一的一张卡翻回自己, 表现为读着读着从头重播。
        if audioProgressURL != nil { return }
        let urls = MTSpeechPlayer.audioURLs(
            meaningUnit: card.meaningUnit, word: card.word,
            contentMode: contentMode, audioIndex: audioLibrary.index(for: card)
        )
        let timeout = max(minimumDelay, Self.speechSafetyTimeoutPerLocalAudioItem * TimeInterval(max(1, urls.count)))
        scheduleAutoplayTimer(after: timeout) { [weak self] in
            guard let self else { return }
            self.finishCurrentCard(generation)
        }
    }

    private func finishCurrentCard(_ generation: Int) {
        guard isAutoplaying, generation == autoplayGeneration, !isTransitioning else { return }
        showNextCard()
    }

    private func stopAutoplay() {
        cancelOrderPreparation()
        MTSpeechPlayer.shared.keepsSessionActiveBetweenCards = false
        autoplayTimer?.invalidate()
        autoplayTimer = nil
        autoplayGeneration &+= 1   // 作废任何在途的发音完成回调
        isAutoplaying = false
        if audioProgressURL != nil {
            MTSpeechPlayer.shared.pauseRememberingPosition()
        } else {
            MTSpeechPlayer.shared.stop()
        }
        updatePlayButton()
    }

    private func scheduleAutoplayTimer(after interval: TimeInterval, _ handler: @escaping () -> Void) {
        autoplayTimer?.invalidate()
        let timer = Timer(timeInterval: max(interval, 0.05), repeats: false) { [weak self] _ in
            guard let self else { return }
            self.autoplayTimer = nil
            handler()
        }
        autoplayTimer = timer
        RunLoop.main.add(timer, forMode: .common)
    }

    /// 手指拖动卡片时冻结节奏：停掉定时与发音，作废在途回调。
    private func pauseAutoplayForInteraction() {
        guard isAutoplaying else { return }
        autoplayTimer?.invalidate()
        autoplayTimer = nil
        autoplayGeneration &+= 1
        MTSpeechPlayer.shared.stop()
    }

    /// 拖动没翻页（弹回原位）时，重新为当前卡片安排节奏（会重读一遍）。
    private func resumeAutoplayAfterInteraction() {
        guard isAutoplaying else { return }
        scheduleNextAdvance()
    }

    private func updatePlayButton() {
        var configuration = playButton.configuration ?? UIButton.Configuration.plain()
        configuration.image = UIImage(systemName: isAutoplaying ? "pause.fill" : "play.fill")
        configuration.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(pointSize: 22, weight: .semibold)
        playButton.configuration = configuration
        playButton.accessibilityLabel = isAutoplaying ? "停止自动播放" : "自动播放"
    }

    private func restoreCardPosition() {
        UIView.animate(withDuration: 0.36, delay: 0, usingSpringWithDamping: 0.76, initialSpringVelocity: 0.75, options: [.curveEaseOut]) {
            self.activeCardView.transform = .identity
            self.activeCardView.updateSwipeHint(progress: 0)
        }
    }

    private func swipeDirection(translation: CGPoint, velocity: CGPoint) -> CGFloat {
        let dominantHorizontalValue = abs(translation.x) > 24 ? translation.x : velocity.x
        return dominantHorizontalValue >= 0 ? 1 : -1
    }

    private func beginTransition() -> Bool {
        guard !isTransitioning else { return false }
        // Switching cards always owns the speech lifecycle. Cancel every
        // queued repeat of the old word immediately, even outside autoplay.
        MTSpeechPlayer.shared.stop()
        isTransitioning = true
        activeCardView.isUserInteractionEnabled = false
        standbyCardView.isUserInteractionEnabled = false
        updateProgress(animated: false)
        return true
    }

    private func finishTransition() {
        isTransitioning = false
        activeCardView.isUserInteractionEnabled = true
        standbyCardView.isUserInteractionEnabled = false
        updateProgress(animated: true)
        startCurrentCardCycle()
    }

    /// 一张卡上屏之后该发生的事：复习揭晓计时、朗读、自动播放的下一跳。
    private func startCurrentCardCycle() {
        scheduleMeaningReveal()
        if isAutoplaying {
            scheduleNextAdvance()
        } else if !isLandscapeReadingMode,
                  displayDeck.indices.contains(currentIndex) {
            // 手动翻页：新卡出现就读一遍，但不阻塞继续翻
            let card = displayDeck[currentIndex]
            MTSpeechPlayer.shared.speak(
                meaningUnit: card.meaningUnit,
                word: card.word,
                contentMode: contentMode,
                audioIndex: audioLibrary.index(for: card)
            )
        }
    }
}

extension MTLearningCardsViewController: UIGestureRecognizerDelegate {
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        // 控制栏和进度条区域不参与卡片手势
        if touch.view?.isDescendant(of: controlStackView) == true ||
            touch.view?.isDescendant(of: progressContainerView) == true {
            return false
        }

        guard gestureRecognizer is UITapGestureRecognizer else {
            return true
        }

        let location = touch.location(in: view)
        return activeCardView.frame.contains(location) || standbyCardView.frame.contains(location)
    }

    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        guard let panGesture = gestureRecognizer as? UIPanGestureRecognizer else {
            return true
        }
        // 左边缘 44pt 以内起手的滑动让给系统返回手势
        return panGesture.location(in: view).x > Self.backGestureEdgeWidth
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        // 长按只是个标记动作，不该挡住翻页：按住想了一会儿再滑走是最常见的路径，
        // 不放行的话长按一旦成立，这一滑就翻不动了。
        false
    }
}

extension MTLearningCardsViewController {
    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        refreshFocusState()
    }
}

//
//  MTStudySettingsViewController.swift
//  Memory
//
//  Created by GPT-5.5 on 5/7/26.
//

import UIKit
import SnapKit

final class MTStudySettingsViewController: UITableViewController {

    private let deckDirectoryURL: URL?
    private let hasFocusedCards: Bool
    var contentModeDidChange: ((MTStudyContentMode) -> Void)?
    var focusModeDidChange: (() -> Void)?
    var intervalDidChange: (() -> Void)?
    var reviewModeDidChange: (() -> Void)?
    var speechPlaybackDidChange: (() -> Void)?

    private enum Section: Int, CaseIterable {
        case content
        case focus
        case autoplay
        case voice
        case review
    }


    init(deckDirectoryURL: URL?, hasFocusedCards: Bool) {
        self.deckDirectoryURL = deckDirectoryURL
        self.hasFocusedCards = hasFocusedCards
        super.init(style: .insetGrouped)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .light
        title = "学习设置"
        navigationItem.largeTitleDisplayMode = .always
        navigationController?.navigationBar.prefersLargeTitles = true
        tableView.backgroundColor = .systemGroupedBackground
        tableView.rowHeight = UITableView.automaticDimension
        tableView.estimatedRowHeight = 60
        tableView.sectionFooterHeight = .leastNormalMagnitude
        tableView.estimatedSectionFooterHeight = 0
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "cell")
        tableView.register(MTSettingsSliderCell.self, forCellReuseIdentifier: MTSettingsSliderCell.reuseIdentifier)
        tableView.register(MTSettingsSwitchCell.self, forCellReuseIdentifier: MTSettingsSwitchCell.reuseIdentifier)
    }

    // MARK: - Sections

    override func numberOfSections(in tableView: UITableView) -> Int { Section.allCases.count }

    override func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        switch Section(rawValue: section) {
        case .content: return "内容模式"
        case .focus: return "学习范围"
        case .autoplay: return "自动播放"
        case .review: return "复习模式"
        case .voice: return "发音"
        default: return nil
        }
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        switch Section(rawValue: section) {
        case .content: return MTStudyContentMode.allCases.count
        // 发音人和语速跟随当前模式固定显示。
        case .voice: return 1
        // 释义渐显延迟只在复习模式开启时出现（带插入/删除动画）
        case .review: return MTAutoplaySettings.isReviewModeEnabled(for: deckDirectoryURL) ? 2 : 1
        default: return 1
        }
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        switch Section(rawValue: indexPath.section) {
        case .content:
            let cell = tableView.dequeueReusableCell(withIdentifier: "cell", for: indexPath)
            let mode = MTStudyContentMode.allCases[indexPath.row]
            var configuration = cell.defaultContentConfiguration()
            configuration.text = mode.title
            configuration.textProperties.font = MTAppFont.font(ofSize: 17)
            cell.contentConfiguration = configuration
            cell.accessoryType = mode == MTAutoplaySettings.contentMode(for: deckDirectoryURL) ? .checkmark : .none
            return cell
        case .focus:
            guard let cell = tableView.dequeueReusableCell(
                withIdentifier: MTSettingsSwitchCell.reuseIdentifier, for: indexPath
            ) as? MTSettingsSwitchCell else { return UITableViewCell() }
            cell.refreshView(
                title: "进阶模式",
                isOn: hasFocusedCards && MTAutoplaySettings.isFocusTierEnabled(1, for: deckDirectoryURL),
                isEnabled: hasFocusedCards
            )
            cell.valueChanged = { [weak self] _ in self?.focusModeDidChange?() }
            return cell
        case .autoplay:
            guard let cell = tableView.dequeueReusableCell(
                withIdentifier: MTSettingsSliderCell.reuseIdentifier, for: indexPath
            ) as? MTSettingsSliderCell else { return UITableViewCell() }
            let currentInterval = MTAutoplaySettings.interval(for: deckDirectoryURL)
            let reviewMode = MTAutoplaySettings.isReviewModeEnabled(for: deckDirectoryURL)
            let intervalTitle = reviewMode ? "释义后停顿" : "读完后停顿"
            cell.refreshView(
                title: intervalTitle,
                valueText: MTAutoplaySettings.displayText(for: currentInterval),
                minimumValue: Float(MTAutoplaySettings.minimumInterval),
                maximumValue: Float(MTAutoplaySettings.maximumInterval),
                value: Float(currentInterval)
            )
            cell.valueChanged = { [weak cell, weak self] value in
                guard let self else { return }
                let interval = TimeInterval(value)
                MTAutoplaySettings.setInterval(interval, for: self.deckDirectoryURL)
                cell?.refreshValueText(MTAutoplaySettings.displayText(for: interval))
                self.intervalDidChange?()
            }
            return cell

        case .review:
            if indexPath.row == 0 {
                guard let cell = tableView.dequeueReusableCell(
                    withIdentifier: MTSettingsSwitchCell.reuseIdentifier, for: indexPath
                ) as? MTSettingsSwitchCell else { return UITableViewCell() }
                cell.refreshView(
                    title: "复习模式",
                    isOn: MTAutoplaySettings.isReviewModeEnabled(for: deckDirectoryURL),
                    isEnabled: true
                )
                cell.valueChanged = { [weak self, weak tableView] isOn in
                    guard let self, let tableView else { return }
                    MTAutoplaySettings.setReviewModeEnabled(isOn, for: self.deckDirectoryURL)
                    self.reviewModeDidChange?()
                    // 状态已改变数据源行数，整段刷新可避免逐行更新重复计算行数。
                    tableView.reloadSections(
                        IndexSet([Section.review.rawValue, Section.autoplay.rawValue]),
                        with: .fade
                    )
                }
                return cell
            }
            guard let cell = tableView.dequeueReusableCell(
                withIdentifier: MTSettingsSliderCell.reuseIdentifier, for: indexPath
            ) as? MTSettingsSliderCell else { return UITableViewCell() }
            let delay = MTAutoplaySettings.revealDelay(for: deckDirectoryURL)
            cell.refreshView(
                title: "释义渐显延迟",
                valueText: MTAutoplaySettings.revealDelayText(for: delay),
                minimumValue: Float(MTAutoplaySettings.minimumRevealDelay),
                maximumValue: Float(MTAutoplaySettings.maximumRevealDelay),
                value: Float(delay)
            )
            cell.valueChanged = { [weak cell, weak self] value in
                guard let self else { return }
                let delay = TimeInterval(value)
                MTAutoplaySettings.setRevealDelay(delay, for: self.deckDirectoryURL)
                cell?.refreshValueText(MTAutoplaySettings.revealDelayText(for: delay))
                self.intervalDidChange?()   // 复习模式下前进时机 = 渐显延迟 + 停顿
            }
            return cell

        case .voice:
            guard let cell = tableView.dequeueReusableCell(
                withIdentifier: MTSettingsSwitchCell.reuseIdentifier, for: indexPath
            ) as? MTSettingsSwitchCell else { return UITableViewCell() }
            cell.refreshView(
                title: "播放发音",
                isOn: MTAutoplaySettings.isSpeechPlaybackEnabled(),
                isEnabled: true
            )
            cell.valueChanged = { [weak self] isOn in
                MTAutoplaySettings.setSpeechPlaybackEnabled(isOn)
                if !isOn { MTSpeechPlayer.shared.stop() }
                self?.speechPlaybackDidChange?()
            }
            return cell

        default:
            return UITableViewCell()
        }
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        guard Section(rawValue: indexPath.section) == .content else { return }
        let mode = MTStudyContentMode.allCases[indexPath.row]
        contentModeDidChange?(mode)
        tableView.reloadSections(IndexSet(integer: Section.content.rawValue), with: .none)
    }

}

private final class MTSettingsSliderCell: UITableViewCell {
    static let reuseIdentifier = "MTSettingsSliderCell"

    var valueChanged: ((Float) -> Void)?

    private let titleLabel = UILabel()
    private let valueLabel = UILabel()
    private let slider = UISlider()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        selectionStyle = .none
        backgroundColor = .secondarySystemGroupedBackground

        titleLabel.font = MTAppFont.font(ofSize: 17)
        titleLabel.textColor = .label
        titleLabel.numberOfLines = 0

        valueLabel.font = MTAppFont.font(ofSize: 16)
        valueLabel.textColor = .secondaryLabel
        valueLabel.textAlignment = .right
        valueLabel.setContentCompressionResistancePriority(.required, for: .horizontal)

        slider.minimumTrackTintColor = UIColor(red: 0.58, green: 0.50, blue: 0.86, alpha: 1)
        slider.maximumTrackTintColor = .systemGray5
        slider.thumbTintColor = UIColor(red: 0.58, green: 0.50, blue: 0.86, alpha: 1)
        slider.addTarget(self, action: #selector(sliderValueChanged), for: .valueChanged)

        [titleLabel, valueLabel, slider].forEach { contentView.addSubview($0) }

        titleLabel.snp.makeConstraints { make in
            make.top.equalToSuperview().offset(14)
            make.leading.equalToSuperview().offset(20)
        }
        valueLabel.snp.makeConstraints { make in
            make.centerY.equalTo(titleLabel)
            make.leading.greaterThanOrEqualTo(titleLabel.snp.trailing).offset(12)
            make.trailing.equalToSuperview().inset(20)
        }
        slider.snp.makeConstraints { make in
            make.top.equalTo(titleLabel.snp.bottom).offset(12)
            make.leading.trailing.equalToSuperview().inset(20)
            make.bottom.equalToSuperview().inset(14)
        }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func prepareForReuse() {
        super.prepareForReuse()
        valueChanged = nil
    }

    func refreshView(title: String, valueText: String, minimumValue: Float, maximumValue: Float, value: Float) {
        titleLabel.text = title
        valueLabel.text = valueText
        slider.minimumValue = minimumValue
        slider.maximumValue = maximumValue
        slider.value = value
    }

    func refreshValueText(_ text: String) { valueLabel.text = text }

    @objc private func sliderValueChanged(_ sender: UISlider) { valueChanged?(sender.value) }
}

private final class MTSettingsSwitchCell: UITableViewCell {
    static let reuseIdentifier = "MTSettingsSwitchCell"

    var valueChanged: ((Bool) -> Void)?

    private let titleLabel = UILabel()
    private let toggleSwitch = UISwitch()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        selectionStyle = .none
        backgroundColor = .secondarySystemGroupedBackground

        titleLabel.font = MTAppFont.font(ofSize: 17)
        titleLabel.numberOfLines = 0

        toggleSwitch.onTintColor = UIColor(red: 0.58, green: 0.50, blue: 0.86, alpha: 1)
        toggleSwitch.addTarget(self, action: #selector(switchValueChanged), for: .valueChanged)

        [titleLabel, toggleSwitch].forEach { contentView.addSubview($0) }

        titleLabel.snp.makeConstraints { make in
            make.centerY.equalToSuperview()
            make.leading.equalToSuperview().offset(20)
            make.top.greaterThanOrEqualToSuperview().offset(12)
            make.bottom.lessThanOrEqualToSuperview().inset(12)
        }
        toggleSwitch.snp.makeConstraints { make in
            make.centerY.equalToSuperview()
            make.leading.greaterThanOrEqualTo(titleLabel.snp.trailing).offset(12)
            make.trailing.equalToSuperview().inset(20)
            make.top.greaterThanOrEqualToSuperview().offset(10)
            make.bottom.lessThanOrEqualToSuperview().inset(10)
        }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func prepareForReuse() {
        super.prepareForReuse()
        valueChanged = nil
    }

    func refreshView(title: String, isOn: Bool, isEnabled: Bool) {
        titleLabel.text = title
        titleLabel.textColor = isEnabled ? .label : .tertiaryLabel
        toggleSwitch.isOn = isOn
        toggleSwitch.isEnabled = isEnabled
    }

    @objc private func switchValueChanged(_ sender: UISwitch) { valueChanged?(sender.isOn) }
}

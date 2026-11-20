//
//  MTIconControlButton.swift
//  Memory
//
//  Created by GPT-5.5 on 5/3/26.
//

import UIKit
import SnapKit

final class MTIconControlButton: UIButton {

    // MARK: data property

    private let diameter: CGFloat
    private let systemName: String
    private let iconTintColor: UIColor
    private let accessibilityTitle: String

    // MARK: setup

    init(systemName: String, tintColor: UIColor, accessibilityTitle: String, diameter: CGFloat = 56) {
        self.diameter = diameter
        self.systemName = systemName
        self.iconTintColor = tintColor
        self.accessibilityTitle = accessibilityTitle
        super.init(frame: .zero)
        setupSubviews()
        setupViewConstraints()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var isEnabled: Bool {
        didSet {
            alpha = isEnabled ? 1 : 0.28
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        layer.cornerRadius = min(bounds.width, bounds.height) / 2
        layer.shadowPath = UIBezierPath(ovalIn: bounds).cgPath
    }

    private func setupSubviews() {
        accessibilityLabel = accessibilityTitle
        tintColor = iconTintColor

        var configuration = UIButton.Configuration.plain()
        configuration.image = UIImage(systemName: systemName)
        configuration.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(pointSize: 22, weight: .semibold)
        configuration.contentInsets = NSDirectionalEdgeInsets(top: 16, leading: 16, bottom: 16, trailing: 16)
        self.configuration = configuration

        backgroundColor = UIColor.white.withAlphaComponent(0.98)
        layer.cornerCurve = .continuous
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.13
        layer.shadowRadius = 18
        layer.shadowOffset = CGSize(width: 0, height: 12)
    }

    private func setupViewConstraints() {
        snp.makeConstraints { make in
            make.size.equalTo(diameter)
        }
    }

    // MARK: private methods

    // MARK: action

    // MARK: refresh

    // MARK: getter lazy view
}

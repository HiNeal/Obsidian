import UIKit

/// App 内统一使用随包分发的 Maple Mono NF CN，覆盖中英文与音标。
enum MTAppFont {
    static let boldName = "MapleMono-NF-CN-Bold"
    private struct FontKey: Hashable {
        let name: String
        let size: CGFloat
    }
    private static var fonts: [FontKey: UIFont] = [:]

    static func font(ofSize size: CGFloat, weight: UIFont.Weight = .regular) -> UIFont {
        let name: String
        if weight <= .regular {
            name = "MapleMono-NF-CN-Regular"
        } else if weight <= .medium {
            name = "MapleMono-NF-CN-Medium"
        } else {
            name = boldName
        }
        let key = FontKey(name: name, size: size)
        if let cached = fonts[key] { return cached }
        let font = UIFont(name: name, size: size) ?? UIFont.systemFont(ofSize: size, weight: weight)
        fonts[key] = font
        return font
    }

    static func configureAppearance() {
        UILabel.appearance().font = font(ofSize: 17)
        UINavigationBar.appearance().titleTextAttributes = [
            .font: font(ofSize: 17, weight: .semibold)
        ]
        UINavigationBar.appearance().largeTitleTextAttributes = [
            .font: font(ofSize: 34, weight: .bold)
        ]
        for state: UIControl.State in [.normal, .highlighted, .disabled, .focused] {
            UIBarButtonItem.appearance().setTitleTextAttributes([
                .font: font(ofSize: 17)
            ], for: state)
        }
    }
}

//
//  ShareViewController.swift
//  MemoryShareExtension
//
//  Created by Claude on 5/16/26.
//

import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.96, green: 0.96, blue: 0.99, alpha: 1)
        handleSharedFile()
    }

    private func handleSharedFile() {
        guard let extensionContext,
              let item = extensionContext.inputItems.first as? NSExtensionItem,
              let attachments = item.attachments else {
            completeRequest()
            return
        }

        let supportedTypes = [
            UTType(filenameExtension: "md"),
            UTType(filenameExtension: "md"),
            UTType(filenameExtension: "txt"),
            UTType.plainText
        ].compactMap { $0 }

        for provider in attachments {
            for type in supportedTypes {
                guard provider.hasItemConformingToTypeIdentifier(type.identifier) else { continue }

                provider.loadFileRepresentation(forTypeIdentifier: type.identifier) { [weak self] url, error in
                    guard let self, let url, error == nil else {
                        DispatchQueue.main.async { [weak self] in
                            guard let self else { return }
                            self.completeRequest()
                        }
                        return
                    }

                    let containerURL = FileManager.default.containerURL(
                        forSecurityApplicationGroupIdentifier: "group.com.oyca168.www.Memory"
                    )
                    let destURL = (containerURL ?? FileManager.default.temporaryDirectory)
                        .appendingPathComponent("Shared")
                    try? FileManager.default.createDirectory(at: destURL, withIntermediateDirectories: true)
                    let targetURL = destURL.appendingPathComponent(url.lastPathComponent)
                    try? FileManager.default.removeItem(at: targetURL)
                    try? FileManager.default.copyItem(at: url, to: targetURL)

                    DispatchQueue.main.async { [weak self] in
                        guard let self else { return }
                        self.completeRequest()
                    }
                }
                return
            }
        }
        completeRequest()
    }

    private func completeRequest() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}

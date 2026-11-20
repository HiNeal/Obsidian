//
//  SceneDelegate.swift
//  Memory
//
//  Created by oyca168 on 5/3/26.
//

import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = UINavigationController(
            rootViewController: MTCardLibraryViewController()
        )
        window.makeKeyAndVisible()
        self.window = window
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        var taskID = UIBackgroundTaskIdentifier.invalid
        taskID = UIApplication.shared.beginBackgroundTask {
            if taskID != .invalid {
                UIApplication.shared.endBackgroundTask(taskID)
                taskID = .invalid
            }
        }
        Task {
            await MTBackgroundWork.run { MTAutoplaySettings.syncStores() }
            if taskID != .invalid {
                UIApplication.shared.endBackgroundTask(taskID)
                taskID = .invalid
            }
        }
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        Task {
            await MTBackgroundWork.run { MTCardManager.importPendingSharedFiles() }
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let context = URLContexts.first else { return }
        let url = context.url
        Task {
            await MTBackgroundWork.run { MTCardManager.importFileToRoot(from: url) }
        }
    }
}

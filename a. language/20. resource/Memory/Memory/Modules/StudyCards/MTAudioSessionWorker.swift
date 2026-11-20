import AVFoundation

/// 会话状态只在 audio 队列访问，避免主线程与后台共享可变的配置标志。
nonisolated final class MTAudioSessionWorker: @unchecked Sendable {
    private let queue = DispatchQueue(label: "com.oyca168.www.Memory.audio-session", qos: .userInitiated)
    private var hasConfiguredCategory = false

    private func configureCategoryIfNeeded() {
        guard !hasConfiguredCategory else { return }
        do {
            try AVAudioSession.sharedInstance().setCategory(
                .playback, mode: .spokenAudio, options: [.mixWithOthers, .duckOthers]
            )
            hasConfiguredCategory = true
        } catch { }
    }

    func activate() {
        queue.async { [self] in
            configureCategoryIfNeeded()
            try? AVAudioSession.sharedInstance().setActive(true)
        }
    }

    func deactivate() {
        queue.async {
            try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        }
    }

    func invalidateCategory() {
        queue.async { [self] in hasConfiguredCategory = false }
    }

    func prepareFile(at url: URL, completion: @escaping @Sendable (AVAudioPlayer?) -> Void) {
        queue.async { [self] in
            configureCategoryIfNeeded()
            guard let player = try? AVAudioPlayer(contentsOf: url), player.prepareToPlay() else {
                completion(nil)
                return
            }
            completion(player)
        }
    }

}

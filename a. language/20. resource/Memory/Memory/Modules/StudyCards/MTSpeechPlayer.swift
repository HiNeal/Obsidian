import AVFoundation
import UIKit

/// 只播放当前卡组 audio/ 内的本地文件。缺失或损坏时跳过, 不合成语音, 不朗读释义。
final class MTSpeechPlayer: NSObject {
    static let shared = MTSpeechPlayer()

    private var hasConfiguredSession = false
    private var speechGeneration = 0
    private static let repeatInterval: TimeInterval = 1.0
    private var audioPlayer: AVAudioPlayer?
    private var audioCompletion: (() -> Void)?
    private let sessionWorker = MTAudioSessionWorker()
    /// 长音频暂停/拖动后再播时的起点, 只对同一个文件生效, 用过即清。
    private var pendingStart: (url: URL, time: TimeInterval)?
    private var currentAudioURL: URL?

    /// 正在播放的音频位置与总长, 供进度条使用; 没在播放时为 nil。
    var playbackPosition: (url: URL, time: TimeInterval, duration: TimeInterval)? {
        guard let audioPlayer, let currentAudioURL else { return nil }
        return (currentAudioURL, audioPlayer.currentTime, audioPlayer.duration)
    }

    /// 播放中直接跳转; 没在播放则记下起点, 下次播放该文件时从这里开始。
    func seek(url: URL, to time: TimeInterval) {
        if let audioPlayer, currentAudioURL == url {
            audioPlayer.currentTime = max(0, min(time, audioPlayer.duration))
        } else {
            pendingStart = (url, time)
        }
    }

    /// 暂停: 停止播放但记住当前位置。
    func pauseRememberingPosition() {
        if let position = playbackPosition { pendingStart = (position.url, position.time) }
        stop()
    }

    private override init() {
        super.init()
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(handleSessionInvalidated),
                           name: AVAudioSession.interruptionNotification, object: nil)
        center.addObserver(self, selector: #selector(handleSessionInvalidated),
                           name: UIApplication.didBecomeActiveNotification, object: nil)
        center.addObserver(self, selector: #selector(handleMediaServicesReset),
                           name: AVAudioSession.mediaServicesWereResetNotification, object: nil)
    }

    @objc private func handleSessionInvalidated() { hasConfiguredSession = false }

    @objc private func handleMediaServicesReset() {
        hasConfiguredSession = false
        sessionWorker.invalidateCategory()
    }

    /// 播放队列和自动翻页时长共用同一清单, 只计入实际存在的本地文件。
    static func audioURLs(meaningUnit: String, word: String,
                          contentMode: MTStudyContentMode,
                          audioIndex: MTDeckAudioIndex?) -> [URL] {
        guard let audioIndex else { return [] }
        var texts: [String] = []
        if contentMode == .meaningUnit { texts.append(meaningUnit) }
        texts.append(word)
        return texts.compactMap { text in
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : audioIndex.audioURL(for: trimmed)
        }
    }

    /// 单词模式只播词头; 短语模式按「短语 → 词头」播放。下方释义不进入队列。
    func speak(meaningUnit: String, word: String,
               contentMode: MTStudyContentMode,
               audioIndex: MTDeckAudioIndex? = nil,
               onFinish: (() -> Void)? = nil) {
        stop()
        guard MTAutoplaySettings.isSpeechPlaybackEnabled() else { onFinish?(); return }
        let urls = Self.audioURLs(meaningUnit: meaningUnit, word: word,
                                  contentMode: contentMode, audioIndex: audioIndex)
        guard !urls.isEmpty else { onFinish?(); return }
        activateAudioSession()
        playItem(urls, index: 0, generation: speechGeneration, onFinish: onFinish)
    }

    func stop() {
        speechGeneration &+= 1
        audioCompletion = nil
        audioPlayer?.stop()
        audioPlayer = nil
        deactivateAudioSession()
    }

    private func playItem(_ urls: [URL], index: Int, generation: Int,
                          onFinish: (() -> Void)?) {
        guard generation == speechGeneration else { return }
        guard urls.indices.contains(index) else {
            deactivateAudioSession()
            onFinish?()
            return
        }
        sessionWorker.prepareFile(at: urls[index]) { [weak self] player in
            DispatchQueue.main.async { [weak self] in
                guard let self, generation == self.speechGeneration else { return }
                guard let player else {
                    self.playItem(urls, index: index + 1, generation: generation, onFinish: onFinish)
                    return
                }
                player.delegate = self
                if let pending = self.pendingStart, pending.url == urls[index] {
                    player.currentTime = max(0, min(pending.time, player.duration))
                }
                self.pendingStart = nil
                guard player.play() else {
                    self.playItem(urls, index: index + 1, generation: generation, onFinish: onFinish)
                    return
                }
                self.audioPlayer = player
                self.currentAudioURL = urls[index]
                self.audioCompletion = { [weak self] in
                    guard let self, generation == self.speechGeneration else { return }
                    guard urls.indices.contains(index + 1) else {
                        self.deactivateAudioSession()
                        onFinish?()
                        return
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + Self.repeatInterval) { [weak self] in
                        self?.playItem(urls, index: index + 1, generation: generation, onFinish: onFinish)
                    }
                }
            }
        }
    }

    /// 自动播放的卡间停顿保持会话, 避免锁屏后被系统挂起。
    var keepsSessionActiveBetweenCards = false {
        didSet {
            guard !keepsSessionActiveBetweenCards, audioPlayer == nil else { return }
            deactivateAudioSession()
        }
    }

    private func activateAudioSession() {
        guard !hasConfiguredSession else { return }
        hasConfiguredSession = true
        sessionWorker.activate()
    }

    private func deactivateAudioSession() {
        guard !keepsSessionActiveBetweenCards, hasConfiguredSession else { return }
        hasConfiguredSession = false
        sessionWorker.deactivate()
    }
}

extension MTSpeechPlayer: AVAudioPlayerDelegate {
    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        finishAudio(player)
    }

    func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        finishAudio(player)
    }

    private func finishAudio(_ player: AVAudioPlayer) {
        guard player === audioPlayer else { return }
        let handler = audioCompletion
        audioCompletion = nil
        audioPlayer = nil
        handler?()
    }
}

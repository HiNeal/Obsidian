import Foundation
import MMKV

/// 串行处理磁盘工作；主线程只等待异步结果，不等待队列或磁盘锁。
nonisolated enum MTBackgroundWork {
    static let queue = DispatchQueue(label: "com.oyca168.www.Memory.storage", qos: .userInitiated)
    private static var isInitialized = false

    static func start() {
        queue.async { initializeIfNeeded() }
    }

    static func run<Value: Sendable>(_ operation: @escaping @Sendable () -> Value) async -> Value {
        await withCheckedContinuation { continuation in
            queue.async {
                initializeIfNeeded()
                continuation.resume(returning: operation())
            }
        }
    }

    /// 页面退出或再次改顺序时，跳过还未开始的扫描/排序，丢弃已失效的结果。
    static func runCancellable<Value: Sendable>(_ operation: @escaping @Sendable () -> Value) async -> Value? {
        let cancellation = Cancellation()
        return await withTaskCancellationHandler {
            await withCheckedContinuation { continuation in
                queue.async {
                    guard !cancellation.isCancelled else { continuation.resume(returning: nil); return }
                    initializeIfNeeded()
                    guard !cancellation.isCancelled else { continuation.resume(returning: nil); return }
                    let value = operation()
                    continuation.resume(returning: cancellation.isCancelled ? nil : value)
                }
            }
        } onCancel: {
            cancellation.cancel()
        }
    }

    private nonisolated final class Cancellation: @unchecked Sendable {
        private let lock = NSLock()
        private var cancelled = false
        var isCancelled: Bool {
            lock.lock()
            defer { lock.unlock() }
            return cancelled
        }
        func cancel() {
            lock.lock()
            cancelled = true
            lock.unlock()
        }
    }

    private static func initializeIfNeeded() {
        guard !isInitialized else { return }
        MMKV.initialize(rootDir: nil)
        MTAutoplaySettings.prepareGlobalStore()
        MTAlphabetDeckMigration.run()
        MTAutoplaySettings.applyStudyTimingDefaults()
        MTAutoplaySettings.removeLegacyFavoritesStore()
        isInitialized = true
    }
}

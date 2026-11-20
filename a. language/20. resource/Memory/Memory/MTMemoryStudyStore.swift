import Foundation
import MMKV

/// 读取和交互更新只访问内存；MMKV 打开、解码和写盘均由 storage 队列完成。
nonisolated final class MTMemoryStudyStore: @unchecked Sendable {
    private enum Value {
        case bool(Bool), integer(Int32), double(Double), string(String)
    }

    private let disk: MMKV
    private let lock = NSLock()
    private var values: [String: Value] = [:]
    private var isClosed = false

    init(_ disk: MMKV) {
        self.disk = disk
        for key in disk.allKeys() as? [String] ?? [] {
            // 旧评分只留在磁盘备份，Obsidian 标记是唯一评分来源。
            if key.hasPrefix("score.") || key.hasPrefix("tierScore.")
                || key == "manualScoreRevision" || key.hasPrefix("manualScoreScale.") { continue }
            if ["progressIndex", "familiarityLevel"].contains(key) {
                values[key] = .integer(disk.int32(forKey: key))
            } else if ["interval", "revealDelay"].contains(key) {
                values[key] = .double(disk.double(forKey: key))
            } else if key.hasPrefix("cardCount.") || [
                "playOrder", "contentMode", "lastOpenedDeckID", "lastOpenedDeckIDs",
                "activeDeckID", "activeDeckIDs"
            ].contains(key) {
                if let value = disk.string(forKey: key) { values[key] = .string(value) }
            } else {
                values[key] = .bool(disk.bool(forKey: key))
            }
        }
    }

    private func value(for key: String) -> Value? {
        lock.lock()
        defer { lock.unlock() }
        return values[key]
    }

    func contains(key: String) -> Bool { value(for: key) != nil }
    func bool(forKey key: String) -> Bool {
        guard case .bool(let result) = value(for: key) else { return false }
        return result
    }
    func int32(forKey key: String) -> Int32 {
        guard case .integer(let result) = value(for: key) else { return 0 }
        return result
    }
    func double(forKey key: String) -> Double {
        guard case .double(let result) = value(for: key) else { return 0 }
        return result
    }
    func string(forKey key: String) -> String? {
        guard case .string(let result) = value(for: key) else { return nil }
        return result
    }

    func set(_ value: Bool, forKey key: String) { update(.bool(value), forKey: key) }
    func set(_ value: Int32, forKey key: String) { update(.integer(value), forKey: key) }
    func set(_ value: Double, forKey key: String) { update(.double(value), forKey: key) }
    func set(_ value: String, forKey key: String) { update(.string(value), forKey: key) }
    func removeValue(forKey key: String) { update(nil, forKey: key) }

    private func update(_ value: Value?, forKey key: String) {
        lock.lock()
        guard !isClosed else { lock.unlock(); return }
        values[key] = value
        // 在内存锁内排队，保证连续点击的落盘顺序与内存更新顺序一致。
        MTBackgroundWork.queue.async { [self] in
            lock.lock()
            let closed = isClosed
            lock.unlock()
            guard !closed else { return }
            switch value {
            case .bool(let value): disk.set(value, forKey: key)
            case .integer(let value): disk.set(value, forKey: key)
            case .double(let value): disk.set(value, forKey: key)
            case .string(let value): disk.set(value, forKey: key)
            case nil: disk.removeValue(forKey: key)
            }
        }
        lock.unlock()
    }

    /// 仅由 storage 队列在替换卡组前调用，之前排队的写入已经完成。
    func close() {
        lock.lock()
        isClosed = true
        lock.unlock()
        disk.close()
    }

    func clearAll() {
        lock.lock()
        values.removeAll()
        lock.unlock()
        disk.clearAll()
    }

    func sync() { disk.sync() }
}

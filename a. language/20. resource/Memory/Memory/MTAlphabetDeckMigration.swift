import Foundation

/// 在 storage 队列打开卡组状态前迁移旧名称，整个目录搬迁以保留进度和音频。
nonisolated enum MTAlphabetDeckMigration {
    static func run() {
        guard let root = MTCardManager.localCardsRoot else { return }
        let fm = FileManager.default
        for (parent, kind) in [("x.word-prefix", "prefix"), ("y.word-root", "root")] {
            let directory = root.appendingPathComponent("01. base").appendingPathComponent(parent)
            let children = (try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.isDirectoryKey])) ?? []
            for child in children {
                let oldName = child.lastPathComponent
                guard (try? child.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true,
                      let name = unnumberedName(oldName, kind: kind) else { continue }
                let destination = directory.appendingPathComponent(name)
                guard !fm.fileExists(atPath: destination.path) else { continue }
                do {
                    try fm.moveItem(at: child, to: destination)
                } catch {
                    print("Memory 卡组改名失败: \(oldName): \(error)")
                }
            }
            // 目录移动后独立处理 md 改名，异常退出后下次启动也能继续。
            let renamed = (try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.isDirectoryKey])) ?? []
            for child in renamed {
                let name = child.lastPathComponent
                guard name.range(of: "^\(kind)-[a-z]$", options: .regularExpression) != nil else { continue }
                let files = (try? fm.contentsOfDirectory(at: child, includingPropertiesForKeys: nil)) ?? []
                for file in files where file.pathExtension == "md" {
                    guard unnumberedName(file.deletingPathExtension().lastPathComponent, kind: kind) == name else { continue }
                    let destination = child.appendingPathComponent("\(name).md")
                    guard !fm.fileExists(atPath: destination.path) else { continue }
                    do {
                        try fm.moveItem(at: file, to: destination)
                    } catch {
                        print("Memory 卡组文件改名失败: \(file.lastPathComponent): \(error)")
                    }
                }
            }
        }

        // 后缀按笔记的词性/功能顺序保留编号。
        let suffixNames = [
            "名词-行为与结果", "名词-人物与事物", "名词-性质与状态", "名词-场所与集合",
            "名词-小称与指大", "名词-物质与化学", "名词-学科与疾病", "动词形成后缀",
            "形容词-关系形容词", "形容词-性质形容词", "形容词-自带词义", "副词形成后缀",
            "数量成分", "拉丁词尾"
        ]
        let suffixMappings = Dictionary(uniqueKeysWithValues: suffixNames.enumerated().map {
            ($0.element, String(format: "%02d-%@", $0.offset + 1, $0.element))
        })
        let suffixDirectory = root.appendingPathComponent("01. base/z.word-suffix")
        for (oldName, name) in suffixMappings {
            let old = suffixDirectory.appendingPathComponent(oldName)
            let destination = suffixDirectory.appendingPathComponent(name)
            do {
                if fm.fileExists(atPath: old.path), !fm.fileExists(atPath: destination.path) {
                    try fm.moveItem(at: old, to: destination)
                }
                let oldFile = destination.appendingPathComponent("\(oldName).md")
                let newFile = destination.appendingPathComponent("\(name).md")
                if fm.fileExists(atPath: oldFile.path), !fm.fileExists(atPath: newFile.path) {
                    try fm.moveItem(at: oldFile, to: newFile)
                }
            } catch {
                print("Memory 后缀卡组改名失败: \(oldName): \(error)")
            }
        }

        func updatedIDs(_ ids: [String]) -> [String] {
            var seen = Set<String>()
            return ids.map { id in
                var parts = id.components(separatedBy: "/")
                guard parts.count >= 3, parts[0] == "01. base" else { return id }
                if parts[1] == "z.word-suffix", let name = suffixMappings[parts[2]] {
                    parts[2] = name
                    let updated = parts.joined(separator: "/")
                    return fm.fileExists(atPath: root.appendingPathComponent(updated).path) ? updated : id
                }
                let kind: String
                switch parts[1] {
                case "x.word-prefix": kind = "prefix"
                case "y.word-root": kind = "root"
                default: return id
                }
                guard let name = unnumberedName(parts[2], kind: kind) else { return id }
                parts[2] = name
                let updated = parts.joined(separator: "/")
                return fm.fileExists(atPath: root.appendingPathComponent(updated).path) ? updated : id
            }.filter { seen.insert($0).inserted }
        }
        let last = MTAutoplaySettings.lastOpenedDeckIDs()
        let newLast = updatedIDs(last)
        if newLast != last { MTAutoplaySettings.setLastOpenedDeckIDs(newLast) }
        let active = MTAutoplaySettings.activeDeckIDs()
        let newActive = updatedIDs(active)
        if newActive != active { MTAutoplaySettings.setActiveDeckIDs(newActive) }
        if let order = UserDefaults.standard.stringArray(forKey: "MTCardOrder") {
            let updated = updatedIDs(order)
            if updated != order { UserDefaults.standard.set(updated, forKey: "MTCardOrder") }
        }
    }

    private static func unnumberedName(_ name: String, kind: String) -> String? {
        guard let range = name.range(of: "^[0-9]+-(?=\(kind)-[a-z]$)", options: .regularExpression) else { return nil }
        return String(name[range.upperBound...])
    }
}

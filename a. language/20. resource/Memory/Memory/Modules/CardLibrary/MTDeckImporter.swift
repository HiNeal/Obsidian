import Foundation

nonisolated enum MTDeckImporter {
    static func importFiles(_ urls: [URL]) -> Bool {
        guard let decksDir = MTCardManager.localCardsRoot else { return false }
        try? FileManager.default.createDirectory(at: decksDir, withIntermediateDirectories: true)
        var imported = false
        for url in urls {
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            imported = importPickedItem(from: url, to: decksDir) || imported
        }
        return imported
    }

    /// Import a picked file or folder. If the folder contains subdirectories,
    /// import those subdirectories directly (flatten one level) so the wrapper
    /// folder (e.g. "Memory") is skipped and each of its own subfolders lands
    /// as its own top-level deck.
    @discardableResult
    static func importPickedItem(from url: URL, to decksDir: URL) -> Bool {
        let fm = FileManager.default
        let isDir = (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory ?? false

        guard isDir else {
            // Single file: copy directly
            let dest = decksDir.appendingPathComponent(url.lastPathComponent)
            try? fm.removeItem(at: dest)
            return (try? fm.copyItem(at: url, to: dest)) != nil
        }

        // Folder: check if it has subdirectories
        if let subdirs = subdirectoryURLs(at: url), !subdirs.isEmpty {
            // Flatten: import each subdirectory directly into decks/
            var ok = false
            for sub in subdirs {
                let dest = decksDir.appendingPathComponent(sub.lastPathComponent)
                if replaceKeepingStudyState(at: dest, with: sub) { ok = true }
            }
            return ok
        }

        // No subdirectories — import the folder itself
        let dest = decksDir.appendingPathComponent(url.lastPathComponent)
        return replaceKeepingStudyState(at: dest, with: url)
    }

    private static func subdirectoryURLs(at dir: URL) -> [URL]? {
        guard let contents = try? FileManager.default.contentsOfDirectory(
            at: dir, includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else { return nil }
        return contents.filter { url in
            (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true
                && url.lastPathComponent != mtMMKVReservedDirectoryName
                // `audio/` 是这个卡组的素材，不是子卡组。不排掉的话，导入一个
                // 自带音频的卡组会被当成「有子文件夹」而摊平，音频目录自己
                // 变成一个卡组躺在卡片库里。
                && url.lastPathComponent != MTDeckAudio.directoryName
        }
    }

    /// Re-importing a deck folder means "delete the old copy, drop the newly
    /// picked one in its place" — but the old copy carries `state`/`state.crc`
    /// (MTAutoplaySettings' MMKV file: focus mode, play order,
    /// reading progress, familiarity level), which the freshly picked source
    /// folder never has. Decks can be nested, and every nested folder has its
    /// own `state`/`state.crc`, so this walks the whole subtree — not just
    /// `dest` itself — to carry all of them forward.
    private static func replaceKeepingStudyState(at dest: URL, with source: URL) -> Bool {
        let fm = FileManager.default

        // 如果目标其实就是源本身（比如从「文件」App 里翻回 App 自己的
        // Documents/decks 重新选中了这个文件夹），什么都不用做——
        // 绝不能真的执行"先删 dest 再拷 source"，那样会把 source 自己删没。
        if dest.standardizedFileURL.path == source.standardizedFileURL.path {
            return true
        }

        let allDirs = [dest] + allNestedDirectories(at: dest)

        MTAutoplaySettings.syncStores()
        let preservedState: [(relativeComponents: [String], data: Data)] = allDirs.flatMap { dir -> [([String], Data)] in
            let relativeComponents = dir.pathComponents.count > dest.pathComponents.count
                ? Array(dir.pathComponents.dropFirst(dest.pathComponents.count))
                : []
            return ["state", "state.crc"].compactMap { name in
                let fileURL = dir.appendingPathComponent(name)
                guard let data = try? Data(contentsOf: fileURL) else { return nil }
                return (relativeComponents + [name], data)
            }
        }

        // 真人音频是经 USB 推进来的素材，一个卡组动辄几百个文件几十兆，
        // 不能跟着重新导入一起没掉。它太大，不能像 state 那样读进内存，
        // 所以先整个挪到临时目录，拷完再挪回来。
        let stashedAudio = stashAudioDirectories(under: dest, in: allDirs, fileManager: fm)

        // Evict cached MMKV instances before the folder disappears from disk.
        allDirs.forEach { MTAutoplaySettings.closeInstance(for: $0) }

        try? fm.removeItem(at: dest)
        guard (try? fm.copyItem(at: source, to: dest)) != nil else {
            // 拷贝失败也要把音频放回原处，否则它就留在临时目录里再也找不回来。
            try? fm.createDirectory(at: dest, withIntermediateDirectories: true)
            restoreAudioDirectories(stashedAudio, under: dest, fileManager: fm)
            return false
        }

        restoreAudioDirectories(stashedAudio, under: dest, fileManager: fm)

        for (relativeComponents, data) in preservedState {
            let fileURL = relativeComponents.reduce(dest) { $0.appendingPathComponent($1) }
            try? fm.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? data.write(to: fileURL)
        }
        return true
    }

    private nonisolated struct MTStashedAudioDirectory {
        /// 相对 dest 的路径，卡组套卡组时每一层的 `audio/` 都各自记一份。
        let relativeComponents: [String]
        let stashURL: URL
    }

    private static func stashAudioDirectories(under dest: URL,
                                       in directories: [URL],
                                       fileManager fm: FileManager) -> [MTStashedAudioDirectory] {
        let stashRoot = fm.temporaryDirectory.appendingPathComponent(
            "MTDeckAudioStash-\(UUID().uuidString)", isDirectory: true
        )
        var stashed: [MTStashedAudioDirectory] = []
        for (offset, directory) in directories.enumerated() {
            let audioURL = directory.appendingPathComponent(
                MTDeckAudio.directoryName, isDirectory: true
            )
            guard fm.fileExists(atPath: audioURL.path) else { continue }
            let relative = Array(directory.pathComponents.dropFirst(dest.pathComponents.count))
                + [MTDeckAudio.directoryName]
            let stashURL = stashRoot.appendingPathComponent("\(offset)", isDirectory: true)
            try? fm.createDirectory(at: stashURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            guard (try? fm.moveItem(at: audioURL, to: stashURL)) != nil else { continue }
            stashed.append(MTStashedAudioDirectory(relativeComponents: relative, stashURL: stashURL))
        }
        return stashed
    }

    /// 源文件夹里自己带了音频就以源为准，否则把挪走的搬回来。
    private static func restoreAudioDirectories(_ stashed: [MTStashedAudioDirectory],
                                         under dest: URL,
                                         fileManager fm: FileManager) {
        for entry in stashed {
            let audioURL = entry.relativeComponents.reduce(dest) { $0.appendingPathComponent($1) }
            if fm.fileExists(atPath: audioURL.path) {
                try? fm.removeItem(at: entry.stashURL)
                continue
            }
            try? fm.createDirectory(at: audioURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? fm.moveItem(at: entry.stashURL, to: audioURL)
        }
        if let stashRoot = stashed.first?.stashURL.deletingLastPathComponent() {
            try? fm.removeItem(at: stashRoot)
        }
    }

    /// Walks `dir`'s subtree, skipping MMKV's own `specialCharacter` bookkeeping
    /// folders (see `mtMMKVReservedDirectoryName`) so they're neither preserved
    /// nor descended into during backup. `audio/` 同样跳过：它里面只有 mp3，
    /// 没有学习状态，几百个文件没必要逐个枚举——它整目录的保全另有处理。
    private static func allNestedDirectories(at dir: URL) -> [URL] {
        guard let enumerator = FileManager.default.enumerator(
            at: dir, includingPropertiesForKeys: [.isDirectoryKey], options: [.skipsHiddenFiles]
        ) else { return [] }
        var result: [URL] = []
        for case let url as URL in enumerator {
            guard (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true else { continue }
            if url.lastPathComponent == mtMMKVReservedDirectoryName
                || url.lastPathComponent == MTDeckAudio.directoryName {
                enumerator.skipDescendants()
                continue
            }
            result.append(url)
        }
        return result
    }
}

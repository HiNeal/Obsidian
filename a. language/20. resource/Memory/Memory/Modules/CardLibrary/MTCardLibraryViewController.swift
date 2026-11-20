//
//  MTCardLibraryViewController.swift
//  Memory
//
//  Created by GPT-5.5 on 5/3/26.
//

import UIKit
import SnapKit

final class MTCardLibraryViewController: UITableViewController {

    private var items: [MTCardLibraryUIItem] = []
    private let directoryPath: String?
    private var isSelectingFolders = false
    private var selectedFolderIDs = Set<String>()

    private var refreshTask: Task<Void, Never>?
    private var refreshGeneration = 0
    private var needsAnotherRefresh = false
    private var hasRestoredActiveDeck = false
    private var openingTask: Task<Void, Never>?
    /// 上次那副牌解析得出的卡组。合并牌堆会有多个——**能解出几个算几个**：
    /// 其中某一章被删或改名了，剩下的照样能拼回去，不该整个入口失效。
    private var cachedLastOpenedItems: [MTCardManagerItem] = []

    init(directoryPath: String? = nil) {
        self.directoryPath = directoryPath
        super.init(style: .insetGrouped)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        refreshTask?.cancel()
        openingTask?.cancel()
        NotificationCenter.default.removeObserver(self)
    }





    /// 正在打开卡组。`view.isUserInteractionEnabled = false` 只能挡住之后的触摸，
    /// 挡不住在它生效前就已经进了事件队列的那些——主线程一卡，这些点击会在解冻后
    /// 一起投递，于是同一个卡组被 push 好几次。这个标记补上那个空窗。
    private var isOpeningDeck = false

    private var defaultTitle: String {
        directoryPath.map { ($0 as NSString).lastPathComponent } ?? "文件夹"
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = defaultTitle
        navigationController?.navigationBar.prefersLargeTitles = true
        // 首页不放按钮：卡组由电脑经 USB 直接导入（.cache/import_to_memory.py）。
        if directoryPath != nil {
            navigationItem.rightBarButtonItem = makeSelectButton()
        }
        refreshControl = UIRefreshControl()
        refreshControl?.addTarget(self, action: #selector(pullToRefresh), for: .valueChanged)
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "cell")
        tableView.rowHeight = UITableView.automaticDimension
        tableView.estimatedRowHeight = 64

        let loadingView = UIView()
        let spinner = UIActivityIndicatorView(style: .medium)
        loadingView.addSubview(spinner)
        spinner.snp.makeConstraints { make in make.center.equalToSuperview() }
        spinner.startAnimating()
        tableView.backgroundView = loadingView

        if directoryPath == nil {
            setupQuickResumeButton()
        }

        NotificationCenter.default.addObserver(
            self, selector: #selector(refresh),
            name: MTCardManager.cardListChangedNotification, object: nil
        )
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        refresh()
        if isSelectingFolders {
            navigationController?.setToolbarHidden(false, animated: animated)
        } else {
            navigationController?.setToolbarHidden(true, animated: animated)
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        openingTask?.cancel()
        openingTask = nil
        isOpeningDeck = false
        if isSelectingFolders {
            navigationController?.setToolbarHidden(true, animated: animated)
        }
    }

    @objc private func refresh() {
        guard refreshTask == nil else { needsAnotherRefresh = true; return }
        refreshGeneration &+= 1
        let generation = refreshGeneration
        let path = directoryPath
        refreshTask = Task { [weak self] in
            let (rawItems, lastItems) = await MTBackgroundWork.run {
                let rawItems = MTCardLibraryData.makeItems(in: path)
                let lastIDs = path == nil ? MTAutoplaySettings.lastOpenedDeckIDs() : []
                return (rawItems, lastIDs.compactMap { MTCardManager.item(forID: $0) })
            }
            guard !Task.isCancelled, let self, self.refreshGeneration == generation else { return }
            self.refreshTask = nil
            self.items = rawItems
            self.tableView.backgroundView = nil
            self.selectedFolderIDs.formIntersection(rawItems.map { $0.managerItem.id })
            self.tableView.reloadData()
            self.refreshControl?.endRefreshing()
            self.cachedLastOpenedItems = lastItems
            self.updateQuickResumeButton()
            self.updateSelectionControls()
            if !self.hasRestoredActiveDeck {
                self.hasRestoredActiveDeck = true
                self.restoreActiveDeckIfNeeded()
            }
            if self.needsAnotherRefresh {
                self.needsAnotherRefresh = false
                self.refresh()
            }
        }
    }

    /// 下拉只是重新扫描本地卡组：USB 导入后不用重启 App 就能看到新内容。
    @objc private func pullToRefresh() {
        refresh()
    }

    // MARK: - Quick resume (home screen only)

    /// A floating circular button, docked bottom-center above the list, that
    /// jumps straight back into the deck last opened — anywhere in the
    /// folder tree — so the user doesn't have to re-navigate to it.
    private lazy var quickResumeButton = MTIconControlButton(
        systemName: "book.fill", tintColor: .systemBlue,
        accessibilityTitle: "继续阅读", diameter: 64
    )

    private func setupQuickResumeButton() {
        view.addSubview(quickResumeButton)
        quickResumeButton.snp.makeConstraints { make in
            make.centerX.equalToSuperview()
            make.bottom.equalTo(view.safeAreaLayoutGuide.snp.bottom).offset(-24)
        }
        quickResumeButton.addTarget(self, action: #selector(quickResumeButtonClick), for: .touchUpInside)
        quickResumeButton.isHidden = true
    }

    private func updateQuickResumeButton() {
        guard directoryPath == nil, !isSelectingFolders,
              let first = cachedLastOpenedItems.first else {
            quickResumeButton.isHidden = true
            tableView.contentInset.bottom = 0
            return
        }
        quickResumeButton.isHidden = false
        quickResumeButton.accessibilityLabel = cachedLastOpenedItems.count > 1
            ? "继续阅读「\(first.title)」等 \(cachedLastOpenedItems.count) 个卡组的合并牌堆"
            : "继续阅读「\(first.title)」"
        tableView.contentInset.bottom = 96
    }

    private func makeSelectButton() -> UIBarButtonItem {
        UIBarButtonItem(
            title: "选择",
            style: .plain,
            target: self,
            action: #selector(toggleFolderSelectionMode)
        )
    }

    private func updateSelectionControls() {
        guard isSelectingFolders else {
            title = defaultTitle
            navigationItem.leftBarButtonItem = nil
            navigationController?.setToolbarHidden(true, animated: true)
            setToolbarItems(nil, animated: false)
            if directoryPath == nil {
                navigationItem.rightBarButtonItems = []
            } else {
                let selectButton = makeSelectButton()
                navigationItem.rightBarButtonItem = selectButton
                navigationItem.rightBarButtonItems = [selectButton]
            }
            return
        }

        let allFolderIDs = Set(items.map { $0.managerItem.id })
        let count = selectedFolderIDs.count
        title = count == 0 ? "选择文件夹" : "已选择 \(count) 项"

        let hasSelectedAll = !allFolderIDs.isEmpty && selectedFolderIDs == allFolderIDs
        let selectAllButton = UIBarButtonItem(
            title: hasSelectedAll ? "取消全选" : "全选",
            style: .plain,
            target: self,
            action: #selector(toggleAllFoldersSelection)
        )
        selectAllButton.isEnabled = !allFolderIDs.isEmpty
        navigationItem.leftBarButtonItem = selectAllButton

        let cancelButton = UIBarButtonItem(
            title: "取消",
            style: .plain,
            target: self,
            action: #selector(toggleFolderSelectionMode)
        )
        navigationItem.rightBarButtonItem = cancelButton
        navigationItem.rightBarButtonItems = [cancelButton]

        let flexible = UIBarButtonItem(barButtonSystemItem: .flexibleSpace, target: nil, action: nil)
        let combineTitle = count > 0 ? "合并卡组 (\(count))" : "合并卡组"
        let combineButton = UIBarButtonItem(
            title: combineTitle,
            style: .done,
            target: self,
            action: #selector(combineSelectedFolders)
        )
        combineButton.isEnabled = count > 0
        setToolbarItems([flexible, combineButton], animated: false)
        navigationController?.setToolbarHidden(false, animated: true)
    }

    @objc private func quickResumeButtonClick() {
        if !cachedLastOpenedItems.isEmpty {
            openDecks(cachedLastOpenedItems)
            return
        }
        let ids = MTAutoplaySettings.lastOpenedDeckIDs()
        guard !ids.isEmpty else { return }
        Task { [weak self] in
            let items = await MTBackgroundWork.run { ids.compactMap { MTCardManager.item(forID: $0) } }
            guard !Task.isCancelled, !items.isEmpty else { return }
            self?.openDecks(items)
        }
    }

    /// 一个就当单卡组开，多个就拼回合并牌堆。两条路的入口收敛到这里，
    /// 免得再出现「合并牌堆压根没被记录」这种只差一条分支的遗漏。
    private func openDecks(_ items: [MTCardManagerItem], animated: Bool = true) {
        guard items.count > 1 else {
            guard let item = items.first else { return }
            openCardDeck(for: item, animated: animated)
            return
        }
        openCombinedDeck(for: items, animated: animated)
    }

    private func openCardDeck(for item: MTCardManagerItem, animated: Bool = true) {
        openPreparedDeck(items: [item], animated: animated, autoStart: false)
    }

    private func openCombinedDeck(for items: [MTCardManagerItem],
                                  animated: Bool = true,
                                  autoStart: Bool = true) {
        openPreparedDeck(items: items, animated: animated, autoStart: autoStart)
    }

    private func openPreparedDeck(items: [MTCardManagerItem], animated: Bool, autoStart: Bool) {
        guard !isOpeningDeck else { return }
        isOpeningDeck = true
        openingTask = Task { [weak self] in
            let result = await MTBackgroundWork.runCancellable {
                let config = items.count == 1
                    ? items.first.flatMap { MTCardManager.loadConfiguration(for: $0) }
                    : MTCardManager.loadCombinedConfiguration(for: items)
                return config.map { MTPreparedDeck(configuration: $0) }
            }
            guard !Task.isCancelled, let result, let self else { return }
            self.isOpeningDeck = false
            self.openingTask = nil
            guard self.navigationController?.topViewController === self else { return }
            guard let prepared = result else {
                let alert = UIAlertController(title: "没有可用的卡片", message: "所选文件夹中没有卡片。", preferredStyle: .alert)
                alert.addAction(UIAlertAction(title: "好", style: .default))
                self.present(alert, animated: true)
                return
            }
            MTAutoplaySettings.setLastOpenedDeckIDs(items.map(\.id))
            self.navigationController?.pushViewController(
                MTLearningCardsViewController(preparedDeck: prepared, autoStartAutoplay: autoStart),
                animated: animated
            )
        }
    }

    /// 上次退出 App 时正开着某副牌，就直接落回去，不用再翻一遍目录。
    ///
    /// 只在卡片库根页做一次。卡组已经被删掉或改名时（`item(forID:)` 解析不出来）
    /// 清掉记号，老老实实显示列表。位置由每张卡都在存的 `progressIndex` 兜住。
    private func restoreActiveDeckIfNeeded() {
        guard directoryPath == nil else { return }
        let deckIDs = MTAutoplaySettings.activeDeckIDs()
        guard !deckIDs.isEmpty else { return }
        Task { [weak self] in
            let items = await MTBackgroundWork.run { deckIDs.compactMap { MTCardManager.item(forID: $0) } }
            guard !Task.isCancelled, let self else { return }
            guard !items.isEmpty else {
                MTAutoplaySettings.setActiveDeckIDs([])
                return
            }
            self.openDecks(items, animated: false)
        }
    }

    // MARK: - TableView

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        items.count
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "cell", for: indexPath)
        let item = items[indexPath.row]
        var content = cell.defaultContentConfiguration()
        content.text = item.title
        content.secondaryText = item.subtitle
        content.textProperties.font = MTAppFont.font(ofSize: content.textProperties.font.pointSize)
        content.secondaryTextProperties.font = MTAppFont.font(ofSize: 14)
        content.prefersSideBySideTextAndSecondaryText = false
        content.image = UIImage(systemName: "folder.fill")
        
        let level = item.familiarityLevel
        if level != .none {
            content.imageProperties.tintColor = level.color
        } else {
            content.imageProperties.tintColor = item.managerItem.isEmpty ? .systemGray3 : .systemBlue
        }
        
        cell.contentConfiguration = content
        cell.accessoryType = isSelectingFolders
            ? (selectedFolderIDs.contains(item.managerItem.id) ? .checkmark : .none)
            : .disclosureIndicator
        cell.accessoryView = nil
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let item = items[indexPath.row]
        if isSelectingFolders {
            let id = item.managerItem.id
            if selectedFolderIDs.contains(id) {
                selectedFolderIDs.remove(id)
            } else {
                selectedFolderIDs.insert(id)
            }
            tableView.reloadRows(at: [indexPath], with: .none)
            updateSelectionControls()
            return
        }
        if item.managerItem.cardCount > 0 {
            openCardDeck(for: item.managerItem)
        } else {
            let subVC = MTCardLibraryViewController(directoryPath: item.managerItem.id)
            navigationController?.pushViewController(subVC, animated: true)
        }
    }

    // MARK: - Context Menu (Long Press)

    override func tableView(_ tableView: UITableView, contextMenuConfigurationForRowAt indexPath: IndexPath, point: CGPoint) -> UIContextMenuConfiguration? {
        let item = items[indexPath.row]

        return UIContextMenuConfiguration(identifier: nil, previewProvider: nil) { [weak self] _ in
            guard let self = self else { return nil }

            let familiarityActions = MTFamiliarityLevel.allCases.filter { $0 != .none }.map { level in
                let circleImage = level == .none
                    ? UIImage(systemName: "circle")?.withTintColor(.tertiaryLabel, renderingMode: .alwaysOriginal)
                    : UIImage(systemName: "circle.fill")?.withTintColor(level.color, renderingMode: .alwaysOriginal)
                let actionTitle = level == .none ? "未标记" : level.title
                let action = UIAction(
                    title: actionTitle,
                    image: circleImage,
                    state: item.familiarityLevel == level ? .on : .off
                ) { _ in
                    Task { await MTBackgroundWork.run { MTCardManager.setFamiliarityLevel(level, forItemID: item.managerItem.id) } }
                }
                return action
            }

            // 使用 options: .displayInline 将颜色选择展平放在顶级菜单最顶部
            let familiarityGroup = UIMenu(
                title: "熟悉程度",
                options: .displayInline,
                children: familiarityActions
            )

            let edit = UIAction(title: "编辑排序", image: UIImage(systemName: "line.3.horizontal")) { [weak self] _ in
                guard let self else { return }
                self.toggleEdit()
            }
            let rename = UIAction(title: "重命名", image: UIImage(systemName: "pencil")) { [weak self] _ in
                guard let self else { return }
                self.showRenameAlert(for: item)
            }
            return UIMenu(children: [familiarityGroup, edit, rename])
        }
    }

    // MARK: - Swipe Actions

    private func showFamiliarityPicker(for item: MTCardLibraryUIItem) {
        let sheet = UIAlertController(
            title: "设置「\(item.title)」的熟悉程度",
            message: nil,
            preferredStyle: .actionSheet
        )

        for level in MTFamiliarityLevel.allCases where level != .none {
            let titleText: String
            switch level {
            case .unfamiliar: titleText = "🔴 陌生"
            case .familiar: titleText = "🟡 熟悉"
            case .mastered: titleText = "🟢 精通"
            case .none: continue
            }

            let action = UIAlertAction(title: titleText, style: .default) { _ in
                Task { await MTBackgroundWork.run { MTCardManager.setFamiliarityLevel(level, forItemID: item.managerItem.id) } }
            }
            sheet.addAction(action)
        }

        sheet.addAction(UIAlertAction(title: "取消", style: .cancel))
        present(sheet, animated: true)
    }

    private func showRenameAlert(for item: MTCardLibraryUIItem) {
        guard item.canDelete else { return }
        let alert = UIAlertController(title: "重命名", message: nil, preferredStyle: .alert)
        alert.addTextField {
            $0.text = item.title
            $0.font = MTAppFont.font(ofSize: 17)
        }
        alert.addAction(UIAlertAction(title: "确定", style: .default) { [weak self] _ in
            guard let newName = alert.textFields?.first?.text?.trimmingCharacters(in: .whitespaces),
                  !newName.isEmpty, newName != item.title else { return }
            Task { [weak self] in
                await MTBackgroundWork.run { MTCardManager.renameFolder(from: item.managerItem.id, to: newName) }
                self?.refresh()
            }
        })
        alert.addAction(UIAlertAction(title: "取消", style: .cancel))
        present(alert, animated: true)
    }

    // MARK: - Edit / Reorder

    private var isEditingOrder = false

    @objc private func toggleFolderSelectionMode() {
        isSelectingFolders.toggle()
        if !isSelectingFolders { selectedFolderIDs.removeAll() }
        tableView.reloadData()
        updateQuickResumeButton()
        updateSelectionControls()
    }

    @objc private func toggleAllFoldersSelection() {
        let allFolderIDs = Set(items.map { $0.managerItem.id })
        if !allFolderIDs.isEmpty, selectedFolderIDs == allFolderIDs {
            selectedFolderIDs.removeAll()
        } else {
            selectedFolderIDs = allFolderIDs
        }
        tableView.reloadData()
        updateSelectionControls()
    }

    @objc private func combineSelectedFolders() {
        let selectedItems = items
            .filter { selectedFolderIDs.contains($0.managerItem.id) }
            .map(\.managerItem)
        guard !selectedItems.isEmpty else { return }

        isSelectingFolders = false
        selectedFolderIDs.removeAll()
        navigationController?.setToolbarHidden(true, animated: false)
        updateQuickResumeButton()
        updateSelectionControls()
        openCombinedDeck(for: selectedItems)
    }

    @objc private func toggleEdit() {
        isEditingOrder.toggle()
        tableView.setEditing(isEditingOrder, animated: true)
        if isEditingOrder {
            navigationItem.leftBarButtonItem = UIBarButtonItem(
                title: "完成",
                style: .done,
                target: self,
                action: #selector(toggleEdit)
            )
        } else {
            navigationItem.leftBarButtonItem = nil
        }
    }

    override func tableView(_ tableView: UITableView, canMoveRowAt indexPath: IndexPath) -> Bool {
        true
    }

    override func tableView(_ tableView: UITableView, moveRowAt sourceIndexPath: IndexPath, to destinationIndexPath: IndexPath) {
        let movedItem = items.remove(at: sourceIndexPath.row)
        items.insert(movedItem, at: destinationIndexPath.row)
        persistOrder()
    }

    override func tableView(_ tableView: UITableView, editingStyleForRowAt indexPath: IndexPath) -> UITableViewCell.EditingStyle {
        .none
    }

    override func tableView(_ tableView: UITableView, shouldIndentWhileEditingRowAt indexPath: IndexPath) -> Bool {
        false
    }

    // MARK: - Reorder Persistence

    private func persistOrder() {
        let ids = items.map { $0.managerItem.id }
        MTBackgroundWork.queue.async { UserDefaults.standard.set(ids, forKey: "MTCardOrder") }
    }

}

// MARK: - UIDocumentPickerDelegate

extension MTCardLibraryViewController: UIDocumentPickerDelegate {
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        let progress = UIAlertController(
            title: "正在导入卡组",
            message: "请稍候…",
            preferredStyle: .alert
        )
        let spinner = UIActivityIndicatorView(style: .medium)
        spinner.startAnimating()
        progress.view.addSubview(spinner)
        spinner.snp.makeConstraints { make in
            make.centerX.equalToSuperview()
            make.bottom.equalToSuperview().offset(-18)
        }
        present(progress, animated: true)

        Task { [weak self] in
            let imported = await MTBackgroundWork.run { MTDeckImporter.importFiles(urls) }
            progress.dismiss(animated: true) { [weak self] in
                guard imported else { return }
                MTCardManager.notify()
                self?.refresh()
            }
        }
    }
}

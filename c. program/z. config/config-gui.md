## oyconfig-gui

```bash 
# 安装基础工具 (karabiner | clash-verge-rev | chrome | raycast | cleanshot | iina)
brew install --cask karabiner-elements clash-verge-rev google-chrome raycast cleanshot iina

# 安装办公工具 (微信 | 飞书 | 腾讯会议 | xmind | uu 远程 | outlook)
brew install --cask wechat feishu tencent-meeting xmind uuremote microsoft-outlook

# 安装开发工具 (vscode | cursor | codex | sourcetree | android studio | lookin)
brew install --cask visual-studio-code cursor chatgpt sourcetree android-studio lookin

# appstore 下载
Xcode SnippetLabs Bobs
```

## oyconfig-gui-path

```bash
# karabiner
~/.config/karabiner                                             # 键位配置路径

# vscode
~/Library/Application Support/Code/User/snippets                # snippets路径

# cursor
~/Library/Application Support/Cursor/User/snippets              # snippets路径

# xcode
~/Library/Developer/Xcode/Archives                              # 产物路径
~/Library/Developer/Xcode/DerivedData                           # 衍生产物路径
~/Library/Developer/Xcode/UserData/CodeSnippets                 # 代码片段路径
~/Library/Developer/CoreSimulator/Profiles/Devices              # 模拟器路径
~/Library/MobileDevice/Provisioning Profiles                    # 描述文件路径

# idea
~/Library/Application Support/JetBrains/IdeaIC2020.2/templates  # 代码片段路径

# ghostty
~/Library/Application Support/com.mitchellh.ghostty/config.ghostty 

```

## oyconfig-mac

```bash
# 查看是否受到公司 MDM 管理
profiles status -type enrollmen

# 取消4位数密码限制
pwpolicy -clearaccountpolicies

# 开启软件任何来源(Privacy & Security手动修改)
sudo spctl --master-disable

# 修改mac地址(重新启动会失效)
sudo /System/Library/PrivateFrameworks/Apple80211.framework/Resources/airport -z
sudo ifconfig en0 ether 3c:06:30:21:82:73
networksetup -detectnewhardware

# 设置dock自动显示隐藏时间
defaults write com.apple.dock autohide-delay -int 0
killall Dock

# 移除键盘长按功能
defaults write -g ApplePressAndHoldEnabled -bool false

# 其他设置
- General -> Language & Region -> Temperature -> Celsius
  General -> Language & Region -> First Day of Week -> Monday

- Appearance -> Show scroll bars -> Always
  Appearance -> Click in the scroll bar to -> Jump to the spot that clicked

- Menu Bar -> Bluetooth -> Show in Menu Bar

- Desktop & Dock -> Dock -> Position on screen -> Left
  Desktop & Dock -> Mission Control -> Uncheck Automatically rearrange Spaces based on most recent use

- Displays -> Uncheck True Tone
  Displays -> Uncheck  Automatically adjust brightness

- Lock Screen -> Require password after screen saver begins or display is turned off -> Immediately
```

## oyconfig-sougou

``` 
~/Library/Preferences/com.apple.HIToolbox.plist

- 移除 AppleEnabledInputSources中 ABC 所在的 items，并立即保存并执行以下锁定指令后重启电脑

chflags uchg ~/Library/Preferences/com.apple.HIToolbox.plist
```
## oyconfig-raycast

```bash
- Extension -> All -> Application -> Uncheck Toggle Application Visibility On Hotkey

```

## oyconfig-finder

```bash
command + ~                                                 # 快速切换同一软件的不同窗口
command + i                                                 # Finder快速显示简介信息
command + option + C                                        # Finder快速复制文件路径
command + /                                                 # Finder显示磁盘存储情况
command + option + P                                        # Finder显示底部文件路径
command + shift + .                                         # Finder显示隐藏文件夹
command + tab                                               # 全局切换应用程序

# 其他设置
- Menu Bar -> View -> Show Toolbar | Show Path Bar | Show Status Bar
- Menu Bar -> Finder -> Settings -> General -> New Finder windows show: -> oyca168
  Menu Bar -> Finder -> Settings -> General -> Uncheck "Open folders in tabs instead of new windows"
  Menu Bar -> Finder -> Settings -> Sidebar -> Check oyca168
  Menu Bar -> Finder -> Settings -> Advanced -> Check "Show all filename extensions"
  Menu Bar -> Finder -> Settings -> Advanced -> When performing a search: -> Search the Current Folder

- Right-click the toolbar -> Customize Toolbar -> Drag in AirDrop | New Folder | Search

```

## oyconfig-cursor

```bash
# vibe coding
command + l                                                # 打开对话框
command + k                                                # 行间对话框
command + shift + j                                        # 打开cursor设置
```

## oyconfig-vscode

```bash
# 额外快捷键
escape                                                      # 退出当前命令快捷

# 窗口级别操作
control + `                                                 # 跳转到终端
command + j                                                 # 显示隐藏底部边栏
command + \                                                 # 拆分编辑器
command + ,                                                 # 打开偏好设置
command + option + ←/→                                      # 切换左右文件
command + shift + p                                         # 打开命令面板
command + shift + f                                         # 切换到搜索区
command + shift + e                                         # 切换到编辑区
command + shift + d                                         # 切换到调试区
command + b                                                 # 显示或隐藏左侧边栏
command + option + b                                        # 显示或隐藏右侧边栏

# 编辑操作
control + d                                                 # 向前删除

# 文件操作
option  + ↕                                                 # 移动整行
command + x                                                 # 剪切整行
command + c                                                 # 复制整行
command + enter                                             # 向下重起一行
command + shift + enter                                     # 向上重起一行
control + g                                                 # 指定行跳转(文件内)
command + shift + o                                         # 指定方法跳转(文件内)
command + shift + .                                         # 查看文件大纲
command + control + ←/→                                     # 向后/前(文件间)

# 工程级别操作
command + T                                                 # 指定符号跳转(工程内)

# 其他操作
command + d                                                 # 开启调试

# 多光标
option + 鼠标联系点任意位置                                 # 在任意位置出现多个光标
command + option + ↑/↓                                      # 在连续多列上出现光标

# 搜索操作
command + p                                                 # 搜索文件(return进入文件 & command + return拆分文件多个窗口)

# 命令面板
profile                                                     # 档案

# 配置当前调试只需要创建.vscode/launch.json即可
# 配置当前工作区只需要创建.vscode/setting.json即可
# Find All References                                       # 查看所有引用
# Go to Definition                                          # 查看方法定义

# vscode
~/Library/Application Support/Code/User/snippets                # snippets路径
```

## oyconfig-xcode

```bash
# 打开snippet独立窗口
command + option + shift + L

# 取消Xcode打开工程索引过程
defaults write com.apple.dt.XCode IDEIndexDisable 1   fast
defaults write com.apple.dt.XCode IDEIndexDisable 0   standard

# 开启编译耗时显示
defaults write com.apple.dt.Xcode ShowBuildOperationDuration -bool YES

# 加快Xcode编译速度
defaults write com.apple.dt.xcodebuild PBXNumberOfParallelBuildSubtasks `sysctl -n hw.ncpu`
defaults write com.apple.dt.xcodebuild IDEBuildOperationMaxNumberOfConcurrentCompileTasks `sysctl -n hw.ncpu`
defaults write com.apple.dt.Xcode PBXNumberOfParallelBuildSubtasks `sysctl -n hw.ncpu`
defaults write com.apple.dt.Xcode IDEBuildOperationMaxNumberOfConcurrentCompileTasks `sysctl -n hw.ncpu`

# xcode
~/Library/Developer/Xcode/Archives                              # 产物路径
~/Library/Developer/Xcode/DerivedData                           # 衍生产物路径
~/Library/Developer/Xcode/UserData/CodeSnippets                 # 代码片段路径
~/Library/Developer/CoreSimulator/Profiles/Devices              # 模拟器路径
~/Library/Developer/Xcode/UserData/Provisioning Profiles        # 描述文件路径
~/Library/MobileDevice/Provisioning Profiles                    # 描述文件路径

```

## oyconfig-android-studio

```bash
command + j                                       // live template
command + b                                       // 定位方法调用处

command + option + l                              // 代码格式化
option + shift + ←/→                              // 代码左右选中
option + shift + ↑/↓                              // 代码上下移动

command + o                                       // 搜索
command + shift + o                               // 搜索文件
command + option + o                              // 搜索方法或字段

https://gist.github.com/fightyz/16b5658df82a20d8457cd15a2a0f9d3f // 快捷键大全
```

## oyconfig-idea

```bash
←                                                           # 收包
→                                                           # 开包
option  + enter                                             # 全能快捷键
control + R                                                 # 运行
control + D                                                 # 调试
control + return                                            # 快速生成
command + B                                                 # 查看符号源代码
command + R                                                 # 当前类替换
command + shift + R                                         # 全局替换
command + F                                                 # 查找
command + O                                                 # 搜索文件/符号
command + shift + F                                         # 全局查找
command + shift + enter                                     # 语句结尾加分号
command + option + L                                        # 格式化代码
command + option + ←/→                                      # 最近打开文件跳转
command + N                                                 # 类/构造函数/setter/getter生成
control + H                                                 # 查看集成关系

# 配置全局maven(环境配置/自动导包)
open idea -> customize -> all settings -> maven -> home path
open idea -> customize -> all settings -> maven -> setting file
open idea -> customize -> all settings -> maven -> local respository

# 配置maven
preference -> build execution deployment -> maven -> home path
preference -> build execution deployment -> maven -> setting file
preference -> build execution deployment -> maven -> local respository

# 查看Maven项目内包安装情况
right side -> maven click

# 创建Maven父子工程
new project -> build system maven & advanced settings -> create -> delete src
new module -> maven archetype -> web app archetype & advanced settings -> create
new module -> new project -> build system maven & advanced settings -> create

# 配置tomcat
edit configuration -> tomcat server local -> server
edit configuration -> tomcat server local -> deloyment -> add artifact -> war
edit configuration -> tomcat server local -> deloyment -> war -> appliction context为/ 默认通过域名端口访问

# 创建webapp
new project -> maven archetype -> archetype & advance settings

# 设置文件夹类型
File -> Modules -> Project Structure

# idea
~/Library/Application Support/JetBrains/IdeaIC2020.2/templates  # 代码片段路径

```

## oyconfig-chrome

```bash
command + shift + D                                         # 保存所有标签
command + shift + N                                         # 开启无痕模式
command + option + J                                        # 进入控制台
command + option + ←/→                                      # 标签切换
command + option + [/]                                      # 代码块折叠/展开

Network -> Preserve log                                     # 保持网络请求日志
Network -> Header                                           # 查看请求头和响应头
Network -> Header -> Query String Param                     # Get请求拼接参数
Network -> Response                                         # 查看响应内容
Network -> Cookies                                          # 查看cookies


# 开启 Gemin
curl -fsSL https://raw.githubusercontent.com/appsail/Gemini-in-Chrome/main/install.sh | bash

```

## oyconfig-sourcetree

```bash
/**
 * 合并多个commit
 *
 * - 右键待合并提交的上一次提交并选择交互式变基;
 * - 高亮第一条日志并点击用以前的提交来squash;
 * - 重复点击用以前的提交来squash,直至剩下一条信息;
 * - 点击编辑可以调整这次合并的提交信息,点击确定即可;
 * - git push --force强制push到远程代码仓库;
 */

 /**
  * 使用rebase
  *
  * - 点击拉取并勾选用变基代替合并;
  * - 产生冲突解决冲突,重复拉取并勾选用变基代替合并,最终可以提交;
  */

 /**
  * 回滚指定commit
  *
  * - 选中需要回退的版本,右键选择将XX重置到这次提交,并选择强制合并后确定;
  * - 选中最新的提交commit,右键选择将XX重置到这次提交,并选择软合并后确定;
  * - 提交本地修改后即可;
  */

```

## oyconfig-mail

```bash
设置 -> 隐私 -> 取消勾选隐藏所有选项
```

## oyconfig-numbers

```bash
command + shift + [                                           # 表格向左移动
command + shift + ]                                           # 表格向右移动
```

## oyconfig-ghostty

```bash
command + D								# 右侧新分屏
command + shift + D						# 下方新分屏
command + Option + H / J / K / L		# 分屏导航（左 / 下 / 上 / 右）
command + Shift + E                     # 均分所有分屏
command + shift + F                     # 当前分屏全屏

command + T								# 新标签
command + W								# 关闭当前窗口
command + shift + ←/→					# 上/下一个标签

command + shift + , 					# 热重载配置

ghostty +show-config --default --docs	# 查看所有配置项及文档
ghostty +show-config					# 查看当前生效配置
ghostty +list-themes					# 列出所有内置主题
ghostty +list-actions					# 列出所有可绑定动
ghostty --version						# 查看版本


# 配置文件路径
~/Library/Application Support/com.mitchellh.ghostty/config.ghostty
```

## oyconfig-terminal

```bash
control + u                                                  # 清空指令
control + w                                                  # 删除上一个单词
option  + 左/右                                             # Terminal根据单词移动光标
command + 左/右                                             # Terminal根据整行跳转行首尾
command + shift + 左/右                                     # Terminal选中当前整行
command + option + 左/右                                    # Terminal选中当前行左右单词

```

## oyconfig-cli-base

```bash
# 安装基础工具链
xcode-select --install

# 安装 homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 oh-my-zsh 和常用插件
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# 安装插件
mkdir -p  ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins
cd  ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins
git clone https://github.com/zsh-users/zsh-autosuggestions
git clone https://github.com/zsh-users/zsh-syntax-highlighting.git

# 安装 claude
curl -fsSL https://claude.ai/install.sh | bash
claude update

# 安装 codex
curl -fsSL https://chatgpt.com/codex/install.sh | sh

# 安装 opencode
curl -fsSL https://opencode.ai/install | bash

# 安装 github copilot
brew install --cask copilot-cli

# 安装 uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# 安装fnm 和 node
brew install fnm
fnm install --lts  

# 安装 rbenv
brew install rbenv

# 安装 fvm
brew tap leoafarias/fvm
brew install fvm

# 安装 mysql
brew install mysql

# 安装 jenkins (安装推荐插件)
brew install jenkins-lts

# 安装 mole
brew install mole

# 安装视频下载组件
uv tool install yt-dlp

# 安装基础包
brew install fzf zoxide eza ripgrep bat gh imagemagick ffmpeg jq

# 安装字体 (Dropbox)
cd ~/Library/CloudStorage/Dropbox/Config/Font
cp *.ttf ~/Library/Fonts/ 

```

## oyconfig-cli-path

```bash
# mac
/bin                                                            # 系统核心可执行文件路径
/usr/bin                                                        # 系统默认可执行文件路径
/usr/local/bin                                                  # 管理员可执行文件路径
~/.local/bin                                                    # 用户可执行文件路径

~/.zshrc                                                        # 作用于zsh shell
~/.bashrc                                                       # 作用于bash shell
~/.bash_profile                                                 # 作用于bash shell
/etc/profile                                                    # 作用于全局的shell

/etc/hosts                                                      # host文件路径
~/Library/Fonts                                                 # 字体路径
~/Library/Application Support                                   # 三方软件常用的缓存路径

～/Library/LaunchAgents/                                        # 自动化任务路径

# homebrew
/opt/homebrew                                                   # 安装路径
/opt/homebrew/Cellar                                            # 软件包路径
/opt/homebrew/bin                                               # 软件软连接路径

# vim
~/.config/nvim                                                  # 配置路径

# git
~/.gitconfig                                                    # config配置路径

# dart
~/fvm/default/bin/dart                                          # flutter 路径

# python
~/.cache/uv                                                     # uv缓存路径
~/.local/share/uv/python/                                      # 安装的python路径
~/.local/share/uv/tools/                                       # 安装的 python 工具路径
/usr/bin/python3                                                # Xcode 自带的 python 环境   

# ruby
~/.rbenv/versions                                               # ruby版本路径
~/.cocoapods/repos                                              # cocapods组件缓存路径

# go
/usr/local/go                                                   # go编译器路径
~/go                                                            # go依赖组件路径

# java
/Library/Java/JavaVirtualMachines                               # jdk路径
/opt/homebrew/Cellar/maven                                      # maven安装路径
/opt/homebrew/Cellar/maven/3.9.2/libexec                        # maven主目录
/opt/homebrew/Cellar/maven/3.9.2/libexec/conf/settings.xml      # maven设置文件路径
/opt/homebrew/Cellar/maven/3.9.2/libexec/repository             # maven本地仓库路径
/opt/homebrew/etc/tomcat                                        # tomcat安装路径
/opt/homebrew/Cellar/tomcat/10.1.4/libexec                      # tomcat主目录

# rust
~/.rustup                                                       # rust路径
~/.cargo                                                        # cargo路径

# redis
/opt/homebrew/opt/redis/bin/redis-server                        # redis server path
/opt/homebrew/etc/redis.conf                                    # redis config file path

# mysql
/opt/homebrew/etc/my.cnf                                        # 配置路径

# jenkins
~/.jenkins/secrets/initialAdminPassword                         # 初始化密码的路径
```

## oyconfig-brew

```bash
brew search [package]                                           # 查询软件包
brew install [package]                                          # 安装软件包
brew upgrade [package]                                          # 更新软件包
brew uninstall [package]                                        # 卸载软件包
brew info [package]                                             # 查看软件包详细信息
brew update                                                     # 更新配置(例如修改镜像源后执行)
brew outdated                                                   # 查看有可用的更新的软件包
brew cleanup                                                    # 删除旧版本的软件包
brew --version                                                  # 查看brew版本

# brew镜像设置中科大
git -C $(brew --repo) remote set-url origin https://mirrors.ustc.edu.cn/brew.git
brew update

# brew重置默认镜像
cd $(brew --repo)
git remote set-url origin https://github.com/Homebrew/brew.git

# homebrew
/opt/homebrew                                                   # 安装路径
/opt/homebrew/Cellar                                            # 软件包路径
/opt/homebrew/bin                                               # 软件软连接路径

```

## oyconfig-karabiner

```bash
fn                     ------------>     按下🌐键时为更改输入法
shift                  ------------>     fn
capslock + U           ------------>     escape
right command          ------------>     control
capslock + H/J/K/L     ------------>     left / down / up / right

~/.config/karabiner                                             # 键位配置路径

```

## oyconfig-zsh

```bash
source ~/.zshrc         # 更新zshrc
echo SHELL              # 查看当前shell
cat /etc/shells         # 查看已安装shell
chsh -s /bin/zsh        # 切换为zsh重启终端生效

~/.zshrc                                                        # 作用于zsh shell
~/.bashrc                                                       # 作用于bash shell
~/.bash_profile                                                 # 作用于bash shell

# 卸载oh-my-zsh
uninstall_oh_my_zsh

# 安装插件
mkdir -p  ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins
cd  ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins
git clone https://github.com/zsh-users/zsh-autosuggestions
git clone https://github.com/zsh-users/zsh-syntax-highlighting.git
```

## oyagent-claude

```bash
/login                       # 登录
/init                        # 分析工程创建claude.md
/model					     # 选择模型
/clear                       # 清除对话历史
/context					     # 查看上下文类型占比
/compact                     # 压缩上下文(token快消耗完)
/review                      # 代码Review(建议新开一个Session来Review)
/ide						 # 选择连接对应的ide
/doctor					     # 查看健康
/usage					     # 查看用量
/config						 # 查看配置
/permission					 # 查看权限
/exit                        # 退出

! 						     # 临时进入bash 模式
#                            # 补充 claude.md

claude                       # 启动(think --> think ultra)
claude [task]                # 运行一次性任务
claude -p [task]             # 运行一次性任务并退出
claude -c                    # 继续最近的对话
claude -r                    # 恢复之前的对话
claude --enable-auto-mode    						# 自动模式
claude --dangerously-skip-permissions				# 危险模式

claude mcp list				 # 查看 mcp 列表
claude mcp add [mcp server]  # 新增 mcp

shift + tab                  # 模式切换(normal/accept edit/plan)
esc + esc                    # 有内容时移除所有内容 / 无内容是进入切换历史问题
command + esc			     # vscode 插件开启会话快捷键

~/.claude/settings.json      #  claude code 配置路径

claude plugin install figma@claude-plugins-official

/plugin marketplace add jarrodwatts/claude-hud
/plugin install claude-hud
/reload-plugins
/claude-hud:setup

# 移除 claude
rm -rf ~/.claude
rm ~/.claude.json
rm -f ~/.local/bin/claude
rm -rf ~/.local/share/claude

```

## oyagent-codex

```bash
/init                        # 初始化工程
/compact                     # 压缩上下文
/model                       # 切换模型
/approvals                   # 修改权限
/review                      # 代码Review
/new                         # 开始新会话

```

## oyconfig-openspec

```bash
# 安装 openspc
npm install -g @fission-ai/openspec@latest

# 更新openspec
openspec update

openspec init					# 初始化项目

/openspec:proposal [proposal]	# 创建变更提案

openspec list					# 查看当前提案
openspec validate [proposal]	# 验证提案格式
openspec show [proposal]		# 查看提案详情

/openspec:apply	[proposal]		# 实现提案

openspec archive [proposal]		# 归档提案

#           +----------+
#           | 起草提案 |
#           +----------+
#                |
#                v
#           +----------+
#           | 审查对齐 |
#           +----------+
#                |
#                v
#           +----------+
#           | 实现任务 |
#           +----------+
#                |
#                v
#           +----------+
#           | 归档更新 |
#           +----------+

```

## oyconfig-curl

```bash
# 查看当前IP信息
curl https://ipinfo.io

# 发起请求
curl -s https://www.sample.com/sample \
    -X POST
    -H "Content-Type: application/json" \
    -d '{"key":"value"}'

```

## oyconfig-git

```bash
       +-----------------+      +-----------------+      +-----------------+
       |    edit area    | ---> |   stage area    | ---> |   commit area   |
       +-----------------+      +-----------------+      +-----------------+
              工作区                  暂缓区                    版本库

git init                                                        # 初始化仓库
git clone [url]                                                 # 下载代码仓库
git clone [url] [directory]                                     # 下载代码仓库到指定目录
git clone [url] -b [branch] [directory]                         # 下载代码仓库到指定目录并切换分支
git clone [url] -b [branch] --single-branch --depth 1           # 下载代码仓库的单个分支上的最近一次commit

git add .                                                       # 将工作区所有修改放到暂存区
git add [file]                                                  # 将工作区指定文件修改放到暂缓区
git checkout .                                                  # 将工作区所有修改都丢弃

git reset                                                       # 将暂缓区所有修改放到工作区
git reset [file]                                                # 将暂缓区指定文件修改放到工作区
git reset --hard                                                # 将暂缓区和工作区所有修改都恢复到最后一次提交
git commit -m [message]                                         # 提交到本地仓库

git status                                                      # 查看当前工作区和暂缓区状态

git diff                                                        # 输出工作区和暂缓区差异
git diff --staged                                               # 输出暂缓区和版本库差异
git diff [branchB]...[branchA]                                  # 输出分支A和分支B差异

git show [SHA]                                                  # 以人类可读的格式显示Git中的任何对象

git log                                                         # 查看提交记录
git log [branchB]..[branchA]                                    # 显示分支A上不在分支B上的提交
git log --follow [file]                                         # 显示更改文件的提交，即使跨重命名

git branch                                                      # 查看仓库所有本地分支
git branch -av                                                  # 查看仓库所有本地分支和远程分支
git checkout -b [new_branch]                                    # 创建一个新的分支
git branch -d [branch]                                          # 删除某个分支
git checkout [branch]                                           # 切换分支
git merge [branch]                                              # 把某个分支合并到当前分支

git rebase -i [commit]                                          # 合并当前提交到commit的上一个提交之间所有提交
git rebase --continue                                           # 合并多个提交如果有冲突,解决冲突后继续执行
git rebase --abort                                              # 取消本次Rebase操作

git revert [commit]                                             # 撤回某个commit并产生一个新提交
git revert -n [commitA]^..[commitB]                             # 撤回多个连续commit并产生一个新提交

git cherry-pick [commitA]^..[commitB]                           # cherry-pick(包含A和B)

git remote add url                                              # 添加远程仓库
git fetch                                                       # 拉取远程代码
git pull                                                        # 拉取远程代码并合并
git push origin [branch]                                        # 推送代码并合并
git push --force                                                # 强制推送代码并合并

git cat-file -t [HASH]                                          # 查看Git中对象的类型
git cat-file -p [HASH]                                          # 查看Git中对象的内容
git ls-files -s                                                 # 查看索引内所有文件

git worktree add [relative_path] [branch]                       # 在指定路径创建对应分支仓库,可在新路径完成需求
git worktree list                                               # 列出worktree
git worktree remove [worktreeName]                              # 移除对应工worktree

git config  --list                                              # 查看仓库Git配置
git config --local user.name [name]                             # 配置仓库用户名
git config --local user.email [email]                           # 配置仓库邮箱
git config --local http.proxy socks5://127.0.0.1:7897           # 设置仓库代理
git config --local https.proxy socks5://127.0.0.1:7897          # 设置仓库代理
git config --local --unset http.proxy                           # 取消设置仓库代理
git config --local --unset https.proxy                          # 取消设置仓库代理

git config --global --list                                      # 查看全局Git配置
git config --global user.name [name]                            # 配置全局用户名
git config --global user.email [email]                          # 配置全局邮箱
git config --global http.proxy socks5://127.0.0.1:9981          # 设置全局代理
git config --global https.proxy socks5://127.0.0.1:9981         # 设置全局代理
git config --global --unset http.proxy                          # 取消设置全局代理
git config --global --unset https.proxy                         # 取消设置全局代理
git config --global color.ui auto                               # 启用Git输出的一些着色

# git
~/.gitconfig                                                    # config配置路径

------------------------------------------------------------------------------

git checkout master
git merge develop     ===> fast-forward

                                (before merge)      (after merge)
                                    master              master
                                      ^                   ^
                                      |                   |
                                      |                   |
      +---+     +---+     +---+     +---+     +---+     +---+
      | A | --> | B | --> | C | --> | D | --> | E | --> | F |
      +---+     +---+     +---+     +---+     +---+     +---+
                                                          ^
                                                          |
                                                          |
                                                       develop

------------------------------------------------------------------------------

git checkout master
git merge develop       ===> three-way-merge

                              +---+
                              | X |  <-- master (after merge)
                              +---+
                                ^
                                |
                              +---+
   (before merge) master ---> | N |
                              +---+
                                ^
                                |
                              +---+
                              | M |
                              +-+-+
                                ^
                                |
+---+     +---+     +---+     +---+     +---+     +---+
| A | --> | B | --> | C | --> | D | --> | E | --> | F |
+---+     +---+     +---+     +---+     +---+     +---+
                                                    ^
                                                    |
                                                    |
                                                 develop

-------------------------------------------------------------------------------

git checkout develop
git rebase master        ===> rebase

                              +---+     +----+     +----+
   (before merge) master ---> | N | --> | E1 | --> | F1 |   <----develop after rebase
                              +---+     +----+     +----+
                                ^
                                |
                              +---+
                              | M |
                              +---+
                                ^
                                |
+---+     +---+     +---+     +---+     +---+     +---+
| A | --> | B | --> | C | --> | D | --> | E | --> | F |   <----- develop
+---+     +---+     +---+     +---+     +---+     +---+
```

## oyconfig-cron

```bash
crontab -e                                                      # 编辑定时任务
crontab -l                                                      # 查看定时任务

# 需要授予/usr/sbin/cron完全磁盘权限
#
# 0 * * * * sh /Users/oyca168/Library/CloudStorage/Dropbox/Script/snippet_xcode_auto_commit.sh
# 0 * * * * sh /Users/oyca168/Library/CloudStorage/Dropbox/Script/snippet_vscode_auto_commit.sh
```

## oyconfig-ssh

```bash
# 生成密钥对并拷贝公钥可交给Gitlab
ssh-keygen -t rsa -C oyca168@gmail.com -f ~/.ssh/id_rsa
cd ~/.ssh && ls
cat id_rsa.pub | pbcopy

# ssh登录远程主机
ssh root@[ipAddress]

# 建立安全连接
服务器公钥地址: /etc/ssh/ssh_host_rsa_key.pub
服务器私钥地址: /etc/ssh/ssh_host_rsa_key
客户端存储服务器公钥信息地址:~/.ssh/know_hosts(从这里判断是否是中间人攻击)

# 客户端认证
客户端公钥地址:~/.ssh/id_rsa.pub
客户端私钥地址:~/.ssh/id_rsa
服务器授权文件地址: ~/.ssh/authorized_keys (会把客户端公钥内容追加到授权文件尾部)

# ssh相关指令
ssh root@10.202.163.239         // 连接服务器
ssh-keygen -R 10.202.163.239    // 清空know_hosts文件里面的信息
ssh-copy-id root@10.202.163.239 // 把客户端公钥内容追加到收尾文件尾部
```

## oyconfig-swift

```bash
swift package init --type executable                           # 创建cli
swift package update                                           # 更新依赖
```

## oyconfig-node

```bash
fnm list                                                    # 查看本地版本
fnm ls-remote                                               # 查看可安装版本
fnm install --lts                                           # 安装最新LTS版本

fnm install 24.21.0                                         # 安装指定版本
fnm default 24.21.0                                         # 指定全局版本
fnm use 24.21.0                                             # 指定会话版本
fnm uninstall 24.21.0                                       # 卸载指定版本

npm init -y                                                 # 初始化项目
npm install                                                 # 安装所有依赖
npm install --global [package]                              # 安装全局依赖
npm install --save [package]                                # 安装项目依赖包并写入
npm install --save-dev [package]                            # 安装项目开发依赖
npm list -g --depth 0                                       # 查看本地安装包
```

## oyconfig-yarn

```bash
npm install --global yarn                      # 全局安装yarn
yarn --version                                 # 查看yarn版本
yarn init -y                                   # 初始化项目
yarn add [sample]                              # 安装项目依赖
yarn global add typescript                     # 安装全局依赖
yarn remove lodash                             # 移除依赖
```

## oyconfig-babel

```bash
npm install babel-cli                                       # 全局安装babel
npm install --save-dev babel-preset-es2015                  # 安装babel
babel main.js -o artfact.js                                 # ES6转化ES5/JSX转化为JS
```

## oyconfig-vue

```bash
yarn init -y                                                # 初始化项目
yarn add -D vite                                            # 添加开发依赖
yarn add vue                                                # 添加vue依赖

yarn create vue                                             # 创建vue项目(一步到位)
yarn install                                                # 安装项目依赖
```

## oyconfig-react

```bash
npm install -g create-react-app                             # 安装react脚手架

create-creat-app [project]                                  # 创建react工程(js模板)
create-react-app [project] --template typescript            # 创建react工程(ts模板)
npm start                                                   # 运行react工程

npx react-native init [project]                             # 创建RN工程（npx表示用完即走的意思）
npx react-native start                                      # 开启Metro
npx react-native run-ios                                    # 运行RN工程

```

## oyconfig-typescript

```bash
npm install typescript -g                                   # 安装全局依赖
yarn add typescript -D                                      # 安装项目依赖

yarn tsc -v                                                 # 查看ts版本号
tsc main.ts                                                 # ts转化为js
ts-note main.ts                                             # 直接运行ts
tsc -w                                                      # 监听ts源码变化立即转化为js
tsc --init                                                  # 创建tsconfig.json配置

------------------------------------------------------------------------------------

// tsconfig.json配置文件
{
    compilerOptions: {
      target: es5                                          // 指定生成代码语言版本
      lib: [                                               // 指定要包含在编译中的Library
        dom
        dom.iterable
        esnext
      ],
      allowJs: true,                                        // 允许ts编译器编译js文件
      skipLibCheck: true,                                   // 跳过声明文件的类型检查
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,                   // 允许及时没有默认导出依旧可以采用 import x from filepat
      strict: true,                                         // 开启严格模式
      forceConsistentCasingInFileNames: true,               // 强制区分文件名称大小写
      noFallthroughCasesInSwitch: true,                     // 启用switch语句错误报告
      module: esnext                                        // 指定生成代码的模块化标准
      moduleResolution: node                                // 指定模块解析（查找）策略
      resolveJsonModule: true,                              // 允许导入扩展名为.json的模块
      isolatedModules: true,                               j // 是否将没有import/export文件视为旧(全局而非模块化)脚本文件
      noEmit: true,                                         // 编译不生成任何文件,只进行类型检查
      jsx: react-jsx                                        // 指定jsx编译形式
    },
    include: [                                              // 指定允许ts处理的目录
      src
    ]
}

------------------------------------------------------------------------------------

```

## oyconfig-flutter

```bash
fvm list                                                       # 查看已安装flutter
fvm install 3.41.1                                             # 安装flutter
fvm remove 3.41.1                                              # 安装flutter
fvm use 3.41.1                                                 # 设置工程版本
fvm global 3.41.1                                              # 设置全局版本

flutter create [sample]                                        # 创建工程
flutter run                                                    # 运行工程
flutter precache                                               # 预下载开发二进制文件供离线开发使用(Git安装)
flutter doctor                                                 # 检查开发环境

# flutter
~/fvm/default/bin/flutter                                       # flutter 路径

```

## oyconfig-python

```bash
uv init                                                        # 创建python环境
uv sync                                                        # 同步依赖
uv lock                                                        # 创建Lockfile记录项目依赖
uv run                                                         # 运行工程
uv tree                                                        # 查看工程依赖树
uv build                                                       # 构建产物
uv publish                                                     # 发布项目
uv add [package]                                               # 新增依赖
uv remove [package]                                            # 移除依赖
uv run                                                         # 运行当前目录下的Python脚本

uv tool list									       		   # 查看已安装工具
uv tool install [package]					     			   # 全局命令行工具(例如 ruff)
uv tool upgrade [package]									   # 更新命令行工具

uv python install 3.12                                         # 安装python(目前最兼容版本)
uv python find                                                 # 查找本地可用的python版本
uv python pin                                                  # 锁定当前项目的python版本
uv python uninstall 3.12                                       # 卸载python
uv python list                                                 # 查找已按照和可安卓的python版本

# python
~/.cache/uv                                                     # uv缓存路径

# python vscode 配置
{
  terminal.integrated.env.osx: {
    PYTHONPATH:  workspaceFolder/Utils
  },
  python.analysis.extraPaths: [${workspaceFolder}/Utils] // 指定其他导入搜索解析路径
}

# PEP723(内联脚本依赖,Python官方标准非uv私有): 脚本开头声明依赖,uv run 直接跑,自动建临时环境,不留痕迹
# /// script
# dependencies = ["requests"]
# requires-python = ">=3.11"     # 不写则用全局默认 pin 版本
# ///
uv run script.py

```

## oyconfig-ruby-rbenv

```bash
rbenv install --list                                           # 查看可安装的版本
rbenv versions                                                 # 查看已安装版本Ruby
rbenv install 3.3.12                                            # 安装对应版本Ruby
rbenv uninstall 3.3.12                                          # 移除对应版本Ruby
rbenv rehash                                                   # 重新生成环境变量缓存
rbenv global 3.3.12                                            # 设置全局Ruby
rbenv shell 3.3.12                                              # 设置当前会话版本Ruby

# ruby
~/.rbenv/versions                                               # ruby版本路径
~/.cocoapods/repos                                              # cocapods组件缓存路径

```

## oyconfig-ruby-gem

```bash
gem source -l                                                  # 查看源
gem source --remove https://rubygems.org/                      # 删除源
gem sources --add https://gems.ruby-china.com                  # 增加源
gem which [GEM_NAME]                                           # 查看插件安装路径
gem install [GEM_NAME]                                         # 安装创建管理插件
debase                                                         # 调试组件可以写入Gemfile并统一install
solargraph                                                     # 调试组件可以写入Gemfile并统一install
ruby-debug-ide                                                 # 调试组件可以写入Gemfile并统一install

```

## oyconfig-ruby-bundle

```bash
gem install bundler -v "=2.5.3"                              # 安装bundler
bundle init                                                    # 初始化环境
bundle install                                                 # 安装依赖,通过Gemfile管理依赖
bundle update                                                  # 更新依赖,通过Lockfile锁定依赖
bundle info [GEM_NAME]                                         # 查看依赖信息
bundle open [GEM_NAME]                                         # 打开Gem相关代码(export EDITOR='Code'
bundle config set --local path .bundle                         # 安装依赖到工程目录
bundle config set install --without 'debug'                    # 排除debug group安装
bundle config unset without                                    # 移除之前的排除规则
bundle exec [command] [options]                                # 执行指令(在当前环境中)
bundle exec rake release                                       # 发布Gem

---------------------------------------------------------------------------------------
source 'https://gems.ruby-china.com'

# 指定镜像源
gem 'cocoapods', source: 'https://gems.company.com'

# Git 引入依赖
gem 'cocoapods', git: '', branch: '',
                 git: '', ref: ''
                 tag: '',

# 本地依赖
gem 'cocoapods', :path => '../path'

path '../Gems' do
  gem 'sample_gem_a'      # sample_gem_a.gemspec
  gem 'sample_gem_b'      # sample_gem_b.gemspec
end

# group 依赖
gem 'cocoapods', group: :debug

group :defalut do         # 可以省略,默认就是default group
  gem 'sample_gem_a'
  gem 'sample_gem_b'
end

group :development do
  gem 'sample_development_gem_a'
  gem 'sample_development_gem_b'
end

group :debug do
  gem 'sample_test_gem_a'
  gem 'sample_test_gem_b'
end

```

## oyconfig-ruby-cocoapods

```bash
pod init                                                       # 创建Podfile
pod install                                                    # 安装依赖
pod update                                                     # 更新依赖
pod repo update                                                # 更新本地Repo
pod lib create [POD_NAME]                                      # 创建组件
pod cache clean -all                                           # 清除缓存

pod plugins create [PLUGINS_NAME]                              # 创建pod插件
sudo gem build [PLUGINS].gemspec                               # 编译插件
sudo gem install [PLUGINS]                                     # 安装插件
pod plugins installed                                          # 查看已安装pod插件

pod --version                                                  # 查看cocoappod版本

---------------------------------------------------------------------------------------

install! 'cocoapods',
:generate_multiple_pod_projects => true,                       # 开启为每个Pod创建独立Project
:deterministic_uuids => true,                                  # 开启生成确定的UUID
:warn_for_unused_master_specs_repo => true,                    # 开启Master Specs Repo的告警

inhibit_all_warnings!                                          # 禁止所有第三方库的告警

use_frameworks!                                                # 根据各个组件的podspec的static_framework链接方式进行
use_frameworks! :linkage => :static                            # 使用静态链接
use_frameworks! :linkage => :dynamic                           # 使用动态链接

# ruby
~/.rbenv/versions                                               # ruby版本路径
~/.cocoapods/repos                                              # cocapods组件缓存路径

# ruby 配置
{
  version: 0.2.0,
  configurations: [
    {
      name: Debug-CocoaPods-install,             // 调试名称
      type: rdbg,                                // 调试器类型
      request: launch,                           // 请求类型
      script: workspaceFolder/CocoaPods/bin/pod,
      args: [install],                           // 调试参数
      cwd:  workspaceFolder/iOS-App-Project   // 工作目录,设置为Xcode项目路径
    },
    {
      name: Debug-CocoaPods-update,              // 调试名称
      type: rdbg,                                // 调试器类型
      request: launch,                           // 请求类型
      script: workspaceFolder/CocoaPods/bin/pod,
      args: [update],                            // 调试参数
      cwd:   workspaceFolder/iOS-App-Project  // 工作目录,设置为Xcode项目路径
    }
  ]
}

```

## oyconfig-ruby-fastlane

```bash
bundle init                                                    # 初始化bundle
gem 'fastlane', '2.219.0'                                      # Gemfile添加fastlane依赖
bundle install                                                 # 安装依赖
bundle exec fastlane init                                      # 初始化fastlane
bundle exec fastlane list                                      # 查看所有lane
bundle exec fastlane [lane]                                    # 调用lane
bundle exec fastlane new_action                                # 创建action
bundle exec fastlane run [action] [key]:[value]                # 运行action
bundle exec fastlane action [action]                           # 查看action
bundle exec fastlane add_plugin [plugin]                       # 新增插件
bundle exec fastlane install_plugins                           # 安装插件(fastfile)
bundle exec fastlane new_plugin [plugin]                       # 创建插件

#
# - lane的工作目录是fastlane目录
# - action的工作目录是工程目录

```

## oyconfig-go

```bash
# go
/usr/local/go                                                   # go编译器路径
~/go                                                            # go依赖组件路径

go env -w GO111MODULE=on                                       # 设置包管理方式(必要)
go env -w GOPROXY=https://goproxy.cn,direct                    # 设置代理(必要)
go env -w GOPRIVAT=[source]                                    # 配置私有组件获取地址
go env GOPATH                                                  # 查看三方依赖路径
go env GOROOT                                                  # 查看Go编译器路径

go build main.go                                               # 编译
go build -x main.go                                            # 编译并展示详细信息
go build -o new_name main.go                                   # 指定二进制产物名称

go run main.go                                                 # 运行
go run -x main.go                                              # 运行并展示详细信息

go mod init                                                    # 启动modulues初始化工程
go mod download                                                # 下载模块到本地缓存，缓存路径是 GOPATH/pkg/mod/cache
go mod graph                                                   # 把模块之间的依赖图显示出来
go mod tidy                                                    # 增加缺失的包，移除没用的包

go get github.com/go-sql-driver/mysql                          # 安装依赖
go install xxx                                                 # 编译并安装以来
go clean                                                       # 清除缓存
go list                                                        # 查看当前工程所有依赖
go tool                                                        # 运行Go提供的工具
go version                                                     # 查看Go版本
go fmt main.go                                                 # 格式化main文件

go install/update                                              # VSCode插件配置(command + shift + p)

# 开发模式 & 常用命令
#
#  GOPATH模式: 默认可以通过go env可以查看环境配置中的GOPATH,路径中会有bin/pkg/src三个文件夹;
#              bin存放编译后生成的可执行文件/pkg存放编译后的库文件/src存放本地开发源代码文件;
#              可以通过手动强指定GOPATH路径,自创建bin/pkg/src文件夹并指定环境变量;
#              该模式存在无法强指定项目依赖版本号等弊端;
#
#  GOModules模式:从GO1.11版本推荐使用,解决Go语言长期的依赖管理问题,淘汰之前的GOPATH使用模式;
#               统一社区中依赖管理工具;
#

```

## oyconfig-rust

```bash

rustc --version                                                # 查看Rust版本
rustup update stable                                           # 更新Rust
rustup self uninstall                                          # 移除Rust
rustup component add rustfmt                                   # 添加组件

cargo new [project]                                            # 创建项目
cargo install cargo-edit                                       # 安装插件
cargo build                                                    # 构建项目
cargo build --release                                          # 构建项目(发布模式)
cargo run                                                      # 运行项目
cargo test                                                     # 测试项目
cargo doc                                                      # 构建文档
cargo publish                                                  # 发布库
cargo --version                                                # 查看cargo版本

# rust
~/.rustup                                                       # rust路径
~/.cargo                                                        # cargo路径
```

## oyconfig-java

```bash
sudo rm -rf /Library/Java/JavaVirtualMachines                 # 卸载jdk
brew install tomcat                                           # 安装tomcat
catalina run                                                  # 启动tomcat
catalina version                                              # 查看tomcat版本

# java
/Library/Java/JavaVirtualMachines                               # jdk路径
/opt/homebrew/Cellar/maven                                      # maven安装路径
/opt/homebrew/Cellar/maven/3.9.2/libexec                        # maven主目录
/opt/homebrew/Cellar/maven/3.9.2/libexec/conf/settings.xml      # maven设置文件路径
/opt/homebrew/Cellar/maven/3.9.2/libexec/repository             # maven本地仓库路径
/opt/homebrew/etc/tomcat                                        # tomcat安装路径
/opt/homebrew/Cellar/tomcat/10.1.4/libexec                      # tomcat主目录

```

## oyconfig-maven

```bash
/*********************************** maven 基础 *****************************************/

brew install maven                                            # 安装maven
mvn archetype:generate                                        # 创建java工程
mvn archetype:generate -DgroupId=com.example                  # 创建web工程
    -DartifactId=mywebapp
    -DarchetypeArtifactId=maven-archetype-webapp
    -DinteractiveMode=false
mvn compile                                                   # 主程序编译(target/classes)
mvn test-compile                                              # 测试程序编译(target/test-classes)
mvn clean                                                     # 清理项目
mvn test                                                      # 执行测试程序
mvn install                                                   # 安装程序到本地仓库
mvn package                                                   # 打包(war)
mvn dependency:tree                                           # 查看依赖

mvn clean install -Dmaven.test.skip=true                      # 自定义组合命令

/*********************************** maven 配置 *****************************************/

# 打开maven配置
open /opt/homebrew/Cellar/maven/3.9.2/libexec/conf/settings.xml

# 配置maven镜像
<mirror>
    <id>aliyun</id>
    <mirrorOf>central</mirrorOf>
    <name>aliyun</name>
    <url>https://maven.aliyun.com/repository/public</url>
</mirror>

<mirror>
    <id>nexus-aliyun</id>
    <mirrorOf>central</mirrorOf>
    <name>nexus-aliyun</name>
    <url>http://maven.aliyun.com/nexus/content/groups/public</url>
</mirror>

# 配置maven本地仓库
<localRepository>/Users/oyca168/.m2/repository</localRepository>

/*********************************** pom 配置 *****************************************/

# 自定义属性标签
<propertyies>
    <oyca.spring.version>1.0.0<oyca.spring.version>
</propertyies>

# 依赖集成
<dependencys>
    <dependency>
        <groupId>groupId</groupId>
        <artifactId>artifactId</artifactId>
        <version>version</version>
        <scope>test</scope>
    </dependency>
</dependencys>

# 依赖排除
<exclusions>
    <exclusion>
        <groupId>groupId</groupId>
        <artifactId>artifactId</artifactId>
    </exclusion>
</exclusions>

# 父工程中指定子工程(即使父工程已经有依赖某组件,子工程需要也显示指定该依赖)
<modules>
    <module>child-module1</module>
    <module>child-module2</module>
    <module>child-module3</module>
</modules>

<dependencyManagement>
    <dependency>
        <groupId>groupId</groupId>
        <artifactId>artifactId</arto`ifactId>
        <version>version</version>
    </dependency>
</dependencyManagement>

# 子工程中关联父工程(如父工程已依赖某组件,子工程可以无需再写version)
<parent>
    <groupId>parentGroupId</groupId>
    <artifactId>parentArtifactId</artifactId>
    <version>version</version>
</parent>

<dependencys>
    <dependency>
        <groupId>groupId</groupId>
        <artifactId>artifactId</artifactId>
    </dependency>
</dependencys>

# 依赖范围
+--------------------------------------------------------------------+
|   关键字  |   主目录  | 测试目录  |    开发   |   打包     |  依赖传递性 |
|--------------------------------------------------------------------|
|  compile |   yes    |   yes    |   yes    |    yes    |    yes     |  (实际运行依赖)
|--------------------------------------------------------------------|
|  test    |    no    |   yes    |   yes    |    no     |    no      |  (测试依赖)
|--------------------------------------------------------------------|
| provided |   yes    |   yes    |   yes    |    no     |    no      |  (服务器已提供的依赖,不必重复部署,防止冲突)
+--------------------------------------------------------------------+

```

## oyconfig-mysql

```bash
mysql.server start                                          # 启动mysql服务
mysql.server stop                                           # 停止mysql服务
mysql_secure_installation                                   # 安装mysql后修改密码(另外开一个终端会话执行此命令)
show global variables like 'port';                          # 查询mysql占用端口
mysql -u root -p                                            # 密码登录mysql
mysql -h [ipAddress] -P [port] -u [user] -p [password]      # 密码登录mysql
exit                                                        # 退出mysql

# 修改mysql授权方式
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'yournewpassword';
FLUSH PRIVILEGES;

# mysql
/opt/homebrew/etc/my.cnf                                        # 配置路径

```

## oyconfig-jenkins

```bash
jenkins-lts                                                     # 启动jenkins

# Jenkins
#
# - 安装插件: Jenkins -> Manage Jenkins -> Manage Plugins -> ansicolor / rebuild / description setter -> 安装插件
#
# - 全局配置: Jenkins -> Authentication -> 安全域 -> 允许用户注册 -> 保存
#             Jenkins -> 授权策略 -> 登录用户可以做任何事 -> 保存
#             Jenkins -> 全局安全配置 -> 标记格式器 -> Safe HTML
#             Jenkins -> 用户 -> 设置 -> API Token -> 添加新Token
#
# - 新建任务: 新建任务 -> 输入一个任务名称 -> 保存
#
# - 任务配置: Jobs -> General -> 参数话构建过程 -> 添加参数
#             Jobs -> 源码管理 ->
#             Jobs -> 构建触发器 ->
#             Jobs -> 构建环境 -> 执行shell -> 保存
#             Jobs -> 构建 ->
#             Jobs -> 构建后操作 -> Set build description -> Regular expression (根据正则从日志提取出链接生成二维码)
#             Jobs -> 构建后操作 -> Description -> <img src="\1" height="320" width="320">

# jenkins
~/.jenkins/secrets/initialAdminPassword                         # 初始化密码的路径

```

## oyconfig-mole

```bash
mo                           # 交互式菜单
mo clean                     # 深度清理
mo uninstall                 # 卸载应用 + 清理残留
mo optimize                  # 刷新缓存与系统服务
mo analyze                   # 可视化磁盘空间分析器
mo status                    # 实时系统健康状态仪表盘
mo purge                     # 清理项目构建产物
mo installer                 # 查找并移除安装器文件

mo touchid                   # 配置 Touch ID 用于 sudo
mo completion                # 设置 shell 的 Tab 自动补全
mo update                    # 更新 Mole
mo update --nightly          # 更新到最新未发布的 main 构建（仅脚本安装支持）
mo remove                    # 从系统中移除 Mole
mo --help                    # 显示帮助
mo --version                 # 显示已安装版本

```


## text

```text
Text("Hello world",
  style: TextStyle(
    color: Colors.blue,
    fontSize: 18.0,
    height: 1.2,  
    fontFamily: "Courier",
    background: Paint()..color=Colors.yellow,
    decoration:TextDecoration.underline,
    decorationStyle: TextDecorationStyle.dashed
  ),
);

```

## button

```text
TextButton.icon(
  icon: Icon(Icons.info),
  label: Text("详情"),
  onPressed: _onPressed,
),

```

## image

```text
Image(
  image: NetworkImage(
      "https://avatars2.githubusercontent.com/u/20411648?s=460&v=4"),
  width: 100.0,
)

```

## textField

```text
TextField(
  decoration: InputDecoration(
    labelText: "请输入用户名",
    prefixIcon: Icon(Icons.person),
    // 未获得焦点下划线设为灰色
    enabledBorder: UnderlineInputBorder(
      borderSide: BorderSide(color: Colors.grey),
    ),
    //获得焦点下划线设为蓝色
    focusedBorder: UnderlineInputBorder(
      borderSide: BorderSide(color: Colors.blue),
    ),
  ),
),

```

## progress

```text
LinearProgressIndicator(
  backgroundColor: Colors.grey[200],
  valueColor: AlwaysStoppedAnimation(Colors.blue),
  value: .5, 
)

```

## row

```text
Row(
  mainAxisAlignment: MainAxisAlignment.center,
  children: <Widget>[
    Text(" hello world "),
    Text(" I am Jack "),
  ],
),

```

## column

```text
Column(
  crossAxisAlignment: CrossAxisAlignment.center,
  children: <Widget>[
    Text("hi"),
    Text("world"),
  ],
);

```

## android快捷键

```dart
stf / stl                 # 快速创建 StatefulWidget / StatelessWidget
option + 回车             # 快速修复（Quick Fix）
option + 回车             # 自动生成构造函数（选中 final 参数）
option + 回车             # 添加父组件 / 转子组件 / 删除组件
双击 shift                # 全局搜索（Search Everywhere）
command + E               # 查看最近打开的文件
fn + shift + F6           # 重命名
command + fn + F12        # 查看当前类结构
command + 点击            # 查看源码（跳转定义）
command + B               # 查看声明 / 跳转
option + command + B      # 查看实现（子类）
command + R               # 运行到模拟器
option + enter            # 导入类（auto import）
option + command + ←      # 后退
option + command + →      # 前进
command + shift + F       # 全局搜索
command + shift + R       # 全局替换
option + shift + F7       # 查找引用

# 提取方法
refactor --->  extract method  

# 提取widget
refactor --->  extract widget

```

## vSCode 快捷键

```dart
stf / stl                 # 快速创建 StatefulWidget / StatelessWidget
command + .               # 快速修复 / 自动生成代码 / 添加父组件等
command + shift + T       # 重新打开关闭的编辑页
command + T               # 通过文件名搜索并打开文件
shift + option + F        # 代码格式化
command + J               # 打开/关闭控制台（Terminal / Debug Console）
command + 点击            # 查看源码（跳转定义）
command + F12             # 查看实现（子类/实现类）
ctrl + -                  # 后退（返回上一个位置）
command + .               # 自动导入类（auto import）
command + shift + F       # 全局搜索
option + ↑ / ↓            # 当前行与上一行/下一行交换位置
option + shift + ↓        # 复制当前行到下一行

flutter run               # 运行当前连接的设备
flutter run -d 设备id     # 运行到指定设备

q                         # 停止运行（运行中终端输入）
r                         # 热重载（Hot Reload）

command + K               # 清空终端输出

flutter clean             # 清理缓存（解决异常常用）
flutter --version         # 查看 Flutter 版本

```

## 常量 - 局部

```bash
local $NAME=$value

# 等号两边不得有空格且常量命名全部大写

```

## 常量 - 全局

```bash
$NAME=$value

# 等号两边不得有空格且常量命名全部大写

```

## 变量 - 局部

```bash
local $name=$value

# 等号两边不得有空格

```

## 变量 - 全局

```bash
$name=$value

# 等号两边不得有空格

```

## 流程控制 - if

```bash
if $condition; then
    $content
elif $condition; then
    $content
else
    $content
fi

```

## 流程控制 - if - string

```bash
if [[ -z "$$name" ]]; then
    $content
elif [[ -n "$$name" ]]; then
    $content
else
    $content
fi

```

## 流程控制 - if - lastcommand

```bash
# 接收上一条指令的结果
local $ret=$?
if [ $$ret -ne 0 ]; then
    echo failure
    exit $$ret
else
    echo success
fi

```

## 数字 - 判断

```bash
# 数字相关
[[ $name1 -eq $name2 ]];                   # 等于
[[ $name1 -ne $name2 ]];                   # 不等于
[[ $name1 -lt $name2 ]];                   # 小于
[[ $name1 -le $name2 ]];                   # 小于等于
[[ $name1 -gt $name2 ]];                   # 大于
[[ $name1 -ge $name2 ]];                   # 大于等于
(( $name1 < $name2 ));                     # 小于
(( $name1 <= $name2 ));                    # 小于或等于
(( $name1 > $name2 ));                     # 比...更大
(( $name1 >= $name2 ));                    # 大于等于

```

## 字符串 - 判断

```bash
# 字符串比较
[[ -z $name ]];                         # 空字符串
[[ -n $name ]];                         # 非空字符串
[[ $name1 = $name2 ]];               # 相等字符串
[[ $name1 == $name2 ]];              # 相等字符串
[[ $name1 != $name2 ]];              # 不等字符串

# 返回替换字符串
\${$str/$sub_string/$replace_sub_string}

```

## 数组 - 定义

```bash
# 定义数组
$array = ($item1 $item2 $item3)

# 定义数组
$array = ('$item1' '$item2' '$item3')

```

## 数组 - 基础

```bash
# 数组访问
${$Array[0]}        # 首元素
${$Array[-1]}       # 尾元素
${$Array[*]}        # 全部元素
${$Array[@]}        # 全部元素

# 数组遍历
for i in "\\${!$Array[@]}"; do
  printf "%s %s \n" "$i" "${$Array[$i]}"
done

```

## 函数 - 参数

```bash
\$0                               # 脚本自身名称
\$1...\$9                          # 第1...9个参数
\$#                               # 参数数量
\$*                               # 所有参数
\$@                               # 所有参数，从第一个开始

\$?                               # 上一个任务的退出状态
\$!                               # 上一个后台任务的 PID
\$_                               # 上一个命令最后一个参数
\$$                               # shell PID
\$-                               # 当前选项

```

## 函数-作用域

```bash
# 作用域:
#
# - 每次调用bash/sh解释器执行脚本,会重新开启一个子shell,并且不保留父shell的变量,可以通过pstree检查进程树
# -

```

## 关键字 - export

```bash
export基础

- 将变量或函数声明为环境变量，使得它们在子进程中可用;

```

## 正则表达式

```bash
^           # 定位符表示锚定某一个字符开头
$           # 定位符表示锚定某一个字符结尾

.           # 匹配符表示匹配除回车以外的任意字符
()          # 匹配符表示字符串分组
[]          # 匹配符表示定义字符类，匹配括号中的一个字符

*           # 限定符,如果加在某个字符之后表示该字符不出现或出现多次
?           # 限定符,如果加在某个字符之后表示该字符不出现或只出现一次
+           # 限定符,如果加在某个字符之后至少要出现一次
{m}         # 限定符,如果加在某个字符之后表示该字符正好出现了m次
{n,m}       # 限定符,如果加在某个字符之后表示该字符最少n次,最多m次

```

## 目录 - 基础

```bash
# 判断是否为目录
[-d "${name}" ];

```

## 文件 - 基础

```bash
# 文件比较
[[ -e FILE ]];                        # 存在
[[ -d FILE ]];                        # 目录
[[ -f FILE ]];                        # 文件
[[ -h FILE ]];                        # 符号链接
[[ -s FILE ]];                        # 大小 > 0 字节
[[ -r FILE ]];                        # 可读
[[ -w FILE ]];                        # 可写
[[ -x FILE ]];                        # 可执行文件

```

## grep基础使用

```bash
grep -r $content $directory         # 递归查找目录是否存在某个字符串
grep -rOH $content $directory       # 递归查找目录并输出匹配到的文件名,不输出匹配到的行

```

## 常用shell指令

```bash
exit                # 退出当前shell
history -c          # 清除历史命令
history -r          # 恢复历史命令
![历史命令id]        # 执行历史命令id对应的命令
!!                  # 执行上一个脚本

dirname $$0         # 返回当前脚本所在目录

```

## 执行

```bash
./xxx.sh        # 执行脚本方式一 chmod 700 xxx.sh
sh xxx.sh       # 执行脚本方式二
bash xxx.sh     # 执行脚本方式三

```

## 注释

```bash
: '
多行注释
多行注释
多行注释
'

```

## 命名规范

```bash
- 变量采用snake写法,并以小写字母开头,变量名严格区分大小写

```

## 输出

```bash
# 输出数据
echo "the data is ${$data}"

# 输出当前Shell
echo $SHELL

```

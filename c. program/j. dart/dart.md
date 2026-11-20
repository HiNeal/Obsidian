## 变量 - var

```dart
// 定义变量
var $name = $value
// 定义变量
$Type $name = $value

```

## 变量 - dynamic

```dart
// 定义动态变量(运行时进行类型检查)
dynamic $name = $value;

```

## 常量 - const

```dart
// 定义编译时常量
const $name = $value

```

## 常量 - final

```dart
// 定义运行时常量
final $name = $value

```

## 数据类型

```dart
+-----------+
| Data Type |
|-----------|
|    int    |
|-----------|
|   double  |
|-----------|
|   string  |
|-----------|
|    bool   |
|-----------|
|  Records  |
|-----------|
|   List    |
|-----------|
|    Map    |
|-----------|
|    Set    |
|-----------|
|   null    |
+-----------+

/*
 * - 所有类型默认值是null
 *
 *
 *
 */

```

## 流程控制 - if

```dart
if $condition {

} else if $condition {

} else {

}

/*
 * - 条件结果只能为布尔类型,不存在非零即真
 */

```

## 数组 - 定义

```dart
// 定义数组
List<$Type> list = <$Type>[]
// 定义数组
var list = <$Type>[]

```

## 数组 - 基础

```dart
// 数组长度
$list.length

// 添加元素
$list.add(item)

// 添加
$list.addAll(item)

// 插入元素
$list.insert(item, at:index)

// 数组合并
$list = $list + $list

```

## 数组 - 遍历

```dart

$list.forEach { (index, item) in

}

for item in $list {

}

```

## map - 定义

```dart
// 定义 Map
Map<$K, $V> $map = <$K, $V>{};
// 或使用 var
var $map = <$K, $V>{};

```

## map - 基础

```dart
// Map 长度
$map.length

// 访问 / 设置 元素
$map[key] = value
var val = $map[key]

// 添加多个键值对
$map.addAll({key: value})

// 删除元素
$map.remove(key)

// 清空
$map.clear()

// 合并 Map（创建新 Map）
$merged = {...$map, ...$otherMap}

```

## map - 遍历

```dart
// 遍历键值对（entries）
for (var entry in $map.entries) {
    var key = entry.key
    var value = entry.value
}

// 遍历 keys 或 values
for (var key in $map.keys) {
    print(key)
}
for (var value in $map.values) {
    print(value)
}

```

## set - 定义

```dart
// 定义 Set
Set<$Type> $set = <$Type>{};
// 或使用 var
var $set = <$Type>{};

```

## set - 基础

```dart
// Set 长度 / 是否为空
$set.length
$set.isEmpty

// 添加 / 批量添加
$set.add(element)
$set.addAll(iterable)

// 删除 / 清空
$set.remove(element)
$set.clear()

// 合并 (union) / 交集 / 差集
$union = $set.union($other)
$intersection = $set.intersection($other)
$difference = $set.difference($other)

```

## set - 遍历

```dart
// for-in 遍历
for (var item in $set) {

}

// forEach 遍历（不能 break）
$set.forEach((item) {

});

// 转为 List 后使用索引
var $list = $set.toList()
for (var i = 0; i < $list.length; i++) {
    var item = $list[i]
}

```

## 可选项 - ?

```dart
// 定义可选项
$Type? name

//
obj?.$method()

```

## 函数

```dart
$Type method($Type $param) {
  $content
}

```

## 函数 - 命名可选参数

```dart
$RType method(String param, {$Type param, $Type param2 = $default, required $Type param3}) {

}

/*
 * 命名可选参数
 *
 *
 *
 *
 */

```

## 函数 - 位置可选参数

```dart
String method(String param, [String? param1, String? param2]) {

}
/*
 * 位置可选参数
 */

```

## 类 - 定义

```dart
class $Class {
    Type field

    $Class({required this.field}){
        self.field = field
    }
}

```

## 关键字 - throw

```dart
throw AssertionError("Error");

```

## 主函数

```dart
void main(List<String> args) {
  print("hello world");
}

```

## 输出

```dart
// 输出数据
print("the data is ${$name}")

```

## 输出 - 变量类型

```dart
// 用于获取变量当前的类型
print(name.runtimeType);

```

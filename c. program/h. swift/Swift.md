
## 常量

```swift
// 定义常量
let $name = $value
// 定义常量
let $name: $Type = $value

/*
 * - 常量在编译或运行期间一旦被赋值系统就会分配确定的内存空间,其内存大小和内存数据就无法再被修改,
 *   因此常量在使用前需要赋值以此分配确定的内存空间,且赋值后不可再修改;
 *
 * - 禁止使用let接收延迟属性, 因为延迟属性在首次访问之前值为nil,首次访问后会进行懒加载修改该值;
 *   禁止使用let接收计算属性, 因为计算属性的值可能依赖其他属性随时变化并非固定不变;
 *
 * - 禁止使用let接收包含mutating方法的结构体实例,因为该方法可以修改结构体实例的属性从而修改内存数据;
 *   let修饰的结构体常量无法再修改结构体内部的属性(即便结构体内部定义的还是var属性);
 *
 *   let count: Int
 *   count = 18     // 不报错,由于有提前显示指定常量类型
 *
 *   let count
 *   count = 18     // 报错,编译器无法推断该常量和字面量的数据类型是否一致
 */

```

## 变量

```bash
// 定义变量
var $name = $value
// 定义变量
var $name: $Type = $value

/*
 * - 可以使用var接收延迟属性, 因为延迟属性在首次访问之前值为nil,首次访问后会进行懒加载修改该值;
 *   可以使用var接收计算属性, 因为计算属性的值可能依赖其他属性随时变化并非固定不变;
 *
 * - 可以使用var接收包含mutating方法的结构体实例,因为该方法可以修改结构体实例的属性从而修改内存数据;
 */

```

## 数据类型

```swift
+----------------------------+
|     Type     |  Data Type  |
|----------------------------|
|              |     Int     |  Int8/Int16/Int32/Int64/UInt8/UInt16/UInt32/UInt64
|              |-------------|
|              |    Float    |
|              |-------------|
|              |   Double    |
|              |-------------|
|              |  Character  |
|              |-------------|
|              |   String    |
|    struct    |-------------|
|    值类型     |     Bool                                                         |
|              |-------------|
|              |    Range    |
|              |-------------|
|              |    Tuple    |
|              |-------------|
|              |    Array    |
|              |-------------|
|              |  Dictionary |
|              |-------------|
|              |     Set     |
|----------------------------|
| enum (值类型) |    Option   |
+----------------------------+

/*
 * - 值得注意的是类似Int8和Int16即使都算是整型,但在Swift中依旧算是不同类型,因此互相之间的运行也需要强制类型转换;
 *   但字面量在逻辑意义运行的前提下也可以允许直接操作,因为字面量本身并没有明确的类型,例如let result = 1 + 0.1;
 */

```

## 流程控制 - if

```bash
if $condition {

} else if $condition {

} else {

}

/*
 * - 条件结果只能为布尔类型,不存在非零即真
 */

```

## 流程控制 - 强制解包 - if let

```swift
// 强制解包变量(有值进入且作用域仅在大括号内)
if let $name = $option {
    print("must hava value")
}

// 强制解包变量(swift 5.7支持)
if let $option  {
     print("must hava value")
}

// 强制解包函数返回值(有值进入作用域仅在大括号内)
if let $name = $method($param) {
     print("must hava value")
}

// 连续强制解包
if let $name1 =  $method($param),
   let $name2 =  $method($param),
   $condition1 && $condition2 {

}

```

## 流程控制 - 强制解包 - if var

```swift
// 强制解包变量(有值进入且作用域仅在大括号内)
if let $name = $option {
    print("must hava value")
}

// 强制解包变量(swift 5.7支持)
if let $option  {
    print("must hava value")
}

// 强制解包函数返回值(有值进入作用域仅在大括号内)
if let $name = $method($param) {
    print("must hava value")
}

// 连续强制解包
if let $name1 =  $method($param),
   let $name2 =  $method($param),
   $condition1 && $condition2 {

}

```

## 流程控制 - guard

```bash
guard $condition  else {
    return
}

```

## 流程控制 - guard - let

```swift
// 强制解包变量(无值进入且内外部作用域都可以使用)
guard let $name = $option  else {
    print("the option is nil")
    return // please use return break continue throw
}

```

## 流程控制 - guard - var

```swift
// 强制解包变量(无值进入且内外部作用域都可以使用)
guard var $name = $option  else {
    print("the option is nil")
    return // please use return break continue throw
}

```

## 流程控制 - switch

```swift
switch $name {

case $pattern1:
     print("$pattern1")
case $pattern2:
     print("$pattern2")
case $pattern3:
     print("$pattern3")
case $pattern4, $parttern5:
     print("$pattern4", "$pattern5")
default:
     break
}

/*
 * - switch中的case和default需要至少一条语句或者直接使用break;
 *   switch需要保证能处理所有case,如果不能则需要加入default处理其他情况;
 *
 * - fallthrough会在不检查下一个case的匹配条件的条件下强制进入下一个case分支;
 * - pattern可以是Int/Float/Double/Character/String/Range/Tuple/Enum,且通过关键字let进行强制解包,再配合where关键字使用;
 */

```

## 流程控制 - switch - range

```swift
let $number = $value

switch $number {

case $left1...$right1:
    print("the number between [left1, right1]")

case $left2..<$right2:
    print("the number between [left2, right2)")

case $left3...:
    print(	he number between [left3, ...]")

default:
    break
}

```

## 流程控制 - switch - tuple

```swift
let $tuple = ($value1, $value2)

switch $tuple {

case (let $name1, $value2):
   print(String($name1))

case ($value1, let $name2):
   print(String($name2))

case let ($name1, $name2) where $name1 == $name2:
   print(String($name1) + String($name2))

default:
    break
}

```

## 流程控制 - switch - enum

```swift
enum $ActionEnum {
    case $firstAction($param1: $Type1, $param2: $Type2)
    case $secondAction($param1: $Type1, $param2: $Type2)
    case $thirdAction($param1: $Type1, $param2: $Type2)
}

$ActionEnum $actionEnum = $ActionEnum.firstAction(param1, param2)

switch $actionEnum {

case let .$firstAction($param1, $param2):
    print(param1, param2)

case .$secondAction(let $param1, $param2):
    print($param1)

case .$thirdAction(let $param1, _):
    print($param1)

default:
    break
}

```

## 流程控制 - while

```bash
while $condition {

}

```

## 流程控制 - while repeat

```bash
repeat {

} while $condition

```

## 流程控制 - while -let

```bash
while let $name = $method($param),
      $condition1 && $condition2 {

}

```

## 枚举 - 原始值

```swift
// 隐式原始值
enum $RawEnum: $Type {
    case $firstEnum
    case $secondEnum
    case $thirdEnum

    ${1:🚫普通存储属性} ${3:✅静态存储属性} ${5:🚫延迟存储属性}
    ${2:✅普通计算属性} ${4:✅静态计算属性} ${6:🚫类型计算属性}
}

// 显示原始值
enum $RawEnum: $Type {
    case $firstEnum = $value1
    case $secondEnum = $value2
    case $thirdEnum = $value3

    ${1:🚫普通存储属性} ${3:✅静态存储属性} ${5:🚫延迟存储属性}
    ${2:✅普通计算属性} ${4:✅静态计算属性} ${6:🚫类型计算属性}
}

let $name = $RawEnum(rawValue:$value)

if let $name {
   print($name.rawValue)
}

/*
 * - 原始值枚举变量的值并不是存储在枚举变量内存中,通过调用rawValue方法直接返回即可;
 *   同一个原始值枚举下(不超过256个case),所有的枚举变量都占用1个字节(其内存大小和原始值的类型没有任何关系);
 * - 枚举中不能定义普通存储属性,可以定义静态存储属性 & 普通计算属性 & 静态计算属性 & 静态方法;
 */

```

## 枚举 - 关联值

```swift
enum $AssociateEnum {
    case $firstEnum($Type1, $Type2)
    case $secondEnum($Type1, $Type2)
    case $thirdEnum($Type1, $Type2)

    ${1:🚫普通存储属性} ${3:✅静态存储属性} ${5:🚫延迟存储属性}
    ${2:✅普通计算属性} ${4:✅静态计算属性} ${6:🚫类型计算属性}
}

enum $AssociateActionEnum {
    case $firstAction($param1: $Type1, $param2: $Type2)
    case $secondAction($param1: $Type1, $param2: $Type2)
    case $thirdAction($param1: $Type1, $param2: $Type2)

    ${1:🚫普通存储属性} ${3:✅静态存储属性} ${5:🚫延迟存储属性}
    ${2:✅普通计算属性} ${4:✅静态计算属性} ${6:🚫类型计算属性}
}

$ActionEnum $actionEnum = $ActionEnum.$firstAction($param1, param2)

/*
 * - 关联值枚举可用于定义多种角度描述同一事物,或者定义多种类型的带关联值的动作;
 * - 关联值枚举变量是将枚举成员值和其他类型的值关联存储在一起,因此也不能调用rawValue方法;
 *   同一个关联值枚举下(不超过256个case),关联值枚举变量是1个字节存储成员值(区分哪个枚举)和N个字节存储关联值;
 *   (N取内存最大的关联值且任何一个case都共用这N个字节)
 * - 枚举中不能定义普通存储属性,可以定义存储静态属性 & 普通计算属性 & 静态计算属性 & 静态方法;
 */

```

## 枚举-泛型

```swift
// 泛型关联值枚举
enum $GenericAssociateEnum<$T1, $T2> {
case $firstEnum($T1)
case $secondEnum($T2)
case $thirdEnum($T1, $T2)
}

let $name = $GenericAssociateEnum<String>.$firstEnum("content")

// 泛型关联值枚举(受约束)
enum $GenericAssociateEnum<$T: $Protocol> {
case $firstEnum($T)
case $secondEnum($T)
case $thirdEnum($T)
}

enum $GenericAssociateEnum<$T> where $T: $Protocol {
case $firstEnum($T)
case $secondEnum($T)
case $thirdEnum($T)
}

/*
 * - 泛型本质就是类型参数化,从而提高代码复用率减少代码量;
 */

```

## 可选项 - ?

```swift
// 作用在变量表示如有值则进行后续访问
$name?.$method

// 作用在类型标识该变量为可选项
let $name: $Type? = $value
if let $name = $option {
    print($name)
}

/*
 * - 可选项设计初衷是为了提醒我们该变量可能为空值,以此来避免空值所带来的其他异常情况;
 * - 在定义可选项变量时用?修饰类型表示该变量要不就是一个指定类型的值,要不就是nil值;
 * - 变量设计为可选项的基本原则:
 *   如果变量的值依赖于外部资源等复杂过程，推荐设计为可选项;
 *   属性在对象的生命周期中有有不同的case可能为空可能有值,如此推荐设计为可选项属性;
 */

```

## 可选项 - !

```swift
// 作用在变量表示强制解包
let $name: $Type? = $value
print($name!)

// 作用在类型表示可以自动隐式解包的可选项
let $name: $Type! = $value
print($name)

/*
 * - 在使用可选项变量时使用!修饰变量表示将给该变量进行强制解包(此举不会将该变量转变为非可选项);
 *   通过!进行强制解包为空的可选性变量会产生运行错误,因此此处要十分慎重;
 *
 * - 在定义可选项变量时使用!修饰类型表示该变量一定有值,因此后续使用该变量都会自动隐式解包;
 *   我们需要确保该变量一定有值,才可以使用!修饰类型;
 */

```

## 可选项 - ??

```php
// 常用用法
let $name = $a ?? $b

// 常用用法
if let $name = $option1 ?? $option2 {
    print($name)
}

/*
 * - a和b的存储类型必须相同的,且a是可选项,b是可选项或者不是可选项;
 * - 如果a为空则返回b; 如果a不为空就返回a,且返回时会查看b是否为可选项,不为可选项返回a会自动解包;
 */

```

## 区间 - 定义

```swift
let $range = $left...$right   // 范围为[left, right],类型为ClosedRange
let $range = $left..<$right   // 范围为[left, right),类型为Range
let $range = ...$right       // 范围为[+∞, right],类型为PartialRangeThrough
let $range = ...<$right      // 范围为[+∞, right],类型为PartialRangeUpTo
let $range = $left...        // 范围为[left, +∞),类型为PartialRangeFrom

```

## 区间 - 基础

```swift
// 查看区间上限
$range.upperBound

// 查看区间下限
$range.lowerBound

// 查看区间是否有值
$range.isEmpty

// 查看是否在区间内
let $result = $range.contains($Int)

// 返回指定区间的数组
let $rangeArray = $array[$range]

// 遍历区间
for i in $range {

}
// 遍历数组指定区间元素
for item in array[$range] {

}

```

## 字符 - 定义

```bash
var $char: Character = "$char"

```

## 元组 - 定义

```swift
// 定义元组
let $tuple = ($value1, $value2)
// 定义元组
let $tuple = ($name1: $value1, $name2: $value2)

/*
 * - 元组内元素类型可不同
 * - Void相当于空元组
 */

```

## 元组 - 基础

```swift
// 根据索引访问元组字段
print($tuple.$index)
// 根据字段访问元组字段
print($tuple.$name)

// 接收元组
let ($name1, $name2) = $tuple

```

## 数组 - 定义

```php
// 定义数组
var $array: [$Type] = [$item1, $item2]
// 定义数组
var $array = [$Type]()
// 定义数组
var $array: Array<$Type> = [$item1, $item2]
// 定义数组
var $array = Array<$Type>()
// 定义数组
var array = [$item1, $item2]

```

## 数组 - 基础

```bash
// 数组长度
$array.count

// 判断是否为空
$array.isEmpty

// 添加元素
$$array.append(item)

// 插入元素
$array.insert(item, at:index)

// 逆序
$array.reverse()

// 数组合并
$array = $array1 + $array2

```

## 数组 - 遍历

```swift

$array.forEach { (index, item) in

}

for item in $array {

}

for i in 0..<$array.count {

}

for (index, item) in $array.enumerated() {

}

```

## 数组 - 高阶

```swift
// 对每个item执行相同操作
var $newArray = $array.map { item * 2}
var $newArray = $array.map { $0 * 2}

// 多维数组转化为一位数组且移除掉值为nil的元素
var $newArray = $array.flatMap { item }

// 过滤数组元素
var $newArray = $array.filter { item % 2 == 0 }

// 合并数组元素
var $result = $array.reduce($initValue) { $0 + $1 }

```

## 字典 - 定义

```swift
// 定义字典
var $dict: [$keyType: $valueType] = [$key: $value]
// 定义字典(空)
var $dict = [$keyType: $valueType]()
// 定义字典
var $dict: Dictionary<$keyType, $valueType> = [$key: $value]
// 定义字典(空)
var $dict = Dictionary<$keyType: $valueType> = ()
// 定义字典
var $dict = [$key: $value]

```

## 字典 - 基础

```swift
// 获取长度
$dict.count

// 获取所有key
$dict.keys

// 字典判空
$dict.isEmpty

// 添加数据
$dict[$key] = $value

// 获取数据(返回可选项)
dict[$key]

// 删除字段
$dict.removeValue(forKey: "$key")

// 遍历
for ($key, $value) in $dict {
    print("\($key) --- \($value)")
}

```

## 函数声明

```php
// 常用写法(单参数推荐不要省略形参标签)
func  ($label $param: $Type) -> $RType {
    $content
}

// 常用写法(多参数推荐首个参数省略形参表情,其他不可省略)
func $function(_ $param1: $Type1, $label2 $param2: $Type2 = $default) -> $RType {
    $content
}

// 函数定义(同名形参标签)
func $function($param1: $Type1, $param2: $Type2 = $default) -> $RType {
    $content
}

// 函数定义(形参标签)
func $function($label1 $param1: $Type1, $label2 $param2: $Type2 = $default) -> $RType {
    $content
}

// 可变参数
func function(_ $param1: $Type...) -> $RType {
    for item in $param1 {
        print(item)
    }
}

/*
 * - 函数形参为常量,在函数内不得修改,通过inout修饰形参才可实现函数内修改;
 * - 函数定义时除非自定义形参的形参标签,否则默认会将形参名作为函数的形参标签;
 *   函数调用时默认在形参前都要带上形参标签,除非该函数定义形参标签通过_省略;
 *   函数形参是在定义函数时函数内部使用,函数形参标签是在调用函数时使用;
 * - 函数重载表示函数名相同 & 参数个数/参数类型/参数标签不同即为函数重载,函数返回值与函数重载无关联;
 * - 同一个函数最多只能有一个可变参数,且紧跟在可变参数后面的参数不能省略参数标签;
 * - 如果整个函数体是一个单一表达式,则函数会隐式返回这个表达式,因此可以不显示写明return;
 *
 *   func function(param1: Int, param2: Int) -> Int {
 *       param1 + param2
 *   }
 *   function(param1: 10, param2: 20)
 */

```

## 函数-泛型

```swift
/*
 * - 泛型本质就是类型参数化,从而提高代码复用率减少代码量;
 * - 调用泛型函数会自动确定泛型的具体类型,不需要给泛型指定具体类型;
 * - 变量接受泛型函数需要显示指定变量类型; var fn:(Int,String)->() = GenericsMethod
 */
func GenericsMethod<$T1, $T2>($param1: $T1, $param2: $T2) {

}

GenericsMethod(&$param1, &$param2)

/*
 * - 泛型函数的类型如果有类型约束需要显示指定(下面两种写法等价);
 */
func GenericsMethod<$T1: $Protocol1, $T2: $Protocol2>($param1: $T1, $param2: $T2) {

}

func GenericsMethod<$T1, $T2>($param1: $T1, $param2: $T2) where $T1: $Protocol1, $T2: $Protocol2 {

}

/*
 * - 泛型函数和泛型协议相结合使用
 */
protocol GenericProtocol {
    associatedtype $T: $Protocol
}

func GenericMethod<$T1: GenericProtocol, $T2: GenericProtocol>($param1: $T1, $param2: $T2) -> Bool where $T1.$T == $T2.$T {
    return true
}

```

## 关键字 - inout

```php
func $function($param: inout $Type) -> $RType {

}

/*
 * - 默认情况下所有函数参数都为常量,即在函数内部不能修改形参的值;
 * - inout参数可以在函数内部修改外部实参的值,其本质是地址传递;
 * - 无法使用inout修饰可变参数,并且inout参数也不能有默认值
 */

```

## 关键字 - typealias

```php
// 类型别名
typealias $newType = $oldType
// 组合协议别名
typealias $Protocol = $Protocol1 & $Protocol2 & $Protocol3
// 闭包别名
typealias $SampleClosure = ($param1 $Type1,$param2 $Type2) -> $RType

```

## 关键字 - discardableResult

```php
@discardableResult func $function() -> $RType {
    return ""
}

/*
 * - @discardableResult关键字修饰函数可以消除函数调用后返回值没有使用的告警
 */

```

## 闭包变量

```swift
/*
 * 闭包作为变量
 */
var $closure: ($Type1, $Type2) -> $RType = {
    print($0, $1)       // $0 $1 表示第一二个参数
    return $rparam
}

var $closure: ($Type1, $Type2) -> $RType = { $param1, $param2 in
    print($param1, $param2)
    return $rparam
}

var $closure: ($Type1, $Type2) -> $RType = { ($param1, $param2) in
    print($param1, $param2)
    return $rparam
}

var $closure: ($Type1, $Type2) -> $RType = { ($param1: $Type1, $param2: $Type2) -> $RType in
    print($param1, $param2)
    return $rparam
}

```

## 自动闭包

```text
// 不采用自动闭包
func logIfTrue(_ predicate: () -> Bool) {
    if predicate() {
        print("True")
    }
}

logIfTrue{2 > 1}

// 采用自动闭包
func logIfTrue(_ predicate: @autoclosure () -> Bool) {
    if predicate() {
        print("True")
    }
}

logIfTrue(2 > 1)    // 外界可以有更优雅的调用方式

// 其他案例
func autoclosureMethod<T>(param: T, closure:@autoclosure () -> T) {

}

/*
 * - 自动闭包不接收任何参数,被调用时会返回被包装在其中的表达式的值;
 * - 自动闭包会自动创建一个闭包用于封装被传递进函数参数的表达式,在函数内部合适的实际调用闭包从而执行表达式;
 */

```

## 逃逸闭包

```swift
var externClosure

func escapingClosureMethod(@escaping closure: ($CType) -> $CRType) -> $RType {
    externClosure = closure
}

/*
 * - 逃逸闭包指在函数内部并没有立即调用传入的闭包,而是存储起来的时机调用,那么传入的闭包称之为逃逸闭包
 */

```

## 普通闭包

```swift
func closureMethod(closure:($CType1, $CType2) -> $CRType, param1: $Type1, param2: $Type2) -> $RType {
    let result = closure(param1, param2)
    return result
}

// 调用闭包
closureMethod(closure: {
    print($0, $1)
    return $crparam
}, param1: $name1, param2: $name2)

// 调用闭包
closureMethod(closure: { cparam1, cparam2 in
    print(cparam1, cparam2)
    return $crparam
}, param1: $name1, param2: $name2)

// 调用闭包
closureMethod(closure: { (cparam1, cparam2) in
    print(cparam1, cparam2)
    return $crparam
}, param1: $name1, param2: $name2)

// 调用闭包
closureMethod(closure: { (cparam1: $CType1, cparam2: $CType2) -> $CRType in
    print(cparam1, cparam2)
    return $crparam
}, param1: $name1, param2: $name2)

/*
 * 闭包作为函数参数时可以有多种方式传入调用此闭包函数
 */
func closureFunction($param) -> (($Type1, $Type2) -> $RType) {
    let $RClosure: ($Type1, $Type2) -> $RType = { $param1, $param2 in
        return $param1 + $param2
    }
    return $RClosure
}

let $RClosure = closureFunction()
let $Result = $RClosure($param1, $param1)

/*
 * 闭包基础
 *
 * - 闭包是可以被传递和引用的一个独立模块，一个函数和它能够捕获其上下文中的常量和变量的组合称为“闭包”;
 * - 闭包对闭包外的环境引入是直接引用,编译器会将闭包引用的外部变量分配到堆上;
 * - 如果函数返回的闭包引用了函数内的局部变量,则多次调用该函数,返回的闭包各自引用多个不同外部变量;
 * - 如果函数返回的闭包引用了函数内的局部变量,返回的闭包函数函数调用多次都会对该捕获变量有影响;
 */

```

## 尾随闭包

```swift
func closureMethod(param1: $Type1, param2: $Type2, closure:($CType1, $CType2)->$CRType) -> $RType {
    let result = closure(param1, param2)
    return result
}

// $调用闭包函数
closureMethod(param1: $name1, param2: $name2) {
    print($0, $1)              // cparam1 和 cparam2
    return $0 + $1
}

// 调用闭包函数
closureMethod(param1: $name1, param2: $name2) { cparam1, cparam2 in
    print(cparam1, cparam2)
    return $crparam
}

// 调用闭包函数
closureMethod(param1: $name1, param2: $name2) { (cparam1, cparam2) in
    print(cparam1, cparam2)
    return $crparam
}

// 调用闭包函数
closureMethod(param1: $name1, param2: $name2) { (cparam1: $CType1, param2: $CType2) -> $Type in
    print(cparam1, cparam2)
    return $crparam
}

// 调用正常闭包
closureMethod(param1: $name1, param2: $name2, closure: { cparam1, cparam2 in
    print(cparam1, cparam2)
    return $crparam
})

// 调用正常闭包
closureMethod(param1: $name1, param2: $name2, closure: { (cparam1, cparam2) in
    print(cparam1, cparam2)
    return $crparam
})

// 调用正常闭包
closureMethod(param1: $name1, param2: $name2, closure: { (cparam1: $Type, cparam2: $Type)-> $Type in
    print(cparam1, cparam2)
    return $crparam
})

```

## 存储属性 - 普通 - 结构体和类

```swift
var $field: $Type {
    willSet {

    }
    didSet {

    }
}

```

## 存储属性 - 静态 - 结构体和类

```bash
static var $staticField: $staticFieldType = $default

```

## 存储属性 - 懒加载 - 结构体和类

```bash
// 懒加载属性无法添加属性观察器
lazy var $field: $Type = {

}()

```

## 存储属性 - 只读 - 结构体和类

```bash
private(set) var $field: $Type?

```

## 计算属性 - 普通 - 结构体和类

```swift
var $field: $Type {
    set {
        $otherField = newValue  // 这里不能设置当前属性会死循环,只能设置其他属性
    }
    get {
        $field                  // 只有get方法可以省略get {}
    }
}

```

## 计算属性 - 静态 - 结构体和类

```swift
static var $field $Type {
    set {
        $otherField = newValue  // 这里不能设置当前属性会死循环,只能设置其他属性
    }
    get {

    }
}

```

## 计算属性 - 类型 - 类

```kotlin
class var $field: $Type {
    set {
       $otherField = newValue  // 这里不能设置当前属性会死循环,只能设置其他属性
    }
    get {

    }
}

```

## 方法 - 对象 - 结构体和类

```swift
public func $instanceMethod($param: $Type) {
    $content
}

```

## 方法 - 静态 - 结构体和类

```swift
public static func $staticMethod($param: $Type) {
    $content
}

```

## 方法 - 类 - 类

```php
// 类方法
public class $classMethod($param: $Type) {

}

```

## 结构体 - 定义

```text
struct Struct {
    var $field1: $Type1
    var $field2: $Type2 = $default  // 在此处初始化等价于在构造器内初始化
    var $filed3: $Type3?

    ${1:✅存储普通属性} ${2: ✅存储静态属性} ${3:✅存储延迟属性}
    ${4:✅计算普通属性} ${5: ✅计算静态属性} ${6:🚫类型计算属性}

    // 初始化器
    init($field1: $Type1, $field2: $Type2) {
        self.$field1 = $field1
        self.$field2 = $field2
    }
}

/*
 * 结构体基础使用:
 *
 * - 结构体中如果有可选项属性时,由于可选项都有默认值为nil,因此定义属性或初始化器可以无需考虑可选项属性的初始化,
 *   结构体中如果包含存储延迟属性时,在获取结构体实例的时候必须用var,另外结构体中请勿使用class关键字;
 * - 结构体中如果没有自定义初始化器,编辑器默认会根据实际情况为结构体生成多个初始化器,宗旨是保证所有成员都有初始值;
 *   结构体中如果存在自定义初始化器,编译器就不再自动生成其他初始化器,我们则直接使用自定义的初始化器;
 *   结构体中如果方法被mutating关键字所修饰,则允许属性被被自身的实例方法所修改;
 *
 * 结构体和类共性:
 *
 * - 存储属性直接存储在实例内存中,计算属性本质是方法不占用实例的内存;
 *   枚举、结构体和类都可以定义计算属性, 定义计算属性必须用var不能使用let;
 *   在定义结构体或者类时,所有存储属性必须在定义属性时或初始化器中完成初始化(可选项属性已有默认值);
 * - 枚举、结构体和类都可以使用init?定义可失败初始化器,但不允许存在参数个数 & 标签 & 类型相同的可失败初始化器和正常初始化器
 *   可失败初始化器可以调用非可失败初始化器,正常初始化器调用可失败初始化器需要进行!强制解包;
 *   可失败初始化器也可以使用init!进行定义,对比init?好处是正常初始化器调用可失败初始化器无需手动进行!强制解包
 *   正常初始化器如果调用一个可失败初始化器初始化失败,则整个初始化流程都失败,且失败后的代码不在执行
 *
 * 结构体和类区别:
 *
 * - 常量类型的的结构体实例内部的属性无法修改,但常量类型的对象实例依旧可以修改对象内部属性;
 * - 结构体为值类型,在传递给常量或变量时都采用深拷贝(Copy on Write);类为引用类型,在传递给常量或变量都采用引用传递;
 */

```

## 结构体 - 泛型

```cpp
/*
 * - 泛型本质就是类型参数化,从而提高代码复用率减少代码量;
 * - 泛型结构体在使用时需要给泛型指定具体类型;
 */
struct GenericStruct<T> {

}
var obj = GenericStruct<Int>()

/*
 * - 带有类型约数的泛型结构体;
 */
struct GenericStruct<T: $Procotol> {

}

```

## 关键字 - mutating

```swift
/*
 * - 枚举或结构体的属性为了保证效率和安全被设计为无法被自身的实例方法所修改;
 *    如果需要被自身的实例方法所修改,这需要采用mutating关键字修饰该方法;
 * - 协议中mutating所修饰的方法表示枚举和结构体在实现此协议方法内可以修改自身的属性;
 */

struct Struct {
    var field: String

    init(field: String) {
        self.field = field
    }

    mutating func mutatingMethod(param: String) {
        self.field = param
    }
}

var obj = Struct(field: "sample")

obj.mutatingMethod(param: "sample")

```

## 类 - 定义

```swift
class $Class {
    var $field1: $Type1 = $default
    var $field2: $Type2
    var $filed3: $Type3?

    ${1:✅存储普通属性} ${2: ✅存储静态属性} ${3:✅存储延迟属性}
    ${4:✅计算普通属性} ${5: ✅计算静态属性} ${6:✅计算类型属性}

    // 指定初始化器
    init($field1: $Type1, $field2: $Type2) {
        self.$field1 = $field1
        self.$field2 = $field2
    }

    // 便利初始化器
    convenience init($field1: $Type1) {
        super.init($field1, $default)
    }

    // 可失败的初始化器
    init?($field1: $Type) {
        if $field1.isEmpty { return nil }
        self.$field1 = $field1
    }

    // 反初始化器
    deinit {
        print("obj is dealloc")
    }
 }

 let obj = Class()

 /**
  * 类基础:
  *
  * - 默认情况下编译器不会为类自动生成任何带参初始化器,推荐自己实现初始化器;
  * - 如果类所有成员在定义时就指定了初始化值,此时编译器会自动为类生成无参初始化器;
  * - 类中class关键字只能用于修饰计算类型属性且可以被继承,不能修饰类型存储属性
  *
  * 结构体和类共性:
  *
  * - 存储属性直接存储在实例内存中, 而计算属性本质是方法不占用实例的内存,
  *   在创建结构体或类的实例对象时，必须通过定义属性默认值或在初始化器为所有存储属性设置初始值(可选项属性已有默认值);
  *   枚举、结构体和类都可以定义计算属性, 定义计算属性必须用var不能使用let;
  * - 枚举、结构体和类都可以使用init?定义可失败初始化器,但不允许存在参数个数 & 标签 & 类型相同的可失败初始化器和正常初始化器
  *   可失败初始化器可以调用非可失败初始化器,正常初始化器调用可失败初始化器需要进行!强制解包;
  *   可失败初始化器也可以使用init!进行定义,对比init?好处是正常初始化器调用可失败初始化器无需手动进行!强制解包
  *   正常初始化器如果调用一个可失败初始化器初始化失败,则整个初始化流程都失败,且失败后的代码不在执行
  */

 * 结构体和类区别:
 *
 * - 常量类型的的结构体实例内部的属性无法修改,但常量类型的对象实例依旧可以修改对象内部属性;
 * - 结构体为值类型,在传递给常量或变量时都采用深拷贝(Copy on Write);类为引用类型,在传递给常量或变量都采用引用传递;

```

## 类 - PropertyWrapper

```swift
@propertyWrapper
struct $Syntax {
    private var $field: $Type
    var projectedValue: $Type

    var wrappedValue: $Type {
        get {
            $field
        }
        set {
            $field = newValue
            projectedValue = $Value
        }
    }

    init(wrappedValue: $Type) {
        self.$field = wrappedValue
    }
}

// 使用
stuct $Struct {
    @$Syntax  var $syntaxField: $Type
}

let obj = Struct()
obj.$syntaxField = $value           // 设置wrappedValue
obj.$syntaxField                   // 访问wrappedValue
obj.$$syntaxField                  // 访问projectValue

```

## 类 - 泛型

```swift
/*
 * - 泛型本质就是类型参数化,从而提高代码复用率减少代码量;
 * - 泛型类在使用时需要给泛型指定具体类型,另外子类继承泛型类也必须是泛型类
 */
class GenericClass<$T> {
    func instanceMethod($param: $T) { }
}

var obj = GenericClass<Int>()

/*
 * - 泛型本质就是类型参数化,从而提高代码复用率减少代码量;
 * - 泛型类的泛型如果有类型约束可以显示指定;
 */
class GenericClass<$T: $Procotol> {
    func instanceMethod($param: $T) { }
}

/*
 * - 泛型本质就是类型参数化,从而提高代码复用率减少代码量;
 * - 泛型类的泛型如果有类型约束可以显示指定;
 */
protocol GenericProtocol {
    associatedtype T1: $Procotol1
    associatedtype T2: $Procotol2
    func genericsMethod(param1: T1, param2: T2)
}

class GenericClass<T: $Procotol> : GenericsProtocol {
    // 给关联类型设定真实类型(该类型需要遵守指定Procotol1)
    typealias T1 = String
    // 给关联类型传递泛型(该类型需要遵守指定Procotol和Procotol2)
    typealias T2 = T

    init() {}
    func genericMethod(param1: String, param2: T) {}
}

/*
 * 普通协议可以接收函数返回值
 */
protocol NormalProtocol { }
class FirstClass : NormalProtocol { }
class SecondClass : NormalProtocol { }

func constructObject1(type: Int) -> NormalProtocol {
    if type == 1 {
        return FirstClass()
    }
    return SecondClass()
}

/*
 * - 泛型协议无法接收函数返回值,这是由于泛型协议中存在关联类型或Self会报错,编译时期无法返回的对象所遵循协议的关联类型
 *
 * - some表示不透明类型,表示屏蔽具体的类型而只告知所遵循协议, 有利于API设计者隐藏实现细节;
 *   some修饰返回值类型后在函数体中所有分支都只能返回同一类型的对象,而无法通过条件判断返回不同类型对象;
 *   some同时可以用于修饰属性var obj: some Protocol屏蔽具体类型而告知所遵循协议;
 */
protocol GenericProtocol {
    associatedtype T
    var field: T { get }
}

class FirstClass : GenericProtocol {
    var field: Int { 1 }
}

class SecondClass : GenericProtocol {
    var field: Double { 2 }
}

func constructObject(type: Int) -> GenericProtocol {       // Building Error
    if type == 1 {
        return FirstClass()
    }

    return SecondClass()
}

func constructObject1<T1: GenericProtocol>(type: Int) -> T1 {  // 推荐解法
    if type == 1 {
        return FirstClass() as! T1
    }

    return SecondClass() as! T1
}

let obj1: FirstClass = constructObject1(type: 1)

func constructObject2(type: Int) -> some GenericProtocol {      // 推荐解法
    return SecondClass()
}

let obj = constructObject2(type: 1)

```

## 类 - 权限访问控制

```csharp
open        // 定义的类如需要被其他模块继承或重写采用open;
public      // 定义的类型仅允许被其他模块访问则采用public;
internal    // 定义的类型仅允许在当前模块访问则采用internal(默认);
fileprivate // 定义的类型仅允许在当前文件访问则采用fileprivate;
private     // 定义的类型仅允许在当前声明范围内访问则采用private(包括extension);

```

## 类 - 析构函数

```bash
deinit {
    print("obj is dealloc")
}

```

## 类 - 继承

```swift
class $SuperClass {
    var $field1: $Type1
    var $field2: $Type2

    // 指定初始化器
    init($field1: $Type1, $field2: $Type2) {
        self.$field1 = $field1
        self.$field2 = $field2
    }

    // 便捷初始化器
    convenience init() {
        self.init($defalut1, $defalut2)
    }

    func instanceMethod() { }
}

class $SubClass : $SuperClass {
    override var $field1: $Type1 {
        set {}
        get {}
    }

    override var $field2: $Type2 {
        willSet {}
        didSet {}
    }

    var $field3: $Type3

    // 指定初始化器
    init($field1: $Type1, $field2: $Type2, $field3: $Type3) {
        self.field3 = $field3
        super.init($field1, $field2)
    }

    // 重写父类的指定初始化器为本类的指定初始化器
    override init($field1: $Type1, $field2: $Type2) {
        self.field3 = $defalut
        super.init($field1, $field2)
    }

    // 重写父类的指定初始化器为本类的便捷初始化器
    override convenience init($field1: $Type1, $field2: $Type2) {
        self.init(field1, field2, $defalut)
    }

   override func instanceMethod() { }
}

/*
 * 继承基础:
 *
 * - 子类中只能通过override将父类的var属性重写为计算属性,同时该属性在子类的访问权限大于等于父类 & 父子类该属性读写权限必须相同;
 *   子类中可以通过willSet和didSet为父类的var属性增加属性观察器;
 *   子类可以通过override重写父类的指定初始化器为指定初始化器或者便捷初始化器,父类的便捷初始化器无法被子类重写;
 * - 子类如果没有自定义任何指定初始化器,会自动继承父类所有指定初始化器和便捷初始化器;
 *   子类如果提供了父类所有指定初始化器的实现,同样会继承所有父类便捷初始化器;
 * - 父类require所修饰的指定初始化器,旨在让子类都必须通过重写或自动继承实现父类的初始化器;
 *   父类require所修饰的指定初始化器被子类重写时,无需使用override关键字修饰;
 * - 正常初始化器可重写为可失败初始化器; 可失败初始化器无法重写为正常初始化器
 *
 */

```

## 类 - 图形 - 初始化器阶段

```text
/*
 * 类的初始化器规则
 *
 *  - 子类的指定初始化器必须直接调用直系父类的指定初始化器;
 *  - 子类的便捷初始化器必须本类里调用另一个初始化器,且调用链最终必须调用到本类的指定初始化器;
 *
 *     +------------------------------------------------------------------------------------------+
 *     |                                                                                          |
 *     |    +----------------+              +----------------+              +----------------+    |
 *     |    |   Designated   | <----------- |  Convenience   | <----------- |  Convenience   |    |
 *     |    +--------+-------+              +----------------+              +----------------+    |
 *     |             ^                                                                            |
 *     +-------------|----------------------------------------------------------------------------+
 *                   |
 *                   |
 *                   |
 *                   |
 *                   |
 *      +------------|----------------------------------------------------------------------------+
 *      |            |                                                                            |
 *      |   +----------------+              +----------------+              +----------------+    |
 *      |   |   Designated   | <----------- |  Convenience   | <----------- |  Convenience   |    |
 *      |   +----------------+              +----------------+              +----------------+    |
 *      |            ^       ^                                                                    |
 *      +------------|-------|--------------------------------------------------------------------+
 *                   |       |
 *                   |       |
 *                   |       +-----------------------+
 *                   |                               |
 *                   |                               |
 *      +------------|-------------------------------|--------------------------------------------+
 *      |            |                               |                                            |
 *      |   +----------------+              +----------------+              +----------------+    |
 *      |   |   Designated   |              |   Designated   | <----------- |  Convenience   |    |
 *      |   +----------------+              +----------------+              +----------------+    |
 *      |                                                                                         |
 *      +-----------------------------------------------------------------------------------------+
 *
 */

/*
 * 两段初始化:
 *
 *  - 第一阶段保证实例所有存储属性都初始化完毕;
 *  - 第二阶段提供实例进一步定制的机会,便于定制新存储属性值;
 *
 * 安全检查:
 *
 *  - 指定初始化器必须先保证所在类定义的所有存储属性都初始化后,才在调用父类初始化器;
 *  - 指定初始化器必须先调用父类初始化器,然后才能为继承的属性设置所要定制的新值;
 *  - 便捷初始化器必须先调用同类中的其它初始化器，然后再为任意属性设置所要定制的新值;
 *
 *  - 初始化器在第一阶段初始化完成之前,不能调用任何实例方法,不能获取任何实例属性的值,也不能引用self;
 *  - 直到第一阶段结束后,实例才被认为完全合法;
 *
 *
 *
 *     +--------------------------------------+                  +-------------------------------------------------------+
 *     | 不断向上调用父类指定初始化器,形成初始化链条 | ---------------> |  从顶部初始化器往下,链中每个指定初始化器都有机会进一步定制实例  |
 *     +--------------------------------------+                  +-------------------------------------------------------+
 *                     ^ superclass                                                      |
 *                     |                                                                 |
 *                     |                                                                 v
 *     +--------------------------------------+                  +-------------------------------------------------------+
 *     |指定初始化器确保当前类定义存储属性都初始化完毕|                  |  从顶部初始化器往下,链中每个指定初始化器都有机会进一步定制实例  |
 *     +--------------------------------------+                  +-------------------------------------------------------+
 *                     ^ subclass                                                        |
 *                     |                                                                 |
 *                     |                                                                 v
 *     +---------------------------------------+                  +------------------------------------------------------+
 *     |        给实例分配内存(但未初始化)         |                  |          初始化器现在能够使用self访问属性/方法            |
 *     +---------------------------------------+                  +------------------------------------------------------+
 *                     ^ subclass                                                        |
 *                     |                                                                 |
 *                     |                                                                 v
 *     +---------------------------------------+                  +------------------------------------------------------+
 *     |         外层调用指定/便捷初始化器         |                  |      最终链上任何便捷初始化器都有机会定制实例 & 使用self     |
 *     +---------------------------------------+                  +------------------------------------------------------+
 *                  (第一阶段)                                                          (第二阶段)
 */

```

## 关键字 - final

```bash
/*
 * - final修饰的下标 & 属性 & 方法禁止被重写, 修饰的类禁止被继承;
 */

```

## 关键字 - required

```lua
/*
 * require关键字
 *
 * - 父类被require所修饰的指定初始化器,旨在让子类都必须通过重写或自动继承实现父类的初始化器;
 * - 子类重写父类require所修饰的指定初始化器,无需使用override关键字修饰;
 * - 协议中的初始化器在被非final类所遵循实现时在实现类内必须通过required修饰;
 */

```

## 关键字 - as

```php
/*
 * - 强制类型转换既可以采用$Type($name),这种方式是通过调用结构体的初始化器创建一个新实例从而达到强制类型转换
 *   强制类型转换也可以采用as / as? / as!
 *    $anyObject as $ParentClassType    as用于向上转型,且需要保证类型转换正确;              childOject as ParentClass
 *    $anyObject as? $ChildClassType   as?用于向下转型,类型转换会返回可选型;               ParentObject as? ChildClass
 *    $anyObject as! $ChildClassType   as!用于向下转型,需要保证类型转换正确,失败会抛出异常;  ParentObject as! ChildClass
 *
 */

$anyObject as $ParentOrSameClassType
$anyObject as? $ChildOrSameClassType
$anyObject as! $ChildOrSameClassType

```

## 关键字 -where

```swift
// where和元祖
switch $tuple {
case let ($name1, $name2) where $name1 == $name2:
    print(String($name1) + String($name2))

default:
    print("no case match")
}

// where和for
for $item in $array where $item > 0 {

}

```

## 协议 - 定义

```swift
protocol $Protocol : $SuperProtocol{
    // 泛型
    associatedtype $T

    // 普通属性声明
    var $field1: $Type { set get }
    // 静态属性声明
    static var $field2

    ${✅指定初始化器声明}
    ${✅实例方法声明}
    ${✅实例方法声明(mutating)}
    ${✅静态方法声明}
}

/*
 * 协议基础
 *
 * - 协议中的属性必须采用var,实现该属性时的访问权限要大于或等于协议中定义的访问权限;
 *   协议中的属性定义的get和set可以采用var存储属性或者get和set计算属性进行实现,只定义get可以用过任何属性实现;
 *
 * - 协议中的初始化器在被非final的类所遵循实现时必须通过required修饰,如果该初始化器恰好和实现类的父类指定初始化器相同则需同时加上override;
 *   协议中的方法被结构体或者类遵守时必须实现,但我们仍然可以通过extension协议给出协议的默认实现从,如此结构体或类遵守此协议可以不遵可选方法;
 *   协议中mutating所修饰的方法表示枚举和结构体在实现此协议方法内可以修改枚举或结构体的属性,因此我们在设计协议是需要考虑是否添加mutating;
 *
 * - 在协议定义时继承于AnyObject表示该协议只能被类所遵守,另外协议可以通过typealias进行组合,typealias Protocol = Protocol1 & Protocol2;
 */

```

## 协议 - 泛型

```swift
/*
 * - 泛型本质就是类型参数化,从而提高代码复用率减少代码量;
 * - 泛型类的泛型如果有类型约束可以显示指定;
 */
protocol GenericProtocol {
    associatedtype $T1: $Procotol1
    associatedtype $T2: $Procotol2
    func genericMethod($param1: $T1, $param2: $T2)
}

```

## 协议 - Error

```swift
// 定义错误枚举(遵循Error)
enum $CommonError : Error {
case $invalidParam(String)
case $networkError(String)
case $outOfMemory(String)
}

```

## 协议 - Codable

```swift
$class $StructORClass: Codable {

    var $firstField: $firstFieldType
    var $secondField: $secondFieldType
    var $optionField: $optionFieldType?

    enum CodingKeys: String, CodingKey {
        case $firstField
        case $secondField = "$cloudSecondField"
        case $optionField
    }

    // 如果是非final的类需要用required修饰
    $required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        $firstField = try container.decode($firstFieldType.self, forKey: .$firstField)
        $secondField = try container.decode($secondFieldType.self, forKey: .$secondField)
        $optionField = try container.decodeIfPresent($optionFieldType.self, forKey: .$optionField)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode($firstField, forKey: .$firstField)
        try container.encode($secondField, forKey: .$secondField)
        try container.encodeIfPresent($optionField, forKey: .$optionField)
    }
}

// 编码
let jsonEncoder = JSONEncoder()
if let encodedData = try? jsonEncoder.encode($obj) {

}

// 解码
let jsonData = $jsonString.data(using:.utf8)
let jsonDecoder = JSONDecoder()
jsonDecoder.keyDecodingStrategy = .$useDefaultKeys
if let $obj = try? jsonDecoder.decode($Class.self, from: jsonData) {

}

```

## 序列化 - 解码

```swift
// 解码
let jsonData = $jsonString.data(using:.utf8)
let jsonDecoder = JSONDecoder()
jsonDecoder.keyDecodingStrategy = .$useDefaultKeys
if let $obj = try? jsonDecoder.decode($Class.self, from: jsonData) {

}

```

## 序列化 - 编码

```swift
// 编码
let jsonEncoder = JSONEncoder()
if let encodedData = try? jsonEncoder.encode(<#obj#>) {

}

```

## 协议 - CustomStringConvertible

```swift
/*
 * - 实现CustomStringConvertible协议的description后,可以自定义对象的输出日志
 */
struct Person: CustomStringConvertible {
    let name: String
    let age: Int

    var description: String {
        return "Person\(name: \(name), age: \(age))"
    }

}

let person = Person(name: "John", age: 30)
print(person)  // 打印：Person（name: John，age: 30）

```

## 协议 - CaseIterable

```swift
/*
 *  CaseIterable协议
 *
 * - 原始值枚举遵循CaseIterable协议后默认会提供一个allCases属性,可以返回的是一个包含了枚举所有可能 case 的数组;
 * - CaseIterable协议只对原始值枚举有效,关联值枚举不可遵守此协议;
 */
enum Direction: String, CaseIterable {
    case north
    case south
    case east
    case west
}

for direction in Direction.allCases {
    print("The direction is \(direction.rawValue)")
}

```

## 类型判断

```bash
// 判断是否为某种类型或其子类
$obj is $Struct
$obj is $Class

```

## 关键字 - Any:AnyObject:AnyClass:Self

```text
class SuperClass {}
class SubClass {}
var superPtr: SuperClass.Type = SuperClass.self
var subPtr: SubClass.Type = SubClass.self
var anyPtr1: AnyObject.Type = SuperClass.self;
var anyPtr2: AnyObject.Type = SubClass.self;

var superObj = SuperClass()
print(type(of:superObj)) //  SuperClass.self == type(of: superObj)

/*
 * Any | AnyObject | X.self | X.Type | AnyClass | Self
 *
 * - Any代表任意类型,不限于函数类型/枚举/结构体/类;
 * - AnyObject表示任意类类型且与类同等级别,无法表示枚举和结构体,协议继承与AnyObject表示只有类能遵守此协议;
 * - X.self是一个类型为X.Type且指向元类型数据的指针;
 * - AnyClass是AnyObject.Type的别名, typealias AnyClass = AnyObject.Type
 * - Self用于作返口值类型,表示限定返回值跟方法调用者必须是同一类型,形成链式调用;
 *   Self用于做参数类型下,表示参数类型跟调用者必须是同一类型;
 *
 *                  +----------------+                +------------------+
 *                  | X.Type *X.self | -------------> |  meta class data |
 *                  +----------------+                +------------------+
 *                  |                |
 *                  |                |
 *                  |                |
 *  ptr ----------> |     object     |
 *                  |                |
 *                  |                |
 *                  |                |
 *                  +----------------+
 */

class Animal { required init() {} }
class Cat : Animal {}
class Dog : Animal {}

// 初始化
var a1 = Animal()
var a2 = Animal.self()
var a3 = Animal.init()
var a4 = Animal.self.init()

// X.self和X.Type的应用(这里不能简单用类名代替)
func create(_ clses: [Animal.Type]) -> [Animal] {
    var arr = [Animal]()
    for cls in clses {
        arr.append(cls.init())
    }
    return arr
}

print(create([Cat.self, Dog.self]))

```

## 扩展 - 枚举

```swift
// 扩展枚举
extension $Enum  {
    $🚫普通存储属性 $🚫静态存储属性 $🚫延迟存储属性
    $✅普通计算属性 $✅静态计算属性 $🚫类型计算属性
}

// 扩展枚举顺带遵守协议
extension $Enum : $Protocol {
    func $instanceMethod()
}

/*
 * - 扩展可以为枚举新增普通计算属性/静态计算属性/便捷初始化器/方法,但不允许覆盖已有成员;
 */

```

## 扩展 - 结构体

```swift
// 扩展结构体
extension $Struct  {
    $🚫普通存储属性 $🚫静态存储属性 🚫延迟存储属性
    $✅普通计算属性 $✅静态计算属性 $🚫类型计算属性

    $✅内嵌结构体
}

// 扩展结构体顺带遵守协议
extension $Struct : $Protocol {
    func $instanceMethod()
}

/*
 * - 扩展可以结构体新增普通计算属性/静态计算属性/便捷初始化器/方法/结构体,但不允许覆盖已有成员;
 */

```

## 扩展 - 类

```swift
// 扩展类
extension $Class  {
    $🚫普通存储属性 $🚫静态存储属性 $🚫延迟存储属性
    $✅普通计算属性 $✅静态计算属性 $✅类型计算属性

    $🚫指定初始化器
    $✅便捷初始化器

    $✅各种方法

    $✅内嵌结构体
    $✅内嵌类
}

// 扩展类顺带遵守协议
extension $Class : $Protocol {
    func $protocolMethod()
}

/*
 * - 扩展可以为类新增普通计算属性/静态计算属性/便捷初始化器/方法/结构体/类,但不允许覆盖已有成员;
 * - 扩展类中的方法无法被继承,如果需要被继承需要添加@objc符号;
 */

```

## 扩展 - 协议

```swift
// 原协议
Protocol $Protocol {
    func $instanceMethod()
}

// 扩展协议
extension $Protocol {
    func $instanceMethod() {
        print("扩展协议并实现可选方法")
    }
    func $extensionMethod() {
        print("扩展其他方法")
    }
}

/*
 * - 扩展可以给协议提供默认实现,从而达成可选协议的效果,同时扩展也可以给协议扩充原协议未声明的方法;
 */

```

## 错误处理 - try

```swift
// 错误现场 (可能会抛出Error的函数必须加上throws声明)
func sampleMethod(str: String) throws -> String {
    if str.count == 0 {
        throw $CommonError.$outOfMemory("out of memory")
    }
    return str
}

// 通过try + throws调用
func handleErrorWithNothing() throws {
    let _ = try sampleMethod(str: "")
}

// 通过try + do catch调用
func handleErrorWithDoCatch() {
    do {
        let _ = try sampleMethod(str: "")
    } catch let $CommonError.$outOfMemory(message) {
        print(message)
    } catch $CommonError.$outOfMemory(let message) {
        print(message)
    } catch {
        print("catch login")
    }
}

// 通过try?处理错误(一旦方法抛出异常try?表达式的值为nil)
func handleErrorWithTryOption() {
    let _ = try? sampleMethod(str: "")
}

// 通过try!处理错误(一旦方法抛出异常try!会发生运行错误)
func handleErrorWithThrows() throws {
    let _ = try! sampleMethod(str: "")
}

```

## 错误处理 - do catch

```swift
func sampleMethod(str: String) throws -> String {
    if str.count == 0 {
        throw $CommonError.$outOfMemory("out of memory")
    }
    return str
}

// 通过try + do catch调用,并且catch case必须详尽
func handleErrorWithDoCatch() {
    do {
        let _ = try sampleMethod(str: "")
    } catch let $CommonError.$outOfMemory(message) {
        print(message)
    } catch $CommonError.$outOfMemory(let message) {
        print(message)
    } catch {
        print("catch login")
    }
}

```

## 断言

```bash
// 断言机制
assert($condition, $message)

```

## 关键字 - fatalError

```swift
/*
 * fatalError关键字
 *
 * - fatalError函数抛出错误会让程序结束运行,且该错误无法被do-catch捕获,使用后不必再写return;
 * - fataError可以用于在某些不得不实现却不希望别人调用的方法内;
 */

class Person { required init(){} }
class Student : Person {
     required init(){
        fatalError("do not call Student init")
     }
     init(name:String) { }
}

```

## 关键字 - throws

```java
func sampleMethod(str: String) throws -> String {
    if str.count == 0 {
        throw $CommonError.$outOfMemory("out of memory")
    }
    return str
}

/*
 * throw & throws关键字
 *
 * - 可能会抛出错误的函数必须通过关键字throws声明;
 * - 函数内通过关键字throw抛出具体的错误信息;
 */

```

## 关键字 - rethrows

```swift
func closureMethod(closure:(Int, Int) throws -> Int, param1: Int, param2: Int) rethrows {
    print(try closure(param1, param2))
}

/*
 * rethrows关键字
 *
 * - rethrows关键字表示当前函数本身并不会抛出错误,但是调用的闭包参数可能会发生错误,则会将错误向上抛出
 */

```

## 关键字 - defer

```bash
defer {

}

/*
 * defer关键字
 *
 * - defer用来定义以错误处理或return等任何方式离开代码块前必须要执行的代码;
 * - defer遵循栈结构,后定义的defer代码块先执行;
 */

```

## 关键字 - some

```swift
/*
 * - some主要用于类型擦除,通过不透明类型屏蔽具体类型并只告知所遵循协议, 有利于API设计者隐藏实现细节;
 *
 * - 返回some修饰的类型时,编译器确保函数或属性每次都返回相同的具体类型。这种一致性能让编译器优化代码，并保证了类型安全;
 *   因此some修饰返回值类型后在函数体中所有分支都只能返回同一类型的对象,而无法通过条件判断返回不同类型对象;
 *
 * - some同时可以用于修饰属性var obj: some Protocol屏蔽具体类型而告知所遵循协议;
 */
protocol GenericProtocol {
    associatedtype T
    var field: T { get }
}

class FirstClass : GenericProtocol {
    var field: Int { 1 }
}

class SecondClass : GenericProtocol {
    var field: Double { 2 }
}

func constructObject1<T1: GenericProtocol>(type: Int) -> T1 {
    if type == 1 {
        return FirstClass() as! T1
    }

    return SecondClass() as! T1
}

let obj1: FirstClass = constructObject1(type: 1)

func constructObject2(type: Int) -> some GenericProtocol {     // 擦除具体类型
    return SecondClass()
}

let obj = constructObject2(type: 1)

```

## 异步编程 - async await

```swift
// 异步函数
func asyncMethod() async throws -> Int {
    try? await Task.sleep(nanoseconds: 1000)
    return Int.random(in: 0...10)
}

// 异步函数内调用异步函数
func callInAsyncMethod() async throws -> Int {
    let result = try await asyncMethod()
    return result
}

// 同步函数内调用异步函数(配合Task使用)
func callInSyncMethod() -> Int {
    Task {
        let result = try await asyncMethod()
        return result
    }
}

/*
 * - async允许我们在函数内部使用await关键字,并同时要求调用方在调用此函数时使用await关键字;
 *   async异步函数要么被另外一个异步函数所调用,在同步函数内需要借助Task配合调用;
 *
 * - await代表函数在此处可能会放弃当前线程,此处是程序的潜在暂停点;
 *   await语句会被底层分配到其他合适的线程执行成功后之前的暂停点结束后继续向下执行;
 *   await在async异步函数当中使用;
 */

```

## 异步编程 - async let

```swift
// 任务先后执行
func asyncFunction() async throws -> Int {
    let result1 = try? await $firstAsyncTask()
    let result2 = try? await $secondAsyncTask()

    if let result1, let result2 {
        return result1 + result2
    } else {
        throw NSError()
    }
}

// 任务同时执行
func asyncFunction() async throws -> Int {
    async let $task1 = $firstAsyncTask()
    async let $task2 = $secondAsyncTask()

    if let $result1 = try await $task1,
       let $result2 = try await $task2 {
        return result1 + result2;
    }

    return result1 + result2;
}

```

## 输出

```swift
// 输出数据
print("the data is \($name)")
// 输出数据(可选项)
print("the data is \($name!)")
print("the data is \(String(describing:$name))")
// 实际内存大小
print(MemoryLayout<$Struct>.size)
// 内存对齐后大小
print(MemoryLayout<$Struct>.stride)
// 内存对齐标准
print(MemoryLayout<$Struct>.alignment)

```

## 混编 - ObjC调Swift

```text
/*
 * ObjC调用Swift
 *
 * - 系统默认生成一个不显示的桥接文件 [ProductName]-Swift.h;
 *   使用 @objc 修饰成员 / 使用 @objcMembers 修饰类,会自动解析并添加到桥接文件中去;
 *
 * - Swift开发者需要留意基础能力是否可能被ObjC调用,如需要应该添加@objc/@objMember;
 *
 * - clang不支持混编,因此需要有[ProductName]-Swift.h的引入才可以混编调用Swift;
 *
 *                             +-------------+
 *                             |     .h      | ---+
 *                             +-------------+    |
 *                                                |
 *    +--------------+ swiftc  +-------------+    |  clang  +-------------+
 *    |    .swift    | ------> |  XX-Swift.h |    | ------> |     .o      |
 *    +--------------+         +-------------+    |         +-------------+
 *                                                |
 *                             +-------------+    |
 *                             |      .h     | ---+
 *                             +-------------+
 *
 *
 *    swiftc -c main.swift                                      // 编译文件
 *           -emit-objc-header-path [ProductName]-Swift.h       // 生成XX-Swift文件
 *           -o main.o                                          // 目标文件
 *
 *
 *    +---------------+                      +---------------+
 *    |    .swift     | +----+        +----> |      .o       |
 *    +---------------+      | swiftc |      +---------------+
 *                           | -----> |
 *    +---------------+      |        |      +---------------+
 *    |   .pch/.pcm   | +----+        +----> |     .smd      |   // swiftmodule
 *    +---------------+                      +---------------+
 *
 */

```

## 混编 - Swift调用ObjC

```text
/*
 * Swift调用ObjC
 *
 * - 新建桥接文件 [ProductName]-Bridging-Header.h;
 *   在 Build Settings 中查找 Objective-C Bridging Header并指定好桥接文件路径;
 *   将需要暴露的 ObjC 头文件通过#import引入到该文件中;
 *
 * - ObjC开发者需要留意基础能力是否可能会被Swift调用,如需要将该头文件引入到Bridging-Header;
 *   ObjC开发者需要保证nonull一定有值,否则即使swift做了防护操作也会crash, 因此在ObjC中慎用nonull;
 *
 * - swiftc本身就支持混编,只需要ObjC Header + modulemap 以ClangMoudle 形式引入
 *
 *                                                      +------------+
 *                                                      |   .swift   | --------+
 *                                                      +------------+         |
 *                                                                             |
 *                                                                             | swiftc  +--------------+
 *                                                                             | ------> |     .o       |
 *    +--------------+                                                         |         +--------------+
 *    |      .h      | ---+                                                    |
 *    +--------------+    |     +-----------------+     +-------------+        |
 *                        | --> | Bridging-Header | --> |  modulemap  | -------+
 *    +--------------+    |     +-----------------+     +-------------+
 *    |      .h      | ---+
 *    +--------------+
 *
 *  swiftc -c main.swift      // 编译文件
 *         -I [MODULE_PATH]   // modulemap所在的路径
 *         -o main.o          // 目标文件
 *
 *                                      +--------------------------------+
 *                             +------> |             Parsing            |
 *                              |        +--------------------------------+
 *                             |
 *                             |        +--------------------------------+
 *                             |------> |        Semantic analysis       |
 *                             |        +--------------------------------+
 *                             |
 *                             |        +--------------------------------+
 *                             |------> |        Clang Importer          |  主要作用是将Clang modules所暴露的ObjC API转化为Swift API
 *                             |        +--------------------------------+
 *                             |
 *     +--------------+        |        +--------------------------------+
 *     |    swiftc    | -----> |------> |         SIL generation         |
 *     +--------------+        |        +--------------------------------+
 *                             |
 *                             |        +--------------------------------+
 *                             +------> | SIL guaranteed transformations |
 *                             |        +--------------------------------+
 *                             |
 *                             |        +--------------------------------+
 *                             +------> |       SIL optimizations        |
 *                             |        +--------------------------------+
 *                             |
 *                             |        +--------------------------------+
 *                             +------> |       LLVM IR generation       |
 *                                      +--------------------------------+
 *
 */

```

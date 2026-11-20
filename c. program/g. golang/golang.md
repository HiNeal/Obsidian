## 变量 - 局部

```go
// 定义变量
$name := $value

// 定义多变量
$name1, $name2 := $value1, $vaule2

/*
 * 变量基础:
 *
 * - 变量被声明后必须使用,否则编译错误;
 * - 变量如未初始化系统会使用默认值进行初始化
 */

```

## 变量 - 全局

```go
// 定义变量
var $name $type
var $name = $value
var $name $type = $value

// 定义多变量(接收多返回值函数)
var $name1 $name2 = $value1, $value2

// 定义多变量
var (
  $name1 $type1 = $name1
  $name2 $type2 = $name2
  $name3 $type3 = $name3
)

/*
 * 变量基础:

 * - 变量一旦被声明后就必须使用,否则编译错误;如果未初始化系统将会自动赋予它该类型的所对应的初始化值
 */

```

## 常量

```go
// 定义常量
const $name = $value

// 定义多个常量
const $name1, $name2 = $value1, $value2

const (
  $name1 = $value1
  $name2 = $value2
  $name3 = $value3
)

```

## 数据类型

```go
+----------------------------------+
| Data Type |   Size    |  Default |
|----------------------------------|
|   int     |  4/8 byte |    0     |
|   int8    |  1 byte   |    0     |
|   int16   |  2 byte   |    0     |
|   int32   |  4 byte   |    0     |
|   int64   |  8 byte   |    0     |
|----------------------------------|
|   uint    |  4/8 byte |    0     |
|   uint8   |  1 byte   |    0     |
|   uint16  |  2 byte   |    0     |
|   uint32  |  4 byte   |    0     |
|   uint64  |  8 byte   |    0     |
|----------------------------------|
|  float32  |  4 byte   |   0.0    |
|  float64  |  8 byte   |   0.0    |
|----------------------------------|
| complex64 |  4 byte   |  0 + 0i  |
| complex64 |  8 byte   |  0 + 0i  |
|----------------------------------|
|  uintptr  | 4/8 byte  |    0     |
|----------------------------------|
|   rune    |  4 byte   |    0     |
|----------------------------------|
|   byte    |  1 byte   |    0     |
|----------------------------------|
|    bool   |  1 byte   |   false  |
+----------------------------------+

/*
 * 基本数据类型
 *
 * - rune通常表示Unicode字符(可能占用多个字节), byte只能表示ascii字符(只会占用一个字节)
 * - 强制类型转换可以通过$name := $type($name)实现
 */

```

## 枚举

```go
const (
  $enum1 = iota
  $enum2 = iota
  $enum3 = iota
)

/*
 * 枚举:
 *
 * - iota在const关键字出现时将被重置为0,并且const中每新增一行单位常量声明将使iota计数一次;
 */

```

## 流程控制 - if

```go
// 方式一
if $condition {

} else if $condition {

} else {

}

// 方式二(if句中只允许包含一个分号,且分号前初始化局部变量仅在if-else块内可见)
if $name := $value;$condition {

}

```

## 流程控制 - switch

```go
switch $expression {
case $condition1:
   $content1
case $condition2:
   $content2
case $condition3:
   $content3
default:
   $default
}
/*
 * switch
 *
 * - switch可以联合常量/变量/函数表达式共同使用(数字/字符串等皆可)
 * - fallthrough即使当前条件已经满足,也会往下继续进行条件判断流程
 *
 */

```

## 循环 - for

```go
for i := 0; i < len($collection); i++ {
    fmt.Println($collection(i));
}

for $index_or_key, value := range $collection {
    fmt.Printf("index = %d, value = %d",index, value)
}

/*
 * for循环
 *
 * - for语句出现变量全部为局部变量,只能在for块内部使用
 * - for range拿到的是集合中元素数据的拷贝
 */

```

## 字符串 - 定义

```go
// 定义字符串
str := "$content"
// 定义字符串(内容原封不动)
str := `$content
        $content
`

/*
 * 字符串
 *
 * - string底层是由byte数组实现,因此字符串长度即为byte数组长度,
 * - string是常量即不可变的,如果需要可变可以转化为数组后修改
 * - Go中的字符串只能用双引号表示,单引号表示字符
 */

```

## 字符串 - 操作

```go
// 计算字符串长度
len($str)
// 字符串拼接
$str = $substr1 + $substr2
// 字符串自分割
$substr := $str[$includeIndex:$excludeIndex]
// 字符串分割为数组
$arr := string.Split($str, "$separator")
// 是否为子串
strings.Contains($str, $subStr)
// 前后缀判断
strings.HasPrefix($str, $subStr)
strings.HasSuffix($str, $subStr)
// 子串首次出现的位置,如无返回-1
strings.Index($str, $subStr)
// 子串最后一次出现的位置,如无返回-1
strings.LastIndex($str, $subStr)
// join操作
strings.Join($arr, "$separator")
// 字符串和切片转变
$str := '$content'
$arr := []byte($str)
$arr := []rune($str)
// 大量拼接字符串采用stringBuild
sb := string.Builder{}
sb.WriteString("$subStr")
sb.WriteString("$subStr")
str := sb.String()

```

## 数组 - 定义

```go
// 定义数组
$arr := [$count]$type
// 定义数组
$arr := [...]$type{$item1,$item2};

// 二维切片
arr := [][]$type {
  {$item00, $item01, $item02},
  {$item10, $item11, $itme12},
}

/* 数组概述:
 *
 * 数组为值类型,且数组的长度是数组类型的一部分,因此函数传参数必须保证实参和形参的长度一直否则会报错;
 * 数组支持==/!=操作符,因为内存总是被初始化过的;
 * [n]*int表示存放多个整型指针的指针数组, *[n]int表示指向整型数组的数组指针
 */

```

## 数组 - 操作

```go
// 数组分割转为切片
$slice = arr[includeIndex:excludeIndex]

```

## 切片 - 定义

```go
// 方式一(长度和扩容标准都为元素个数)
$slice := make([]$type, $count);
// 方式二(capacity作为再扩容标准)
$slice := make([]$type, $count, $capacity)
// 方式三
$slice := []$type{$item1, $item2}

// 二维切片
slice := [][]$type {
  {$item00, $item01, $item02},
  {$item10, $item11, $itme12},
}

/* 切片概述
 *
 * - 切片是含有指向底层数组的指针 & 切片长度 & 切片容量的结构体
 * - 切片在进行函数传递会将结构体属性进行值传递,因此底层数组指针引用也进行了传递
 */

// slice底层结构
type slice struct {
 array unsafe.Pointer
 len   int
 cap   int
}

```

## 切片 - 操作

```go
// 计算切片长度
len($slice)
// 计算切片底层数组容量
cap($slice)
// 切片追加元素
$slice = append($sourceSlice, $item1)
// 切片追加数组
$slice = append($slice, $subSlice...)
// 截取子切片(子切片和原切片共享同一块内存空间,直到再扩容后两者内存分离)
$slice = $sourceSlice[$includeIndex:$excludeIndex]
// 切片拷贝
copy($targetSlice, $sourceSlice)
// 数组转切片
$slice = $array[:]

```

## 字典 - 声明

```go
// 方式一
$map := map[string]string{}
// 方式二
$map := make(map[string]string)
$map := make(map[string]string, $capacity)
// 方式三
$map := map[string]string {
  "$key1":"$value1",
  "$key2":"$value2",
}
/**
 * 字典概述:
 *
 * - 字典在函数传递中为引用传递;
 *
 */

```

## 字典 - 操作

```go
// 设置key
map[$key] = $value
// 移除key
delete($map, $key)
// 查找value
if $value, exists := map[$key];exists {
  fmt.Println($value)
} else {
   fmt.Printf("not exsits")
}

```

## 管道 - 定义

```go
// 管道定义
chan := make(chan $type, $count),

/*
 * 管道定义
 *
 * - 管道是引用传递
 */

```

## 管道 - 使用

```go
// 存放数据
chan <- $name
// 获取数据
$name := <-chan
// 查看管道容量
len(chan)
// 遍历管道(需要先提前关闭管道)
close(chan)
for item := range chan {
  fmt.Println(item)
}

```

## 函数 - 定义

```go
// 函数定义
func $function($param $type) $rtype {
  fmt.Printf($content)
}
// 函数定义(多返回值)
func $function($param $type) ($rtype1, $rtype2) {
  fmt.Printf($content)
}
// 函数定义(带名称返回值可以认为是函数内部初始化为零的局部变量赋值后即可直接返回)
func $function($param $type) ($rname1 $rtype1, $rname2 $rtype2) {
  $rname1 = $rvalue1
  $rname2 = $rvalue2
  return
}
// 可变长参数函数
func function($param $type, $slice ...$type) $rtype {
  $content
}

/*
 * 函数基础
 *
 * - 函数是一种复合数据类型,不同函数只要拥有相同形参列表和返回值列表认为类型相同;
 * - 函数不支持默认值参数 & 函数重载 & 函数嵌套(匿名函数才可);
 * - 函数参数传递永远是值拷贝,即使传递指针也是传递指针副本,本质同样指向同一地址;
 * - 函数形参的不定长函数必须是最后一个参数,不定参数类型必须相同,其底层借助切片实现;

 * - 函数的多值返回实质上是在栈上开辟多个地址分别存放返回值,如果返回值是存放到堆上的则需要拷贝到栈上来一并返回
 */

```

## 函数 - 闭包

```go
func accumulation() func(i int) int {
 a := 1;
 return func (i int) int{
  a = a + i
  return a
 };
}

accum1 = accumulation();
accum1(1)     // 2
accum2(1)     // 3

accum2 = accumulation();
accum1(1)     // 2

/*
 * 闭包基础
 *
 * - 闭包是可以被传递和引用的一个独立模块，一个函数和它能够捕获其上下文中的常量和变量的组合称为“闭包”;
 * - 闭包对闭包外的环境引入是直接引用,编译器会将闭包引用的外部变量分配到堆上;
 * - 如果函数返回的闭包引用了函数内的局部变量,则多次调用该函数,返回的闭包各自引用多个不同外部变量;
 * - 如果函数返回的闭包引用了函数内的局部变量,返回的闭包函数函数调用多次都会对该捕获变量有影响;
 */

```

## 函数 - defer

```go
defer function() {

}()

defer fmt.Println($name)

/*
 * defer关键字
 *
 * - 多个defer会根据栈结构先注册的后执行,最后在执行return操作;
 * - defer函数的实参在注册时即会通过值拷贝进行传递,而函数内部依赖的局部变量在执行时才会进行值传递;
 * - defer函数内即使发生panic,会暂时搁置该panic,不影响主协程和其他defer;
 */

```

## 类型别名

```go
// 复合类型别名
type strMap map[string]string
// 函数别名
type add func($param1 $type1, $param2 $type2) $rtype

```

## 类型系统

```go
                                                  +--------------------+
                                             +--> |  pre-declared type | (int/float32/bool/byte/rune/string/error)
                                             |    +--------------------+
                                             |         (预定义类型)
                            (命名类型)        |
                        +--------------+     |
                   +--> |  Named Type  |-----|
                   |    +--------------+     |
                   |                         |
                   |                         |
+-------------+    |                         |    +---------------------+
| Type System |----|                         +--> |  user-defined type  | (type newType oldType)
+-------------+    |                              +---------------------+
                   |                                    (用户定义类型)
                   |
                   |    +--------------+
                   +--> | Unnamed Type | (array/slice/map/pointer/chan/struct/interface/function)
                        +--------------+
            (未命名类型 & 类型字面量 & 复合类型是一个概念)

/**
 * 底层类型:
 *
 * - 预声明类型和类型字面量的底层类型是自身;
 * - 自定义类型的底层类型会逐级查找老类型直到找到事预声明类型或类型字面量为止;
 *
 *
 * 类型相同标准:
 *
 * - 两个命名类型变量需要保证类型声明的语句完全相同;
 * - 两个未命名类型变量需要保证两者类型声明字面量结构相同 & 内部元素类型相同;
 * - 命名类型和未命名类型的类型永远不相同,通过type关键字声明的两个类型相同;
 *
 * 类型变量赋值标准:
 *
 * - 两个变量类型相同可以直接赋值;
 * - 两个类型具有相同底层类型,并且其中存在至少一个未命名类型可以直接赋值;
 * - 接口类型接收具体类型,并且具体类型的方法实现了接口中所有方法;
 */

```

## 结构体 - 定义

```go
type $StructName struct {
   $Field $type;
   $Field $type

   $AnonymousField           // 匿名字段
}

// instance method
func ($receive $StructName) $instanceMethod($param $type) $rtype {
   $content
}

// instance method
func ($recevier *$StructName) $instanceMethod($parm $type) $rtype{
   $content
}

// class method
func ($StructName) $classMethod() {
   $content
}

// inteface implement
func ($StructName) $interfaceMethod($param $type) $type {

}

// inteface implement
func ($recevier *$StructName) $interfaceMethod($param $type) $type {

}

// setter & getter
func ($recevier *$StructName) Set$Field($field type) {
   $recevier.$Field = $field
}

func ($recevier *$StructName) Get$Field() type {
   return $recevier.$Field
}

// 值类型变量
$st := $StructName{ $field : $value }

// 指针类型变量
$ptr := &$StructName{ $field : $value }

/*
 *
 * 结构体匿名字段:
 *
 * - 结构体变量可以像访问自身字段方法一样访问匿名字段方法,编译器会负责查找;
 * - 通过匿名字段可获得和继承类似的复用能力,依据编译器查找次序,只需在外层定义同名方法,就可以实现类似继承的函数重载;
 *
 * 结构体方法:
 *
 * - 方法就是把接受者作为形参并能针对接收者自动转化调用的函数,接收者可以是值类型变量(命名类型 & 结构体)或者指针类型变量;
 * - T值类型变量的方法集包含接收者为T的全部方法;如果使用值类型变量调用指针类型方法,会自动进行将值引用为指针类型进行调用;
 * - *T指针类型变量的方法集包含接收者为T & *T的全部方法;如果使用指针类型变量调用值类型方法,会自动先把指针类型解引用为值类型调用;
 * - 结构体如果包含匿名字段值类型T,则该结构体的值类型变量和指针类型变量的方法集包含了接收者为T的全部方法;
 * - 结构体如果包含匿名字段指针类型*T,则该结构体值类型和指针类型变量方法集包含了接受者为T & *T的全部方法;
 * - 结构体方法值调用是通过将结构体变量获取到方法并保存并在需要的时候调用,本质将捕获的变量和函数组成闭包;
 * - 方法表达式通过把类型变量作为形参进行函数调用,如此会按照函数标准严格进行类型判断;
 *
 */

```

## 结构体 - 初始化

```go
// 方式一(栈)
$st := $StructName{ $field : $value }

// 方式二(栈指针指向堆对象)
$ptr := &$StructName{ $field : $value }

```

## 结构体 - 多态

```go
// interface
type $InterfaceName interface {
   $Method()
}

// struct
type $StructName1 struct {

}

func (this *$StructName1) $Method() {
   // implement method
}

// struct
type $StructName2 struct {

}

func (this *$StructName2) $Method() {
   // implement method
}

func $InvokeMethod($interface $InterfaceName) {
    // $interface.$Method()
}

// main
func main() {
   $obj1 := $StructName1()
   $obj2 := $StructName2()
   $InvokeMethod(&$obj1)
   $InvokeMethod(&$obj2)
}

/* interface的基本要素:
 *
 *  - 需要有继承关系
 *  - 子类必须实现了父类的全部接口方法
 *  - 父类类型变量指向子类对象
 */

```

## 接口

```go
type $InterfaceName interface {
   $Method($param $type) $type
}

/*
 * 接口基础
 *
 * - 结构体采用值接收者实现接口,那么结构体变量和结构体指针变量都可以赋值给该接口;
 * - 结构体采用指针接收者实现接口,那么只有结构体指针变量才可以赋值给该接口;
 * - 结构体只有实现了接口中的全部方法才认为实现了该接口;
 */

```

## 类型断言

```go
// 区分数据类型方式一
data, ok := $name.($type)
if !ok {
   fmt.Print("data type right")
} else {
   fmt.Print("data type wrong");
}

// 区分数据类型方式二(switch判断的是变量类型,而value作为case内部局部变量)
switch $value := $name.(type) {
case nil:
   fmt.Println($value, "is nil")
case int:
    fmt.Println($value, "is int")
case string:
    fmt.Println($value, "is string")
default:
    fmt.Println($value, "not type matched")
}

```

## 反射机制

```go
type Person struct {
 name string
 age int
}

func main() {
 person := Person{"ouyang",25}

 inputType := reflect.TypeOf(person)
 fmt.Print("inputType is ", inputType.Name())
 inputValue := reflect.ValueOf(person)
 fmt.Print("inputValue is ",inputValue)

 for i := 0; i < inputType.NumField(); i++ {
   field := inputType.Field(i)                  // 属性(名称/类型)
   value := inputValue.Field(i).Interface()     // 属性值
   // name: string ouyang
   fmt.Print("%s: %v = %v\n", field.Name, field.Type, value)
 }

 // 通过type获取里面所有的方法
 for i := 0; i < inputType.NumMethod(); i++ {
   m := inputType.Method(i)
   fmt.Print("%s:%v",m.Name, m.Type)
 }
}

```

## 协程 - 调度

```go
/*
 * G: 表示协程,每次通过go func()就创建了一个G,包含了执行函数和上下文信息;
 * P: 表示协程执行所需要的系统资源,最多GOMAXPROCS个;
 * M: 每个M都代表了1个内核线程,线程想运行任务就得获取P,从P的本地队列获取G,当P的本地队列为空时会优先从其他P的本地队列或全局队列获取G执行;
 *
 * worksteal机制:当某个本地队列的所有协程执行完毕后,会从其他本地队列获取协程执行;
 * handoff机制: 如果某个协程阻塞了,那么会把该协程的本地队列绑定到到其他新创建的线程执行;
 *
 * 有多少个P由最大并发数GOMAXPROCS决定,P表示调度执行单元;可以通过runtime.GOMAXPROCS(count)决定
 *
 */
                            (全局队列)
                FIFO   +-----------------+
                ---->  |   G    G    G   | ---->
                       +-----------------+
              +---+     +---+     +---+     +---+
              | G |     | G |     | G |     | G |
              | G |     | G |     | G |     | G |    (本地队列)
              | G |     | G |     | G |     | G |
              +-+-+     +-+-+     +-+-+     +-+-+
                |         |         |         |
                |         |         |         |
                ▼         ▼         ▼         ▼
              +---+     +---+     +---+     +---+
              | P |     | P |     | P |     | P |    GOMAXPROCS(最大并行数)
              +---+     +---+     +---+     +---+
                ▲         ▲         ▲         ▲
                |         |         |         |
                |         |         |         |
                M0        M1        M2        M3      内核线程
                ▲         ▲         ▲         ▲
                |         |         |         |
             +-------------------------------------+
             |      operating system scheduler     |
             +-------------------------------------+
                ▲         ▲         ▲         ▲
                |         |         |         |
              +---+     +---+     +---+     +---+
              |CPU|     |CPU|     |CPU|     |CPU|     硬件CPU核心
              +---+     +---+     +---+     +---+

```

## 并发 - runtime

```go
/**
* runtime.Gosched()使用:
*
* - Gosched作用是让调度器将当前协程放弃执行,转而执行其他就绪协程;当前的协程也会让未来某个时间点继续执行;
* - Gosched作用是避免某个协程长时间占用CPU资源,提高程序的并发性能;
*
* runtieme.Goexit()基础:
*
* - Goexit作用是退出当前协程
*
* runtime.GOMAXPROCS()基础:
*
* - GOMAXPROCS用来设置当前程序并发时占用的CPU逻辑核心数,默认使用全部CPU逻辑核心
*/

```

## 并发 - 协程组

```go
var $group sync.WaitGroup
$group.Add($taskCount)

go func() {
    defer $group.Done()
    fmt.Printf("task1 finish\n")
}()

go func() {
    defre $group.Done()
    fmt.Printf("task2 finish\n")
}()

$group.Wait()

```

## 并发 - 互斥锁

```go
// 互斥锁
var (
    mutex   sync.Mutex
    counter int
)

func incrementCounter() {
    mutex.Lock()
    defer mutex.Unlock()
    counter++
}

```

## 并发 - 读写锁

```go
/**
 * RWMutex读写锁
 *
 * - 读写锁适用于读次数远多于写次数
 */
var (
    mutex   sync.RWMutex
    counter int
)

func readCounter() int {
    mutex.RLock()
    defer mutex.RUnlock()
    return counter
}

func writeCounter(value int) {
    mutex.Lock()
    defer mutex.Unlock()
    counter = value
}

```

## 并发- 无缓冲通道

```go
$chan := make(chan $type)
go func()  {
    // 塞数据
    $chan <- $data
    close($chan)
}()
// 取数据
$data := <-$chan

/*
 * 无缓冲chan基础:
 *
 * - 无缓冲通道的发送操作会阻塞,直到其他协程在该通道上执行接收操作,此时值才能成功发送;
 * - 无缓冲通道可以实现协程之间的同步等待,因此也被称之为同步通道;
 *
 * chann关闭:
 *
 * - 已关闭的通道禁止继续发送数据或继续关闭,否则会引发panic;
 * - 已关闭的通道可以继续获取数据,直到获取完毕后则会获取到对应类型的零值;
 */

```

## 并发 - 缓冲通道

```go
$chan := make(chan $type, $buffer_count)
go func ()  {
    // 塞数据
    $chan <- $data
    close($chan)
}()
// 取数据
data := <- chan

/*
 * 缓冲chan基础
 *
 * - 向缓冲区为空的通道进行读取操作会导致协程阻塞,直到该通道被塞入其他数据才能继续被读取;
 * - 向缓冲区已满的通道进行写入操作会导致协程阻塞,直到该通道被取出数据才能继续写入其他数据;
 */

```

## 并发 - select

```go
$chan1 := make(chan $type, 1)
$chan2 := make(chan $type, 1)
// 设置select最长阻塞时间
maxTimeChannel := make(chan bool, 1)
go func(){
   time.Sleep(time.Second * time.Duration(second))
   maxTimeChannel <- true
}()

select {
case message1 := <- $chan1:
   fmt.Println("message1 type:", message1)
case message2 := <- $chan2:
   fmt.Println("message2 type:", message2)
case <- maxTimeChannel:
   fmt.Println("reach max time")
default:
   fmt.Println("nothing received")

/*
 * select基础
 *
 * - select会一直出于阻塞状态,当监听的其中一个通道可读或可写则接触阻塞进入就绪通道的分支流程;
 * - 如果监听通道存在多个可读可写的状态,则select随机选择一个通道进行处理;
 */

```

## 并发 - 协程池

```go
var group sync.WaitGroup
ch := make(chan struct{}, 3)
for i := 0; i < 10; i++ {
 ch <- struct{}{}
 group.Add(1)
 go func(i int) {
   defer group.Done()
   log.Println(i)
   time.Sleep(time.Second)
   <-ch
 }(i)
}
group.Wait()

```

## 异常处理 - panic & recover

```go
func function(param interface{}) {
 defer func ()  {
   if err := recover(); err != nil {
   fmt.Printf("发生了panic")
  }
  panic(errors.New("error"))
}

/*
 * panic基础
 *
 * - panic用于抛出错误,会FIFO执行当前协程的defer链,然后打印出错误信息和调用堆栈,最后调用exit(2)结束整个进程
 * - recover用于捕获panic,阻止其继续向上传递,使其只进行逆序调用当前协程的defer链,而不至于结束整个进程
 * - init函数引发的panic只能在init函数内捕获,main函数无法被捕获,由于init函数先于main函数执行
 * - 函数内不能捕获内部启动协程所抛出的panic
 */

```

## 异常处理 - error

```go
/**
 * 自定义错误(实现error接口)
 */
type baseerror struct {
 message string
 createtime string
}

func (error baseerror) error() string {
 return error.createtime + ":" + error.message
}

func newbaseerror(message) baseerror {
 return baseerror {
   message: message.
   createtime: time.now().format("xxxx-xx-xx")
 }
}

```

## 文件操作

```go
/*
 * 读取文件中每一行
 */
func readLines(filepath string) ([]string, error) {
 var lines []string

 file, err := os.Open(filepath)
 if err != nil {
  return nil, err
 }
 defer file.Close()

 scanner := bufio.NewScanner(file)
 for scanner.Scan() {
  lines = append(lines, scanner.Text())
 }

 if err := scanner.Err(); err != nil {
  return nil, err
 }

 return lines, nil
}

/*
 * 读取大文件内所有内容
 */
func readLargeFile(filepath string) (string, error) {
 file, err := os.Open(filepath)
 if err != nil {
  return "", err
 }
 defer file.Close()
 // 创建一个缓冲读取器
 reader := bufio.NewReader(file)
 // 读取文件内容
 content, err := ioutil.ReadAll(reader)
 if err != nil {
  return "", err
 }
 // 将内容转换为字符串并返回
 return string(content), nil
}

/*
 * 读取小文件所有内容
 */
func readSmallFile(filepath string) (string, error) {
 content, err := ioutil.ReadFile(filepath)
 if err != nil {
  return "", err
 }
 // 将内容转换为字符串并返回
 return string(content), nil
}

/*
 * 写入文件
 */
func appendLargeFile(filepath string, content string) error {
 // 打开文件，如果文件不存在则创建
 file, err := os.OpenFile(filepath, os.O_RDWR|os.O_APPEND, 0666)
 if err != nil {
  return err
 }
 defer file.Close()

 // 创建一个缓冲写入器
 writer := bufio.NewWriter(file)
 // 将内容追加到缓冲区
 _, err = writer.WriteString(content + "\n")
 if err != nil {
  return err
 }

 // 将缓冲区中的数据写入文件
 err = writer.Flush()
 if err != nil {
  return err
 }

 return nil
}

/**
 * 复制文件
 */
func copyFile(sourcePath string, targetPath string) error {
 // 打开源文件
 sourceFile, err := os.Open(sourcePath)
 if err != nil {
  return err
 }
 defer sourceFile.Close()

 // 创建目标文件
 targetFile, err := os.Create(targetPath)
 if err != nil {
  return err
 }
 defer targetFile.Close()

 // 将源文件内容复制到目标文件
 _, err = io.Copy(targetFile, sourceFile)
 if err != nil {
  return err
 }

 // 将目标文件刷新到磁盘
 err = targetFile.Sync()
 if err != nil {
  return err
 }

 // 获取源文件信息
 srcInfo, err := os.Stat(sourcePath)
 if err != nil {
  return err
 }

 // 将目标文件权限设置为源文件权限
 err = os.Chmod(targetPath, srcInfo.Mode())
 if err != nil {
  return err
 }

 return nil
}

```

## 命令行参数

```go
 // 创建一个标志位参数
 flag.StringVar(&$option,"$option", "$value_default","$tip_message")
 // 命令行参数解析
 flag.Parse()

 // 用户使用
 $program $key $value

 // 返回除命令行参数的其他参数(标志位参数)
 fmt.Println(flag.Args())
 // 返回除命令行参数的其他参数个数
 fmt.Println(flag.NArg())
 // 返回使用命令行参数个数
 fmt.Println(flag.NFlag())

```

## 数据库 - 初始化

```go
import (
 "database/sql"
 _ "github.com/go-sql-driver/mysql"
 "fmt"
)
// 定义全局数据库
var db *sql.DB

func initDB() (err error) {
 dbInfo := "$user:$password@tcp($127.0.0.1:3306)/$db_specific?charset=utf8mb4&parseTime=True"
 // 不会校验账号密码是否正确
 db, err = sql.Open("mysql", dbInfo)
 if err != nil {
     return err
 }
 // 尝试与数据库建立连接
 err = db.Ping()
 if err != nil {
     return err
 }
 return nil
}

```

## 包管理机制

```go
/**
 * 包管理机制
 *
 * - go都是通过包和模块来组织代码,导入是导入包而不是文件
 * - Go语言的权限访问机制基于包和可见性实现,只有首字母大写的标识符才是可导出的,其他标识符只能在包内部使用;
 * - Go语言还提供了import、export、_等关键字来控制权限访问从而更加灵活地控制包的访问权限;
 */

```

## 规范 - 命名

```go
Golang命名规范:

- 文件命名采用小写单词,使用下划线分割各个单词;
- 包命名采用小写单词,请勿使用下划线和混合大小写;
- 变量/属性/函数/接口/结构体命名采用驼峰命名法,首字母根据包级别的访问控制大写或者小写,其中接口一般通过er结尾;
- 单元测试文件命名规范为xxx_test命名,测试函数必须通过TestFunction函数编写测试用例

```

## 输出

```go
// 输出布尔型
fmt.Printf("$data : %t\n",$data)
// 输出整型
fmt.Printf("$data : %d\n",$data)
// 输出浮点型
fmt.Printf("$data : %f\n",$data)
// 输出字符(asiic)
fmt.printf("$data : %b\n",$data)
// 输出字符(unicode)
fmt.printf("$data : %c\n",$data)
// 输出字符串
fmt.Printf("$data : %s\n",$data)
// 输出指针地址
fmt.Printf("$data : %p\n",$data)
// 输出对象类型
fmt.Printf("$data type : %T\n", $data)
// 输出对象值
fmt.Printf("$data value: %v\n",$data)
// 输出对象属性名 & 对象属性值
fmt.Printf("$data value: %+v\n",$data)
// 输出对象类型 & 对象属性名 & 对象属性值
fmt.Printf("$data value: %#v\n",$data)

```

## jSON转化

```go
// 追加到属性后
`json:$key`

// JSON转模型
$object = $Struct{}
err = json.Unmarshal($json, $object)
// 模型转JSON
$json, err := json.Marshal($object)

```

## jWT

```go
                       +------------+
      +--------------> |    头部    |  包含算法和类型信息
      |                +------------+
      |
+-----------+          +------------+
|    JWT    | -------> |    载荷    |  包含实际传输的数据
+-----------+          +------------+
      |
      |                +-------------+
      +--------------> |    签名     | 用于验证数据的完整性和真实性
                       +-------------+

```

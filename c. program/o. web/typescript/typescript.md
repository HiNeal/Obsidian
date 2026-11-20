## 变量 - let

```typescript
// 定义变量(推断类型约束)
let $name = $value
// 定义变量(显式类型约束)
let $name $type = $value
// 定义变量(联合类型约束)
let $name: $type1 | $type2

```

## 常量 - const

```typescript
// 定义常量
const $name = $value

```

## 原始类型

```typescript
+-----------------------------------------+
| Data Type |            DES              |
|-----------------------------------------|
|   number  |                             |
|-----------------------------------------|
|   string  |                             |
|-----------------------------------------|
|   boolean |                             |
|-----------------------------------------|
|   symbol  |                             |
|-----------------------------------------|
|    null   |                             |
|-----------------------------------------|
| undefined |                             |
|-----------------------------------------|
|    void   |                             |
|-----------------------------------------|
|    any    |                             |
+-----------------------------------------+

```

## 表达式 & 语句

```typescript
/**
 * JS表达式:主要是用来计算并且最终一定会返回一个值
 *
 * - a                                  // 值
 * - a + b                              // 计算操作
 * - sample()                           // 函数调用
 * - arr.map()                          // 数组操作
 * - function sample(){}                // 返回函数本身
 */

/**
 * JS语句:执行的操作不会返回一个值,而是立即生效看不见其结果
 *
 * - if(condition) {}
 * - for(condition) {}
 * - switch(condition){}
*/

```

## 字面量类型

```typescript
/**
 * 字面量类型
 *
 * - 字面量本身也可以作为一种类型存在
 * - 字面量类型配合联合类型使用表示一组明确的可选值列表
 */

let str1 = "hello world"                        // str1类型为string
const str2 = "hello world"                      // str2类型为hello world
const str3 : "hello world" = "hello world"      // str3类型为hello world

function method(direction:'east' | 'west' | 'north' | 'south') {
    console.log(direction)
}

```

## 枚举 - 定义

```typescript
// 枚举定义
enum $Enumeration {$Enum1, $Enum2, $Enum3}
$Enumeration.$Enum1          // 访问枚举

// 数值枚举定义
enum $Enumeration {
    $Enum1 = 0,
    $Enum2 = 1,
    $Enum3 = 2,
}

// 字符串枚举定义
enum $Enumeration {
    $Enum1 = '$Enum1',
    $Enum2 = '$Enum2',
    $Enum3 = '$Enum3',
}

```

## 数组 - 定义

```typescript
// 定义数组(推断类型约束)
const $arr = [$item1, $item2];
// 定义数组(显式类型约束)
const $arr: $type[] = [$item1, $item2];
const $arr: Array<$type> = [$item1, $item2]
// 定义数组(联合类型约束)
const $arr:($type1 | $type2)[] = [$item1, $item2];
const $arr: Array<$type1 | $type2> = [$item1, $item2]

```

## 数组 - 基础

```typescript
// 增加多个元素于头部
$arr.unshift($item1, $item2);
// 增加多个元素于尾部
$arr.push($item1, $item2);
// 删除尾元素
$arr.pop();
// 删除头元素并返回所删除的头元素
$arr.shift();
// 覆盖首元素
$arr.fill($item);
// 覆盖区间元素
$arr.fill($item, startIncludeIndex, endExcudeIndex);
// 拼接数组内元素并指定连接符
$arr.join('$connector');
// 数组解构赋值
let [$name1, $name2 = $defalut] = [$item1, $item2];
let [$name1, ...$name2] = [$item1, $item2, $item3];

```

## 数组 - 排序

```typescript
// 数组反转
$arr.reverse()
// 从小到大排序
$arr.sort()
// 从大到小排序
$arr.sort(() => {v2 - v1})

```

## 数组 - 查找

```typescript
// 查找目标元素Index,不存在返回-1,无法查找引用类型
$arr.indexOf($item)
// 从后往前查找目标元素Index,不存在返回-1,无法查找引用类型
$arr.lastIndexOf($item)
// 查找目标元素是否包含,无法查找引用类型
$arr.includes($item)
// 查找数组首个满足条件的元素,如无返回undefined
let $item = $arr.find((item) => { $condition })
// 查找数组首个满足条件的元素下标,如无返回-1
let $index = $arr.find((item) => { $condition })

```

## 数组 - 遍历

```typescript
// 数组遍历
for(let i = 0; i < $arr.length; i++) {
    console.log($arr[i]);
}

// 数组遍历
$arr.forEach((item, index, array) => {
    console.log($arr[i]);
});

// 数组遍历
for(const index in $arr) {
    console.log($arr[index]);
}

// 数组遍历
for (const item of $arr) {
    console.log(item);
}

// 数组遍历
for (const [key, value] of arr.entries()) {
    console.log(key, value);
}

```

## 数组 - 扩展

```typescript
// 每个元素满足该条件则返回true
let $result = $arr.every((item, index, array) => { $condition })

// 其中元素满足改条件则返回true
let $result = $arr.some((item, index, array) => { $condition })

// 满足条件返返回
let $result = $arr.filter((item, index, array) => {
    if (condition) {
        return true
    }
});

// 在数组的所有元素上应用函数
let $result = $arr.map((item, index, array) => {
    return item
});

// 在数组上进行累计操作并返回最终累计结果
let $result = $arr.reduce((pre_name, item, index, array) => {
    console.log(pre_name, item);
    return $current_name  // next会成为下一次调用的pre
}, $first_pre_name)

```

## 元组 - 定义

```typescript
// 定义元组
let tuple: [type1, type2] = [value1, value2]

```

## 集合 - 基础使用

```typescript
// 定义Set
let $set = new Set();

// 增加元素
$set.add($item)
// 删除元素
$set.delete($item)
// 判断元素是否存在
$set.has($item)
// 清空元素
$set.clear();

// set转array
[...$set]
Array.from($set)

// 交集
let $set = new Set(
    [...$set1].filter(item => $set2.has(item))
);

// 差集
let $set = new Set(
    [...$set1].filter(item => !$set2.has(item))
);

// 并集
let $set = [...$set1, ...$set2];

```

## 弱集合 - 定义

```typescript
// 定义weakSet
const $weakSet = new WeakSet();

// 增加元素
$weakSet.add($itemRef);
// 删除元素
$weakSet.delete($itemRef);

```

## 函数 - 定义

```typescript
// 函数表达式定义(推荐)
const $func = ($param1: $ptype1, $param2: $ptype2): $rtype => {

}

// 函数表达式定义(指明函数类型)
const $func: ($param1: $ptype1, $param2: $ptype2)=>$rtype = ($param1, $param2) => {

}

// 函数定义
function $function($param1: $ptype1, $param2: $ptype2): $rtype {

}

// 函数定义(参数默认值)
function $function($param1: $ptype1, $param2: $ptype2 = $default): $rtype1 | $rtype2 {

}

// 函数定义(可选参数)
function $function(param:{param1: ptype1; param1?: aptype2}): $rtype {

}

/**
 * 函数定义:
 *
 * - 函数返回值请指明返回值类型即便为void;
 * - 函数可选参数必须放在函数参数列表的末尾;
 */

```

## 对象 - 定义

```typescript
// 定义对象(指明类型)
let obj: {$attr: $atype; $method($param: $ptype): $rtype} = {
    $attr: $value,
    $method($param: $ptype): $rtype {

    }
}

// 定义对象(指明类型)
let obj: {$attr: $atype; $func: ($param: $ptype) => $rtype} = {
    $attr: $value,
    $func: ($param: $ptype) => $rtype = ($param) {

    }
}

// 定义对象(多行书写)
let obj: {
    $attr: $atype
    $func: ($param: $ptype) => $rtype
} = {
    $attr: value,
    $func: ($param: $ptype) => $rtype = ($param) {

    }
}

// 定义对象(可选属性)
let obj: {$attr1: $atype1; $attr2?: $atype2} = {
    $attr1: $atype1,
    $attr2: $atype2, // 即使没有这个属性也类型正确
}

```

## 解构赋值

```typescript
// 数组解构赋值
let [$item1, item2, item3=$default] = [value1, value2, value3];
// 字典解构赋值
let {$key1, $key2} = {$key1 : $value1, $key2 : $value2};
let $key1;  ({$key1} = {$key1 : $value1})
// 字符串解构赋值
const [$item1, $item2] = $string
// 函数解构
let $json = {
    $key1 : $value,
    $key2 : $value
}

function $func({a, b = $default}) {
    console.log($key1, $key2);
}

$func($json)

// 对象解构赋值(对象嵌套依旧适用)
let  $object = {$attr1 : $value1, $attr2 : $value2};
let { $attr1, $attr2, $attr3 = $default} = $object;
let { $attr1 : $newAttr1, $attr2 : $newAttr2}  = $object;

```

## 扩展运算符 & rest参数

```typescript
/**
 * spread运算符(数组 => 序列)
 */
function add(a, b, c) {
   return a + b + c
}

const numbers = [1, 2, 3]
console.log(add(...numbers))

// 数组合并(展开语法)
let $array1 = [$item3, $item4, $item5];
let $array2 = [$item1, $item2, ...$array1];

// 对象合并(展开语法)
let $config1 = {};
let $config2 = {}
let $mergeConfig = {...$config1, ...$config2};

/**
 * rest运算符(序列 => 数组)
 */
function resetMethod(param,...arr) {
    console.log(arr);       // [1, 2, 3]
    for(let item of arr){
        console.log(item);  // 1 2 3
    }
}

resetMethod(0, 1, 2, 3)

```

## 类型任意 - any

```typescript
let $name: any = $value
/**
 * Any类型:
 *
 * - Any类型的变量不会进行类型约束,可以随意修改变量的类型;
 * - 声明变量和函数参数不提供类型和默认值此时默认为Any类型;
 */

```

## 类型别名 - type

```typescript
// 联合类型别名
type $unionType = ($type1 | $type2)
// 普通对象别名
type $object = {$attr1: $value1; $attr2: $value2}
// 对象类型别名
type Interface = {
    attr1: atype1
    attr1: atrype2
    method(param: ptype):rtype
}

/**
 * 类型别名 & 接口
 *
 * - 类型别名可以为任意类型指定别名,而接口专门为对象指定类型
 */

```

## 类型获取 - typeof

```typescript
function formatType:(param: typeof(obj)) {

}

/**
 * typeof
 *
 * - typeof在类型上下文中使用是获取TS中数据对应的类型;
 * - typeof在普通上下文使用是获取JS中数据对应类型;
 * - typeof只能用来查询变量或属性的类型(:号后),无法查询函数调用后返回值等其他数据对应类型;
 */

```

## 类型断言 - as

```typescript
// 类型断言(推荐)
$name as $type

```

## 接口 - 定义

```typescript
// 描述对象类型
interface $Interface {
    $attr1: $atype1
    $attr2?: $atype2                      // 可选属性
    readonly $attr3: $atype3              // 只读属性
    $method($param: $ptype): $rtype       // 方法
}

let obj: $Interface = {
    $attr1 = $value1
    $attr2 = $value2
    $attr3 = $value3,                     // 以后不可再修改
    $method($param: $ptype): $rtype {

    }
}

/**
 * 类型别名 & 接口
 *
 * - 类型别名可以为任意类型指定别名,而接口专门为对象指定类型;两者都可以认为是一种类型
 */

```

## 接口 - 继承

```typescript
interface $SuperInterface {
    $attr1: $atype1
}

interface $SubInterface extends $SuperInterface {
    $attr2: $atype2
}

```

## 类 - 定义

```typescript
class $ClassName implements $Interface{
    $attr1: $atype1
    $attr2: $atype2           // 实现接口中的属性
    readonly $attr3: $atype3  // 只读用于防止在构造函数之外的属性进行赋值

    constructor($attr1: $atype1) {
        this.$attr1 = $value
    }

    // 对象方法
    $access $instanceMethod($param): $rtype {

    }

    // 实现接口
    $interfaceMethod($param): $rtype {

    }
}

const obj = new ClassName($value)

```

## 类 - 继承

```typescript
class SuperClass {

}

class SubClass extends SuperClass {

}

```

## 类 - 访问权限控制

```typescript
+----------------------------------------------+
|     access   |  类内部  |  子类内  |   其他类   |
|----------------------------------------------|
|  public/none |   YES   |   YES   |    YES    |
|----------------------------------------------|
|     protect  |   YES   |   YES   |    NO     |
|----------------------------------------------|
|     private  |   YES   |   NO    |    NO     |
+----------------------------------------------+

/**
 * 类权限控制
 *
 * - public: 允许在类的内部与外部修改和访问,不明确设置访问修饰符默认即为公开;
 *           父类public属性或方法子类也必须只能设置为public;
 * - protected: 只允许在父类与子类使用，不允许在类的外部使用
 *              父类保护属性和方法子类可以修改为protocted或public
 * - private: 父类私有属性和方法子类不允许重写或修改,同时子类无法访问父类的私有属性和方法;
 *
 */

```

## 类型兼容

```typescript
/**
 * 类的类型兼容
 *
 * - TypeScript采用结构化类型系统(鸭子类型),如果两个对象具有相同形状则认为是同一类型;
 * - 对于对象类型,成员多的对象可以赋值给成员少的对象;
 */
class LessClass {
    age: number
    constructor(age: number) {
        this.age = age
    }
}

class MoreClass {
    age: number
    name: string
    constructor(age: number, name: string) {
        this.age = age
        this.name = name
    }
}

const obj: LessClass = new MoreClass(3, "tony")

/**
 * 接口的类型兼容
 *
 * - TypeScript采用结构化类型系统(鸭子类型);
 * - 对于接口和接口之间,成员多的接口可以赋值给成员少的接口;
 * - 对于接口和对象之间,成员多的对象可以复制给成员少的接口;
 */
interface LessInterface {
    age: number
}

interface MoreInterface {
    age: number
    name: string
}

class MoreInterfaceClass {
    age: number
    name: string
    constructor(age: number, name: string) {
        this.age = age
        this.name = name
    }
}

let moreInterface1: MoreInterface  = { age: 18, name: "tony"}
let lessInterface1: LessInterface = moreInterface1

let lessInterface2: LessInterface = new MoreInterfaceClass(1, "tony")
let moreInterface2: MoreInterface = new MoreInterfaceClass(1, "tony")

/**
 * 函数兼容性
 *
 * - 对于函数类型,参数个数少的可以赋值给参数个数多的;
 * - 相同位置的参数类型要原始类型相同/接口类型兼容(属性个数少赋值给多)/对象类型兼容(属性个数少赋值给多)
 * - 返回值类型需要原始类型相同/对象类型兼容(属性个数多赋值给少)/联合类型(类型少赋值给多)
 *
 */

type lessFunc = (param: number) => number
type moreFunc = (param1: number, param2: string) => number | string

let less: lessFunc = (param) => {return param}
let more: moreFunc = less

```

## 交叉类型

```typescript
interface Interface1 {
    age: number
    func: (param: number) => string
}

interface Interface2 {
    name: string
    func: (param: string) => string
}

type CrossInterface =  Interface1 & Interface2

/**
 * 交叉类型
 *
 * - 使用交叉类型后,新类型同时具备了所组成两个类型的所有属性和方法声明;
 * - 交叉类型和继承都可以实现对象类型组合,不同点在于继承子类父类存在同名属性或方法会报错,交叉类型则不会报错(函数重载);
 *
 */

```

## promise - 对象

```typescript
/**
 * 基础写法(单独处理error)
 *
 */
const promise1 = new Promise((resolve, reject) => {
    console.log("立即同步执行")
    setTimeout(() => {              // 异步操作
        let result =  Math.random() * 100
        if (result > 80) {
            resolve(result)         // pending -> resolved 将promise对象状态设置为成功
        } else if (result < 60){
            reject("failure")       // pending -> rejected 将promise对象状态设置为失败
        } else {
            throw 'error'           // pending -> rejected 将promise对象状态设置为失败
        }
    },2000)
})

promise1.then(
    result => {                     // 对象状态成功回调
        console.log(result)
    },
    error => {                      // 对象状态失败回调
        console.log(error)
    }
)
promise1.finally(() => {
    console.log("finally")          // 最终回调
});

/**
 * 基础写法(统一处理error)
 *
 */
const promise2 = new Promise((resolve, reject) => {
    setTimeout(() => {
        if (result > 80) {
            resolve(result)         // pending -> resolved 将promise对象状态设置为成功
        } else if (result < 60){
            reject("failure")       // pending -> rejected 将promise对象状态设置为失败
        } else {
            throw 'error'           // pending -> rejected 将promise对象状态设置为失败
        }
    },2000)
})

promise2.then(
    result => {                     // 对象状态成功回调,不写失败回调而是catch统一处理
        console.log(result)
    }
)

promise2.then(
    result => {                     // 存在多个成功回调也会一并执行
        console.log(result)
    }
)

promise2.catch((error) => {
    console.log(error)
})
promise2.finally(() => {
    console.log("failure or success")
})

/**
 * Promise基础
 *
 * - Promise支持链式调用,从而解决传统多层回调函数引发回调地狱多层嵌套和不便异常处理的问题,并且指定回调函数也更加灵活;
 * - Promise是本质是构造函数,创建一个内部封装异步操作(网络请求/定时器/文件读取)并可以获取异步操作后成功/失败结果值的对象;
 * - promise对象存在描述状态的属性PromiseState,存在pending/resolved/rejected三种状态,状态的改变会调用对应的回调函数;
 * - promise对象存在记录异步任务是否成功结果的属性PromiseResult,可以通过resolve/reject修改对应的状态记录;
 *
 * - 通过构造函数创建一个等待状态的promise对象;
 * - 会立即同步执行构造函数传入的executor回调函数(resolve, reject) => {};
 * - 在executor函数执行异步操作(网络请求/定时器/文件加载);
 * - 异步操作完毕后成功调用resolve()使得promise对象变为resolved状态,失败调用reject()使得promise对象变为rejected状态;
 * - 内部会检测当前promise对象的状态去then中调用对应onResolved()和onRejected()/Oncatch()回调函数,最后返回新promise对象;
 */

```

## promise - 函数封装

```typescript
function sendRequest(url) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.send();
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(xhr.response)
                } else {
                    reject(xhr.status)
                }
            }
        }
    })
}

sendRequest('https://www.openai.com').then(
    result => {
        console.log(result)
    },
    error => {
        console.log(error)
    }
)

```

## promise - 流程图

```typescript
(resolved status)             then()
                                              +----------------+      +-----------------------+
                                 +----------> | promise object | ---> | callback onResolved() | ---------+
                                 |            +----------------+      +-----------------------+          |
                                 |                                                                       |
                                 | resolve() for success                                                 |
                                 |                                                                       |
                                 |                                                                       v
+---------------+       +-----------------+                                                     +-------------------+
| new Promise() | ----> | Async Operation |                                                     | new promise object|
+---------------+       +-----------------+                                                     +-------------------+
(pendding status)                |                                                                       ^
                                 |                                                                       |
                                 | reject()  for failure                                                 |
                                 |                                                                       |
                                 |            +----------------+       +-----------------------+         |
                                 +----------> | promise object | ----> | callback onRejected() |---------+
                                              +----------------+       +-----------------------+
                                               (rejected status)                then()
                                                                                catch()

/**
 * - 通过构造函数创建一个等待状态的promise对象;
 * - 会立即同步执行构造函数传入的executor回调函数(resolve, reject) => {};
 * - 在executor函数执行异步操作(网络请求/定时器/文件加载);
 * - 异步操作完毕后成功调用resolve()使得promise对象变为resolved状态,失败调用reject()使得promise对象变为rejected状态;
 * - 内部会检测当前promise对象的状态去then中调用对应onResolved()和onRejected()/Oncatch()回调函数,最后整体返回一个新promise对象;
 */

```

## promise - resolve

```typescript
/**
 * Promise.resolve
 *
 * - 主要作用是为了快速得到一个成功/失败的promise对象
 * - 如果传入参数为非Promise类型,返回结果为成功状态promise对象
 * - 如果传入参数为Promise类型,返回参数的结果决定了resolve的结果
 */
let p1 = Promise.resolve(18)
let p2 = Promise.resolve(new Promise((resolve, reject) => {
    resolve("success")
}))
let p3 = Promise.resolve(new Promise((resolve, reject) => {
    reject("error")
}))
p3.catch(error => {
    console.log(error)
})

```

## promise - reject

```typescript
/**
 * Promise.reject
 *
 * - 主要作用是为了快速得到一个失败的promise对象
 */
let p1 = Promise.reject(18)

```

## promise - All

```typescript
let p1 = new Promise((resolve, reject) => {
    resolve("success")
})

let p2 = new Promise((resolve, reject) => {
    resolve("success")
})

let p3 = Promise.reject("failure")

const result = Promise.all([p1, p2, p3])

/**
 * Promise All
 *
 * - 只有全部promise成功后才认为成功,并且返回每个promise成功后返回的数据;
 * - 其中一个promise失败后即认定为失败,并且返回该失败promise所reject数据;
 *
 */

```

## promise - race

```typescript
let p1 = new Promise((resolve, reject) => {
    setTimeout(() => {
        resolve("success")
    }, 3000);
})

let p2 = new Promise((resolve, reject) => {
    setTimeout(() => {

    }, 2000);
})

let p3 = new Promise((resolve, reject) => {
    setTimeout(() => {

    }, 1000);
})

const p = Promise.race([p1, p2, p3])

/**
 * Promise.race
 *
 * - 返回的Promise取决于传入的数组中最快的Promise的状态;
 */

```

## promise - 链式调用

```typescript
let p = new Promise((resolve, reject) => {
    setTimeout(() => {
        let result =  Math.random() * 100
        if (result > 80) {
            resolve(result)         // pending -> resolved 将promise对象状态设置为成功
        } else if (result < 60){
            reject("failure")       // pending -> rejected 将promise对象状态设置为失败
        } else {
            throw 'error'           // pending -> rejected 将promise对象状态设置为失败
        }
    },2000)
}).then(result => {
    // throw "error"
    // return 18
    return new Promise((resolve, reject) => {
        resolve("success")
    })
}).then(result => {
    console.log(result)
}).catch(error => {
    // 没有必要逐个promise指定失败回调而是最后统一处理即可
    console.warn(error)
})

/**
 * Promise链式调用
 *
 * - 如果p1中异步任务resovle & p1中then成功回调抛出throw,则会返回失败状态Promise对象p2;
 * - 如果p1中异步任务resovle & p1中then成功回调返回非Promise类型对象,则返回成功状态Promise类型对象p2;
 * - 如果p1中异步任务resovle & p1中then成功回调返回Promise类型对象,则返回和该状态一致Promise类型对象p2;
 */

let p1 = new Promise((resolve, reject) => {
    setTimeout(() => {
        let result =  Math.random() * 100
        if (result > 80) {
            resolve(result)         // pending -> resolved 将promise对象状态设置为成功
        } else if (result < 60){
            reject("failure")       // pending -> rejected 将promise对象状态设置为失败
        } else {
            throw 'error'           // pending -> rejected 将promise对象状态设置为失败
        }
    },2000)
});

let p2 = p1.then(result => {
    // throw "error"
    // return 18
    return new Promise((resolve, reject) => {
        resolve("success")
    })
}, error => {
    console.warn(error);
})

let p3 = p2.then(result => {
    console.log(result)
})

```

## promise - Util

```typescript
const util = require("util")
// 把一个回调函数转化为promise对象
const promise = util.promisify($function)

```

## async - Await

```typescript
async function method() {
    let p1 =new Promise((resolve, reject) => {
        setTimeout(() => {
            let result =  Math.random() * 100
            if (result > 80) {
                resolve(result)
            } else if (result < 60){
                reject("failure")
            } else {
                throw 'error'
            }
        },2000)
    })

    let p2 =new Promise((resolve, reject) => {
        setTimeout(() => {
            let result =  Math.random() * 100
            if (result > 80) {
                resolve(result)
            } else if (result < 60){
                reject("failure")
            } else {
                throw 'error'
            }
        },2000)
    })

    try {
        let res1 = await p1     // 处理异步任务
        let res2 = await p2     // 处理
        console.log(res1 + res2)
    }catch(error) {
        console.warn(error)
    }
}

method()

/**
 * async
 *
 * - async函数返回值为promise对象,而该promise对象的状态由async函数执行的返回值所决定;
 * - async函数内抛出异常,则async函数返回状态为失败的promise对象;
 * - async函数返回值是一个非Promise类型对象的数据,则async函数返回状态为成功的的promise对象;
 * - async函数返回值是一个Promise类型对象的数据,则async函数返回和该Promise对象状态一致的promise对象;
 *
 *
 * await
 *
 * - await函数必须写在async函数中,async函数中可以没有await
 * - await右侧表达式为非promise对象,则直接将此值作为await的返回值
 * - await右侧表达式为promise对象,await返回是promise成功的值.如果该promise失败了会抛出异常需要catch处理
 */

```

## 模块

```typescript
/**
 * 模块导出
 *
 * - 文件名和文件内定义的类名/导出名称没有任何关系,不必要保持一致;
 * - 每一个模块都有一个独立的作用域,使用模块代表必须使用严格模式;
 * - 默认导出在一个模块内有且只能有一个,在导入是无需再使用{},可以直接导入;
 */
export { $name }                              // 具名导出
export { $name as $alias}                     // 别名导出
export { $name as default}                    // 默认导出
export { $name1 as default, $name2}           // 混合导出

/**
 * 模块导入
 *
 * - 默认导出在一个模块内有且只能有一个,在导入是无需再使用{},可以直接导入;
 */
import { $name } from 'pathOfFile'            // 具名导入
import { $name as $alias} from 'pathOfFile'   // 别名导入
import $name from 'pathOfFile'                // 默认导入
import $name1 { $name2 } from 'pathOfFile'    // 混合导入
import * as api from 'pathOfFile'             // 批量导入(api.xxx/api.default.xxx)

// 实现按需加载
if (true) {
    import("pathOfFile").then(({$name}) => {
        console.log($name)
    })
}

```

## 泛型 - 函数

```typescript
/**
 * 泛型基础
 *
 * - Type表示类型变量(类型容器),是一种特殊类型的变量用于专门捕获类型而不是值;
 * - 泛型同样支持类型参数推断机制,根据参数字面量自动推断类型,并采用字面量为类型;
 */
function method1<Type>(param: Type): Type {
    return param;
}

const name1 = method1<string>('tony')
const name2 = method1('tony')
console.log(name1)
console.log(name2)

/**
 * 泛型约束
 *
 * - 泛型约束主要为了解决泛型参数无法在函数内使用该类型的方法;
 * - 通过指定更加具体的类型完成泛型约束
 */

function method2<Type>(param: Type[]): Type[] {
    param.length
    return param;
}

/**
 * 泛型约束
 *
 * - 泛型约束主要为了解决泛型参数无法在函数内使用该类型的方法;
 * - 通过extends添加约束的方式完成泛型约束(这里区分继承)
 */
interface Interface {attr: string}
function method3<Type extends Interface>(param: Type): Type {
    // 表示该类型必须存在attr属性
    console.log(param.attr)
    return param
}

/**
 * 泛型约束
 *
 * - 泛型约束可以存在多个泛型类型变量,并且互相之间可以产生约束关系;
 * - keyof接收对象类型,会自动生成对象属性名称的联合类型;
 * - 通过extends添加约束的方式完成泛型约束表示Key必须是Type所有键任意一个(这里区分继承);
 */

function method4<Type, Key extends keyof Type>(obj: Type, key: Key) {
    // keyof Type会自动合成联合类型name | age
    return obj[key]
}

let obj = {attr1: 'tony', attr2: 18}
method4(obj, 'attr1')

```

## 泛型 - 接口

```typescript
/**
 * 泛型接口
 *
 * - Type表示类型变量(类型容器),是一种特殊类型的变量用于专门捕获类型而不是值;
 * - 接口的类型变量对接口中所有其他成员可见,接口中所有成员都可以使用类型变量;
 * - 使用泛型接口时,需要显式指定具体的类型;
 */

interface Interface<Type> {
    method:(param: Type) => Type

}

let obj: Interface<number> = {
    method(param) {
        return param
    }
}

```

## 泛型 - 类

```typescript
/**
 * 泛型类
 *
 * - 创建类实例可以显示指定明确类型;
 * - Type表示类型变量(类型容器),是一种特殊类型的变量用于专门捕获类型而不是值;"
 *
 */
class ClassName<Type> {
    attr: Type
    constructor(param: Type) {
        this.attr = param;
    }

    instanceMethod:(param1: Type, param2: Type) => Type
}

const obj = new ClassName<number>(18)

```

## 泛型 - 工具

```typescript
/**
 *
 * - Type表示类型变量(类型容器),是一种特殊类型的变量用于专门捕获类型而不是值;
 * - Partial<Type>构造一个Type中所有属性设置为可选的类型;
 * - Readonly<Type>构造一个Type中所有属性设置为只读的类型;
 * - Pick<Type, Keys>构造一个选中属性名来构造新类型;
 * - Record<Keys, Type>构造一个属性为Keys,属性类型为Type的对象类型
 */

interface Interface {
    attr1: number
    attr2: string
    attr3: string
}

type PartialPerson = Partial<Interface>                 // 变为可选类型
type ReadonlyPerson = Readonly<Interface>               // 变为只读类型
type PickPerson = Pick<Interface, 'attr1' | 'attr2'>    // 重新组合类型

type RecordPerson = Record<'attr1' | 'attr2', string>   // 构造新对象类型
let obj: RecordPerson = {
    attr1: 'str1',
    attr2: 'str2'
}

```

## 类型 - 索引签名

```typescript
/**
 * 索引签名类型
 *
 * - 索引签名类型用于无法确定对象中有哪些属性;
 * - JS对象中的属性本身就是string类型;
 */

interface Interface {
    [key: string]: number  // 约束属性名称必须为字符串,属性值必须为数值类型
}

let obj: Interface = {
    attr1: 10,
    attr2: 11,
    // attr3: "12",  由于索引签名类型限制此处会报错
}

/**
 * 索引签名类型
 *
 * - 索引签名类型用于无法确定对象中有哪些属性;
 * - JS对象中的属性本身就是string类型;
 */
const bill1 = {
    gas:10,
    water:20,
    electricty: 30,
}

const bill2 = {
    gas:11,
    water:21,
    electricty: 31,
}

function calculateBillTotal(bill: { [key: string]: number }) {
    let total = 0;
    for (const key in bill) {
      total += bill[key];
    }
    return total;
}

/**
 * 索引签名类型
 *
 * - 数组本身也是通过索引签名类型所实现,索引签名设置为数字类型
 */
interface TYArray<Type> {
    [index: number]: Type
}

let arr: TYArray<number> = [1, 2, 3]
console.log(arr[0])

```

## 类型 - 映射

```typescript
/**
 * 映射类型
 *
 * - 映射类型是基于旧类型创建新类型(对象类型);
 * - 映射类型只能在类型别名中使用,不能在接口中使用;
 */

type oldType = 'x' | 'y' | 'z'                          // 原类型
type newType1 = {x: number; y: number; z: number}       // 新类型
type newType2 = {[key in oldType]: number}              // 字面量联合类型构造对象类型(效果同上)

type olderType = { x: number; y: string; z:boolean}     // 原类型
type newerType1 = {[key in keyof olderType]:number}     // 对象类型构造新对象类型(内部属性原始类型都变为number)

type aliasType = { x: number; y: string; z:boolean}
type trueType1 = aliasType['x']                          // 查询属性类型为number
type trueType2 = aliasType['x' | 'y']                    // 查询多个属性类型
type trueType3 = aliasType[keyof aliasType]              // 查询所有属性类型

```

## 类型声明文件

```typescript
/**
 * 类型声明文件
 *
 * - 类型声明文件file.d.ts主要是用于为已存在的JS库提供类型信息;
 * - 类型声明文件只能包含类型声明相的代码,而不能存在可执行代码;
 *
 * - TS为JS运行时可用的所有标准化内置API都提供了类型声明文件;
 * - 第三方库大部分会自带类型声明文件,无自带类型声明文件的库需要去DefinitelyTyped Github仓库查找对应类型声明文件;
 * - 以无自带类型声明文件lodash为例,VSCode会自动提示需要npm i --save-dev @types/lodash
 *
 */

/**
 * 提供类型声明(为自有组件)
 *
 * - 如果多个TS文件需要用到同一类型可以考虑创建d.ts文件提供实现类型共享;
 * - 创建filename.d.ts文件,并使用export导出需要共享的类型,在需要使用的ts文件import导入即可;
 */

/**
 * 提供类型声明(为自有JS文件)
 *
 * - 创建和JS文件同名的dts文件,在导入JS文件时TS会自动加载同名的dts文件以通过declare提供已存在变量的类型声明;
 * - 对于type/interface本身为TS类型可以省略declare关键字;
 * - 对于let/function等JS和TS都存在的则需要使用declare关键字明确指定类型声明;
 * - 最后在dts文件中通过export将已经declare完毕的类型导出即可;
 */

```

## 输出

```typescript
// 输出
console.log($value);
// 输出对象JSON格式
console.log(JSON.stringify($object));
console.log(JSON.stringify($object, null, 2))
// JSON转对象
console.log(JSON.parse($jsonString));
// 输出对象目录化格式
console.dir($object)

```

## snippets-Javascript

```typescript
/**
 * Javascript-Snippets:
 *
 * nfn                          // 函数表达式
 * anfn                         // 创建匿名函数
 * prom                         // 返回Promise
 * sti                          // 创建定时器
 * thenc                        // 添加then并捕获
 *
 * clg                          // 输出
 */

```

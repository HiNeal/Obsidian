## 变量 - let

```javascript
let $name = $value

/**
 * - let遵循块级作用域,声明变量非法使用会产生临时性死区,意味着使用let声明变量必须先声明后使用,如此可以提高程序健壮性;
 */

console.log(str);
let str = "hello world"; // error

let des = "hi world"
function sample() {
    console.log(des);     //error
    let des = "hello world";
}
sample();

```

## 常量 - const

```javascript
// 常量(块级作用域)
const $name = $value

```

## 变量 - var

```javascript
var $name = $value

/*
 * - var遵循全局/函数作用域
 * - 全局作用域下var声明的变量以及未通过var/let/const声明的变量都认为是全局变量并挂载成为window下的属性;
 * - 函数作用域内var变量会先查看该函数上下文是否有相关的变量定义,如果没有才从继承来的作用域中搜索直到全局作用域为止;
 * - 变量提升表示使用var声明的变量,会在代码预解析阶段就被提前声明但不会被提前赋值;
 * - 函数表达式和函数声明相同时,如果提前调用该下相同符号时函数提升优于变量提升;
 */

```

## 数据 - 区分类型

```javascript
/**
 * 判断数据的类型:
 *
 *  数字    --------->   number
 *  字符串  --------->   string
 *  函数    --------->   function
 *  数组    --------->   object
 *  对象    --------->   object
 *  空值    --------->   object
 *  未初始化 --------->   undefined
 */
console.log(typeof $data);

/**
 * 检测数据data的原型链上是否有type.prototype
 *
 *  函数    instanceof   函数名/Object  -------->   true
 *  数组    instanceof   Array/Object  -------->   true
 *  对象    instanceof   object        -------->   true
 */
console.log($data instanceof $type);

```

## 运算符 - ||

```javascript
/**
 * - 获取变量列表或者表达式中的第一个真值
 * - 遇到真值且是为副作用表达式则执行
 */

let result = '' || '' || 'content'         // content
let action = '' || alert("hello world")    // 执行

```

## 表达式 & 语句

```javascript
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

## 数字

```javascript
// 判断是否为数字
Number.isFinite($data)
// 判断是否为整数
Number.isInteger($data)

```

## 数组 - 定义

```javascript
// 定义数组
const $array = [$item1, $item2];
// 定义数组
const $array = new Array($item1, $item2);
// 定义数组(元素默认为undefine)
const $array = new Array($length);
// 定义数组
const $array = Array.of($item1, $item2)

```

## 数组 - 基础

```javascript
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

```javascript
// 数组反转
$arr.reverse()
// 从小到大排序
$arr.sort()
// 从大到小排序
$arr.sort(() => {v2 - v1})

```

## 数组 - 查找

```javascript
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

```javascript
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

```javascript
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

## 字符串

```javascript
// 字符串
let $str = "$content"
let $str = new String("$content")

```

## 字符串 - 常用方法

```javascript
// 字符串拼接
'the data is' + $data
`the data is ${$data}`
`the data is ${function()}`

// 标签模板
let str1 = 'content1';
let str2 = 'content2';
template `the str1 is ${str1},the str2 is ${str2}`;

function template(strings, ...values) {
    console.log(strings); // [ 'the str1 is ', ',the str2 is ', '' ]
    console.log(values);  // [ 'the str1 is ', ',the str2 is ', '' ]
}
// 计算长度
$str.length
// 大写
$str.toUpperCase()
// 小写
$str.toLowerCase()
// 移除空格
$str.trim()
// 获取指定字符
$str[$index]
$str.charAt[$index]

// 字符串截取保留子字符串
$str.slice($startStayIndex, $endLeaveIndex)
$str.substr($startStayIndex, $endLeaveIndex)
$str.substring($startStayIndex, $stayLength)

// 字符串查找
$str.includes("$substr")
// 是否子字符串开头
$str.startsWith("$substr")
// 是否子字符串结尾
$str.endsWith("$substr")

// 字符串替换
$str.replace("$sourceStr","$targetStr")

```

## 符号 - 定义

```javascript
// 定义符号
let $name = Symbol();
// 定义符号(描述字段)
let $name = Symbol("$description");
// 定义符号(描述字段 + 系统登记)
let $name = Symbol.for("$description");
let $description = Symbol.keyfor("$description");

```

## 符号 - 基础使用

```javascript
/**
 * 对象中定义symbol & 访问symbol
 */
let $obj = {
    [symbol] : '$description'
};

console.log(obj[symbol]);

for (const key in obj) {
    console.log(key); // symbol属性不参与遍历
}

```

## 集合 - 基础使用

```javascript
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

```javascript
// 定义weakSet
const $weakSet = new WeakSet();

// 增加元素
$weakSet.add($itemRef);
// 删除元素
$weakSet.delete($itemRef);

```

## map - 定义

```javascript
let $map = new Map([
    ['$key1', 'value1'],
    ['$key2', 'value2'],
])

// 取值
$map.get('$key1')
// 设值
$map.set($key, $value)
// 是否存在某个值
$map.has($item)

```

## 函数 - 定义

```javascript
// 函数定义
function $function($param) {
    $content
}

// 函数表达式定义
let func = function($param) {
    $content
};
/**
 * - 函数提升表示使用函数function声明的形式创建的函数会被声明提前,因此可以先调用后声明;
 * - 函数如果通过函数表达式赋值给变量则不会被函数提升,这种情况下不能先调用后声明;
 * - 函数声明和函数表达式的变量名称相同时,如果提前调用该下相同符号时函数提升优于变量提升;
 */

```

## 函数 - 立即执行

```javascript
/**
 * 用来定义私有作用域防止污染全局作用域,模拟出块级作用域
 */
(function ($param) {
    var $name = $value;
})($param);

```

## 函数 - 箭头

```javascript
var $arrowFunc = (param1, param2) => {
    return param1 + param2
}
/**
 * 箭头函数内部的this指针指向和父作用域保持一致,解决了函数嵌套导致的内部函数this绑定失效的问题
 */

```

## 函数 - 作用域

```javascript
/**
 * 每次调用开辟新环境,生成新的变量;
 */
function accumulation1() {
   let n = 1;
   return function sum() {
      console.log(++n);
   };
   sum();
}

accumulation1()() // 2
accumulation1()() // 2

/**
 * 返回的函数持有了调用函数作用域内部的变量,因此可以实现累加效果;
 */
function accumulation2() {
   let n = 1;
   return function sum() {
      console.log(++n);
   };
   sum();
}

let func2 = accumulation2();
func2();             // 2
func2();             // 3

/**
 * 返回的函数内部并没有持有被调用函数的任何变量,因此无累加效果
 */
function accumulation3() {
   let n = 1;
   return function sum() {
      let m = 1;
      function show() {
         console.log(++m);
      }
      show();
   };
}

let func3 = accumulation()
func3()         // 2
func3()         // 2

/**
 * 返回的函数内部持有被调用函数的变量,因此有累加效果
 */
function accumulation4() {
   let n = 1;
   return function sum() {
      let m = 1;
      return function show() {
         console.log(++m);
      }
      show();
   };
}

let func = accumulation4()()
func4()         // 2
func4()         // 3

```

## 函数 - 标签

```javascript
function $method(str, ...values) {
    console.log(str); //["str1", "str2", "", raw: Array(3)]
    console.log(values); //["Tony", "www.baidu.com"]
}
let name = 'Tony',url = 'www.baidu.com';
$method `str1${name}str2${url}`;

```

## 函数 - this指针

```javascript
/**
 * 定义对象并在方法内部访问属性
 */
let person1 = {
    fullName: "tony",
    show: function() {
        this.fullName;
        console.log(this.fullName) // tony
    }
}
person1.show();

/**
 * 通过构造函数并在方法内部访问属性
 */
function Person(fullName) {
    this.fullName = fullName;

    this.show = function() {
        console.log(this.fullName); // tony
    };
}
let person2 = new Person("tony");
person2.show();

/**
 * 对象方法内部嵌套函数并在其内部访问属性为undefined,因为该嵌套函数已经不属于该对象;
 */
let person3 = {
    fullName: "tony",
    show: function() {
        function render() {
            console.log(this.fullName); // undefined
        }
        render();
    }
}
person3.show();

/**
 * 构造函数内部方法嵌套函数并在其内部访问属性为undefined,因为该嵌套函数已经不属于该对象;
 */
function Person(fullName) {
    this.fullName = fullName;

    this.show = function() {
        function render() {
            console.log(this.fullName)
        }
        render();
    }
}
let person4 = new Person("tony");
person4.show();

/**
 * 通过const解决方法嵌套函数this指针的指向
 */
function Person(fullName) {
    this.fullName = fullName;

    this.show = function() {
        const self = this;
        function render() {
            console.log(self.fullName)
        }
        render();
    }
}
let person5 = new Person("tony");
person5.show();

/**
 * 箭头函数的this只想和父级作用域会保持一致,解决了方法嵌套函数内部作用域this指针失效的问题
 */
function Person(fullName) {
    this.fullName = fullName;

    this.show = function() {
        return () => {
            console.log(this.fullName);
        }
    }
}
let person6 = new Person("tony");
person6.show()();

function Person(fullName) {
    this.fullName = fullName;
    this.show = function() {
        console.log(this.fullName); // undefined
    }
}

let person = new Person("tony")
let func = person.show;
func();

```

## 函数 - 绑定

```javascript
/**
 * 方法绑定对象call:
 *
 * - 立即执行,逐个传递所需参数;
 * - 不能改变箭头函数中this的指向;
 * - 当多个函数有共同的逻辑可以抽取共同逻辑封装为新函数,在两个函数内借助call/apply绑定新函数;
 */
$function.call($object, $param1,$param2)

/**
 * 方法绑定对象apply:
 *
 * - 立即执行,数组传递所需参数;
 * - 不能改变箭头函数中this的指向;
 * - 当多个函数有共同的逻辑可以抽取共同逻辑封装为新函数,在两个函数内借助call/apply绑定新函数;
 * - Math.max.apply(Math, $arr) 快速输出数组内最大值;
 */
$function.apply($object, [$param1, $param2])

/**
 * 方法绑定对象bind:
 *
 * - 不会立即执行
 * - 不能改变箭头函数中this的指向;
 * - 当多个函数有共同的逻辑可以抽取共同逻辑封装为新函数,在两个函数内借助call/apply绑定新函数;
 */
let $bindFunction = $function.bind($object,{param1})

```

## 函数 - 解构

```javascript
// 函数解构赋值
let { random } = Math;
console.log(random());

```

## 扩展运算符 & rest参数

```javascript
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

## 解构赋值

```javascript
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

## 对象 - 定义

```javascript
// 定义对象
let $obj = new Object();
$obj.$attr = $value;

// 定义对象
let $obj = {};
obj['$attr'] = $value1  // 对象中的属性本身就是string类型

// 定义对象
let $obj = {}
let $content = "attr"
$obj[$content] = $value // 读取变量作为key

 // 定义对象
let $obj = {
   $attr : $value,

   // 简写方式
   $function($param) {
      $content
   }

   // 完整写法
   $method : function($param) {
      $content
   },
}

// 定义对象(构造函数)
function $function($attr) {
   this.$attr = $attr;
   this.$method = function($param) {
       console.log(this.$attr)
   }
   return this
}

let $obj = new $function($value)
let $str = new String("")
let $arr = new Array(5)

// 定义对象(工厂模式)
function $function($attr) {
    return {
        $attr: $attr
        $method:function() {

        },
    }
}

let $obj = $function($value)

```

## 对象 - 属性

```javascript
// 判断对象本身是否存在属性
$obj.hasOwnProperty("$attr");
// 判断属性是否存在或者在原型对象的属性
"$attr" in $obj
// 获取所有属性
Object.keys($obj)
// 获取对象中所有属性
Object.getownPropertyNames($obj)
// 获取所有值
Object.values($obj)
// 禁止向对象中添加属性
Object.preventExtensions($obj)
// 查询对象是否被禁止添加属性
Object.isExtensible($obj)
// 封闭对象(无法配置/无法新增删除属性)
Object.seal($obj)
// 判断对象是否属于封闭状态
Object.isSealed($obj)
// 冻结对象(无法配置/无法新增删除/修改/配置属性)
Object.freeze($obj)
// 判断对象是否处于冻结状态
Object.isFrozen($obj)
// 查看属性特征(writable/enumerable/configurable)
Object.getownPropertyDescriptor($obj, "$attr")
// 查看对象的所有属性特征(writable/enumerable/configurable)
Object.getownPropertyDescriptors($obj)
/**
 * 新增属性并设置属性特征:
 *
 * - writable     是否可以被修改
 * - enumerable   是否可以被遍历
 * - configurable 是否可以被删除 & 重新配置属性特征
 */
Object.defineProperty($object, "$attr",{
    value: "$value",
    writable: $true,
    enumerable: $true,
    configurable: $true
})
/**
 * 新增多个属性并设置属性特征
 *
 * - writable     是否可以被修改
 * - enumerable   是否可以被遍历
 * - configurable 是否可以被删除 & 重新配置属性特征
 */
Object.defineProperties($object,{
    $attr1 : {
        value: "$value",
        writable: $true,
        enumerable: $true,
        configurable: $true
    },
    $attr2 : {
        value: "$value",
        writable: $true,
        enumerable: $true,
        configurable: $true
    },
})

```

## 对象 - 封装

```javascript
// 方式一
let person = {
    // 封装为私有
    data:{name : "tony", age : 18},

    set age(value) {
        this.data.age = value;
    },

    get age() {
        return this.data.age;
    }
}

person.age = 20;
console.log(person.age);

// 方式二
function Person(name, age) {
    // 封装为私有属性
    let data = {name, age};  // 简写
    let data = {name: name, age: age};
    // 封装为私有方法
    let privateMethod = function() {
        return data.name;
    };
    // 公有方法(绑定到this)
    this.publicMethod = function() {

    };
}

let person = new Person("tony", 18);
// 属性和私有方法篡改也不会生效
person.name = "hey"
person.privateMethod = function() {
    return "";
};

```

## 对象 - 拷贝

```javascript
// 浅拷贝
let $targetObject = {};
for (const key in $sourceObject) {
    $targetObject[key] =  $sourceObject[key];
}

// 浅拷贝
let $targetObject = Object.assign({}, $sourceObject);

// 浅拷贝
let $targetObject = {...$sourceObject};

// 深拷贝
function copy(obj) {
    let res = obj instanceof Array ? [] : {};
    for (const [key, value] in object.entries(obj)) {
        res[key] = typeof value == 'object' ? copy(value) : value;
    }
    return res;
}

```

## 对象 - 代理

```javascript
var $proxy = new Proxy($object, {
    get(obj, key, value) {

    },
    set(obj, key, value) {
        // 表示设置成功
        return true
    }
})

```

## 对象 - 原型链图

```javascript
+-------------------+
|  Person.__proto__ | -------------------------------------------------|
+-------------------+                                                  |
         ^                                                             |
         | __proto__                                                   |
         |                                                             |
      (构造函数)          (prototype/原型)          (原型对象)         一一|
+-------------------+   ---------------->   +-------------------+      |
|      Person()     |                       |  Person.prototype |      |
+-------------------+   <----------------   +-------------------+      |
          ^                constructor          ^     |                |
          | new                                 |     |                | __proto__
          |                                     |     |                |
+-------------------+        __proto__          |     |                |
|       person      |   ------------------------+     |                |
+-------------------+                                 |  __proto__     |
       (object)                                       |  (set get)     |
                                                      |                |
                                                      |                |
                           (prototype)                v                |
+-------------------+   ---------------->   +-------------------+      |
|      Object()     |                       |  Object.prototype | <----+
+-------------------+   <----------------   +-------------------+
          ^                constructor          ^     |
          | new                                 |     |  __proto__
          |                                     |     |
+-------------------+        __proto__          |     |
|       object      |   ------------------------+     |
+-------------------+                                 |
                                                      |
                                                      |
                                                      |
                                                      v
                                                     null

```

## 对象 - 原型

```javascript
// 将objectA的原型对象设置为objectB
Object.setPrototypeOf($objectA, $objectB)
// 查看对象的原型对象
Object.getPrototypeOf($object)
// 将objectA的原型对象设置为objectB,会创建新对象并设置到为objectA的原型对象,会丢失构造函数信息等,因此不建议额这么做
let $objectA = Object.create($objectB)
// 查看对象B是否在objectA原型链上
$objectB.isPrototypeOf($objectA)
// 替换原型对象
$Function.prototype = {
    constructor : Person,
    $method() {
          console.log("method")
    }
}

// 增加原型对象的方法
$Function.prototype.$method = function() {
    console.log("method")
}

// 通过对象获取到原型对象中的构造函数,并以此创建新对象
function createByObject(obj,...args) {
    const constructor = Object.getPrototypeOf(obj).constructor;
    return new constructor(...argsargs)
}

```

## 对象 - 原型 - this

```javascript
/**
 * this和原型链没有本质的关系
 */

let person = {
    name: "tony"
}

let user = {
    name: "tonys",
    show() {
        console.log(this.name)
    }
}

Object.setPrototypeOf(person, user)
person.show();

```

## 对象 - 继承图

```javascript
+----------------------------------------------+
|              User.prototype                  |
+----------------------------------------------+
        ^                           ^
        |                           |
        |                           |
        |                           |
        |                           |
+-------------------+       +-------------------+
| Student.prototype |       | Teacher.prototype |
+-------------------+       +-------------------+
        ^                           ^
        |                           |
        |                           |
+-------------------+       +-------------------+
|      Student()    |       |      Teacher()    |
+-------------------+       +-------------------+

```

## 对象 - 继承 - 属性

```javascript
function Person(name, age) {
    this.name = name;
    this.age = age;
}

Person.prototype.show = function() {
    console.log(this.name, this.age);
}

function Student(...args) {
    // 调用父类的初始化函数
    Person.apply(this, args)
}

// 继承
Student.prototype = Object.create(Person.prototype);

let stu = new Student("Neal", 18);
stu.show();

```

## 对象 - 继承 - 方法

```javascript
// 继承方式一
function Person() {}
Person.prototype.behavior = function() {
    console.log("the person is behavior...");
}

function Student() {}
Student.prototype.__proto__ = Person.prototype;
Student.prototype.walk = function() {
    console.log("the student is walking...");
}

function Teacher() {}
Teacher.prototype.__proto__ = Person.prototype;
Teacher.prototype.walk = function() {
    console.log("the teacher is walking...");
}

// 继承方式二
function extend(sub, sup) {
    sub.prototype = Object.create(sup.prototype);
    Object.defineProperty(sub.prototype, "constructor", {
        value: sub,
        enumerable: false
    })
}

function Person() {}
function Student() {}
extend(Student, Person);

// 继承方式三
function Person(name, age) {
    this.name = name;
    this.age = age;
}

Person.prototype.show = function() {
    console.log(this.name, this.age);
}

function admin(name, age) {
    const instance = Object.create(Person.prototype);
    Person.call(instance, name, age);
    return instance;
}

let person = admin("tony", 18);
person.show();

```

## 对象 - 继承 - 多继承

```javascript
function extend(sub, sup) {
    sub.prototype = Object.create(sup.prototype);
    sub.prototype.constructor = sub;
}
function User(name, age) {
    this.name = name;
    this.age = age;
}
User.prototype.show = function () {
    console.log(this.name, this.age);
};
const Request = {
    ajax() {
        return "请求后台";
    }
};
const Credit = {
    __proto__: Request,
    total() {
        // super 等同于 this.__proto__
        console.log(super.ajax() + ",统计积分");
    }
};

function Admin(...args) {
    User.apply(this, args);
}
extend(Admin, User);
Object.assign(Admin.prototype, Request, Credit);
let hd = new Admin("向军", 19);
hd.show();
hd.total(); //统计积分
hd.ajax(); //请求后台

```

## 对象 - 多态

```javascript
// basic
function Animal() {}
Animal.prototype.show = function() {
  console.log(this.description());
};

// cat
function Cat() {}
Cat.prototype = Object.create(Animal.prototype);
Cat.prototype.description = function() {
  return "this is a cat";
};

// dog
function Dog() {}
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.description = function() {
  return "this is a dog";
};

// main
for (const obj of [new Cat(), new Dog()]) {
  obj.show();
}

```

## 类 - 封装

```javascript
const symbol = Symbol()
const weakMap = new WeakMap()
class $className {
    static staicAttr = value
    constructor($defaultAttr, $protectAttr,$privateAttr) {
        this._$defaultAttr = $defaultAttr;
        this[symbol].$protectAttr = $protectAttr
        weakMap.set(this, { $protectAttr: $protectAttr })
        this.#$privateAttr = $privateAttr
    }

    // static method
    static create(...args) {
       return new this(...args)
    }

    // public method
    method() {
        console.log(content)
    }
    // private method
    #privateMethod = () => {
        console.log(content)
    }

    set $defaultAttr(value) {
        this._$defaultAttr = value;
    }
    get $defaultAttr() {
        return this._$defaultAttr;
    }

    set  $protectAttr(value) {
        this[symbol].$protectAttr = value;
        weakMap.set(this, {...weakMap.get(this),$protectAttr})
    }
    get $protectAttr() {
        return this[symbol].$protectAttr;
        return weakMap.get(this).$protectAttr;
    }

    set $privateAttr(value) {
        this.#$privateAttr = value;
    }
    get $privateAttr() {
        return this.#$privateAttr
    }
}

// 创建对象
let obj = new $className(param);

/**
 * 类的定义
 *
 * - 静态属性指的是直接分配到构造函数的属性,通过Function.attr调用;
 * - 静态方法指的是直接分配到构造函数的__proto__的方法,通过Class.method调用;
 * - 公有属性类内外都可以范围,保护属性只能父类和子类内范围,私有属性只能当前类访问
 * - 类的本质就是函数衍生出来的语法糖,并且内部所有语法都是运行在严格模式下;
 * - 类声明方法会自动将该方法放到对应的原型对象当中,并且类声明方法不参与for-in遍历;
 */

```

## 类 - 访问权限控制

```javascript
+------------------------------------------+
|  access  |  类内部  |  子类内  |   其他类   |
|------------------------------------------|
|  public  |   YES   |   YES   |    YES    |
|------------------------------------------|
|  protect |   YES   |   YES   |    NO     |
|------------------------------------------|
|  private |   YES   |   NO    |    NO     |
+------------------------------------------+

```

## 类 - 继承

```javascript
class SuperClass {
    constructor(attr) {
        this.attr = attr
    }
}

class SubClass extends SuperClass{
    constructor(attr) {
        super(attr)
    }
}

```

## promise - 对象

```javascript
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

```javascript
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

```javascript
(resolved status)             then()
                                              +----------------+      +-----------------------+
                                 +----------> | promise object | ---> | callback onResolved() | ---------+
                                 |            +----------------+      +-----------------------+          |
                                 |                                                                       |
                                 | resolve() for success                                                 |
                                 |                                                                       |
                                 |                                                                       v
+---------------+       +-----------------+                                                     +-------------------+
| new Promise() | ----> | Async Operation |                                                     | new promise object |
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

```javascript
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

```javascript
/**
 * Promise.reject
 *
 * - 主要作用是为了快速得到一个失败的promise对象
 */
let p1 = Promise.reject(18)

```

## promise - All

```javascript
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

```javascript
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

```javascript
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

```javascript
const util = require("util")
// 把一个回调函数转化为promise对象
const promise = util.promisify($function)

```

## async - Await

```javascript
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

```javascript
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

## eS - 严格模式

```javascript
/**
 * use strict
 * - 严格模式禁止自动隐式创建全局变量,因此变量的声明必须有var/let/const关键字;
 * - 函数内的this指针指向window;
 * - 对象不能有重名的属性;
 * - 构造函数必须通过new实例化对象;
 */

```

## h5交互

```javascript
document.write($content)

```

## 输出

```javascript
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

```javascript
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

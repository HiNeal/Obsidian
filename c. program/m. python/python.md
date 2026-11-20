## 变量

```python
$name = $value

# 变量声明定义

```

## 常量

```python
# 定义常量
$NAME = $value

# 定义常量
from typing import Final

$NAME: Final = $value

# 定义常量
from dataclasses import dataclass

@dataclass(frozen=True)
class $Constants:
    $NAME2: $type1 = $value1
    $NAME1: $type2 = $value2

# 常量声明定义
#
# - 通过Final定义的常量依旧可以修改,但在静态分析扫描时会提供告警信息;
# - 通过frozen参数设置为True定义的常量无法被修改,可以统一封装所有常量在class内;
#

```

## 数据类型

```python
#         +-----------------------+
#         |    Type   | Data Type |
#         |-----------------------|
#         |           |    int    |
#         |           |-----------|
#         |           |   float   |
#         |           |-----------|
#         |           |   bool    |
#         |           |-----------|
#         |           |    str    |
#         |           |-----------|
#         |   class   |   tuple   |
#         |           |-----------|
#         |           |   list    |
#         |           |-----------|
#         |           |   dict    |
#         |           |-----------|
#         |           |   set     |
#         +-----------------------+
#
#
#  - 任何数据类型本质都是class, 所有的变量都是对象

```

## 流程控制 - if

```python
if $condition1
   $content1
elif $condition2 and $condition2
   $content2
else:
   $content3

# - 禁止使用 && 和 ||, 类似并列成立采用and, 而或成立采用or
#

```

## 流程控制 - for

```python
for item in $data:
    print($item)

```

## 流程控制 - while

```python
while $condition {

}

```

## 关键字 - pass

```python
def passMethod():
    pass

# pass语句什么也不做, 一般用作占位符;

```

## 字符串 - 定义

```python
# 定义字符串
$str = '$content'

# 定义字符串(兼容单引号)
$str = "$content"

# 定义字符串(兼容单双引号)
$str = '''$content'''

```

## 枚举 - 定义

```python
from enum import Enum, unique, IntEnum

# 通过Enum类直接定义枚举
$EnumName = Enum('$EnumName', ('$enum1','$enum2'))

# 定义数字枚举
@unique
class $EnumName(IntEnum):
    $enum1 = 1
    $enum2 = 2

# 定义字符串枚举
@unique
class $EnumName(Enum):
    $enum1 = '$content1'
    $enum2 = '$content2'

```

## 列表 - 定义

```python
$list = [$item1,$item2];

```

## 列表 - 基础

```python
# 计算长度
len($list)

# 增加元素
$list.append($item)

# 删除元素
del $list[$index]

# 截取元素,从startIndex开始取,endIndex结束并且不包括endIndex
$list[$startIndex:$endIndex]

# 移除某个元素
$list.pop(item=$list[index])

# 统计某个元素出现次数
$list.count($item)

# 列表反向
$list.reverse()

# 列表排序
$list.sort($func)

```

## 元组 - 定义

```python
# 定义元组
$tuple = ($item1, $item2)

# 元组基础
#
# - 元组是不可变的,初始化后即不能修改,并且也不能添加或删除元素
# - 元组可以存放不同类型的数据,如果只存放一个数据需要在元素后面添加逗号

```

## 元组 - 基础

```python
# 计算元祖长度
len($tuple)

# 列表转元祖
$tuple = tuple($list)

```

## 字典 - 定义

```python
$dic = {$key1 : $value1, $key2 : $value2}

# 字典基础
#
# key可以用数字/字符串/元组充当,但不可用列表/字典

```

## 字典 - 基础

```python
# 计算字典元素个数
len($dict)

# 输出字典可打印的字符串表示
str($dict)

# 删除字典内所有元素
$dict.clear()

# 返回一个字典的浅复制
$dict.copy()

# 以列表返回字典中的所有值
$dict.values()

```

## 集合 - 定义

```python
# 定义集合
$set = {$item1, item2}

```

## 集合 - 基础

```python
# 增加元素
$set.add($item)

# 移除元素
$set.remove($item)

# 列表转字典
$set = {$list}

# 交集
$set3 = $set1 & $set2

# 并集
$set3 = $set1 | $set2

# 差集
$set3 = $set1 - $set2

```

## 函数 - 定义

```python
def $sampleMethod($param1, $param2):
    $content
    return $data

# 正常调用函数
$sampleMethod(param1, param2)

# 通过关键字参数调用函数
$sampleMethod($param1 = $value1, $param2 = $value2)

# 函数基础:

# 在函数的形参表末尾的参数可以有默认参数值,同时如果对应的结构为list/dict,默认值必须采用None

```

## 函数 - 可变长参数

```python
def $sampleMethod(*$param):
    # 可变长参数,会转化为元组形式
    return $data

sampleMethod('param1','param2','param3')

def $sampleMethod(**$param):
    # 可变长参数,但必须通过关键字参数调用函数
    return $data

sampleMethod($param: ('param1','param2','param3'))

```

## 函数 - 匿名

```python
$anonymous_function = lambda param1, param2 : param1 + param2

# 匿名函数:
#
# python使用lambda来创建匿名函数,同时lambda只是一个表达式,其函数体比def简单很多;
# lambda的主体是一个表达式,而非一个代码块,仅仅能在 lambda 表达式中封装有限的逻辑进去;
# lambda函数拥有自己的命名空间,且不能访问自有参数列表之外或全局命名空间里的参数;

```

## 函数 - 装饰器 - 无参数

```python
# 装饰器: 不影响原有函数功能并且能新增功能
# @decorator: 等同于decorator(world)()
def decorator(func):
    def hello():
        print("hello",end = " "),
        return func()
    return hello

@decorator
def world():
    print("world"),

world()

```

## 函数 - 装饰器 - 有参数

```python
# 带参装饰器: 不影响原有函数功能并且能新增功能
# @decorator: decorator(1)(old_world)()
def decorator(param):
    def func1(func):
        def fun2():
            if (param == 1):
                print("bye ", end='')
            if (param == 2):
               print("hello ", end='')
            return func()
        return fun2
    return func1

@decorator(param=1)
def old_world():
    print('old_world')

@decorator(param=2)
def new_world():
    print('new_world')

old_world()
new_world()

```

## 函数 - 闭包

```python
# 闭包
def counter():
    sum = 15
    print("this is function1")
    def closure(num):
        print(sum + num)
    return closure

func = counter()
func(3);

```

## 类型判断

```python
isinstance($data_or_object, $class_or_tuple)

# 判断数据类型,对象类型采用类判断,系统类型元组采用int/float/string
# 不可变类型:整数/浮点数/字符串/元组, 都采用值传递
# 可变类型:列表/字典/集合, 都采用引用传递

```

## 类 - 定义

```python
class className:
    $instance_or_class_attribute
    $__private_attribute    # 私有属性双下划线开头

    # 构造函数
    def __init__(self,$attribute):
        self.$attribute = $attribute

    # 对象或类方法
    def $instance_or_class_method(self):
        $instace_method_impl

    # 私有方法
    def $__private_method():
        print("this is a private method")
    # 类方法
    @classmethod
    def $class_method(cls):
        $class_method_impl

$object = $className($value)
# 通过对象调用属性即为对象属性(修改对象属性不能修改类属性)
$object.$instance_or_class_attribute
# 通过类调用属性即为类属性(修改类属性可以修改对象属性)
$object.$instance_or_class_attribute
# 通过对象调用方法即为对象方法(修改对象方法不能修改类方法)
$object.$instance_or_class_method()
# 通过类调用方法即为类方法(修改类方法可以修改对象方法)
$className.$instance_or_class_method()
# 通过类调用明确类方法
$className.$class_method()
# 析构函数
del $object

```

## 类 - 继承

```python
class $SuperClass():
    $super_attr
    def __init__(self, $super_attr):
        self.$super_attr = $super_attr
    def $super_method(self):
        print("this is superclass")

class $SubClass($SuperClass):
    $sub_attr
    def __init__(self, $super_attr, $sub_attr):
        super($SuperClass, self).__init__($super_attr)
        self.$sub_attr = $sub_attr
    def $sub_method(self):
        print("this is subclass")

```

## 类 - 多态

```python
class $Superclass(object):
    def __init__(self, $super_attr):
        self.$super_attr = $super_attr

    def $super_method(self):
        print("this is superclass")

class $SubClass1(Superclass):
    def $super_method(self):
        print("this is subclass1")

class $SubClass2(Superclass):
    def $super_method(self):
        print("this is subclass2")

def $printUserInfo($object):
    user.$super_method()

if __name__ == '__main__':
    $object1 = $SubClass1($attr1)
    printUserInfo($object1)
    $object2 = $SubClass2($attr2)
    printUserInfo($object2)

```

## 类 - new方法

```python
class $ClassName(object):
    def __new__(cls, *args, **kwargs):
        print('this is new method')
        print(args)
        # 最后返回父类的方法
        return super($ClassName, cls).__new__(cls)

    def __init__(self, $attr1, $attr2):
        print('this is init method')
        self.$attr1 = $attr1
        self.$attr2 = $attr2

if __name__ == '__main__':
    usr = $ClassName($attr1, $attr2)

# 先调用new方法来创建对象,再init方法进行初始化

```

## 类 - MagicMethod - 属性访问权限

```python
class $ClassName(object):
    def __getattr__(self, name):
        print('调用了 __getattr__ 方法')
        return super($ClassName, self).__getattr__(name)

    def __setattr__(self, name, value):
        print('调用了 __setattr__ 方法')
        return super($ClassName, self).__setattr__(name, value)

    def __delattr__(self, name):
        print('调用了 __delattr__ 方法')
        return super($ClassName, self).__delattr__(name)

    def __getattribute__(self, name):
        print('调用了 __getattribute__ 方法')
        return super($ClassName, self).__getattribute__(name)

     def __get__(self, instance, owner):
         return
         pass

    def __set__(self, instance, value):
         pass

if __name__ == '__main__':
    $object = $ClassName()
    $object.attr1 = True   # 调用setattr
    $object.attr1          # 调用getattribute
    del $object.attr1      # 调用delattr
    try:
        $object.attr2      # 属性不存在,先调用getattribute,后调用getattr
    except AttributeError:
        pass

```

## 类 - 分析

```python
# 获取对象的相应类型；
type($object)
# 判断对象是否为指定的 type 类型的实例；
isinstance($object, $type)
#  判断对象是否具有指定属性/方法；
hasattr($object, $type)
# 获取属性/方法的值, 要是没有对应的属性则返回default值,否则会抛出 AttributeError 异常；
getattr($object, $type[, $default])
# 设定该属性/方法的值，类似于 obj.attr=value;
setattr($object, $type, $value)

```

## 异常处理

```python
try:
    print("the normal code")
except:
    print("the crash code")

```

## 包和模块 - 判断是否是主模块

```python
def main():
    logger.print_info("Start Replacing the Image --------------------------------------------------")

if __name__ == '__main__':
    main()

```

## 包和模块

```python
# 包和模块
#
# - 文件夹中存在__init__.py文件我们称之为包,否则我们称之为模块;
# - 引入的头文件首先会去sys.path中去检索,然后去当前目录中检索;
# - 因此我们可以通过把自己项目拼接到sys.path中去,如此引入的头文件便可以检索得到;

import $module
from $module import $attr_or_method

Path = 'project_path'
if Path not in sys.path:
    sys.path.append(Path)

```

## 文件处理 - withas

```python
with open('$file_name','wb') as f:
        f.write(response.content)

```

## git - 同步路径内所有仓库

```python
def sync_all_respository(path):
    # Get the directory path passed in as an argument
    try:
        dir_path = path
    except IndexError:
        print('No directory path passed in as argument.')
        sys.exit()

    # Traverse through the directory tree and find all the repositories
    for root, dirs, files in os.walk(dir_path):
        for repo in dirs:
            # Update the repository
            os.chdir(os.path.join(root, repo))
            os.system('git pull')

    print('Done updating all repositories!')

```

## 系统 - cookie字符串转化为字典

```python
import http.cookies

def parse_cookie(cookie_str):
    cookie = http.cookies.SimpleCookie()
    cookie.load(cookie_str)
    cookie_dict = {}
    for key, morsel in cookie.items():
        cookie_dict[key] = morsel.value
    return cookie_dict

```

## requests - response

```python
response.encoding = 'utf8'          # 设置响应字符编码
print(response.content)             # 输出响应未解码bytes类型数据
print(response.content.decode())    # 输出响应解码后数据
print(response.text)                # 输出响应解码后数据
print(response.url)                 # 输出响应对应的URL,请求URL和响应URL可能重定向不同
print(response.status_code)         # 输出响应状态码
print(response.headers)             # 输出响应头
print(response.request.headers)     # 输出响应对应的请求头
print(response.cookies)             # 输出响应对应请求的cookie
print(response.json())              # 输出响应内容为json字符串类型的内容

```

## request - post请求 - 初始化

```python
def __init__(self,param):
        self.url = ''
        self.header = {
            'User-header': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        }
        self.data = {
            'key':param
        }
        self.cookie_dict = parse_cookie('please input the cookie str')
        proxies = {
            "http": "http://xx.xx.xx.xx:xx",
            "https": "https://xx.xx.xx.xx:xx"
        }

        def request(self):
            response = requests.post(self.url, data=self.data, headers=self.headers, cookie=self.cookie_dict, proxies=self.proxies, verify=True)
            return response.content

        def parse_data(self, data):
            data_dict = json.loads(data)

    def run():
        pass

    def parse_cookie(cookie_str):
        cookie = http.cookies.SimpleCookie()
        cookie.load(cookie_str)
        cookie_dict = {}
        for key, morsel in cookie.items():
            cookie_dict[key] = morsel.value
        return cookie_dict

```

## requests - 使用session状态保持

```python
import requests
import re

def login():
    session = requests.session()
    session.headers = {
        'User-header': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    }

    token_url = ''
    login_url = ''

    # 请求token接口并通过正则提取token
    result = session.get(token_url).content.decode()
    token = re.findall('token="token=(.*?)"', result)[0]

    # 构造参数请求登录接口使其登录成功
    data = {
        'token' : token,
        'password' : '',
        'login' : '',
    }
    session.post(login_url)

    # 验证是否登录成功
    tmp_url = ''
    response = session.get(tmp_url)
    with open('','wb') as f:
        f.write(response.content)

```

## xlrd - 列名返回列号

```python
def getColumnIndexWithColumnName(columnName):
    columnIndex = None
    for i in range(table.ncols):
        if(table.cell_value(0, i) == columnName):
            columnIndex = i
            break
    return columnIndex

```

## xlrd - 获取确定列所有行

```python
def getRowDataWithTableAndColumnIndex(table, column):
    nrows = table.nrows  # 获取行号
    if column < 0:
        return

    keyList = [];
    for i in range(1, nrows):
        rowdata = table.row_values(i)
        key = rowdata[column]
        keyList.append(key)
        return keyList

```

## 输出

```python
# 输出数据值
print(f"the data is {$data}")
print("the data is {}".format($data))
# 输出数据类型
print(type($data))
# 输出对象所有属性
print(dir($object))
# 输出构造函数中的属性
print($object.__dict__)

```

## 规范 - 命名

```python
# Python命名规范:
#
# 文件/包/模块: 采用全部小写字母
# 类: 使用首字母大写单词串,多个单词驼峰分隔;
# 全局变量/常量: 采用全部大写字母,多个单词下划线分隔;
# 变量/函数/方法: 采用全部小写字母,多个单词下划线分隔;内部变量或函数_开头,内部私有变量和函数__开头;

```

## 注释 - 编码

```python
#-*-coding:utf-8-*-

```

## 注释 - 短 - #

```python
# $content

```

## 注释 - 长 - #

```python
# $content
#
#
#
#

```

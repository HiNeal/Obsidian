## 常量

```ruby
# 定义常量
$NAME = $value

# - @name    实例属性
# - @@name   类属性
# - $name   全局变量
# - name     本地变量

```

## 变量

```ruby
# 定义变量
$name = $value

# - @name    实例属性
# - @@name   类属性
# - $name   全局变量
# - name     本地变量

```

## 数据类型

```ruby
+-----------------------------------------------+
|  type    |   type   |        是否可变          |
|-----------------------------------------------|
|          |  number  |         不可变           |
|          |----------|-------------------------|
|          |  symbol  |         不可变           |
|          |----------|-------------------------|
|          |  string  |         为可变           |
|  object  |----------|-------------------------|
|          |  array   |         为可变           |
|          |----------|-------------------------|
|          |   hash   |         为可变           |
|          |----------|-------------------------|
|          |   set    |         为可变           |
+-----------------------------------------------+

```

## 符号 - 定义

```ruby
# 定义符号(不可变)
$symbol = :$value

#
# - symbol是不可变的,一旦被创建便无法修改;
# - symbol相同在内存中的object_id也是相同的;
#

```

## 字符串 - 定义

```ruby
# 定义字符串(可变可插值可转义)
$str = "$content"

# 定义字符串(可变无插值无转义)
$str = '$content'

# 定义字符串(可变可插值可转义)
$str = %Q($content)

# 定义字符串(可可变无插值无转义)
$str = %q($content)

# 定义字符串(可变多行)
$str = <<-MYTEXT
line1
line2
line3
MYTEXT

```

## 字符串 - 基础

```ruby
# 字符串拼接
str << "hello world"

# 字符串反转
$str.reverse

# 字符替换
$str.sub('$source_char','$target_chart')    # 不改变原有字符串而是返回一个新的字符串
$str.sub!('$source_char','$target_chart')   # !表示会改变原字符串

```

## 数组 - 定义

```ruby
# 定义数组
$array = [$item1, $item2, ...]

# 定义数组(指定长度和默认值,且每个默认值是独立的)
$array = Array.new($count){ $default }

# 定义数组(指定长度和默认值,但每个默认值指向同一引用)
$array = Array.new($count, $default)

# 定义数组(字符串快捷方式定义)
$array = %w($content1, $content2)

```

## 数组 - 基础

```ruby
# 数组长度
$array.length

# 是否包含值
$array.include?($name)

# 增加元素
$array.push($item)

# 删除元素
$array.delete_at($index)

# 数组遍历
$array.each_with_index do |item, index|
  puts(item, index)
end

```

## 哈希 - 定义

```ruby
# 定义哈希(symbol作为key)
$hash = {$key1: $value1, $key2: $value2}

# 定义哈希(symbol作为key)
$hash = {:$key1 => $value1, $key2 => $value2}

# 定义哈希(string作为key)
$hash = {"$key1" => value1, "$key2" => value2}

# 定义哈希(设置默认值,且每个默认值是独立的)
hash = Hash.new {|hash, key| hash[key] = $default }

# 定义哈希(设置默认值,但每个默认值指向同一引用)
hash = Hash.new($default)

# 哈希基础
#
# - 定义Hash如果采用symbol作为key,在取值时如果使用同名字符串取值会无法获取,必须仍采用symbol

```

## 哈希 - 基础

```ruby
# 修改内容
$hash[:$key] = $value

# 删除内容
$hash.delete(:$symbol)

# 遍历
hash.each do |key, value|
  p [key, value]
end

$hash.each { |key, value|
  puts([key, value])
}

```

## 集合 - 定义

```ruby
# 导入set
require 'set'

# 定义set
$set = Set.new $array

```

## 集合 - 基础

```ruby
# 增加元素
$set.add($string)

```

## 方法 - 定义

```ruby
# 定义方法(无参)
def $method

end

# 定义方法(有参)
def $method(param)

end

# 定义方法(默认参数)
def $method(param1, param2 = $default)

end

# 定义方法(*param表示可以传递多个参数)
def $method(param1, *param2)

end

# 方法调用
method param
method(param)

# 方法基础
#
# - 定义方法时不建议写return, 会默认最后一行作为返回值进行返回,但如需返回多个值则需采用return;
# - 调用方法时可以不用采用()进行调用, 但如出现函数多层嵌套调用则必须带上括号;
#

```

## 方法 - 闭包 - 普通

```ruby
# 定义闭包方法
def normal_closure_method
  name = "content"
  yield(name)
end

# 调用闭包方法(提倡用于单行代码)
normal_closure_method { |name|
  puts(name)
}

# 调用闭包方法(提倡用于多行代码)
normal_closure_method do |name|
  puts(name)
end

# 闭包基础
#
# - 在调用闭包方法时,如果内部使用了return等流程控制关键字,同步也影响当前方法的流程控制;

```

## 方法 - 闭包 - block

```ruby
# 定义闭包方法(block)
def block_closure_method(&block)
  name = "content"
  block.call(name)
end

# 调用闭包方法(提倡用于单行代码)
block_closure_method { |name|
  puts(name)
}

# 调用闭包方法(提倡用于多行代码)
block_closure_method do |name|
  puts(name)
end

# block基础
#
# - &符号其实是将block转化为一个Proc对象的过程,最后在方法调用是将Proc对象在转化为block;

```

## 方法 - 闭包 - proc

```ruby
proc = Proc.new { |param1, param2|
  puts param1, param2
}

proc.call(1)       # 1
proc.call(1, 2)    # 1 2

---------------------------------------------------------

proc = Proc.new { |x| return if x > 0 }
proc.call(1)       # 在irb执行会报错,由于return并没有方法让其return

# proc基础
#
# - 继承于Proc,可以将block封装成了对象,从而可以直接调用call方法;
#   lock中的&符号便是将block转化为一个Proc对象的过程,最后在方法调用是将Proc对象在转化为block;
# - proc的表现行为更像一个block, 并不校验函数个数等;
#   lambda的表现行为更像一个方法调用, 会校验函数参数个数等方法特征;

```

## 方法 - 闭包 - lambda

```ruby
lamb = lambda { |param1, param2|
  puts param1, param2
}

lamb.call(1)       # error
lamb.call(1, 2)    # 1 2

---------------------------------------------------------

lamb = lambda { |x| return if x > 0 }
lamb.call(1)       # 在irb执行正常,lambda调用更像方法调用

# lambda基础
#
# - 继承于Proc,可以将block封装成了对象,从而可以直接调用call方法;
# - proc的表现行为更像一个block, 并不校验函数个数等;
#   lambda的表现行为更像一个方法调用, 会校验函数参数个数等方法特征;

```

## 关键字 - alias

```ruby
# 重命名方法
alias :method :other_method

```

## 关键字 - yield

```ruby
# 定义闭包方法
def yield_method
  name = "content"
  yield(name)
end

# 调用闭包方法(提倡用于单行代码)
yield_method { |name|
  puts(name)
}

# 调用闭包方法(提倡用于多行代码)
yield_method do |name|
  puts(name)
end

```

## 类 - 定义

```ruby
class $Class
    include $Module          # include可以将Module中的对象方法Mixin成当前类的对象方法
    extend  $Module          # extend 可以将Module中的对象方法Mixin成当前类的类方法

    attr_reader :$field1      # 自动生成getter
    attr_writer: $field2      # 自动生成setter
    attr_accessor :$field3    # 自动生成setter getter

    @@class_field = $defalut # 类变量
    CONST_FIELD = $default   # 类常量,外界可以通过Class::CONST_FIELD直接访问

    # 构造方法
    def initialize($field1, $field2 = $default)
        @$field1 = $field1
        @$field2 = $field2
    end

    # 对象方法
    def $instance_method
        field1 + field3
    end

    # 类方法
    def self.$class_method

    end

    # 类方法
    class << self
        # 内部的方法都是类方法
    end

    $private :$method          # 明确方法的访问权限
end

# class 的使用:
#
#  - class更像是一个打开类技术的作用域操作符,把你带到类的上下文让你可以在其中定义方法；
#    但如果你打开类并且定义了一个已经存在过的方法会产生猴子补丁覆盖原有实现,从而导致运行不符合预期；
#  - Ruby中类其实也是对象,因此也可以认为Ruby中只有实例方法;
#    一个对象的方法是类的实例方法,一个类的方法就是Class的实例方法(例如new方法);
#
# module的使用
#
#  - Module主要是为了新增命名空间从而防止类名冲突,在Module下的Class类全名就变为了Module::Class;
#  - Mixin 只能将Module中的对象方法作为对象方法或者类方法混入到当前类中,主要包含了include和extend两部分
#    include可以将Module中的对象方法Mixin成当前类的对象方法
#    extend 可以将Module中的对象方法Mixin成当前类的类方法
#    如果需要同时mixin对象方法和类方法,在moudle中通过self.include去指定需要作为类方法mixin的方法
#
# class和module区别
#
#  - 类可以被实例化和继承; 模块无法被实例化和继承,但一个类可以include/mix多个模块从而实现多继承;
#  - 类的主要目标是用于封装数据和方法,而模块是为了创建命名空间防止变量或方法冲突;
#  - class是增强的module,增加了new、allocate、superclass方法而已,两者基本一样;

```

## 类 - 继承

```ruby
# 定义父类
class Superclass
    attr_reader :field      # 自动生成getter

    def initialize(field)
        @field = field
    end

    def instance_method
        field1 + field2
    end
end

# 定义子类
class Baseclass < Superclass

  def initialize(field, field1, field2)
    super(field)             # 如果这里使用super代表把当前所有参数传给之类
    @field1 = field1
    @field2 = field2
  end

end

```

## 类 - 访问权限

```ruby
+----------------------------------------------------------------+
|  access   |  类外部  |  类/子类  |  类内部其他方法是否可用self调用   |
+----------------------------------------------------------------+
|  public   |   YES   |   YES    |             YES               |
+----------------------------------------------------------------+
| protected |   NO    |   YES    |             YES               |
+----------------------------------------------------------------+
|  private  |   NO    |   YES    |             NO                |
+----------------------------------------------------------------+

```

## 模块 - 定义

```ruby
module Moudle
    def instance_method

    end

    module ClassMethodModule
      def method

      end
    end

    # 某个类include当前模块,ClassModule内的对象方法都会被Mixin为类方法
    def self.included(klass)
        klass.extend ClassMethodModule
    end
end

# class 的使用:
#
#  - class更像是一个打开类技术的作用域操作符,把你带到类的上下文让你可以在其中定义方法；
#    但如果你打开类并且定义了一个已经存在过的方法会产生猴子补丁覆盖原有实现,从而导致运行不符合预期；
#  - Ruby中类其实也是对象,因此也可以认为Ruby中只有实例方法;
#    一个对象的方法是类的实例方法,一个类的方法就是Class的实例方法(例如new方法);
#
# module的使用
#
#  - Module主要是为了新增命名空间从而防止类名冲突,在Module下的Class类全名就变为了Module::Class;
#  - Mixin 只能将Module中的对象方法作为对象方法或者类方法混入到当前类中,主要包含了include和extend两部分
#    include可以将Module中的对象方法Mixin成当前类的对象方法
#    extend 可以将Module中的对象方法Mixin成当前类的类方法
#    如果需要同时mixin对象方法和类方法,在moudle中通过self.include去指定需要作为类方法mixin的方法
#
# class和module区别
#
#  - 类可以被实例化和继承; 模块无法被实例化和继承,但一个类可以include/mix多个模块从而实现多继承;
#  - 类的主要目标是用于封装数据和方法,而模块是为了创建命名空间防止变量或方法冲突;
#  - class是增强的module,增加了new、allocate、superclass方法而已,两者基本一样;

```

## 类和模块 - 运行时

```ruby
# 查看类Mixin的模块
$class.included_modules
# 判断类是否有Minxin某个模块
$class.include?($module)

# 查看类继承链条
$class.ancestors
# 查看类继承结构
$class.ancestors - $class.included_modules

```

## 类 - 类图

```ruby
                                                  +--------------+
                                                  |  BaseObject  |
                                                  +--------------+
                                                         ^
                                                         | superclass
                                                         |
                                                  +--------------+
                                                  |    Kernel    |  (Module)
                                                  +--------------+
                                                         ^
                                                         | superclass
                                                         |
                                                  +--------------+
                                 +--------------> |   Object     |  +-------+
                                 |                +--------------+          |
                                 |                       ^                  |
                                 | superclass            | superclass       |
                                 |                       |                  |
                         +--------------+         +--------------+          |
                         |    Person    |         |    Module    |          |  class
                         +--------------+         +--------------+          |
                                 |                       ^                  |
                                 | superclass            | superclass       |
                                 |                       |                  |
+--------------+  class  +--------------+  class  +--------------+          |
|   student    | ------> |    Student   | ------> |    Class     |  <-------+
+--------------+         +--------------+         +--------------+
                                                     ^        |
                                                     | class  |
                                                     +--------+

```

## 类 - 导入

```ruby
# 导入第三方库
require 'gem'
# 导入以当前文件路径为标准的规则路径
require File.expand_path('',__FILE__)

# 以当前文件的相对路径查找filename
require_relative 'dir/file'

# 导入以当前文件路径为标准的规则路径(每次load都会执行代码)
load File.expand_path('',__FILE__)

# 导入以当前文件路径为标准的规则模块(不会执行任何代码直到使用)
autoload (:$Module, File.expand_path('',__FILE__))
include($Module)

# 将工程中所有的ruby文件导入到检索路径,如此不需要再用require_relative
$LOAD_PATH.unshifit('$RUBY_PROJECT_PATH')

```

## 类型判断

```ruby
# 判断对象是否为该类/子类的实例对象
$object.is_a?$Class

# 判断对象是否为该类的实例对象
$object.instance_of?$Class

```

## shell调用

```ruby
# 调用shell (多行shell调用)
cmds = []
cmds << ''
key = value
cmds << "open #{key}"
system(cmds.to_s)

# 调用shell
param1 = $default1
param2 = $default2
system(
  {'key' => 'value'}          # 这个可以省略
  ./cli
  param1, param2
)

# 调用shell (返回 true/false)
system('echo hello, `whoami`')
if $?.exitstatus.zero?   # $?存储着上一个执行的命令的退出状态
    puts "success"
else
    puts "failure"
end

# 调用shell (后面代码不会再执行)
exec('echo hello, `whoami`')

```

## 命名规范

```ruby
# 命名方式规范
#
# - 文件命名采用:file_name
# - 类名命名采用:CamelCase
# - 常量命名采用:CONST_TANT
# - 变量符号方法命名采用:snake_case

# 日常规范
#
# - 通过?结尾表示返回布尔值
# - 方法名称通过!结尾表示会改变原有对象

```

## 输出

```ruby
# 输出数据
puts("the data is #{$content}")

# 输出对象类型
puts($object.class)

# 输出对象内存地址
puts($object.object_id)

# 查看类的实例方法
puts($class.instance_methods(false))

# 读取当前shell环境变量
puts ENV['KEY']

```

## 数据类型

```java
+-------------------------------------------------------------------------+
| Data Type |   Size   |  Default |      Range        |    Package Type   |
|-------------------------------------------------------------------------|
|   byte    |  1 byte  |    0     |    -128 ~ 127     |        Byte       |
|-------------------------------------------------------------------------|
|   short   |  2 byte  |    0     |  -2^15 ~ 2^15-1   |       Short       |
|-------------------------------------------------------------------------|
|    int    |  4 byte  |    0     |  -2^31^ ~ 2^31-1  |       Integer     |
|-------------------------------------------------------------------------|
|    long   |  8 byte  |    0     |  -2^63^ ~ 2^63-1  |        Long       |
|-------------------------------------------------------------------------|
|   float   |  4 byte  |   0.0f   |      N/A          |        Float      |
|-------------------------------------------------------------------------|
|   double  |  8 byte  |   0.0d   |      N/A          |       Double      |
|-------------------------------------------------------------------------|
|    char   |  2 byte  |  \u0000  |    0 ~ 65535     |      Character    |
|-------------------------------------------------------------------------|
|  boolean  |    N/A   |   false  |    true/false     |        Boolean    |
+-------------------------------------------------------------------------+

```

## 变量

```java
$type $name = $value

```

## 常量

```java
final $type $NAME = $value

```

## 流程控制 - switch

```java
switch ($expression) {
  case $case1:
    break;
  case $case2:
    break;
  case $case3:
    break;
  default:
    break;
}

```

## 循环 - while

```java
while($condition) {

}

```

## 循环 - dowhile

```java
do {

} while($condition);

```

## 循环 - for

```java
for(int i = 0, i < $length, i++) {

}

```

## 循环 - for-each

```java
for ($type $item : $collection) {
    System.out.println(item);
}

```

## 方法 - 可变参数

```java
public int sum(int... nums) {
        int result = 0;
        for (int i = 0; i < nums.length; i++) {
            result = result + nums[i];
        }
        return result;
    }

```

## 类型判断

```java

// 判断引用对应的运行类型是否为某个类型或者其子类类型
$obj instanceof $Class

```

## string - init

```java
String $str = "$string";
String $str = new String("$string_or_charArray");

```

## stringBuilder - init

```java
StringBuilder $stringBuilder = new StringBuilder();

/**
 * StringBuilder和StringBuffer的区别:
 *
 * - StringBuilder是非线程安全的,StringBuffer是线程安全的,通常情况下由于性能问题我们会选择StringBuilder
 */

```

## stringBuilder - work

```java
$str.append($subStr);
$str.insert($afterStayIndex, $subStr);
$str.delete(startStayIndex, $endLeaveIndex)
$str.deleteCharAt($index)
$str.charAt($index)
$str.indexOf($index)
$str.replace($startIndex, $endIndex, $subStr)
$str.setCharAt($index, $subChar)

```

## 数组 - 定义

```java
// 方式一(标准写法)
$type[] $arr = new $type[]{$item1,$item2}
$type $arr[] = new $type[]{$item1,$item2}
// 方式二(动态初始化)
$type[] $arr = new $type[$length];
$type $arr[] = new $type[$length];
// 方式三(静态初始化,函数返回值为数组则不可使用)
$type[] $arr = {$item1, $item2};
$type $arr[] = {$item1, $item2};

/**
 * 数组基础:
 *
 * - 数组只能存放相同类型的数据;
 * - 数组的赋值是引用赋值,栈空间的引用指向堆空间;
 * - 数组创建后如没有赋值系统会给默认值,整型为0,浮点型为0.0,字符为\u000, 布尔类型为false,字符串为null;
 */

```

## 数组 - 使用

```java
// 获取数组长度
$arr.length

```

## 数组 - 二维

```java
int[][] $arr = {  {$item00, $item01, $item03},
                  {$item10, $item11, $item13},
                  {$item20, $item21, $item31}}

```

## 数组列表 - ArrayList

```java
ArrayList<$type> arrayList = new ArrayList<$type>();
arrayList.add($data);
arrayList.remove($data);

```

## 链表列表 - LinkList

```java
LinkedList<$type> linkList = new LinkedList<$type>();
linkList.add($data);
linkList.remove($data);

```

## hashSet

```java
HashSet<$type> hashSet = new HashSet<$type>();
hashSet.add($data);
hashSet.remove($data);

```

## hashMap

```java
HashMap<$keytype, $valuetype> hashMap = new HashMap<$keytype, $valuetype>();
hashMap.put($key,$value)
hashMap.get($key)

```

## 类 - 定义

```java
class $ClassName {
    private $type $instanceField;               // 属性
    public static $type $classField = 0;        // 类属性或静态变量
    public static final $type $FIELD = $value   // 类常量

    // 普通代码块
    {

    };

    // 静态代码块
    static {

    };

    // 构造器(可重载)
    public $ClassName($type $instanceField) {
        this.$instanceField = $instanceField;
    }

    // instance method
    public $instaceMethod {
        $content
    }

    // class method
    public static $classMethod {
         $content
    }

    // 涉及对象间的判等操作会自动调用此方法
    @Override
    public boolean equals(Object obj) {
        // 判断是否为hashCode是否相同
        if(this == obj) {
            return true;
        }
        // 判断是否在同一继承链上
        if(obj instanceof $ClassName) {
            $ClassName ptr = ($ClassName)obj;
            return this.$instanceField.equals(ptr.$instanceField);
        }
        return false;
    }

    // 设计对象需要字符串表示会自动调用此方法
    @Override
    public String toString() {
        return "";
    }

    // 对象被回收系统会自动调用此方法,我们可以在这里处理一些释放资源操作
    // 如果我们主动调用System.gc()则会被立即回收
    @Override
    protected void finalize() throws Throwable {
       System.out.println("release resources");
    }

    // Java虚拟机会主动调用当前类中名为main的静态方法
    public static void main(String[] args) {
        // 创建对象
        $ClassName object = new $ClassName($instanceField);
        // 直接通过类名访问类属性
        System.out.println($ClassName.$classField);
    }
}

/**
 * 类定义:
 *
 * - 类的成员主要包括属性/方法/构造器/代码块/内部类
 * - 类加载时机:创建对象时类会被加载/子类对象创建时父类也会被加载/使用类的静态属性或静态方法也会被加载

 * - 对象属性:对象属性/普通属性/普通成员变量/非静态属性/非静态成员变量/实例变量,必须通过对象访问;
 * - 对象方法:对象方法/非静态方法,必须通过对象访问;
 * - 静态属性:类变量/静态属性,正常通过类直接访问也可以通过对象访问,依然受访问权限约束;
 * - 静态方法:类方法/静态方法,staic修饰方法为类方法,内部可以访问静态属性而无法访问对象属性,
 *          可以直接通过类调用类方法,另外不需要访问对象相关属性的方法建议直接设计为静态方法;

 * 代码块:
 *
 * - 静态代码块:当类被加载时会有且只有一次调用静态代码块并完成静态属性初始化(静态代码块和静态属性初始化优先级一致);
 *            多个静态属性和静态代码块按定义顺序执行;静态代码块只能调用静态属性和静态方法
 * - 普通代码块:当对象创建后会自动调用普通代码块并完成普通属性初始化(普通代码块和对象属性初始化优先级一致);
 *            多个对象属性初始化和普通代码块按照定义顺序执行最后调用构造器,另外如果只调用类的静态属性或静态方法则普通代码块不会被调用;
 *
 * main方法设计:
 *
 * - 由于main方法是有Java虚拟机所调用,因此访问权限修饰符必须采用public;
 * - 由于Java虚拟机调用main方法并不需要创建对象,直接通过类名即可调用,因此main设计为static;
 * - 数组args中保存执行java命令时传递给所运行的类的参数;
 * - 由于main方法为静态方法,因此main方法内不能直接访问类中对象属性,只能访问静态属性或静态方法;

+--------------------------------+
|    父类静态代码块和静态属性初始化   |
+--------------------------------+
                |
                v
+--------------------------------+
|    子类静态代码块和静态属性初始化   |
+--------------------------------+
                |
                v
+--------------------------------+
|    父类普通代码块和普通属性初始化   |
+--------------------------------+
                |
                v
+--------------------------------+
|           父类构造方法           |
+--------------------------------+
                |
                v
+--------------------------------+
|    子类普通代码块和普通属性初始化   |
+--------------------------------+
                |
                v
+--------------------------------+
|          子类构造方法            |
+--------------------------------+
 */

```

## 类 - 构造方法

```java
/**
 * 构造方法:
 *
 * - 如果没有自定义构造方法,系统会自动给类生成默认无参构造函数,一旦自己定义构造方法系统便不再自动生成
 * - 构造方法重载可以通过this(params)直接调用其他构造方法减少冗余代码,前提是必须在第一句就调用
 * - 一个构造方法内不能同时存在this和super,因为他们都需要存在在构造方法首行
 */

```

## 类 - this关键字

```java
/**
 * this关键字
 *
 * - 哪个对象调用当前方法,this就代表那个对应对象;
 * - this关键字可以区分当前属性和局部变量,并可以访问本类属性/方法/构造器;
 * - 类的构造方法内调用其他构造方法可以通过this(params),调用其他成员方法通过this.method(params)
 * - super和this都只能放在构造器第一行,因此这两个方法不能共存在同一个构造方法内
 */

```

## 类 - 权限访问控制

```java
+----------------------------------------------------+
|  access  |  类内部  |  包内部  |  子类内  |   其他包   |
|----------------------------------------------------|
|  public  |   YES   |   YES   |   YES   |    YES    |
|----------------------------------------------------|
|  protect |   YES   |   YES   |   YES   |    NO     |
|----------------------------------------------------|
|  default |   YES   |   YES   |   NO    |    NO     |
|----------------------------------------------------|
|  private |   YES   |    NO   |   NO    |    NO     |
+----------------------------------------------------+

```

## 类 - 继承

```java
public class SuperClass {
    private String name;

    public void setName(String name) {
        this.name = name;
    }
    public String getName() {
        return name;
    }
}

public class SubClass extends SuperClass {

}

/**
 * 继承:
 *
 * - Object是所有类的基类,方法查询会一直从当前类查找到根类;
 * - 子类会继承父类所有属性和方法,但私有属性和方法在子类无法直接访问,需要通过父类提供公共方法间接访问;
 * - 子类必须调用父类构造器完成父类初始化,默认会自动调用父类无参构造器,
 * , 如父类没有无参构造器则需在子类构造函数首行显式super调用的父类构造器;
 */

```

## 类 - 关键字super

```java
 /**
  * super关键字:
  *
  * - super可以访问父类的属性和方法,但无法访问父类私有属性和私有方法;
  * - 当子类和父类中的属性和方法重名时,super关键字可以区分调用是父类成员还是子类;
  * - 子类必须调用父类构造器完成父类初始化,默认自动通过super()调用父类无参构造器,;
  *   如父类没有无参构造器则需在子类构造函数首行显式super调用的父类构造器
  * - 子类super和this都只能放在构造器第一行,因此这两个方法不能共存在同一个构造方法内;
  */

```

## 类 - 方法重载:方法重写

```java
/**
 * 方法重载:
 *
 * - 同一个类中方法名相同,参数个数/参数类型/参数顺序不同则构成重载;
 * - 方法的返回类型/方法参数名称和重载没有任何关系;
 *
 * 方法重写:
 *
 * - 子类和父类之间存在完全相同方法构成子类对父类方法重写,子类使用@Override注解来标识;
 * - 子类和父类之间存在完全相同方法,但如果两方法返回类型构成父子类继承链关系依然称之为方法重写;
 * - 子类重写父类方法时,访问权限不能低于父类中同方法的访问权限(public > protected > default > private);
 */

```

## 类 - 多态

```java

class SuperClass {
    public int count = 0;
    public void method() {
        System.out.println("this is superclass");
    }
}

class SubClass1 extends SuperClass {
    public int count = 1;
    public void method() {
        System.out.println("this is subclass1");
    }
}

class SubClass2 extends SuperClass {
    public int count = 2;
    public void method() {
        System.out.println("this is subclass2");
    }
}

public class Main {
    public static void main(String[] args) {
        SuperClass ref;
        ref = new SubClass1();              // 父类引用指向子类对象(向上转型)
        ref.method();                       // this is subclass1
        System.out.println(ref.count);      // 0 属性以编译时期为标准

        ref = new SubClass2();              // 父类引用指向子类对象(向上转型)
        ref.method();                       // this is subclass2
        System.out.println(ref.count);      // 0 属性以编译时期为标准

        ref = new SubClass1();
        SubClass1 ref1 = (SubClass1)ref;    // 让子类引用重新指向子类对象的父类引用(向下转型)
        ref1.method();                      // this is subclass1
        System.out.println(ref1.count);     // 1 属性以编译时期为标准

        ref = new SubClass2();
        SubClass2 ref2 = (SubClass2)ref;    // 让子类引用重新指向子类对象的父类引用(向下转型)
        ref2.method();                      // this is subclass2
        System.out.println(ref2.count);     // 2 属性以编译时期为标准
    }
}

/**
 * 动态绑定机制:
 *
 * - 当调用对象方法时,该方法会和该对象的内存地址/运行类型动态绑定(运行类型);
 * - 当调用对象属性时,则没有动态绑定机制,遵从哪里声明则哪里使用(编译类型);
 */

```

## 类 - final关键字

```java
/**
 * final基本使用:
 *
 * - final修饰的局部变量必须定义时进行初始化且初始化后不可被修改;
 * - final修饰的属性必须在定义时或静态代码块进行初始化,不能在构造器内进行初始化,且初始化后不可被修改;
 * - final修饰的方法不可被子类重写,并且final不能修饰构造器,final修饰的类不可被继承,
 */

```

## 类 - 抽象类

```java
public abstract class $AbstractClassName {
    private $type $attr;
    // 子类必须实现抽象方法
    public abstract void $method();
}

/**
 * 抽象类 & 抽象方法:
 *
 * - 抽象类:本质还是类,构造器/静态属性等类可以存在的部分抽象类都可以存在,且不一定要存在抽象方法;
 *         抽象类无法被实例化,可以通过子类继承抽象类并实例化子类,并且继承了抽象类的子类必须实现抽象类所有抽象方法;
 * - 抽象方法: 所在的类必须声明为抽象类,抽象方法不能有默认实现但普通方法可以;
 *            由于private/static/final这些修饰词都是和重写相违背,因此抽象方法不能被这些修饰词所修饰;
 *
 */

```

## 类 - 加载流程

```java
+------------+     +------------+
|   load     | --> |   verify   |
+------------+     +------------+
                         |
                         v
                   +------------+
                   |   prepare  |
                   +------------+
                         |
                         v
                   +------------+      +------------+      +------------+      +------------+
                   |  analyze   | ---> | initialize | ---> |     use    | ---> |   unmount  |
                   +------------+      +------------+      +------------+      +------------+

```

## 类 - 加载器

```java
                           +-------------------------+
                            |  Bootstrap ClassLoader  |
                            +-------------------------+
                                        ^
                                        |
                                        |
                                        |
                            +-------------------------+
                            |  Extension ClassLoader  |
                            +-------------------------+
                                        ^
                                        |
                                        |
                                        |
                            +-------------------------+
                            | Application ClassLoader |
                            +------------+------------+
                                        ^
                                        |
                                        |
                                        |
                            +-------------------------+
                            |     User ClassLoader    |
                            +-------------------------+

```

## 接口 - 定义

```java
interface InterfaceName {
    // 抽象方法
    public void method1();
    // 默认实现方法
    default public void method2() {
        System.out.println("defalut implement");
    }
    // 静态方法
    public static void method3() {
        System.out.println("static method");
    }

}

class ClassName implements InterfaceName {
    @Override
    public void method1() {

    }

    @Override
    public void method2() {

    }
}

/**
 * 接口基础使用:
 *
 * - 接口中的所有属性必须且默认不写也是public static final,可以通过接口名.属性名直接访问
 * - 接口中可以存在抽象方法默认实现方法静态方法),且接口不能被实例化;
 * - 接口中的所有方法必须且默认不写也是public并且可以省略abstract,抽象方法也可以有默认实现但需要通过default修饰;
 * - 普通类遵循了接口则需要实现该接口的所有抽象方法,抽象类遵循接口则不必实现该接口的所有抽象方法;
 */

```

## 类 - 局部内部类

```java
class OuterClass {
    public void outerMethod() {
        // 局部内部类
        class InnerClass {

        }
    }
}
/**
 * 局部内部类:
 * - 定义在外部类的局部位置称之为局部内部类,通常定义在外部类的方法内或代码块内;
 * - 该类作用域等同于局部变量,不能添加访问修饰符但可以使用final,其作用域仅仅在定义方法内或代码块中;
 * - 局部内部类可以直接访问外部类的包括私有在内所有成员,外部类访问局部内部类则需要在所在方法创建局部内部类对象进行访问;
 * - 如果外部类和局部内部类的成员重名,默认遵循就近原则,如果内部想访问外部类同名成员可以通过OuterClass.this.成员进行访问;
 */

```

## 类 - 匿名内部类

```java
// 演示基于接口的匿名内部类
interface InterfaceName {
    public void interfaceMethod();
}
// 演示基于类的匿名内部类
class ClassName {
    public void method(){

    };
}
// 演示基于抽象类的匿名内部类
abstract class AbstractClassName {
    public void method(){

    };
}

class OuterClass {
    public void outerMethod() {
        // 基于接口的匿名内部类
        InterfaceName interfaceName = new InterfaceName() {
            private int count = 0;
            @Override
            public void interfaceMethod() {

            }
        };
        execute(interfaceName); // 匿名内部类作为函数参数传递

        // 基于类的匿名内部类(不再是ClassName而就是一个匿名类)
        ClassName object = new ClassName() {
            private int count = 0;
            @Override
            public void method() {
                // 最终调用匿名内部类重写方法,可以重写也可以不重写
                System.out.println("动态绑定最终调用匿名内部类重写方法");
            }
        };
        object.method();

        // 基于抽象类的匿名内部类
        AbstractClassName abstractObject =  new AbstractClassName() {
            private int count = 0;
            @Override
            public void method() {
                // 最终调用匿名内部类重写方法,由于是基于抽象类因此必须重写
                System.out.println("动态绑定最终调用匿名内部类重写方法");
            }
        };
        abstractObject.method();

    }

    public static void execute(InterfaceName interfaceName){
        interfaceName.interfaceMethod();
    }
}

/**
 * 匿名内部类:
 *
 * - 定义在外部类的局部位置并借用接口/类/抽象类从而产生新匿名类之为匿名内部类,通常定义在外部类的方法内或代码块内能够达到简化开发内聚,;
 * - 该类作用域等同于局部变量,不能添加访问修饰符但可以使用final,其作用域仅仅在定义方法内或代码块中;
 * - 匿名内部类可以直接访问外部类的包括私有在内所有成员;
 * - 如果外部类和局部内部类的成员重名,默认遵循就近原则,如果内部想访问外部类同名成员可以通过OuterClass.this.成员进行访问;
 */

```

## 类 - 成员内部类

```java
class OuterClass {
    private String content;

    // 成员内部类
    private class InnerClass {
        public void method() {
            System.out.println("this is innerclass");
        }
    }

    // 外界访问内部类
    public void visitInnerClass() {
        InnerClass inner = new InnerClass();
        inner.method();
    }
}

/**
 * 成员内部类:
 *
 * - 成员内部类是定义在外部类的成员位置的类,且没有static修饰;
 * - 成员内部类可以随意添加访问权限修饰符,对外部类而言,成员内部类也是被看做一个成员看待
 * - 成员内部类可以直接访问外部类的包括私有在内所有成员,外部类访问内部类需要先创建对象后访问;
 * - 如果外部类和局部内部类的成员重名,默认遵循就近原则,如果内部想访问外部类同名成员可以通过OuterClass.this.成员进行访问;
 */

```

## 类 - 静态内部类

```java

class OuterClass {
    private String content;

    // 成员内部类
    static class InnerClass {
        public void method() {
            System.out.println("this is innerclass");
        }
    }

    // 外界访问内部类
    public void visitInnerClass() {
        InnerClass inner = new InnerClass();
        inner.method();
    }
}

/**
 * 成员内部类:
 *
 * - 成员内部类是定义在外部类的成员位置的类,且被static修饰,作用域为整个类;
 * - 成员内部类可以随意添加访问权限修饰符,对外部类而言,成员内部类也是被看做一个成员看待
 * - 成员内部类可以直接访问外部类的包含私有在内的所有静态成员,无法访问非静态成员,外部类访问内部类需要先创建对象后访问;
 * - 如果外部类和局部内部类的成员重名,默认遵循就近原则,如果内部想访问外部类同名成员可以通过OuterClass.成员进行访问;
 */

```

## 枚举类 - 简单枚举

```java

// 枚举方式一(隐式继承Enum类)
enum $EnumType {
    // 隐式调用无参构造器,$EnumType.$TYPE1默认值就为$TYPE1字符串
    $TYPE1,
    $TYPE2;
}

```

## 枚举类 - 系统类

```java
enum $EnumType {
    // 枚举需要写到最前面,调用有参构造器;
    $TYPE1("$type1","description1"),
    $TYPE2("$type2","description2"),
    $TYPE3("$type3","description3"),
    $TYPE4("$type4","description4");

    private String name;
    private String description;

    private $EnumType(String name,String description) {
        this.name = name;
        this.description = description;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    // 外部使用枚举
    // $EnumType $type = $EnumType.$TYPE1;

}

```

## 枚举类 - 自定义

```java
class $EnumType {
    private String name;
    private String description;

    public final static $EnumType $TYPE1 = new $EnumType("$type1", "description1");
    public final static $EnumType $TYPE2 = new $EnumType("$type2", "description2");
    public final static $EnumType $TYPE3 = new $EnumType("$type3", "description3");
    public final static $EnumType $TYPE4 = new $EnumType("$type4", "description4");

    private $EnumType(String name,String description) {
        this.name = name;
        this.description = description;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    // 外部使用枚举
    // $EnumType $type = $EnumType.$TYPE1;
}

```

## 枚举 - 基础使用

```java
// 查看枚举对象名称
$enumObject.name
// 查看枚举对象索引
$enumObject.ordinal()
// 查看所有枚举对象
$enumObject.values()
// 查看是否存在枚举,有则返回枚举对象,无报错
$enumObject.valueOf("$name")
// 枚举索引比较,返回枚举索引相减结果
$enumObject.compareTo($otherEnumObject)

```

## 注解 - 基础使用

```java
/**
 * 注解类基本使用
 *
 * - @Override 编译时检查该方法是否真的重写父类方法,确认则编译通过否则编译错误;
 * - @Deprecated 编译时检查该字段/方法/类/包/参数等不再推荐使用;
 * - @SuppressWarnings 编译时检查并忽略警告,其生效范围取决于放置位置
 */

/**
 * @Retention元注解(修饰注解的注解),用于指定某个注解的生效阶段;
 *
 * RetentionPolicy.SOURCE  表示只在编译阶段保留注解,其他阶段丢弃对应注解;
 * RetentionPolicy.CLASS   表示编译器将注解保留到class文件中,运行程序时JVM不在保留注解;
 * RetentionPolicy.RUNTIME 表示编译器将注解保留到class文件中,运行程序时JVM同样也会保留注解,程序可以通过反射获取该注解
 */
@Retention(RetentionPolicy.$SOURCE)

/**
 * @Target元注解(修饰注解的注解),用于指定某个注解的生效范围(方法/构造器/变量等);
 */
@Target(value{METHOD,FIELD})

/**
 * @Inherited元注解(修饰注解的注解),用于指定某个注解具备继承性(父类使用被Inherited修饰的注解子类会自动具备该注解)
 */
@Inherited

```

## 模块和包

```java
/**
 * 模块和包:
 *
 * - 包的主要作用在于通过创建分级文件夹形式建立命名空间以便隔离同名类,同时也可以控制访问权限
 * - 模块是由多个包组合而成;
 * - 类的名称必须和文件的名称保持一致,一个文件只能有一个公开类;
 */

package java.lang.*                        // 基本包默认引入
package java.util.*                        // 系统工具包
package java.net.*                         // 网络开发包
package java.awt.*                         // 界面开发包
package com.xxx.xxx                        // 声明当前类所在包(在最顶部声明)

import $com.$package.$Class                // 引入某个包的具体类
import $com.$package.*                     // 引入该包下全部的类

```

## 设计模式 - 单例

```java
// 懒汉单例设计模式(懒加载创建对象实例,存在线程安全问题)
class $ClassName {
    private String content;
    private static $ClassName instance;

    private $ClassName(String content) {
        this.content = content;
    }

    public static $ClassName getInstance() {
        if (instance  == null) {
            instance = new $ClassName("content");
        }
        return instance;
    }
}

// 饿汉单例设计模式(类加载即创建对象实例,没有线程安全问题)
class $ClassName {
    private String content;
    private $ClassName(String content) {
        this.content = content;
    }

    private static $ClassName object = new $ClassName("content");
    public static $ClassName getInstance() {
        return object;
    }
}

```

## 命名规范

```java
/**
 * 命名规范
 *
 * - 包命名规范:com.公司名称.项目名称.业务模块名称
 *
 *
 */

```

## 输出

```java
// 输出
System.out.println($content);
// 输出对象默认调用对象toString方法
System.out.println($object);
// 输出对象哈希
System.out.println($object.hashCode());

```

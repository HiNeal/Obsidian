## note - const 的使用

```cpp
const的使用

C语言中const变量不一定要初始化,假如声明时未初始化后面就不再有机会,本质上常变量而不是常量
除了不能变成左值,其他和变量都是一样的
  - 常量关键字,声明后必须进行初始化;
   ---------------------------------------------------------------------------
    const int a = 20;              // 常量,编译器会在编译阶段直接用立即数替换掉变量名
    int array[a] = {};
    int *ptr = (int*)&a;
    *p = 30;                       // 修改成功
   printf("%d,%d,%d",a, *p, *(&a)); // 20, 30, 20
    -------------------------------------------------------------------------
    int b = 20
    const int a = b;               // 常变量,和上面的例子要区别开来,
    int array[a] = {};             // error,本质上a是一个常变量
    int *ptr = (int*)&a;
    *p = 30;
    printf("%d,%d,%d",a, *p, *(&a)); // 30, 30, 30
    -------------------------------------------------------------------------

  - 非const变量默认为extern,const变量如果要在其他文件中能够访问需要显示指定为extern;

  - 如果const位于*的左侧,则const就是用来修饰指针所指向的变量,即指针指向为常量;
    如果const位于*的右侧,const就是修饰指针本身,即指针本身是常量。
    const char *a         // 指向const对象的指针或者说指向常量的指针;
    char const *a         // 指向const对象的指针或者说指向常量的指针;
    char * const a        // 指向类型对象的const指针。或者说常指针、const指针;
    const char * const a  // 指向const对象的const指针;

  - 允许把非const对象的地址赋给指向const对象的指针,但是仍然不能通过该指针修改变量的值,可以通过另起一个指针等其他方式修改变量的值
    -------------------------------------------------------------------------
     int value = 3;
     const int *ptr;
     ptr = &value    // success
     int *prt1 = &value;
     *ptr1 = 10;     // 其他方式修改该变量
    -------------------------------------------------------------------------

  - 不能使用void*指针保存const对象的地址,必须使用const void*类型的指针保存const对象的地址
    -------------------------------------------------------------------------
     const int value = 10;
     const void *ptr = &value  // success
     void *ptr = &value        // error
    -------------------------------------------------------------------------

  - 请区分以下两种代码
    -------------------------------------------------------------------------
     int value = 1;
     int * const ptr = &value; // const指针必须初始化,且const指针不能修改
     *ptr = 10;
    -------------------------------------------------------------------------
     const int value = 0;
     int *const ptr = &value    // error,如果你这样写别人就会觉得后面可以通过*ptr=10来修改常量的值这本身就是不合理的
     const int *ptr  = &value   // success
     const int *const ptr = &value // success 指向常量的常指针
    -------------------------------------------------------------------------

  - const在函数中的使用
    -------------------------------------------------------------------------
     const int function();      // 由于参数返回本身就是赋值给其他的变量这样写本身无意义
     const int* function();     // 指针指向内容不必拿,也是不安全的代码
     int *const function();     // 指针本身不可变
    -------------------------------------------------------------------------
     void func(const int value);        // 传递过来的参数不可变,由于是值传递这样写本身没什么意义
     void func(int *const ptr);         // 指针本身不可变,由于是值传递这样写本身没什么意义
    -------------------------------------------------------------------------
     void function(const int *ptr);         // 禁止函数体内的语句试图改动ptr指向的内容
     void function(const Person &person);   // 为了增加效率同时防止修改
     void function(const int &value)        // 请不要这么写,对于基础数据类型可以进行值传递,参数为int x即可
    -------------------------------------------------------------------------

  - 在一个类中,任何不会修改数据成员的函数都应该声明为const类型.常成员函数可以提高程序健壮性;
    类中的const成员变量必须通过初始化列表进行初始化,或者通过和static结合最后在外部初始化
    -------------------------------------------------------------------------
     class Person {
     public:
          Person(int age)
          const long id
     }
     Person::Person(int age):id(i){}        // 通过初始化列表进行初始化
     -------------------------------------------------------------------------
     class Person {
      public:
           Person(int age)
           static const long id              // static结合最后在外部初始化
           const int id = 10                 // C11支持定义初始化
           static const int id = 10          // C11支持定义初始化
      }
     const int Person:id = 10               // static结合最后在外部初始化
    -------------------------------------------------------------------------
    const成员函数只能访问const成员函数;
    const对象只能访问const成员函数,而非const对象可以访问任意的成员函数,包括const成员函数;

```

## note - 指针

```cpp
指针基础

  - 指针类型决定了指针进行解引用操作时能够操作空间的大小，同时也决定了指针移动在内存所跨越的字节；
    ---------------------------------------------------------------
    int a = 10;
    int *p1 = &a;   // *p只能访问 4 个字节
    chat *p2 = &a;  // *p只能访问 1个字节
    p1 + 1          // 内存上移动 4 个字节
    p2 + 1          // 内存上移动 1 个字节
    ---------------------------------------------------------------

```

## note - 指针和数组

```cpp

- 数组名称本质上就是首元素地址，除了在使用&arr 的时候以及使用 sizeof 的时候其他都可以认为数组名称即为首元素的地址；
------------------------------------------------------
int main(int argc, const char * argv[]) {
    // insert code here...
    int arr[10] = { 0 };

    printf("%p \n",&arr[0]);      //0x16fdff2c0  首元素地址
    printf("%p \n",&arr[0] + 1);  //0x16fdff2c4  下一个元素地址

    printf("%p \n",arr);          //0x16fdff2c0  首元素地址
    printf("%p \n",arr + 1);      //0x16fdff2c4  下一个元素地址

    printf("%p \n",&arr);         //0x16fdff2c0  整个数组地址
    printf("%p \n",&arr + 1);     //0x16fdff2e8  以整个数组为单位下一个地址

    return 0;
}
-------------------------------------------------------
int main() {
    int *arr = {1,2,3,4,5};  // 错误写法
    print("%d",*arr);        // 直接 crash
    printf("%p",arr);
    return 0;
}

int main() {
    int arr[] = {6, 2, 3, 4, 5};
    int *p = &arr;  // p 为整个数组的地址
    for (int i = 0; i < 5; i++) {
        printf("%d",*(p + i));   // 正常输出但也是错误的
    }
    return 0;
}
---------------------------------------------------------------

```

## note - 指针数组

```cpp
指针数组

- 指针数组和数组指针的区别: []优先级比*更高,ptr先和[]结合表示指针数组,ptr先和*结合表示数组指针;
---------------------------------------------------------------
int main() {
    int arr[10] = {0};                // 整型数组
    char ch[10] = {a};                // 字符数组
    int *ptr[10];                     // 存放整型指针的指针数组
    char *pch[10];                    // 存放字符指针的指针数组
    return 0;
}
---------------------------------------------------------------
int main() {
    int arr1[] = {1, 2, 3, 4, 5};
    int arr2[] = {2, 3, 4, 5, 6};
    int arr3[] = {3, 4, 5, 6, 7};
    int *ptr[] = {arr1, arr2, arr3};

    for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 5; j++) {
            printf("%d",ptr[i][j]);        // 遍历数组
            printf("%d",*(*(ptr + i)+j));  // 遍历数组
            printf("%d",*(ptr[i] + j));    // 遍历数组
        }
        printf("\n");
    }
    return 0;
}
---------------------------------------------------------------
// 以下写法都是符合要求的
void function1(int arr[]) {}
void function1(int arr[10]) {}
void function1(int *arr) {}
void function2(int *arr[20]) {}
void function2(int **arr) {}

int main() {
  int arr1[10] = {0};
  int *arr2[20] = {0};
  function1(arr1);
  function2(arr2);
}
---------------------------------------------------------------

```

## note - 数组指针

```cpp
- 指针数组和数组指针的区别: []优先级比*更高,ptr先和[]结合表示指针数组,ptr先和*结合表示数组指针;
 ---------------------------------------------------------------------------
 // 第一种写法
 void showDate1(int arr[3][5], int row, int column) {
    for (int i = 0; i < row; i++) {
         for (int j = 0; j < column; j++) {
             printf("%d", arr[i][j]);
         }
         printf("\n");
    }
 }
 // 第二种写法(忽略数组长度),数组长度必须放在数组定义前,这样运行时才能确定数组长度
 void showData2(int row, int column, int arr[row][column]) {
    for (int i = 0; i < row; i++) {
         for (int j = 0; j < column; j++) {
             printf("%d", arr[i][j]);
         }
         printf("\n");
    }
 }

 // 第三种写法
 void showDate3(int (*p)[5], int row, int column) {
     for (int i = 0; i < row; i++) {
         for (int j = 0; j < column; j++) {
             printf("%d", *((*p + i)+j)); // p 接收的是首个元素数组的地址，*p 解引用表示获取到二维数组第一个元素数组的数组名
             printf("%d", p[i][j]);       // 等同如上
             printf("%d", *(p[i] + j));   // 等同如上
             printf("%d", (*p+i)[j]);     // 等同如上
         }
         printf("\n");
     }
 }

 int main() {
      int arr[3][5] = {{1,2,3,4,5},{2,3,4,5,6},{3,4,5,6,7}};
      showDate1(arr, 3, 5);
      showDate2(arr, 3, 5);
      showDate3(arr, 3, 5);
      return 0;
  }
 ---------------------------------------------------------------------------------
 // 二维数组传参不得省略列数
 void function1(int arr[3][5]) {}     // success
 void function2(int arr[][5]) {}      // success
 void function3(int (*arr)[5]);       // success
 void function4(int arr[3][]) {}      // error
 void function5(int **arr) {}         // error

 int main() {
     int arr[3][5] = {0};
     function1(arr);                    // success
     funciton2(arr);                    // success
     function3(arr);                    // success
     function4(arr);                    // error
     function5(arr);                    // error

 }
 ---------------------------------------------------------------------------------

```

## note - 函数指针

```cpp

---------------------------------------------------------------
int add(int x, int y) {
    return x + y;
}

int main() {
    int (*p)(int, int) = &add;
    printf("%p \n",add);      // 0x100003eb8
    printf("%p \n",&add);     // 0x100003eb8
    printf("%p \n",p);        // 0x100003eb8

    int c = (*p)(2, 3);
    printf("%d \n",c);        // 5
}
---------------------------------------------------------------

```

## note - 类 - 权限控制符

```cpp
修饰符      类内部      子类      任何地方
----------------------------------------
private     YES
protect     YES       YES
public      YES       YES       YES

```

## note - 关键字 - 单次引入

```cpp
#pragma once

```

## 枚举

```cpp
// 第一种写法
enum $style {
    $style1,
    $style2,
    $style3
}

enum $style $variable

// 第二种写法
typedef enum {
    $style1,
    $style2,
    $style3
} $style

$style $variable

// 第三种写法
enum {
    $style1,
    $style2,
    $style3
} $variable = $style1;

```

## 共用体

```cpp

/**
 * 虽然包含三个属性，但是同一时间只能取到一个属性。最后赋值的属性，就是可以取到值的那个属性。
 */
union $UNION_NAME {
  short $attribute1;
  float $attribute2;
};

// 写法一
union $UNION_NAME $union_variable_name;
$union_variable_name.attribute1 = 4;
// 写法二
union $UNION_NAME $union_variable_name = {.$attribute1 = 4};

```

## 数组定义

```cpp
int arr[$count] = {$item1, $item2}; // 确定长度
int arr[] = {$item1, $item2};       // 根据元素个数自动计算长度

```

## 字符串定义

```cpp
char *$str_ptr = "$string_content";

```

## 数组指针

```cpp
int (*ptr)[$count] = &arr;  // 数组指针

```

## 指针数组

```cpp
int *ptr[$count] = &arr;    // 指针数组

```

## 函数-参数-数组指针

```cpp
void $functionName:(int (*ptr)[$count]) {
    // 传递数组指针
}

```

## 函数-参数-指针数组

```cpp
void $functionName:(int *arr[$count]) {
    // 传递指针数组
}

```

## 结构体

```cpp
// 结构体定义一
struct $NSPerson {
    $type1 $attribute1
    $type2 $attribute12
};
typedef $NSPerson Person;
Person person = {$value1, $value2};

// 结构体定义二
$NSPerson {
    $type1 $attribute1
    $type2 $attribute12
};

struct $NSPerson person = {$value1, $value2};

```

## 位域

```cpp
若相邻的位域成员的类型相同, 且其占用二进制位数未超过该类型可容纳的范围，则后面的成员紧接着前一个成员进行存储;
若相邻的位域成员的类型相同, 但其占用二进制位数超过该类型可容纳的范围，则后面的成员从该类型占用空间之后的内存单元开始存储;
若相邻的位域成员的类型不同, 则取决于编译器的实现。对于GCC编译器会尽量利用空闲的位对数据进行存储;
若位域之间定义有匿名位域成员，则匿名位域成员指定的空闲位不用于后续成员的数据存储;

struct Data {
    unsigned int field1 : 1;
    unsigned int field2 : 2;
    unsigned int field3 : 3;
}

```

## 关键字 - extern 的使用

```cpp

/**
 *  兼容代码在C/C++工程中混编
 */

#ifndef __cplusplus
extern "C" {
#endif

function_from_C

#ifdef __cplusplus
}
#endif

```

## sTL - Vector

```cpp
vector<$typename> $vector;
vector<$typename>::iterator begin = $vector.begin();
vector<$typename>::iterator end = $vector.end();

// 第一种遍历方式
while(begin != end) {
    count << *begin << endl;
    begin++;
}

// 第二种遍历方式
for(begin; begin != end; begin++) {
    cout << *begin << endl;
}

// 第三种遍历方式
void $function($typename value) {
    cout << value << endl;
}
for_each(begin, end, $function>)

```

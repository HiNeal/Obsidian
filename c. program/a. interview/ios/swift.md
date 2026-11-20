## class和struct的区别

```text
- 结构体为值类型,数据存储在栈空间,在数据传递时为深拷贝(Copy on Write);
  类为引用类型,栈上指针指向存储在堆空间的对象,在数据传递时为引用传递;

```

## 怎么理解copy-on-write

- 值类型在复制时,复制实例与原实例实际上在内存中指向同一个对象,当且仅当修改复制的对象时,才会在内存中创建一个新的对象；

## static 和 class 关键字的区别

```text
- static关键字可以修饰存储属性、计算属性和方法(可继承不可重写);
  class关键字可以修饰计算属性和方法(可继承可重写),但不能修饰存储属性,

```

## swift 中的访问控制?

```text
open: 定义的实体如需要被其他模块继承或重写则采用open
public: 定义的实体仅允许被其他模块访问则采用public
internal: 定义的实体仅允许在当前模块访问则采用internal (默认访问权限)
fileprivate: 定义的实体仅允许在当前文件访问则采用fileprivate,全局作用域下private等同与fileprivate
private: 定义的实体仅允许在当前声明范围内(当前类内和或同文件的类扩展)访问则采用private,子类无法访问父类的private成员

```

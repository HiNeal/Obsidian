## define和const有什么区别?

- define会在预处理阶段进行文本替换甚至可以封装一些简单的函数,但不能进行数据类型检查因此不便于调试;
- const会在编译阶段进行数据类型检查更加便于调试,并且数据存储在数据段中只有一份拷贝因此效率更高;

## 属性有哪些修饰符?

```text
- 读写权限: readwrite、readonly
- 方法名称: getter=、setter=
- 内存管理: assign、strong、weak、copy、unsafe_unretained
- 线程安全: atomic、nonatomic
- 其他常用: nullable、nonnull

```

## @property的本质是什么? ivar、setter、getter是如何生成并添加到这个类中的?

```text
- @property会在编译阶段自动合成ivar成员变量,setter和getter方法,
  我们每增加一个属性,系统都会在ivar_list_t中增加一个实例变量的描述,在property_list_t中增加一个属性的描述,在method_list_t中增加setter和getter方法的描述,
  然后通过计算属性和对象起始地址的偏移量给出setter和getter方法的实现,在setter方法中从属性偏移量的位置开始赋值,在getter方法中从属性偏移量的位置开始取值,

- @property的底层实现是结构体property_t,其中包含了name和attributes,
  attributes的底层实现是结构体objc_property_attribute_t,描述了属性的读写权限,内存语义,原子性和对应的实例变量,

 struct property_t {
     const char *name:
     const char *attributes;
 };

 typedef struct {
     const char *name;
     const char *value;
 } objc_property_attribute_t;

```

## @synthesize和@dynamic各自有什么作用?

- @synthesize会在我们没有手动实现setter和getter方法时,为实例变量自动合成setter和getter方法;
  同时还可以关联属性和实例变量的名称,默认情况下是@syntheszie var = _var,如果是@syntheszie var则表示生成的实例变量和属性同名;

- @dynamic告知编译器不用为实例变量自动合成setter与getter方法,而是由开发者自己实现;

## +load和+initialize的区别?

- load方法是当类或分类被添加到runtime时被调用的,我们可以通过重写load方法可以改变类相关的行为比如进行方法混淆,
  父类、子类和分类的load方法的实现是被区别开来互不影响的,另外load方法可以自动继承,但一般不主动调用load方法而是让系统自动调用,

- load方法一般会在并且在main函数之前执行,其调用顺序是根据编译先后顺序来调用主类的load方法,
  并且子类的load方法被调用之前会先调用父类的load方法,最后再根据编译先后顺序调用分类的load方法;

- initialize方法会在类或它的子类收到第一条消息之前被懒加载调用;
  initialize和load的很大区别是load方法底层是拿到函数指针直接调用,而initialize方法底层是走objc_msgSend流程;

- 所以分类中的initialize方法会覆盖主类中的initialize方法实现从而只执行分类的实现,多个分类同名方法以最晚编译的分类同名方法为准;
  并且会先调用父类的initialize方法再调用子类initialize方法,如果子类没有实现initialize方法,那么父类的initialize方法会被调用多次;

## 请阐述下类Class的底层结构?

```text
- 类的底层实现是结构体objc_class, 其中包括isa指针、superclass指针、方法缓存cache_t、获取类的具体信息bits,
  实例对象的isa指针指向类对象,类对象的isa指针指向元类对象,superclass指针指向父类结构体objc_class,
  cache_t通过散列表来缓存已调用过的方法,从而提高方法的查找速度;

- 结构体objc_class中的bits通过和FAST_DATA_MASK进行与运算从而获取类的具体信息,
  bits一开始是指向了class_ro_t,如果后面有通过分类等方式增加方法时系统会动态创建class_rw_t,
  并且将class_ro_t和category_t的数据合并到class_rw_t中,将bits指向class_rw_t,class_rw_t中的ro指针指向class_ro_t;

- class_rw_t是可读可写的,二维数组property_array_t、method_array_t、protocol_array_t包含了类的初始内容和分类的内容;
  class_ro_t是只读的,一维数组ivar_list_t、property_list_t、method_list_t、protocol_list_t只包含了类的初始内容;

 struct objc_class {
     Class isa;
     Class superclass;
     cache_t cache;                      // 方法缓存
     class_data_bits_t bits;             // 用于获取具体的类信息
 }                      |
                        |
                        |
 struct class_rw_t { <--+
     uint32_t flags;
     uint32_t version;
     method_list_t *methods;             // 方法列表
     property_list_t *properties;        // 属性列表
     const protocol_list_t * protocols;  // 协议列表
     Class firstSubclass;
     Class nextSiblingClass;
     char *demangledName ;
     const class_ro_t *ro;
 };                     |
                        |
                        |
 struct class_ro_t { <--+
     uint32_t flags;
     uint32_t instanceStart;
     uint32_t instanceSize;              // instance对象占用的内存空间
 #ifdef LP64
     uint32_t reserved;
 #endif
     const uint8_t *ivarLayout;
     const char *name;                   // 类名
     method_list_t *baseMethodList;
     protocol_list_t *baseProtocols;
     const ivar_list_t *ivars;           // 成员变量列表
     const uint8_t  *weakIvarLayout;
     property_list_t *baseproperties;
 };

 struct cache_t {
     struct bucket_t *_buckets;          // 散列表
     mask_t _mask;                       // 散列表的长度
     mask_t _occupied;                   // 已经缓存的方法数量
 }

 struct bucket_t {
     cache_key_t _key;                   // SEL作为key
     IMP _imp;                           // 函数的内存地址
 }

```

## protocol 和 category中如何使用@property?

- 在protocol中使用@property只会生成setter和getter方法声明,我们使用该属性的目的是希望遵守该协议的类能实现该属性;
- 在category中使用@property也只会生成setter和getter方法声明,但我们可以通过关联对象在分类增加属性;

## extension 和 category 的区别?

- 类扩展可以增加实例变量、属性和方法,这些数据在编译时已经保存在class_ro_t中;

- 分类只能增加方法,分类中使用@property也只会生成setter和getter方法声明,但我们可以通过关联对象在分类增加属性,
  这些数据在运行时系统会动态创建class_rw_t,并且将class_ro_t和category_t的数据合并到class_rw_t中;

## category的实现原理?

- 分类底层实现是结构体category_t,其中包含property_list_t、method_list_t、protocol_list_t

- 结构体objc_class中的bits通过和FAST_DATA_MASK进行与运算从而获取类的具体信息,
  bits一开始是指向了class_ro_t,如果后面有通过分类等方式增加方法时系统会动态创建class_rw_t,
  并且将class_ro_t和category_t的数据合并到class_rw_t中,将bits指向class_rw_t,将class_rw_t中的ro指针指向class_ro_t;

- 多个分类同名方法以最晚编译的分类同名方法为准;

## 关联对象的底层原理?

- 关联对象本身并不是存储在被关联对象的内存中,而是存储在全局的AssociationsManager中,
  AssociationsManager有一个属性是AssociationsHashMap,key是被关联对象内存地址进行位运算后的值,value是一个ObjectAssociationMap;
  ObjectAssociationMap的key是我们传入第二个参数key,value是结构体ObjectAssociation,描述了属性的内存语义,原子性和对应的属性值;

- 如果我们设置关联对象为nil就相当于移除掉该关联对象,同时关联对象会随着被关联对象释放而释放,只是释放时机会稍晚些
  系统会调用object_dispose进行统一释放;

## kVO内部实现原理,如何手动触发KVO?

```text
- KVO底层是基于Runtime实现的,当类的属性第一次被观察时系统会动态创建以NSKVONotifying开头的子类,并在子类中重写该属性的setter方法,
  同时将对象的isa指针指向该子类,使得属性在进行赋值操作时实际调用的是子类中的setter方法,

- 子类中的setter方法依赖于NSObject的两个方法willChangeValueForKey记录旧值和didChangeValueForKey记录新值,
  didChangeValueForKey方法内部会回调到observeValueForKeyPath方法便于我们进一步操作,

- 通过指针调用实例变量并不会触发KVO,但我们可以通过手动监听实例变量实现KVO的效果,
  另外苹果为了屏蔽内部实现通过重写了子类的class方法并在isKVO方法内部返回YES从而隐藏了NSKVONotifying类的存在,
  
  

```

## 通过KVC修改属性会触发KVO么?KVC的原理是什么?

```text
- KVC会触发KVO,因为KVC底层在进行赋值操作时同样会调用willChangeValueForKey和didChangeValueForKey,
  setValueForKey会优先调用setter方法,比如属性为name会按照setName,_setName的顺序进行赋值操作;

- 如果赋值操作没有完成,系统会调用accessInstanceVariablesDirectly方法查看是否返回YES,
  如果该方法返回NO的话,那么调用setValueforUndefinedKey方法抛出异常;
  如果该方法返回YES的话,表示允许我们直接访问实例变量,那么会按照key,_key,iskey,_iskey的顺序进行赋值操作;
  如果赋值操作没有完成,那么调用setValueforUndefinedKey方法抛出异常;

```

## nSObject的本质是什么?一个NSObject对象占用多少内存?

```text
- 类的底层实现是结构体objc_class,通过class_getInstanceSize按照结构体内存对齐原则,NSObject对象占用了8个字节
                                 通过malloc_size按照操作系统内存对齐原则,NSObject对象占用了16个字节
                                 通过sizeof计算的是数据类型所占用内存大小

```

## objc对象如何进行内存布局?一个objc对象的isa的指针有什么作用?runtime如何通过selector找到对应的IMP地址?(分别考虑类方法和实例方法)

```text
- 实例对象的isa指针指向类对象,类对象的isa指针指向元类对象;根元类的isa指针指向自己,superclass指针指向NSObject类;
- 当调用对象方法时,实例对象的isa指针会通过与ISA_MASK进行位运算,找到存储在类对象中的方法IMP进行调用;
- 当调用类方法时,类对象的isa指针会通过和ISA_MASK进行位运算,找到存储在元类中的方法IMP进行调用;

```

## 讲述一下消息转发机制?

```text
- 当向实例对象发送一条消息时,objc_msgSend会从本类、父类直到根类查找该方法的IMP,如果没有找到则开启动态解析流程,

- 动态解析流程会调用resolveInstanceMethod 或 resolveClassMethod方法,
  我们可以在这个方法中通过class_addMethod动态添加方法实现并返回YES完成调用,如果没有就进入快速消息转发流程;

- 快速消息转发流程会调用forwardingTargetForSelector方法,
  我们可以在这个方法中返回一个能够响应该消息的对象完成调用,如果没有就进入标准消息转发流程;

- 标准消息转发流程会调用methodSignatureForSelector方法,
  我们可以在这个方法中返回NSMethodSignature对象,系统会动态创建NSInvocation对象并传入forwardInvocation方法,
  NSInvocation对象包含了方法接收者、方法名和方法参数,我们可以通过对NSInvocation对象发送invoke消息完成最后一次处理;
  如果刚刚说的这些方法都没有实现则调用doesNotRecognizeSelector抛出异常;

```

## method、SEL和IMP区别?

```text
- Method的底层实现是结构体method_t,其中包含了方法名SEL、形参和返回值的类型编码信息types、以及指向方法具体实现的函数指针IMP;
- SEL底层结构类似char *,可以通过@selector获取,不同类同名方法的SEL是相同的;

```

## method swizzling是什么?

```text
- 方法交换是通过Runtime交换方法名SEL和指向方法具体实现的函数指针IMP的映射关系

```

## 代码题目 - super关键字

```text
/**
 * [self class]实际先调用的是objc_msgSend函数,第一个参数是Student实例,然后沿着Student到父类查找到为止
 * super本质是一个编译器标示符,和self指向的是同一个消息接受者,不同点在于super调用class方法是去父类查找方法;
 * 直到查找到NSObject类中发现此方法,而- (Class)class的实现就是返回self的类别,故上述输出结果为Student.
 * ----------------------------------------------------------------------------------------------------
 * [super class]实际先调用objc_msgSendSuper函数,第一个参数是objc_super(如下),然后沿着Person到父类查找到为止
 * 直到查找到NSObject类中发现此方法,最后内部是使用objc_msgSend(objc_super->receiver, @selector(class))去调用,
 * 此时已经和[self class]调用相同了,故上述输出结果仍然返回Student
 */

 @implementation Student

 id objc_msgSendSuper(struct objc_super *super, SEL op, ...);

 struct objc_super {
     __unsafe_unretained id receiver; // 类似于objc_msgSend函数第一个参数se1f
     __unsafe_unretained Class super_class; // 第二个成员是记录当前类的父类是什么,这里就是Person
 };

 // 获取这个对象的类型
 - (Class)class {
     return object_getClass(self);
 }

 struct objc_super {
     __unsafe_unretained id receiver;
     __unsafe_unretained Class super_class;
 };

 - (instancetype)init {
     // Student继承父类Person
     self = [super init];
     if(self){
     NSLog(@"%@", [self class]);         // Student
     NSLog(@"%@" , [self superclass]);   // Person

     NSLog(@"-----------------------")

     NSLog(@"%@" , [super class]);       // Student
     NSLog(@"%@" , [super superclass]);  // Student

     return self;
 }

 @end

```

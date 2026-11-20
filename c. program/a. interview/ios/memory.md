## iOS使用什么机制管理对象内存?

- MRC手动引用计数: 开发者手动添加retain/release来操作retainCount从而实现手动内存管理;
- ARC自动引用计数: 编译器自动添加retain/release,当对象的retainCount为0系统会立即进行释放;

## taggedPointer

- TaggedPointer是指将其对象指针拆成两部分,一部分用于存储数据,另一部分来表明这是一个不指向任何地址的特殊指针;
  常用于内存不需要占用8个字节的对象,例如NSNumber因此有时NSNumber对象并不存储在堆中;

## 优化的isa指针

```text
- arm64架构之前,isa指针是一个存储着类对象地址或元类对象地址的普通指针,;
- arm64架构之后,isa指针通过共用体和位域来存储更多的信息,例如是否有关联对象、是否有被弱引用、引用计数等等;

 union isa_t {
     Class cls;
     uintptr_t bits;
     struct {
         uintptr_t nonpointer        : 1;    // 0表示普通的指针,1表示优化过后指针(使用位域存储更多的信息)
         uintptr_t has_assoc         : 1;    // 是否有设置过关联对象
         uintptr_t has_cxx_dtor      : 1;    // 是否有C++的析构函数
         uintptr_t shiftcls          : 33;   // 存储着Class、Meta-Class对象的内存地址信息
         uintptr_t magic             : 6;    // 用于在调试时分辨对象是否未完成初始化
         uintptr_t weakly_referenced : 1;    // 是否有被弱引用指向过,
         uintptr_t deallocating      : 1;    // 对象是否正在释放
         uintptr_t has_sidetable_rc  : 1;    // 里面存储的值是引用计数器减1
         uintptr_t extra_rc          : 19;   // 1表示引用计数器是否过大无法存储在isa中而存储在SideTable类的属性中
     };
 };

```

## weak和assign有什么不同

- weak关键字的setter方法在进行赋值操作时既不保留新值也不释放旧值;
  当weak指针所指的对象遭到摧毁时,weak指针会自动置为nil,此时继续给该对象发送消息也不会有什么问题;

- assign关键字的setter方法在进行赋值操作时只是简单的纯量赋值操作;
  当assign指针所指的对象遭到摧毁时,此时继续给该对象发送消息会造成BAD_ACCESS;

## 如何实现weak变量的自动置nil?

- 系统维护了一张weak指针哈希表,其中key是对象地址,value是weak指针数组;

- 当初始化weak变量时会调用initWeak函数,创建一个weak指针指向对象地址;
  当新增weak引用时会调用storeWeak函数,更新指针并指向系统所创建的弱引用表;
  当释放weak对象时会调用clearDeallocating函数,根据对象地址获取weak指针数组,并遍历数组将每一个指针置为nil;

## __block和__weak修饰符的区别?

- __block不管是MRC还是ARC都可以使用,既可以修饰基本数据类型也可以修饰对象,但不能修饰静态变量和全局变量;
  block本身不允许在内部修改外部变量的值,__block通过将外部变量拷贝到堆中从而实现在block内部修改外部变量的值;

- __weak只能在ARC模式下使用,并且只能修饰对象;

## block底层是如何实现的?

```text
- block本质是一个带isa指针的OC对象,其内部封装了函数调用以及函数调用环境所需的OC对象,
  block分为NSStackBlock、NSMallocBlock和NGlobalBlock三种类型并且都继承于NSBlock;

- block底层实现是结构体main_block_impl_0,其中包含结构体main_block_desc_0和结构体block_impl;
  结构体main_block_desc_0包含了block_size、copy和dispose函数(copy和dispose只有捕获对象类型才会出现);
  结构体block_impl包含了isa指针和函数指针FuncPtr;

- auto变量是通过值传递捕获,staic变量是通过指针传递捕获,全局变量可以直接访问无需捕获;

 struct __main_block_impl_0 {
     struct __block_impl impl;
     struct __main_block_desc_O *Desc;
 }

 struct __main_block_desc_0 {
     size_t reserved;
     size_t Block_size;
 }

 struct __block_impl {
     void *isa;
     int Flags;
     int Reserved;
     void *FuncPtr;
 };
 -----------------------------------------------------------------------------------------------------------------------------
 struct __main_block_impl_0 {
     struct __block_impl impl;
     struct __main_block_desc_O *Desc;
     int age;                           // auto变量通过值传递,这里已经变成了10,当block调用时age始终为10;
     int *height;                       // static变量通过指针传递
 }

 int size = 10;

 int main(int argc, const char * argv[]) {
     @autoreleasepool {
         // 这里等同于auto int age = 10;这句代码,只是我们平时省略了这个关键字,auto表示自动变量也就是离开作用域会自动销毀
         auto int age = 10;
         static int height = 10;

         void(^block)(void) = ^{
             // 把age的值通过值传递捕获到main_block_impl_日结构体中,所以这里输入age is 10,和外界对age的改变没有任何关系
             NSLog(@"age is %d", age );
             // 把height的值通过地址传递捕获到main_block_impl_0结构体中,因为是地址传递外界对height的修改还是会影响结构体中的值
             NSLog(@"height is %d", height);
             // 全局变量不会捕获到内存中,这里是通过直接访问的方式访问全局的size变量,没有对__main_block_impl_0结构体造成影响
             NSLog(@"size is %d", size);
         };
         age = 20;
         height = 20;
         size = 20;
         block();
     }
     return 0;
 }
 -----------------------------------------------------------------------------------------------------------------------------
 @interface MJPerson : Nsobject

 @property (copy, nonatomic) NSString *name ;

 - (instancetype)initWithName:(NSString *)name ;

 - (void)test;

 @end

 @implementation MJPerson

 - (instancetype )initwithName:(NSString *)name {
     if (self = [super init]) {
         self.name = name;
     }
     return self;
 }

 - (void)test {
     void (^block)(void) = ^{
         //test函数通过block打印出name也会把self捕获到__main_block_impl_0结构体中来
         NSLog(@"@", name);
     };
         block();
 }

 // Block的内存结构
 struct __main_block_impl_0 {
     struct __block_impl impl;
     struct __main_block_desc_O *Desc;
     MJPerson *self;

 }

 struct __block_impl {
     void *isa;
     int Flags;
     int Reserved;
     void *FuncPtr:
 };

 struct __main_block_desc_0 {
     size_t reserved;
     size_t Block_size;
 }

```

## __block关键字的底层原理

```text
- __block的底层实现是将变量封装成一个对象,其中包含isa指针、forwarding指针和变量本身;

- 当__block变量在栈上时,Block内部不会对外部封装对象形成强引用;
  当__block变量被拷贝到堆时,Block内部会调用Block_object_assign函数根据外部封装对象的内存语义形成相应的强弱引用;
  当__block变量从堆上移除时,Block内部会调用Block_object_dispose函数释放外部封装对象;

 struct __main_block_impl_0 {
     struct __block_impl impl;
     struct __main_block_desc_0* Desc;
     __Block_byref_age_0 *age;
     __Block_byref_person_1 *person;
 };

 struct __block_impl {
     void *isa;
     int Flags;
     int Reserved;
     void *FuncPtr;
 };

 struct __main_block_desc_0 {
     size_t reserved;
     size_t Block_size;
     void (*copy)(struct __main_block_impl_0*, struct __main_block_impl_0*);
     void (*dispose)(struct __main_block_impl_0*);
 }

 //__block修饰auto基础数据类型
 struct __Block_byref_age_0 {
     void *__isa;
     __Block_byref_age_0 *__forwarding;//指向自己结构体的地址,相当于内部有一个指针指向了他自己
     int __flags;
     int __size;
     int age;
 };

 //_block修饰auto对象数据类型
 struct __Block_byref_person_1 {
     void *__isa;
     __Block_byref_person_1 *__forwarding;//指向自己结构体的地址,相当于内部有一个指针指向了他自己
     int __flags;
     int __size;
     void (*__Block_byref_id_object_copy)(void*,void*);
     void (*__Block_byref_id_object_dispose)(void*)
     MJPerson *__strong/__weak person; //ARC下是__strong还是__weak完全取决于block捕获的指针是__strong还是__weak
     //MRC这里一定是弱引用
 };

 /****************************************** ARC ************************************************/

 typedef void (^MJBlock)(void);
 int main(int argc, const char * argv[]) {
     @autoreleasepool {

         __block int age = 10;
         __block MJPerson *person = [[MJPerson alloc] init];

         MJBlock block = ^{
             NSLog(@"age is %d", age);
             NSLog(@"obj is %p", person)//__Block_byref_person_1中的person是强引用__strong
         };
         block();
     }
     return 0;
 }

 /****************************************** ARC ************************************************/

 typedef void (^MJBlock)(void);
 int main(int argc, const char * argv[]) {
     @autoreleasepool {

         __block int age = 10;
         __block __weak MJPerson *person = [[MJPerson alloc] init];

         MJBlock block = ^{
             NSLog(@"age is %d", age);
             NSLog(@"obj is %@", person)//__Block_byref_person_1中的person是弱引用__weak
         };
         block();
     }
     return 0;
 }

 /****************************************** ARC ************************************************/

 int main(int argc, const char * argv[]) {
     @autoreleasepool {
         MJBlock block;
         {
             MJPerson *person = [[MJPerson alloc] init];
             __block __weak MJPerson *weakPerson = person;
             block = ^{
                 NSLog(@"%p",weakPerson);
             }
         }
         // 代码执行到这里person对象已经调用了dealloc方法销毁了
         block();
     }
     return 0;
 }

 /****************************************** ARC ************************************************/

 int main(int argc, const char * argv[]) {
     @autoreleasepool {
         MJBlock block;
         {
             MJPerson *person = [[MJPerson alloc] init];
             __block MJPerson *weakPerson = person;
             block = ^{
                 NSLog(@"%p",weakPerson);
             }
         }
         // 代码执行到这里person对象没有调用dealloc方法也没有销毁
         block();
     }
     return 0;
 }

 /****************************************** MRC ************************************************/

 /**
  * MRC即使你对block使用了copy操作,但是person在block还没释放的时候也会被销毁
  * 这是因为结构体__Block_byref_weakPerson_0对person始终是弱引用,并没有进行retain操作,这在MRC下是比较特殊的
  */
 int main(int argc, const char * argv[]) {
     @autoreleasepool {

         __block MJPerson *person = [[MJPerson alloc] init];
         MJBlock block = [^{
             NSLog(@"%p",person);
         } copy];
         [person release];

         block();
         // 在MRC下,这里block还没有释放但是person已经销毁了
         [block release];
     }
     return 0;
 }

 /****************************************** MRC ************************************************/

 /**
  * MRC,如果我们不使用block,
  */
 int main(int argc, const char * argv[]) {
     @autoreleasepool {

         MJPerson *person = [[MJPerson alloc] init];
         MJBlock block = [^{
             NSLog(@"%p",weakPerson);
         } copy];
         [person release];

         block();
         // 代码执行到这里person并没有被销毁,而是等到[block release]执行完毕才销毁,回到了没有__block的逻辑
         [block release];
     }
     return 0;
 }

```

## autoreleasePool是如何实现的

```typescript
- AutoreleasePool是由多个AutoreleasePoolPage组合而成的双向链表,并且和线程是一一对应的;
  结构体AutoreleasePoolPage的thread指针指向当前线程,parent指针指向上一个AutoreleasePoolPage对象,
  child指针指向下一个AutoreleasePoolPage对象,next指针指向栈顶位置;
  再通过autoreleasePoolPush()、autoreleasePoolPop()、autorelease完成对对象的push pop和延迟释放操作;
  每个AutoreleasePoolPage对象会开辟一页虚拟内存,除了存放自身实例变量剩下全部存储autorelease对象的地址;

- 在没有手动添加AutoreleasePool的情况下,系统会默认给每个runloop中都加入自动释放池Push和Pop操作,
  因此autorelease对象会在当前的runloop结束时释放;

 class AutoreleasePoolPage {
     magic_t const magic;
     id *ext;
     pthread_t const thread;
     AutoreleasePoolPage * const parent;
     AutoreleasePoolPage *child;
     uint32_t const depth
     uint32_t hiwat;
 }

```

## 使用NSTimer和CADisplayLink有什么需要注意点

```text
- NSTimer会对target产生强引用,此时如果target同时又强引用了Timer对象那么会产生循环引用;
- 我们可以通过NSProxy和消息转发机制解决循环引用的问题,或者直接使用NSTimer的block接口;

 #import "ViewController.h"

 @interface MJProxy : NSProxy

 + (instancetype)proxyWithTarget:(id)target;

 @property (weak, nonatomic) id target;

 @end

 @implementation MJProxy

 + (instancetype)proxyWithTarget:(id)target {
     // NSProxy对象不需要调用init,因为它本来就没有init方法
     MJProxy *proxy = [MJProxy alloc];
     proxy.target = target;
     return proxy;
 }

 /**
  * 转发一个能够响应方法的对象
  */
 - (id)forwardingTargetForSelector:(SEL)aSelector {
     return self.target;
 }

 @end

 @interface ViewController ()

 @property (strong, nonatomic) NSTimer *timer;

 @end

 @implementation ViewController

 - (void)viewDidLoad {
     [super viewDidLoad];

     // self强引用了timer,timer通过target也强引用了self,造成内存泄露
     self.timer = [NSTimer scheduledTimerWithTimeInterval:1.0
                                                   target:self
                                                 selector:@selector(timerTest)
                                                 userInfo:nil
                                                  repeats:YES];

     // 通过block调用解决内存泄露问题
     __weak typeof(self) weakSelf = self;
     self.timer = [NSTimer scheduledTimerWithTimeInterval:1.0
                                                  repeats:YES
                                                    block:^(NSTimer * _Nonnull timer) {
         [weakSelf timerTest];
     }];

     //self强引用了timer,time强引用了代理MJProxy,MJProxy弱引用了self;所以不会造成循环引用
     self.timer = [NSTimer scheduledTimerWithTimeInterval:1.0
                                                   target:[MJProxy proxyWithTarget:self]
                                                 selector:@selector(timerTest)
                                                 userInfo:nil
                                                  repeats:YES];
 }

 - (void)timerTest {
     NSLog(@"%s", __func__);
 }

 - (void)dealloc {
     [self.timer invalidate];
 }

 @end

```

## block 与 Delegate 的区别,分别使用在什么场景下?

- Block是一种封装代码块的方式,其内部封装了函数调用和函数调用环境所需要的OC对象;
  当事件是产生单一类型回调建议采用Block,例如GCD将任务封装为block并存放到队列中;
- Delegate是一种代理设计模式,用于实现对象间的委托和通信;
  当事件是产生多种类型回调建议采用Delegate,例如设计UI基础组件需要有数据源和代理两种不同类型回调;

## 为什么要使用copy 关键字? (怎么使用copy关键字)

```text
- copy关键字常用于修饰NSString、NSArray、NSDictionary属性,这是由于这些数据结构都有对应的可变类型,
  因此使用copy可以保护这些属性的封装性防止被无意间更改;

- copy关键字也常用于修饰block属性,早期MRC中使用copy是为了将block拷贝到堆中,而ARC中默认就会将block拷贝到堆中
  因此沿用MRC的传统使用copy修饰block属性;

```

## 这个写法会出什么问题:  @property (copy) NSMutableArray *array;

```text
- 使用copy关键字修饰可变类型属性由于拷贝策略使得该属性本质还是不可变的,而外部按照可变类型去使用会导致崩溃;
- 使用默认automic会产生性能问题,而且也不能保证该属性是绝对的线程安全;

```

## 如何让自定义类可以用 copy 修饰符? 如何重写带 copy 关键字的 setter?

```text
- 我们可以通过让类实现NSCopying协议和NSMutableCopying协议让自定义对象具有拷贝功能

 #import "TYPerson.h"

 @interface TYPerson ()<NSCopying>

 @end

 @implementation TYPerson {
     NSMutableset *friends :
 }

 - (instancetype)initwithName:(NSString *)name
                          age:(NSUInteger)age
                          sex:(CYLSex)sex {
     if(self = [super init]) {
         _name = [name copy];
         _age = age;
         _sex = sex;
         _friends = [[NSMutableSet alloc] init];
     }
     return self;
 }

 - (void)addFriend:(TYPerson *)user {
     [_friends addObject:user];
 }

 - (void)removeFriend:(TYPerson *)user {
     [_friends removeObject:user ];
 }

 // 如果自定义的对象分为可变版本与不可变版本,那么就要同时实现NSCopying与NSMutablecopying协议
 - (id)copywithzone : (NSzone *)zone {
     TYPerson *copy = [[[self classJ allocWithzone:zone]
                                     initwithName:_name
                                     age:_age
                                     sex:_sex];
     copy->_friends = _friends mutablecopy];
     return copy;
 }

 /*
  *存放朋友对象的 set 是用 ncopywithzone方法来拷贝的,这种浅拷贝方式不会逐个复制 set 中的元素。
  *若需要深拷贝的话,则可像下面这样,编写一个专供深拷贝所用的方法
  */
 - (id)deepCopy {
     TYPerson copy = [[[self class] alloc] initwithName:_name
                                                   age:_age
                                                   sex:_sex];
     copy->_friends = [[NSMutableset alloc] initwithset:_friends
                                              copyItems: YES];
     return copy:
 }

 - (void)setName:(NSString *)name {
     _name = [name copy];
 }

```

## atomic与nonatomic的区别?

- atomic底层是通过os_unfair_lock实现,保证了属性setter和getter方法的完整性,使得任何线程对其访问都能获得到一个完整初始化的对象;
  比如线程A调用setter方法的过程中线程B调用了getter方法,那么会先执行完线程A的setter方法后再执行线程B的getter方法;
  对比nonatomic读写安全但也不是绝对的线程安全,多个线程同时访问setter和getter方法会导致获取到的对象不可预料,绝对的线程安全要用底层锁机制实现;

- nonatomic不保证属性setter和getter方法的完整性,多个线程对其访问可能获取到一个未完整初始化的对象,对比atomic效率高但非线程安全;

## 如何解决线程同步

- OSSpinLock: 自旋锁是当一个线程获取到锁之后,其他线程会循环查看该锁是否被释放,因此适用于持有锁较短时间的场景;
              另外自旋锁存在优先级反转问题,高优先级线程任务占用了CPU,导致低优先级线程任务即使拿到锁也无法执行;

- os_unfair_lock: os_unfair_lock是当一个线程获取到锁之后,其他线程会处于休眠状态直到该锁释放,并且解决了优先级反转问题;

- dispatch_semaphore: 信号量锁是通过控制最大并发数来限制线程数量,一旦达到数量上限其他线程就必须等待,直到有线程释放信号;

- pthread_mutex: pthread_mutex同样是当一个线程获取到锁之后,其他线程会处于休眠状态直到该锁释放;

- NSLock和NSRecurisiveLock: 底层是通过对pthread_mutex的封装实现了lock加锁和unlock解锁,并且一个线程获取到锁后其他线程会处于挂起状态;
                            两者的不同点在于NSRecurisiveLock可以重复加锁,直到加锁和解锁的次数平衡才会释放;

- NSCodition和NSConditionLock: 底层是通过对pthread_mutex和pthread_cond_t的封装实现了一个锁和一个线程检查器,便于线程间的调度;
                               两者的不同点在于NSConditionLock可以设置具体条件值;

- @synchronized: 同步锁底层是对mutex递归锁的封装,由于内部实现采用链表查找、缓存查找和递归比较消耗性能,因此效率较低;

## nSThread、GCD、NSOperation性能上有何区别

- NSThread能最大限度的掌控每一个线程的生命周期,但需要我们手动管理所有的线程活动;
  比如线程创建、同步、暂停、取消、手动加锁等较为繁琐,因此基本是在测试时使用;

- GCD是基于C语言封装的API,只需要我们将任务封装为block放入到队列中即可;
  串行和并发决定任务的执行方式,串行只能一个任务执行完毕后再执行下一个任务,并发可以多个任务并发同时执行;
  同步和异步决定能不能开启新的线程,同步是在当前线程中执行任务不具备开辟新线程的能力,异步可以在新的线程中执行任务具备开启新线程的能力;

- Operations是基于GCD封装的API,也只需要我们将任务封装为Operations放入到OperationQueue即可,而且不局限于先进先出的队列操作;
  它提供了多个接口来实现线程创建、同步、暂停和取消等操作并且可以通过KVO监测每个任务的执行状态;
  我们甚至可以通过自定义NSOperation来实现终止正在执行的任务、指定任务优先级和依赖关系、指定最大并发量等复杂操作,比GCD更加灵活;

## 队列 - 同步

```text
+------------------------------------------------------------+
|        |  全局/并行队列   |   串行队列    |    主队列      |
|------------------------------------------------------------|
|  sync  |  串行执行任务    |  串行执行任务 |    产生死锁    |
|  sync  |  没有开新线程    |  没有开新线程 |    产生死锁    |
|------------------------------------------------------------|
|  async |  并行执行任务    |  串行执行任务 |  串行执行任务  |
|  async |  有开启新线程    |  有开启新线程 |  没有开新线程  |
+------------------------------------------------------------+

```

## 自定义NSOperation的子类

```text
- 我们可以通过重写main方法让底层控制任务的执行状态以及任务退出,也可以通过重写start方法自行控制任务的执行状态;

- 同时我们可以通过在main方法中监听外部的isCancelled变量,如为YES直接return实现终止正在执行的任务;
  另外在自定义NSOperation的子类时,重写main函数时需要加入@autorelease便于统一释放临时对象;

```

## dispatch_barrier_async的作用是什么? 如何利用GCD实现多读单写? 并发队列如何操作依赖

```text
- dispatch_barrier_async主要作用是等前面的任务执行完毕后再执行自身的任务,等自身的任务执行完毕后再执行后续的任务;
   栅栏函数必须使用手动创建的并发队列,如果使用串行和全局并发队列效果等同于dispatch_async;

 -(void)viewDidLoad {
     dispatch_queue_t queue = dispatch_queue_create(“com.oyca168.www“, DISPATCH_QUEUE_CONCURRENT);

     dispatch_async(queue, ^{
         NSLog(@“----1-----%@“, [NSThread currentThread]);
     });
     dispatch_async(queue, ^{
         NSLog(@“----2-----%@“, [NSThread currentThread]);
     });

     // 前面任务执行结束后它才执行,它执行结束后后面的任务才执行
     dispatch_barrier_async(queue, ^{
         NSLog(@“----barrier-----%@“, [NSThread currentThread]);
     });

     dispatch_async(queue, ^{
         NSLog(@“----3-----%@“, [NSThread currentThread]);
     });
     dispatch_async(queue, ^{
         NSLog(@“----4-----%@“, [NSThread currentThread]);
     });
 }

```

## 如何取消GCD任务

```text
- 可以通过dispatch_block_create封装任务,通过dispatch_block_cancel进行取消;
- 可以通过定义外部变量用于标记block是否需要被取消;

 // 方式一
 dispatch_queue_t queue = dispatch_queue_create("com.oyca168.wwww", DISPATCH_QUEUE_CONCURRENT);
 dispatch_block_t block = dispatch_block_create(0, ^{
     sleep(5);
 });

 dispatch_async(queue, block);

 // 方式二
 dispatch_queue_t queue = dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0);
 __block BOOL isCancel = NO;
 dispatch_async(queue, ^{
     isCancel = YES;
 });
 dispatch_async(queue, ^{
     sleep(3);
     if(isCancel){

     }else{
     }
 });

```

## 是否可以把比较耗时的操作放在NSNotificationCenter中

- 首先必须明确通知在哪个线程中发出,那么该通知的回调也需要相同的线程中
  如果在子线程发的通知,那么可以执行比较耗时的操作;
  如果在主线程发的通知,那么就不可以执行比较耗时的操作;

## 代码题

```text

 //
 - (void)viewDidLoad {
     NSLog(@“执行任务1“);
     dispatch_queue_t mainQueue = dispatch_get_main_queue();
     dispatch_sync(mainQueue, ^{
         NSLog(@“执行任务2“);
     });
     NSLog(@“执行任务3“);
 }

 - (void)viewDidLoad {
     NSLog(@“执行任务1“);
     dispatch_queue_t queue = dispatch_queue_create(““, DISPATCH_QUEUE_SERIAL);

     dispatch_async(queue, ^{
         NSLog(@“执行任务2“);
         dispatch_async(queue, ^{
             NSLog(@“执行任务3“);
         });
         NSLog(@“执行任务4“);
     });

     NSLog(@“执行任务5“);
 }

 - (void)viewDidLoad {
     NSLog(@“执行任务1“);
     dispatch_queue_t serialQueue = dispatch_queue_create(“serial.quque“, DISPATCH_QUEUE_SERIAL);
     dispatch_queue_t concurrentQueue = dispatch_queue_create(“concurrent.queue“, DISPATCH_QUEUE_CONCURRENT);

     dispatch_async(serialQueue, ^{
         NSLog(@“执行任务2“);
         dispatch_sync(concurrentQueue, ^{
             NSLog(@“执行任务3“);
         });

         NSLog(@“执行任务4“);
     });

     NSLog(@“执行任务5“);
 }

 - (void)viewDidLoad {
     NSLog(@“执行任务1“);
     dispatch_queue_t serialQueue1 = dispatch_queue_create(“serial.quœœœœATCH_QUEUE_SERIAL);
     dispatch_queue_t serialQueue2 = dispatch_queue_create(“serial.quque2“, DISPATCH_QUEUE_SERIAL);

     dispatch_async(serialQueue1, ^{
         NSLog(@“执行任务2“);
         dispatch_sync(serialQueue2, ^{
             NSLog(@“执行任务3“);
         });
         NSLog(@“执行任务4“);
     });

     NSLog(@“执行任务5“);
 }

 - (void)viewDidLoad {
     NSLog(@“执行任务1“);
     dispatch_queue_t globalQueue = dispatch_get_global_queue(0, 0);
     dispatch_sync(globalQueue, ^{
         NSLog(@“执行任务2“);
         dispatch_sync(globalQueue, ^{
             NSLog(@“执行任务3“);
         });
         NSLog(@“执行任务4“);
     });
     NSLog(@“执行任务5“);
 }

```

## 沙盒目录结构是怎么样的?

- Application: 用于存放程序源文件,上架前经过数字签名,上架后不可修改;
- Documents: 用于存放需要备份到iCloud的数据;
- Library/Caches: 用于存放体积大且不需要备份的数据;
  Library/Preference: 用于存放需要备份到iCloud的偏好设置数据;
- tmp: 用于存放临时文件且数据随时可能被清除;

## nSTimer在滑动页面是会暂停的原因,如何解决呢?

```text
- NSTimer在主线程默认会被添加到NSDefaultRunLoopMode下运行;
  当滑动界面时Runloop会进入UITrackingRunLoopMode从而导致NSTimer停止;
  我们可以通过将NSTimer添加到NSRunLoopCommonModes解决这个问题;

```

## nSTimer不准的原因,如何解决呢?

```text
- NSTimer在主线程默认会被添加到NSDefaultRunLoopMode下运行;
  当滑动界面时Runloop会进入UITrackingRunLoopMode从而导致NSTimer停止;
  我们可以通过将NSTimer添加到NSRunLoopCommonModes解决这个问题;
- NSTimer会在每次RunLoop被检测,如果当前RunLoop中存在耗时操作会导致Timer延迟;

```

## 有哪几种方式可以来实现函数的延时调用，分别有什么优缺点

```text
- 可以通过performSelectorAfterDelay & NSTimer & CADisplayLink & dispatch_after实现延时调用;
  performSelectorAfterDelay只能在主线程调用并且不支持取消任务;
  NSTimer依赖于RunLoop,如果当前RunLoop中存在耗时操作会导致Timer延迟;
  CADisplayLink依赖于当前屏幕刷新率,同样会导致Timer延迟;
  dispatch_after不依赖于RunLoop,会按照预期延时调用;

```

## runloop和线程有什么关系?

- Runloop保存在全局的字典中,其中key是线程,value是Runloop,线程和RunLoop之间是一一对应的,每条线程都有唯一与之匹配的RunLoop;
- 主线程的Runloop由系统自动创建启动,子线程的Runloop由于懒加载需要我们手动获取一次才能启动;

 // 在子线程中创建Runloop对象
 NSRunLoop *runLoop = [NSRunLoop currentRunLoop];
 [runLoop addPort:[NSPort new] forMode :NSDefaultRunLoopMode];
 [runLoop run];

## runloop的mode作用是什么?

```typescript
- Runloop主要是用于监听输入源和管理事件循环的,其中包含的RunloopMode可以指定不同模式下不同事件的优先级;
  每一个Runloop包含了多种Mode,每种Mode又包含各自的observer/timer/source0/source1;

- RunLoop启动时必须选择一种Mode,并且如果需要切换Mode必须先退出当前Mode并重新进入新Mode;
  这样做是为了隔离开不同模式下的observer/timer/source0/source1使其互不影响;
  并且如果当前Mode没有任何observer/timer/source0/source1事件,Runloop会立马退出;

- RunloopMode主要分为NSDefaultRunLoopMode: 默认模式,主线程默认在此模式下运行;
                     UITrackingRunloopMode: 界面跟踪模式,用于追踪ScrollView滚动等从而保证界面优先滚动;
                     NSRunLoopCommonMode: 占位模式,并不是真正的模式;
                     UIInitializationRunLoopMode: App启动的第一个模式,启动完成后不再使用;
                     GSEventReceiveRunLoopMode: 接受系统内部事件的模式,开发者不必使用;

- source0: 是指触摸事件和Perform Selectors事件;
  source1: 是指基于Port线程间通信事件;
  timers: 是指定时器事件;
  observers: 是指用于监听RunLoop状态的监听器;

```

## 猜想Runloop内部是如何实现的? (杀手问题)

```text
- Runloop主要是用于监听输入源和管理事件循环的,其底层实现是在do-while循环内不断地处理observer/timer/source0/source1等各种事件回调;

- 第一步: 通知Observer即将进入Loop;
  第二步: 开启do-while循环,通知Observer即将要处理timer回调;
  第三步: 通知Observer即将要处理source0回调并执行加入的block;
  第四步: 处理source0回调,执行可能加入的block;
  第五步: 确认source1处于ready状态直接处理source1;
  第六步: 确认没有source1处于ready状态,会通知observer线程即将进入休眠;
  第七步: 调用mach_msg等待mach_port的消息,线程进入休眠,直到发生timer & source1 & 手动调用等事件才会被唤醒;
  第八步: 通知Observer线程将被唤醒,
  第九步: 依次处理timer回调 & GCD主队列异步任务 & source1,并执行加入的block
  第十步: 检查RunLoop的状态是否满足退出条件,满足则通知Observer即将退出RunLoop,不满足继续执行do-while循环;

- RunLoop的核心是保证线程在有消息时唤醒,无消息时休眠,这个机制依赖操作系统内核实现;
  底层是通过调用mach_msg()等待mach_port的消息,操作系统内核会将线程置于休眠状态直到别人发送port消息过来才会唤醒;
  mach_msg()底层调用了mach_msg_trap触发了陷阱机制,实现了用户态到内核态的切换,内核实现的mach_msg函数会完成实际的相关工作;

```

## 如何通过runloop观察主线程帧率

- 我们可以通过监控RunLoop的BeforeSources状态和AfterWaiting状态来判断是否出现卡顿;
- 首先创建一个ObserverContext观察者并添加到主线程RunLoop的common模式,然后创建一个常驻线程专门监控主线程RunLoop状态;
  如果发现BeforeSources状态或AfterWaiting状态在一定时间阈值内没有变化即可判定为卡顿;
  最后通过signal获取错误信息,方便结合符号表进行卡顿分析;

typedef CF_OPTIONS(CFOptionFlags, CFRunLoopActivity) {
    kCFRunLoopEntry ,             // 进入 loop
    kCFRunLoopBeforeTimers ,      // 触发 Timer 回调
    kCFRunLoopBeforeSources ,     // 触发 Source0 回调(重点关注)
    kCFRunLoopBeforeWaiting ,     // 等待 mach_port 消息
    kCFRunLoopAfterWaiting ,      // 接收 mach_port 消息(重点关注)
    kCFRunLoopExit ,              // 退出 loop
    kCFRunLoopAllActivities       // loop 所有状态改变
}

## 程序启动时的地址随机化

```text
- 地址空间布局随机化,是一种针对缓冲区溢出的安全保护技术,通过对堆/栈/共享库映射等线性区布局的随机化;
  使得每次载入MachO可执行文件的起始地址不一样,从而增加攻击难度;

```

## app启动流程

- 通过dyld加载MachO文件,并读取header和load commands递归加载所有的动态库;
- 进行rebase指针调整和bind符号绑定
- 进行Runtime初始化主要包含注册class和category, 检查selector唯一性;
- 进行其他初始化主要包含load方法、attribute(constructor)修饰函数的调用、创建C++静态全局变量等;
- 通过dyld调用main方法进入didFinishLaunchingWithOptions;

## 优化App的启动流程

- 通过合并减少动态库,Apple官方建议最多使用6个非系统动态库;
- 减少加载启动后不会去使用的类或者方法,尽量减少使用load方法采用initialize方法代替,减少C++全局变量的数量;
- main函数到首屏渲染完成期间只处理首屏相关的业务,其他业务延后进行;

## 如何监控App启动优化

```text
- 定时抓取主线程上的方法调用堆栈,计算一段时间内各个方法的耗时;
- 通过fishhook和汇编对objc_msgSend进行hook,计算所有方法的执行耗时;

```

## 如果想要替换一个C方法可以怎么做

```text
- fishhook 通过重新绑定符号从而实现对C方法的hook;

```

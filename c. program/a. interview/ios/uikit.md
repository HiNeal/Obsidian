## frame 和 bound 的区别

```text
- frame是指在父视图坐标系中的位置和大小,bounds是指在本地坐标系中的位置和大小;
- 当发生旋转时,frame会发生改变而bounds不会发生改变;

```

## cALayer和UIView之间的关系

```text
- CALayer负责将UIView从屏幕上显示出来,而UIView通过调用drawRect方法来渲染自身的内容;
  相比之下UIView更像是CALayer的管理器,访问它跟绘图坐标有关的属性实际上都是访问它所在CALayer的相关属性;

- UIView继承自UIResponder,相比CALayer可以响应用户事件;
  另外UIView有个layer属性可以返回主CALayer实例,我们也可以通过重写layerClass方法让UIView显示不同的CALayer;

 - (class) layerClass {
     // 使某个UIView的子类使用GL来进行绘制
     return ([CALayer class]);
 }
 

```

## 触摸事件的传递

```text
- 发生触摸事件后,系统会在将该触摸事件放入到UIApplication所管理的事件队列中,并通过FIFO的方式分发给keyWindow;

- keyWindow首先会判断自己是否可以接收触摸事件,接着判断触摸点是否在自己身上,
  最后按照层级逐级从后往前遍历子视图数组中的每一个View重复刚刚的步骤,直到找到最合适的View开启事件响应流程;

- 我们可以重写hitTestwithEvent方法来指定最合适的View,
  也可以通过重写pointInsideWithEvent方法修改触摸点是否在自己身上来指定最合适的View;

 - (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event {
     if (self.userInteractionEnabled == NO || self.hidden == YES || self.alpha <= 0.01)  return nil

     if (![self pointInside:point withEvent:event]) return nil

     int count = (int)self.subviews.count;
     for (int i = count - 1; i >= 0; i--) {
         UIView *childView = self.subviews[i];
         // 把触摸点在当前视图上坐标转化为在子视图上的坐标
         CGPoint childPoint = [self convertPoint:point toView:childView];
         // 询问子视图层级中的最佳响应视图
         UIView *fitView = [childView hitTest:childPoint withEvent:event];
         if (fitView) {
             // 如果子视图有更合适就返回
             return fitView;
         }
     }
     // 没有在子视图中找到更合适的响应视图,那么自身就是最合适的
     return self;
 }
                                            +----------+
                                            | UIWindow | 1.✅
                                            +----------+
                                                  |
                                                  v
                                            +----------+
                                            | MainView | 2.✅
                                            +----------+
                                                  |
                    +-----------------------------+---------------------------+
                    |                             |                           |
                    |                             v                           v
               +----------+                 +----------+                  +----------+ 3.🚫
               |  View A  |                 |  View B  | 4.✅             |  View C  |
               +----------+                 +-----+----+                  +----------+
                    |                             |                            |
                    v                             v                            v
             +------+-------+              +------+-------+              +-----+--------+
             |              |              |              |              |              |
             v              v              v              v  5.🚫        v              v
       +----------+   +----------+   +----------+   +----------+   +----------+   +----------+
       | View A.1 |   |  View A.2|   | View B.1 |   | View B.2 |   | View C.1 |   | View C.2 |
       +----------+   +----------+   +----------+   +----------+   +----------+   +----------+
                                           6.✅

```

## 事件响应者链

- 事件响应者链默认会从initView往上传递到UIWindow,直到UIApplication的nextResponder指向nil响应链结束;
- 我们可以通过重写touchesBegan方法让下一个响应者选择是否继续调用touchesBegan方法来决定是否进行事件拦截;

## 优化UITableView的流畅性

- 基本原则: 采用Cell的复用机制,减少视图数量和透明图层, 同时避免动态添加视图,
- 预先排版: 从云端获取数据后把不同类型Cell的布局数据缓存到内存中,避免重复计算Cell高度;
- 预先渲染: 避免离屏渲染,在后台线程提前绘制好相关内容;
- 按需加载: 采用类似SDWebImage按需加载的策略;

## 视图加载

```text
- (void)loadView
- (void)viewDidLoad
- (void)viewWillAppear:(BOOL)animated
- (void)viewWillLayoutSubviews
- (void)viewDidLayoutSubviews
- (void)viewDidAppear:(BOOL)animated
- (void)viewWillDisappear:(BOOL)animated
- (void)viewDidDisappear:(BOOL)animated
- (void)didReceiveMemoryWarning

```

## 视图刷新

```text
layoutIfNeeded会立即重新布局,setNeedsLayout不会立即重新布局而是在下一个布局周期触发更新;
layoutSubviews由系统直接调用,我们可以通过重写该方法自定义视图;

```

## 组件化实现方案

- iOS常见的组件化方案有URL、Target-Action和Protocol,我们主要采用基于Protocol的组件化设计方案;

- app启动时会将基础的Protocol和Manager注册成核心Service,其中主要包含ModuleManager提供解析配置文件等相关能力;
  TabManager提供tab注册和刷新等相关能力; RouterManager提供路由注册和跳转等相关能力;
  TaskManager提供任务注册和执行等相关能力; NotifyManager提供事件注册和通知等相关能力;
  AppManager提供app跳转等相关能力; ServiceManager提供服务注册和发现等相关能力;

- 业务层只需在自身模块的ModuleImpl中实现各项不同的基础协议,我们会通过ModuleManager解析所有模块的ModuleImpl类,
  并且提取出各个ModuleImpl所描述的tab & router & task & notify & service等信息注册到中心化组件中;
  最后不同的模块之间通信只需要通过Protocol从中心化组件中获取到对应Impl,从而实现不同组件的解耦;

## app混淆设计方案

- App混淆主要分为两个方面,一方面是图片和多语言文件等资源混淆,另一方面是二进制文件的混淆,其中包含字符串、方法名和类名的混淆;
  编译前混淆可以通过define重定义脚本所扫描的类名,编译时混淆可以通过编写LLVM插件,编译后混淆可以通过MachO文件混淆;

- 我们主要采用MachO文件混淆,MachO文件主要是由Header、Load Commands和Segment Command组合而成;
  我们可以通过解析header和Load Command找到objc_classname所在的section从而确定在MachO中存放类名的位置;

- 然后通过正则匹配所有需要被混淆的类名并剔除白名单和系统类生成混淆类数组,
  最后以翻转的bundleId作为混淆因子修改每个类的前缀从而实现每个段的混淆;

## 业务中你如何快速提高网络请求

- 基于TCP实现的HTTPS 2.0通过多路复用机制解决了HTTP层面上的队头阻塞问题;
  但当TCP在接收数据包时发生丢包仍然需要等待重传,同样会形成TCP层面上的队头阻塞问题;

- 基于UDP实现的QUIC在一个连接上可以存在多个流且流与流之间互不影响,从而解决队头阻塞问题;
  另外QUIC在应用层面上就可以实现不同的拥塞控制算法而不需要依赖操作系统内核支持,我们可以根据海外不同网络环境定制不同的拥塞算法;
  同时QUIC放弃了TCP协议五元组概念,采用64位随机数作为连接标识,因此在切换wifi和4G时可以持续在线不会重连;

- iOS15可以通过assumesHTTP3Capable开启HTTP3,同时需要云端支持才能有效,连接时长实测可以减少40%;

- HTTPS首次连接时间总和: TCP连接时间(1.5RTT) + TSL连接时间(1.5RTT) + HTTP交易时间(1RTT) = 4RTT
  QUIC首次连接时间总和: TSL1.3连接时间(1RTT) + HTTP交易时间(1RTT) = 2RTT
  QUIC重新连接时间总和: HTTP交易时间(1RTT) = 1RTT

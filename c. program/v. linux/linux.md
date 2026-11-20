## 常用路径.txt

```text
/bin:   存放系统基本命令, 如ls、cp、mkdir等;
/boot:  存放启动Linux时使用的内核文件和引导程序;
/dev:   存放设备文件, 如硬盘、键盘、鼠标等;
/etc:   存放系统配置文件, 如网络配置、用户配置等;
/home:  存放用户主目录, 每个用户在此目录下有一个以用户名命名的子目录;
/lib:   存放系统共享库文件, 是程序运行所必需的;
/media: 存放可移动设备(如U盘)挂载点;
/mnt:   临时挂载目录;
/opt:   存放可选的应用程序;
/proc:  存放系统和进程信息, 是一个虚拟文件系统;
/root:  超级用户(root)的主目录;
/run:   存放系统运行时的临时文件, 如pid文件等;
/sbin:  存放系统管理员使用的命令;
/srv:   存放服务(如Web服务器)提供的数据;
/sys:   存放内核和设备信息, 是一个虚拟文件系统;
/tmp:   存放临时文件, 重启系统后会被清空;
/usr:   存放系统应用程序和文件, 如文档、库、头文件等;
/var:   存放系统日志、缓存文件等可变文件;

```

## 基础知识.txt

```text
- 2个十六进制数需要用一个字节来存储

```

## 常用指令.txt

```text
rm -rf [Path]                         # 递归强制删除目录
rm *.srt                              # 删除srt结尾文件

ls -a                                 # 当前目录下所有子目录(隐藏)

grep -r -l "[content]" .           # 查询当前目录下所有包含content字符的文件

```

## gCC.txt

```text
gcc -E main.c                       // 预处理
gcc -E main.c -o main.i             // 预处理(生成main.i文件)
gcc -S main.c                       // 预处理-->编译(生成main.s文件)
gcc -c main.c                       // 预处理-->编译-->汇编(生成main.o二进制可重定位的目标文件)
gcc -c main.s                       // 编译-->汇编(生成main.o目标文件)
gcc file01.c file02.c -o product    // 多个文件同时生成目标文件

```

## 内存分配.txt

```text
|-------------------------|-|
|          .text          | |
|-------------------------| |
|          .data          | |
|-------------------------| |
|          .bss           | |
|-------------------------| |
|          .heap          | |> { 用户空间 }
|-------------------------| |
| shared library(.dll/so) | |
|-------------------------| |
|           stack         | |
|-------------------------| |
|    命令行参数 & 环境遍历   |-|
|-------------------------|-|
|         ZONE_DMA        | |
|        ZONE_NORMAL      | |> { 内核空间 }
|        ZONE_HIGHMEM     | |
|-------------------------|-|

在存在多个进程时,用户空间是互相隔离的,内核空间是共享的,进程间的通信可以通过匿名管道通信,基本的机制就是将数据写到内核空间后实现数据共享

代码段(代码区) : 用于存放代码(函数等等)
数据段(全局区) : 用于存放全局变量等
栈空间 : 每调用一个函数就会给它分配一段连续的栈空间，等函数调用完毕后会自动回收这段栈空间,可以自动分配和回收
堆空间 : 需要主动去申请和释放

```

## docker - 配置.txt

```text
docker run nginx                               # 创建启动容器
    --name=[name]                                  # 指定名称
    -d                                             # 后台运行
    --restart=always                               # 重启自启动
    -p [sourcePort]:[targetPort]                   # 端口转发
docker exec -it [imageId] /bin/bash            # 在指定容器内执行交互式shell
docker update [imageId] --restart=always       # 更新容器配置
docker stop [imageId]                          # 停止容器
docker start [imageId]                         # 启动容器
docker rm [name]                               # 删除停止的容器
docker rm -f [name]                            # 强制删除运行中的容器
docker ps                                      # 查看正运行容器
docker ps -a                                   # 查看所有容器(运行 & 停止)
reboot                                         # 重新启动容器内的操作系统

docker commit [imageId] [name]:[tag]           # 生成新镜像
    -a                                              # 指定作者
    -m                                              # 指定备注

docker pull [image]:[tag]                      # 下载指定版本镜像
docker images                                  # 查看已下载镜像
docker rmi [imageId]                           # 根据镜像Id移除镜像
docker rmi [image]:[tag]                       # 根据镜像名和Tag移除镜像

docker --version                               # docker版本
docker info                                    # docker信息

sudo yum update                                                                             # 更新系统软件包
sudo yum install -y yum-utils device-mapper-persistent-data lvm2                            # 安装Docker依赖软件包
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo  # 添加Docker软件源
sudo yum install docker-ce docker-ce-cli containerd.io                                      # 安装Docker
sudo systemctl start docker                                                                 # 启动Docker
sudo systemctl enable docker --now                                                          # 启动Docker & 设置开机启动docker
sudo docker run hello-world                                                                 # 验证Docker安装

Docker镜像: Docker容器运行所需的文件系统和参数的集合，可以看作是容器的模板;
Docker容器: Docker运行环境中的一个实例，它可以被创建、启动、停止、删除;
Docker仓库: 用于存储Docker镜像的地方，可以理解为一个代码仓库，可以存储和分享Docker镜像;

```

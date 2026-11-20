## oydevops-ci

```text
/*
   * Devops
   *
   * - Continuous Integration: 变动代码后持续集成,经过build/test/lint/合并代码等,
   *                           直到确保变动代码合格后才允许合并到主干分支上;
   * - Continuous Delivery: 针对当前代码变动发布后持续交付,包含了组件版本号发布集成/QA测试/App发布等,
   *                        最后针对生成二进制包等相关产物;
   */

   +---------------------+
   |     CI Pipeline     |     // 持续集成流水线
   +---------------------+
              |
              v
   +---------------------+
   | Component Develope  |     // 拉取代码 -> 创建需求分支 -> 集成App壳工程 -> 修改代码 -> push
   +---------------------+
              |
              v
   +---------------------+
   |  Code Style Check   |     // objc lint -> swift lint -> code lint
   +---------------------+
              |
              v
   +---------------------+
   |    Unit Testing     |     // XCTest  -> Mock
   +---------------------+
              |
              v
   +---------------------+
   | Joint App Packaging |     // 新分支组件集成到对应分支App -> 构建打包 -> 内网发布安装包
   +---------------------+
              |
              v
   +----------------------+
   |   Product Analysis   |    // 包体积大小 -> 启动速度 -> UI自动化测试
   +----------------------+
              |
              v
   +----------------------+
   |         QA Test      |    // 质量测试
   +----------------------+
              |
              v
   +----------------------+
   | Merge to main branch |    // 合并到组件仓库的主干分支
   +----------------------+

```

## oylinux-docker

```bash
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

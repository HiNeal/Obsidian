## oysecurity-certificate

```text
机构用自己的私钥对接收者公钥进行数字签名生成证书并发送(包含接受者公钥/数字签名)
                                   +-----------------+
               +------------------ |  Authorization  | <-----------------+
               |                   +-----------------+                   |
               |                                                         |
               |                                                         |
               |                                                         |
               |                                                         |
               |                                                         |
               |                                                         |
               |                                                         |
               |                                                         |
               |                                                         |
               |                                                         |
               |                                                         |
               |                                                         |
               |                                                         |
               |                                                         |
               v                                                         |
      +-----------------+                                       +-----------------+
      |     Sender      |  ---------------------------------->  |     Receiver    |
      +-----------------+                                       +-----------------+
    用机构公钥验证证书内数字签名                            生成密钥对并将公钥发送给机构;
    以此先确认接受者公钥的合法性
 并用合法的接受者公钥加密消息最终发送给接受者

```

## oysecurity-apple

```text
+------------------+
|     Mac Public   |  (certSigningRequest)
+------------------+
        |
        | Apple Private
        v                       mobile provision profile
+------------------+               +------------------+
|    Certificate   |               |    Certificate   |
|   (Mac Public)   |               |   (Mac Public)   |
|   (Signature)    |               |   (Signature)    |      +------------------+
+------------------+ Apple Private |------------------|      |       ipa        |
                  | ------------> |      devices     |      |      (App)       |   Mac Public
+------------------+               |      app id      |      |   (Signature)    | <-------------
|      devices     |               |   entitlements   |      |------------------|
|      app id      |               |------------------|      |    Certificate   |
|   entitlements   |               |    Signature     |      |  (Mac public)    |  Apple Public
+------------------+               +------------------+      |   (Signature)    | <-------------
                                                     | ---> |------------------|
                                  +------------------+      |     devices      |
+------------------+  Mac Private  |        IPA       |      |      app id      |
|        App       | ------------> |      (App)       |      |   entitlements   |
+------------------+     (p12)     |    (Signature)   |      |------------------|  Apple Public
                                  +------------------+      |   (Signature)    | <-------------
                                                            +------------------+

# 输出证书有效期截止时间cert.p12 为证书文件 password 为 p12 密码
openssl pkcs12 -in [cert.p12] -nodes -passin pass:[password] | openssl x509 -noout -enddate

# 获取 p12 文件 Subject 中的 Common Name
openssl pkcs12 -in apple.p12 -nodes -passin pass:[password] | openssl x509 -noout -subject

# 查看描述文件具体信息
openssl smime -inform der -verify -noverify -in 7ed9aae0-0ec9-435a-bebf-3f6b9e323fd4.mobileprovisio

```

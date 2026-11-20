## jSBridge 都有哪些实现方式

```text
- JS调用OC主要有JavascriptCore中的JSContext和JSExport两种方式;
  我们可以通过在JSContext上注册一个block,便于在JS环境中通过block名称进行调用;
  也可以通过遵循JSExport协议将属性/实例方法/类方法/初始化方法导出到JS环境;

- OC调用JS主要有JavascriptCore & UIWebView & WKWebView三种方式;
  JavascriptCore通过创建JSContext对象利用evaluateScript传入需要执行的JavaScript;
  UIWebView通过stringByEvaluatingJavaScriptFromString执行JavaScript;
  WKWebView通过evaluateJS执行JavaScript;

```

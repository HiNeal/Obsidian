// 把一组「方法类」的方法拷到目标类的原型上。每个功能文件只负责自己那组方法，
// 通过 this 访问插件实例；同名方法重复安装会直接报错，避免静默覆盖。
function installMixins(target, ...mixins) {
  for (const mixin of mixins) {
    for (const key of Object.getOwnPropertyNames(mixin.prototype)) {
      if (key === "constructor") continue;
      if (Object.prototype.hasOwnProperty.call(target.prototype, key)) {
        throw new Error(`${target.name}.${key} 被重复定义`);
      }
      Object.defineProperty(target.prototype, key, Object.getOwnPropertyDescriptor(mixin.prototype, key));
    }
  }
}

module.exports = { installMixins };

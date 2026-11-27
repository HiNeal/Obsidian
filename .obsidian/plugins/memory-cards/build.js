// 把 src/ 下的 CommonJS 模块打成 Obsidian 要求的单文件 main.js。无第三方依赖 (与 highlight-decompose 同一套打包方式)：
//   node build.js
// 只解析相对路径的 require("./x")；其余（obsidian 等）原样交给宿主。
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "src");
const modules = new Map();

function resolveId(fromId, request) {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromId), request));
  return fs.existsSync(path.join(SRC, base + ".js")) ? base : base + "/index";
}

function collect(id) {
  if (modules.has(id)) return;
  const code = fs.readFileSync(path.join(SRC, id + ".js"), "utf8");
  modules.set(id, code);
  for (const m of code.matchAll(/require\("(\.[^"]+)"\)/g)) collect(resolveId(id, m[1]));
}

collect("index");

let out = "/* 由 build.js 从 src/ 生成，请改 src/ 而不是这个文件。 */\n";
out += "const __defs = {\n";
for (const [id, code] of modules) {
  out += JSON.stringify(id) + ": function (module, exports, require) {\n" + code + "\n},\n";
}
out += "};\n";
out += `const __cache = {};
const __resolve = (fromId, request) => {
  const parts = fromId.split("/").slice(0, -1);
  for (const seg of request.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== "." && seg !== "") parts.push(seg);
  }
  const base = parts.join("/");
  return base in __defs ? base : base + "/index";
};
function __load(id) {
  if (__cache[id]) return __cache[id].exports;
  const module = (__cache[id] = { exports: {} });
  __defs[id].call(module.exports, module, module.exports, (request) =>
    request.startsWith(".") ? __load(__resolve(id, request)) : require(request));
  return module.exports;
}
module.exports = __load("index");
`;
fs.writeFileSync(path.join(__dirname, "main.js"), out);
console.log("main.js 已生成，模块数:", modules.size);

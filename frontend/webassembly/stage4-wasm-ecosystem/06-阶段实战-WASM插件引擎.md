# 阶段实战：WASM 插件引擎

## 做什么

构建一个 WASM 插件引擎：宿主程序加载 WASM 插件，插件可以访问宿主提供的数据和函数。这是一个安全的、沙箱化的插件系统。

## 应用场景

- **在线代码编辑器**：用户提交代码，沙箱化执行
- **数据处理平台**：用户上传自定义转换逻辑
- **游戏引擎**：Mod 系统
- **规则引擎**：动态加载业务规则

## 宿主程序

```javascript
// host.js
class PluginEngine {
  constructor() {
    this.plugins = new Map()
    this.memory = new WebAssembly.Memory({ initial: 1 })
  }

  async loadPlugin(name, wasmBytes) {
    const imports = this.createImports()
    const { instance } = await WebAssembly.instantiate(wasmBytes, imports)
    this.plugins.set(name, instance)
    return instance
  }

  createImports() {
    return {
      host: {
        log: (ptr, len) => {
          const bytes = new Uint8Array(this.memory.buffer, ptr, len)
          const msg = new TextDecoder().decode(bytes)
          console.log(`[Plugin] ${msg}`)
        },
        get_time: () => Date.now(),
        read_input: (ptr, maxLen) => {
          const encoded = new TextEncoder().encode(this._input || '')
          const len = Math.min(encoded.length, maxLen)
          new Uint8Array(this.memory.buffer, ptr, len).set(encoded.slice(0, len))
          return len
        },
        write_output: (ptr, len) => {
          const bytes = new Uint8Array(this.memory.buffer, ptr, len)
          this._output = new TextDecoder().decode(bytes)
        },
        memory: this.memory,
      },
    }
  }

  async execute(name, input) {
    const plugin = this.plugins.get(name)
    if (!plugin) throw new Error(`Plugin ${name} not found`)

    this._input = input
    this._output = ''

    plugin.exports.process()

    return this._output
  }
}
```

## 插件（Rust）

```rust
// plugin.rs
use std::slice;

extern "C" {
    fn log(ptr: *const u8, len: usize);
    fn get_time() -> u64;
    fn read_input(ptr: *mut u8, max_len: usize) -> usize;
    fn write_output(ptr: *const u8, len: usize);
}

#[no_mangle]
pub extern "C" fn process() {
    // 读取输入
    let mut buf = [0u8; 1024];
    let len = unsafe { read_input(buf.as_mut_ptr(), buf.len()) };
    let input = std::str::from_utf8(&buf[..len]).unwrap_or("");

    // 处理
    let output = input.to_uppercase();

    // 写入输出
    unsafe {
        write_output(output.as_ptr(), output.len());
    }
}
```

## 安全沙箱

WASM 插件的隔离性：

1. **内存隔离**：每个插件有自己的线性内存，不能访问宿主内存
2. **能力限制**：只能调用宿主显式导入的函数
3. **资源限制**：可以限制内存大小、执行时间
4. **无副作用**：不能直接访问文件系统、网络

```javascript
// 限制插件内存
const memory = new WebAssembly.Memory({ initial: 1, maximum: 16 }) // 最大 1MB

// 限制执行时间
function executeWithTimeout(instance, fn, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    try {
      const result = instance.exports[fn]()
      clearTimeout(timer)
      resolve(result)
    } catch (e) {
      clearTimeout(timer)
      reject(e)
    }
  })
}
```

## 插件管理界面

```html
<div id="plugin-manager">
  <h2>插件管理</h2>
  <input type="file" id="plugin-file" accept=".wasm" />
  <input type="text" id="plugin-name" placeholder="插件名称" />
  <button id="load-btn">加载插件</button>

  <div id="plugin-list"></div>

  <h3>测试执行</h3>
  <select id="plugin-select"></select>
  <input type="text" id="test-input" placeholder="输入测试数据" />
  <button id="execute-btn">执行</button>
  <pre id="output"></pre>
</div>
```

```javascript
const engine = new PluginEngine()

document.getElementById('load-btn').addEventListener('click', async () => {
  const file = document.getElementById('plugin-file').files[0]
  const name = document.getElementById('plugin-name').value
  if (!file || !name) return

  const bytes = await file.arrayBuffer()
  await engine.loadPlugin(name, bytes)
  updatePluginList()
})

document.getElementById('execute-btn').addEventListener('click', async () => {
  const name = document.getElementById('plugin-select').value
  const input = document.getElementById('test-input').value
  const result = await engine.execute(name, input)
  document.getElementById('output').textContent = result
})
```

## 练习

### 练习一：插件引擎

实现完整的插件引擎：加载 WASM 插件 → 提供宿主 API → 执行插件函数 → 返回结果。

### 练习二：多个插件

实现多个插件同时加载，每个插件有不同的处理逻辑（大写转换、JSON 格式化、Base64 编码）。

### 练习三：资源限制

实现插件的内存限制和执行时间限制，超出时中断执行并报错。

---

## 参考答案

### 练习一

按本课代码结构：PluginEngine 类 → Rust 插件 → 加载和执行。

### 练习二

```rust
// uppercase.rs
#[no_mangle]
pub extern "C" fn process() { /* 转大写 */ }

// json_format.rs
#[no_mangle]
pub extern "C" fn process() { /* JSON 格式化 */ }

// base64.rs
#[no_mangle]
pub extern "C" fn process() { /* Base64 编码 */ }
```

### 练习三

```javascript
function executeWithLimits(instance, input, { maxMemory = 16, timeoutMs = 5000 } = {}) {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: maxMemory })
  return Promise.race([
    new Promise(resolve => resolve(instance.exports.process())),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
  ])
}
```

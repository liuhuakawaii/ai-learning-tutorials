# 04 - WASM 插件系统：安全的第三方代码执行

## 场景引入

你正在开发一个数据处理平台，用户希望能自定义数据转换逻辑。如果让用户直接提交原生代码，存在严重的安全风险——恶意代码可以访问文件系统、发起网络攻击或消耗所有系统资源。用 Docker 隔离？启动开销太大。

WASM 提供了理想的解决方案：天生沙箱环境、亚毫秒级启动、跨语言支持。本课将带你设计和实现一个安全的 WASM 插件系统。

## 学习目标

- 理解为什么 WASM 是插件系统的理想选择
- 掌握插件架构设计的核心模式
- 实现宿主与插件之间的安全通信
- 设计合理的权限控制机制
- 优化插件实例化的性能开销

## 为什么用 WASM 做插件

| 方案 | 安全性 | 性能 | 跨语言 | 部署复杂度 |
|------|--------|------|--------|-----------|
| 原生插件 (.so/.dll) | 低 | 高 | 差 | 高 |
| JavaScript 沙箱 | 中 | 低 | 差 | 低 |
| Docker 容器 | 高 | 中 | 好 | 高 |
| WASM 插件 | 高 | 高 | 好 | 低 |

WASM 的三大优势：**安全沙箱**（默认无权限）、**跨语言**（Rust/Go/C++ 均可编译）、**高性能**（接近原生速度）。

## 插件架构设计

### 整体架构

```
┌─────────────────────────────────────┐
│              宿主程序                │
│  ┌──────────┐  ┌────────────────┐  │
│  │ 插件管理器│  │ 权限控制器     │  │
│  └────┬─────┘  └───────┬────────┘  │
│  ┌────┴────────────────┴─────────┐ │
│  │      WASM 运行时 (Wasmtime)    │ │
│  │  ┌────────┐ ┌────────┐        │ │
│  │  │ 插件 A  │ │ 插件 B  │       │ │
│  │  │(Rust)  │ │(Go)    │        │ │
│  │  └────────┘ └────────┘        │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 插件生命周期

```
加载 → 验证 → 实例化 → 初始化 → 运行 → 销毁
```

## 宿主-插件通信

### 内存管理策略

宿主和插件共享线性内存，需要明确的分配/释放协议：

```rust
use wasmtime::*;
use std::alloc::{alloc, dealloc, Layout};

// 插件侧：内存分配器
#[no_mangle]
pub extern "C" fn alloc(size: i32) -> i32 {
    let layout = Layout::from_size_align(size as usize, 8).unwrap();
    unsafe { alloc(layout) as i32 }
}

#[no_mangle]
pub extern "C" fn dealloc(ptr: i32, size: i32) {
    let layout = Layout::from_size_align(size as usize, 8).unwrap();
    unsafe { dealloc(ptr as *mut u8, layout) };
}

// 插件侧：处理函数
#[no_mangle]
pub extern "C" fn process(input_ptr: i32, input_len: i32) -> i64 {
    let input = unsafe {
        std::slice::from_raw_parts(input_ptr as *const u8, input_len as usize)
    };
    let text = std::str::from_utf8(input).unwrap_or("");
    let output = text.to_uppercase();

    let out_ptr = alloc(output.len() as i32);
    unsafe {
        std::ptr::copy_nonoverlapping(
            output.as_ptr(), out_ptr as *mut u8, output.len()
        );
    }
    // 返回 (指针 << 32 | 长度)
    ((out_ptr as i64) << 32 | output.len() as i64) as i64
}
```

### 宿主侧通信

```rust
struct PluginMemory {
    memory: Memory,
    alloc: TypedFunc<i32, i32>,
    dealloc: TypedFunc<(i32, i32), ()>,
}

impl PluginMemory {
    fn write_to_plugin(&self, store: &mut Store<()>, data: &[u8]) -> anyhow::Result<(i32, i32)> {
        let ptr = self.alloc.call(store, data.len() as i32)?;
        self.memory.data_mut(store)[ptr as usize..ptr as usize + data.len()]
            .copy_from_slice(data);
        Ok((ptr, data.len() as i32))
    }

    fn read_from_plugin(&self, store: &Store<()>, ptr: i32, len: i32) -> Vec<u8> {
        self.memory.data(store)[ptr as usize..ptr as usize + len as usize].to_vec()
    }
}
```

## 权限控制

### 基于能力的权限声明

```rust
#[derive(Debug, Clone)]
struct PluginPermissions {
    max_memory_bytes: usize,
    max_fuel: u64,
    allow_file_read: bool,
    allow_file_write: bool,
    allow_network: bool,
}

impl Default for PluginPermissions {
    fn default() -> Self {
        Self {
            max_memory_bytes: 16 * 1024 * 1024, // 16MB
            max_fuel: 1_000_000,
            allow_file_read: false,
            allow_file_write: false,
            allow_network: false,
        }
    }
}

fn apply_permissions(store: &mut Store<WasiCtx>, perms: &PluginPermissions) -> anyhow::Result<()> {
    store.set_fuel(perms.max_fuel)?;
    Ok(())
}
```

### 插件签名验证

```rust
use sha2::{Sha256, Digest};

fn verify_plugin(wasm_bytes: &[u8], expected_hash: &[u8]) -> anyhow::Result<bool> {
    let mut hasher = Sha256::new();
    hasher.update(wasm_bytes);
    Ok(hasher.finalize().as_slice() == expected_hash)
}
```

## 实例化开销优化

### 模块缓存

```rust
use std::collections::HashMap;
use std::sync::RwLock;

struct ModuleCache {
    engine: Engine,
    cache: RwLock<HashMap<String, Arc<Module>>>,
}

impl ModuleCache {
    fn new() -> anyhow::Result<Self> {
        Ok(Self {
            engine: Engine::default(),
            cache: RwLock::new(HashMap::new()),
        })
    }

    fn load_module(&self, name: &str, wasm_bytes: &[u8]) -> anyhow::Result<Arc<Module>> {
        {
            let cache = self.cache.read().unwrap();
            if let Some(module) = cache.get(name) {
                return Ok(Arc::clone(module));
            }
        }
        let module = Arc::new(Module::new(&self.engine, wasm_bytes)?);
        self.cache.write().unwrap().insert(name.to_string(), Arc::clone(&module));
        Ok(module)
    }
}
```

### 批量预热

```rust
fn prewarm_plugins(cache: &ModuleCache, plugin_dir: &str) -> anyhow::Result<()> {
    for entry in std::fs::read_dir(plugin_dir)? {
        let path = entry?.path();
        if path.extension().map_or(false, |ext| ext == "wasm") {
            let name = path.file_stem().unwrap().to_str().unwrap();
            let bytes = std::fs::read(&path)?;
            cache.load_module(name, &bytes)?;
            println!("预热插件: {}", name);
        }
    }
    Ok(())
}
```

## 常见误区

### 误区一：WASM 沙箱是绝对安全的

如果宿主通过导入函数暴露了危险操作（如无限制的文件访问），沙箱形同虚设。安全的关键在于宿主的接口设计。

### 误区二：每个请求都创建新实例

频繁创建和销毁实例有明显开销。应该复用已编译的模块，按需创建新实例，或使用实例池。

### 误区三：插件可以随意使用宿主内存

WASM 的线性内存是插件私有的。所有数据交换必须通过定义好的接口函数和共享内存区域。

### 误区四：所有语言编写的插件行为一致

不同语言的 WASM 编译器行为不同。Go 的输出包含 GC 运行时，Rust 的输出更精简。接口设计应考虑这些差异。

## 工程建议

1. **接口设计优先**：先用 WIT 或注释明确接口契约，再编写实现
2. **错误处理标准化**：定义统一的错误码和错误信息传递机制
3. **资源限制必须有**：内存上限、执行时间上限、递归深度限制
4. **版本兼容**：插件接口要有版本号，支持向后兼容
5. **监控与审计**：记录每个插件的执行时间、内存使用和错误率

## 小结

- **WASM 天然适合插件系统**：安全沙箱、跨语言、高性能
- **内存管理**：通过 alloc/dealloc 和指针传递实现宿主-插件数据交换
- **权限控制**：基于能力的权限模型，限制插件的资源访问
- **性能优化**：模块预编译缓存、实例复用、批量预热

## 练习

### 练习一：基础插件接口

设计并实现一个文本处理插件：导出 `process` 函数支持大写、反转、去空格三种模式，宿主能获取插件名称和版本。

### 练习二：带权限的插件加载器

实现插件加载器：加载 WASM 模块并验证哈希，应用内存和燃料限制，处理执行超时。

### 练习三：插件实例池

实现简单的实例池：预创建 N 个实例，请求时借出用完归还，处理池为空时的等待超时。

---

## 参考答案

### 练习一

**思路**：定义清晰的导出接口，使用内存指针传递字符串。

**答案**：

```rust
// 插件侧
use std::alloc::{alloc, dealloc, Layout};

#[no_mangle]
pub extern "C" fn alloc(size: i32) -> i32 {
    let layout = Layout::from_size_align(size as usize, 8).unwrap();
    unsafe { alloc(layout) as i32 }
}

#[no_mangle]
pub extern "C" fn dealloc(ptr: i32, size: i32) {
    let layout = Layout::from_size_align(size as usize, 8).unwrap();
    unsafe { dealloc(ptr as *mut u8, layout) };
}

#[no_mangle]
pub extern "C" fn process(input_ptr: i32, input_len: i32, mode: i32) -> i64 {
    let input = unsafe {
        std::slice::from_raw_parts(input_ptr as *const u8, input_len as usize)
    };
    let text = std::str::from_utf8(input).unwrap_or("");
    let result = match mode {
        0 => text.to_uppercase(),
        1 => text.chars().rev().collect(),
        2 => text.split_whitespace().collect::<Vec<_>>().join(" "),
        _ => return -1,
    };
    let bytes = result.as_bytes();
    let out_ptr = alloc(bytes.len() as i32);
    unsafe {
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), out_ptr as *mut u8, bytes.len());
    }
    ((out_ptr as i64) << 32) | bytes.len() as i64
}
```

**要点**：高位存指针、低位存长度的编码方式返回两个值。

### 练习二

**思路**：使用 Wasmtime 的燃料计量和哈希验证控制插件。

**答案**：

```rust
use wasmtime::*;
use wasmtime_wasi::WasiCtxBuilder;
use sha2::{Sha256, Digest};
use std::time::{Duration, Instant};

struct PluginLoader { engine: Engine }

impl PluginLoader {
    fn new() -> anyhow::Result<Self> {
        let engine = Engine::new(Config::new().consume_fuel(true))?;
        Ok(Self { engine })
    }

    fn load(&self, wasm: &[u8], hash: &[u8], max_fuel: u64) -> anyhow::Result<(Store<WasiCtx>, Instance)> {
        let mut hasher = Sha256::new();
        hasher.update(wasm);
        if hasher.finalize().as_slice() != hash {
            return Err(anyhow::anyhow!("签名验证失败"));
        }
        let module = Module::new(&self.engine, wasm)?;
        let wasi = WasiCtxBuilder::new().inherit_stdio().build();
        let mut store = Store::new(&self.engine, wasi);
        store.set_fuel(max_fuel)?;
        let instance = Instance::new(&mut store, &module, &[])?;
        Ok((store, instance))
    }
}
```

**要点**：SHA-256 验证完整性，燃料计量限制执行指令数。

### 练习三

**思路**：用 `mpsc::channel` 实现实例的借出和归还。

**答案**：

```rust
use std::sync::mpsc;
use std::time::Duration;
use wasmtime::*;

struct PluginPool {
    sender: mpsc::Sender<(Store<()>, Instance)>,
    receiver: mpsc::Receiver<(Store<()>, Instance)>,
}

impl PluginPool {
    fn new(engine: &Engine, module: &Module, size: usize) -> anyhow::Result<Self> {
        let (tx, rx) = mpsc::channel();
        for _ in 0..size {
            let mut store = Store::new(engine, ());
            let instance = Instance::new(&mut store, module, &[])?;
            tx.send((store, instance)).unwrap();
        }
        Ok(Self { sender: tx, receiver: rx })
    }

    fn acquire(&self, timeout: Duration) -> anyhow::Result<(Store<()>, Instance)> {
        self.receiver.recv_timeout(timeout)
            .map_err(|_| anyhow::anyhow!("获取实例超时"))
    }

    fn release(&self, item: (Store<()>, Instance)) {
        self.sender.send(item).unwrap();
    }
}
```

**要点**：`recv_timeout` 防止池为空时永久阻塞。

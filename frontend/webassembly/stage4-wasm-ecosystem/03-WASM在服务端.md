# 03 - WASM 在服务端：从沙箱到微服务

## 场景引入

你的团队正在构建一个 API 网关，需要运行用户提交的自定义转换逻辑。如果直接执行用户的代码，存在严重的安全风险。用 Docker 容器隔离？启动一个容器需要数百毫秒到数秒，在高并发场景下冷启动延迟不可接受。

WebAssembly 提供了另一种选择：亚毫秒级启动、内存占用以 KB 计、内置沙箱隔离。本课将介绍主流的 WASM 服务端运行时，对比 WASM 与 Docker 容器的差异，并展示如何构建 WASM 微服务。

## 学习目标

- 了解主流服务端 WASM 运行时的特性和差异
- 理解 WASM 与 Docker 容器在启动速度、资源占用上的对比
- 掌握使用 Fermyon Spin 构建 WASM 微服务
- 了解冷启动优化策略
- 理解边缘计算场景下 WASM 的优势

## 服务端 WASM 运行时

### 三大运行时对比

| 特性 | Wasmtime | WasmEdge | Wasmer |
|------|----------|----------|--------|
| 维护方 | Bytecode Alliance | CNCF | Wasmer Inc. |
| WASI 支持 | Preview 1 + Preview 2 | Preview 1 + 部分 P2 | Preview 1 |
| 组件模型 | 完整支持 | 部分支持 | 未支持 |
| 性能 | AOT 编译 | AOT + JIT | Cranelift/LLVM |
| 嵌入语言 | Rust/C/C++/Python/Go | Rust/C/C++/Go | Rust/C/Go/Python/JS |
| 适用场景 | 通用、插件系统 | 边缘计算、云原生 | 开发者工具 |

### Wasmtime 嵌入示例

```rust
use wasmtime::*;
use wasmtime_wasi::WasiCtxBuilder;

fn run_wasm_service() -> anyhow::Result<()> {
    let engine = Engine::new(
        Config::new()
            .cranelift_opt_level(OptLevel::Speed)
            .consume_fuel(true)
    )?;

    let mut store = Store::new(
        &engine,
        WasiCtxBuilder::new().inherit_stdio().build(),
    );
    store.set_fuel(1_000_000)?;

    let module = Module::from_file(&engine, "service.wasm")?;
    let instance = Instance::new(&mut store, &module, &[])?;

    let handler = instance.get_typed_func::<(i32, i32), i32>(&mut store, "handle")?;
    let result = handler.call(&mut store, (10, 20))?;
    println!("结果: {}", result);

    Ok(())
}
```

## WASM 与 Docker 容器对比

### 启动速度

```
Docker 容器启动流程：
  创建命名空间 → 挂载文件系统 → 启动 init 进程 → 启动应用
  总耗时：100ms - 数秒

WASM 模块启动流程：
  加载模块 → 实例化 → 调用入口函数
  总耗时：< 1ms
```

### 资源占用对比

| 指标 | Docker 容器 | WASM 模块 |
|------|------------|----------|
| 内存占用 | 10MB - 数百MB | 数KB - 数MB |
| 磁盘镜像 | 10MB - 数GB | 数KB - 数MB |
| 启动时间 | 100ms - 数秒 | < 1ms |
| 并发实例 | 数十 - 数百 | 数千 - 数万 |

### 安全模型对比

Docker 基于 Linux namespace 和 cgroup，共享宿主内核，存在容器逃逸风险。WASM 基于能力模型，默认无任何系统权限，宿主显式授予能力，细粒度控制。

## 构建 WASM 微服务

### Fermyon Spin 框架

```bash
# 安装并创建项目
curl -fsSL https://developer.fermyon.com/downloads/install.sh | bash
spin new -t http-rust my-api && cd my-api
spin build && spin up
```

项目配置：

```toml
# spin.toml
spin_manifest_version = 2

[application]
name = "my-api"
version = "1.0.0"

[[trigger.http]]
route = "/api/..."
component = "api-handler"

[component.api-handler]
source = "target/wasm32-wasi/release/api_handler.wasm"
[component.api-handler.build]
command = "cargo build --target wasm32-wasi --release"
```

HTTP 处理器：

```rust
use spin_sdk::http::{IntoResponse, Request, Response};
use spin_sdk::http_component;
use spin_sdk::key_value::Store;

#[http_component]
fn handle_api(req: Request) -> anyhow::Result<impl IntoResponse> {
    match req.uri().path() {
        "/api/health" => {
            Ok(Response::builder()
                .status(200)
                .header("content-type", "application/json")
                .body(Some(r#"{"status":"ok"}"#.into()))
                .build())
        }
        "/api/counter" => {
            let store = Store::open_default()?;
            let count: i64 = store.get("counter")?
                .map(|v| serde_json::from_slice(&v).unwrap_or(0))
                .unwrap_or(0);
            store.set("counter", &serde_json::to_vec(&(count + 1))?)?;
            Ok(Response::builder()
                .status(200)
                .body(Some(format!(r#"{{"count":{}}}"#, count + 1).into()))
                .build())
        }
        _ => Ok(Response::builder().status(404).body(Some("Not Found".into())).build())
    }
}
```

## 冷启动优化

### AOT 预编译

将 WASM 预编译为原生代码，跳过运行时编译：

```rust
use wasmtime::*;

fn precompile(wasm_path: &str, output_path: &str) -> anyhow::Result<()> {
    let engine = Engine::default();
    let module = Module::from_file(&engine, wasm_path)?;
    std::fs::write(output_path, module.serialize()?)?;
    Ok(())
}

fn load_precompiled(so_path: &str) -> anyhow::Result<()> {
    let engine = Engine::default();
    let bytes = std::fs::read(so_path)?;
    let module = unsafe { Module::deserialize(&engine, &bytes)? };
    // 直接使用，跳过编译
    Ok(())
}
```

### 模块池化

复用已编译的模块，按需创建新实例：

```rust
use wasmtime::*;
use std::sync::Arc;

struct WasmPool {
    engine: Engine,
    module: Arc<Module>,
}

impl WasmPool {
    fn new(wasm_path: &str) -> anyhow::Result<Self> {
        let engine = Engine::default();
        let module = Arc::new(Module::from_file(&engine, wasm_path)?);
        Ok(Self { engine, module })
    }

    fn create_instance(&self) -> anyhow::Result<Instance> {
        let mut store = Store::new(&self.engine, ());
        Instance::new(&mut store, &self.module, &[])
    }
}
```

## 边缘计算场景

CDN 边缘函数示例：

```rust
use spin_sdk::http::{IntoResponse, Request, Response};
use spin_sdk::http_component;

#[http_component]
fn handle_edge(req: Request) -> anyhow::Result<impl IntoResponse> {
    let country = req.headers()
        .get("cf-ipcountry")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");

    let body = match country {
        "CN" => "你好，欢迎访问！",
        "US" => "Hello, welcome!",
        _ => "Welcome!",
    };

    Ok(Response::builder()
        .status(200)
        .header("x-served-by", "wasm-edge")
        .body(Some(body.into()))
        .build())
}
```

## 常见误区

### 误区一：WASM 能完全替代 Docker

WASM 适合轻量级、无状态的服务。需要完整系统环境的应用（数据库、系统服务），Docker 仍然是更好的选择。

### 误区二：WASM 服务端性能接近原生

WASM 运行时开销约 5-15%，计算密集型任务接近原生，但频繁的宿主调用（网络 I/O、文件系统）开销更明显。

### 误区三：所有语言编译的 WASM 性能相同

Rust 和 C++ 的 WASM 输出通常比 Go（带 GC 运行时）小得多且快得多。

### 误区四：WASM 服务端生态已经成熟

生态仍在快速发展，生产部署前需要充分评估稳定性。

## 工程建议

1. **从边缘场景切入**：WASM 服务端最适合边缘计算、API 网关、函数计算等轻量场景
2. **预编译优化**：生产环境务必使用 AOT 预编译
3. **燃料计量**：始终启用燃料计量，防止无限循环
4. **渐进式迁移**：先在非关键路径上试用，验证稳定后再扩展

## 小结

- **三大运行时**各有特色：Wasmtime 标准化最好、WasmEdge 云原生优化、Wasmer 开发体验好
- **WASM vs Docker**：启动快 100-1000 倍、资源低 10-100 倍，但生态不及容器
- **Fermyon Spin** 提供完整的微服务框架
- **冷启动优化**：AOT 预编译和模块池化是关键手段
- **边缘计算**是 WASM 服务端最有前景的场景

## 练习

### 练习一：构建 HTTP 微服务

使用 Fermyon Spin 创建 HTTP 微服务：`GET /api/greet?name=xxx` 返回问候语，`POST /api/echo` 返回请求体，`GET /api/stats` 返回访问次数。

### 练习二：冷启动性能测试

编写性能测试，对比：直接加载 WASM 实例化、加载 AOT 预编译实例化、复用已编译模块创建新实例的耗时差异。

### 练习三：Wasmtime 嵌入式服务

编写 Rust 程序嵌入 Wasmtime 运行 WASI 模块，启用燃料计量并处理超时错误。

---

## 参考答案

### 练习一

**思路**：使用 Spin HTTP 触发器和键值存储实现三个端点。

**答案**：

```rust
use spin_sdk::http::{IntoResponse, Request, Response};
use spin_sdk::http_component;
use spin_sdk::key_value::Store;

#[http_component]
fn handle_request(req: Request) -> anyhow::Result<impl IntoResponse> {
    match req.uri().path() {
        "/api/greet" => {
            let query = req.uri().query().unwrap_or("");
            let name = query.split('&')
                .find(|p| p.starts_with("name="))
                .and_then(|p| p.split('=').nth(1))
                .unwrap_or("World");
            Ok(Response::builder().status(200)
                .body(Some(format!("你好，{}！", name).into())).build())
        }
        "/api/stats" => {
            let store = Store::open_default()?;
            let count: u64 = store.get("visits")?
                .map(|v| serde_json::from_slice(&v).unwrap_or(0))
                .unwrap_or(0);
            store.set("visits", &serde_json::to_vec(&(count + 1))?)?;
            Ok(Response::builder().status(200)
                .body(Some(format!(r#"{{"visits":{}}}"#, count + 1).into())).build())
        }
        _ => Ok(Response::builder().status(404).body(Some("Not Found".into())).build())
    }
}
```

**要点**：Spin 的 `Store::open_default()` 提供持久化键值存储。

### 练习二

**思路**：用 `Instant::now()` 测量三种初始化方式的耗时。

**答案**：

```rust
use wasmtime::*;
use std::time::{Instant, Duration};

fn main() -> anyhow::Result<()> {
    let iterations = 100;
    let engine = Engine::default();

    // 场景一：每次编译+实例化
    let mut total_compile = Duration::ZERO;
    for _ in 0..iterations {
        let start = Instant::now();
        let module = Module::from_file(&engine, "service.wasm")?;
        let mut store = Store::new(&engine, ());
        let _ = Instance::new(&mut store, &module, &[])?;
        total_compile += start.elapsed();
    }

    // 场景二：预编译后加载
    let module = Module::from_file(&engine, "service.wasm")?;
    std::fs::write("service.cwasm", module.serialize()?)?;
    let mut total_precompiled = Duration::ZERO;
    for _ in 0..iterations {
        let start = Instant::now();
        let bytes = std::fs::read("service.cwasm")?;
        let module = unsafe { Module::deserialize(&engine, &bytes)? };
        let mut store = Store::new(&engine, ());
        let _ = Instance::new(&mut store, &module, &[])?;
        total_precompiled += start.elapsed();
    }

    // 场景三：复用模块
    let module = Module::from_file(&engine, "service.wasm")?;
    let mut total_reuse = Duration::ZERO;
    for _ in 0..iterations {
        let start = Instant::now();
        let mut store = Store::new(&engine, ());
        let _ = Instance::new(&mut store, &module, &[])?;
        total_reuse += start.elapsed();
    }

    println!("每次编译+实例化: {:?}", total_compile / iterations);
    println!("预编译+实例化:   {:?}", total_precompiled / iterations);
    println!("复用模块实例化:  {:?}", total_reuse / iterations);
    Ok(())
}
```

**要点**：预编译跳过最耗时的编译阶段，差距在 10-100 倍之间。

### 练习三

**思路**：启用 `consume_fuel` 并设置燃料上限，捕获耗尽错误。

**答案**：

```rust
use wasmtime::*;
use wasmtime_wasi::WasiCtxBuilder;

fn main() -> anyhow::Result<()> {
    let engine = Engine::new(Config::new().consume_fuel(true))?;
    let mut store = Store::new(
        &engine,
        WasiCtxBuilder::new().inherit_stdio().build(),
    );
    store.set_fuel(100_000)?;

    let module = Module::from_file(&engine, "service.wasm")?;
    let instance = Instance::new(&mut store, &module, &[])?;

    let handler = instance.get_typed_func::<(), ()>(&mut store, "run")?;
    match handler.call(&mut store, ()) {
        Ok(_) => println!("执行成功"),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("fuel") {
                println!("燃料耗尽，执行被终止");
            } else {
                println!("执行错误: {}", msg);
            }
        }
    }
    Ok(())
}
```

**要点**：燃料计量是防止恶意代码无限循环的关键机制。

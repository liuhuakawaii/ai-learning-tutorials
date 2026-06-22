# 06 - 阶段实战：WASM 插件引擎

## 场景引入

经过前 5 课的学习，你已经掌握了 WASI、组件模型、服务端运行时、插件架构和 AI 推理。本课将这些知识融合为一个完整的 WASM 插件引擎——可以安全加载、管理和执行第三方插件的宿主系统。

## 学习目标

- 设计完整的 WASM 插件系统架构
- 使用 Rust 和 Wasmtime 实现宿主引擎
- 用 WIT 定义跨语言的插件接口
- 实现插件加载、调用和错误处理
- 构建管理界面，支持热重载和性能监控

## WIT 接口定义

```wit
// wit/plugin-engine.wit
package engine:plugin@1.0.0;

interface types {
    record plugin-meta {
        name: string,
        version: string,
        author: string,
        description: string,
    }

    variant plugin-error {
        invalid-input(string),
        execution-failed(string),
        resource-exhausted(string),
    }
}

interface plugin-api {
    use types.{plugin-meta, plugin-error};
    get-meta: func() -> plugin-meta;
    execute: func(input: string) -> result<string, plugin-error>;
    on-event: func(event-kind: string, data: option<string>);
}

interface host-api {
    log: func(level: string, message: string);
    read-config: func(key: string) -> option<string>;
    get-time-ms: func() -> u64;
}

world plugin {
    export plugin-api;
    import host-api;
}
```

## 宿主引擎实现

```rust
use wasmtime::*;
use wasmtime::component::*;
use wasmtime_wasi::WasiCtxBuilder;
use std::sync::{Arc, RwLock};
use std::collections::HashMap;
use std::time::Instant;

bindgen!({ world: "plugin", path: "../wit" });

struct PluginEngine {
    engine: Engine,
    modules: Arc<RwLock<HashMap<String, Module>>>,
    instances: Arc<RwLock<HashMap<String, PluginInstance>>>,
}

struct PluginInstance {
    store: Store<WasiCtx>,
    bindings: Plugin,
    call_count: u64,
    total_duration_us: u64,
}

#[derive(Debug, Clone)]
struct PluginPermissions { max_memory_bytes: usize, max_fuel: u64 }

impl Default for PluginPermissions {
    fn default() -> Self { Self { max_memory_bytes: 16 * 1024 * 1024, max_fuel: 5_000_000 } }
}

#[derive(Debug)]
struct ExecResult { success: bool, output: Option<String>, error: Option<String>, duration_us: u64 }

impl PluginEngine {
    fn new() -> anyhow::Result<Self> {
        let engine = Engine::new(
            Config::new().consume_fuel(true).wasm_component_model(true)
        )?;
        Ok(Self {
            engine,
            modules: Arc::new(RwLock::new(HashMap::new())),
            instances: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    fn load_plugin(&self, name: &str, path: &str) -> anyhow::Result<()> {
        let module = Module::from_file(&self.engine, path)?;
        self.modules.write().unwrap().insert(name.to_string(), module);
        Ok(())
    }

    fn instantiate(&self, name: &str, perms: &PluginPermissions) -> anyhow::Result<()> {
        let modules = self.modules.read().unwrap();
        let module = modules.get(name).ok_or_else(|| anyhow::anyhow!("未加载"))?;

        let mut store = Store::new(&self.engine,
            WasiCtxBuilder::new().inherit_stdio().build());
        store.set_fuel(perms.max_fuel)?;

        let mut linker = Linker::new(&self.engine);
        linker.instance("engine:plugin/host-api")?
            .func_wrap("log", |_, (l, m): (String, String)| {
                println!("[{}] {}", l, m); Ok(())
            })?;
        linker.instance("engine:plugin/host-api")?
            .func_wrap("read-config", |_, _: String| -> Result<Option<String>, _> {
                Ok(Some("default".into()))
            })?;
        linker.instance("engine:plugin/host-api")?
            .func_wrap("get-time-ms", |_, ()| -> Result<u64, _> {
                Ok(Instant::now().elapsed().as_millis() as u64)
            })?;

        let bindings = Plugin::instantiate(&mut store, module, &linker)?;
        let meta = bindings.engine_plugin_plugin_api().call_get_meta(&mut store)?;
        println!("实例化: {} v{}", meta.name, meta.version);

        self.instances.write().unwrap().insert(name.into(), PluginInstance {
            store, bindings, call_count: 0, total_duration_us: 0,
        });
        Ok(())
    }

    fn execute(&self, name: &str, input: &str) -> anyhow::Result<ExecResult> {
        let mut insts = self.instances.write().unwrap();
        let inst = insts.get_mut(name).ok_or_else(|| anyhow::anyhow!("未实例化"))?;

        let start = Instant::now();
        let result = inst.bindings.engine_plugin_plugin_api()
            .call_execute(&mut inst.store, input);
        let dur = start.elapsed().as_micros() as u64;
        inst.call_count += 1;
        inst.total_duration_us += dur;

        match result {
            Ok(Ok(o)) => Ok(ExecResult { success: true, output: Some(o), error: None, duration_us: dur }),
            Ok(Err(e)) => Ok(ExecResult { success: false, output: None, error: Some(format!("{:?}", e)), duration_us: dur }),
            Err(e) => Ok(ExecResult { success: false, output: None, error: Some(e.to_string()), duration_us: dur }),
        }
    }

    fn reload(&self, name: &str) -> anyhow::Result<()> {
        self.instances.write().unwrap().remove(name);
        self.instantiate(name, &PluginPermissions::default())
    }
}
```

## 示例插件

```rust
wit_bindgen::generate!({ world: "plugin" });

struct TextTransformer;

impl Guest for TextTransformer {
    fn get_meta() -> PluginMeta {
        PluginMeta {
            name: "text-transformer".into(),
            version: "1.0.0".into(),
            author: "示例".into(),
            description: "文本转换插件".into(),
        }
    }

    fn execute(input: String) -> Result<String, PluginError> {
        let parts: Vec<&str> = input.splitn(2, ':').collect();
        if parts.len() != 2 {
            return Err(PluginError::InvalidInput("格式: command:data".into()));
        }
        host_api::log("info", &format!("执行: {}", parts[0]));
        match parts[0] {
            "upper" => Ok(parts[1].to_uppercase()),
            "lower" => Ok(parts[1].to_lowercase()),
            "reverse" => Ok(parts[1].chars().rev().collect()),
            _ => Err(PluginError::InvalidInput(format!("未知: {}", parts[0]))),
        }
    }

    fn on_event(kind: String, _: Option<String>) {
        if kind == "init" { host_api::log("info", "初始化完成"); }
    }
}

export!(TextTransformer);
```

## 热重载

```rust
use notify::{Watcher, RecursiveMode, watcher};
use std::sync::mpsc;
use std::time::Duration;

fn setup_hot_reload(dir: &str, engine: Arc<PluginEngine>) -> anyhow::Result<notify::RecommendedWatcher> {
    let (tx, rx) = mpsc::channel();
    let mut w = watcher(tx, Duration::from_millis(500))?;
    w.watch(dir, RecursiveMode::NonRecursive)?;

    std::thread::spawn(move || {
        while let Ok(Ok(event)) = rx.recv() {
            if let notify::Event { kind: notify::EventKind::Modify(_), paths, .. } = event {
                for p in paths {
                    if p.extension().map_or(false, |e| e == "wasm") {
                        let name = p.file_stem().unwrap().to_str().unwrap();
                        let _ = engine.reload(name);
                    }
                }
            }
        }
    });
    Ok(w)
}
```

## TypeScript 管理界面

```typescript
interface PluginInfo { name: string; version: string; callCount: number; avgDurationUs: number; }
interface ExecResult { success: boolean; output?: string; error?: string; durationUs: number; }

class Dashboard {
    constructor(private base: string) {}

    async refresh() {
        const plugins: PluginInfo[] = await (await fetch(`${this.base}/plugins`)).json();
        document.getElementById('plugins')!.innerHTML = plugins.map(p => `
            <div class="card">
                <h3>${p.name} v${p.version}</h3>
                <p>调用: ${p.callCount} | 平均: ${p.avgDurationUs / 1000}ms</p>
                <button onclick="dash.exec('${p.name}')">执行</button>
            </div>
        `).join('');
    }

    async exec(name: string) {
        const input = (document.getElementById('input') as HTMLInputElement).value;
        const r: ExecResult = await (await fetch(`${this.base}/plugins/${name}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input }),
        })).json();
        document.getElementById('result')!.textContent =
            `${r.success ? '成功' : '失败'}: ${r.output || r.error} (${r.durationUs / 1000}ms)`;
    }
}

const dash = new Dashboard('http://localhost:3000/api');
setInterval(() => dash.refresh(), 2000);
dash.refresh();
```

## 常见误区

1. **不需要版本管理**：插件接口必须有版本号，引擎更新后旧插件可能无法运行
2. **热重载无缝切换**：正在执行的调用会中断，插件内部状态会丢失
3. **WASM 插件不会崩溃**：OOM、超时都可能导致插件被终止
4. **所有语言体验相同**：Rust 的 wit-bindgen 支持最完善

## 工程建议

1. **WIT 接口设计是核心**：它决定了系统的能力边界
2. **燃料计量必须开启**：防止恶意插件无限循环
3. **监控先行**：先实现监控和日志，再添加功能
4. **渐进式暴露能力**：初期只开放基本 API
5. **文档和示例**：为插件开发者提供清晰的文档

## 小结

本课构建了完整的 WASM 插件引擎：WIT 接口定义契约、Rust 宿主管理插件生命周期、燃料计量保障沙箱安全、热重载支持快速迭代、TypeScript 界面提供可视化管理。

## 练习

### 练习一：扩展插件接口

在 WIT 接口基础上新增键值存储接口和事件通知接口，宿主侧实现对应的导入函数。

### 练习二：实现 JSON 校验插件

用 Rust 实现新插件：JSON 格式化和校验，支持 validate/format/minify 三种模式。

### 练习三：沙箱测试

编写测试用例：验证恶意插件（无限循环）被燃料计量终止，测试并发执行的安全性。

---

## 参考答案

### 练习一

**思路**：扩展 WIT 接口添加存储能力，宿主用 `RwLock<HashMap>` 实现。

**答案**：

```wit
interface storage {
    get: func(key: string) -> option<string>;
    set: func(key: string, value: string);
}

world plugin {
    export plugin-api;
    import host-api;
    import storage;
}
```

```rust
let data = Arc::new(RwLock::new(HashMap::<String, String>::new()));
let d = data.clone();
linker.instance("engine:plugin/storage")?
    .func_wrap("get", move |_, k: String| -> Result<Option<String>, _> {
        Ok(d.read().unwrap().get(&k).cloned())
    })?;
let d2 = data.clone();
linker.instance("engine:plugin/storage")?
    .func_wrap("set", move |_, (k, v): (String, String)| {
        d2.write().unwrap().insert(k, v); Ok(())
    })?;
```

**要点**：`RwLock<HashMap>` 保证并发安全。

### 练习二

**思路**：用 `serde_json` 解析 JSON，通过 WIT 错误类型传递错误。

**答案**：

```rust
wit_bindgen::generate!({ world: "plugin" });
use serde_json::Value;

struct JsonValidator;

impl Guest for JsonValidator {
    fn get_meta() -> PluginMeta {
        PluginMeta { name: "json-validator".into(), version: "1.0.0".into(),
            author: "示例".into(), description: "JSON 校验".into() }
    }

    fn execute(input: String) -> Result<String, PluginError> {
        let parts: Vec<&str> = input.splitn(2, ':').collect();
        if parts.len() != 2 {
            return Err(PluginError::InvalidInput("格式: cmd:json".into()));
        }
        match parts[0] {
            "validate" => match serde_json::from_str::<Value>(parts[1]) {
                Ok(_) => Ok(r#"{"valid":true}"#.into()),
                Err(e) => Ok(format!(r#"{{"valid":false,"error":"{}"}}"#, e)),
            },
            "format" => {
                let v: Value = serde_json::from_str(parts[1])
                    .map_err(|e| PluginError::ExecutionFailed(e.to_string()))?;
                Ok(serde_json::to_string_pretty(&v)
                    .map_err(|e| PluginError::ExecutionFailed(e.to_string()))?)
            }
            _ => Err(PluginError::InvalidInput(format!("未知: {}", parts[0]))),
        }
    }

    fn on_event(kind: String, _: Option<String>) {
        if kind == "init" { host_api::log("info", "初始化完成"); }
    }
}

export!(JsonValidator);
```

### 练习三

**思路**：用 `Arc<PluginEngine>` 多线程并发测试，验证燃料计量和并发安全。

**答案**：

```rust
#[test]
fn test_timeout() {
    let engine = PluginEngine::new().unwrap();
    engine.load_plugin("loop", "tests/loop.wasm").unwrap();
    engine.instantiate("loop", &PluginPermissions { max_fuel: 1000, ..Default::default() }).unwrap();
    let r = engine.execute("loop", "run").unwrap();
    assert!(!r.success);
    assert!(r.error.unwrap().contains("fuel"));
}

#[test]
fn test_concurrent() {
    let engine = Arc::new(PluginEngine::new().unwrap());
    engine.load_plugin("counter", "tests/counter.wasm").unwrap();
    engine.instantiate("counter", &PluginPermissions::default()).unwrap();

    let handles: Vec<_> = (0..10).map(|i| {
        let e = engine.clone();
        std::thread::spawn(move || e.execute("counter", &format!("inc:{}", i)))
    }).collect();

    for h in handles { assert!(h.join().unwrap().unwrap().success); }
}
```

**要点**：燃料计量防止无限循环，`RwLock` 保护并发访问。

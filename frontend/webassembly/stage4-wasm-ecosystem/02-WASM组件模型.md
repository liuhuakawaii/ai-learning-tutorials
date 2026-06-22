# 02 - WASM 组件模型：跨语言互操作

## 场景引入

假设你有一个图像处理库用 Rust 编写，编译成 WASM 模块；另一个团队用 Go 写了元数据解析模块，也编译成 WASM。现在你想把它们组合成一个完整的图像处理管道——但两个模块的接口不兼容，数据类型无法直接传递。

组件模型（Component Model）就是为了解决这类问题而设计的。它定义了一套标准的方式，让不同语言编写的 WASM 模块可以互相通信、组合和复用。核心是 WIT（WebAssembly Interface Types）——一种语言无关的接口定义语言。

## 学习目标

- 理解组件模型的动机和解决的核心问题
- 掌握 WIT 语法，能够定义接口、类型和函数
- 了解组件的导入导出机制和链接方式
- 掌握 wasm-tools 工具链的基本使用
- 理解资源类型（resource）的概念和用法

## 组件模型的动机

标准 WASM 模块只能导入导出数值类型（i32、i64、f32、f64）。传递字符串或结构体必须通过线性内存传指针，但不同语言的内存布局和 ABI 不统一，类型信息在模块边界丢失。

组件模型引入**组件（Component）**抽象：组件通过 WIT 接口描述导入和导出，运行时在组件边界进行类型转换和内存隔离，实现真正的跨语言互操作。

```
┌─────────────┐     WIT 接口      ┌─────────────┐
│  Rust 组件   │ ───────────────→ │  Go 组件     │
│  (图像处理)  │   类型安全调用    │  (元数据解析) │
└─────────────┘                   └─────────────┘
       └────────────┬─────────────────────┘
            ┌───────┴────────┐
            │ Wasmtime 运行时 │
            └────────────────┘
```

## WIT（WebAssembly Interface Types）

### 基本语法

WIT 文件定义一个**包（package）**，包含**接口（interface）**和**世界（world）**：

```wit
// wit/calculator.wit
package demo:calculator@1.0.0;

interface types {
    record point {
        x: f64,
        y: f64,
    }

    enum operation {
        add,
        subtract,
        multiply,
        divide,
    }

    variant calc-error {
        divide-by-zero,
        overflow(string),
    }
}

interface compute {
    use types.{operation, calc-error};

    calculate: func(a: f64, b: f64, op: operation) -> result<f64, calc-error>;
}

interface history {
    resource log {
        constructor();
        add-entry: func(text: string);
        get-all: func() -> list<string>;
        length: func() -> u32;
    }
}

world calculator {
    export compute;
    export history;
}
```

### WIT 核心类型

```wit
interface core-types {
    // 基础类型
    type my-bool = bool;
    type my-string = string;
    type my-bytes = list<u8>;
    type small-int = u8;
    type big-int = s64;
    type ratio = f32;

    // 复合类型
    record point { x: f64, y: f64 }
    type pair = tuple<string, u32>;
    type maybe-name = option<string>;
}
```

### 资源类型（Resource）

资源类型封装有生命周期的值，如文件句柄或自定义对象：

```wit
interface file-handle {
    resource file {
        constructor(path: string);
        read: func() -> result<list<u8>, string>;
        write: func(data: list<u8>) -> result<_, string>;
    }
}
```

## 组件的导入与导出

### 导出接口（提供能力）

```rust
// Rust 实现导出接口
wit_bindgen::generate!({
    world: "calculator",
});

struct Calculator;

impl Guest for Calculator {
    fn calculate(a: f64, b: f64, op: Operation) -> Result<f64, CalcError> {
        match op {
            Operation::Add => Ok(a + b),
            Operation::Subtract => Ok(a - b),
            Operation::Multiply => Ok(a * b),
            Operation::Divide => {
                if b == 0.0 {
                    Err(CalcError::DivideByZero)
                } else {
                    Ok(a / b)
                }
            }
        }
    }
}

export!(Calculator);
```

### 导入接口（依赖能力）

组件需要外部提供功能时声明导入：

```rust
// 调用导入的日志接口
fn process(input: &str) -> Result<String, String> {
    host_api::log("info", &format!("处理输入: {}", input));
    Ok(input.to_uppercase())
}
```

## 组件组合与链接

```rust
use wasmtime::component::*;
use wasmtime::{Engine, Store};

fn main() -> anyhow::Result<()> {
    let engine = Engine::default();
    let mut store = Store::new(&engine, ());
    let mut linker = Linker::new(&engine);

    // 注册宿主提供的导入实现
    linker
        .instance("host-api")?
        .func_wrap("log", |_, (level, msg): (String, String)| {
            println!("[{}] {}", level, msg);
            Ok(())
        })?;

    let component = Component::from_file(&engine, "calculator.wasm")?;
    let instance = linker.instantiate(&mut store, &component)?;

    // 调用导出的计算函数
    let compute = instance.get_typed_func::<(f64, f64, Operation), (Result<f64, CalcError>,)>(
        &mut store,
        "compute#calculate",
    )?;

    Ok(())
}
```

## wasm-tools 工具链

```bash
# 将模块打包为组件
wasm-tools component new input.wasm -o output.wasm --wit world.wit

# 查看组件的导入导出
wasm-tools component wit output.wasm

# 验证组件合法性
wasm-tools validate output.wasm --features component-model

# 生成绑定代码
wit-bindgen rust --out-dir src/bindings world.wit
wit-bindgen ts --out-dir src/bindings world.wit
```

## 常见误区

### 误区一：组件模型已经完全标准化

组件模型仍在提案阶段（Phase 3），Wasmtime 已有较好支持但规范仍在演进。生产使用需做好版本管理。

### 误区二：组件之间可以直接共享内存

组件模型的核心设计是**内存隔离**。每个组件有独立的线性内存，数据在组件边界进行序列化/反序列化。

### 误区三：WIT 只能用于 Rust

WIT 是语言无关的。wit-bindgen 支持 Rust、Go、C/C++、Python、JavaScript 等语言。

### 误区四：资源类型等同于面向对象的类

资源类型更接近 RAII 模式，主要用于管理有生命周期的系统资源，不是通用的面向对象抽象。

## 工程建议

1. **先设计 WIT 接口**：在编写实现之前，先用 WIT 定义清楚接口边界
2. **版本管理**：WIT 包支持语义化版本，接口变更时务必升版
3. **错误处理**：WIT 的 `result` 类型是标准的错误传递方式，不要用魔法值
4. **性能考量**：组件边界的数据传递有序列化开销，避免热路径上频繁跨组件调用
5. **工具链版本统一**：团队内统一 wasm-tools 和 wit-bindgen 版本

## 小结

- **组件模型**解决了不同语言 WASM 模块之间的互操作问题
- **WIT** 是语言无关的接口定义语言，支持记录、枚举、变体、资源等类型
- **导入导出机制**让组件可以声明依赖和提供的能力
- **内存隔离**是组件模型的安全基础，数据在组件边界进行类型转换

## 练习

### 练习一：定义 WIT 接口

为一个简单的待办事项服务定义 WIT 接口，支持：创建任务、标记完成、获取列表、错误处理（任务不存在）。

### 练习二：用 Rust 实现组件

根据练习一的 WIT 定义，用 Rust 实现待办事项组件，使用资源类型封装任务列表。

### 练习三：组件链接测试

编写宿主程序，加载组件并执行：创建任务、标记完成、验证错误处理。

---

## 参考答案

### 练习一

**思路**：使用 WIT 定义任务记录、错误类型和资源封装的任务列表。

**答案**：

```wit
// wit/todo.wit
package demo:todo@1.0.0;

interface types {
    record task {
        id: u32,
        title: string,
        completed: bool,
    }

    variant todo-error {
        not-found(u32),
        invalid-title(string),
    }
}

interface todo-list {
    use types.{task, todo-error};

    resource list {
        constructor();
        add: func(title: string) -> result<task, todo-error>;
        complete: func(id: u32) -> result<task, todo-error>;
        get-all: func() -> list<task>;
        remove: func(id: u32) -> result<_, todo-error>;
    }
}

world todo {
    export todo-list;
}
```

**要点**：`resource list` 封装了任务列表的内部状态，所有操作通过资源方法进行。

### 练习二

**思路**：使用 wit-bindgen 生成 Rust 绑定，实现资源类型的方法。

**答案**：

```rust
// src/lib.rs
wit_bindgen::generate!({
    world: "todo",
});

use exports::demo::todo::todo_list::{GuestList, Task, TodoError};
use std::cell::RefCell;

struct TodoApp;

struct ListImpl {
    tasks: RefCell<Vec<Task>>,
    next_id: RefCell<u32>,
}

impl GuestList for ListImpl {
    fn new() -> Self {
        Self {
            tasks: RefCell::new(Vec::new()),
            next_id: RefCell::new(1),
        }
    }

    fn add(&self, title: String) -> Result<Task, TodoError> {
        if title.trim().is_empty() {
            return Err(TodoError::InvalidTitle("标题不能为空".to_string()));
        }
        let mut id = self.next_id.borrow_mut();
        let task = Task { id: *id, title, completed: false };
        *id += 1;
        self.tasks.borrow_mut().push(task.clone());
        Ok(task)
    }

    fn complete(&self, id: u32) -> Result<Task, TodoError> {
        let mut tasks = self.tasks.borrow_mut();
        let task = tasks.iter_mut().find(|t| t.id == id)
            .ok_or(TodoError::NotFound(id))?;
        task.completed = true;
        Ok(task.clone())
    }

    fn get_all(&self) -> Vec<Task> {
        self.tasks.borrow().clone()
    }

    fn remove(&self, id: u32) -> Result<(), TodoError> {
        let mut tasks = self.tasks.borrow_mut();
        let idx = tasks.iter().position(|t| t.id == id)
            .ok_or(TodoError::NotFound(id))?;
        tasks.remove(idx);
        Ok(())
    }
}

export!(TodoApp);
```

**要点**：`RefCell` 提供内部可变性，因为资源方法接收 `&self`。

### 练习三

**思路**：使用 Wasmtime 组件 API 加载和调用组件。

**答案**：

```rust
// host/src/main.rs
use wasmtime::component::*;
use wasmtime::{Engine, Store};

bindgen!({
    world: "todo",
    path: "../wit",
});

fn main() -> anyhow::Result<()> {
    let engine = Engine::default();
    let mut store = Store::new(&engine, ());
    let linker = Linker::new(&engine);

    let component = Component::from_file(&engine, "todo.wasm")?;
    let instance = linker.instantiate(&mut store, &component)?;

    let todo = TodoTodoList::new(&mut store, &instance)?;
    let list = todo.call_constructor(&mut store)?;

    // 创建任务
    let task1 = todo.call_add(&mut store, list, "学习 WIT")?;
    println!("创建任务: {:?}", task1);

    // 标记完成
    let completed = todo.call_complete(&mut store, list, task1.id)?;
    println!("完成任务: {:?}", completed);

    // 验证错误处理
    let err = todo.call_remove(&mut store, list, 999);
    println!("删除不存在的任务: {:?}", err);

    Ok(())
}
```

**要点**：资源句柄（`list`）是不透明标识符，通过它调用资源方法。

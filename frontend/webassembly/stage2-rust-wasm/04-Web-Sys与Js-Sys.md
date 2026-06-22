# 04 - Web-Sys 与 Js-Sys

## 场景引入

前面课程中，我们用 Rust 写了纯计算逻辑的 WASM 模块。但在真实 Web 应用中，你需要操作 DOM、处理事件、绘制 Canvas、发起网络请求。如果这些操作都必须通过 JS 中转，WASM 的价值就大打折扣了。

`web-sys` 和 `js-sys` 解决了这个问题。它们是 Web API 和 JS 内置对象的 Rust 绑定，让你用 Rust 代码直接操作浏览器环境。

## 学习目标

- 理解 web-sys 的 feature gate 机制
- 掌握用 Rust 操作 DOM（查询、创建、修改元素）
- 学会处理浏览器事件（点击、键盘）
- 能使用 Canvas 2D API 绘制图形
- 了解 js-sys 提供的 JS 内置对象绑定

## web-sys crate 概述

`web-sys` 是 Web IDL 接口的自动生成绑定，使用 Cargo feature gate 按需启用：

```toml
[dependencies.web-sys]
version = "0.3"
features = [
    "Document", "Element", "HtmlElement", "HtmlCanvasElement",
    "CanvasRenderingContext2d", "Window", "MouseEvent", "KeyboardEvent", "console",
]
```

只有列出的 API 才会被编译，这是控制 WASM 体积的关键实践。

```rust
use wasm_bindgen::prelude::*;
use web_sys::{Document, Window};

#[wasm_bindgen(start)]
pub fn main() -> Result<(), JsValue> {
    let window: Window = web_sys::window().expect("无法获取 window");
    let document: Document = window.document().expect("无法获取 document");
    let body = document.body().expect("无法获取 body");
    body.set_inner_html("<h1>来自 Rust WASM 的问候</h1>");
    Ok(())
}
```

`#[wasm_bindgen(start)]` 标注的函数在 WASM 加载时自动执行。

## DOM 操作

### 查询元素

```rust
use web_sys::{Document, HtmlInputElement};

fn query_elements(document: &Document) -> Result<(), JsValue> {
    let input: HtmlInputElement = document
        .get_element_by_id("search-input").expect("找不到").dyn_into()?;
    let items = document.query_selector_all(".list-item")?;
    web_sys::console::log_1(&format!("找到 {} 项", items.length()).into());
    Ok(())
}
```

`dyn_into::<T>()` 用于安全地将 `Element` 转换为具体类型。

### 创建和修改元素

```rust
fn create_todo_item(document: &Document, text: &str) -> Result<(), JsValue> {
    let li = document.create_element("li")?;
    li.set_class_name("todo-item");
    li.set_inner_html(text);
    let btn: web_sys::HtmlElement = document.create_element("button")?.dyn_into()?;
    btn.set_text_content(Some("删除"));
    li.append_child(&btn)?;
    document.body().unwrap().append_child(&li)?;
    Ok(())
}
```

### 修改样式

```rust
fn highlight(element: &web_sys::Element) -> Result<(), JsValue> {
    element.set_attribute("data-highlighted", "true")?;
    let style = element.style();
    style.set_property("background-color", "#ffeb3b")?;
    style.set_property("transition", "background-color 0.3s")?;
    Ok(())
}
```

## 事件处理

```rust
use web_sys::{Element, MouseEvent, KeyboardEvent};

// 点击事件
fn setup_click(element: &Element) -> Result<(), JsValue> {
    let h = Closure::wrap(Box::new(move |e: MouseEvent| {
        web_sys::console::log_1(&format!("点击: ({}, {})", e.client_x(), e.client_y()).into());
    }) as Box<dyn FnMut(MouseEvent)>);
    element.add_event_listener_with_callback("click", h.as_ref().unchecked_ref())?;
    h.forget(); Ok(())
}

// 键盘事件
fn setup_shortcuts(doc: &web_sys::Document) -> Result<(), JsValue> {
    let h = Closure::wrap(Box::new(move |e: KeyboardEvent| {
        match (e.ctrl_key(), e.key().as_str()) {
            (true, "s") => { e.prevent_default(); web_sys::console::log_1(&"保存".into()); }
            (_, "Escape") => { web_sys::console::log_1(&"关闭".into()); }
            _ => {}
        }
    }) as Box<dyn FnMut(KeyboardEvent)>);
    doc.add_event_listener_with_callback("keydown", h.as_ref().unchecked_ref())?;
    h.forget(); Ok(())
}
```

## Canvas 2D API

```rust
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement};

fn draw_scene(document: &web_sys::Document) -> Result<(), JsValue> {
    let canvas: HtmlCanvasElement = document.get_element_by_id("canvas").unwrap().dyn_into()?;
    let ctx: CanvasRenderingContext2d = canvas.get_context("2d")?.unwrap().dyn_into()?;

    let gradient = ctx.create_linear_gradient(0.0, 0.0, 400.0, 300.0);
    gradient.add_color_stop(0.0, "#667eea")?;
    gradient.add_color_stop(1.0, "#764ba2")?;
    ctx.set_fill_style(&gradient);
    ctx.fill_rect(0.0, 0.0, 400.0, 300.0);

    ctx.set_font("bold 36px sans-serif");
    ctx.set_fill_style_str("#ffffff");
    ctx.fill_text("Rust WASM Canvas", 50.0, 160.0)?;

    ctx.begin_path();
    ctx.arc(200.0, 220.0, 40.0, 0.0, std::f64::consts::PI * 2.0)?;
    ctx.set_fill_style_str("#ff6b6b");
    ctx.fill();
    Ok(())
}
```

## Fetch API

```rust
use wasm_bindgen_futures::JsFuture;
use web_sys::{Request, RequestInit, RequestMode, Response};

async fn fetch_user(user_id: u32) -> Result<JsValue, JsValue> {
    let mut opts = RequestInit::new();
    opts.method("GET");
    opts.mode(RequestMode::Cors);

    let url = format!("https://api.example.com/users/{}", user_id);
    let request = Request::new_with_str_and_init(&url, &opts)?;

    let window = web_sys::window().unwrap();
    let resp_value = JsFuture::from(window.fetch_with_request(&request)).await?;
    let resp: Response = resp_value.dyn_into()?;

    if !resp.ok() {
        return Err(JsValue::from_str(&format!("HTTP 错误: {}", resp.status())));
    }
    let json = JsFuture::from(resp.json()?).await?;
    Ok(json)
}
```

`Cargo.toml` 需添加 `wasm-bindgen-futures = "0.4"` 和 web-sys 的 `Request`、`Response`、`Window` features。

## Console 日志

```rust
use web_sys::console;

fn logging_demo() {
    console::log_1(&"普通日志".into());
    console::log_2(&"标签:".into(), &42.into());
    console::warn_1(&"警告信息".into());
    console::error_1(&"错误信息".into());
    console::time_with_label("性能测试");
    // ... 执行操作 ...
    console::time_end_with_label("性能测试");
}
```

## js-sys 内置对象绑定

`js-sys` 提供 JS 标准内置对象的 Rust 绑定：

```rust
use js_sys::{Array, Date, JSON, Map, Math, Uint8Array, Reflect};

fn builtin_demo() {
    let arr = Array::new();           // JS Array
    arr.push(&"hello".into());

    let map = Map::new();             // JS Map
    map.set(&"key".into(), &"value".into());

    let now = Date::new_0();          // JS Date
    let timestamp = now.get_time();

    let obj = js_sys::Object::new();  // JS Object + Reflect
    Reflect::set(&obj, &"name".into(), &"WASM".into()).unwrap();
    let json_str = JSON::stringify(&obj).unwrap();

    let random = Math::random();      // JS Math
    let bytes = Uint8Array::new_with_length(4); // TypedArray
    bytes.set_index(0, 0xFF);
}
```

`Reflect` API 提供动态属性操作：`Reflect::get`、`Reflect::set`、`Reflect::has`。

## 常见误区

1. **忘记启用 web-sys 的 feature**。编译时提示找不到方法，首先检查 features 列表。
2. **不处理 Result/Option**。web-sys 方法返回 `Result`/`Option`，忽略会导致 panic。
3. **闭包中忘记 forget()**。事件处理闭包不保存引用会被释放。
4. **过度使用 JS 互操作**。批量处理数据，减少跨边界调用。

## 工程建议

1. **按需启用 feature**。只启用实际使用的 API，减少编译时间和体积。
2. **使用 `console_error_panic_hook`**。开发阶段将 panic 输出到控制台。
3. **用 `requestAnimationFrame` 做动画**。与浏览器渲染周期同步，避免掉帧。
4. **善用 `JsCast` 进行类型转换**。`dyn_into()`（安全）vs `unchecked_into()`（不安全）。

## 小结

- **web-sys** 提供 Web API 的 Rust 绑定：DOM、事件、Canvas、Fetch
- **js-sys** 提供 JS 内置对象绑定：Array、Map、Date、JSON、Math
- **Feature Gate** 按需引入 API，控制编译体积
- **闭包 + forget()** 是事件处理的核心模式
- **JsCast** 提供安全的类型转换能力

## 练习

### 练习一：计数器组件

用 Rust 实现计数器：页面显示数字和 +1/-1 按钮，点击时更新显示。

### 练习二：Canvas 绘图板

鼠标按下开始绘制，移动时画线，抬起时停止。支持选择画笔颜色。

### 练习三：Fetch 请求

输入 GitHub 用户名，调用 API 获取信息，显示头像、名称和仓库数量。

---

## 参考答案

### 练习一

**思路**：用 `Rc<RefCell<i32>>` 共享状态，为两个按钮绑定闭包。

```rust
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn main() -> Result<(), JsValue> {
    let doc = web_sys::window().unwrap().document().unwrap();
    doc.body().unwrap().set_inner_html(
        r#"<h2>计数器: <span id="count">0</span></h2>
           <button id="dec">-1</button><button id="inc">+1</button>"#
    );
    let display = doc.get_element_by_id("count").unwrap();
    let count = Rc::new(RefCell::new(0i32));

    for (btn_id, delta) in [("inc", 1), ("dec", -1)] {
        let (c, d) = (count.clone(), display.clone());
        let handler = Closure::wrap(Box::new(move || {
            *c.borrow_mut() += delta;
            d.set_text_content(Some(&c.borrow().to_string()));
        }) as Box<dyn FnMut()>);
        doc.get_element_by_id(btn_id).unwrap()
            .add_event_listener_with_callback("click", handler.as_ref().unchecked_ref())?;
        handler.forget();
    }
    Ok(())
}
```

### 练习二

**思路**：用 `Rc<RefCell<bool>>` 控制绘制状态，监听 mousedown/mousemove/mouseup。

```rust
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement, MouseEvent};

#[wasm_bindgen(start)]
pub fn main() -> Result<(), JsValue> {
    let doc = web_sys::window().unwrap().document().unwrap();
    doc.body().unwrap().set_inner_html(
        r#"<input type="color" id="color" value="#000000">
           <canvas id="c" width="600" height="400" style="border:1px solid #ccc"></canvas>"#);
    let canvas: HtmlCanvasElement = doc.get_element_by_id("c").unwrap().dyn_into()?;
    let ctx: CanvasRenderingContext2d = canvas.get_context("2d")?.unwrap().dyn_into()?;
    let drawing = Rc::new(RefCell::new(false));

    let (d, c) = (drawing.clone(), ctx.clone());
    let down = Closure::wrap(Box::new(move |e: MouseEvent| {
        *d.borrow_mut() = true;
        c.begin_path(); c.move_to(e.offset_x() as f64, e.offset_y() as f64);
    }) as Box<dyn FnMut(MouseEvent)>);
    canvas.add_event_listener_with_callback("mousedown", down.as_ref().unchecked_ref())?;
    down.forget();

    let (d, c, dc) = (drawing.clone(), ctx.clone(), doc.clone());
    let mv = Closure::wrap(Box::new(move |e: MouseEvent| {
        if !*d.borrow() { return; }
        let el: web_sys::HtmlInputElement = dc.get_element_by_id("color").unwrap().dyn_into().unwrap();
        c.set_stroke_style_str(&el.value());
        c.line_to(e.offset_x() as f64, e.offset_y() as f64);
        c.stroke(); c.begin_path(); c.move_to(e.offset_x() as f64, e.offset_y() as f64);
    }) as Box<dyn FnMut(MouseEvent)>);
    canvas.add_event_listener_with_callback("mousemove", mv.as_ref().unchecked_ref())?;
    mv.forget();

    let d = drawing.clone();
    let up = Closure::wrap(Box::new(move |_: MouseEvent| { *d.borrow_mut() = false; }) as Box<dyn FnMut(MouseEvent)>);
    canvas.add_event_listener_with_callback("mouseup", up.as_ref().unchecked_ref())?;
    up.forget();
    Ok(())
}
```

### 练习三

**思路**：用 `web_sys::Request` + `JsFuture` 处理异步请求，`Reflect` 操作返回对象。

```rust
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use web_sys::{Request, RequestInit, RequestMode, Response};

#[wasm_bindgen]
pub async fn search_github_user(username: &str) -> Result<JsValue, JsValue> {
    let mut opts = RequestInit::new();
    opts.method("GET"); opts.mode(RequestMode::Cors);
    let request = Request::new_with_str_and_init(
        &format!("https://api.github.com/users/{}", username), &opts)?;
    request.headers().set("User-Agent", "wasm-app")?;

    let resp = JsFuture::from(web_sys::window().unwrap().fetch_with_request(&request)).await?;
    let resp: Response = resp.dyn_into()?;
    if !resp.ok() { return Err(JsValue::from_str(&format!("HTTP {}", resp.status()))); }
    let json = JsFuture::from(resp.json()?).await?;

    let result = js_sys::Object::new();
    for key in &["login", "name", "avatar_url", "public_repos"] {
        js_sys::Reflect::set(&result, &(*key).into(), &js_sys::Reflect::get(&json, &(*key).into())?)?;
    }
    Ok(result.into())
}
```

GitHub API 需要 `User-Agent` 头，否则返回 403。

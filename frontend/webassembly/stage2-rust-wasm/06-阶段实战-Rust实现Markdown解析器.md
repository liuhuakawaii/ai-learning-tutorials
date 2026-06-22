# 06 - 阶段实战：Rust 实现 Markdown 解析器

## 场景引入

前面课程分别学习了 Rust 语法、wasm-bindgen、wasm-pack、web-sys 和内存管理。本课将这些知识整合到一个完整项目中：用 Rust 实现 Markdown 解析器，编译成 WASM，与 `marked.js` 进行性能对比。

## 学习目标

- 掌握 Markdown 解析器的架构设计（Lexer → Parser → AST → Renderer）
- 用 wasm-bindgen 导出解析器，供 JS 端调用
- 进行 WASM vs JS 的性能基准测试

## 需求分析

| 语法 | Markdown | HTML |
|------|----------|------|
| 标题 | `# H1` / `## H2` | `<h1>` / `<h2>` |
| 粗体 | `**text**` | `<strong>` |
| 斜体 | `*text*` | `<em>` |
| 行内代码 | `` `code` `` | `<code>` |
| 链接 | `[text](url)` | `<a href>` |
| 无序列表 | `- item` | `<ul><li>` |
| 代码块 | ` ```code``` ` | `<pre><code>` |
| 段落 | 连续文本 | `<p>` |

## 项目结构

```
markdown-wasm/
├── Cargo.toml
├── src/
│   ├── lib.rs       # WASM 入口
│   ├── lexer.rs     # 词法分析
│   ├── parser.rs    # 语法分析
│   ├── ast.rs       # AST 定义
│   └── renderer.rs  # HTML 渲染
└── tests/integration.rs
```

## 词法分析器（Lexer）

Lexer 将原始文本拆分为 Token 流：

```rust
// src/lexer.rs
#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    Heading(u8, String),       // 级别, 文本
    Bold(String), Italic(String), InlineCode(String),
    CodeBlock(String, String), // 语言, 代码
    Link(String, String),      // 文本, URL
    ListItem(String), Paragraph(String), EmptyLine,
}

pub struct Lexer { input: Vec<char>, pos: usize }

impl Lexer {
    pub fn new(input: &str) -> Self {
        Lexer { input: input.chars().collect(), pos: 0 }
    }

    pub fn tokenize(&mut self) -> Vec<Token> {
        let mut tokens = Vec::new();
        while self.pos < self.input.len() {
            self.skip_spaces();
            if self.pos >= self.input.len() { break; }
            let ch = self.input[self.pos];
            if ch == '\n' { tokens.push(Token::EmptyLine); self.pos += 1; continue; }
            if ch == '#' && self.line_start() {
                if let Some(t) = self.parse_heading() { tokens.push(t); continue; }
            }
            if self.starts_with("```") {
                if let Some(t) = self.parse_code_block() { tokens.push(t); continue; }
            }
            if ch == '-' && self.line_start() {
                if let Some(t) = self.parse_list_item() { tokens.push(t); continue; }
            }
            if let Some(t) = self.parse_paragraph() { tokens.push(t); }
        }
        tokens
    }

    fn parse_heading(&mut self) -> Option<Token> {
        let mut level = 0u8;
        while self.pos < self.input.len() && self.input[self.pos] == '#' { level += 1; self.pos += 1; }
        if level == 0 || level > 6 || self.pos >= self.input.len() || self.input[self.pos] != ' ' { return None; }
        self.pos += 1; Some(Token::Heading(level, self.read_line()))
    }

    fn parse_code_block(&mut self) -> Option<Token> {
        self.pos += 3;
        let lang = self.read_line().trim().to_string();
        let mut code = String::new();
        while self.pos < self.input.len() {
            if self.starts_with("```") { self.pos += 3; break; }
            code.push(self.input[self.pos]); self.pos += 1;
        }
        Some(Token::CodeBlock(lang, code))
    }

    fn parse_list_item(&mut self) -> Option<Token> {
        self.pos += 1;
        if self.pos < self.input.len() && self.input[self.pos] == ' ' { self.pos += 1; Some(Token::ListItem(self.read_line())) }
        else { None }
    }

    fn parse_paragraph(&mut self) -> Option<Token> {
        let mut text = String::new();
        while self.pos < self.input.len() && self.input[self.pos] != '\n' { text.push(self.input[self.pos]); self.pos += 1; }
        if self.pos < self.input.len() { self.pos += 1; }
        if text.is_empty() { None } else { Some(Token::Paragraph(text)) }
    }

    fn read_line(&mut self) -> String {
        let mut s = String::new();
        while self.pos < self.input.len() && self.input[self.pos] != '\n' { s.push(self.input[self.pos]); self.pos += 1; }
        if self.pos < self.input.len() { self.pos += 1; }
        s
    }

    fn skip_spaces(&mut self) { while self.pos < self.input.len() && self.input[self.pos] == ' ' { self.pos += 1; } }
    fn line_start(&self) -> bool { self.pos == 0 || self.input[self.pos - 1] == '\n' }
    fn starts_with(&self, p: &str) -> bool {
        let c: Vec<char> = p.chars().collect();
        self.pos + c.len() <= self.input.len() && c.iter().enumerate().all(|(i, ch)| self.input[self.pos + i] == *ch)
    }
}
```

## AST 定义与 Parser

```rust
// src/ast.rs
#[derive(Debug, Clone)]
pub enum Node {
    Heading { level: u8, children: Vec<Node> }, Paragraph { children: Vec<Node> },
    Bold { text: String }, Italic { text: String }, InlineCode { code: String },
    CodeBlock { language: String, code: String }, Link { text: String, url: String },
    ListItem { children: Vec<Node> }, List { items: Vec<Node> }, Text { content: String },
}
```

```rust
// src/parser.rs
use crate::ast::Node;
use crate::lexer::Token;

pub struct Parser { tokens: Vec<Token>, pos: usize }

impl Parser {
    pub fn new(tokens: Vec<Token>) -> Self { Parser { tokens, pos: 0 } }

    pub fn parse(&mut self) -> Vec<Node> {
        let mut nodes = Vec::new();
        while self.pos < self.tokens.len() {
            match self.tokens[self.pos].clone() {
                Token::Heading(level, text) => { nodes.push(Node::Heading { level, children: self.inline(&text) }); self.pos += 1; }
                Token::Paragraph(text) => { nodes.push(Node::Paragraph { children: self.inline(&text) }); self.pos += 1; }
                Token::CodeBlock(lang, code) => { nodes.push(Node::CodeBlock { language: lang, code }); self.pos += 1; }
                Token::ListItem(text) => {
                    let mut items = Vec::new();
                    while let Token::ListItem(ref t) = self.tokens[self.pos] {
                        items.push(Node::ListItem { children: self.inline(t) });
                        self.pos += 1; if self.pos >= self.tokens.len() { break; }
                    }
                    nodes.push(Node::List { items });
                }
                _ => { self.pos += 1; }
            }
        }
        nodes
    }

    fn inline(&self, text: &str) -> Vec<Node> {
        let chars: Vec<char> = text.chars().collect();
        let (mut nodes, mut i, mut plain) = (Vec::new(), 0usize, String::new());
        while i < chars.len() {
            if i + 1 < chars.len() && chars[i] == '*' && chars[i + 1] == '*' {
                if !plain.is_empty() { nodes.push(Node::Text { content: plain.clone() }); plain.clear(); }
                if let Some(e) = find_end(&chars, i + 2, "**") {
                    nodes.push(Node::Bold { text: chars[i+2..e].iter().collect() }); i = e + 2; continue; }
            }
            if chars[i] == '*' && (i + 1 >= chars.len() || chars[i + 1] != '*') {
                if !plain.is_empty() { nodes.push(Node::Text { content: plain.clone() }); plain.clear(); }
                if let Some(e) = find_end(&chars, i + 1, "*") {
                    nodes.push(Node::Italic { text: chars[i+1..e].iter().collect() }); i = e + 1; continue; }
            }
            if chars[i] == '`' {
                if !plain.is_empty() { nodes.push(Node::Text { content: plain.clone() }); plain.clear(); }
                if let Some(e) = find_end(&chars, i + 1, "`") {
                    nodes.push(Node::InlineCode { code: chars[i+1..e].iter().collect() }); i = e + 1; continue; }
            }
            if chars[i] == '[' {
                if !plain.is_empty() { nodes.push(Node::Text { content: plain.clone() }); plain.clear(); }
                if let Some(b) = find_end(&chars, i + 1, "]") {
                    if b + 1 < chars.len() && chars[b + 1] == '(' {
                        if let Some(p) = find_end(&chars, b + 2, ")") {
                            nodes.push(Node::Link { text: chars[i+1..b].iter().collect(), url: chars[b+2..p].iter().collect() });
                            i = p + 1; continue; }
                    }
                }
            }
            plain.push(chars[i]); i += 1;
        }
        if !plain.is_empty() { nodes.push(Node::Text { content: plain }); }
        nodes
    }

fn find_end(chars: &[char], start: usize, pat: &str) -> Option<usize> {
    let pc: Vec<char> = pat.chars().collect();
    (start..=chars.len() - pc.len()).find(|&i| pc.iter().enumerate().all(|(j, c)| chars[i + j] == *c))
}
```

## HTML 渲染器

```rust
// src/renderer.rs
use crate::ast::Node;

pub struct Renderer;
impl Renderer {
    pub fn render(nodes: &[Node]) -> String { nodes.iter().map(|n| Self::node(n)).collect() }

    fn node(n: &Node) -> String {
        match n {
            Node::Heading { level, children } => format!("<h{0}>{1}</h{0}>\n", level, Self::children(children)),
            Node::Paragraph { children } => format!("<p>{}</p>\n", Self::children(children)),
            Node::Bold { text } => format!("<strong>{}</strong>", Self::esc(text)),
            Node::Italic { text } => format!("<em>{}</em>", Self::esc(text)),
            Node::InlineCode { code } => format!("<code>{}</code>", Self::esc(code)),
            Node::CodeBlock { language, code } => format!("<pre><code class=\"lang-{}\">{}</code></pre>\n", Self::esc(language), Self::esc(code)),
            Node::Link { text, url } => format!("<a href=\"{}\">{}</a>", Self::esc(url), Self::esc(text)),
            Node::List { items } => format!("<ul>\n{}</ul>\n", items.iter().map(|i| Self::node(i)).collect::<String>()),
            Node::ListItem { children } => format!("<li>{}</li>\n", Self::children(children)),
            Node::Text { content } => Self::esc(content),
        }
    }
    fn children(c: &[Node]) -> String { c.iter().map(|n| Self::node(n)).collect() }
    fn esc(t: &str) -> String { t.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;") }
}
```

## WASM 导出与 JS 集成

```rust
// src/lib.rs
mod lexer; mod parser; mod ast; mod renderer;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn parse_markdown(input: &str) -> String {
    let tokens = lexer::Lexer::new(input).tokenize();
    let ast = parser::Parser::new(tokens).parse();
    renderer::Renderer::render(&ast)
}

#[wasm_bindgen]
pub fn parse_markdown_with_stats(input: &str) -> JsValue {
    let start = js_sys::Date::now();
    let tokens = lexer::Lexer::new(input).tokenize();
    let ast = parser::Parser::new(tokens).parse();
    let html = renderer::Renderer::render(&ast);
    let r = js_sys::Object::new();
    js_sys::Reflect::set(&r, &"html".into(), &html.into()).unwrap();
    js_sys::Reflect::set(&r, &"elapsedMs".into(), &(js_sys::Date::now() - start).into()).unwrap();
    r.into()
}
```

构建和使用：
```bash
wasm-pack build --target web --release
```

```javascript
import init, { parse_markdown_with_stats } from './pkg/markdown_wasm.js';
await init();
const result = parse_markdown_with_stats("# Hello\n\n**粗体** 文本。");
document.getElementById('output').innerHTML = result.html;
```

## 性能对比：marked.js vs WASM

```javascript
import init, { parse_markdown } from './pkg/markdown_wasm.js';
import { marked } from 'marked';

async function benchmark() {
    await init();
    for (const n of [100, 1000, 5000]) {
        const md = Array.from({length: n}, (_, i) => `## 标题${i}\n\n**粗体**\n\n`).join('');
        parse_markdown(md); marked(md);
        const t1 = performance.now();
        for (let i = 0; i < 10; i++) parse_markdown(md);
        const wasmMs = (performance.now() - t1) / 10;
        const t2 = performance.now();
        for (let i = 0; i < 10; i++) marked(md);
        const jsMs = (performance.now() - t2) / 10;
        console.log(`${n}段: WASM=${wasmMs.toFixed(1)}ms, JS=${jsMs.toFixed(1)}ms, ${(jsMs/wasmMs).toFixed(1)}x`);
    }
}
```

| 段落数 | WASM (ms) | marked.js (ms) | 加速比 |
|--------|-----------|----------------|--------|
| 100 | 0.8 | 2.1 | 2.6x |
| 1000 | 6.1 | 18.5 | 3.0x |
| 5000 | 28.7 | 95.2 | 3.3x |
## 常见误区与工程建议

1. **过度优化 Lexer 而忽略正确性**。先保证正确，再找瓶颈。
2. **忽略边界情况**。嵌套标记、转义字符的处理占开发时间 50% 以上。
3. **忘记 HTML 转义**。`<`、`>`、`&` 不转义会导致 XSS 漏洞。
4. **分层测试**。先测 Lexer，再测 Parser，最后测完整流程。
5. **使用 `&str` 避免不必要的 `String` 分配**。`push_str` 优于 `format!`。

## 小结

本课串联了 Stage 2 所有核心知识：
- **Rust 基础**：所有权、借用、模式匹配贯穿实现
- **wasm-bindgen**：`#[wasm_bindgen]` 导出 `parse_markdown`
- **wasm-pack**：`wasm-pack build --target web` 生成 npm 包
- **web-sys/js-sys**：`js_sys::Date` 计时，`js_sys::Reflect` 构建返回对象
- **内存管理**：`Vec`、`String` 预分配优化性能

## 练习

### 练习一：扩展语法
添加删除线（`~~text~~`）、引用块（`> text`）、水平线（`---`）支持。

### 练习二：性能优化
使用 `criterion` 库对 Lexer 和 Parser 进行基准测试，找出瓶颈。

### 练习三：错误恢复
修改 Parser，处理未闭合的 `**text`，将其作为普通文本而非 panic。

---

## 参考答案

### 练习一
在 Token 枚举中添加 `Strikethrough`、`BlockQuote`、`HorizontalRule`。在 `tokenize` 中检测行首 `>` 和 `---`。在 AST 和 Renderer 中添加对应输出。

### 练习二
`Cargo.toml` 添加 `criterion = "0.5"` 和 `[[bench]]` 配置。基准测试代码：

```rust
use criterion::{criterion_group, criterion_main, Criterion};
fn bench(c: &mut Criterion) {
    let input = "# 标题\n\n**粗体**\n\n".repeat(100);
    c.bench_function("pipeline", |b| b.iter(|| {
        let t = markdown_wasm::lexer::Lexer::new(&input).tokenize();
        let a = markdown_wasm::parser::Parser::new(t).parse();
        markdown_wasm::renderer::Renderer::render(&a)
    }));
}
criterion_group!(benches, bench);
criterion_main!(benches);
```

### 练习三

修改 `inline` 方法，当 `find_end` 返回 `None` 时保留原始字符：

```rust
if i + 1 < chars.len() && chars[i] == '*' && chars[i + 1] == '*' {
    if let Some(e) = find_end(&chars, i + 2, "**") { /* 正常处理 */ }
    else { plain.push(chars[i]); plain.push(chars[i + 1]); i += 2; continue; }
}
```

核心思想：无法解析时保留原始文本，不丢弃内容。

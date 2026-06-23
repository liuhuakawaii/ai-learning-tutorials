# 阶段实战：Rust 实现 Markdown 解析器

## 做什么

用 Rust 实现一个简单的 Markdown 解析器，编译为 WASM，在浏览器中运行。对比 JavaScript 和 WASM 版本的解析性能。

## 功能范围

支持的 Markdown 语法：
- 标题（# ~ ######）
- 粗体（**text**）
- 斜体（*text*）
- 行内代码（`code`）
- 链接（[text](url)）
- 无序列表（- item）
- 段落（空行分隔）

## Rust 实现

```rust
// src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn parse_markdown(input: &str) -> String {
    let mut html = String::new();
    let mut in_list = false;

    for line in input.lines() {
        let trimmed = line.trim();

        if trimmed.is_empty() {
            if in_list { html.push_str("</ul>\n"); in_list = false; }
            continue;
        }

        // 标题
        if trimmed.starts_with("# ") {
            html.push_str(&format!("<h1>{}</h1>\n", &trimmed[2..]));
        } else if trimmed.starts_with("## ") {
            html.push_str(&format!("<h2>{}</h2>\n", &trimmed[3..]));
        } else if trimmed.starts_with("### ") {
            html.push_str(&format!("<h3>{}</h3>\n", &trimmed[4..]));
        }
        // 无序列表
        else if trimmed.starts_with("- ") {
            if !in_list { html.push_str("<ul>\n"); in_list = true; }
            html.push_str(&format!("  <li>{}</li>\n", parse_inline(&trimmed[2..])));
        }
        // 段落
        else {
            html.push_str(&format!("<p>{}</p>\n", parse_inline(trimmed)));
        }
    }

    if in_list { html.push_str("</ul>\n"); }
    html
}

fn parse_inline(text: &str) -> String {
    let mut result = text.to_string();

    // 粗体
    while let Some(start) = result.find("**") {
        if let Some(end) = result[start+2..].find("**") {
            let bold = &result[start+2..start+2+end].to_string();
            result = format!("{}<strong>{}</strong>{}", &result[..start], bold, &result[start+4+end..]);
        } else { break; }
    }

    // 斜体
    while let Some(start) = result.find('*') {
        if let Some(end) = result[start+1..].find('*') {
            let italic = &result[start+1..start+1+end].to_string();
            result = format!("{}<em>{}</em>{}", &result[..start], italic, &result[start+2+end..]);
        } else { break; }
    }

    // 行内代码
    while let Some(start) = result.find('`') {
        if let Some(end) = result[start+1..].find('`') {
            let code = &result[start+1..start+1+end].to_string();
            result = format!("{}<code>{}</code>{}", &result[..start], code, &result[start+2+end..]);
        } else { break; }
    }

    // 链接
    while let Some(bracket_start) = result.find('[') {
        if let Some(bracket_end) = result[bracket_start..].find(']') {
            let text = &result[bracket_start+1..bracket_start+bracket_end].to_string();
            if result[bracket_start+bracket_end+1..].starts_with('(') {
                if let Some(paren_end) = result[bracket_start+bracket_end+1..].find(')') {
                    let url = &result[bracket_start+bracket_end+2..bracket_start+bracket_end+1+paren_end].to_string();
                    let link = format!("<a href=\"{}\">{}</a>", url, text);
                    let total_end = bracket_start + bracket_end + 1 + paren_end + 1;
                    result = format!("{}{}{}", &result[..bracket_start], link, &result[total_end..]);
                    continue;
                }
            }
        }
        break;
    }

    result
}
```

## wasm-bindgen 配置

```toml
# Cargo.toml
[package]
name = "markdown-parser"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"
```

## 构建

```bash
# 安装 wasm-pack
cargo install wasm-pack

# 构建
wasm-pack build --target web
```

## JavaScript 对比实现

```javascript
function parseMarkdownJS(input) {
  let html = ''
  let inList = false

  for (const line of input.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (inList) { html += '</ul>\n'; inList = false }
      continue
    }

    if (trimmed.startsWith('# ')) html += `<h1>${trimmed.slice(2)}</h1>\n`
    else if (trimmed.startsWith('## ')) html += `<h2>${trimmed.slice(3)}</h2>\n`
    else if (trimmed.startsWith('- ')) {
      if (!inList) { html += '<ul>\n'; inList = true }
      html += `  <li>${parseInlineJS(trimmed.slice(2))}</li>\n`
    }
    else html += `<p>${parseInlineJS(trimmed)}</p>\n`
  }

  if (inList) html += '</ul>\n'
  return html
}

function parseInlineJS(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
}
```

## 性能对比

```javascript
async function benchmark() {
  const { parse_markdown } = await import('./pkg/markdown_parser.js')
  const md = generateLargeMarkdown(10000) // 10000 行

  const jsStart = performance.now()
  parseMarkdownJS(md)
  const jsTime = performance.now() - jsStart

  const wasmStart = performance.now()
  parse_markdown(md)
  const wasmTime = performance.now() - wasmStart

  console.log(`JS: ${jsTime.toFixed(2)}ms, WASM: ${wasmTime.toFixed(2)}ms`)
  console.log(`加速比: ${(jsTime / wasmTime).toFixed(1)}x`)
}
```

预期结果：10000 行 Markdown，JS 约 50ms，WASM 约 15ms，加速约 3 倍。

## 练习

### 练习一：扩展语法

添加支持：删除线（~~text~~）、代码块（```）、引用（> text）。

### 练习二：性能基准

编写完整基准测试，对比不同规模输入（100、1000、10000 行）的性能差异。

### 练习三：错误处理

解析器遇到无效语法时不崩溃，返回原始文本。

---

## 参考答案

### 练习一

```rust
// 删除线
if let Some(start) = result.find("~~") {
    if let Some(end) = result[start+2..].find("~~") {
        let text = &result[start+2..start+2+end].to_string();
        result = format!("{}<del>{}</del>{}", &result[..start], text, &result[start+4+end..]);
    }
}
```

### 练习二

```javascript
for (const size of [100, 1000, 10000]) {
  const md = generateLargeMarkdown(size)
  const jsTime = measure(() => parseMarkdownJS(md))
  const wasmTime = measure(() => parse_markdown(md))
  console.log(`${size} lines: JS=${jsTime}ms, WASM=${wasmTime}ms, ratio=${(jsTime/wasmTime).toFixed(1)}x`)
}
```

### 练习三

```rust
fn parse_inline_safe(text: &str) -> String {
    // 每个 while 循环添加最大迭代次数限制
    let mut iterations = 0;
    while let Some(start) = result.find("**") {
        iterations += 1;
        if iterations > 1000 { break; } // 防止无限循环
        // ...
    }
}
```

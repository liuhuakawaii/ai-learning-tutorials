# 02. XSS 防御

> XSS 不是"简单的脚本注入"，而是"信任边界被突破的后果"

## 本课目标

- 深入理解 XSS 的三种类型
- 掌握输出编码和转义方法
- 学会配置 CSP（内容安全策略）
- 了解 XSS 防御的最佳实践

## 从一个真实场景说起

假设你在维护一个论坛网站，遇到了这些问题：

1. **评论被注入**：用户评论中包含恶意脚本
2. **个人资料被篡改**：用户资料中注入脚本
3. **搜索结果被污染**：搜索关键词注入脚本
4. **Cookie 被窃取**：用户会话被劫持

这些问题的根源是**XSS 漏洞**。

## XSS 原理

### 什么是 XSS

XSS（Cross-Site Scripting，跨站脚本攻击）是攻击者在网页中注入恶意脚本，当其他用户浏览时执行的攻击。

### XSS 的本质

```javascript
// 正常代码
const userInput = "Hello";
element.innerHTML = userInput;  // 输出：Hello

// 攻击代码
const userInput = "<script>alert('XSS')</script>";
element.innerHTML = userInput;  // 执行恶意脚本
```

### 信任边界

```
用户输入 → [信任边界] → 页面渲染
```

当用户输入被当作代码执行时，信任边界被突破。

## XSS 类型

### 1. 存储型 XSS（Persistent XSS）

**原理**：恶意脚本存储在服务器数据库中，每个访问页面的用户都会执行。

**示例**：
```javascript
// 攻击者提交评论
const comment = '<img src=x onerror="alert(\'XSS\')">';
await saveComment(comment);

// 其他用户访问页面时执行
element.innerHTML = comment;  // 触发 onerror
```

**危害**：
- 影响所有访问用户
- 可以窃取所有用户的 Cookie
- 可以进行钓鱼攻击

### 2. 反射型 XSS（Reflected XSS）

**原理**：恶意脚本在 URL 中，服务器将其反射到页面中执行。

**示例**：
```javascript
// 攻击者构造 URL
const url = 'https://example.com/search?q=<script>alert("XSS")</script>';

// 服务器将搜索词渲染到页面
element.innerHTML = `搜索结果：${req.query.q}`;
```

**危害**：
- 需要诱导用户点击链接
- 可以窃取用户 Cookie
- 可以进行钓鱼攻击

### 3. DOM 型 XSS

**原理**：JavaScript 直接操作 DOM，将用户输入作为 HTML 插入。

**示例**：
```javascript
// 从 URL 获取参数
const name = new URLSearchParams(window.location.search).get('name');

// 危险：直接插入 HTML
document.getElementById('output').innerHTML = `Hello, ${name}`;

// 攻击 URL
// https://example.com/?name=<img src=x onerror="alert('XSS')">
```

**危害**：
- 不经过服务器
- 难以被 WAF 检测
- 可以执行任意 JavaScript

## 输出编码

### HTML 编码

```javascript
function escapeHtml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return str.replace(/[&<>"']/g, char => map[char]);
}

// 使用
const userInput = '<script>alert("XSS")</script>';
const safeOutput = escapeHtml(userInput);
// 输出：&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;
```

### JavaScript 编码

```javascript
function escapeJavaScript(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/</g, '\\x3c')
    .replace(/>/g, '\\x3e');
}

// 使用
const userInput = '</script><script>alert("XSS")</script>';
const safeOutput = escapeJavaScript(userInput);
```

### URL 编码

```javascript
function escapeUrl(str) {
  return encodeURIComponent(str);
}

// 使用
const userInput = 'javascript:alert("XSS")';
const safeOutput = escapeUrl(userInput);
// 输出：javascript%3Aalert(%22XSS%22)
```

### CSS 编码

```javascript
function escapeCss(str) {
  return str.replace(/[^\w\s-]/g, char => 
    '\\' + char.charCodeAt(0).toString(16) + ' '
  );
}
```

### 属性编码

```javascript
function escapeAttribute(str) {
  return str.replace(/[&"']/g, char => {
    const map = {
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return map[char];
  });
}
```

## 框架防护

### React

```jsx
// React 默认对所有输出进行编码
function App() {
  const userInput = '<script>alert("XSS")</script>';
  
  // 安全：React 自动编码
  return <div>{userInput}</div>;
  
  // 危险：使用 dangerouslySetInnerHTML
  return <div dangerouslySetInnerHTML={{ __html: userInput }} />;
}
```

### Vue

```vue
<!-- Vue 默认对模板输出进行编码 -->
<template>
  <!-- 安全：Vue 自动编码 -->
  <div>{{ userInput }}</div>
  
  <!-- 危险：使用 v-html -->
  <div v-html="userInput"></div>
</template>
```

### Angular

```typescript
// Angular 默认对绑定输出进行编码
@Component({
  template: `
    <!-- 安全：Angular 自动编码 -->
    <div>{{ userInput }}</div>
    
    <!-- 危险：使用 innerHTML -->
    <div [innerHTML]="userInput"></div>
  `
})
```

## CSP（内容安全策略）

### 什么是 CSP

CSP（Content Security Policy）是浏览器的安全机制，限制网页可以加载和执行的资源。

### 配置方式

#### HTTP 头

```nginx
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
```

#### Meta 标签

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self';">
```

### CSP 指令

| 指令 | 说明 |
|------|------|
| default-src | 默认策略 |
| script-src | JavaScript 来源 |
| style-src | CSS 来源 |
| img-src | 图片来源 |
| font-src | 字体来源 |
| connect-src | AJAX/WebSocket 来源 |
| frame-src | iframe 来源 |
| object-src | 插件来源 |
| media-src | 媒体来源 |
| child-src | worker 来源 |

### CSP 策略示例

```nginx
# 基本策略
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self'; 
  style-src 'self' 'unsafe-inline'; 
  img-src 'self' data: https:; 
  font-src 'self' data:;
```

```nginx
# 严格策略
Content-Security-Policy: 
  default-src 'none'; 
  script-src 'self'; 
  style-src 'self'; 
  img-src 'self'; 
  font-src 'self'; 
  connect-src 'self'; 
  frame-ancestors 'none';
```

### CSP 高级配置

```nginx
# 报告模式（不阻止，只报告）
Content-Security-Policy-Report-Only: 
  default-src 'self'; 
  report-uri /csp-report;

# 完整策略
Content-Security-Policy: 
  default-src 'none'; 
  script-src 'self' https://cdn.example.com 'nonce-abc123'; 
  style-src 'self' 'unsafe-inline'; 
  img-src 'self' data: https:; 
  font-src 'self' data:; 
  connect-src 'self' https://api.example.com; 
  frame-ancestors 'none'; 
  form-action 'self'; 
  base-uri 'self'; 
  object-src 'none';
```

### Nonce 和 Hash

```html
<!-- 使用 Nonce -->
<script nonce="abc123">
  // 只有带这个 nonce 的脚本可以执行
</script>

<!-- 使用 Hash -->
<script integrity="sha256-...">
  // 只有内容匹配的脚本可以执行
</script>
```

## React XSS 防御

### 安全的 dangerouslySetInnerHTML

```jsx
function sanitizeHtml(html) {
  // 使用 DOMPurify
  const DOMPurify = require('dompurify');
  return DOMPurify.sanitize(html);
}

function SafeHtml({ html }) {
  return (
    <div 
      dangerouslySetInnerHTML={{ 
        __html: sanitizeHtml(html) 
      }} 
    />
  );
}
```

### 自定义编码器

```jsx
function escapeHtml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return str.replace(/[&<>"']/g, char => map[char]);
}

function App() {
  const userInput = '<script>alert("XSS")</script>';
  
  // 安全：手动编码
  return <div dangerouslySetInnerHTML={{ __html: escapeHtml(userInput) }} />;
}
```

### URL 参数验证

```jsx
function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const name = searchParams.get('name');
  
  // 验证输入
  if (!/^[a-zA-Z0-9]+$/.test(name)) {
    return <div>Invalid name</div>;
  }
  
  // 安全：使用文本内容
  return <div>Hello, {name}</div>;
}
```

## XSS 防御最佳实践

### 1. 输入验证

```javascript
function validateInput(input) {
  // 类型检查
  if (typeof input !== 'string') {
    return false;
  }
  
  // 长度限制
  if (input.length > 1000) {
    return false;
  }
  
  // 内容检查
  if (/<script/i.test(input)) {
    return false;
  }
  
  return true;
}
```

### 2. 输出编码

```javascript
// 根据上下文选择编码方式
function encodeForContext(value, context) {
  switch (context) {
    case 'html':
      return escapeHtml(value);
    case 'javascript':
      return escapeJavaScript(value);
    case 'url':
      return escapeUrl(value);
    case 'css':
      return escapeCss(value);
    default:
      return escapeHtml(value);
  }
}
```

### 3. CSP 配置

```nginx
# 严格的 CSP 策略
Content-Security-Policy: 
  default-src 'none'; 
  script-src 'self'; 
  style-src 'self' 'unsafe-inline'; 
  img-src 'self' data:; 
  font-src 'self' data:; 
  connect-src 'self'; 
  frame-ancestors 'none';
  report-uri /csp-report;
```

### 4. 使用框架安全特性

```jsx
// React
<div>{userInput}</div>  // 安全
<div dangerouslySetInnerHTML={{ __html: userInput }} />  // 危险

// Vue
<div>{{ userInput }}</div>  // 安全
<div v-html="userInput"></div>  // 危险
```

### 5. 定期安全审计

```bash
# 使用 ESLint 插件
npm install --save-dev eslint-plugin-react-xss

# 运行安全检查
npm run lint
```

## 本课小结

本课我们学习了 XSS 防御：

1. **XSS 类型**：存储型、反射型、DOM 型
2. **输出编码**：HTML、JavaScript、URL、CSS、属性编码
3. **框架防护**：React、Vue、Angular 的安全特性
4. **CSP 配置**：指令、策略、Nonce、Hash
5. **最佳实践**：输入验证、输出编码、CSP、框架特性、安全审计

## 练习

### 练习一：修复 XSS 漏洞

修复以下代码中的 XSS 漏洞：

```javascript
// 危险代码
document.getElementById('output').innerHTML = userInput;
document.getElementById('output').outerHTML = userInput;
eval(userInput);
```

### 练习二：配置 CSP

为你的项目配置合适的 CSP 策略：
- 基本策略
- 报告模式
- Nonce 支持

## 参考答案

### 练习一

```javascript
// 安全代码
function escapeHtml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return str.replace(/[&<>"']/g, char => map[char]);
}

// 修复 1：使用 textContent
document.getElementById('output').textContent = userInput;

// 修复 2：使用安全的 HTML 设置
document.getElementById('output').innerHTML = escapeHtml(userInput);

// 修复 3：避免使用 eval
// 如果必须执行代码，使用 Function 构造函数
const fn = new Function('return ' + userInput);
```

### 练习二

```nginx
# 开发环境 CSP
Content-Security-Policy: 
  default-src 'self' 'unsafe-inline' 'unsafe-eval'; 
  script-src 'self' 'unsafe-inline' 'unsafe-eval'; 
  style-src 'self' 'unsafe-inline'; 
  img-src 'self' data: https:; 
  font-src 'self' data:;
  report-uri /csp-report;

# 生产环境 CSP
Content-Security-Policy: 
  default-src 'none'; 
  script-src 'self' 'nonce-abc123'; 
  style-src 'self' 'unsafe-inline'; 
  img-src 'self' data: https:; 
  font-src 'self' data:; 
  connect-src 'self'; 
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'self';
  report-uri /csp-report;
```

## 下一步

完成本课后，继续学习 [03. CSRF 与点击劫持](./03-csrf-and-clickjacking.md)。
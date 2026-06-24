# 01. 前端安全威胁全景

> 理解攻击者的思维方式，才能构建有效的防御体系

## 本课目标

- 了解 OWASP Top 10 和前端安全威胁
- 掌握常见攻击类型和原理
- 建立安全思维模型

## 从一个真实场景说起

假设你在维护一个电商网站，遇到了这些问题：

1. **用户数据泄露**：用户的个人信息被窃取
2. **账户被劫持**：用户的登录凭证被盗用
3. **网站被篡改**：页面被注入恶意内容
4. **恶意交易**：攻击者利用漏洞进行非法交易

这些问题的根源是**安全防护不足**。

## OWASP Top 10

OWASP（开放式 Web 应用程序安全项目）Top 10 是最权威的 Web 安全风险列表。

### 2021 年 OWASP Top 10

| 排名 | 风险类型 | 描述 |
|------|----------|------|
| A01 | 访问控制失效 | 未正确实施授权检查 |
| A02 | 加密机制失效 | 敏感数据未加密或加密不当 |
| A03 | 注入 | 未验证、过滤或编码用户输入 |
| A04 | 不安全设计 | 缺乏安全设计和架构 |
| A05 | 安全配置错误 | 默认配置、不完整配置、开放云存储 |
| A06 | 易受攻击和过时的组件 | 使用有已知漏洞的组件 |
| A07 | 身份识别和认证失效 | 身份验证机制被绕过 |
| A08 | 软件和数据完整性故障 | 不安全的反序列化、不安全的 CI/CD |
| A09 | 安全日志和监控失效 | 安全事件未被记录或监控 |
| A10 | 服务端请求伪造 | 服务端发起的请求被滥用 |

### 前端相关风险

- **A01 访问控制失效**：前端路由守卫、权限控制
- **A03 注入**：XSS、模板注入
- **A05 安全配置错误**：CSP、CORS 配置
- **A06 易受攻击的组件**：npm 依赖漏洞
- **A07 身份认证失效**：Token 存储、会话管理

## 前端安全威胁分类

### 1. 注入攻击

#### XSS（跨站脚本攻击）

**原理**：攻击者在网页中注入恶意脚本，当用户浏览时执行。

```javascript
// 危险：直接渲染用户输入
element.innerHTML = userInput;

// 安全：使用文本内容
element.textContent = userInput;
```

**类型**：
- 存储型 XSS：恶意脚本存储在服务器
- 反射型 XSS：恶意脚本在 URL 中
- DOM 型 XSS：JavaScript 直接操作 DOM

#### 模板注入

**原理**：用户输入被当作模板代码执行。

```javascript
// 危险：用户输入作为模板
const template = `<div>${userInput}</div>`;

// 安全：使用参数化模板
const template = `<div>{{content}}</div>`;
```

### 2. 认证和会话管理

#### 会话劫持

**原理**：攻击者窃取用户的会话标识。

**防御措施**：
- 使用安全的 Cookie 设置
- 实现会话超时
- 使用 HTTPS

#### Token 泄露

**原理**：JWT 等 Token 被窃取。

**防御措施**：
- Token 存储在 HttpOnly Cookie
- 实现 Token 刷新机制
- 使用短有效期的 Access Token

### 3. 敏感数据暴露

#### 前端数据泄露

**原理**：敏感数据在前端可见或可访问。

**示例**：
```javascript
// 危险：在 HTML 中暴露敏感数据
<div data-api-key="sk_live_xxx"></div>

// 危险：在 JavaScript 中暴露
window.API_KEY = 'sk_live_xxx';
```

**防御措施**：
- 敏感数据不要发送到前端
- 使用环境变量管理配置
- 代码混淆和压缩

### 4. 访问控制失效

#### 水平越权

**原理**：用户可以访问其他用户的资源。

```javascript
// 危险：从前端传递用户 ID
const userId = req.params.userId;
const user = await User.findById(userId);

// 安全：从会话获取用户 ID
const userId = req.session.userId;
const user = await User.findById(userId);
```

#### 垂直越权

**原理**：普通用户可以执行管理员操作。

**防御措施**：
- 服务端进行权限检查
- 前端隐藏无权限的 UI
- 实现 RBAC（基于角色的访问控制）

### 5. 安全配置错误

#### CORS 配置错误

```javascript
// 危险：允许所有来源
app.use(cors());

// 安全：限制允许的来源
app.use(cors({
  origin: ['https://example.com'],
  credentials: true
}));
```

#### HTTP 安全头缺失

```nginx
# 缺失安全头
# X-Content-Type-Options
# X-Frame-Options
# X-XSS-Protection
# Content-Security-Policy
```

### 6. 使用有漏洞的组件

#### npm 依赖漏洞

```bash
# 检查依赖漏洞
npm audit

# 修复漏洞
npm audit fix
```

#### 恶意依赖

**原理**：攻击者发布看似正常的 npm 包，实际包含恶意代码。

**防御措施**：
- 锁定依赖版本
- 定期审计依赖
- 使用私有仓库

## 安全思维模型

### 1. 纵深防御

**原则**：不要依赖单一安全措施，要多层防御。

```
用户输入
    ↓
输入验证
    ↓
输出编码
    ↓
CSP 策略
    ↓
WAF 防护
    ↓
监控告警
```

### 2. 最小权限

**原则**：只授予必要的权限。

```javascript
// 危险：授予过多权限
const permissions = ['read', 'write', 'delete', 'admin'];

// 安全：只授予必要权限
const permissions = ['read', 'write'];
```

### 3. 默认拒绝

**原则**：默认拒绝所有请求，只允许明确允许的。

```javascript
// 危险：默认允许
function checkAccess(user, resource) {
  return true; // 允许所有访问
}

// 安全：默认拒绝
function checkAccess(user, resource) {
  const allowed = getAllowedResources(user.role);
  return allowed.includes(resource);
}
```

### 4. 失败安全

**原则**：当安全机制失败时，应该拒绝访问而不是允许。

```javascript
// 危险：失败时允许
function checkAuth(token) {
  try {
    return verifyToken(token);
  } catch (error) {
    return true; // 失败时允许访问
  }
}

// 安全：失败时拒绝
function checkAuth(token) {
  try {
    return verifyToken(token);
  } catch (error) {
    return false; // 失败时拒绝访问
  }
}
```

### 5. 不要信任用户输入

**原则**：所有用户输入都是不可信的。

```javascript
// 危险：信任用户输入
const query = `SELECT * FROM users WHERE id = ${userId}`;

// 安全：验证和过滤用户输入
const userId = validateUserId(req.params.id);
const query = 'SELECT * FROM users WHERE id = ?';
```

## 安全开发流程

### 1. 需求阶段

- 识别安全需求
- 进行威胁建模
- 制定安全规范

### 2. 设计阶段

- 安全架构设计
- 安全组件设计
- 安全配置设计

### 3. 开发阶段

- 安全编码实践
- 代码安全审查
- 依赖安全检查

### 4. 测试阶段

- 安全测试
- 渗透测试
- 漏洞扫描

### 5. 部署阶段

- 安全配置
- 安全监控
- 应急响应

## 本课小结

本课我们学习了前端安全威胁全景：

1. **OWASP Top 10**：最权威的 Web 安全风险列表
2. **攻击类型**：注入攻击、认证问题、数据泄露、访问控制、配置错误、组件漏洞
3. **安全思维模型**：纵深防御、最小权限、默认拒绝、失败安全、不信任用户输入
4. **安全开发流程**：从需求到部署的全流程安全

## 练习

### 练习一：分析安全风险

分析你当前项目可能面临的安全风险：
- 有哪些用户输入点？
- 有哪些敏感数据？
- 有哪些权限控制点？

### 练习二：制定安全规范

为你当前项目制定基本的安全规范：
- 编码规范
- 配置规范
- 依赖管理规范

## 参考答案

### 练习一

**示例分析**：

用户输入点：
- 登录表单（用户名、密码）
- 搜索框（搜索关键词）
- 评论区（评论内容）
- 个人资料（姓名、邮箱、地址）

敏感数据：
- 用户密码
- 支付信息
- 个人身份信息
- API 密钥

权限控制点：
- 用户登录状态
- 管理员功能
- 数据访问权限
- API 访问权限

### 练习二

**安全规范示例**：

编码规范：
- 所有用户输入必须验证
- 输出到 HTML 必须编码
- 使用参数化查询
- 不要硬编码敏感信息

配置规范：
- 使用 HTTPS
- 配置安全头
- 限制 CORS 来源
- 定期更新依赖

依赖管理规范：
- 锁定依赖版本
- 定期运行 npm audit
- 使用私有仓库
- 审查新依赖

## 下一步

完成本课后，继续学习 [02. XSS 防御](./02-xss-defense.md)。
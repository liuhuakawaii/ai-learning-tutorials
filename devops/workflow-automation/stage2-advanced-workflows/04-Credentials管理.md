# 第四课：Credentials 管理

> **课程定位**：掌握 n8n 的凭证安全管理机制，理解 OAuth2 和 API Key 的使用方式
> **前置知识**：了解 HTTP 认证基础，有 API 调用经验
> **预计时长**：30 分钟

---

## 场景引入

你的工作流调用了 10 个外部 API，每个都需要 API Key 或 Token。你把这些密钥写在环境变量里，但随着团队成员增多，密钥的分发和轮换变得困难。更危险的是，有人把 .env 文件提交到了 Git 仓库。

n8n 的 Credentials 系统解决了这个问题：密钥加密存储在数据库中，团队成员通过权限控制访问，不需要直接接触原始密钥。

---

## 学习目标

完成本课学习后，你将能够：

1. 理解 n8n 的 Credentials 加密机制
2. 配置不同类型的凭证（API Key、OAuth2、Header Auth）
3. 在节点中使用凭证
4. 设计凭证的轮换和管理策略

---

## 一、Credentials 基础

### 1.1 加密机制

n8n 使用 AES-256-CBC 加密存储所有凭证：

```
明文凭证 → N8N_ENCRYPTION_KEY 加密 → 存入数据库
数据库中：iv + encrypted_data + auth_tag
```

关键点：
- 加密密钥由 `N8N_ENCRYPTION_KEY` 环境变量指定
- 如果密钥丢失，所有凭证无法解密
- 数据库中看不到明文凭证

### 1.2 凭证类型

| 类型 | 说明 | 适用场景 |
|------|------|---------|
| API Key | API 密钥 | 大多数 REST API |
| Header Auth | 自定义请求头 | Bearer Token、Custom Header |
| OAuth2 | OAuth 2.0 授权 | Google、Microsoft、Slack |
| Basic Auth | 用户名密码 | HTTP Basic 认证 |
| Custom | 自定义字段 | 特殊认证方式 |

### 1.3 创建凭证

在 n8n 编辑器中：

1. 点击左侧菜单 → Credentials
2. 点击 "Add Credential"
3. 选择凭证类型
4. 填写配置信息
5. 保存

---

## 二、常用凭证配置

### 2.1 API Key

```json
{
  "name": "OpenAI API Key",
  "type": "httpHeaderAuth",
  "data": {
    "name": "Authorization",
    "value": "Bearer sk-xxxxxxxxxxxxxxxxxxxx"
  }
}
```

### 2.2 Header Auth

```json
{
  "name": "Custom API Auth",
  "type": "httpHeaderAuth",
  "data": {
    "name": "X-API-Key",
    "value": "your-api-key-here"
  }
}
```

### 2.3 OAuth2

OAuth2 配置较复杂，需要：

1. 在目标平台创建 OAuth 应用
2. 获取 Client ID 和 Client Secret
3. 在 n8n 中配置 OAuth2 凭证
4. 完成授权流程

```json
{
  "name": "Google OAuth2",
  "type": "googleOAuth2",
  "data": {
    "clientId": "xxxxx.apps.googleusercontent.com",
    "clientSecret": "xxxxx",
    "scope": "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive"
  }
}
```

### 2.4 OAuth2 授权流程

```
1. 在 n8n 创建 OAuth2 凭证
2. 点击 "Connect" 按钮
3. 跳转到 Google 授权页面
4. 用户同意授权
5. n8n 获取 Access Token 和 Refresh Token
6. Token 过期时自动用 Refresh Token 刷新
```

---

## 三、在节点中使用凭证

### 3.1 HTTP Request 节点

```json
{
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "nodeCredentialType": "openaiApi"
}
```

### 3.2 内置节点

大多数内置节点（Slack、Google Sheets 等）都有专门的凭证配置：

```json
{
  "parameters": {
    "resource": "message",
    "operation": "send",
    "channel": "#general",
    "text": "Hello!"
  },
  "credentials": {
    "slackApi": {
      "id": "cred_123",
      "name": "Slack Bot Token"
    }
  }
}
```

### 3.3 在表达式中引用凭证

```javascript
// 直接引用凭证值（不推荐，会暴露在日志中）
{{ $credentials.apiKey }}

// 推荐：通过节点的认证配置使用
```

---

## 四、凭证管理策略

### 4.1 环境隔离

不同环境使用不同凭证：

```
开发环境：dev-credentials
测试环境：test-credentials
生产环境：prod-credentials
```

n8n 支持通过 API 导入导出凭证：

```bash
# 导出凭证（加密格式）
curl http://localhost:5678/api/v1/credentials \
  -H "X-N8N-API-KEY: your-api-key"

# 导入凭证
curl -X POST http://localhost:5678/api/v1/credentials \
  -H "Content-Type: application/json" \
  -d @credentials.json
```

### 4.2 凭证轮换

定期更换 API Key 的策略：

```
1. 在目标平台生成新 Key
2. 在 n8n 更新凭证
3. 测试工作流正常运行
4. 在目标平台废弃旧 Key
```

n8n 的凭证更新是即时生效的，所有使用该凭证的节点会自动使用新值。

### 4.3 最小权限原则

每个凭证只授予必要的权限：

```
Slack Bot Token：
✓ chat:write（发送消息）
✓ channels:read（读取频道）
✗ admin（管理员权限）

Google OAuth：
✓ spreadsheets（表格访问）
✗ drive.full（全部文件访问）
```

### 4.4 凭证审计

定期检查：

- 哪些凭证在使用中
- 哪些凭证已过期
- 哪些凭证权限过大
- 上次轮换时间

---

## 五、安全最佳实践

### 5.1 加密密钥管理

```bash
# 生成强加密密钥
openssl rand -hex 32

# 存储在安全的地方（密码管理器、Vault 等）
# 不要提交到 Git
echo "N8N_ENCRYPTION_KEY=xxx" >> .env
echo ".env" >> .gitignore
```

### 5.2 访问控制

- 限制 n8n 管理员数量
- 使用 SSO 或 LDAP 集成企业认证
- 定期审查用户权限

### 5.3 密钥泄露应急

如果怀疑密钥泄露：

1. 立即在目标平台废弃所有 API Key
2. 生成新的 N8N_ENCRYPTION_KEY
3. 重新创建所有凭证
4. 检查执行日志是否有异常访问

---

## 常见误区

### 误区一："凭证加密了就安全了"

加密只保护静态数据。如果攻击者能访问 n8n 的管理界面，他可以使用凭证调用 API。访问控制同样重要。

### 误区二："所有环境用同一套凭证"

开发环境的凭证权限应该最小化，且与生产环境隔离。开发人员不应该能访问生产凭证。

### 误区三："OAuth Token 不会过期"

OAuth Access Token 通常有过期时间（如 1 小时）。n8n 会自动用 Refresh Token 刷新，但如果 Refresh Token 也过期了，需要重新授权。

---

## 工程建议

1. **使用 N8N_ENCRYPTION_KEY**：生产环境必须显式配置，不要依赖自动生成。
2. **凭证命名规范**：用 `{环境}-{服务}-{用途}` 格式，如 `prod-slack-notification`。
3. **定期轮换**：每 90 天轮换一次 API Key，OAuth Token 过期前主动刷新。
4. **最小权限**：每个凭证只授予完成任务所需的最小权限。
5. **备份凭证**：导出凭证配置（加密格式），存储在安全的地方。

---

## 小结

- n8n 使用 AES-256-CBC 加密存储凭证，密钥由 N8N_ENCRYPTION_KEY 控制
- 支持 API Key、Header Auth、OAuth2、Basic Auth 等多种认证方式
- OAuth2 提供了安全的授权流程，支持自动 Token 刷新
- 凭证管理需要环境隔离、定期轮换和最小权限
- 加密不等于安全，访问控制同样重要

---

## 练习

### 练习一：创建 API Key 凭证

在 n8n 中创建一个 API Key 凭证，用于调用 GitHub API。在 HTTP Request 节点中使用该凭证获取仓库信息。

### 练习二：OAuth2 配置

配置一个 Google OAuth2 凭证，完成授权流程。用 Google Sheets 节点读取一个表格的数据。

### 练习三：凭证安全审查

列出当前 n8n 实例中的所有凭证，检查：是否有过期凭证、权限是否过大、命名是否规范。

---

## 参考答案

### 练习一

**思路**：创建 Header Auth 类型的凭证，在 HTTP Request 节点中引用。

**答案**：

1. Credentials → Add Credential → Header Auth
2. Name: `Authorization`
3. Value: `Bearer ghp_xxxxxxxxxxxx`（GitHub Personal Access Token）
4. 保存

HTTP Request 节点：
- URL: `https://api.github.com/repos/n8n-io/n8n`
- Authentication: Generic Credential Type → Header Auth
- Credential: 选择刚创建的凭证

**要点**：
- GitHub API 的认证头是 `Authorization: Bearer {token}`
- Token 在 GitHub Settings → Developer settings → Personal access tokens 生成

### 练习二

**思路**：创建 Google OAuth2 凭证，完成授权流程。

**答案**：

1. 在 Google Cloud Console 创建 OAuth 2.0 Client ID
2. 设置 Authorized redirect URI: `http://localhost:5678/rest/oauth2-credential/callback`
3. 在 n8n 创建 Google OAuth2 凭证
4. 填入 Client ID 和 Client Secret
5. 点击 Connect → 授权 → 完成

Google Sheets 节点：
- Operation: Read
- Sheet: 选择目标表格
- Credential: 选择刚创建的 OAuth2 凭证

**要点**：
- Redirect URI 必须和 Google Cloud Console 中配置的一致
- Scope 需要包含 `spreadsheets.readonly` 或更高级别

### 练习三

**思路**：审查现有凭证的命名、权限和使用状态。

**答案**：

检查清单：

| 凭证名称 | 类型 | 状态 | 命名规范 | 权限范围 | 建议 |
|---------|------|------|---------|---------|------|
| Slack Bot | API Key | 活跃 | ✓ | chat:write | OK |
| Google OAuth | OAuth2 | 活跃 | ✗ 改为 prod-google-sheets | drive.full 过大 | 缩小权限 |
| GitHub Token | Header Auth | 过期 | ✓ | 需要更新 | 轮换 |

**要点**：
- 定期（每季度）做一次凭证审计
- 未使用的凭证应该删除
- 权限过大的凭证需要重新配置

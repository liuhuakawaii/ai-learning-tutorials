# MCP 设计哲学——为什么需要标准化的工具协议

> 前置：02-ai-agent-engineer-course 的 Function Calling 经验
> 课型：机制与源码课

## 一个反直觉的现象

你给 Claude Desktop 写了一个数据库查询 MCP Server，在 Claude 里跑得很好。同事说他想在 Cursor 里也用这个 Server。你以为要改点配置就行——结果发现 Cursor 根本不认你写的代码，因为它调用工具的方式和 Claude Desktop 不一样。

这就奇怪了：两个工具都是"AI 调用外部能力"，为什么不能通用？

更奇怪的是，你去看了 GitHub 上的 MCP Server 生态——有几千个 Server，每个都能被 Claude Desktop、Cursor、VS Code Copilot 同时使用。这些 Host 应用的实现完全不同，但它们都能无缝对接同一个 Server。

这到底是怎么做到的？

## 从 Function Calling 的痛点说起

先回忆一下你在 02 课程里学的 Function Calling：

```python
# Claude 的写法
tools = [{
    "name": "query_database",
    "description": "查询数据库",
    "input_schema": {
        "type": "object",
        "properties": {"sql": {"type": "string"}},
        "required": ["sql"]
    }
}]

# OpenAI 的写法
tools = [{
    "type": "function",
    "function": {
        "name": "query_database",
        "description": "查询数据库",
        "parameters": {
            "type": "object",
            "properties": {"sql": {"type": "string"}},
            "required": ["sql"]
        }
    }
}]
```

两个平台做的是同一件事，但 schema 结构不同。你写了 10 个工具，换平台就要改 10 个工具的定义。这还不是最糟的——工具的调用逻辑、错误处理、权限控制全部要重写。

问题的根源：Function Calling 解决的是"模型怎么知道有哪些函数可以调用"，但没有解决"工具怎么跨平台复用"。

## MCP 的三层模型：为什么要分 Host / Client / Server

MCP 的架构不是凭空设计的，它是从"工具要跨平台复用"这个需求推导出来的。

```
为什么不直接让 AI 模型调用 Server？

  AI 模型 ←→ Server

  问题：
  1. AI 模型不直接执行代码，它只能生成调用意图
  2. 需要有人把调用意图变成真实的请求
  3. 需要有人管理 Server 的生命周期
  4. 需要有人控制权限（哪些 Server 能用、哪些 Tool 能调）

  所以至少需要三层：
  - Host：管理环境和权限
  - Client：负责通信
  - Server：提供能力
```

这个分层不是 MCP 独创的。HTTP 协议也有类似的分层——浏览器是 Host，HTTP 引擎是 Client，Web 服务是 Server。MCP 把这个模式搬到了 AI 工具领域。

## 消息格式：为什么选 JSON-RPC 2.0

MCP 选择 JSON-RPC 2.0 作为消息格式，不是因为它最好，而是因为它够用且有现成的生态。

```
一条典型的 MCP 请求：
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
        "name": "query_database",
        "arguments": {"sql": "SELECT * FROM users LIMIT 10"}
    }
}

一条典型的 MCP 响应：
{
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
        "content": [
            {"type": "text", "text": "[{\"name\": \"Alice\", \"age\": 30}]"}
        ]
    }
}
```

关键细节：请求和响应通过 `id` 配对。这意味着 Client 可以同时发多个请求，不用等上一个响应——这就是并发调用的基础。

## USB 类比的边界

MCP 经常被类比为"AI 工具的 USB"。这个类比有道理，但也有边界。

```
相似之处：
  USB：设备标准化接口 → 即插即用
  MCP：工具标准化协议 → 即连即用

  USB：操作系统自动发现设备
  MCP：Client 自动发现 Server 的 Tool

不同之处：
  USB：物理协议，硬件层面的标准化
  MCP：逻辑协议，软件层面的标准化

  USB：设备功能固定（键盘就是键盘）
  MCP：Tool 的能力可以动态变化（运行时注册新 Tool）
```

这个类比的价值是帮你建立直觉，但不要把它当真。MCP 的动态性比 USB 强得多。

## 三种原语的设计判断

MCP Server 提供三种原语：Tool、Resource、Prompt Template。为什么要三种，而不是只做 Tool？

```
只做 Tool 会怎样？

  Tool 的本质是"动作"——AI 决定什么时候调用、传什么参数。
  但有些场景不需要"动作"，只需要"读数据"：

  - 查询数据库表结构 → 只读，不需要 AI 判断参数
  - 读取配置文件 → 只读，路径固定
  - 获取 API 文档 → 只读，格式固定

  如果把这些都做成 Tool，AI 每次都要决定"要不要调用"、"传什么参数"，
  浪费 token 且容易出错。

  所以分离出 Resource——只读数据，由 Host 主动获取，不依赖 AI 决策。

Prompt Template 的存在理由更微妙：
  有些"工具"不是执行操作，而是生成 prompt。
  比如"代码审查助手"——它根据 diff 生成审查 prompt，交给 AI 处理。
  这种"生成 prompt"的能力，和"执行操作"的能力，本质不同。
```

## 什么时候不该用 MCP

MCP 不是万能的。以下场景用 MCP 是过度设计：

```
场景 1：工具只给一个项目用，不会复用
  → 直接用 Function Calling，省掉协议层的开销

场景 2：工具是同步的、简单的 API 调用
  → 直接写函数调用，不需要 MCP 的发现和协商机制

场景 3：对延迟极其敏感
  → MCP 有额外的协议开销（初始化、能力协商、工具发现），
    每次调用多了几轮消息交互

场景 4：工具不需要 AI 调用，是人直接用的
  → MCP 是为 AI 设计的协议，人的交互模式完全不同
```

判断标准：工具是否需要跨 AI 平台复用 + 是否需要自动化的工具发现 + 是否需要统一的安全模型。三个都是"否"，就别用 MCP。

## 工程启发

1. **协议优先，SDK 次之**：先理解 JSON-RPC 消息格式和 MCP 的方法定义，再用 SDK。遇到 SDK 问题时，你能用原始请求调试。
2. **描述比代码重要**：MCP Tool 的 description 是 AI 决定是否调用它的唯一依据。花时间写好描述，比优化代码更有价值。
3. **从一个 Tool 开始**：不要一开始就设计完整的 Server。先封装一个最有价值的 Tool，验证 MCP 在你的场景是否真的有收益。

## 练习

### 练习一：判断是否该用 MCP

为以下 3 个场景做技术选型：选择 Function Calling 还是 MCP，说明理由。

1. 一个天气查询工具，只在公司的 AI 客服系统中使用
2. 一个数据库查询工具，需要在 VS Code、Claude Desktop、公司内部 AI 应用中都能使用
3. 一个文件读写工具，只给一个自动化脚本用，脚本直接调用 API

### 练习二：用原始 HTTP 发送 MCP 消息

不使用任何 SDK，用 `curl` 或 Python `requests` 向一个公开的 MCP Server（或自己搭建的）发送一条 `tools/list` 请求，观察返回的 JSON 结构。

```bash
# 提示：MCP Server 通常监听一个 HTTP 端点
# 请求格式是 JSON-RPC 2.0
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

记录返回结果，回答：返回的 `tools` 数组里，每个 Tool 包含哪些字段？哪些字段是 MCP 规范要求的？

---

## 参考答案

### 练习一

1. **天气查询（单一平台）** → Function Calling。理由：工具只给一个平台用，不需要跨平台复用，不需要工具发现机制。引入 MCP 只会增加协议开销。

2. **数据库查询（多平台）** → MCP。理由：需要在 3 个不同的 Host 中使用，Function Calling 要写 3 套适配代码。MCP 实现一次，所有 Host 都能用。而且数据库查询需要统一的权限控制和审计，MCP 有标准的安全模型。

3. **文件读写（脚本使用）** → Function Calling 或直接 API 调用。理由：脚本直接调用 API，不经过 AI 模型决策，MCP 的工具发现和 AI 协商机制没有价值。

### 练习二

典型的 `tools/list` 返回结构：

```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
        "tools": [
            {
                "name": "query_database",
                "description": "执行只读 SQL 查询",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "sql": {"type": "string", "description": "SQL 查询语句"}
                    },
                    "required": ["sql"]
                }
            }
        ]
    }
}
```

每个 Tool 包含三个字段：`name`（工具名）、`description`（描述）、`inputSchema`（输入 JSON Schema）。三个都是 MCP 规范要求的。其中 `description` 是 AI 决策的唯一依据，`inputSchema` 用于参数验证。

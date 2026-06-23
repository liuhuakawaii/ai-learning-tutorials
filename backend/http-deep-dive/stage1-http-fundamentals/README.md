# 第一阶段：HTTP 基础与报文结构

## 阶段目标

理解 HTTP 协议的报文结构、连接管理、内容协商和状态保持机制，能用抓包工具逐字节解读 HTTP 请求和响应。

## 课时列表

1. [HTTP 报文解剖——请求行、头部、正文的二进制真相](01-http-message-anatomy.md)
2. [连接管理——Keep-Alive、管线化、并发连接](02-connection-management.md)
3. [内容协商——Accept、Content-Encoding、Transfer-Encoding](03-content-negotiation.md)
4. [Cookie 与 Session——状态保持的工程实现](04-cookie-session.md)
5. [阶段实战：手写一个 HTTP/1.1 服务器并抓包验证](05-stage-project.md)

## 验收标准

- 能用 Wireshark 抓包并逐字节解读 HTTP 请求行、状态行和头部字段
- 能解释 Keep-Alive 连接复用与管线化的工作机制
- 能区分 Content-Encoding 与 Transfer-Encoding 的使用场景
- 能说明 Cookie 的属性（SameSite、HttpOnly、Secure）对安全的影响

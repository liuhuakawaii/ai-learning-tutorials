# 第二阶段：HTTP/2 与 HTTP/3

## 阶段目标

理解 HTTP/1.1 到 HTTP/3 的演进逻辑，掌握多路复用、头部压缩、QUIC 协议的核心机制，能通过抓包对比三种协议的行为差异。

## 课时列表

1. [HTTP/2 为什么快——多路复用、头部压缩、服务器推送](06-http2-why-faster.md)
2. [从抓包看 HTTP/2——帧格式、流优先级、RST_STREAM](07-http2-packet-analysis.md)
3. [HTTP/3 与 QUIC——为什么要在 UDP 上建可靠传输](08-http3-quic.md)
4. [协议选型——什么时候用 HTTP/1.1、HTTP/2、HTTP/3](09-protocol-selection.md)
5. [阶段实战：同一应用的三种协议性能对比](10-stage-project.md)

## 验收标准

- 能用 Wireshark 抓包并解读 HTTP/2 帧（HEADERS、DATA、SETTINGS）
- 能解释多路复用如何解决 HTTP/1.1 的队头阻塞问题
- 能说明 QUIC 在 UDP 上实现可靠传输的核心机制
- 能根据业务场景选择合适的 HTTP 协议版本

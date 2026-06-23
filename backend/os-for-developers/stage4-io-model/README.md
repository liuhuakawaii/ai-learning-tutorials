# 第四阶段：I/O 模型

## 阶段目标

理解阻塞/非阻塞 I/O、I/O 多路复用（select/poll/epoll）的演进和工程实现，能用 epoll 实现一个简单的 TCP 服务器。

## 课时列表

1. [阻塞 vs 非阻塞 I/O——系统调用层面的区别](16-blocking-vs-nonblocking.md)
2. [I/O 多路复用——select/poll/epoll 的演进](17-io-multiplexing.md)
3. [epoll 的工程实现——ET vs LT、惊群问题、io_uring](18-epoll-engineering.md)
4. [事件驱动模型——Node.js/libuv、Nginx 的 I/O 模型](19-event-driven-model.md)
5. [阶段实战：用 epoll 实现一个简单的 TCP 服务器](20-epoll-tcp-server.md)

## 验收标准

- 能解释阻塞 I/O、非阻塞 I/O、I/O 多路复用在系统调用层面的区别
- 能说明 epoll 相比 select/poll 的优势（O(1) 事件通知、无 fd 数量限制）
- 能解释 epoll 的 ET（边缘触发）和 LT（水平触发）模式的区别
- 能用 epoll 实现一个能处理多个并发连接的 TCP 服务器

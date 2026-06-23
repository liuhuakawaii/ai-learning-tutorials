# 第五阶段：实战排查

## 阶段目标

掌握网络问题的系统性排查方法论，能用 ping/traceroute/mtr/ss/tcpdump 等工具链定位 DNS、TCP 连接、网络性能等真实问题。

## 课时列表

1. [网络排查工具链——ping/traceroute/mtr/ss/tcpdump/nc](21-网络排查工具链.md)
2. [DNS 排查——dig/nslookup、DNS 缓存、DNS 劫持](22-DNS排查.md)
3. [TCP 连接问题——超时、RST、半连接、端口耗尽](23-TCP连接问题.md)
4. [网络性能分析——带宽 vs 延迟、BDP、窗口大小](24-网络性能分析.md)
5. [阶段实战：排查三个真实生产环境的网络问题](25-阶段实战-排查真实问题.md)

## 验收标准

- 能用 ping/traceroute/mtr 定位网络路径中的延迟和丢包
- 能用 dig/nslookup 排查 DNS 解析问题（缓存、劫持、超时）
- 能识别 TCP 连接问题（RST、半连接、端口耗尽）并定位根因
- 能用带宽延迟积（BDP）分析网络性能瓶颈

# 第五阶段：实战排查

## 阶段目标

掌握 HTTP 问题的系统性排查方法，能用 Wireshark、curl、Charles 等工具定位 CORS 报错、证书过期、连接超时、移动端弱网等真实问题。

## 课时列表

1. [常见 HTTP 错误排查——CORS 报错、证书过期、连接超时](21-common-http-errors.md)
2. [抓包分析真实问题——用 Wireshark 定位"请求发了但没响应"](22-wireshark-real-problems.md)
3. [HTTP 调试工具链——curl 高级用法、httpie、Charles/Fiddler](23-http-debug-tools.md)
4. [移动端 HTTP 特殊问题——弱网、连接切换、后台限制](24-mobile-http-issues.md)
5. [阶段实战：排查三个真实生产环境的 HTTP 问题](25-stage-project.md)

## 验收标准

- 能排查至少 3 种常见的 HTTP 错误（CORS、证书、超时）并说明根因
- 能用 Wireshark 抓包定位"请求发了但没响应"类问题
- 能用 curl 复现和调试 HTTP 问题（自定义头部、跟随重定向、输出详细信息）
- 能识别移动端 HTTP 的特殊问题（弱网、连接切换、后台请求限制）

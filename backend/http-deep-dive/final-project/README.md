# HTTP 调试工具

> HTTP 深入课程毕业项目：一个本地运行的 HTTP 抓包、分析、缓存测试、CORS 检测工具。

## 快速开始

```bash
cd http-debug-tool
npm install
npm run build
npm start
# 浏览器配置代理 127.0.0.1:8888 后访问 http://debug.local 查看界面
```

## 本地检查

```bash
node scripts/check.js
```

## 项目结构

```
http-debug-tool/
├── src/
│   ├── proxy/           # 代理服务器与 MITM
│   ├── replay/          # 请求重放与差异对比
│   ├── cache-tester/    # 缓存策略测试
│   ├── cors-checker/    # CORS 配置检测
│   ├── performance/     # 连接与性能分析
│   ├── storage/         # 请求日志存储
│   └── ui/              # 前端界面（可选）
├── scripts/
│   └── check.js         # 结构验证脚本
├── tests/
├── reports/
│   └── final-report.md  # 最终报告
├── package.json
└── README.md
```

## 课程阶段映射

| 阶段 | 能力 | 对应代码 |
|------|------|----------|
| 阶段一 | HTTP 报文结构与代理原理 | `src/proxy/` |
| 阶段二 | 请求重放与头部操纵 | `src/replay/` |
| 阶段三 | 缓存机制（强缓存/协商缓存） | `src/cache-tester/` |
| 阶段四 | CORS 协议与预检请求 | `src/cors-checker/` |
| 阶段五 | 连接管理与性能分析 | `src/performance/` |

## 验收建议

1. 启动代理，浏览器访问任意 HTTP 网站，确认请求被捕获
2. 访问一个 HTTPS 网站，确认能解密查看请求内容
3. 选中一个请求重放并修改 `Cache-Control` 头，观察缓存行为变化
4. 对一个配置了 CORS 的接口运行检测，确认能输出健康报告
5. 查看请求时间线，确认各阶段耗时合理

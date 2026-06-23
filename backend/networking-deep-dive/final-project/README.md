# 网络诊断工具

> 网络深入课程毕业项目：集成 ping、traceroute、DNS 查询、TCP 测试的可视化网络诊断工具。

## 快速开始

```bash
cd net-diagnostic
npm install
npm run build
npm start -- ping 8.8.8.8
npm start -- traceroute google.com
npm start -- dns example.com --type MX
npm start -- tcp scan example.com --ports 80,443,3306,8080
npm start -- report example.com
```

## 本地检查

```bash
node scripts/check.js
```

## 项目结构

```
net-diagnostic/
├── src/
│   ├── ping/            # ICMP Ping
│   ├── traceroute/      # 路由追踪
│   ├── dns/             # DNS 查询
│   ├── tcp/             # TCP 连接测试
│   ├── report/          # 综合诊断报告
│   ├── visualizer/      # 可视化渲染
│   └── utils/           # 工具函数
├── scripts/
│   └── check.js
├── tests/
├── reports/
│   └── final-report.md
├── package.json
└── README.md
```

## 课程阶段映射

| 阶段 | 能力 | 对应代码 |
|------|------|----------|
| 阶段一 | ICMP 协议与网络延迟测量 | `src/ping/` |
| 阶段二 | IP 路由与 TTL 机制 | `src/traceroute/` |
| 阶段三 | DNS 协议与域名解析 | `src/dns/` |
| 阶段四 | TCP 连接管理与端口扫描 | `src/tcp/` |
| 阶段五 | 综合诊断与可视化 | `src/report/` |

## 验收建议

1. 运行 `ping 8.8.8.8`，确认 RTT 和丢包率统计正确
2. 运行 `traceroute` 到一个远程服务器，确认能看到路由路径
3. 查询一个域名的 MX 和 TXT 记录，确认结果与 `dig` 或 `nslookup` 一致
4. 对一个主机做端口扫描，确认能区分 Open/Closed 状态
5. 运行综合报告，确认输出包含所有诊断维度

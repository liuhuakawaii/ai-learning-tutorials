# 系统监控工具

> OS 课程毕业项目：实时监控进程、内存、文件描述符、磁盘 IO 的系统监控工具。

## 快速开始

```bash
cd sys-monitor
npm install
npm start
# 或 Python 版本
pip install -r requirements.txt
python main.py
```

## 本地检查

```bash
node scripts/check.js
# 或
python scripts/check.py
```

## 项目结构

```
sys-monitor/
├── src/
│   ├── process/         # 进程监控
│   ├── memory/          # 内存监控
│   ├── fd/              # 文件描述符监控
│   ├── io/              # 磁盘 IO 监控
│   ├── alert/           # 告警系统
│   ├── collector/       # 数据采集器
│   └── ui/              # 界面（TUI 或 Web）
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
| 阶段一 | 进程管理与系统调用 | `src/process/` |
| 阶段二 | 虚拟内存与内存模型 | `src/memory/` |
| 阶段三 | 文件系统与文件描述符 | `src/fd/` |
| 阶段四 | IO 调度与块设备 | `src/io/` |
| 阶段五 | 系统监控工程化 | `src/alert/` |

## 验收建议

1. 启动工具，确认能看到进程列表并实时刷新
2. 观察内存趋势图，运行一个内存消耗程序确认能检测到
3. 查看文件描述符列表，确认能看到进程打开的文件和 socket
4. 运行磁盘读写操作，确认 IO 监控能捕获变化
5. 设置一个低阈值触发告警，确认告警记录正确

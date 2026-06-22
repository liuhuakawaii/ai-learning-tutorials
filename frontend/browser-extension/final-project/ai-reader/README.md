# AI 阅读助手浏览器扩展

一个基于 Manifest V3 的智能阅读助手扩展，帮助用户高效阅读网页内容。

## 功能

- **AI 摘要**：一键生成文章摘要（简洁/详细/要点三种风格）
- **划词翻译**：选中文本即时弹出翻译结果
- **阅读笔记**：记录和管理阅读笔记，按页面关联
- **阅读模式**：干净的阅读视图，支持字体大小调节
- **右键菜单**：右键翻译、摘要、保存笔记
- **阅读统计**：追踪阅读时间和页面字数

## 技术架构

```
ai-reader/
├── manifest.json              # Manifest V3 配置
├── background/
│   └── service-worker.js      # 后台服务：API 调用、存储、右键菜单
├── content/
│   └── content.js             # 内容脚本：内容提取、划词翻译、阅读模式
├── popup/
│   ├── popup.html             # 弹窗界面
│   ├── popup.css              # 样式
│   └── popup.js               # 弹窗逻辑
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 安装使用

1. 下载或克隆本项目
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"，选择 `ai-reader` 目录
5. 点击扩展图标，进入设置配置 API Key

## 配置

点击扩展图标 → 点击右上角齿轮图标 → 输入你的 OpenAI API Key。

支持自定义 API 地址，可使用任何兼容 OpenAI 格式的 API 服务。

## 开发

本项目是 `frontend/browser-extension/` 课程的毕业项目，演示了以下核心概念：

- Manifest V3 架构（Service Worker + Content Script + Popup）
- 消息通信（三方通信模式）
- chrome.storage 数据持久化
- LLM API 集成
- 右键菜单
- 阅读模式（DOM 操作）

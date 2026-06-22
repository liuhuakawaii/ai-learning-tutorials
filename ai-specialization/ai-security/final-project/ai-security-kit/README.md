# AI Security Kit

AI 安全扫描工具 - 自动检测 AI 系统的安全风险

## 功能特性

- **代码扫描**: 检测代码中的安全问题
- **配置扫描**: 检查系统配置的安全性
- **运行时测试**: 动态测试 AI 系统的安全性
- **报告生成**: 生成详细的安全评估报告

## 安装

```bash
pip install -r requirements.txt
```

## 使用

```bash
# 扫描项目
python scripts/check.py scan --target ./my-project

# 生成报告
python scripts/check.py report --input results.json --output report.html
```

## 项目结构

```
ai-security-kit/
├── scripts/check.py      # 主入口
├── src/
│   ├── scanner/          # 扫描引擎
│   ├── detectors/        # 检测器
│   └── reporters/        # 报告生成
└── reports/templates/    # 报告模板
```

## 检测项

### 代码扫描
- 不安全的 Prompt 构造
- 缺少输入验证
- 硬编码凭证
- SQL 注入风险

### 配置扫描
- API 密钥管理
- 权限配置
- 网络安全配置

### 运行时测试
- Prompt 注入测试
- 越狱攻击测试
- 数据泄露测试

## License

MIT

# Python 自动化工具箱

统一命令行界面的自动化工具集合，涵盖文件处理、Web 监控、系统巡检、报表生成四大模块。

## 安装

```bash
pip install -e .
pip install -e ".[dev]"
```

## 使用方式

```bash
# 文件操作
toolbox file rename --dir ./photos --pattern "IMG_{n:04d}"
toolbox file organize --dir ./downloads --by ext
toolbox file clean --dir ./tmp --older-than 30

# Web 监控
toolbox web scrape --url https://example.com --selector "h1"
toolbox web detect --url https://example.com --interval 300
toolbox web notify --channel email --to user@example.com

# 系统巡检
toolbox sys monitor --interval 5
toolbox sys check --disk 80 --memory 90
toolbox sys report --format html

# 报表生成
toolbox report excel --data results.json --output report.xlsx
toolbox report pdf --data results.json --output report.pdf
toolbox report mail --to user@example.com --attach report.pdf
```

## 配置

默认配置位于 `config/default.yaml`，可通过 `--config` 参数指定自定义配置文件，也可通过环境变量覆盖（前缀 `TOOLBOX_`）。

## 开发

```bash
pytest
pytest --cov=toolbox
```

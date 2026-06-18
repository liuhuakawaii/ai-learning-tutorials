# 01 数据 Pipeline——自动化数据收集、清洗、格式化的流水线

> 从一次性实验到可重复的训练流水线。

## 学习目标

- 掌握数据 Pipeline 的设计方法
- 理解自动化数据处理流程
- 学会构建可重复的数据流水线

---

## 一、Pipeline 架构

```
数据 Pipeline：

数据源 → 收集 → 清洗 → 格式化 → 验证 → 输出
  │        │      │       │       │      │
  ▼        ▼      ▼       ▼       ▼      ▼
API/文件  原始数据 干净数据 标准格式 通过/失败 训练数据
```

---

## 二、实现

```python
class DataPipeline:
    """数据 Pipeline"""
    
    def __init__(self):
        self.steps = []
    
    def add_step(self, name: str, func):
        """添加步骤"""
        self.steps.append({"name": name, "func": func})
    
    def run(self, data: list) -> list:
        """运行 Pipeline"""
        current_data = data
        
        for step in self.steps:
            print(f"运行步骤：{step['name']}")
            current_data = step["func"](current_data)
            print(f"  输出：{len(current_data)} 条数据")
        
        return current_data

# 创建 Pipeline
pipeline = DataPipeline()
pipeline.add_step("收集", collect_data)
pipeline.add_step("清洗", clean_data)
pipeline.add_step("去重", deduplicate_data)
pipeline.add_step("格式化", format_data)
pipeline.add_step("验证", validate_data)

# 运行
result = pipeline.run(raw_data)
```

---

## 三、数据验证

```python
class DataValidator:
    """数据验证器"""
    
    def validate(self, data: list) -> dict:
        """验证数据"""
        issues = []
        
        for i, item in enumerate(data):
            # 检查格式
            if not self._check_format(item):
                issues.append(f"样本 {i}: 格式错误")
            
            # 检查长度
            if not self._check_length(item):
                issues.append(f"样本 {i}: 长度不符合要求")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues
        }
```

---

## 四、自动化调度

```python
from apscheduler.schedulers.blocking import BlockingScheduler

def run_daily_pipeline():
    """每日运行 Pipeline"""
    pipeline = DataPipeline()
    # ... 配置步骤
    
    data = fetch_new_data()
    result = pipeline.run(data)
    save_to_database(result)

# 定时调度
scheduler = BlockingScheduler()
scheduler.add_job(run_daily_pipeline, 'cron', hour=2)
scheduler.start()
```

---

## 五、监控和日志

```python
class PipelineMonitor:
    """Pipeline 监控"""
    
    def log_step(self, step_name: str, input_count: int, output_count: int):
        """记录步骤"""
        logger.info(f"{step_name}: {input_count} → {output_count}")
    
    def log_error(self, step_name: str, error: str):
        """记录错误"""
        logger.error(f"{step_name} 失败：{error}")
```

---

## 小结

```
本课核心要点：

1. 数据 Pipeline 自动化数据处理流程
2. 步骤化设计，易于维护和扩展
3. 数据验证确保数据质量
4. 自动化调度定期运行

下一课：训练配置管理——用 YAML 配置文件管理实验参数。
```

---

## 练习

1. **Pipeline 题**：实现一个数据 Pipeline。

2. **验证题**：实现数据验证功能。

3. **调度题**：实现定时调度。

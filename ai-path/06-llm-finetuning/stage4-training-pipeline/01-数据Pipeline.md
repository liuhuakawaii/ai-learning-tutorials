# 01 数据 Pipeline——自动化数据收集、清洗、格式化的流水线

> 从一次性实验到可重复的训练流水线。

## 场景引入

你的第一次微调实验成功了，但过程全是手动操作：手动下载数据、手动清洗、手动格式化、手动跑训练。每次有新数据都要重复一遍，而且不同同事的操作方式还不一样，数据质量参差不齐。你需要把数据处理流程自动化，变成一个可重复、可验证的 Pipeline——新数据进来，干净的训练数据出去，中间不需要人工干预。

---

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

## 常见误区

1. **Pipeline 只在本地测试就上线**：本地跑通的 Pipeline 到生产环境可能因为数据量、网络、权限等问题失败。必须在接近生产的环境做端到端测试。

2. **数据验证步骤可有可无**：跳过验证直接输出数据，可能把格式错误、空值、异常长度的样本混入训练集，导致训练失败或效果下降。

3. **Pipeline 没有错误处理**：某一步骤失败后 Pipeline 直接崩溃，已处理的数据丢失。每个步骤都应该有 try-catch 和回滚机制。

4. **手动触发 Pipeline**：依赖手动执行容易遗漏或延迟。应该用定时调度或数据变更触发，确保数据处理的及时性。

---

## 工程建议

1. **每个步骤独立可测试**：Pipeline 的每个步骤（收集、清洗、格式化）应该是独立的函数，可以单独测试和调试，方便定位问题。

2. **记录每步的输入输出统计**：每个步骤处理了多少条数据、丢弃了多少条、为什么丢弃，这些统计信息对排查数据质量问题至关重要。

3. **用幂等设计避免重复执行问题**：Pipeline 应该支持重复运行——相同输入产生相同输出，不会因为重复执行而产生重复数据。

4. **Pipeline 输出要版本化**：每次运行 Pipeline 的输出应该带版本号或时间戳，方便回溯和对比不同版本的训练数据。

---

## 小结

```
本课核心要点：

1. 数据 Pipeline 自动化数据处理流程
2. 步骤化设计，易于维护和扩展
3. 数据验证确保数据质量
4. 自动化调度定期运行

---

**下一课**: [02 训练配置管理——用 YAML 配置文件管理实验参数](./02-训练配置管理.md)
```

---

## 练习

1. **Pipeline 题**：实现一个数据 Pipeline。

2. **验证题**：实现数据验证功能。

3. **调度题**：实现定时调度。

---

## 参考答案

### 练习一：实现一个数据 Pipeline

**思路**：设计一个链式 Pipeline 架构，每个步骤是独立的纯函数（输入数据 → 输出数据），支持链式调用和错误处理。关键是每个步骤可独立测试、有统计日志。

**答案**：
```python
"""数据 Pipeline 实现"""
import json
import logging
from typing import Callable
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DataPipeline:
    def __init__(self, name: str):
        self.name = name
        self.steps: list[dict] = []
    
    def add_step(self, name: str, func: Callable) -> "DataPipeline":
        self.steps.append({"name": name, "func": func})
        return self  # 支持链式调用
    
    def run(self, data: list) -> list:
        logger.info(f"Pipeline [{self.name}] 开始，输入 {len(data)} 条数据")
        current = data
        
        for step in self.steps:
            step_name = step["name"]
            input_count = len(current)
            try:
                current = step["func"](current)
                logger.info(f"  [{step_name}] {input_count} → {len(current)} 条")
            except Exception as e:
                logger.error(f"  [{step_name}] 失败: {e}")
                raise
        
        logger.info(f"Pipeline [{self.name}] 完成，输出 {len(current)} 条数据")
        return current

# 定义各步骤
def collect_data(data: list) -> list:
    """收集数据（这里直接返回，实际可从 API/文件读取）"""
    return data

def clean_data(data: list) -> list:
    """清洗：去除空值、无效格式"""
    cleaned = []
    for item in data:
        if not item.get("instruction") or not item.get("output"):
            continue
        if len(item["instruction"].strip()) < 5:
            continue
        cleaned.append(item)
    return cleaned

def deduplicate_data(data: list) -> list:
    """去重：按 instruction 去重"""
    seen = set()
    unique = []
    for item in data:
        key = item["instruction"].strip()
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique

def format_data(data: list) -> list:
    """格式化：统一字段结构"""
    formatted = []
    for item in data:
        formatted.append({
            "instruction": item["instruction"].strip(),
            "input": item.get("input", "").strip(),
            "output": item["output"].strip()
        })
    return formatted

# 使用
pipeline = DataPipeline("法律问答数据")
pipeline.add_step("收集", collect_data)
pipeline.add_step("清洗", clean_data)
pipeline.add_step("去重", deduplicate_data)
pipeline.add_step("格式化", format_data)

raw_data = [
    {"instruction": "什么是合同？", "input": "", "output": "合同是民事主体之间设立、变更、终止民事法律关系的协议。"},
    {"instruction": "", "input": "", "output": "空数据"},
    {"instruction": "什么是合同？", "input": "", "output": "合同是民事主体之间设立、变更、终止民事法律关系的协议。"},
]
result = pipeline.run(raw_data)
print(f"最终输出 {len(result)} 条数据")
```

**要点**：
- 每个步骤是纯函数，相同输入产生相同输出，方便单元测试
- Pipeline 的 `run` 方法记录每步的输入输出数量，方便排查数据丢失问题
- 常见错误：步骤之间有隐式依赖（如依赖全局变量），导致 Pipeline 不可复现

### 练习二：实现数据验证功能

**思路**：验证器应该检查数据的格式完整性（必填字段）、内容合法性（长度、类型）、和业务约束（如 instruction 不能太短）。返回结构化的验证报告。

**答案**：
```python
"""数据验证器"""
from dataclasses import dataclass

@dataclass
class ValidationResult:
    valid: bool
    total: int
    passed: int
    failed: int
    issues: list[str]

class DataValidator:
    def __init__(self):
        self.rules = []
    
    def add_rule(self, name: str, check_func) -> "DataValidator":
        self.rules.append({"name": name, "check": check_func})
        return self
    
    def validate(self, data: list) -> ValidationResult:
        issues = []
        
        for i, item in enumerate(data):
            for rule in self.rules:
                if not rule["check"](item):
                    issues.append(f"样本 {i}: 违反规则 [{rule['name']}]")
        
        passed = len(data) - len(set(int(i.split(":")[0].split(" ")[1]) for i in issues)) if issues else len(data)
        return ValidationResult(
            valid=len(issues) == 0,
            total=len(data),
            passed=passed,
            failed=len(data) - passed,
            issues=issues
        )

# 定义验证规则
def has_required_fields(item: dict) -> bool:
    """必填字段检查"""
    return bool(item.get("instruction")) and bool(item.get("output"))

def instruction_min_length(item: dict) -> bool:
    """instruction 最小长度"""
    return len(item.get("instruction", "")) >= 5

def output_min_length(item: dict) -> bool:
    """output 最小长度"""
    return len(item.get("output", "")) >= 10

def no_html_tags(item: dict) -> bool:
    """不含 HTML 标签"""
    import re
    text = item.get("instruction", "") + item.get("output", "")
    return not re.search(r"<[^>]+>", text)

# 创建验证器
validator = DataValidator()
validator.add_rule("必填字段", has_required_fields)
validator.add_rule("instruction 长度", instruction_min_length)
validator.add_rule("output 长度", output_min_length)
validator.add_rule("无 HTML 标签", no_html_tags)

# 测试
test_data = [
    {"instruction": "什么是合同？", "output": "合同是民事主体之间设立、变更、终止民事法律关系的协议。"},
    {"instruction": "", "output": "空"},
    {"instruction": "短", "output": "太短"},
    {"instruction": "什么是<b>侵权</b>？", "output": "侵权责任..."},
]
result = validator.validate(test_data)
print(f"验证结果: {result.passed}/{result.total} 通过")
for issue in result.issues:
    print(f"  {issue}")
```

**要点**：
- 验证规则应该是独立的函数，可以灵活组合和复用
- 返回结构化的 ValidationResult 而不是简单的 bool，方便后续分析
- 常见错误：只检查字段是否存在，不检查内容质量（如长度、格式），导致空字符串通过验证

### 练习三：实现定时调度

**思路**：用 APScheduler 实现定时任务，支持 cron 表达式和错误重试。关键是任务失败时有日志和通知，不会静默失败。

**答案**：
```python
"""定时调度实现"""
import logging
from datetime import datetime
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PipelineScheduler:
    def __init__(self):
        self.scheduler = BlockingScheduler()
        self.scheduler.add_listener(self._on_job_event, EVENT_JOB_ERROR | EVENT_JOB_EXECUTED)
    
    def _on_job_event(self, event):
        if event.exception:
            logger.error(f"任务 {event.job_id} 失败: {event.exception}")
        else:
            logger.info(f"任务 {event.job_id} 执行成功")
    
    def add_daily_job(self, job_func, hour: int = 2, minute: int = 0):
        """添加每日定时任务"""
        self.scheduler.add_job(
            job_func,
            trigger="cron",
            hour=hour, minute=minute,
            id="daily_pipeline",
            misfire_grace_time=3600  # 允许 1 小时的延迟执行
        )
        logger.info(f"已添加每日任务，执行时间: {hour:02d}:{minute:02d}")
    
    def add_interval_job(self, job_func, hours: int = 6):
        """添加间隔任务"""
        self.scheduler.add_job(
            job_func,
            trigger="interval",
            hours=hours,
            id="interval_pipeline"
        )
        logger.info(f"已添加间隔任务，每 {hours} 小时执行")
    
    def start(self):
        logger.info("调度器启动")
        try:
            self.scheduler.start()
        except (KeyboardInterrupt, SystemExit):
            logger.info("调度器停止")

# 使用
def run_daily_pipeline():
    """每日数据 Pipeline"""
    logger.info(f"开始执行 Pipeline: {datetime.now()}")
    try:
        # 模拟 Pipeline 执行
        pipeline = DataPipeline("每日数据")
        # ... 配置步骤
        # data = fetch_from_api()
        # result = pipeline.run(data)
        logger.info("Pipeline 执行完成")
    except Exception as e:
        logger.error(f"Pipeline 失败: {e}")
        raise  # 让调度器捕获错误

scheduler = PipelineScheduler()
scheduler.add_daily_job(run_daily_pipeline, hour=2, minute=0)
# scheduler.start()  # 取消注释启动调度
```

**要点**：
- `misfire_grace_time` 处理任务错过执行时间的情况（如服务器重启），避免任务被跳过
- 任务失败时必须有日志和异常处理，不能静默吞掉错误
- 常见错误：没有设置错误监听器，任务失败后无人知晓，数据 Pipeline 静默中断

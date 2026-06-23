# 01 数据 Pipeline——从手动清洗到自动化流水线

> 从一次性实验到可重复的训练流水线。

你的第一次微调实验成功了，但过程全是手动操作：手动下载数据、手动清洗、手动格式化、手动跑训练。每次有新数据都要重复一遍，而且不同同事的操作方式还不一样，数据质量参差不齐。

你需要把数据处理流程自动化——新数据进来，干净的训练数据出去，中间不需要人工干预。

---

## 一个 Pipeline 长什么样

```
数据源 → 收集 → 清洗 → 格式化 → 验证 → 输出
```

每个步骤是独立的函数，接收数据、输出数据。可以单独测试、单独替换、单独调试。

```python
class DataPipeline:
    def __init__(self, name: str):
        self.name = name
        self.steps = []

    def add_step(self, name: str, func):
        self.steps.append({"name": name, "func": func})
        return self

    def run(self, data: list) -> list:
        print(f"Pipeline [{self.name}] 开始，输入 {len(data)} 条")
        current = data

        for step in self.steps:
            input_count = len(current)
            try:
                current = step["func"](current)
                print(f"  [{step['name']}] {input_count} → {len(current)} 条")
            except Exception as e:
                print(f"  [{step['name']}] 失败: {e}")
                raise

        print(f"Pipeline [{self.name}] 完成，输出 {len(current)} 条")
        return current
```

---

## 定义每个步骤

```python
import re
import json

def collect_data(data: list) -> list:
    """收集：这里直接返回，实际可以从 API/文件/数据库读取"""
    return data

def clean_data(data: list) -> list:
    """清洗：去除空值、无效格式、异常长度"""
    cleaned = []
    for item in data:
        q = item.get("instruction", "").strip()
        a = item.get("output", "").strip()

        if not q or not a:
            continue
        if len(q) < 5 or len(a) < 20:
            continue
        if len(a) > 2000:
            continue

        # 清理 HTML 标签
        q = re.sub(r"<[^>]+>", "", q)
        a = re.sub(r"<[^>]+>", "", a)

        cleaned.append({"instruction": q, "input": item.get("input", "").strip(), "output": a})
    return cleaned

def deduplicate_data(data: list) -> list:
    """去重：按 instruction 去重"""
    seen = set()
    unique = []
    for item in data:
        key = item["instruction"].lower()
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique

def validate_data(data: list) -> list:
    """验证：检查数据格式是否正确"""
    valid = []
    for i, item in enumerate(data):
        if "instruction" not in item or "output" not in item:
            print(f"  样本 {i}: 缺少必填字段")
            continue
        valid.append(item)
    return valid
```

---

## 组装和运行

```python
# 组装 Pipeline
pipeline = DataPipeline("法律问答数据")
pipeline.add_step("收集", collect_data)
pipeline.add_step("清洗", clean_data)
pipeline.add_step("去重", deduplicate_data)
pipeline.add_step("验证", validate_data)

# 测试数据
raw_data = [
    {"instruction": "什么是合同？", "input": "", "output": "合同是民事主体之间设立、变更、终止民事法律关系的协议。"},
    {"instruction": "", "input": "", "output": "空数据"},
    {"instruction": "什么是合同？", "input": "", "output": "合同是民事主体之间设立、变更、终止民事法律关系的协议。"},
    {"instruction": "短", "input": "", "output": "太短"},
]

result = pipeline.run(raw_data)
print(f"最终输出: {len(result)} 条")
# 预期：4 → 清洗后 2 条（去掉空值和太短的） → 去重后 1 条 → 验证后 1 条
```

---

## 每步记录统计

Pipeline 最重要的不是代码，是可观测性。每步处理了多少条、丢弃了多少条、为什么丢弃：

```python
class DataPipelineWithStats(DataPipeline):
    def run(self, data: list) -> list:
        print(f"Pipeline [{self.name}] 开始，输入 {len(data)} 条")
        current = data
        stats = []

        for step in self.steps:
            input_count = len(current)
            try:
                current = step["func"](current)
                output_count = len(current)
                dropped = input_count - output_count
                stats.append({
                    "step": step["name"],
                    "input": input_count,
                    "output": output_count,
                    "dropped": dropped,
                })
                print(f"  [{step['name']}] {input_count} → {output_count} (丢弃 {dropped})")
            except Exception as e:
                print(f"  [{step['name']}] 失败: {e}")
                raise

        # 输出统计
        print(f"\n统计：")
        for s in stats:
            print(f"  {s['step']}: 输入 {s['input']}, 输出 {s['output']}, 丢弃 {s['dropped']}")

        return current
```

这个统计数据对排查数据质量问题至关重要。如果某天清洗步骤突然丢弃了 50% 的数据，说明数据源出了问题。

---

## 幂等性

Pipeline 应该支持重复运行——相同输入产生相同输出，不会因为重复执行而产生重复数据。

```python
# 好的做法：输出到带版本号的文件
import datetime

def save_with_version(data: list, prefix: str):
    """保存数据，带时间戳版本"""
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    path = f"{prefix}_{timestamp}.json"
    with open(path, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"保存到 {path}")
    return path

# 不好的做法：总是写同一个文件名
# with open("output.json", "w") as f:  # 重复运行会覆盖
```

---

## 容易犯的错

**Pipeline 只在本地测试就上线**。本地跑通的 Pipeline 到生产环境可能因为数据量、网络、权限等问题失败。在接近生产的环境做端到端测试。

**数据验证步骤可有可无**。跳过验证直接输出数据，可能把格式错误、空值、异常长度的样本混入训练集。

**Pipeline 没有错误处理**。某一步骤失败后 Pipeline 直接崩溃，已处理的数据丢失。每个步骤都应该有 try-catch。

**手动触发 Pipeline**。依赖手动执行容易遗漏或延迟。用定时调度或数据变更触发。

---

## 练习

### 练习一：构建你的 Pipeline

为你的领域数据构建一个完整的 Pipeline：

```python
# 1. 定义数据来源
def load_my_data() -> list:
    with open("my_data.json") as f:
        return json.load(f)

# 2. 实现清洗函数（根据你的数据特点定制）
def my_clean_step(data: list) -> list:
    cleaned = []
    for item in data:
        # 你的清洗逻辑
        # ...
        cleaned.append(item)
    return cleaned

# 3. 组装 Pipeline
pipeline = DataPipeline("我的数据")
pipeline.add_step("加载", load_my_data)
pipeline.add_step("清洗", my_clean_step)
pipeline.add_step("去重", deduplicate_data)
pipeline.add_step("验证", validate_data)

# 4. 运行
result = pipeline.run([])  # load_my_data 会在第一步加载数据
```

### 练习二：添加质量报告

扩展 Pipeline，输出一份质量报告：

```python
def generate_quality_report(data: list) -> dict:
    """生成数据质量报告"""
    q_lengths = [len(item["instruction"]) for item in data]
    a_lengths = [len(item["output"]) for item in data]

    return {
        "total": len(data),
        "avg_question_len": sum(q_lengths) / len(q_lengths),
        "avg_answer_len": sum(a_lengths) / len(a_lengths),
        "min_question_len": min(q_lengths),
        "max_question_len": max(q_lengths),
        "empty_input_ratio": sum(1 for item in data if not item.get("input")) / len(data),
    }

# 在 Pipeline 末尾添加质量报告
pipeline.add_step("质量报告", lambda data: (generate_quality_report(data), data)[1])
```

### 练习三：定时调度

用 APScheduler 实现定时运行 Pipeline：

```python
from apscheduler.schedulers.blocking import BlockingScheduler
from datetime import datetime

def run_daily_pipeline():
    """每日运行 Pipeline"""
    print(f"开始执行: {datetime.now()}")

    pipeline = DataPipeline("每日数据")
    pipeline.add_step("加载", load_my_data)
    pipeline.add_step("清洗", my_clean_step)
    pipeline.add_step("去重", deduplicate_data)

    result = pipeline.run([])
    save_with_version(result, "daily_output")
    print(f"完成: {datetime.now()}")

# 每天凌晨 2 点执行
scheduler = BlockingScheduler()
scheduler.add_job(run_daily_pipeline, 'cron', hour=2)
# scheduler.start()  # 取消注释启动
```

---

## 参考答案

### 练习一

关键点：
- 每个步骤是纯函数，相同输入产生相同输出
- 清洗规则要根据你的数据特点定制
- 常见错误：步骤之间有隐式依赖（如依赖全局变量），导致 Pipeline 不可复现

### 练习二

质量报告应该包含：
- 样本总数
- 长度分布（平均、最小、最大）
- 空字段比例
- 异常值数量

### 练习三

定时调度的注意事项：
- `misfire_grace_time` 处理任务错过执行时间的情况（如服务器重启）
- 任务失败时必须有日志，不能静默吞掉错误
- 常见错误：没有设置错误监听器，任务失败后无人知晓

# 06 - 阶段实战：建立 Prompt 测试 Pipeline

> **课程定位**：阶段三 · 测试与优化 · 第6课（阶段总结实战）  
> **前置知识**：01-05 课全部内容  
> **预计用时**：150 分钟

---

## 场景引入

你已经掌握了 Prompt 测试方法论、评估指标设计、A/B 测试、版本管理和 CI 集成，但这些都是分散的技能。在真实项目中，你需要把这些能力串成一条完整的流水线：从测试用例输入，到 LLM 调用执行，到多维度自动评估，再到生成可读的测试报告——整个过程应该一条命令就能跑完。这一课就是把前面五课的知识整合成一个可落地的端到端 Pipeline。

---

## 学习目标

完成本课后，你将能够：

1. 设计端到端的 Prompt 测试 Pipeline 架构
2. 实现完整的数据采集、评估、报告流程
3. 构建可复用的 Pipeline 组件
4. 生成专业的测试报告
5. 将 Pipeline 部署到生产环境

---

## 1. Pipeline 架构设计

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Prompt 测试 Pipeline 架构                     │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │  数据输入  │───→│  测试执行  │───→│  指标评估  │───→│  报告生成 │ │
│  │  Layer    │    │  Layer   │    │  Layer   │    │  Layer   │ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│       │               │               │               │        │
│       ▼               ▼               ▼               ▼        │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │ 测试用例  │    │ LLM 调用  │    │ 多维评分  │    │ HTML/MD  │ │
│  │ 黄金数据集│    │ 结果缓存  │    │ 统计分析  │    │ 可视化   │ │
│  │ 回归用例  │    │ 并发控制  │    │ 趋势追踪  │    │ 告警通知 │ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    基础设施层                             │   │
│  │  配置管理 │ 日志记录 │ 错误处理 │ 缓存 │ 重试机制        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 数据流

```
输入阶段          执行阶段           评估阶段          输出阶段
    │                 │                 │                 │
    ▼                 ▼                 ▼                 ▼
┌────────┐      ┌────────┐      ┌────────┐      ┌────────┐
│ 测试用例│─────→│ Prompt │─────→│ 评估器 │─────→│ 报告   │
│ JSON   │      │ 模板   │      │ 评分   │      │ HTML   │
└────────┘      └────────┘      └────────┘      └────────┘
    │                 │                 │                 │
    │                 ▼                 ▼                 │
    │           ┌────────┐      ┌────────┐              │
    │           │ 响应缓存│      │ 历史对比│              │
    │           │ JSONL  │      │ 趋势图 │              │
    │           └────────┘      └────────┘              │
    │                                                    │
    └────────────────────────────────────────────────────┘
                    数据持久化
```

### 1.3 Pipeline 阶段详解

| 阶段 | 输入 | 处理 | 输出 |
|------|------|------|------|
| 数据输入 | 测试用例文件 | 加载、验证、去重 | 标准化用例列表 |
| 测试执行 | 用例列表 + Prompt | 调用 LLM、缓存结果 | 原始响应列表 |
| 指标评估 | 响应列表 + 期望 | 多维度评分、统计 | 评估结果列表 |
| 报告生成 | 评估结果 | 聚合、可视化 | HTML/MD 报告 |

---

## 2. 核心组件实现

### 2.1 配置管理

```python
"""
pipeline/config.py - Pipeline 配置管理
"""
import os
import yaml
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class LLMConfig:
    """LLM 配置"""
    provider: str = "openai"
    model: str = "gpt-4o-mini"
    api_key: str = ""
    temperature: float = 0.0
    max_tokens: int = 1000
    timeout: int = 30
    max_retries: int = 3

@dataclass
class EvaluationConfig:
    """评估配置"""
    metrics: list[str] = field(default_factory=lambda: [
        "keyword_match", "format_check", "length_check"
    ])
    weights: dict[str, float] = field(default_factory=lambda: {
        "keyword_match": 0.4,
        "format_check": 0.3,
        "length_check": 0.3
    })
    use_llm_judge: bool = False
    judge_model: str = "gpt-4o"

@dataclass
class PipelineConfig:
    """Pipeline 配置"""
    name: str = "prompt-pipeline"
    version: str = "1.0.0"
    llm: LLMConfig = field(default_factory=LLMConfig)
    evaluation: EvaluationConfig = field(default_factory=EvaluationConfig)
    parallel_workers: int = 5
    cache_enabled: bool = True
    cache_dir: str = ".cache"
    output_dir: str = "reports"
    
    @classmethod
    def from_yaml(cls, path: str) -> "PipelineConfig":
        """从 YAML 文件加载配置"""
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        
        config = cls()
        if "name" in data:
            config.name = data["name"]
        if "version" in data:
            config.version = data["version"]
        if "llm" in data:
            config.llm = LLMConfig(**data["llm"])
        if "evaluation" in data:
            config.evaluation = EvaluationConfig(**data["evaluation"])
        if "parallel_workers" in data:
            config.parallel_workers = data["parallel_workers"]
        if "cache_enabled" in data:
            config.cache_enabled = data["cache_enabled"]
        
        return config
    
    def to_yaml(self, path: str):
        """保存配置到 YAML"""
        import dataclasses
        data = {
            "name": self.name,
            "version": self.version,
            "llm": dataclasses.asdict(self.llm),
            "evaluation": dataclasses.asdict(self.evaluation),
            "parallel_workers": self.parallel_workers,
            "cache_enabled": self.cache_enabled
        }
        with open(path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, allow_unicode=True, default_flow_style=False)
```

### 2.2 测试用例管理

```python
"""
pipeline/test_cases.py - 测试用例管理
"""
import json
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional

@dataclass
class TestCase:
    """测试用例"""
    id: str
    input_text: str
    expected_keywords: list[str] = field(default_factory=list)
    forbidden_keywords: list[str] = field(default_factory=list)
    expected_output: Optional[str] = None
    expected_format: Optional[str] = None  # json, list, text
    max_length: Optional[int] = None
    category: str = "general"
    difficulty: str = "medium"
    tags: list[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

@dataclass
class TestSuite:
    """测试套件"""
    name: str
    description: str
    cases: list[TestCase] = field(default_factory=list)
    version: str = "1.0.0"
    
    def add_case(self, case: TestCase):
        self.cases.append(case)
    
    def filter_by_category(self, category: str) -> list[TestCase]:
        return [c for c in self.cases if c.category == category]
    
    def filter_by_difficulty(self, difficulty: str) -> list[TestCase]:
        return [c for c in self.cases if c.difficulty == difficulty]
    
    def filter_by_tag(self, tag: str) -> list[TestCase]:
        return [c for c in self.cases if tag in c.tags]
    
    @classmethod
    def from_json(cls, path: str) -> "TestSuite":
        """从 JSON 文件加载测试套件"""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        suite = cls(
            name=data.get("name", ""),
            description=data.get("description", ""),
            version=data.get("version", "1.0.0")
        )
        
        for case_data in data.get("cases", []):
            suite.add_case(TestCase(**case_data))
        
        return suite
    
    def to_json(self, path: str):
        """保存到 JSON"""
        data = {
            "name": self.name,
            "description": self.description,
            "version": self.version,
            "cases": [asdict(c) for c in self.cases]
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    @property
    def stats(self) -> dict:
        """统计信息"""
        categories = {}
        difficulties = {}
        for c in self.cases:
            categories[c.category] = categories.get(c.category, 0) + 1
            difficulties[c.difficulty] = difficulties.get(c.difficulty, 0) + 1
        
        return {
            "total": len(self.cases),
            "by_category": categories,
            "by_difficulty": difficulties
        }
```

### 2.3 LLM 调用封装

```python
"""
pipeline/llm_client.py - LLM 调用封装
"""
import time
import json
import hashlib
from pathlib import Path
from typing import Optional
from dataclasses import dataclass
from openai import OpenAI

@dataclass
class LLMResponse:
    """LLM 响应"""
    content: str
    model: str
    tokens_used: int
    latency_ms: float
    cached: bool = False

class LLMClient:
    """LLM 客户端封装"""
    
    def __init__(self, provider: str = "openai", model: str = "gpt-4o-mini",
                 api_key: Optional[str] = None, cache_dir: str = ".cache",
                 cache_enabled: bool = True, max_retries: int = 3,
                 timeout: int = 30):
        self.provider = provider
        self.model = model
        self.client = OpenAI(api_key=api_key)
        self.cache_dir = Path(cache_dir)
        self.cache_enabled = cache_enabled
        self.max_retries = max_retries
        self.timeout = timeout
        
        if cache_enabled:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
    
    def _get_cache_key(self, system: str, user: str, 
                       temperature: float) -> str:
        """生成缓存键"""
        content = f"{system}:{user}:{temperature}:{self.model}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def _get_from_cache(self, cache_key: str) -> Optional[str]:
        """从缓存获取"""
        cache_file = self.cache_dir / f"{cache_key}.json"
        if cache_file.exists():
            with open(cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data.get("content")
        return None
    
    def _save_to_cache(self, cache_key: str, content: str):
        """保存到缓存"""
        cache_file = self.cache_dir / f"{cache_key}.json"
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump({"content": content, "model": self.model}, f, 
                      ensure_ascii=False)
    
    def call(self, system_prompt: str, user_prompt: str,
             temperature: float = 0.0, max_tokens: int = 1000) -> LLMResponse:
        """调用 LLM"""
        # 检查缓存
        if self.cache_enabled:
            cache_key = self._get_cache_key(system_prompt, user_prompt, temperature)
            cached = self._get_from_cache(cache_key)
            if cached:
                return LLMResponse(
                    content=cached,
                    model=self.model,
                    tokens_used=0,
                    latency_ms=0,
                    cached=True
                )
        
        # 调用 API（带重试）
        last_error = None
        for attempt in range(self.max_retries):
            try:
                start_time = time.time()
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=self.timeout
                )
                latency_ms = (time.time() - start_time) * 1000
                
                content = response.choices[0].message.content
                tokens_used = response.usage.total_tokens if response.usage else 0
                
                # 保存到缓存
                if self.cache_enabled:
                    self._save_to_cache(cache_key, content)
                
                return LLMResponse(
                    content=content,
                    model=self.model,
                    tokens_used=tokens_used,
                    latency_ms=latency_ms,
                    cached=False
                )
            except Exception as e:
                last_error = e
                if attempt < self.max_retries - 1:
                    time.sleep(2 ** attempt)  # 指数退避
        
        raise Exception(f"LLM 调用失败（{self.max_retries} 次重试后）: {last_error}")
```

### 2.4 评估引擎

```python
"""
pipeline/evaluator.py - 多维度评估引擎
"""
import json
import re
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class MetricResult:
    """单个指标的评估结果"""
    name: str
    score: float  # 0.0 - 1.0
    weight: float
    details: dict = field(default_factory=dict)
    passed: bool = True

@dataclass
class EvaluationResult:
    """完整的评估结果"""
    test_case_id: str
    response: str
    metrics: list[MetricResult]
    weighted_score: float
    passed: bool
    execution_time_ms: float
    summary: dict = field(default_factory=dict)

class MultiMetricEvaluator:
    """多指标评估器"""
    
    def __init__(self, weights: dict[str, float], threshold: float = 0.7):
        self.weights = weights
        self.threshold = threshold
    
    def evaluate_keyword_match(self, response: str, 
                                expected: list[str],
                                forbidden: list[str]) -> MetricResult:
        """关键词匹配评估"""
        missing = [kw for kw in expected if kw not in response]
        found_forbidden = [kw for kw in forbidden if kw in response]
        
        if expected:
            score = (len(expected) - len(missing)) / len(expected)
        else:
            score = 1.0
        
        if found_forbidden:
            score *= 0.5  # 包含禁止词扣分
        
        return MetricResult(
            name="keyword_match",
            score=max(0, score),
            weight=self.weights.get("keyword_match", 0.4),
            details={
                "missing_keywords": missing,
                "forbidden_found": found_forbidden
            },
            passed=len(missing) == 0 and len(found_forbidden) == 0
        )
    
    def evaluate_format(self, response: str, 
                        expected_format: Optional[str]) -> MetricResult:
        """格式检查评估"""
        if not expected_format:
            return MetricResult(
                name="format_check",
                score=1.0,
                weight=self.weights.get("format_check", 0.3),
                passed=True
            )
        
        passed = True
        details = {}
        
        if expected_format == "json":
            try:
                json.loads(response)
                details["valid_json"] = True
            except json.JSONDecodeError:
                passed = False
                details["valid_json"] = False
                details["error"] = "无效的 JSON 格式"
        
        elif expected_format == "list":
            lines = [l.strip() for l in response.split("\n") if l.strip()]
            has_list_markers = any(
                l.startswith(("-", "*", "1.", "2.", "3.")) for l in lines
            )
            if not has_list_markers:
                passed = False
                details["error"] = "未检测到列表格式"
        
        elif expected_format == "markdown":
            has_markdown = any(c in response for c in ["#", "**", "- ", "```"])
            if not has_markdown:
                passed = False
                details["error"] = "未检测到 Markdown 格式"
        
        return MetricResult(
            name="format_check",
            score=1.0 if passed else 0.0,
            weight=self.weights.get("format_check", 0.3),
            details=details,
            passed=passed
        )
    
    def evaluate_length(self, response: str, 
                        max_length: Optional[int]) -> MetricResult:
        """长度检查评估"""
        if not max_length:
            return MetricResult(
                name="length_check",
                score=1.0,
                weight=self.weights.get("length_check", 0.3),
                passed=True
            )
        
        actual_length = len(response)
        passed = actual_length <= max_length
        
        # 分数：超出越多分越低
        if passed:
            score = 1.0
        else:
            over_ratio = actual_length / max_length
            score = max(0, 1.0 - (over_ratio - 1.0))
        
        return MetricResult(
            name="length_check",
            score=score,
            weight=self.weights.get("length_check", 0.3),
            details={
                "actual_length": actual_length,
                "max_length": max_length,
                "over_by": max(0, actual_length - max_length)
            },
            passed=passed
        )
    
    def evaluate_semantic(self, response: str, expected_output: str,
                          llm_client) -> MetricResult:
        """语义相似度评估（使用 LLM-as-Judge）"""
        judge_prompt = f"""请评估以下回答与参考答案的语义相似度。

参考答案：{expected_output}
实际回答：{response}

评分标准：
- 1.0: 完全一致或语义等价
- 0.8: 核心信息一致，表述略有不同
- 0.6: 部分信息一致，有遗漏
- 0.4: 信息偏差较大
- 0.2: 几乎不相关
- 0.0: 完全不相关或相反

只输出 0.0-1.0 的数字分数。"""
        
        result = llm_call_fn("你是语义评估专家。", judge_prompt)
        
        try:
            score = float(result.strip())
            score = max(0.0, min(1.0, score))
        except ValueError:
            score = 0.5
        
        return MetricResult(
            name="semantic_similarity",
            score=score,
            weight=self.weights.get("semantic_similarity", 0.0),
            details={"expected": expected_output[:100]},
            passed=score >= 0.6
        )
    
    def evaluate_all(self, test_case_id: str, response: str,
                     expected_keywords: list[str],
                     forbidden_keywords: list[str],
                     expected_format: Optional[str],
                     max_length: Optional[int],
                     execution_time_ms: float) -> EvaluationResult:
        """执行完整评估"""
        metrics = []
        
        # 关键词匹配
        metrics.append(self.evaluate_keyword_match(
            response, expected_keywords, forbidden_keywords
        ))
        
        # 格式检查
        metrics.append(self.evaluate_format(response, expected_format))
        
        # 长度检查
        metrics.append(self.evaluate_length(response, max_length))
        
        # 计算加权总分
        weighted_score = sum(m.score * m.weight for m in metrics)
        passed = all(m.passed for m in metrics) and weighted_score >= self.threshold
        
        return EvaluationResult(
            test_case_id=test_case_id,
            response=response,
            metrics=metrics,
            weighted_score=weighted_score,
            passed=passed,
            execution_time_ms=execution_time_ms,
            summary={
                "total_metrics": len(metrics),
                "passed_metrics": sum(1 for m in metrics if m.passed),
                "weighted_score": weighted_score
            }
        )
```

### 2.5 Pipeline 主引擎

```python
"""
pipeline/engine.py - Pipeline 主引擎
"""
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict

from .config import PipelineConfig
from .test_cases import TestSuite, TestCase
from .llm_client import LLMClient
from .evaluator import MultiMetricEvaluator, EvaluationResult

class PipelineResult:
    """Pipeline 执行结果"""
    
    def __init__(self, pipeline_name: str, pipeline_version: str):
        self.pipeline_name = pipeline_name
        self.pipeline_version = pipeline_version
        self.start_time = datetime.now()
        self.end_time: Optional[datetime] = None
        self.results: list[EvaluationResult] = []
        self.errors: list[dict] = []
        self.metadata: dict = {}
    
    @property
    def total_cases(self) -> int:
        return len(self.results) + len(self.errors)
    
    @property
    def passed_cases(self) -> int:
        return sum(1 for r in self.results if r.passed)
    
    @property
    def failed_cases(self) -> int:
        return sum(1 for r in self.results if not r.passed)
    
    @property
    def pass_rate(self) -> float:
        total = len(self.results)
        return self.passed_cases / total if total > 0 else 0.0
    
    @property
    def average_score(self) -> float:
        if not self.results:
            return 0.0
        return sum(r.weighted_score for r in self.results) / len(self.results)
    
    @property
    def duration_seconds(self) -> float:
        if not self.end_time:
            return 0.0
        return (self.end_time - self.start_time).total_seconds()
    
    def add_result(self, result: EvaluationResult):
        self.results.append(result)
    
    def add_error(self, case_id: str, error: str):
        self.errors.append({"case_id": case_id, "error": error})
    
    def to_dict(self) -> dict:
        return {
            "pipeline_name": self.pipeline_name,
            "pipeline_version": self.pipeline_version,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": self.duration_seconds,
            "summary": {
                "total_cases": self.total_cases,
                "passed": self.passed_cases,
                "failed": self.failed_cases,
                "errors": len(self.errors),
                "pass_rate": self.pass_rate,
                "average_score": self.average_score
            },
            "results": [asdict(r) for r in self.results],
            "errors": self.errors
        }


class PromptTestPipeline:
    """Prompt 测试 Pipeline 主引擎"""
    
    def __init__(self, config: PipelineConfig):
        self.config = config
        self.llm_client = LLMClient(
            provider=config.llm.provider,
            model=config.llm.model,
            api_key=config.llm.api_key or None,
            cache_dir=config.cache_dir,
            cache_enabled=config.cache_enabled,
            max_retries=config.llm.max_retries,
            timeout=config.llm.timeout
        )
        self.evaluator = MultiMetricEvaluator(
            weights=config.evaluation.weights,
            threshold=0.7
        )
        self.output_dir = Path(config.output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def _build_prompt(self, case: TestCase) -> tuple[str, str]:
        """构建 Prompt（可在此处加载自定义模板）"""
        system_prompt = "你是一个有帮助的助手。请根据用户的问题提供准确的回答。"
        user_prompt = case.input_text
        return system_prompt, user_prompt
    
    def _execute_single(self, case: TestCase) -> EvaluationResult:
        """执行单个测试用例"""
        start_time = time.time()
        
        # 构建 Prompt
        system_prompt, user_prompt = self._build_prompt(case)
        
        # 调用 LLM
        response = self.llm_client.call(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=self.config.llm.temperature,
            max_tokens=self.config.llm.max_tokens
        )
        
        execution_time_ms = (time.time() - start_time) * 1000
        
        # 评估结果
        result = self.evaluator.evaluate_all(
            test_case_id=case.id,
            response=response.content,
            expected_keywords=case.expected_keywords,
            forbidden_keywords=case.forbidden_keywords,
            expected_format=case.expected_format,
            max_length=case.max_length,
            execution_time_ms=execution_time_ms
        )
        
        return result
    
    def run(self, test_suite: TestSuite, 
            categories: Optional[list[str]] = None,
            parallel: bool = True) -> PipelineResult:
        """运行 Pipeline"""
        result = PipelineResult(self.config.name, self.config.version)
        
        # 筛选用例
        cases = test_suite.cases
        if categories:
            cases = [c for c in cases if c.category in categories]
        
        print(f"开始执行 Pipeline: {len(cases)} 个测试用例")
        
        if parallel and self.config.parallel_workers > 1:
            # 并行执行
            with ThreadPoolExecutor(max_workers=self.config.parallel_workers) as executor:
                future_to_case = {
                    executor.submit(self._execute_single, case): case
                    for case in cases
                }
                
                for future in as_completed(future_to_case):
                    case = future_to_case[future]
                    try:
                        eval_result = future.result()
                        result.add_result(eval_result)
                        status = "✓" if eval_result.passed else "✗"
                        print(f"  [{status}] {case.id}: {eval_result.weighted_score:.2f}")
                    except Exception as e:
                        result.add_error(case.id, str(e))
                        print(f"  [!] {case.id}: {e}")
        else:
            # 串行执行
            for case in cases:
                try:
                    eval_result = self._execute_single(case)
                    result.add_result(eval_result)
                    status = "✓" if eval_result.passed else "✗"
                    print(f"  [{status}] {case.id}: {eval_result.weighted_score:.2f}")
                except Exception as e:
                    result.add_error(case.id, str(e))
                    print(f"  [!] {case.id}: {e}")
        
        result.end_time = datetime.now()
        
        print(f"\nPipeline 完成: {result.passed_cases}/{result.total_cases} 通过 "
              f"({result.pass_rate:.1%}), 平均分: {result.average_score:.2f}")
        
        return result
```

---

## 3. 报告生成器

### 3.1 HTML 报告

```python
"""
pipeline/reporter.py - 测试报告生成器
"""
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

class ReportGenerator:
    """测试报告生成器"""
    
    def __init__(self, output_dir: str = "reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_html(self, pipeline_result, 
                      title: str = "Prompt 测试报告") -> str:
        """生成 HTML 报告"""
        summary = pipeline_result.to_dict()["summary"]
        
        # 生成结果表格行
        result_rows = []
        for r in pipeline_result.results:
            status_class = "passed" if r.passed else "failed"
            status_text = "通过" if r.passed else "失败"
            
            metrics_details = []
            for m in r.metrics:
                metrics_details.append(f"{m.name}: {m.score:.2f}")
            
            result_rows.append(f"""
                <tr class="{status_class}">
                    <td>{r.test_case_id}</td>
                    <td class="status">{status_text}</td>
                    <td>{r.weighted_score:.2f}</td>
                    <td>{'<br>'.join(metrics_details)}</td>
                    <td>{r.execution_time_ms:.0f}ms</td>
                    <td class="response">{r.response[:200]}...</td>
                </tr>
            """)
        
        # 生成错误表格行
        error_rows = []
        for e in pipeline_result.errors:
            error_rows.append(f"""
                <tr class="error">
                    <td>{e['case_id']}</td>
                    <td>{e['error']}</td>
                </tr>
            """)
        
        pass_rate_color = "#2ecc71" if summary["pass_rate"] >= 0.9 else "#e74c3c"
        
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: #f5f5f5; color: #333; padding: 20px; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        .header {{ background: #2c3e50; color: white; padding: 30px; border-radius: 10px;
                   margin-bottom: 20px; }}
        .header h1 {{ font-size: 24px; margin-bottom: 10px; }}
        .header .meta {{ opacity: 0.8; font-size: 14px; }}
        
        .summary {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px; margin-bottom: 20px; }}
        .summary-card {{ background: white; padding: 20px; border-radius: 10px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; }}
        .summary-card .value {{ font-size: 32px; font-weight: bold; color: #2c3e50; }}
        .summary-card .label {{ font-size: 14px; color: #666; margin-top: 5px; }}
        
        .section {{ background: white; border-radius: 10px; padding: 20px;
                   box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-bottom: 20px; }}
        .section h2 {{ font-size: 18px; margin-bottom: 15px; color: #2c3e50; }}
        
        table {{ width: 100%; border-collapse: collapse; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #eee; }}
        th {{ background: #f8f9fa; font-weight: 600; }}
        tr.passed {{ background: #f8fff8; }}
        tr.failed {{ background: #fff8f8; }}
        tr.error {{ background: #fff3f3; }}
        .status {{ font-weight: bold; }}
        .passed .status {{ color: #2ecc71; }}
        .failed .status {{ color: #e74c3c; }}
        .response {{ max-width: 300px; overflow: hidden; text-overflow: ellipsis;
                    white-space: nowrap; font-size: 12px; color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{title}</h1>
            <div class="meta">
                Pipeline: {pipeline_result.pipeline_name} v{pipeline_result.pipeline_version}<br>
                执行时间: {pipeline_result.start_time.strftime('%Y-%m-%d %H:%M:%S')}<br>
                耗时: {pipeline_result.duration_seconds:.1f} 秒
            </div>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <div class="value">{summary['total_cases']}</div>
                <div class="label">总用例数</div>
            </div>
            <div class="summary-card">
                <div class="value" style="color: #2ecc71">{summary['passed']}</div>
                <div class="label">通过</div>
            </div>
            <div class="summary-card">
                <div class="value" style="color: #e74c3c">{summary['failed']}</div>
                <div class="label">失败</div>
            </div>
            <div class="summary-card">
                <div class="value" style="color: {pass_rate_color}">{summary['pass_rate']:.1%}</div>
                <div class="label">通过率</div>
            </div>
            <div class="summary-card">
                <div class="value">{summary['average_score']:.2f}</div>
                <div class="label">平均分</div>
            </div>
        </div>
        
        <div class="section">
            <h2>测试结果详情</h2>
            <table>
                <thead>
                    <tr>
                        <th>用例ID</th>
                        <th>状态</th>
                        <th>加权分数</th>
                        <th>指标详情</th>
                        <th>耗时</th>
                        <th>响应摘要</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(result_rows)}
                </tbody>
            </table>
        </div>
        
        {"" if not error_rows else f'''
        <div class="section">
            <h2>执行错误</h2>
            <table>
                <thead>
                    <tr><th>用例ID</th><th>错误信息</th></tr>
                </thead>
                <tbody>
                    {''.join(error_rows)}
                </tbody>
            </table>
        </div>
        '''}
    </div>
</body>
</html>"""
        
        # 保存文件
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"report_{timestamp}.html"
        filepath = self.output_dir / filename
        filepath.write_text(html, encoding="utf-8")
        
        print(f"HTML 报告已生成: {filepath}")
        return str(filepath)
    
    def generate_markdown(self, pipeline_result,
                          title: str = "Prompt 测试报告") -> str:
        """生成 Markdown 报告"""
        summary = pipeline_result.to_dict()["summary"]
        
        lines = [
            f"# {title}",
            "",
            f"**Pipeline**: {pipeline_result.pipeline_name} v{pipeline_result.pipeline_version}",
            f"**执行时间**: {pipeline_result.start_time.strftime('%Y-%m-%d %H:%M:%S')}",
            f"**耗时**: {pipeline_result.duration_seconds:.1f} 秒",
            "",
            "## 摘要",
            "",
            f"| 指标 | 值 |",
            f"|------|-----|",
            f"| 总用例数 | {summary['total_cases']} |",
            f"| 通过 | {summary['passed']} |",
            f"| 失败 | {summary['failed']} |",
            f"| 通过率 | {summary['pass_rate']:.1%} |",
            f"| 平均分 | {summary['average_score']:.2f} |",
            "",
            "## 详细结果",
            "",
            "| 用例ID | 状态 | 加权分数 | 耗时 |",
            "|--------|------|---------|------|",
        ]
        
        for r in pipeline_result.results:
            status = "✓" if r.passed else "✗"
            lines.append(
                f"| {r.test_case_id} | {status} | {r.weighted_score:.2f} | "
                f"{r.execution_time_ms:.0f}ms |"
            )
        
        if pipeline_result.errors:
            lines.extend([
                "",
                "## 错误",
                "",
            ])
            for e in pipeline_result.errors:
                lines.append(f"- **{e['case_id']}**: {e['error']}")
        
        content = "\n".join(lines)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"report_{timestamp}.md"
        filepath = self.output_dir / filename
        filepath.write_text(content, encoding="utf-8")
        
        print(f"Markdown 报告已生成: {filepath}")
        return str(filepath)
    
    def save_raw_data(self, pipeline_result):
        """保存原始数据（JSON）"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"results_{timestamp}.json"
        filepath = self.output_dir / filename
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(pipeline_result.to_dict(), f, ensure_ascii=False, indent=2)
        
        print(f"原始数据已保存: {filepath}")
        return str(filepath)
```

---

## 4. 完整使用示例

### 4.1 配置文件

```yaml
# config/pipeline.yaml
name: sentiment-classifier-pipeline
version: "1.0.0"

llm:
  provider: openai
  model: gpt-4o-mini
  temperature: 0.0
  max_tokens: 500
  max_retries: 3
  timeout: 30

evaluation:
  metrics:
    - keyword_match
    - format_check
    - length_check
  weights:
    keyword_match: 0.4
    format_check: 0.3
    length_check: 0.3

parallel_workers: 5
cache_enabled: true
cache_dir: .cache
output_dir: reports
```

### 4.2 测试套件文件

```json
{
  "name": "sentiment-classifier-tests",
  "description": "情感分类器测试套件",
  "version": "1.0.0",
  "cases": [
    {
      "id": "TC-001",
      "input_text": "这个产品太棒了，强烈推荐！",
      "expected_keywords": ["positive", "正面"],
      "forbidden_keywords": ["negative", "负面"],
      "category": "sentiment",
      "difficulty": "easy",
      "tags": ["positive", "product"]
    },
    {
      "id": "TC-002",
      "input_text": "质量很差，非常失望。",
      "expected_keywords": ["negative", "负面"],
      "forbidden_keywords": ["positive", "正面"],
      "category": "sentiment",
      "difficulty": "easy",
      "tags": ["negative", "product"]
    },
    {
      "id": "TC-003",
      "input_text": "今天天气不错，但工作很忙。",
      "expected_keywords": ["mixed", "中性"],
      "forbidden_keywords": [],
      "category": "sentiment",
      "difficulty": "medium",
      "tags": ["mixed", "daily"]
    },
    {
      "id": "TC-004",
      "input_text": "退款政策是什么？我买的东西有问题。",
      "expected_keywords": ["退款", "政策"],
      "forbidden_keywords": ["抱歉", "无法"],
      "category": "customer_service",
      "difficulty": "medium",
      "tags": ["refund", "complaint"]
    },
    {
      "id": "TC-005",
      "input_text": "如何重置密码？",
      "expected_keywords": ["密码", "重置"],
      "forbidden_keywords": [],
      "category": "customer_service",
      "difficulty": "easy",
      "tags": ["password", "account"]
    }
  ]
}
```

### 4.3 主执行脚本

```python
"""
run_pipeline.py - Pipeline 执行入口
"""
import argparse
from pipeline.config import PipelineConfig
from pipeline.test_cases import TestSuite
from pipeline.engine import PromptTestPipeline
from pipeline.reporter import ReportGenerator

def main():
    parser = argparse.ArgumentParser(description="Prompt 测试 Pipeline")
    parser.add_argument("--config", default="config/pipeline.yaml",
                       help="配置文件路径")
    parser.add_argument("--tests", default="tests/test_suite.json",
                       help="测试套件文件路径")
    parser.add_argument("--categories", nargs="+", default=None,
                       help="只运行指定类别的测试")
    parser.add_argument("--no-parallel", action="store_true",
                       help="禁用并行执行")
    parser.add_argument("--output-dir", default="reports",
                       help="报告输出目录")
    
    args = parser.parse_args()
    
    # 加载配置
    print("加载配置...")
    config = PipelineConfig.from_yaml(args.config)
    config.output_dir = args.output_dir
    
    # 加载测试套件
    print("加载测试套件...")
    test_suite = TestSuite.from_json(args.tests)
    print(f"  共 {len(test_suite.cases)} 个测试用例")
    print(f"  分类: {test_suite.stats['by_category']}")
    
    # 创建 Pipeline
    pipeline = PromptTestPipeline(config)
    
    # 执行 Pipeline
    print("\n开始执行 Pipeline...")
    result = pipeline.run(
        test_suite=test_suite,
        categories=args.categories,
        parallel=not args.no_parallel
    )
    
    # 生成报告
    print("\n生成报告...")
    reporter = ReportGenerator(args.output_dir)
    
    html_path = reporter.generate_html(result)
    md_path = reporter.generate_markdown(result)
    json_path = reporter.save_raw_data(result)
    
    # 输出摘要
    print("\n" + "=" * 50)
    print("Pipeline 执行完成")
    print("=" * 50)
    print(f"总用例数: {result.total_cases}")
    print(f"通过: {result.passed_cases}")
    print(f"失败: {result.failed_cases}")
    print(f"通过率: {result.pass_rate:.1%}")
    print(f"平均分: {result.average_score:.2f}")
    print(f"耗时: {result.duration_seconds:.1f} 秒")
    print(f"\n报告位置:")
    print(f"  HTML: {html_path}")
    print(f"  Markdown: {md_path}")
    print(f"  JSON: {json_path}")

if __name__ == "__main__":
    main()
```

### 4.4 运行命令

```bash
# 基本运行
python run_pipeline.py

# 指定配置和测试文件
python run_pipeline.py --config config/pipeline.yaml --tests tests/test_suite.json

# 只运行特定类别
python run_pipeline.py --categories sentiment customer_service

# 禁用并行
python run_pipeline.py --no-parallel

# 指定输出目录
python run_pipeline.py --output-dir ./my_reports
```

---

## 5. 常见误区

### ❌ 错误1：Pipeline 没有错误处理

```python
# 错误：单个用例失败导致整个 Pipeline 停止
for case in cases:
    result = execute(case)  # 如果抛异常，后续用例都不会执行

# 正确：捕获错误，继续执行
for case in cases:
    try:
        result = execute(case)
    except Exception as e:
        add_error(case.id, str(e))
        continue
```

### ❌ 错误2：不缓存 LLM 响应

```python
# 错误：每次运行都调用 API
def run_test(case):
    return call_llm(case.input)  # 开发阶段可能运行几十次

# 正确：启用缓存
def run_test(case):
    if cache.has(case.input):
        return cache.get(case.input)
    result = call_lmm(case.input)
    cache.set(case.input, result)
    return result
```

### ❌ 错误3：评估权重不归一

```python
# 错误：权重总和不为 1
weights = {"accuracy": 0.5, "relevance": 0.5, "safety": 0.5}
# 总和 1.5，评分会被放大

# 正确：确保权重归一
weights = {"accuracy": 0.33, "relevance": 0.33, "safety": 0.34}
assert abs(sum(weights.values()) - 1.0) < 0.01
```

### ❌ 错误4：报告只展示通过率

```python
# 错误：只看通过率
if pass_rate >= 0.9:
    print("测试通过")

# 正确：同时关注平均分、失败用例详情、耗时等
if pass_rate >= 0.9 and avg_score >= 0.8:
    print("测试通过")
else:
    print("需要关注以下问题:")
    for failed in failed_cases:
        print(f"  - {failed.id}: {failed.details}")
```

### ❌ 错误5：不保存测试历史

```python
# 错误：每次运行覆盖之前的结果
save_report(result, "report.html")

# 正确：使用时间戳保存历史
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
save_report(result, f"report_{timestamp}.html")
```

---

---

## 6. 工程建议

1. **先跑通最小 Pipeline，再逐步扩展**：一开始用最简单的关键词匹配评估器和 10 个测试用例验证流程通畅，再逐步加入 LLM-as-Judge、并行执行、HTML 报告等高级功能。
2. **配置和测试数据必须版本化**：Pipeline 的 YAML 配置和测试套件 JSON 都要纳入 Git 管理——这样每次 Pipeline 运行都能追溯到使用了哪套配置和数据。
3. **缓存策略要区分开发和生产环境**：开发阶段激进缓存（相同输入直接返回缓存），CI 环境选择性缓存（只缓存评估结果），生产环境按需缓存（缓存热点查询）。
4. **报告要同时面向机器和人**：JSON 格式供自动化系统消费（CI 门禁判断、趋势分析），HTML/Markdown 格式供人工审阅——一份报告满足两种受众。

---

## 7. 总结

本课我们从零构建了一个完整的 Prompt 测试 Pipeline：

1. **配置管理**：支持 YAML 配置，灵活可扩展
2. **测试用例管理**：结构化的用例定义和分类
3. **LLM 客户端**：带缓存和重试的 API 调用封装
4. **评估引擎**：多维度加权评分系统
5. **Pipeline 引擎**：支持并行执行的主流程
6. **报告生成**：专业的 HTML/MD/JSON 报告

这个 Pipeline 可以：
- 集成到 CI/CD 流程中自动运行
- 作为 Prompt 开发的日常工具
- 支持团队协作和质量门禁
- 追踪 Prompt 质量的变化趋势

---

## 练习

### 练习1：扩展评估器（⭐）

为 Pipeline 添加一个新的评估指标：
- 设计评估维度和评分标准
- 实现评估函数
- 集成到评估引擎中

### 练习2：自定义报告（⭐⭐）

修改报告生成器，添加以下功能：
- 趋势图（对比多次运行的结果）
- 按类别分组的统计
- 失败用例的详细分析
- 改进建议自动生成

### 练习3：端到端实战（⭐⭐⭐）

使用本课的 Pipeline 框架，为你自己的 Prompt 项目建立完整的测试体系：
- 编写至少 20 个测试用例（覆盖不同类别和难度）
- 配置 Pipeline 参数
- 运行 Pipeline 并分析报告
- 根据结果优化你的 Prompt
- 再次运行，对比改进效果

---

## 阶段三总结

恭喜你完成了阶段三的学习！你已经掌握了：

1. **Prompt 测试方法论**：系统化的测试思维
2. **评估指标设计**：科学的质量度量体系
3. **A/B 测试框架**：数据驱动的决策方法
4. **版本管理**：像管理代码一样管理 Prompt
5. **CI 集成**：自动化的质量保障
6. **完整 Pipeline**：端到端的测试流程

这些技能将帮助你在实际项目中构建高质量、可维护的 Prompt 系统。

---

> **下一阶段预告**：阶段四将深入探讨 Prompt 的高级优化技巧，包括 Chain-of-Thought、Few-Shot Learning、Self-Consistency 等前沿技术。

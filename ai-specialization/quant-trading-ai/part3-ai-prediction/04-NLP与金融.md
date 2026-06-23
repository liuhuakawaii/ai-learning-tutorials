# 第四课：NLP 与金融——从文本中提取交易信号

## 场景引入

2025 年 3 月，某 A 股上市公司发布了一份看似平淡的年报。传统量化因子没有捕捉到任何异常，但在社交媒体上，大量投资者在讨论该公司应收账款异常增长、关联交易频繁等问题。三天后，股价暴跌 18%。

这个案例揭示了一个核心问题：**市场信息首先以文本形式出现，然后才反映在价格中**。谁能更快、更准确地理解文本，谁就能抢占信息优势。

NLP（自然语言处理）在量化交易中的应用已经从早期的简单关键词匹配，发展到 2025 年基于大语言模型的深度语义理解。本课将带你从零构建金融文本分析系统。

> **风险提示**：NLP 信号存在滞后性和噪声，文本分析结果不能作为唯一交易依据。模型可能对文本产生误判，导致错误交易信号。任何基于 NLP 的策略都必须经过严格的回测验证。

## 学习目标

完成本课后，你将能够：

1. 理解中文金融 NLP 的独特挑战
2. 实现基于词典的情感分析方法
3. 使用预训练 BERT 模型进行金融文本分类
4. 调用大语言模型（LLM）进行深度文本分析
5. 将文本信号转化为可交易的量化因子

## 一、中文金融 NLP 的独特挑战

### 1.1 为什么金融 NLP 特别难？

通用 NLP 和金融 NLP 之间存在巨大鸿沟：

```
通用 NLP                          金融 NLP
┌─────────────────┐              ┌─────────────────┐
│ "这部电影很好看" │              │ "公司营收增长但   │
│  → 正面情感      │              │  现金流持续为负"  │
│  → 置信度 95%    │              │  → 正面？负面？   │
│                  │              │  → 需要领域知识   │
│ 语义清晰        │              │  → 置信度 60%?    │
│ 标注容易        │              │  语义复杂         │
│ 数据充足        │              │  标注困难         │
│                  │              │  数据稀缺         │
└─────────────────┘              └─────────────────┘
```

### 1.2 中文特有的困难

```python
# 中文分词的歧义问题
text = "上市公司股东大会通过了分红方案"

# 错误分词：上市 / 公司股东大会 / 通过 / 了 / 分红 / 方案
# 正确分词：上市公司 / 股东大会 / 通过 / 了 / 分红 / 方案

# 金融术语需要专业词典
# "利好" "利空" "涨停" "跌停" "ST" "摘帽" 等术语
# 通用分词器无法正确处理
```

**核心挑战总结**：

| 挑战 | 说明 | 示例 |
|------|------|------|
| 否定词处理 | "不是不好" 表示正面 | 双重否定需要特殊逻辑 |
| 隐含情感 | "公司更换了审计机构" | 表面中性，实则负面 |
| 数值理解 | "净利润同比下降 30%" | 需要理解下降是负面 |
| 上下文依赖 | "虽然亏损但订单大增" | 转折句需要整体理解 |
| 反讽与暗示 | "这操作真是 '漂亮'" | 引号暗示反讽 |

## 二、基于词典的情感分析

### 2.1 方法原理

词典方法是最直观的情感分析方式：维护一个正面词库和一个负面词库，统计文本中正负词的数量来判断情感倾向。

```
输入文本: "公司业绩大幅增长，利好消息不断"
              │
              ▼
┌──────────────────────────┐
│        分词              │
│ [公司, 业绩, 大幅, 增长,  │
│  利好, 消息, 不断]        │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│      词典匹配            │
│  正面词: 增长(+1),       │
│         利好(+1)         │
│  负面词: (无)            │
│  否定词: (无)            │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│      计算得分            │
│  正面: 2, 负面: 0        │
│  情感得分 = (2-0)/(2+0)  │
│           = 1.0 (正面)   │
└──────────────────────────┘
```

### 2.2 完整代码实现

```python
"""
金融文本情感分析——基于词典方法
适用于 A 股市场中文金融文本
"""

import re
from collections import Counter


# ===== 金融情感词典（精简版，实际使用需扩充）=====
POSITIVE_WORDS = {
    "增长", "上涨", "利好", "突破", "创新高", "盈利", "利润增长",
    "营收增长", "增持", "买入", "看好", "乐观", "强劲", "复苏",
    "扭亏", "超预期", "大增", "暴涨", "涨停", "翻倍", "新高",
    "扩产", "订单", "中标", "签约", "合作", "战略投资", "回购",
    "分红", "派息", "送股", "转增", "减税", "补贴", "扶持",
    "龙头", "领先", "第一", "核心", "壁垒", "护城河", "垄断",
}

NEGATIVE_WORDS = {
    "下跌", "下跌", "利空", "跌破", "创新低", "亏损", "利润下降",
    "营收下降", "减持", "卖出", "看空", "悲观", "疲软", "衰退",
    "爆雷", "不及预期", "大跌", "暴跌", "跌停", "腰斩", "新低",
    "停产", "违约", "诉讼", "处罚", "罚款", "调查", "立案",
    "质押", "冻结", "失信", "被执行", "ST", "*ST", "退市",
    "造假", "虚增", "隐瞒", "关联交易", "利益输送", "掏空",
}

NEGATION_WORDS = {"不", "没", "未", "非", "无", "难以", "无法", "并非", "未必"}

INTENSIFIERS = {
    "大幅": 2.0, "显著": 1.5, "急剧": 2.0, "持续": 1.3,
    "严重": 2.0, "略微": 0.5, "小幅": 0.5, "稍微": 0.5,
}


def tokenize_chinese(text: str) -> list[str]:
    """简化的中文分词（实际项目建议使用 jieba）"""
    # 移除标点和数字
    text = re.sub(r'[^\u4e00-\u9fff]', ' ', text)
    # 基于正向最大匹配的简单分词
    words = []
    # 先匹配多字词（按长度降序）
    all_terms = POSITIVE_WORDS | NEGATIVE_WORDS | NEGATION_WORDS | set(INTENSIFIERS.keys())
    sorted_terms = sorted(all_terms, key=len, reverse=True)

    remaining = text.strip()
    while remaining:
        matched = False
        for term in sorted_terms:
            if remaining.startswith(term):
                words.append(term)
                remaining = remaining[len(term):]
                matched = True
                break
        if not matched:
            # 单字切分
            words.append(remaining[0])
            remaining = remaining[1:]

    return [w for w in words if w.strip()]


def analyze_sentiment(text: str) -> dict:
    """
    分析单条文本的情感倾向

    返回:
        {
            "score": float,      # 情感得分 [-1, 1]
            "positive": int,     # 正面词数量
            "negative": int,     # 负面词数量
            "words": list,       # 匹配到的情感词
            "label": str         # 正面/负面/中性
        }
    """
    words = tokenize_chinese(text)

    pos_count = 0
    neg_count = 0
    matched_words = []
    negation_active = False

    for i, word in enumerate(words):
        # 检查否定词
        if word in NEGATION_WORDS:
            negation_active = True
            continue

        # 检查强度修饰词
        intensifier = INTENSIFIERS.get(word, 1.0)

        if word in POSITIVE_WORDS:
            if negation_active:
                neg_count += intensifier
                matched_words.append(f"不{word}(→负面)")
            else:
                pos_count += intensifier
                matched_words.append(f"{word}(正面)")
            negation_active = False

        elif word in NEGATIVE_WORDS:
            if negation_active:
                pos_count += intensifier * 0.5  # 否定负面词为弱正面
                matched_words.append(f"不{word}(→正面)")
            else:
                neg_count += intensifier
                matched_words.append(f"{word}(负面)")
            negation_active = False
        else:
            # 非情感词，重置否定状态
            negation_active = False

    total = pos_count + neg_count
    score = (pos_count - neg_count) / total if total > 0 else 0.0

    if score > 0.1:
        label = "正面"
    elif score < -0.1:
        label = "负面"
    else:
        label = "中性"

    return {
        "score": round(score, 3),
        "positive": pos_count,
        "negative": neg_count,
        "words": matched_words,
        "label": label,
    }


def analyze_batch(texts: list[str]) -> list[dict]:
    """批量分析多条文本"""
    results = []
    for text in texts:
        result = analyze_sentiment(text)
        result["text"] = text[:50] + "..." if len(text) > 50 else text
        results.append(result)
    return results


# ===== 使用示例 =====
if __name__ == "__main__":
    test_texts = [
        "公司业绩大幅增长，营收创新高，利好消息不断",
        "公司亏损严重，面临退市风险，投资者信心不足",
        "公司发布了年度报告，营收与去年持平",
        "虽然短期亏损，但订单大幅增长，未来看好",
        "不是不好，只是增长不及预期",
    ]

    print("=" * 60)
    print("金融文本情感分析结果")
    print("=" * 60)

    for text in test_texts:
        result = analyze_sentiment(text)
        print(f"\n文本: {text}")
        print(f"标签: {result['label']}  得分: {result['score']}")
        print(f"正面词: {result['positive']}  负面词: {result['negative']}")
        print(f"匹配: {result['words']}")
```

### 2.3 词典方法的局限性

```
词典方法的典型失败场景:

1. 复杂句式
   "公司虽然亏损，但核心业务增长强劲"  → 词典可能判负面
   实际: 偏正面（转折句后半部分更重要）

2. 隐含信息
   "公司更换了审计机构"  → 词典判中性
   实际: 偏负面（可能隐藏财务问题）

3. 反讽
   "这业绩真是 '亮眼' 啊"  → 词典判正面
   实际: 负面（引号暗示反讽）

4. 行业对比
   "公司毛利率 15%"  → 词典判中性
   实际: 取决于行业（银行偏低，制造业偏高）
```

## 三、基于 BERT 的情感分析

### 3.1 为什么需要深度学习？

词典方法只能处理表面词汇匹配，无法理解语义。预训练语言模型通过在海量文本上学习，能够捕捉更深层的语言规律。

```
词典方法 vs BERT 方法:

词典: "公司业绩大幅增长" → 匹配"增长"(正面) → 正面
BERT: "公司业绩大幅增长" → 编码为 768 维向量 → 分类器 → 正面(0.92)

词典: "公司虽然亏损但前景看好" → 亏损(负面) + 看好(正面) → 中性?
BERT: 理解转折关系，综合判断 → 偏正面(0.68)
```

### 3.2 使用金融 BERT 模型

```python
"""
基于 BERT 的金融文本情感分析
使用 Hugging Face Transformers 库
依赖: pip install transformers torch
"""

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import numpy as np


class FinancialSentimentBERT:
    """
    基于 BERT 的金融文本情感分类器

    使用 FinBERT 或类似中文金融预训练模型
    2025 年可选模型:
    - yiyanghkust/finbert-tone (英文)
    - ckiplab/bert-base-chinese (中文通用)
    - 自定义微调模型 (推荐)
    """

    def __init__(self, model_name: str = "ckiplab/bert-base-chinese"):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        # 对于情感分类，需要微调后的模型
        # 这里演示加载流程，实际使用需替换为微调后的模型
        self.model = None  # 实际使用时加载微调模型
        self.labels = ["负面", "中性", "正面"]

    def preprocess(self, text: str, max_length: int = 256) -> dict:
        """文本预处理与编码"""
        encoding = self.tokenizer(
            text,
            max_length=max_length,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        return {k: v.to(self.device) for k, v in encoding.items()}

    def predict(self, text: str) -> dict:
        """
        预测单条文本情感

        实际使用时需要加载微调后的模型:
        self.model = AutoModelForSequenceClassification.from_pretrained("your-model-path")
        self.model.to(self.device)
        self.model.eval()
        """
        if self.model is None:
            return self._mock_predict(text)

        inputs = self.preprocess(text)
        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = torch.softmax(outputs.logits, dim=-1)

        probs_np = probs.cpu().numpy()[0]
        pred_idx = np.argmax(probs_np)

        return {
            "label": self.labels[pred_idx],
            "confidence": float(probs_np[pred_idx]),
            "probabilities": {
                label: float(prob)
                for label, prob in zip(self.labels, probs_np)
            },
        }

    def _mock_predict(self, text: str) -> dict:
        """模拟预测（演示用）"""
        # 简单规则模拟 BERT 输出分布
        from random import uniform
        p_neg = uniform(0.05, 0.3)
        p_pos = uniform(0.05, 0.3)
        p_neu = 1.0 - p_neg - p_pos

        probs = [p_neg, p_neu, p_pos]
        pred_idx = np.argmax(probs)

        return {
            "label": self.labels[pred_idx],
            "confidence": float(probs[pred_idx]),
            "probabilities": {
                label: float(prob)
                for label, prob in zip(self.labels, probs)
            },
        }


class SentimentTrainer:
    """
    BERT 情感分类微调训练器

    训练数据格式: [{"text": "...", "label": 0/1/2}, ...]
    0=负面, 1=中性, 2=正面
    """

    def __init__(self, model_name: str, num_labels: int = 3):
        from transformers import AutoModelForSequenceClassification

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            model_name, num_labels=num_labels
        ).to(self.device)

    def prepare_dataset(self, data: list[dict], max_length: int = 256):
        """准备训练数据"""
        texts = [item["text"] for item in data]
        labels = [item["label"] for item in data]

        encodings = self.tokenizer(
            texts,
            max_length=max_length,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )

        class SentimentDataset(torch.utils.data.Dataset):
            def __init__(self, encodings, labels):
                self.encodings = encodings
                self.labels = labels

            def __getitem__(self, idx):
                item = {k: v[idx] for k, v in self.encodings.items()}
                item["labels"] = torch.tensor(self.labels[idx])
                return item

            def __len__(self):
                return len(self.labels)

        return SentimentDataset(encodings, labels)

    def train(
        self,
        train_data: list[dict],
        val_data: list[dict] | None = None,
        epochs: int = 3,
        batch_size: int = 16,
        lr: float = 2e-5,
    ):
        """执行微调训练"""
        from torch.utils.data import DataLoader
        from transformers import AdamW, get_linear_schedule_with_warmup

        train_dataset = self.prepare_dataset(train_data)
        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)

        optimizer = AdamW(self.model.parameters(), lr=lr, weight_decay=0.01)
        total_steps = len(train_loader) * epochs
        scheduler = get_linear_schedule_with_warmup(
            optimizer, num_warmup_steps=total_steps // 10, num_training_steps=total_steps
        )

        self.model.train()
        for epoch in range(epochs):
            total_loss = 0
            for batch in train_loader:
                batch = {k: v.to(self.device) for k, v in batch.items()}
                outputs = self.model(**batch)
                loss = outputs.loss
                loss.backward()

                torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                optimizer.step()
                scheduler.step()
                optimizer.zero_grad()

                total_loss += loss.item()

            avg_loss = total_loss / len(train_loader)
            print(f"Epoch {epoch + 1}/{epochs}, Loss: {avg_loss:.4f}")


# ===== 训练数据准备示例 =====
def create_training_data() -> list[dict]:
    """
    创建训练数据（实际项目需要更大规模的数据集）

    数据来源建议:
    1. 财经新闻人工标注
    2. 研报观点提取
    3. 互动易问答标注
    4. 使用 LLM 辅助标注后人工审核
    """
    data = [
        {"text": "公司营收大幅增长50%，净利润创新高", "label": 2},
        {"text": "公司业绩不及预期，股价应声下跌", "label": 0},
        {"text": "公司发布季度报告，各项指标平稳", "label": 1},
        {"text": "核心产品获得FDA认证，市场前景广阔", "label": 2},
        {"text": "公司被证监会立案调查，存在退市风险", "label": 0},
        {"text": "公司签订重大合同，金额达10亿元", "label": 2},
        {"text": "大股东减持，套现超过5亿元", "label": 0},
        {"text": "公司召开股东大会，审议通过年度报告", "label": 1},
        {"text": "研发投入大幅增加，技术壁垒持续提升", "label": 2},
        {"text": "商誉减值计提30亿，严重拖累业绩", "label": 0},
    ]
    return data


if __name__ == "__main__":
    # 演示预测流程
    classifier = FinancialSentimentBERT()

    test_texts = [
        "公司业绩大幅增长，营收创新高",
        "公司面临退市风险，投资者信心不足",
        "公司发布年度报告",
    ]

    print("=" * 50)
    print("BERT 情感分析结果（模拟）")
    print("=" * 50)

    for text in test_texts:
        result = classifier.predict(text)
        print(f"\n文本: {text}")
        print(f"预测: {result['label']} (置信度: {result['confidence']:.2%})")
        print(f"概率分布: {result['probabilities']}")
```

### 3.3 模型选择建议（2025 年）

```
模型选择决策树:

你的数据量有多少？
│
├─ < 100 条标注
│  └─ 使用 LLM 零样本分类（见第四节）
│
├─ 100 ~ 1000 条标注
│  └─ 使用 BERT + 少样本学习
│     推荐: chinese-finbert 或 Mengzi-fin
│
├─ 1000 ~ 10000 条标注
│  └─ 微调 BERT 模型
│     推荐: bert-base-chinese + 全量微调
│
└─ > 10000 条标注
   └─ 训练领域专用模型
      推荐: 从零预训练 + 微调
```

## 四、大语言模型在金融分析中的应用（2025）

### 4.1 LLM 分析的优势

2025 年，大语言模型（如 GPT-4、Claude、DeepSeek）在金融文本分析中展现出独特优势：

```
传统 NLP 管线:                    LLM 分析:
文本 → 分词 → 特征 → 模型 → 输出   文本 → LLM → 结构化输出
        ↓                              ↓
  需要大量标注                      零样本/少样本
  需要特征工程                      理解复杂语义
  难以处理长文本                    支持长文本推理
```

### 4.2 使用 LLM 进行财务分析

```python
"""
使用大语言模型进行金融文本深度分析
支持 OpenAI GPT-4、Anthropic Claude、DeepSeek 等
依赖: pip install openai anthropic
"""

import json
import os
from dataclasses import dataclass
from enum import Enum


class SentimentLabel(Enum):
    VERY_BULLISH = "强烈看多"
    BULLISH = "看多"
    NEUTRAL = "中性"
    BEARISH = "看空"
    VERY_BEARISH = "强烈看空"


@dataclass
class AnalysisResult:
    sentiment: SentimentLabel
    confidence: float
    key_points: list[str]
    risk_factors: list[str]
    trading_signal: float  # -1 到 1


FINANCIAL_ANALYSIS_PROMPT = """你是一位资深的金融分析师，请对以下金融文本进行深度分析。

请以 JSON 格式返回分析结果，包含以下字段:
{
    "sentiment": "强烈看多/看多/中性/看空/强烈看空",
    "confidence": 0.0-1.0,
    "key_points": ["关键信息1", "关键信息2"],
    "risk_factors": ["风险因素1"],
    "reasoning": "分析推理过程",
    "trading_signal": -1.0 到 1.0 的数值
}

要求:
1. 基于文本事实分析，不要臆测
2. 考虑行业背景和市场环境
3. 区分短期影响和长期影响
4. 识别潜在的风险因素
"""


class LLMFinancialAnalyzer:
    """
    基于 LLM 的金融文本分析器

    支持多种 LLM 后端:
    - OpenAI: GPT-4, GPT-4o
    - Anthropic: Claude 3.5 Sonnet, Claude 4
    - DeepSeek: DeepSeek-V3, DeepSeek-R1
    """

    def __init__(self, provider: str = "openai", model: str = "gpt-4o"):
        self.provider = provider
        self.model = model
        self._init_client()

    def _init_client(self):
        """初始化 API 客户端"""
        if self.provider == "openai":
            from openai import OpenAI
            self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        elif self.provider == "anthropic":
            import anthropic
            self.client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        elif self.provider == "deepseek":
            from openai import OpenAI
            self.client = OpenAI(
                api_key=os.getenv("DEEPSEEK_API_KEY"),
                base_url="https://api.deepseek.com/v1",
            )
        else:
            raise ValueError(f"不支持的 provider: {self.provider}")

    def analyze(self, text: str) -> AnalysisResult:
        """分析单条金融文本"""
        response_text = self._call_llm(text)
        return self._parse_response(response_text)

    def _call_llm(self, text: str) -> str:
        """调用 LLM API"""
        messages = [
            {"role": "system", "content": FINANCIAL_ANALYSIS_PROMPT},
            {"role": "user", "content": f"请分析以下金融文本:\n\n{text}"},
        ]

        if self.provider == "anthropic":
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1000,
                messages=messages[1:],  # Claude 用 system 参数
                system=messages[0]["content"],
            )
            return response.content[0].text
        else:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.1,  # 低温度保证稳定性
                max_tokens=1000,
            )
            return response.choices[0].message.content

    def _parse_response(self, response_text: str) -> AnalysisResult:
        """解析 LLM 返回的 JSON"""
        try:
            # 提取 JSON 部分
            json_start = response_text.find("{")
            json_end = response_text.rfind("}") + 1
            json_str = response_text[json_start:json_end]
            data = json.loads(json_str)

            sentiment_map = {
                "强烈看多": SentimentLabel.VERY_BULLISH,
                "看多": SentimentLabel.BULLISH,
                "中性": SentimentLabel.NEUTRAL,
                "看空": SentimentLabel.BEARISH,
                "强烈看空": SentimentLabel.VERY_BEARISH,
            }

            return AnalysisResult(
                sentiment=sentiment_map.get(data["sentiment"], SentimentLabel.NEUTRAL),
                confidence=float(data.get("confidence", 0.5)),
                key_points=data.get("key_points", []),
                risk_factors=data.get("risk_factors", []),
                trading_signal=float(data.get("trading_signal", 0.0)),
            )
        except (json.JSONDecodeError, KeyError) as e:
            return AnalysisResult(
                sentiment=SentimentLabel.NEUTRAL,
                confidence=0.0,
                key_points=[f"解析失败: {e}"],
                risk_factors=["LLM 输出格式异常"],
                trading_signal=0.0,
            )

    def batch_analyze(self, texts: list[str]) -> list[AnalysisResult]:
        """批量分析（带速率控制）"""
        import time

        results = []
        for i, text in enumerate(texts):
            result = self.analyze(text)
            results.append(result)
            if i < len(texts) - 1:
                time.sleep(1)  # 避免 API 限速
        return results


# ===== 使用示例 =====
if __name__ == "__main__":
    # 需要设置环境变量: OPENAI_API_KEY 或 ANTHROPIC_API_KEY 或 DEEPSEEK_API_KEY
    analyzer = LLMFinancialAnalyzer(provider="deepseek", model="deepseek-chat")

    test_text = """
    某公司发布2025年年报，全年实现营收120亿元，同比增长35%。
    净利润15亿元，同比增长50%。但经营性现金流为-8亿元，
    应收账款较上年增长120%。公司同时公告拟发行可转债融资30亿元。
    """

    result = analyzer.analyze(test_text)
    print(f"情感: {result.sentiment.value}")
    print(f"置信度: {result.confidence:.2%}")
    print(f"关键点: {result.key_points}")
    print(f"风险因素: {result.risk_factors}")
    print(f"交易信号: {result.trading_signal}")
```

## 五、社交媒体情绪信号

### 5.1 数据来源

```
A 股投资者情绪数据来源:

┌─────────────┬──────────────┬─────────────┐
│   平台       │   数据类型    │   信号特点   │
├─────────────┼──────────────┼─────────────┤
│ 东方财富股吧 │ 散户讨论      │ 情绪化、噪声大│
│ 雪球         │ 中高端投资者  │ 质量较高     │
│ 互动易       │ 上市公司问答  │ 官方回复     │
│ 研报摘要     │ 机构观点      │ 专业、滞后   │
│ 财经新闻     │ 事件驱动      │ 时效性强     │
└─────────────┴──────────────┴─────────────┘
```

### 5.2 情绪因子构建

```python
"""
社交媒体情绪因子构建
将文本情感转化为可交易的量化因子
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta


class SentimentFactorBuilder:
    """
    社交媒体情绪因子构建器

    因子设计:
    1. sentiment_mean: 平均情感得分
    2. sentiment_pos_ratio: 正面帖子占比
    3. sentiment_volume: 讨论热度（帖子数量）
    4. sentiment_divergence: 情绪分歧度
    5. sentiment_momentum: 情绪动量（变化率）
    """

    def __init__(self):
        self.factor_names = [
            "sentiment_mean",
            "sentiment_pos_ratio",
            "sentiment_volume",
            "sentiment_divergence",
            "sentiment_momentum",
        ]

    def build_daily_factors(
        self,
        sentiment_data: pd.DataFrame,
        stock_code: str,
        date: str,
        lookback_days: int = 5,
    ) -> dict:
        """
        构建单只股票某日的情绪因子

        参数:
            sentiment_data: 包含 [date, stock_code, text, score] 的 DataFrame
            stock_code: 股票代码
            date: 目标日期
            lookback_days: 回看天数
        """
        end_date = pd.Timestamp(date)
        start_date = end_date - timedelta(days=lookback_days)

        # 筛选数据
        mask = (
            (sentiment_data["stock_code"] == stock_code)
            & (sentiment_data["date"] >= start_date)
            & (sentiment_data["date"] <= end_date)
        )
        period_data = sentiment_data[mask]

        if len(period_data) == 0:
            return {name: np.nan for name in self.factor_names}

        scores = period_data["score"].values

        # 1. 平均情感得分
        sentiment_mean = np.mean(scores)

        # 2. 正面帖子占比
        sentiment_pos_ratio = np.mean(scores > 0.1)

        # 3. 讨论热度（对数化帖子数量）
        sentiment_volume = np.log1p(len(period_data))

        # 4. 情绪分歧度（标准差）
        sentiment_divergence = np.std(scores) if len(scores) > 1 else 0.0

        # 5. 情绪动量（最近一天 vs 前几天的变化）
        if len(period_data) >= 2:
            recent = period_data[period_data["date"] == end_date]["score"].mean()
            earlier = period_data[period_data["date"] < end_date]["score"].mean()
            sentiment_momentum = recent - earlier
        else:
            sentiment_momentum = 0.0

        return {
            "sentiment_mean": round(sentiment_mean, 4),
            "sentiment_pos_ratio": round(sentiment_pos_ratio, 4),
            "sentiment_volume": round(sentiment_volume, 4),
            "sentiment_divergence": round(sentiment_divergence, 4),
            "sentiment_momentum": round(sentiment_momentum, 4),
        }

    def build_cross_section_factors(
        self,
        sentiment_data: pd.DataFrame,
        date: str,
        lookback_days: int = 5,
    ) -> pd.DataFrame:
        """
        构建截面情绪因子（所有股票某日的因子值）

        返回 DataFrame: index=stock_code, columns=factor_names
        """
        stocks = sentiment_data["stock_code"].unique()
        results = {}

        for stock in stocks:
            factors = self.build_daily_factors(
                sentiment_data, stock, date, lookback_days
            )
            results[stock] = factors

        df = pd.DataFrame(results).T
        df.index.name = "stock_code"

        # 截面标准化（Z-Score）
        for col in self.factor_names:
            mean = df[col].mean()
            std = df[col].std()
            if std > 0:
                df[col] = (df[col] - mean) / std

        return df

    def calculate_ic(
        self,
        factor_df: pd.DataFrame,
        forward_returns: pd.Series,
    ) -> pd.DataFrame:
        """
        计算因子 IC（信息系数）

        参数:
            factor_df: 因子值 DataFrame
            forward_returns: 未来收益率 Series (index=stock_code)

        返回:
            IC 值 DataFrame
        """
        ic_results = {}
        common_stocks = factor_df.index.intersection(forward_returns.index)

        for factor_name in self.factor_names:
            factor_values = factor_df.loc[common_stocks, factor_name].dropna()
            returns = forward_returns.loc[factor_values.index]

            if len(factor_values) > 10:
                ic = factor_values.corr(returns, method="spearman")
                ic_results[factor_name] = round(ic, 4)
            else:
                ic_results[factor_name] = np.nan

        return pd.DataFrame([ic_results], index=["IC"])


# ===== 使用示例 =====
if __name__ == "__main__":
    # 模拟数据
    np.random.seed(42)
    dates = pd.date_range("2025-01-01", periods=20, freq="B")
    stocks = ["000001", "000002", "000003", "000004", "000005"]

    data = []
    for date in dates:
        for stock in stocks:
            n_posts = np.random.randint(5, 50)
            for _ in range(n_posts):
                data.append({
                    "date": date,
                    "stock_code": stock,
                    "text": "模拟帖子内容",
                    "score": np.random.normal(0, 0.5),
                })

    sentiment_df = pd.DataFrame(data)

    # 构建因子
    builder = SentimentFactorBuilder()
    factors = builder.build_cross_section_factors(sentiment_df, "2025-01-20")

    print("情绪因子截面数据:")
    print(factors.head())

    # 计算 IC（使用模拟的未来收益率）
    mock_returns = pd.Series(
        np.random.normal(0.01, 0.05, len(stocks)),
        index=stocks,
    )
    ic = builder.calculate_ic(factors, mock_returns)
    print("\n因子 IC 值:")
    print(ic)
```

## 六、常见误区

### 误区一：忽视数据泄露

```
错误做法:
  用当天的新闻预测当天的收益
  → 你不可能在收盘前就获得所有新闻并完成分析

正确做法:
  用 T 日收盘后的新闻 → 预测 T+1 日收益
  用 T 日早盘前的新闻 → 预测 T 日日内收益（需要考虑处理延迟）
```

### 误区二：过度依赖单一情感指标

情感分数只是原始信号，需要进一步加工：
- 计算情绪偏离度（个股情绪 vs 市场整体情绪）
- 考虑情绪的持续性和动量
- 结合成交量（高讨论量 + 异常情绪 = 更强信号）

### 误区三：忽视 LLM 的不确定性

LLM 分析存在幻觉风险，同一文本多次分析可能得到不同结果。建议：
- 对每条文本分析 3-5 次，取多数投票
- 设置置信度阈值，低于阈值的信号丢弃
- 关键决策需要人工复核

## 小结与练习

### 本课要点

1. 金融 NLP 面临否定词、隐含信息、反讽等独特挑战
2. 词典方法简单但局限性大，适合快速原型
3. BERT 方法需要标注数据，准确率更高
4. LLM 方法适合零样本分析，但成本较高且存在幻觉
5. 社交媒体情绪因子需要标准化和 IC 检验

### 练习一：构建否定词处理增强版

在词典方法基础上，实现一个更完善的否定词处理逻辑，能够正确处理以下情况：
- "不是不好" → 正面
- "并非利好" → 负面
- "没有亏损" → 正面

### 练习二：实现情绪动量因子

基于社交媒体数据，实现一个情绪动量因子，计算公式为：

```
emotion_momentum = EMA(sentiment_score, 3) - EMA(sentiment_score, 10)
```

其中 EMA 为指数移动平均。测试该因子与未来 5 日收益的 Rank IC。

---

## 参考答案

### 练习一

**思路**：维护一个否定词窗口，当遇到否定词时，记录其影响范围（通常为后 2-3 个词），在情感词判定时检查是否有活跃的否定词。

**答案**：

```python
def analyze_sentiment_enhanced(text: str) -> dict:
    words = tokenize_chinese(text)
    pos_count = 0
    neg_count = 0
    negation_window = 0  # 否定词影响窗口
    negation_count = 0   # 连续否定词计数

    for word in words:
        if word in NEGATION_WORDS:
            negation_count += 1
            negation_window = 3  # 影响后续 3 个词
            continue

        if word in POSITIVE_WORDS:
            if negation_count % 2 == 1:  # 奇数否定 → 反转
                neg_count += 1
            else:
                pos_count += 1
            negation_count = 0

        elif word in NEGATIVE_WORDS:
            if negation_count % 2 == 1:  # 奇数否定 → 反转
                pos_count += 0.5
            else:
                neg_count += 1
            negation_count = 0

        if negation_window > 0:
            negation_window -= 1
            if negation_window == 0:
                negation_count = 0

    total = pos_count + neg_count
    score = (pos_count - neg_count) / total if total > 0 else 0.0
    return {"score": score, "positive": pos_count, "negative": neg_count}
```

**要点**：
- 否定词计数判断奇偶性（双重否定 = 肯定）
- 使用窗口机制限制否定词影响范围
- 连续否定词需要叠加计数

### 练习二

**思路**：使用 pandas 的 ewm 方法计算 EMA，然后取短期 EMA 与长期 EMA 的差值作为动量信号。

**答案**：

```python
def calculate_emotion_momentum(
    daily_sentiment: pd.DataFrame,
    short_period: int = 3,
    long_period: int = 10,
) -> pd.Series:
    """
    计算情绪动量因子

    参数:
        daily_sentiment: DataFrame, columns=[date, stock_code, sentiment_score]
        short_period: 短期 EMA 周期
        long_period: 长期 EMA 周期

    返回:
        Series, index=stock_code, values=emotion_momentum
    """
    results = {}

    for stock in daily_sentiment["stock_code"].unique():
        stock_data = daily_sentiment[
            daily_sentiment["stock_code"] == stock
        ].sort_values("date")

        scores = stock_data["sentiment_score"]

        ema_short = scores.ewm(span=short_period, adjust=False).mean()
        ema_long = scores.ewm(span=long_period, adjust=False).mean()

        momentum = ema_short.iloc[-1] - ema_long.iloc[-1]
        results[stock] = momentum

    return pd.Series(results, name="emotion_momentum")


def validate_factor_ic(
    momentum: pd.Series,
    forward_returns: pd.Series,
    min_samples: int = 30,
) -> dict:
    """验证因子 IC"""
    common = momentum.index.intersection(forward_returns.index)
    m = momentum[common].dropna()
    r = forward_returns[m.index]

    if len(m) < min_samples:
        return {"ic": np.nan, "p_value": np.nan, "valid": False}

    from scipy import stats
    ic, p_value = stats.spearmanr(m, r)

    return {
        "ic": round(ic, 4),
        "p_value": round(p_value, 4),
        "valid": p_value < 0.05,
        "samples": len(m),
    }
```

**要点**：
- EMA 对近期数据赋予更高权重，能捕捉情绪的短期变化
- 短期 EMA 与长期 EMA 的差值反映情绪的加速度
- 因子有效性需要用 Rank IC 检验，且样本量需足够（建议 > 30）

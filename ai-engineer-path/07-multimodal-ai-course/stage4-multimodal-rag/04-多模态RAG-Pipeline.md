# 04 多模态 RAG Pipeline——图文混合检索 + 多模态 LLM 生成

> 多模态 RAG 结合检索和生成，实现图文问答。

## 学习目标

- 掌握多模态 RAG 的设计方法
- 理解图文混合检索和生成
- 学会构建多模态问答系统

---

## 一、系统架构

```
多模态 RAG 系统：

用户问题 → 向量化 → 检索 → 上下文组装 → LLM 生成 → 回答
  │          │        │          │            │        │
  ▼          ▼        ▼          ▼            ▼        ▼
文本/图片  文本/图片向量 图文结果  图文上下文  GPT-4o  图文回答
```

---

## 二、核心实现

```python
class MultimodalRAG:
    """多模态 RAG"""
    
    def __init__(self):
        self.index = MultimodalIndex()
        self.client = OpenAI()
    
    def add_document(self, doc_path: str):
        """添加文档"""
        # 解析文档
        elements = parse_document(doc_path)
        
        for element in elements:
            if element.category == "Image":
                self.index.add_image(element.metadata.image_path)
            else:
                self.index.add_text(element.text)
    
    def ask(self, question: str, include_images: bool = True) -> dict:
        """提问"""
        # 检索相关结果
        results = self.index.search(question, top_k=5)
        
        # 组装上下文
        context = self._build_context(results, include_images)
        
        # 生成答案
        answer = self._generate_answer(question, context)
        
        return {
            "answer": answer,
            "sources": results
        }
    
    def _build_context(self, results: list, include_images: bool) -> list:
        """组装上下文"""
        context = []
        
        for result in results:
            if result["type"] == "text":
                context.append({
                    "type": "text",
                    "text": result["content"]
                })
            elif result["type"] == "image" and include_images:
                context.append({
                    "type": "image_url",
                    "image_url": {"url": result["path"]}
                })
        
        return context
    
    def _generate_answer(self, question: str, context: list) -> str:
        """生成答案"""
        messages = [{
            "role": "user",
            "content": [
                {"type": "text", "text": f"基于以下信息回答问题：\n\n问题：{question}"},
                *context
            ]
        }]
        
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=messages
        )
        
        return response.choices[0].message.content
```

---

## 三、使用示例

```python
rag = MultimodalRAG()
rag.add_document("product_catalog.pdf")

result = rag.ask("这款产品的外观是什么样的？")
print(result["answer"])
```

---

## 四、优化策略

```
多模态 RAG 优化：

1. 检索优化
   - 调整 top_k
   - 混合检索策略
   - 重排序

2. 上下文优化
   - 限制上下文大小
   - 优先高质量结果
   - 去重

3. 生成优化
   - 优化 Prompt
   - 流式输出
   - 引用溯源
```

---

## 五、评估

```python
def evaluate_multimodal_rag(rag: MultimodalRAG, test_cases: list) -> dict:
    """评估多模态 RAG"""
    results = []
    
    for case in test_cases:
        answer = rag.ask(case["question"])
        score = evaluate_answer(answer["answer"], case["reference"])
        results.append(score)
    
    return {
        "avg_score": sum(results) / len(results),
        "min_score": min(results),
        "max_score": max(results)
    }
```

---

## 小结

```
本课核心要点：

1. 多模态 RAG 结合图文检索和生成
2. 支持文本和图片混合上下文
3. 用 GPT-4o 生成图文回答
4. 优化策略：检索、上下文、生成

下一课：评估多模态 RAG——多模态场景下的评估指标与方法。
```

---

## 练习

1. **系统题**：构建一个多模态 RAG 系统。

2. **检索题**：优化检索效果。

3. **评估题**：评估系统效果。

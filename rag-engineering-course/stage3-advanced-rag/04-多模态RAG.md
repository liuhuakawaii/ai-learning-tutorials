# 04 - 多模态 RAG

> Stage 3 Lesson 4 | 前置要求：Lesson 03 完成 | 时长：50 分钟

```
╔══════════════════════════════════════════════════════════════╗
║           多模态 RAG: 文字与图像的交响曲                      ║
║                                                              ║
║    "一图胜千言，但图文结合才能讲完整的故事"                   ║
╚══════════════════════════════════════════════════════════════╝
```

## 场景引入

你的产品手册里有大量截图、流程图和示意图，用户问"设置页面的高级选项在哪里"时，纯文本 RAG 只能检索到文字描述，无法定位到具体的截图位置。更常见的情况是，技术文档中的架构图包含了关键信息，但这些信息完全以图像形式存在，文本提取器对此无能为力。多模态 RAG 让系统能够同时理解和检索文本与图像，真正做到"图文并茂"的知识检索。

## 🎯 学习目标

完成本课后，你将能够：

1. 理解图文嵌入（CLIP）的原理和使用
2. 构建多模态向量索引
3. 实现跨模态检索（文本搜图、图搜文本）
4. 使用 GPT-4V 等模型进行多模态生成

---

## 1. 为什么需要多模态 RAG？

### 1.1 纯文本 RAG 的盲区

现实世界的数据不只是文字。技术文档有图表，医疗报告有影像，教育材料有示意图：

```
  纯文本 RAG 的局限
  ═════════════════

  文档内容:
  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  "如图所示，2024年Q1营收同比增长30%..."          │
  │                                                  │
  │       ┌─────────────────────┐                    │
  │       │  📊 营收趋势图       │                    │
  │       │  (一张折线图)        │                    │
  │       └─────────────────────┘                    │
  │                                                  │
  │  "其中，亚太市场贡献了主要增长..."               │
  └──────────────────────────────────────────────────┘

  纯文本 RAG 只能提取:
  → "如图所示，2024年Q1营收同比增长30%..."
  → "亚太市场贡献了主要增长..."
  → ❌ 丢失了图表中的关键数据!
```

### 1.2 多模态 RAG 的核心思想

```
  多模态 RAG Pipeline
  ═══════════════════

  ┌───────────────────────────────────────────────────────────────┐
  │                   多模态 RAG 完整管道                         │
  │                                                               │
  │   输入文档 (图文混合)                                         │
  │      │                                                        │
  │      ├──► 文本提取 ──► 文本嵌入 ──► 文本向量库                │
  │      │                                                        │
  │      └──► 图像提取 ──► 图像嵌入 ──► 图像向量库                │
  │                               │                               │
  │                               ▼                               │
  │                      统一多模态向量空间                        │
  │                               │                               │
  │                               ▼                               │
  │   用户查询 ──► 查询嵌入 ──► 跨模态检索                       │
  │                               │                               │
  │                               ├──► 相关文本片段               │
  │                               └──► 相关图像                   │
  │                                        │                       │
  │                                        ▼                       │
  │                               多模态 LLM 生成答案             │
  │                               (GPT-4V / Claude 3)             │
  └───────────────────────────────────────────────────────────────┘
```

---

## 2. CLIP 嵌入模型

### 2.1 CLIP 原理简介

CLIP（Contrastive Language-Image Pre-training）是 OpenAI 提出的多模态模型，
能够将文本和图像映射到同一个向量空间。

```
  CLIP 的工作原理
  ═══════════════

  文本: "一只可爱的猫"          图像: 🐱
       │                              │
       ▼                              ▼
  ┌──────────┐                ┌──────────┐
  │Text      │                │Vision    │
  │Encoder   │                │Encoder   │
  └────┬─────┘                └────┬─────┘
       │                              │
       ▼                              ▼
  [0.12, -0.34, ...]            [0.11, -0.32, ...]
       │                              │
       └──────────┬───────────────────┘
                  │
                  ▼
           余弦相似度 = 0.95
           (匹配成功!)
```

### 2.2 CLIP 代码实现

```python
"""
多模态 RAG 实现
Stage 3 - Lesson 04
"""

import os
import torch
import numpy as np
from PIL import Image
from typing import Optional
from dataclasses import dataclass, field
from transformers import CLIPProcessor, CLIPModel
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

os.environ["OPENAI_API_KEY"] = "your-api-key-here"


@dataclass
class MultiModalDocument:
    """多模态文档"""
    doc_id: str
    text: str = ""
    image_path: Optional[str] = None
    image: Optional[Image.Image] = None
    text_embedding: Optional[np.ndarray] = None
    image_embedding: Optional[np.ndarray] = None
    metadata: dict = field(default_factory=dict)


class CLIPEmbedder:
    """CLIP 多模态嵌入器"""

    def __init__(self, model_name: str = "openai/clip-vit-base-patch32"):
        self.model = CLIPModel.from_pretrained(model_name)
        self.processor = CLIPProcessor.from_pretrained(model_name)
        self.model.eval()

    def embed_text(self, text: str) -> np.ndarray:
        """文本嵌入"""
        inputs = self.processor(
            text=[text],
            return_tensors="pt",
            padding=True,
            truncation=True,
        )
        with torch.no_grad():
            features = self.model.get_text_features(**inputs)
        # L2 归一化
        features = features / features.norm(dim=-1, keepdim=True)
        return features.numpy().flatten()

    def embed_image(self, image: Image.Image) -> np.ndarray:
        """图像嵌入"""
        inputs = self.processor(
            images=image,
            return_tensors="pt",
        )
        with torch.no_grad():
            features = self.model.get_image_features(**inputs)
        features = features / features.norm(dim=-1, keepdim=True)
        return features.numpy().flatten()

    def embed_batch_text(self, texts: list[str]) -> np.ndarray:
        """批量文本嵌入"""
        inputs = self.processor(
            text=texts,
            return_tensors="pt",
            padding=True,
            truncation=True,
        )
        with torch.no_grad():
            features = self.model.get_text_features(**inputs)
        features = features / features.norm(dim=-1, keepdim=True)
        return features.numpy()

    def embed_batch_images(self, images: list[Image.Image]) -> np.ndarray:
        """批量图像嵌入"""
        inputs = self.processor(
            images=images,
            return_tensors="pt",
        )
        with torch.no_grad():
            features = self.model.get_image_features(**inputs)
        features = features / features.norm(dim=-1, keepdim=True)
        return features.numpy()
```

---

## 3. 多模态向量数据库

### 3.1 多模态索引

```python
class MultiModalVectorStore:
    """多模态向量数据库"""

    def __init__(self, embedder: CLIPEmbedder):
        self.embedder = embedder
        self.documents: dict[str, MultiModalDocument] = {}
        self.text_index: Optional[np.ndarray] = None
        self.image_index: Optional[np.ndarray] = None
        self.text_ids: list[str] = []
        self.image_ids: list[str] = []

    def add_document(self, doc: MultiModalDocument):
        """添加多模态文档"""
        # 嵌入文本
        if doc.text:
            doc.text_embedding = self.embedder.embed_text(doc.text)

        # 嵌入图像
        if doc.image is not None:
            doc.image_embedding = self.embedder.embed_image(doc.image)
        elif doc.image_path and os.path.exists(doc.image_path):
            doc.image = Image.open(doc.image_path).convert("RGB")
            doc.image_embedding = self.embedder.embed_image(doc.image)

        self.documents[doc.doc_id] = doc

    def build_index(self):
        """构建向量索引"""
        text_embeddings = []
        image_embeddings = []
        self.text_ids = []
        self.image_ids = []

        for doc_id, doc in self.documents.items():
            if doc.text_embedding is not None:
                text_embeddings.append(doc.text_embedding)
                self.text_ids.append(doc_id)
            if doc.image_embedding is not None:
                image_embeddings.append(doc.image_embedding)
                self.image_ids.append(doc_id)

        if text_embeddings:
            self.text_index = np.vstack(text_embeddings)
        if image_embeddings:
            self.image_index = np.vstack(image_embeddings)

        print(f"索引构建完成: {len(self.text_ids)} 文本, {len(self.image_ids)} 图像")

    def search_by_text(
        self, query: str, top_k: int = 5
    ) -> list[tuple[str, float, str]]:
        """文本查询 - 检索文本和图像"""
        query_embedding = self.embedder.embed_text(query)
        results = []

        # 搜索文本索引
        if self.text_index is not None and len(self.text_ids) > 0:
            text_scores = self._cosine_similarity(
                query_embedding, self.text_index
            )
            for idx in np.argsort(text_scores)[::-1][:top_k]:
                doc_id = self.text_ids[idx]
                results.append((doc_id, float(text_scores[idx]), "text"))

        # 搜索图像索引
        if self.image_index is not None and len(self.image_ids) > 0:
            image_scores = self._cosine_similarity(
                query_embedding, self.image_index
            )
            for idx in np.argsort(image_scores)[::-1][:top_k]:
                doc_id = self.image_ids[idx]
                results.append((doc_id, float(image_scores[idx]), "image"))

        # 按分数排序
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]

    def search_by_image(
        self, image: Image.Image, top_k: int = 5
    ) -> list[tuple[str, float, str]]:
        """图像查询 - 检索文本和图像"""
        image_embedding = self.embedder.embed_image(image)
        results = []

        # 搜索文本索引
        if self.text_index is not None and len(self.text_ids) > 0:
            text_scores = self._cosine_similarity(
                image_embedding, self.text_index
            )
            for idx in np.argsort(text_scores)[::-1][:top_k]:
                doc_id = self.text_ids[idx]
                results.append((doc_id, float(text_scores[idx]), "text"))

        # 搜索图像索引
        if self.image_index is not None and len(self.image_ids) > 0:
            image_scores = self._cosine_similarity(
                image_embedding, self.image_index
            )
            for idx in np.argsort(image_scores)[::-1][:top_k]:
                doc_id = self.image_ids[idx]
                results.append((doc_id, float(image_scores[idx]), "image"))

        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]

    @staticmethod
    def _cosine_similarity(query: np.ndarray, index: np.ndarray) -> np.ndarray:
        """计算余弦相似度"""
        query_norm = query / np.linalg.norm(query)
        index_norm = index / np.linalg.norm(index, axis=1, keepdims=True)
        return np.dot(index_norm, query_norm)
```

---

## 4. 多模态检索与生成

### 4.1 多模态 RAG 系统

```python
class MultiModalRAG:
    """
    多模态 RAG 系统

    支持:
    - 文本查询检索文本和图像
    - 图像查询检索相关文本和图像
    - 使用 GPT-4V 生成包含图文的答案
    """

    def __init__(self, embedder: CLIPEmbedder, llm=None):
        self.embedder = embedder
        self.vectorstore = MultiModalVectorStore(embedder)
        self.llm = llm or ChatOpenAI(model="gpt-4o-mini")

    def add_documents(self, documents: list[MultiModalDocument]):
        """添加文档"""
        for doc in documents:
            self.vectorstore.add_document(doc)
        self.vectorstore.build_index()

    def query_by_text(self, question: str, top_k: int = 5) -> str:
        """文本查询"""
        # 检索
        results = self.vectorstore.search_by_text(question, top_k=top_k)

        if not results:
            return "未找到相关信息。"

        # 分离文本和图像结果
        text_results = []
        image_results = []

        for doc_id, score, modality in results:
            doc = self.vectorstore.documents[doc_id]
            if modality == "text" and doc.text:
                text_results.append(f"[相似度:{score:.2f}] {doc.text}")
            elif modality == "image":
                image_results.append(doc)

        # 构建上下文
        text_context = "\n\n".join(text_results) if text_results else ""

        # 生成答案
        if image_results:
            # 有图像时使用多模态生成
            return self._generate_multimodal_answer(
                question, text_context, image_results
            )
        else:
            # 纯文本生成
            return self._generate_text_answer(question, text_context)

    def query_by_image(self, image: Image.Image, top_k: int = 5) -> str:
        """图像查询"""
        results = self.vectorstore.search_by_image(image, top_k=top_k)

        if not results:
            return "未找到相关信息。"

        text_results = []
        image_results = []

        for doc_id, score, modality in results:
            doc = self.vectorstore.documents[doc_id]
            if modality == "text" and doc.text:
                text_results.append(f"[相似度:{score:.2f}] {doc.text}")
            elif modality == "image":
                image_results.append(doc)

        text_context = "\n\n".join(text_results) if text_results else ""

        return self._generate_multimodal_answer(
            "请描述这张图片的相关信息", text_context, image_results
        )

    def _generate_text_answer(self, question: str, context: str) -> str:
        """纯文本答案生成"""
        prompt = ChatPromptTemplate.from_template(
            """基于以下检索到的文本信息回答问题。

检索到的文本:
{context}

问题: {question}

请给出准确、详细的回答:"""
        )
        chain = prompt | self.llm
        result = chain.invoke({"context": context, "question": question})
        return result.content

    def _generate_multimodal_answer(
        self,
        question: str,
        text_context: str,
        image_docs: list[MultiModalDocument],
    ) -> str:
        """多模态答案生成（使用 GPT-4V）"""
        # 构建多模态消息
        messages_content = []

        # 添加文本上下文
        if text_context:
            messages_content.append({
                "type": "text",
                "text": f"检索到的文本信息:\n{text_context}",
            })

        # 添加图像
        for doc in image_docs[:3]:  # 最多3张图
            if doc.image_path:
                messages_content.append({
                    "type": "image_url",
                    "image_url": {"url": f"file://{doc.image_path}"},
                })

        # 添加问题
        messages_content.append({
            "type": "text",
            "text": f"\n问题: {question}\n\n请基于以上文本和图像信息回答问题。",
        })

        # 使用支持视觉的模型
        vision_llm = ChatOpenAI(model="gpt-4o")
        result = vision_llm.invoke([
            {"role": "user", "content": messages_content}
        ])

        return result.content
```

---

## 5. 使用示例

```python
def main():
    """多模态 RAG 演示"""

    # 初始化
    embedder = CLIPEmbedder()
    rag = MultiModalRAG(embedder=embedder)

    # 创建示例文档（实际使用时替换为真实数据）
    documents = [
        MultiModalDocument(
            doc_id="doc1",
            text="Python 是一种解释型、面向对象的高级编程语言。",
        ),
        MultiModalDocument(
            doc_id="doc2",
            text="机器学习算法包括监督学习、无监督学习和强化学习。",
        ),
        MultiModalDocument(
            doc_id="doc3",
            text="深度学习使用多层神经网络，擅长处理图像和语音数据。",
        ),
        # 如果有图像文件:
        # MultiModalDocument(
        #     doc_id="img1",
        #     text="神经网络结构示意图",
        #     image_path="neural_network.png",
        # ),
    ]

    rag.add_documents(documents)

    # 文本查询
    questions = [
        "什么是 Python？",
        "机器学习有哪些类型？",
        "深度学习擅长处理什么数据？",
    ]

    for q in questions:
        print(f"\n{'='*60}")
        print(f"问题: {q}")
        answer = rag.query_by_text(q)
        print(f"答案: {answer}")
```

---

## 6. 对比分析

### Text-only RAG vs Multi-modal RAG

| 维度 | Text-only RAG | Multi-modal RAG |
|------|---------------|-----------------|
| **输入类型** | 纯文本 | 文本 + 图像 |
| **嵌入模型** | 文本嵌入模型 | CLIP / 多模态嵌入 |
| **索引结构** | 单一文本向量库 | 文本 + 图像双索引 |
| **检索方式** | 文本搜文本 | 跨模态检索 |
| **生成模型** | 普通 LLM | 多模态 LLM (GPT-4V) |
| **实现复杂度** | ⭐ 低 | ⭐⭐⭐ 高 |
| **适用场景** | 纯文本文档 | 图文混合文档 |
| **信息完整性** | 丢失视觉信息 | 保留图文信息 |
| **成本** | 低 | 较高（图像处理 + 视觉模型） |

---

## 7. 常见误区

### ❌ 错误 1：忽略图像预处理

```python
# ❌ 错误：直接使用原始图像
image = Image.open("photo.jpg")  # 可能很大，格式不统一

# ✅ 正确：标准化预处理
def preprocess_image(image_path: str, max_size: int = 512) -> Image.Image:
    image = Image.open(image_path).convert("RGB")
    # 等比缩放
    ratio = max_size / max(image.size)
    if ratio < 1:
        new_size = tuple(int(dim * ratio) for dim in image.size)
        image = image.resize(new_size, Image.Resampling.LANCZOS)
    return image
```

### ❌ 错误 2：文本和图像嵌入不匹配

```python
# ❌ 错误：用不同的模型嵌入文本和图像
text_model = SentenceTransformer("all-MiniLM-L6-v2")
clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
# 两个模型的向量空间不同，无法比较!

# ✅ 正确：使用同一个 CLIP 模型嵌入文本和图像
embedder = CLIPEmbedder()  # 统一使用 CLIP
text_emb = embedder.embed_text("一只猫")
image_emb = embedder.embed_image(cat_image)
# 现在可以在同一空间比较
```

### ❌ 错误 3：发送过多图像给 LLM

```python
# ❌ 错误：发送所有检索到的图像
images = retrieve_images(query, top_k=10)
send_to_gpt4v(images)  # 成本高，且可能超出 token 限制

# ✅ 正确：限制图像数量，选择最相关的
images = retrieve_images(query, top_k=3)  # 最多3张
```

---

## 工程建议

1. **图像描述的质量比数量更重要**：生成图像描述时，不要追求"描述所有细节"，而是提取与业务相关的关键信息。一张架构图的关键信息可能是"系统由前端、API 网关、微服务集群和数据库四层组成"，而不是颜色和布局。
2. **文本和图像的 Embedding 空间要对齐**：如果用不同的模型分别编码文本和图像，它们的向量空间可能不一致。使用 CLIP 等多模态模型确保文本和图像在同一个向量空间中。
3. **图像存储要考虑成本**：高分辨率图片占用大量存储空间。建议在入库时对图片做压缩和标准化处理，保留足够 OCR 和视觉理解的分辨率即可。
4. **分模态评估检索质量**：分别统计纯文本查询和图文查询的检索质量指标。如果图文查询的 Recall 明显低于纯文本，说明图像处理或跨模态对齐需要优化。

---

## 📝 本课小结

```
  多模态 RAG 核心要点
  ═══════════════════

  ┌─────────────────────────────────────────────────────┐
  │  1. CLIP 将文本和图像映射到同一向量空间             │
  │     → 实现跨模态语义匹配                           │
  │                                                     │
  │  2. 多模态向量数据库支持双索引                      │
  │     → 文本索引 + 图像索引                          │
  │                                                     │
  │  3. 跨模态检索：文本搜图、图搜文本                  │
  │     → 统一的相似度计算                             │
  │                                                     │
  │  4. GPT-4V 等视觉模型支持多模态生成                 │
  │     → 同时理解文字和图像                           │
  │                                                     │
  │  5. 图像预处理和数量控制很重要                      │
  │     → 平衡信息完整性和成本                         │
  └─────────────────────────────────────────────────────┘
```

---

## 🏋️ 练习题

### 练习 1：图像描述增强（基础）

实现一个图像描述生成器，使用 BLIP 或 LLaVA 模型为图像自动生成文本描述，并将描述也加入文本索引。

**要求**：
- 加载 BLIP 模型
- 为每张图像生成描述
- 将描述作为额外的文本索引

### 练习 2：PDF 图文提取（进阶）

实现一个 PDF 多模态提取器，能够：
- 提取 PDF 中的文字内容
- 提取 PDF 中的图片
- 保持图文的对应关系

### 练习 3：多模态评估（挑战）

构建一个多模态 RAG 评估框架，对比：
- 纯文本 RAG（只用文字）
- 图像增强 RAG（用图像描述替代图像）
- 完整多模态 RAG（图文混合）

评估维度：准确率、信息完整性、用户满意度。

---

> 📌 **下一课**：[05 - 层级检索 HIERARCHICAL](./05-层级检索HIERARCHICAL.md) — 多级索引处理长文档

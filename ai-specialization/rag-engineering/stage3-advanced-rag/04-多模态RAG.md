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

---

## 参考答案

### 练习 1：图像描述增强（基础）

**思路**：使用 BLIP 模型的 Image-to-Text 功能为每张图像自动生成文本描述，然后将描述作为额外的文本 Document 加入文本索引，实现"以文搜图"的增强效果。

**答案**：

```python
from transformers import BlipProcessor, BlipForConditionalGeneration
from PIL import Image


class ImageCaptioner:
    """基于 BLIP 的图像描述生成器"""

    def __init__(self, model_name: str = "Salesforce/blip-image-captioning-base"):
        self.processor = BlipProcessor.from_pretrained(model_name)
        self.model = BlipForConditionalGeneration.from_pretrained(model_name)
        self.model.eval()

    def caption(self, image_path: str, max_length: int = 100) -> str:
        """为单张图像生成描述"""
        image = Image.open(image_path).convert("RGB")
        inputs = self.processor(image, return_tensors="pt")
        output = self.model.generate(**inputs, max_length=max_length)
        caption = self.processor.decode(output[0], skip_special_tokens=True)
        return caption

    def caption_batch(self, image_paths: list[str]) -> list[str]:
        """批量生成图像描述"""
        return [self.caption(path) for path in image_paths]


class EnhancedMultiModalRAG(MultiModalRAG):
    """带图像描述增强的多模态 RAG"""

    def __init__(self, embedder: CLIPEmbedder, llm=None):
        super().__init__(embedder, llm)
        self.captioner = ImageCaptioner()

    def add_documents_with_captions(self, documents: list[MultiModalDocument]):
        """添加文档并为图像自动生成描述"""
        for doc in documents:
            # 如果有图像但没有文本描述，自动生成
            if doc.image_path and not doc.text:
                caption = self.captioner.caption(doc.image_path)
                doc.text = f"[图像描述] {caption}"
                print(f"  🖼️ 为 {doc.doc_id} 生成描述: {caption}")

            # 如果有图像且已有文本，追加描述作为补充
            elif doc.image_path and doc.text:
                caption = self.captioner.caption(doc.image_path)
                doc.text = f"{doc.text}\n[图像描述] {caption}"

            self.vectorstore.add_document(doc)

        self.vectorstore.build_index()
        print(f"✅ 已索引 {len(documents)} 个文档（含图像描述增强）")


# 使用示例
embedder = CLIPEmbedder()
rag = EnhancedMultiModalRAG(embedder=embedder)

documents = [
    MultiModalDocument(
        doc_id="img1",
        text="",  # 无文本，将自动生成描述
        image_path="architecture_diagram.png",
    ),
    MultiModalDocument(
        doc_id="doc1",
        text="系统架构说明文档",
        image_path="system_overview.png",  # 有文本也有图像
    ),
]

rag.add_documents_with_captions(documents)
# 现在可以用文本查询找到图像
results = rag.query_by_text("系统架构图是什么样的？")
```

**要点**：
- BLIP 生成的描述质量直接影响检索效果，如果描述不准确，文本检索就无法命中该图像
- 图像描述应标记为 `[图像描述]` 前缀，方便在检索结果中区分原始文本和自动生成的描述
- 已有文本的文档也应追加描述，因为图像中可能包含文本未提及的视觉信息

---

### 练习 2：PDF 图文提取（进阶）

**思路**：使用 `PyMuPDF`（fitz）提取 PDF 中的文字和图片，通过图片在页面中的位置信息保持图文的对应关系，为每张图片生成包含页码和上下文的结构化文档。

**答案**：

```python
import fitz  # PyMuPDF
from pathlib import Path
from dataclasses import dataclass


@dataclass
class PDFExtractedItem:
    page_num: int
    item_type: str  # "text" or "image"
    content: str  # 文本内容或图片保存路径
    bbox: tuple[float, float, float, float]  # (x0, y0, x1, y1)


class PDFMultiModalExtractor:
    """PDF 多模态提取器"""

    def __init__(self, output_dir: str = "extracted_images"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)

    def extract(self, pdf_path: str) -> list[MultiModalDocument]:
        """提取 PDF 中的文字和图片，保持图文对应关系"""
        doc = fitz.open(pdf_path)
        documents = []
        doc_name = Path(pdf_path).stem

        for page_num in range(len(doc)):
            page = doc[page_num]

            # 提取文本
            text_blocks = page.get_text("blocks")
            page_text = "\n".join([block[4] for block in text_blocks if block[6] == 0])

            # 提取图片
            image_list = page.get_images(full=True)
            image_paths = []

            for img_idx, img_info in enumerate(image_list):
                xref = img_info[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]

                image_filename = f"{doc_name}_p{page_num + 1}_img{img_idx}.{image_ext}"
                image_path = self.output_dir / image_filename

                with open(image_path, "wb") as f:
                    f.write(image_bytes)
                image_paths.append(str(image_path))

            if image_paths:
                # 有图片：为每张图片创建带上下文的文档
                for i, img_path in enumerate(image_paths):
                    documents.append(MultiModalDocument(
                        doc_id=f"{doc_name}_p{page_num + 1}_img{i}",
                        text=f"[第 {page_num + 1} 页上下文] {page_text[:500]}",
                        image_path=img_path,
                    ))
            elif page_text.strip():
                # 纯文本页
                documents.append(MultiModalDocument(
                    doc_id=f"{doc_name}_p{page_num + 1}",
                    text=page_text,
                ))

        doc.close()
        print(f"✅ 从 {pdf_path} 提取了 {len(documents)} 个文档")
        return documents

    def extract_with_page_context(
        self, pdf_path: str, context_chars: int = 300
    ) -> list[MultiModalDocument]:
        """提取图文并保留图片前后的文字上下文"""
        fitz_doc = fitz.open(pdf_path)
        documents = []
        doc_name = Path(pdf_path).stem

        for page_num in range(len(fitz_doc)):
            page = fitz_doc[page_num]
            full_text = page.get_text()
            image_list = page.get_images(full=True)

            for img_idx, img_info in enumerate(image_list):
                xref = img_info[0]
                base_image = fitz_doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]

                image_filename = f"{doc_name}_p{page_num + 1}_img{img_idx}.{image_ext}"
                image_path = self.output_dir / image_filename

                with open(image_path, "wb") as f:
                    f.write(image_bytes)

                # 获取图片在页面中的位置，提取前后的文字作为上下文
                img_rects = page.get_image_rects(xref)
                before_text = ""
                after_text = ""
                if img_rects:
                    img_rect = img_rects[0]
                    # 图片之前的文字
                    before_area = fitz.Rect(0, 0, page.rect.width, img_rect.y0)
                    before_text = page.get_text("text", clip=before_area)[-context_chars:]
                    # 图片之后的文字
                    after_area = fitz.Rect(0, img_rect.y1, page.rect.width, page.rect.height)
                    after_text = page.get_text("text", clip=after_area)[:context_chars]

                context = f"[前文] {before_text}\n[后文] {after_text}".strip()
                documents.append(MultiModalDocument(
                    doc_id=f"{doc_name}_p{page_num + 1}_img{img_idx}",
                    text=context if context != "[前文] \n[后文] " else f"第 {page_num + 1} 页图片",
                    image_path=str(image_path),
                ))

            # 纯文本页
            if not image_list:
                text = page.get_text().strip()
                if text:
                    documents.append(MultiModalDocument(
                        doc_id=f"{doc_name}_p{page_num + 1}",
                        text=text,
                    ))

        fitz_doc.close()
        return documents


# 使用示例
extractor = PDFMultiModalExtractor(output_dir="pdf_images")
docs = extractor.extract("technical_report.pdf")

# 将提取结果加入多模态 RAG
embedder = CLIPEmbedder()
rag = MultiModalRAG(embedder=embedder)
rag.add_documents(docs)
```

**要点**：
- PyMuPDF 能同时提取文本和图片，且保留图片在页面中的位置信息（bbox），这是保持图文对应关系的关键
- 图片前后各取 300 字符作为上下文，既不会太长干扰嵌入，又能提供足够的语义关联
- 每张图片都保存原始文件路径，在多模态生成时可以直接传给视觉模型

---

### 练习 3：多模态评估（挑战）

**思路**：构建三种 RAG 管道（纯文本、图像描述增强、完整多模态），在同一测试集上运行，用 LLM-as-Judge 评估准确率和信息完整性，用人工评分评估用户满意度。

**答案**：

```python
from dataclasses import dataclass
import json


@dataclass
class MultiModalTestCase:
    question: str
    expected_answer: str
    has_image_context: bool  # 该问题是否需要图像信息才能完整回答
    image_paths: list[str] = None  # 相关图像路径


class TextOnlyRAG:
    """纯文本 RAG（baseline）"""

    def __init__(self, vectorstore, llm):
        self.vectorstore = vectorstore
        self.llm = llm

    def query(self, question: str) -> str:
        docs = self.vectorstore.similarity_search(question, k=5)
        text_docs = [d for d in docs if not d.metadata.get("image_path")]
        context = "\n".join([d.page_content for d in text_docs])
        prompt = ChatPromptTemplate.from_template(
            "基于以下文本回答问题:\n{context}\n\n问题: {question}"
        )
        chain = prompt | self.llm
        return chain.invoke({"context": context, "question": question}).content


class CaptionEnhancedRAG:
    """图像描述增强 RAG（用图像描述替代图像）"""

    def __init__(self, vectorstore, llm):
        self.vectorstore = vectorstore
        self.llm = llm

    def query(self, question: str) -> str:
        docs = self.vectorstore.similarity_search(question, k=5)
        context = "\n".join([d.page_content for d in docs])
        prompt = ChatPromptTemplate.from_template(
            "基于以下文本和图像描述回答问题:\n{context}\n\n问题: {question}"
        )
        chain = prompt | self.llm
        return chain.invoke({"context": context, "question": question}).content


class MultiModalEvaluator:
    """多模态 RAG 评估框架"""

    def __init__(
        self,
        text_rag: TextOnlyRAG,
        caption_rag: CaptionEnhancedRAG,
        multimodal_rag: MultiModalRAG,
        llm,
    ):
        self.rags = {
            "text_only": text_rag,
            "caption_enhanced": caption_rag,
            "multimodal": multimodal_rag,
        }
        self.llm = llm

    def build_test_cases(self) -> list[MultiModalTestCase]:
        return [
            MultiModalTestCase(
                question="系统架构图中有哪些组件？",
                expected_answer="前端、API 网关、微服务集群、数据库",
                has_image_context=True,
            ),
            MultiModalTestCase(
                question="Python 是什么语言？",
                expected_answer="高级编程语言",
                has_image_context=False,
            ),
            MultiModalTestCase(
                question="神经网络结构示意图展示了什么？",
                expected_answer="输入层、隐藏层、输出层的连接关系",
                has_image_context=True,
            ),
            MultiModalTestCase(
                question="什么是向量数据库？",
                expected_answer="存储和检索高维向量的数据库",
                has_image_context=False,
            ),
            MultiModalTestCase(
                question="产品界面截图中的导航结构是怎样的？",
                expected_answer="顶部导航栏包含首页、产品、文档、关于",
                has_image_context=True,
            ),
        ]

    def _judge(self, question: str, expected: str, answer: str) -> dict:
        """LLM-as-Judge 评估"""
        prompt = ChatPromptTemplate.from_template(
            """评估以下答案的质量。

问题: {question}
期望要点: {expected}
实际答案: {answer}

请以 JSON 格式输出:
{{"accuracy": 1-5, "completeness": 1-5, "hallucination": true/false}}
accuracy: 答案与期望要点的吻合程度
completeness: 答案是否涵盖了所有关键信息
hallucination: 答案是否包含期望中不存在的虚构信息"""
        )
        chain = prompt | self.llm
        result = chain.invoke({
            "question": question,
            "expected": expected,
            "answer": answer,
        }).content
        try:
            return json.loads(result)
        except json.JSONDecodeError:
            return {"accuracy": 1, "completeness": 1, "hallucination": True}

    def evaluate(self) -> dict:
        """运行完整评估"""
        test_cases = self.build_test_cases()
        results = {name: [] for name in self.rags}

        for tc in test_cases:
            for rag_name, rag in self.rags.items():
                if rag_name == "multimodal":
                    answer = rag.query_by_text(tc.question)
                else:
                    answer = rag.query(tc.question)

                judgment = self._judge(tc.question, tc.expected_answer, answer)
                results[rag_name].append({
                    "question": tc.question,
                    "needs_image": tc.has_image_context,
                    "accuracy": judgment.get("accuracy", 1),
                    "completeness": judgment.get("completeness", 1),
                    "hallucination": judgment.get("hallucination", True),
                })

        return self._generate_report(results)

    def _generate_report(self, results: dict) -> dict:
        """生成对比报告"""
        report = {}
        for rag_name, items in results.items():
            image_items = [i for i in items if i["needs_image"]]
            text_items = [i for i in items if not i["needs_image"]]

            def avg(lst, key):
                return sum(i[key] for i in lst) / len(lst) if lst else 0

            report[rag_name] = {
                "overall_accuracy": avg(items, "accuracy"),
                "overall_completeness": avg(items, "completeness"),
                "hallucination_rate": sum(1 for i in items if i["hallucination"]) / len(items),
                "image_query_accuracy": avg(image_items, "accuracy"),
                "text_query_accuracy": avg(text_items, "accuracy"),
            }

        # 打印报告
        print("\n" + "=" * 70)
        print("📊 多模态 RAG 评估对比报告")
        print("=" * 70)
        header = f"{'指标':<25} {'纯文本':<15} {'描述增强':<15} {'完整多模态':<15}"
        print(header)
        print("-" * 70)
        metrics = ["overall_accuracy", "overall_completeness", "hallucination_rate",
                    "image_query_accuracy", "text_query_accuracy"]
        labels = ["整体准确率", "整体完整性", "幻觉率", "图文查询准确率", "纯文本准确率"]
        for metric, label in zip(metrics, labels):
            vals = [f"{report[name][metric]:.2f}" for name in self.rags]
            print(f"{label:<25} {vals[0]:<15} {vals[1]:<15} {vals[2]:<15}")
        print("=" * 70)

        return report


# 使用示例
evaluator = MultiModalEvaluator(text_rag, caption_rag, multimodal_rag, llm)
report = evaluator.evaluate()
```

**要点**：
- 三种管道共享同一个向量库，区别仅在于是否使用图像信息，确保评估的公平性
- 图文查询和纯文本查询应分开统计准确率，因为多模态 RAG 的优势主要体现在图文查询上
- 幻觉率是最关键的指标：多模态 RAG 可能因为图像描述不准确而引入新的幻觉来源

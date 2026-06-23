# 第 1 课：多模态 Embedding——CLIP 让图片和文本住进同一个向量空间

> **前置知识**：了解向量检索概念（01-ai-app 课程的 Embedding 部分）
> **本课目标**：理解多模态 Embedding 的原理，能用 CLIP 实现"以文搜图"

## 从电商搜索说起

你要做一个商品图片搜索功能。用户输入"红色碎花连衣裙"，系统从百万张商品图里找到最匹配的。

传统做法是给每张图打标签（类别、颜色、风格），然后做文本匹配。问题在于：标签永远覆盖不了所有细节。"红色碎花连衣裙"能搜到，但"显瘦的、带腰带的、领口有蝴蝶结的"就搜不到了——因为你不可能给每张图打上百个标签。

CLIP 的思路完全不同：它不打标签，而是把图片和文本都变成向量，放在同一个空间里。相似的东西距离近，不相似的远。"红色碎花连衣裙"变成一个向量，每张商品图也变成一个向量，直接算距离就行。

## CLIP 怎么工作的

```
CLIP 的训练方式：

  图片 ──→ [图片编码器] ──→ 图片向量 ──┐
                                         ├─→ 对比学习：相似对距离近，不相似对距离远
  文本 ──→ [文本编码器] ──→ 文本向量 ──┘

训练数据：4 亿个 (图片, 文本) 配对
训练目标：让匹配的图文对向量相似度高，不匹配的低

推理时：
  "红色连衣裙" ──→ 文本向量 ──┐
                                ├─→ 余弦相似度 → 排序 → 返回 Top-K
  商品图片库   ──→ 图片向量群 ──┘
```

关键点：**图片和文本的向量维度相同**（CLIP ViT-B/32 是 512 维），可以直接比较。

## 实验：跑一次图文匹配

```python
import torch
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import numpy as np

model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")


def get_image_embedding(image_path: str) -> np.ndarray:
    image = Image.open(image_path).convert("RGB")
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        features = model.get_image_features(**inputs)
    features = features / features.norm(dim=-1, keepdim=True)  # L2 归一化
    return features.squeeze().numpy()


def get_text_embedding(text: str) -> np.ndarray:
    inputs = processor(text=text, return_tensors="pt", padding=True, truncation=True)
    with torch.no_grad():
        features = model.get_text_features(**inputs)
    features = features / features.norm(dim=-1, keepdim=True)
    return features.squeeze().numpy()


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b))  # 已归一化，点积等于余弦相似度


# 测试
img_emb = get_image_embedding("cat.jpg")
txt_positive = get_text_embedding("一只猫")
txt_negative = get_text_embedding("一辆汽车")

print(f"向量维度: {img_emb.shape}")  # (512,)
print(f"'猫' vs 猫图: {cosine_similarity(img_emb, txt_positive):.4f}")   # 应该高
print(f"'汽车' vs 猫图: {cosine_similarity(img_emb, txt_negative):.4f}")  # 应该低
```

跑完你会发现：正样本的相似度在 0.2-0.3 左右，负样本在 0.0-0.1。差距不算大，但足够做排序了。

## CLIP 的局限

CLIP 不是万能的。用之前要知道它在哪不行：

**中文效果差**。CLIP 的训练数据 90% 是英文。"红色碎花连衣裙"的英文向量和图片的匹配度远高于中文。解决办法：
- 用中英双语的 Embedding 模型（如 Chinese-CLIP）
- 查询时用英文（如果用户输入可以翻译的话）

**细节识别差**。CLIP 理解的是整体语义，不是细节。"一只戴红色帽子的猫"和"一只猫"的向量差异很小。它分不清颜色、数量、位置等细节。

**专业领域差**。医学影像、工业检测、卫星图——CLIP 在这些领域的效果有限。需要在领域数据上微调。

## ColPali：文档场景的替代方案

CLIP 对文档图片的效果不好。一个包含表格和图表的 PDF 页面，CLIP 只能理解大意，提取不了表格数据。

ColPali 是专门为文档检索设计的模型。它直接从文档页面图片生成向量，不需要先 OCR 再 Embedding：

```
CLIP 方案：文档页面 → OCR → 文本分块 → 文本 Embedding → 向量
ColPali 方案：文档页面图片 → 直接生成向量
```

ColPali 的优势是保留了视觉信息——图表、表格、布局都能被编码进向量。劣势是模型更大、推理更慢。

```python
from colpali_engine import ColPali, ColPaliProcessor
from PIL import Image

model = ColPali.from_pretrained("vidore/colpali-v1.2")
processor = ColPaliProcessor.from_pretrained("vidore/colpali-v1.2")

def get_document_embedding(image_path: str):
    image = Image.open(image_path).convert("RGB")
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        features = model.forward(**inputs)
    return features
```

选型：通用图文搜索用 CLIP，文档检索用 ColPali。

## Embedding 的工程细节

几个实际使用中容易踩的坑：

**1. 向量必须归一化**

```python
# 错误：不归一化直接算余弦相似度
sim = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))  # 每次查询都要算两次 norm

# 正确：入库前归一化，查询时直接点积
a_normalized = a / np.linalg.norm(a)
sim = np.dot(a_normalized, b_normalized)  # 等价于余弦相似度，但快得多
```

**2. 图片要统一预处理**

不同尺寸的图片喂给 CLIP，向量质量不一致。建议统一 resize 到 224x224 或 336x336。

**3. 批量计算比逐个快**

```python
# 慢：逐个计算
embeddings = [get_image_embedding(p) for p in image_paths]

# 快：批量计算
inputs = processor(images=[Image.open(p).convert("RGB") for p in image_paths], return_tensors="pt", padding=True)
with torch.no_grad():
    features = model.get_image_features(**inputs)
```

## 本课要点

- CLIP 把图片和文本映射到同一个向量空间，实现"以文搜图"
- 向量必须 L2 归一化，否则相似度计算不准确
- CLIP 的中文效果差、细节识别差、专业领域差——知道边界很重要
- 文档场景用 ColPali 替代 CLIP

**下一课**：[02 图文混合索引——将图片和文本存储到同一个向量空间](./02-图文混合索引.md)

## 练习

### 练习一：跑一次图文匹配

用上面的代码，找 5 张不同类别的图片（猫、狗、汽车、风景、食物），分别计算它们和"一只可爱的小动物"这个文本的相似度。排序结果是否符合直觉？

### 练习二：构建图片搜索引擎

实现一个简单的图片搜索引擎：预计算图片库的 Embedding，查询时计算文本 Embedding 并返回 Top-K。

```python
class SimpleImageSearch:
    def __init__(self):
        self.index = {}  # {path: embedding}

    def build_index(self, image_dir: str):
        """遍历目录，预计算所有图片的 Embedding"""
        # 你的实现
        pass

    def search(self, query: str, top_k: int = 5) -> list[tuple[str, float]]:
        """用文本搜图片，返回 (路径, 相似度) 列表"""
        # 你的实现
        pass
```

### 练习三：对比中英文查询效果

用同一张图片，分别用中文和英文查询，对比相似度差异。

```python
queries = {
    "zh": "一只橘色的猫坐在沙发上",
    "en": "an orange cat sitting on a sofa",
}
# 计算每个查询和同一张猫图的相似度，对比差异
```

---

## 参考答案

### 练习一

你会发现 CLIP 在这个粗粒度分类上效果不错——"一只可爱的小动物"和猫、狗的相似度明显高于汽车和风景。但猫和狗的相似度差异不大，CLIP 分不清具体是什么动物。

### 练习二

```python
import os
from pathlib import Path
import json
import numpy as np


class SimpleImageSearch:
    def __init__(self):
        self.index: dict[str, np.ndarray] = {}

    def build_index(self, image_dir: str):
        extensions = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
        paths = [
            str(p) for p in Path(image_dir).rglob("*")
            if p.suffix.lower() in extensions
        ]
        print(f"索引 {len(paths)} 张图片...")
        for i, path in enumerate(paths):
            self.index[path] = get_image_embedding(path)
            if (i + 1) % 50 == 0:
                print(f"  已处理 {i + 1}/{len(paths)}")
        print("索引完成")

    def search(self, query: str, top_k: int = 5) -> list[tuple[str, float]]:
        query_emb = get_text_embedding(query)
        scores = [
            (path, cosine_similarity(query_emb, img_emb))
            for path, img_emb in self.index.items()
        ]
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]

    def save_index(self, path: str = "image_index.json"):
        data = {k: v.tolist() for k, v in self.index.items()}
        with open(path, "w") as f:
            json.dump(data, f)

    def load_index(self, path: str = "image_index.json"):
        with open(path) as f:
            data = json.load(f)
        self.index = {k: np.array(v) for k, v in data.items()}
```

### 练习三

英文查询的相似度通常比中文高 0.05-0.15。这是因为 CLIP 的训练数据以英文为主。如果你的产品面向中文用户，考虑：
- 用 Chinese-CLIP 模型
- 或者在查询时把中文翻译成英文再搜

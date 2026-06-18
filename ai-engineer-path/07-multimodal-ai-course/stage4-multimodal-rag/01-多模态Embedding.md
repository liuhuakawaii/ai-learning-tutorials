# 01 多模态 Embedding——CLIP / ColPali 的图文向量化原理

> 多模态 Embedding 让图片和文本可以在同一个向量空间中检索。

## 学习目标

- 理解多模态 Embedding 的原理
- 掌握 CLIP 和 ColPali 的使用方法
- 学会实现图文向量化

---

## 一、CLIP 原理

```
CLIP（Contrastive Language-Image Pre-training）：

核心思想：
- 将图片和文本映射到同一个向量空间
- 通过对比学习训练
- 相似的图文对距离近，不相似的距离远

应用：
- 图文检索
- 图片分类
- 图片描述
```

---

## 二、CLIP 使用

```python
from transformers import CLIPProcessor, CLIPModel

# 加载模型
model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

# 图片向量化
def get_image_embedding(image_path: str):
    image = Image.open(image_path)
    inputs = processor(images=image, return_tensors="pt")
    image_features = model.get_image_features(**inputs)
    return image_features.detach().numpy()

# 文本向量化
def get_text_embedding(text: str):
    inputs = processor(text=text, return_tensors="pt", padding=True)
    text_features = model.get_text_features(**inputs)
    return text_features.detach().numpy()
```

---

## 三、ColPali 原理

```
ColPali：

特点：
- 专门为文档检索设计
- 直接从文档图片生成向量
- 无需 OCR 预处理

优势：
- 保留视觉信息
- 处理复杂布局
- 支持图表和表格
```

---

## 四、ColPali 使用

```python
from colpali_engine import ColPali, ColPaliProcessor

# 加载模型
model = ColPali.from_pretrained("vidore/colpali-v1.2")
processor = ColPaliProcessor.from_pretrained("vidore/colpali-v1.2")

# 文档向量化
def get_document_embedding(image_path: str):
    image = Image.open(image_path)
    inputs = processor(images=image, return_tensors="pt")
    features = model.get_image_features(**inputs)
    return features.detach().numpy()
```

---

## 五、相似度计算

```python
import numpy as np

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """余弦相似度"""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
```

---

## 六、应用场景

```
多模态 Embedding 应用：

1. 图文检索
   - 用文字搜图片
   - 用图片搜文字

2. 图片分类
   - 零样本分类
   - 相似图片聚类

3. 文档检索
   - 从文档图片中检索
   - 支持复杂布局
```

---

## 小结

```
本课核心要点：

1. CLIP 将图片和文本映射到同一向量空间
2. ColPali 专为文档检索设计
3. 支持图文双向检索
4. 应用广泛：检索、分类、聚类

下一课：图文混合索引——将图片和文本存储到同一个向量空间。
```

---

## 练习

1. **向量题**：用 CLIP 生成图片和文本向量。

2. **检索题**：实现图文检索功能。

3. **应用题**：设计一个图文检索应用场景。

# 01 多模态 Embedding——CLIP / ColPali 的图文向量化原理

> 多模态 Embedding 让图片和文本可以在同一个向量空间中检索。

## 场景引入

你要构建一个电商图片搜索功能：用户输入"红色碎花连衣裙"，系统需要从百万张商品图中找到最匹配的结果。传统做法是给每张图片打标签再做文本匹配，但标签无法覆盖所有视觉细节。你听说了 CLIP 可以把图片和文本映射到同一个向量空间，实现真正的"以文搜图"，但实际使用后发现：CLIP 对中文的支持不如英文、向量维度和检索速度的权衡、ColPali 在文档场景比 CLIP 更好——多模态 Embedding 的选型和使用远比想象中复杂。

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

## 常见误区

1. **认为 CLIP 的中文和英文效果一样好**：CLIP 的训练数据以英文为主，中文图文匹配的效果明显弱于英文，中文场景需要考虑使用中文优化的多模态模型。
2. **忽略向量维度对检索速度的影响**：高维向量（如 768 维）的检索速度比低维（如 128 维）慢很多，百万级数据需要权衡精度和速度。
3. **不做归一化就计算相似度**：向量不做 L2 归一化直接算余弦相似度，结果可能不准确，大多数场景需要先归一化。
4. **把 Embedding 模型当通用模型用**：CLIP 擅长通用图文匹配，但对专业领域（医学影像、工业检测）的效果有限，可能需要微调或换模型。

## 工程建议

1. **用真实业务数据评估**：收集你的真实图文对（如商品图 + 商品描述），测试 CLIP 和 ColPali 的匹配准确率，不要只看公开 benchmark。
2. **中文场景做向量空间对齐**：如果中英文都需要支持，考虑用多语言 Embedding 模型或做向量空间对齐。
3. **预计算并缓存 Embedding**：图片的 Embedding 只需要计算一次，预计算后存入向量数据库，查询时只计算文本 Embedding。
4. **选择合适的向量维度**：平衡精度和速度，大多数场景 512 维已经足够，不需要用最高的 768 维。

## 小结

```
本课核心要点：

1. CLIP 将图片和文本映射到同一向量空间
2. ColPali 专为文档检索设计
3. 支持图文双向检索
4. 应用广泛：检索、分类、聚类

---

**下一课**: [02 图文混合索引——将图片和文本存储到同一个向量空间](./02-图文混合索引.md)
```

---

## 练习

1. **向量题**：用 CLIP 生成图片和文本向量。

2. **检索题**：实现图文检索功能。

3. **应用题**：设计一个图文检索应用场景。

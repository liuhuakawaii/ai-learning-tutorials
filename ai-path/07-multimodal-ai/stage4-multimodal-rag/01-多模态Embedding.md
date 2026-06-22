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

---

## 参考答案

### 练习一：向量题——用 CLIP 生成图片和文本向量

**思路**：使用 CLIP 模型分别对图片和文本进行编码，得到同维度的向量表示，然后计算余弦相似度验证它们是否在同一向量空间中。

**答案**：
```python
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import numpy as np
import torch

# 加载模型
model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

def get_image_embedding(image_path: str) -> np.ndarray:
    """生成图片向量"""
    image = Image.open(image_path).convert("RGB")
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        image_features = model.get_image_features(**inputs)
    # L2 归一化
    image_features = image_features / image_features.norm(dim=-1, keepdim=True)
    return image_features.squeeze().numpy()

def get_text_embedding(text: str) -> np.ndarray:
    """生成文本向量"""
    inputs = processor(text=text, return_tensors="pt", padding=True, truncation=True)
    with torch.no_grad():
        text_features = model.get_text_features(**inputs)
    # L2 归一化
    text_features = text_features / text_features.norm(dim=-1, keepdim=True)
    return text_features.squeeze().numpy()

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """余弦相似度（已归一化向量等价于点积）"""
    return float(np.dot(a, b))

# 验证
img_emb = get_image_embedding("cat.jpg")
txt_emb = get_text_embedding("一只猫")
print(f"向量维度: img={img_emb.shape}, txt={txt_emb.shape}")
print(f"图文相似度: {cosine_similarity(img_emb, txt_emb):.4f}")

txt_neg = get_text_embedding("一辆汽车")
print(f"负样本相似度: {cosine_similarity(img_emb, txt_neg):.4f}")
```

**要点**：
- 必须对向量做 L2 归一化，否则余弦相似度计算不准确
- 使用 `torch.no_grad()` 避免计算梯度，节省内存和计算
- CLIP 的训练数据以英文为主，中文效果可能不如英文，测试时建议同时用中英文对比
- 常见错误：忘记 `image.convert("RGB")` 处理 RGBA 图片会导致通道数不匹配

### 练习二：检索题——实现图文检索功能

**思路**：将图片库的所有图片预计算 Embedding 并存储，查询时计算文本 Embedding，通过向量相似度排序返回 Top-K 结果。

**答案**：
```python
import os
import json
import numpy as np
from pathlib import Path

class ImageSearchEngine:
    """图文检索引擎"""

    def __init__(self):
        self.embeddings = {}  # {image_path: embedding}
        self.index_file = "image_index.json"

    def build_index(self, image_dir: str):
        """构建图片索引"""
        image_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
        image_paths = [
            str(p) for p in Path(image_dir).rglob("*")
            if p.suffix.lower() in image_extensions
        ]

        print(f"找到 {len(image_paths)} 张图片，开始构建索引...")
        for i, path in enumerate(image_paths):
            self.embeddings[path] = get_image_embedding(path)
            if (i + 1) % 100 == 0:
                print(f"已处理 {i + 1}/{len(image_paths)}")

        print(f"索引构建完成，共 {len(self.embeddings)} 张图片")

    def save_index(self):
        """持久化索引"""
        data = {path: emb.tolist() for path, emb in self.embeddings.items()}
        with open(self.index_file, "w", encoding="utf-8") as f:
            json.dump(data, f)

    def load_index(self):
        """加载索引"""
        with open(self.index_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.embeddings = {path: np.array(emb) for path, emb in data.items()}

    def search(self, query: str, top_k: int = 5) -> list:
        """用文字搜图片"""
        query_emb = get_text_embedding(query)

        scores = []
        for path, img_emb in self.embeddings.items():
            score = cosine_similarity(query_emb, img_emb)
            scores.append((path, score))

        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]

# 使用示例
engine = ImageSearchEngine()
engine.build_index("./product_images")
engine.save_index()

results = engine.search("红色碎花连衣裙", top_k=3)
for path, score in results:
    print(f"  {path} (相似度: {score:.4f})")
```

**要点**：
- 索引应该预计算并持久化，不要每次查询时重新计算所有图片
- 使用 metadata 过滤（如商品类别）可以在向量匹配前缩小搜索范围，提高效率
- 常见错误：直接用原始向量计算余弦相似度而不归一化，导致相似度值不在 [-1, 1] 范围内
- 百万级图片需要使用专门的向量数据库（如 Milvus）而非内存字典

### 练习三：应用题——设计一个图文检索应用场景

**思路**：选择一个具体的业务场景，明确输入输出、检索策略和用户体验，设计完整的应用方案。

**答案**：

**场景：医学影像辅助诊断知识库**

**需求描述**：医生上传一张 X 光或 CT 影像，系统从医学文献库中检索最相似的病例报告和诊断建议，辅助医生做出诊断。

**系统设计**：

1. **数据层**：医学文献 PDF → 解析为图文对 → CLIP 生成 Embedding → 存入 Milvus
2. **检索层**：医生上传影像 → CLIP 编码 → 向量检索 → 返回 Top-5 相似病例
3. **生成层**：将检索到的病例摘要 + 影像送入 GPT-4o → 生成诊断建议
4. **展示层**：展示相似病例列表、诊断建议、置信度评分

**关键设计决策**：
- 使用 CLIP 作为基础模型，但在医学影像数据集上做微调（MedCLIP）
- 检索时结合元数据过滤（影像类型、部位、年龄段），提高检索精度
- 每个结果附带来源文献链接，方便医生验证
- 设置最低相似度阈值（如 0.7），低于阈值时提示"未找到相似病例"

**要点**：
- 专业领域应用不能直接用通用 CLIP，需要领域微调或使用专业模型
- 医疗场景必须有引用溯源，AI 只是辅助工具，最终诊断由医生做出
- 常见错误：把 CLIP 的通用模型直接用在专业领域，匹配效果会非常差

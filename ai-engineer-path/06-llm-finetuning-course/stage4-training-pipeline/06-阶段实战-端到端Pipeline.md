# 06 阶段实战——搭建一个端到端的训练 Pipeline

> 把前 5 课学到的知识整合成一个完整的训练 Pipeline。

## 学习目标

- 搭建端到端的训练 Pipeline
- 集成数据处理、训练、评估、导出
- 输出一个可重复使用的训练系统

---

## 一、Pipeline 架构

```
训练 Pipeline：

数据 → 预处理 → 训练 → 评估 → 量化 → 导出 → 部署
  │      │       │      │      │      │      │
  ▼      ▼       ▼      ▼      ▼      ▼      ▼
原始数据 清洗后 模型权重 评估报告 量化模型 部署包 服务
```

---

## 二、完整实现

```python
class TrainingPipeline:
    """训练 Pipeline"""
    
    def __init__(self, config_path: str):
        self.config = load_config(config_path)
    
    def run(self):
        """运行 Pipeline"""
        # 1. 数据处理
        dataset = self.process_data()
        
        # 2. 训练
        model = self.train(dataset)
        
        # 3. 评估
        results = self.evaluate(model)
        
        # 4. 合并
        merged_model = self.merge(model)
        
        # 5. 量化
        quantized_model = self.quantize(merged_model)
        
        # 6. 导出
        self.export(quantized_model)
        
        return results
    
    def process_data(self):
        """数据处理"""
        pipeline = DataPipeline()
        # 添加步骤...
        return pipeline.run(self.config["data"])
    
    def train(self, dataset):
        """训练模型"""
        # 加载模型
        model = load_model(self.config["model"])
        
        # 训练
        trainer = create_trainer(model, dataset, self.config["training"])
        trainer.train()
        
        return trainer.model
    
    def evaluate(self, model):
        """评估模型"""
        return evaluate_model(model, self.config["eval"])
    
    def merge(self, model):
        """合并 LoRA"""
        merged = model.merge_and_unload()
        merged.save_pretrained(self.config["output"]["merged_dir"])
        return merged
    
    def quantize(self, model):
        """量化模型"""
        # GGUF 导出
        export_to_gguf(model, self.config["output"]["gguf_path"])
        return model
    
    def export(self, model):
        """导出模型"""
        model.save_pretrained(self.config["output"]["final_dir"])
```

---

## 三、运行

```python
# 运行 Pipeline
pipeline = TrainingPipeline("config.yaml")
results = pipeline.run()

# 生成报告
report = generate_report(results)
print(report)
```

---

## 四、课程总结

```
课程 06 总结：

恭喜你完成了开源模型部署与微调实战课程！

你现在能够：
- 用 Ollama / vLLM / llama.cpp 本地部署开源大模型
- 理解 LoRA / QLoRA 微调原理
- 用领域数据微调 7B-14B 模型
- 搭建完整的训练 Pipeline
- 做出合理的 build vs buy 决策

下一步：
- 将所学应用到你的实际项目中
- 探索更大的模型（14B、70B）
- 关注开源模型的最新发展
```

---

## 作业

1. **完成实战**：运行完整的训练 Pipeline。

2. **优化题**：优化 Pipeline 的某个环节。

3. **总结反思**：回顾整个课程，总结你的收获和下一步计划。

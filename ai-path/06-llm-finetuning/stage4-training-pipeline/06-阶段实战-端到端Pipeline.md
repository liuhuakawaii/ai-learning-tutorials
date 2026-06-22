# 06 阶段实战——搭建一个端到端的训练 Pipeline

> 把前 5 课学到的知识整合成一个完整的训练 Pipeline。

## 场景引入

数据处理、训练配置、分布式训练、模型合并、量化导出——每个环节单独都会了，但要搭建一个端到端的自动化训练系统，把它们串联起来，还是会手忙脚乱。新数据来了要手动跑数据处理，改了配置忘了同步到代码，导出的模型格式对不上部署工具。你需要一个完整的 Pipeline，从原始数据到可部署模型，一条命令搞定。

---

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

## 常见误区

1. **Pipeline 没有幂等性**：重复运行 Pipeline 会产生重复数据或覆盖已有结果。Pipeline 的每一步都应该支持幂等执行——相同输入产生相同输出。

2. **所有步骤串行执行**：数据处理和模型评估可以并行执行，不需要等数据处理全部完成才开始评估。合理利用并行可以显著缩短 Pipeline 总耗时。

3. **Pipeline 失败后没有通知**：后台运行的 Pipeline 失败了但没人知道，白白浪费时间。必须配置失败告警（邮件、Slack、企业微信）。

4. **硬编码路径和参数**：Pipeline 中的文件路径、模型名称、参数都应该是可配置的，不能硬编码。换个环境就要改代码的 Pipeline 不是真正的 Pipeline。

---

## 工程建议

1. **Pipeline 要支持断点续跑**：如果 Pipeline 在第 3 步失败了，修复后应该从第 3 步继续，而不是从头开始。用状态文件记录每步的完成状态。

2. **每步输出要可检查**：Pipeline 每一步的输出都应该保存到文件，方便人工检查。不要让数据在内存中流转到最后一步才发现中间步骤有问题。

3. **用配置文件驱动 Pipeline**：一个 YAML 配置文件定义完整的 Pipeline——模型、数据、训练参数、评估指标、导出格式。改配置就能跑不同的实验。

4. **Pipeline 结果要可追溯**：记录每次 Pipeline 运行的完整信息——时间、配置、输入数据版本、输出结果、运行日志。方便复现和审计。

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

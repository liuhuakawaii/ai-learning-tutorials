"""LoRA 微调训练脚本。

用法:
    python src/train_lora.py --config configs/lora_config.yaml
"""
import argparse
import yaml
from pathlib import Path


def train(config_path: Path):
    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    print(f"模型: {config['model']['name']}")
    print(f"LoRA rank: {config['lora']['r']}")
    print(f"训练轮数: {config['training']['num_epochs']}")
    print(f"学习率: {config['training']['learning_rate']}")
    print("=" * 50)

    try:
        from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
        from peft import LoraConfig, get_peft_model
        from trl import SFTTrainer
        from datasets import load_dataset
    except ImportError as e:
        print(f"缺少依赖: {e}")
        print("请运行: pip install -r requirements.txt")
        return

    print("加载模型...")
    model = AutoModelForCausalLM.from_pretrained(
        config["model"]["name"],
        torch_dtype="auto",
        device_map="auto",
    )
    tokenizer = AutoTokenizer.from_pretrained(config["model"]["name"])

    lora_config = LoraConfig(
        r=config["lora"]["r"],
        lora_alpha=config["lora"]["lora_alpha"],
        lora_dropout=config["lora"]["lora_dropout"],
        target_modules=config["lora"]["target_modules"],
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    print("加载数据集...")
    dataset = load_dataset("json", data_files=config["data"]["train_file"])

    training_args = TrainingArguments(
        output_dir=config["training"]["output_dir"],
        num_train_epochs=config["training"]["num_epochs"],
        per_device_train_batch_size=config["training"]["batch_size"],
        gradient_accumulation_steps=config["training"]["gradient_accumulation_steps"],
        learning_rate=config["training"]["learning_rate"],
        warmup_ratio=config["training"]["warmup_ratio"],
        weight_decay=config["training"]["weight_decay"],
        max_grad_norm=config["training"]["max_grad_norm"],
        fp16=config["training"]["fp16"],
        logging_steps=config["training"]["logging_steps"],
        save_steps=config["training"]["save_steps"],
    )

    print("开始训练...")
    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=dataset["train"],
        tokenizer=tokenizer,
    )
    trainer.train()
    trainer.save_model()
    print(f"模型已保存到: {config['training']['output_dir']}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=Path("configs/lora_config.yaml"))
    args = parser.parse_args()
    train(args.config)


if __name__ == "__main__":
    main()

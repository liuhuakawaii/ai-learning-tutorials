# AI Knowledge Workspace Kit

这是 AI 应用课程的离线贯穿项目。它不依赖真实模型 API，先把 RAG 产品最容易漏掉的工程闭环练清楚：文档解析、chunk、检索、引用、拒答、工具记录和评估。

## 运行

```bash
npm run check
npm run ingest
npm run ask -- "哪些资料说明了引用必须可追溯？"
npm run eval
```

## 课程映射

- 第一阶段：把 `ask` 命令替换为真实 Responses API 调用，并保留错误处理。
- 第二阶段：修改 `src/build-index.mjs` 的 chunk 策略，观察检索结果变化。
- 第三阶段：把“保存笔记、生成任务”做成工具调用协议。
- 第四阶段：补工作区、配额、日志和成本统计。
- 第五阶段：扩展 `data/evals.json`，让每次 prompt 或检索策略变更都能回归。

## 交付物

- `reports/stage1-api-baseline.md`
- `reports/stage2-rag-quality.md`
- `reports/stage3-tool-calls.md`
- `reports/stage4-productization.md`
- `reports/stage5-eval-release.md`

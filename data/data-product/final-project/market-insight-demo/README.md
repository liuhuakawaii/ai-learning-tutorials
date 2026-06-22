# Market Insight Demo

这是数据产品化课程的贯穿项目。它用一份招聘岗位 CSV 演示完整闭环：原始数据、清洗、质量规则、指标生成、API 查询和 Dashboard 展示。

## 运行

```bash
npm run check
npm run etl
npm start
```

打开：

- Dashboard：http://localhost:4180/
- API 总览：http://localhost:4180/api/summary
- 岗位列表：http://localhost:4180/api/jobs
- 质量报告：http://localhost:4180/api/quality

## 课程映射

- 第一阶段：补 `docs/data-source-research.md` 和 `docs/data-dictionary.md`
- 第二阶段：改进 `scripts/run-etl.js` 的清洗和质量规则
- 第三阶段：扩展 `server.js` 的筛选、排序和聚合接口
- 第四阶段：优化 `public/index.html` 的 Dashboard 信息架构
- 第五阶段：补任务状态、增量更新、告警和部署文档

# 第二阶段：高级 Workflow

## 阶段目标

掌握矩阵构建、条件执行、可重用 Workflow 和复合 Action 等高级特性，能实现跨仓库的可重用 CI/CD 流水线。

## 课时列表

1. [矩阵构建——多版本/多平台并行测试的策略](06-matrix-builds.md)
2. [条件执行——if 表达式、continue-on-error、fail-fast](07-conditional-execution.md)
3. [可重用 Workflow——workflow_call、输入/输出、跨仓库调用](08-reusable-workflows.md)
4. [复合 Action——把多个 Step 封装成可复用的 Action](09-composite-actions.md)
5. [阶段实战：实现一个跨仓库的可重用 CI/CD 流水线](10-stage-project-reusable-pipeline.md)

## 验收标准

- 能配置矩阵构建实现多平台/多版本并行测试
- 能用 if 表达式和 continue-on-error 控制 Workflow 的执行流程
- 能实现可重用 Workflow 并通过 workflow_call 跨仓库调用
- 能编写复合 Action 封装可复用的步骤逻辑

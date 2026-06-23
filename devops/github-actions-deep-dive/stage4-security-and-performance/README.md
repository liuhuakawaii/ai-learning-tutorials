# 第四阶段：安全与性能

## 阶段目标

掌握 OIDC 云服务认证、Secret 管理、环境保护规则和 CI 性能优化，能配置一个安全的多环境部署流水线。

## 课时列表

1. [OIDC 与云服务认证——免密钥访问 AWS/GCP/Azure](16-oidc-cloud-auth.md)
2. [Secret 管理——环境级 Secret、仓库级 Secret、组织级 Secret](17-secret-management.md)
3. [环境保护规则——审批、等待、分支限制](18-environment-protection-rules.md)
4. [CI 性能优化——缓存命中率、并行度、Docker 层缓存](19-ci-performance-optimization.md)
5. [阶段实战：配置一个安全的多环境部署流水线](20-stage-project-secure-multienvironment-pipeline.md)

## 验收标准

- 能配置 OIDC 实现免密钥访问云服务（AWS/GCP/Azure）
- 能设计 Secret 的层级管理策略（环境级/仓库级/组织级）
- 能配置环境保护规则（审批、等待、分支限制）
- 能分析并优化 CI 构建时长（缓存命中率、并行度、Docker 层缓存）

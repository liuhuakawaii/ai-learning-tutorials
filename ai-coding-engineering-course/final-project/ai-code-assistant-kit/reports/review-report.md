# 代码审查报告

> 生成时间: {date}
> 工具: ai-kit review

## 审查概要

| 指标 | 值 |
|------|-----|
| 审查文件数 | {file_count} |
| 总问题数 | {total_issues} |
| 错误 (Error) | {error_count} |
| 警告 (Warning) | {warning_count} |
| 提示 (Info) | {info_count} |
| 综合评分 | {score}/100 |

## 问题分布

### 按类别

| 类别 | 数量 | 说明 |
|------|------|------|
| security | - | 安全相关问题 |
| type-safety | - | 类型安全问题 |
| error-handling | - | 错误处理问题 |
| best-practice | - | 最佳实践问题 |
| logging | - | 日志相关问题 |
| maintenance | - | 维护性问题 |

### 按严重程度

```
Error:   {error_bar}
Warning: {warning_bar}
Info:    {info_bar}
```

## 详细问题列表

### 高优先级 (必须修复)

```
运行 ai-kit review <file> 查看具体问题
```

### 中优先级 (建议修复)

```
运行 ai-kit review <file> 查看具体问题
```

### 低优先级 (可选优化)

```
运行 ai-kit review <file> 查看具体问题
```

## 修复建议

1. **安全问题优先**: 硬编码密钥、eval 使用等必须立即修复
2. **类型安全**: 逐步替换 any 类型为具体类型
3. **错误处理**: 确保所有异步操作有错误处理
4. **日志规范化**: 替换 console.log 为结构化日志

## 下一步

- [ ] 修复所有 Error 级别问题
- [ ] 评估 Warning 级别问题并制定修复计划
- [ ] 在 CI 中集成自动代码审查

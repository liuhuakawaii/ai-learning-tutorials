# 第二阶段：Compose 编排

## 阶段目标

用 Docker Compose 编排应用、数据库、缓存、网络和持久化卷，搭建本地生产模拟环境。

## 课时安排

1. compose.yml 结构
2. service、network、volume
3. App + PostgreSQL + Redis
4. 环境变量管理
5. 数据持久化和备份
6. healthcheck 与启动顺序
7. 阶段实战：本地生产模拟环境

## 阶段项目

用 Compose 启动 web、api、postgres、redis 四个服务。

## 验收标准

- `docker compose up` 一条命令启动
- 数据库重启后数据不丢
- API 等数据库健康后再启动
- `.env.example` 完整


# 第二阶段：数据、认证与权限

## 阶段目标

把 Next.js 项目接入真实数据库和认证系统，建立用户、团队、角色权限和服务端校验。

## 课时安排

1. Prisma + PostgreSQL 初始化
2. 数据建模：User、Team、Member、Project
3. 登录注册与 Session
4. 权限模型：owner、admin、member
5. React Hook Form + Zod
6. 文件上传基础
7. 阶段实战：团队项目管理系统

## 阶段项目

构建团队项目管理系统：用户登录后可以创建团队、邀请成员、创建项目，并根据角色限制操作。

## 验收标准

- 数据库 schema 可迁移
- 未登录用户不能访问 Dashboard
- 普通成员不能修改团队设置
- 所有写操作有服务端校验


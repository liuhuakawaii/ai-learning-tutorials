/**
 * 数据模型 Schema 定义
 * 使用 Prisma 作为 ORM，定义低代码平台的核心数据模型
 */

import { PrismaClient } from '@prisma/client';

// Prisma Schema 定义（以字符串形式导出供动态生成使用）
export const PRISMA_SCHEMA = `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 用户表
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String
  password    String
  role        Role     @default(USER)
  tenantId    String?
  tenant      Tenant?  @relation(fields: [tenantId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  auditLogs   AuditLog[]
}

// 租户表（多租户支持）
model Tenant {
  id          String   @id @default(cuid())
  name        String   @unique
  plan        Plan     @default(FREE)
  quota       Json     @default("{}")
  users       User[]
  models      DataModel[]
  pages       Page[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// 数据模型定义表
model DataModel {
  id          String   @id @default(cuid())
  name        String
  displayName String
  description String?
  fields      Json
  relations   Json
  tenantId    String?
  tenant      Tenant?  @relation(fields: [tenantId], references: [id])
  records     DataRecord[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([name, tenantId])
}

// 数据记录表（动态数据存储）
model DataRecord {
  id          String   @id @default(cuid())
  modelId     String
  model       DataModel @relation(fields: [modelId], references: [id], onDelete: Cascade)
  data        Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([modelId])
}

// 页面定义表
model Page {
  id          String   @id @default(cuid())
  name        String
  path        String
  type        PageType @default(CUSTOM)
  layout      Json
  dataSource  Json
  events      Json
  tenantId    String?
  tenant      Tenant?  @relation(fields: [tenantId], references: [id])
  published   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([path, tenantId])
}

// 工作流定义表
model Workflow {
  id          String   @id @default(cuid())
  name        String
  description String?
  nodes       Json
  edges       Json
  status      WorkflowStatus @default(DRAFT)
  executions  WorkflowExecution[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// 工作流执行记录表
model WorkflowExecution {
  id          String   @id @default(cuid())
  workflowId  String
  workflow    Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  status      ExecutionStatus @default(RUNNING)
  context     Json
  logs        Json
  startedAt   DateTime @default(now())
  finishedAt  DateTime?

  @@index([workflowId])
}

// 审计日志表
model AuditLog {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  action      String
  resource    String
  resourceId  String?
  details     Json
  ip          String?
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([resource, resourceId])
}

// 组件定义表
model Component {
  id          String   @id @default(cuid())
  name        String   @unique
  displayName String
  category    String
  version     String
  props       Json
  events      Json
  code        String
  published   Boolean  @default(false)
  downloads   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum Role {
  ADMIN
  USER
  GUEST
}

enum Plan {
  FREE
  PRO
  ENTERPRISE
}

enum PageType {
  DASHBOARD
  LIST
  FORM
  DETAIL
  CUSTOM
}

enum WorkflowStatus {
  DRAFT
  ACTIVE
  PAUSED
  ARCHIVED
}

enum ExecutionStatus {
  RUNNING
  SUCCESS
  FAILED
  CANCELLED
}
`;

// Prisma 客户端单例
let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prisma;
}

// 字段类型枚举
export enum FieldType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  BOOLEAN = 'boolean',
  ENUM = 'enum',
  RELATION = 'relation',
  JSON = 'json',
  FILE = 'file',
  RICH_TEXT = 'rich_text',
  EMAIL = 'email',
  URL = 'url',
  PHONE = 'phone',
}

// 关系类型枚举
export enum RelationType {
  ONE_TO_ONE = 'one_to_one',
  ONE_TO_MANY = 'one_to_many',
  MANY_TO_MANY = 'many_to_many',
}

// 字段定义接口
export interface FieldDefinition {
  name: string;
  displayName: string;
  type: FieldType;
  required: boolean;
  unique?: boolean;
  defaultValue?: unknown;
  enumValues?: string[];
  relation?: {
    type: RelationType;
    targetModel: string;
    foreignKey?: string;
  };
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

// 模型定义接口
export interface ModelDefinition {
  name: string;
  displayName: string;
  description?: string;
  fields: FieldDefinition[];
  relations: RelationDefinition[];
}

// 关系定义接口
export interface RelationDefinition {
  type: RelationType;
  sourceModel: string;
  targetModel: string;
  sourceField: string;
  targetField: string;
  cascadeDelete?: boolean;
}

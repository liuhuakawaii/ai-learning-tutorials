# 阶段实战：Monorepo 搭建

## 场景引入

经过前面五节课的学习，你已经掌握了 tsconfig 配置、快速编译、Monorepo 架构、AST 代码生成和 API 类型生成。现在把这些知识整合起来，搭建一个完整的生产级 Monorepo 项目。

## 学习目标

- 使用 pnpm workspace 搭建完整的 Monorepo 结构
- 配置 Turborepo 实现增量构建和缓存
- 创建共享的 tsconfig 配置包和共享类型包
- 实现 API 客户端包和可运行的前后端应用

## 一、项目初始化

```bash
mkdir my-fullstack-monorepo && cd my-fullstack-monorepo
pnpm init
mkdir -p packages/shared-config packages/shared-types packages/api-client apps/web apps/api
```

```json
// package.json
{
  "name": "my-fullstack-monorepo", "private": true,
  "scripts": { "dev": "turbo dev", "build": "turbo build", "typecheck": "turbo typecheck" },
  "devDependencies": { "turbo": "^2.0.0", "typescript": "^5.5.0" }
}
```

```yaml
# pnpm-workspace.yaml
packages: ["packages/*", "apps/*"]
```

```json
// turbo.json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

## 二、共享配置包

```json
// packages/shared-config/package.json
{ "name": "@my-org/shared-config", "version": "0.0.0", "private": true }
```

```json
// packages/shared-config/tsconfig/base.json
{
  "compilerOptions": {
    "strict": true, "target": "ES2022", "module": "ESNext",
    "moduleResolution": "bundler", "esModuleInterop": true,
    "isolatedModules": true, "skipLibCheck": true,
    "declaration": true, "declarationMap": true, "sourceMap": true,
    "noUnusedLocals": true, "noUnusedParameters": true
  }
}
```

```json
// packages/shared-config/tsconfig/node.json
{ "extends": "./base.json", "compilerOptions": { "module": "NodeNext", "moduleResolution": "nodenext" } }
```

```json
// packages/shared-config/tsconfig/web.json
{ "extends": "./base.json", "compilerOptions": { "lib": ["ES2022", "DOM", "DOM.Iterable"], "jsx": "react-jsx" } }
```

## 三、共享类型包

```json
// packages/shared-types/package.json
{
  "name": "@my-org/shared-types", "version": "0.0.0", "private": true,
  "main": "./src/index.ts", "types": "./src/index.ts",
  "devDependencies": { "@my-org/shared-config": "workspace:*", "typescript": "^5.5.0" }
}
```

```json
// packages/shared-types/tsconfig.json
{ "extends": "@my-org/shared-config/tsconfig/base.json", "compilerOptions": { "composite": true, "outDir": "./dist", "rootDir": "./src" }, "include": ["src"] }
```

```typescript
// packages/shared-types/src/user.ts
export interface User {
  id: string; name: string; email: string; role: UserRole; createdAt: string;
}
export type UserRole = "admin" | "user" | "guest";
export type CreateUserInput = Omit<User, "id" | "createdAt">;
export type UpdateUserInput = Partial<CreateUserInput>;
```

```typescript
// packages/shared-types/src/api.ts
export interface ApiResponse<T> { data: T; success: boolean; message?: string; }
export interface PaginatedResponse<T> { items: T[]; total: number; page: number; pageSize: number; }
export type PaginatedRequest = { page?: number; pageSize?: number; sortBy?: string; sortOrder?: "asc" | "desc"; };
```

```typescript
// packages/shared-types/src/index.ts
export type { User, UserRole, CreateUserInput, UpdateUserInput } from "./user";
export type { ApiResponse, PaginatedResponse, PaginatedRequest } from "./api";
```

## 四、API 客户端包

```json
// packages/api-client/package.json
{
  "name": "@my-org/api-client", "version": "0.0.0", "private": true,
  "main": "./src/index.ts", "types": "./src/index.ts",
  "dependencies": { "@my-org/shared-types": "workspace:*" },
  "devDependencies": { "@my-org/shared-config": "workspace:*", "typescript": "^5.5.0" }
}
```

```typescript
// packages/api-client/src/client.ts
import type { ApiResponse } from "@my-org/shared-types";

interface ClientConfig { baseUrl: string; headers?: Record<string, string>; }

export function createApiClient(config: ClientConfig) {
  const { baseUrl, headers = {} } = config;
  async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options, headers: { "Content-Type": "application/json", ...headers, ...options.headers },
    });
    if (!response.ok) { const err = await response.json(); throw new Error(err.message ?? `HTTP ${response.status}`); }
    return response.json();
  }
  return {
    get<T>(path: string, params?: Record<string, string>) {
      return request<T>(`${path}${params ? `?${new URLSearchParams(params)}` : ""}`);
    },
    post<T>(path: string, body: unknown) { return request<T>(path, { method: "POST", body: JSON.stringify(body) }); },
    put<T>(path: string, body: unknown) { return request<T>(path, { method: "PUT", body: JSON.stringify(body) }); },
    delete<T>(path: string) { return request<T>(path, { method: "DELETE" }); },
  };
}
```

## 五、Web 前端与 API 后端

```json
// apps/web/package.json
{
  "name": "@my-org/web", "version": "0.0.0", "private": true,
  "scripts": { "dev": "vite", "build": "vite build", "typecheck": "tsc --noEmit" },
  "dependencies": { "@my-org/shared-types": "workspace:*", "@my-org/api-client": "workspace:*", "vue": "^3.4.0" },
  "devDependencies": { "@my-org/shared-config": "workspace:*", "typescript": "^5.5.0", "vite": "^5.3.0" }
}
```

```json
// apps/web/tsconfig.json
{ "extends": "@my-org/shared-config/tsconfig/web.json", "compilerOptions": { "paths": { "@/*": ["./src/*"] }, "baseUrl": "." }, "include": ["src"], "references": [{ "path": "../../packages/shared-types" }, { "path": "../../packages/api-client" }] }
```

```typescript
// apps/web/src/main.ts
import { createApiClient, createUsersApi } from "@my-org/api-client";
import type { User } from "@my-org/shared-types";

const client = createApiClient({ baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3001" });
const usersApi = createUsersApi(client);

async function renderUsers() {
  const response = await usersApi.list({ page: 1, pageSize: 10 });
  if (response.success) {
    response.data.items.forEach((user: User) => console.log(`- ${user.name}`));
  }
}
renderUsers();
```

```json
// apps/api/package.json
{
  "name": "@my-org/api", "version": "0.0.0", "private": true,
  "scripts": { "dev": "tsx watch src/index.ts", "build": "tsup", "typecheck": "tsc --noEmit" },
  "dependencies": { "@my-org/shared-types": "workspace:*", "express": "^4.19.0" },
  "devDependencies": { "@my-org/shared-config": "workspace:*", "@types/express": "^4.17.21", "tsup": "^8.0.0", "tsx": "^4.15.0", "typescript": "^5.5.0" }
}
```

```typescript
// apps/api/src/index.ts
import express from "express";
import type { User, ApiResponse, PaginatedResponse } from "@my-org/shared-types";

const app = express();
app.use(express.json());

const users: User[] = [
  { id: "1", name: "张三", email: "zhangsan@example.com", role: "admin", createdAt: new Date().toISOString() },
];

app.get("/users", (req, res) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const items = users.slice((page - 1) * pageSize, page * pageSize);
  const response: ApiResponse<PaginatedResponse<User>> = {
    success: true, data: { items, total: users.length, page, pageSize },
  };
  res.json(response);
});

app.listen(3001, () => console.log("API running on http://localhost:3001"));
```

验证：

```bash
pnpm install           # 安装所有依赖
pnpm typecheck         # 类型检查所有包
pnpm build             # 构建所有包
pnpm --filter @my-org/api dev  # 启动 API
pnpm --filter @my-org/web dev  # 启动 Web
```

## 常见误区

1. **根目录放所有依赖**：每个包应声明自己的依赖，根目录只放 turbo 等工具依赖
2. **不配置 Turborepo 的 outputs**：没有 outputs 配置导致缓存失效
3. **shared-config 不设 private**：配置包不应发布到 npm
4. **跳过项目引用配置**：没有项目引用，tsc --build 无法做增量编译

## 工程建议

1. **从 3 个包开始**：先跑通 shared-types + api + web 的最小结构
2. **用 `workspace:*` 引用本地包**：不要写具体版本号
3. **每个包都要有 typecheck 脚本**：Turborepo 可以并行检查所有包
4. **tsup 用于需要构建的包**：纯类型包不需要构建

## 小结

本课搭建了完整的 Monorepo 项目，包含共享配置、共享类型、API 客户端、Web 前端和 API 后端。通过 pnpm workspace 管理本地包引用，Turborepo 编排构建顺序和缓存，项目引用实现增量编译。

## 练习

### 练习一：添加共享工具包

在 `packages/utils` 中创建工具包，包含 `formatDate`、`debounce` 两个函数，在 `apps/web` 中使用。

### 练习二：添加测试配置

为 Monorepo 添加 Vitest，要求根目录共享配置，`turbo test` 能并行运行所有包测试。

### 练习三：添加 Docker 支持

为 `apps/api` 编写 Dockerfile，要求多阶段构建、只包含运行时依赖。

---

## 参考答案

### 练习一

**思路**：创建 packages/utils 包，实现工具函数，通过 workspace:* 引用。

**答案**：

```json
// packages/utils/package.json
{ "name": "@my-org/utils", "version": "0.0.0", "private": true, "main": "./src/index.ts" }
```

```typescript
// packages/utils/src/date.ts
export function formatDate(date: Date | string, format = "YYYY-MM-DD"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format.replace("YYYY", String(d.getFullYear()))
    .replace("MM", String(d.getMonth() + 1).padStart(2, "0"))
    .replace("DD", String(d.getDate()).padStart(2, "0"));
}
// packages/utils/src/async.ts
export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}
```

**要点**：工具函数应该是纯函数，每个文件一个职责。

### 练习二

**思路**：根目录安装 vitest，每个包添加 test 脚本。

**答案**：

```bash
pnpm -w add -D vitest
```

```typescript
// packages/utils/src/__tests__/date.test.ts
import { describe, it, expect } from "vitest";
import { formatDate } from "../date";
describe("formatDate", () => {
  it("formats date correctly", () => {
    expect(formatDate(new Date("2024-01-15"))).toBe("2024-01-15");
  });
});
```

**要点**：vitest 的 `globals: true` 让 describe/it/expect 全局可用，Turborepo test 任务依赖 build。

### 练习三

**思路**：多阶段构建，先构建 Monorepo，再只复制 API 运行产物。

**答案**：

```dockerfile
FROM node:18-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile
FROM deps AS builder
COPY . .
RUN pnpm --filter @my-org/api build
FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

**要点**：先复制 package.json 再安装依赖利用 Docker 层缓存，`--frozen-lockfile` 确保锁定版本。

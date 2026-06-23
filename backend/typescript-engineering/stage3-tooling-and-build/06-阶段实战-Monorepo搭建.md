# 阶段实战：Monorepo 搭建

前面五课学了 tsconfig、快速编译、项目引用、AST 代码生成、API 类型生成。现在把它们拼成一个能跑的 Monorepo。

目标：共享配置、共享类型、API 客户端、前端、后端，`pnpm install` 后所有包的类型检查和构建都能跑通。

## 初始化

```bash
mkdir fullstack-monorepo && cd fullstack-monorepo && pnpm init
mkdir -p packages/shared-config packages/shared-types packages/api-client apps/web apps/api
```

```json
// package.json（根目录，只放工具依赖）
{ "name": "fullstack-monorepo", "private": true,
  "scripts": { "dev": "turbo dev", "build": "turbo build", "typecheck": "turbo typecheck" },
  "devDependencies": { "turbo": "^2.0.0", "typescript": "^5.5.0" } }
```

```yaml
# pnpm-workspace.yaml
packages: ["packages/*", "apps/*"]
```

```json
// turbo.json
{ "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "typecheck": { "dependsOn": ["^build"] } } }
```

`"dependsOn": ["^build"]` 意思是当前包的 build 依赖所有上游包的 build 先完成。没有这行，Turborepo 会并行构建所有包，依赖关系靠运气。

## 共享配置包

5 个子项目手写 5 份 tsconfig，改一个设置要改 5 处。抽成共享包后所有项目 extends 同一份基础配置。

```json
// packages/shared-config/tsconfig/base.json
{ "compilerOptions": {
    "strict": true, "target": "ES2022", "module": "ESNext",
    "moduleResolution": "bundler", "esModuleInterop": true,
    "isolatedModules": true, "skipLibCheck": true,
    "declaration": true, "declarationMap": true, "sourceMap": true,
    "noUnusedLocals": true, "noUnusedParameters": true } }
```

Node.js 和 Web 需要不同的 module 和 lib，分两个变体：

```json
// tsconfig/node.json — 用于后端
{ "extends": "./base.json", "compilerOptions": { "module": "NodeNext", "moduleResolution": "nodenext" } }
// tsconfig/web.json — 用于前端
{ "extends": "./base.json", "compilerOptions": { "lib": ["ES2022", "DOM", "DOM.Iterable"], "jsx": "react-jsx" } }
```

`isolatedModules: true` 不是可选的——Vite/esbuild 是单文件编译，不理解跨文件的 `const enum` 和 `namespace` 合并。

## 共享类型包

User、ApiResponse 这些类型前后端都要用。各写一份，字段名对不上是早晚的事。

```json
// packages/shared-types/package.json
{ "name": "@repo/shared-types", "version": "0.0.0", "private": true,
  "main": "./src/index.ts", "types": "./src/index.ts",
  "devDependencies": { "@repo/shared-config": "workspace:*", "typescript": "^5.5.0" } }
```

`main` 指向 `.ts` 源码而不是 `dist/`。Monorepo 内部直接消费源码，改了类型不用重新 build 就能在 IDE 里生效。

```json
// packages/shared-types/tsconfig.json
{ "extends": "@repo/shared-config/tsconfig/base.json",
  "compilerOptions": { "composite": true, "outDir": "./dist", "rootDir": "./src" },
  "include": ["src"] }
```

```typescript
// packages/shared-types/src/user.ts
export interface User { id: string; name: string; email: string; role: UserRole; createdAt: string }
export type UserRole = "admin" | "user" | "guest"
export type CreateUserInput = Omit<User, "id" | "createdAt">
export type UpdateUserInput = Partial<CreateUserInput>

// packages/shared-types/src/api.ts
export interface ApiResponse<T> { data: T; success: boolean; message?: string }
export interface PaginatedResponse<T> { items: T[]; total: number; page: number; pageSize: number }
export type PaginatedRequest = { page?: number; pageSize?: number; sortBy?: string; sortOrder?: "asc" | "desc" }
```

## API 客户端包

封装 fetch，泛型参数 `T` 从 `ApiResponse<T>` 一路穿透到调用方，整个链路类型安全。

```typescript
// packages/api-client/src/client.ts
import type { ApiResponse } from "@repo/shared-types"

interface ClientConfig { baseUrl: string; headers?: Record<string, string> }

export function createApiClient(config: ClientConfig) {
  const { baseUrl, headers = {} } = config
  async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options, headers: { "Content-Type": "application/json", ...headers, ...options.headers },
    })
    if (!response.ok) { const err = await response.json(); throw new Error(err.message ?? `HTTP ${response.status}`) }
    return response.json()
  }
  return {
    get<T>(path: string, params?: Record<string, string>) {
      return request<T>(`${path}${params ? `?${new URLSearchParams(params)}` : ""}`) },
    post<T>(path: string, body: unknown) { return request<T>(path, { method: "POST", body: JSON.stringify(body) }) },
    put<T>(path: string, body: unknown) { return request<T>(path, { method: "PUT", body: JSON.stringify(body) }) },
    delete<T>(path: string) { return request<T>(path, { method: "DELETE" }) },
  }
}
```

## Web 前端和 API 后端

前端用 Vite + Vue，后端用 Express + tsup：

```json
// apps/web/package.json
{ "name": "@repo/web", "version": "0.0.0", "private": true,
  "scripts": { "dev": "vite", "build": "vite build", "typecheck": "tsc --noEmit" },
  "dependencies": { "@repo/shared-types": "workspace:*", "@repo/api-client": "workspace:*", "vue": "^3.4.0" },
  "devDependencies": { "@repo/shared-config": "workspace:*", "typescript": "^5.5.0", "vite": "^5.3.0" } }

// apps/web/tsconfig.json
{ "extends": "@repo/shared-config/tsconfig/web.json",
  "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"] } },
  "include": ["src"],
  "references": [{ "path": "../../packages/shared-types" }, { "path": "../../packages/api-client" }] }
```

```json
// apps/api/package.json
{ "name": "@repo/api", "version": "0.0.0", "private": true,
  "scripts": { "dev": "tsx watch src/index.ts", "build": "tsup", "typecheck": "tsc --noEmit" },
  "dependencies": { "@repo/shared-types": "workspace:*", "express": "^4.19.0" },
  "devDependencies": { "@repo/shared-config": "workspace:*", "@types/express": "^4.17.21", "tsup": "^8.0.0", "tsx": "^4.15.0", "typescript": "^5.5.0" } }
```

```typescript
// apps/api/src/index.ts
import express from "express"
import type { User, ApiResponse, PaginatedResponse } from "@repo/shared-types"

const app = express()
app.use(express.json())

const users: User[] = [
  { id: "1", name: "张三", email: "zhangsan@example.com", role: "admin", createdAt: new Date().toISOString() },
]

app.get("/users", (req, res) => {
  const page = Number(req.query.page) || 1
  const pageSize = Number(req.query.pageSize) || 20
  const items = users.slice((page - 1) * pageSize, page * pageSize)
  const response: ApiResponse<PaginatedResponse<User>> = {
    success: true, data: { items, total: users.length, page, pageSize },
  }
  res.json(response)
})

app.listen(3001, () => console.log("API running on http://localhost:3001"))
```

## 验证

```bash
pnpm install                # workspace:* 自动链接本地包
pnpm typecheck              # Turborepo 并行检查所有包
pnpm build                  # 按依赖顺序构建
pnpm --filter @repo/api dev # 启动后端
pnpm --filter @repo/web dev # 启动前端
```

## 练习

### 练习一：添加工具函数包

在 `packages/utils` 中创建工具包，包含 `formatDate` 和 `debounce`，在 `apps/web` 中用 `@repo/utils` 引用。

### 练习二：添加 Vitest 测试

为 Monorepo 配置 Vitest，`turbo test` 能并行运行所有包测试。给 `packages/utils` 写一个通过的测试。

### 练习三：Docker 多阶段构建

为 `apps/api` 写 Dockerfile，要求多阶段构建、先复制 package.json 利用层缓存、最终镜像只包含 dist。

---

## 参考答案

### 练习一

```json
// packages/utils/package.json
{ "name": "@repo/utils", "version": "0.0.0", "private": true, "main": "./src/index.ts",
  "devDependencies": { "@repo/shared-config": "workspace:*", "typescript": "^5.5.0" } }
```

```typescript
export function formatDate(date: Date | string, format = "YYYY-MM-DD"): string {
  const d = typeof date === "string" ? new Date(date) : date
  return format.replace("YYYY", String(d.getFullYear()))
    .replace("MM", String(d.getMonth() + 1).padStart(2, "0"))
    .replace("DD", String(d.getDate()).padStart(2, "0"))
}
```

在 `apps/web/package.json` 加 `"@repo/utils": "workspace:*"`。

### 练习二

根目录 `pnpm -w add -D vitest`，每个包加 `"test": "vitest run"`，turbo.json 加 `"test": { "dependsOn": ["^build"] }`。

```typescript
import { describe, it, expect } from "vitest"
import { formatDate } from "../date"
describe("formatDate", () => {
  it("默认格式", () => { expect(formatDate(new Date("2024-01-15"))).toBe("2024-01-15") })
})
```

### 练习三

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
RUN pnpm --filter @repo/api build
FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

# API 类型生成

## 场景引入

你的前端团队和后端团队经常因为 API 类型不一致而扯皮。后端改了一个字段名但没通知前端，前端上线后页面报错。每次后端接口变更，前端都要手动对照检查 TypeScript 类型定义。有没有办法从后端的 API 定义自动生成前端的类型文件？

## 学习目标

- 理解 API 类型同步的核心问题
- 掌握从 OpenAPI 规范生成 TypeScript 类型的方法
- 了解 gRPC 类型生成的基本流程
- 学会在 CI 中集成类型同步校验
- 掌握 API 客户端代码的自动生成

## 一、API 类型同步的核心问题

前后端协作中，类型不一致是最常见的 bug 来源。核心矛盾是：**后端是 API 类型的唯一真实来源，但前端需要独立的 TypeScript 类型定义**。

解决方案：**从单一真实来源自动生成类型定义**，最常用的来源是 OpenAPI 规范。

## 二、OpenAPI 规范与类型生成

OpenAPI 是描述 REST API 的标准格式。`openapi-typescript` 是最流行的类型生成工具。

```bash
pnpm add -D openapi-typescript
npx openapi-typescript ./openapi.yaml -o src/api/types.d.ts
```

给定以下 OpenAPI 片段：

```yaml
components:
  schemas:
    User:
      type: object
      required: [id, name, email]
      properties:
        id: { type: string, format: uuid }
        name: { type: string }
        email: { type: string, format: email }
        role: { type: string, enum: [admin, user, guest] }
```

生成的类型：

```typescript
export interface components {
  schemas: {
    User: {
      id: string;
      name: string;
      email: string;
      role?: "admin" | "user" | "guest";
    };
  };
}
```

配合 `openapi-fetch` 使用（推荐）：

```bash
pnpm add openapi-fetch
```

```typescript
import createClient from "openapi-fetch";
import type { paths } from "./types.d.ts";

const client = createClient<paths>({ baseUrl: "http://localhost:8000" });

const { data } = await client.GET("/users", {
  params: { query: { page: 1, pageSize: 20 } },
});

data?.items?.forEach((user) => {
  console.log(user.name);   // ✅ 类型安全
  // console.log(user.xxx); // ❌ 类型报错
});
```

## 三、gRPC 类型生成

后端使用 gRPC 时，可以从 proto 文件生成 TypeScript 类型：

```protobuf
// proto/user.proto
syntax = "proto3";
package user;

service UserService {
  rpc GetUser (GetUserRequest) returns (User);
}

message User {
  string id = 1;
  string name = 2;
  string email = 3;
}
```

```bash
pnpm add -D grpc-tools @types/google-protobuf grpc_tools_node_protoc_ts

npx grpc_tools_node_protoc \
  --js_out=import_style=commonjs,binary:./src/generated \
  --grpc_out=grpc_js:./src/generated \
  -I ./proto ./proto/*.proto
```

## 四、CI 集成类型同步校验

在 CI 中检查类型是否与 OpenAPI 规范同步：

```json
{
  "scripts": {
    "api:generate": "openapi-typescript ./openapi.yaml -o src/api/types.generated.ts",
    "api:check": "openapi-typescript ./openapi.yaml -o /tmp/types.ts && diff -q src/api/types.generated.ts /tmp/types.ts"
  }
}
```

```yaml
# .github/workflows/api-sync.yml
name: API Type Sync
on:
  pull_request:
    paths: ["openapi.yaml", "src/api/**"]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install
      - name: Regenerate and check
        run: |
          pnpm api:generate
          if [ -n "$(git status --porcelain)" ]; then
            echo "API types out of sync. Run 'pnpm api:generate' locally."
            exit 1
          fi
```

## 五、类型同步最佳实践

完整的类型传递链：后端代码 → OpenAPI 规范 → TypeScript 类型 → 前端使用。

```json
{
  "scripts": {
    "api:generate": "openapi-typescript http://localhost:8000/openapi.json -o src/api/types.d.ts",
    "api:generate:local": "openapi-typescript ./openapi.yaml -o src/api/types.d.ts"
  }
}
```

生成文件应纳入版本控制：PR review 时可以看到 API 变更的影响。文件加 `.generated.ts` 后缀，让 ESLint 忽略。

## 常见误区

1. **手动维护 API 类型**：后端变更后忘记更新，导致线上类型错误
2. **不把生成文件纳入版本控制**：PR review 时无法看到 API 变更的影响
3. **生成的类型直接修改**：应该修改 OpenAPI 规范或后端代码
4. **忽略 CI 校验**：本地生成一次就不管了，应该在 CI 中检查同步

## 工程建议

1. **OpenAPI 规范是唯一真实来源**：后端生成 OpenAPI，前端从 OpenAPI 生成类型
2. **生成文件加 `.generated.ts` 后缀**：让 ESLint 忽略，避免 lint 报错
3. **PR 中自动触发类型重新生成**：openapi.yaml 变更时 CI 自动检查差异
4. **使用 openapi-fetch 而非手写 fetch**：基于生成的类型提供完整的请求/响应类型安全

## 小结

本课讲解了如何从 OpenAPI 规范和 gRPC proto 文件自动生成 TypeScript 类型定义。核心流程：后端维护 API 规范 → 自动生成 TypeScript 类型 → CI 校验同步状态。openapi-typescript + openapi-fetch 是 REST API 的最佳实践方案。

## 练习

### 练习一：OpenAPI 类型生成

给定以下 OpenAPI 规范片段，写出 openapi-typescript 生成的 TypeScript 类型：

```yaml
components:
  schemas:
    Product:
      type: object
      required: [id, name, price]
      properties:
        id: { type: string }
        name: { type: string }
        price: { type: number }
        category: { type: string, enum: [electronics, clothing, food] }
```

### 练习二：API 客户端封装

使用 openapi-fetch 为 `GET /products/{id}` 接口编写类型安全的请求代码。

### 练习三：CI 同步检查

设计一个 CI 工作流，在 PR 中检查 API 类型是否与 OpenAPI 规范同步。

---

## 参考答案

### 练习一

**思路**：required 字段映射为必填，非 required 映射为可选，enum 映射为联合类型。

**答案**：

```typescript
export interface components {
  schemas: {
    Product: {
      id: string;
      name: string;
      price: number;
      category?: "electronics" | "clothing" | "food";
    };
  };
}
```

**要点**：`required` 中的字段没有 `?`，enum 转为联合类型。

### 练习二

**思路**：用 `createClient` 创建客户端，用路径参数约束请求。

**答案**：

```typescript
import createClient from "openapi-fetch";
import type { paths } from "./types.generated";
const client = createClient<paths>({ baseUrl: "http://localhost:8000" });

async function getProduct(id: string) {
  const { data, error } = await client.GET("/products/{id}", {
    params: { path: { id } },
  });
  if (error) throw new Error("获取产品失败");
  return data; // 自动推断为 Product 类型
}
```

**要点**：路径参数 `{id}` 对应类型定义，返回值类型自动推断。

### 练习三

**思路**：PR 触发时重新生成类型，检查 git status 是否有变更。

**答案**：

```yaml
name: API Type Sync
on:
  pull_request:
    paths: ["openapi.yaml", "src/api/**"]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm api:generate
      - run: |
          if [ -n "$(git status --porcelain)" ]; then
            echo "API types out of sync. Run 'pnpm api:generate' locally."
            exit 1
          fi
```

**要点**：`paths` 过滤只在相关文件变更时触发，生成后检查 `git status`。

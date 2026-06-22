# Lesson 06: 多语言 Prompt

> **课程定位**：真实项目往往涉及多种语言和框架——学会在多语言场景下编写精准的 Prompt。
>
> **前置要求**：Lesson 01-05（核心原则、结构化模板、上下文、迭代式、系统级）。
>
> **预计时长**：50 分钟

---

## 场景引入

你的项目是 TypeScript 前端 + Python 数据处理后端。你让 AI 写一个数据分析功能，AI 在 TypeScript 端生成了 Express 风格的代码（但你用的是 Next.js），在 Python 端返回了 `{ user_id: int }`（但 TypeScript 端期望 `{ userId: string }`）。两端的错误格式也不统一——TypeScript 端用 `{ error: { code, message } }`，Python 端返回 `{ detail: string }`。前端拿到数据后类型报错，错误处理也要写两套。多语言场景下，语言边界不清和数据契约不一致是最常见的坑。

---

## 学习目标

完成本课后，你将能够：

1. 在 **TypeScript + Python 全栈**场景下编写跨语言 Prompt
2. 处理 **SQL + ORM** 混合场景的 Prompt
3. 编写 **React + CSS + TypeScript** 前端三语言 Prompt
4. 管理多语言项目的**上下文切换**
5. 避免多语言 Prompt 中的**常见混淆**

---

## 1. 为什么多语言 Prompt 更具挑战？

```
┌──────────────────────────────────────────────────────────┐
│              单语言 vs 多语言 Prompt                       │
│                                                          │
│  单语言 Prompt：                                          │
│  ┌──────────────────────────────────────┐                │
│  │ "用 TypeScript 写一个用户服务"        │                │
│  │                                      │                │
│  │ AI 只需关注一种语言的惯用法            │                │
│  │ 类型系统、错误处理、命名风格统一       │                │
│  └──────────────────────────────────────┘                │
│                                                          │
│  多语言 Prompt：                                          │
│  ┌──────────────────────────────────────┐                │
│  │ "用 TypeScript 写 API，Python 做数据  │                │
│  │  处理，SQL 做复杂查询"                │                │
│  │                                      │                │
│  │ AI 需要同时处理：                     │                │
│  │  - 两种语言的类型系统                 │                │
│  │  - 不同的错误处理模式                 │                │
│  │  - 语言间的数据传递格式               │                │
│  │  - 各自的命名约定                     │                │
│  └──────────────────────────────────────┘                │
│                                                          │
│  挑战点：                                                │
│  1. 语言边界在哪里？                                     │
│  2. 数据如何在语言间传递？                                │
│  3. 各语言用什么惯用法？                                  │
│  4. 错误如何跨语言传播？                                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 2. 场景一：TypeScript + Python 全栈

### 2.1 典型架构

```
┌──────────────────────────────────────────────────────────┐
│           TypeScript + Python 全栈架构                     │
│                                                          │
│  前端 (TypeScript)          后端                          │
│  ┌─────────────────┐       ┌─────────────────────┐      │
│  │ Next.js App     │       │ Python FastAPI       │      │
│  │ React + TS      │──────▶│ 数据处理 / ML        │      │
│  │ React Query     │ REST  │ pandas / numpy       │      │
│  └─────────────────┘ API   └─────────────────────┘      │
│                                     │                    │
│                                     ▼                    │
│                            ┌─────────────────┐          │
│                            │ PostgreSQL       │          │
│                            └─────────────────┘          │
│                                                          │
│  TypeScript 负责：UI、API 网关、类型安全                   │
│  Python 负责：数据处理、ML 推理、复杂计算                  │
│  共享：API 契约（请求/响应类型）                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Prompt 模板

```markdown
## 全栈功能描述模板

### TypeScript 端（前端/网关）
- 框架：Next.js 14 App Router
- 任务：[具体描述]
- 类型定义：[请求/响应的 TypeScript 类型]
- 调用方式：[fetch / React Query / axios]

### Python 端（数据处理/ML）
- 框架：FastAPI / Flask
- 任务：[具体描述]
- 输入验证：Pydantic model
- 输出格式：[与 TypeScript 端的类型对应]

### API 契约
- 端点：[METHOD /path]
- 请求：[JSON 结构]
- 响应：[JSON 结构]
- 错误：[错误码和消息格式]
```

### 2.3 完整示例：数据分析 API

**Prompt：**

```
实现一个数据分析功能：

[TypeScript 端 - Next.js API Route]
POST /api/analyze-sales
接受：{ dateRange: { start: string; end: string }; groupBy: 'day' | 'week' | 'month' }
转发请求到 Python 数据服务，返回分析结果

[Python 端 - FastAPI]
POST /analyze-sales
接受 Pydantic model 验证的请求
用 pandas 处理销售数据，按时间维度聚合
返回：{ labels: string[]; values: number[]; summary: { total: number; avg: number; trend: 'up' | 'down' } }

[共享类型]
TypeScript 和 Python 的类型定义必须一致
```

**TypeScript 端生成：**

```typescript
// ===== TypeScript: Next.js API Route =====
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const requestSchema = z.object({
  dateRange: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  groupBy: z.enum(['day', 'week', 'month']),
});

interface SalesAnalysisResult {
  labels: string[];
  values: number[];
  summary: {
    total: number;
    avg: number;
    trend: 'up' | 'down';
  };
}

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/analyze-sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: { code: 'ANALYSIS_ERROR', message: error.detail ?? 'Analysis failed' } },
        { status: response.status }
      );
    }

    const result: SalesAnalysisResult = await response.json();
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'SERVICE_UNAVAILABLE', message: 'Python analysis service is down' } },
      { status: 503 }
    );
  }
}
```

**Python 端生成：**

```python
# ===== Python: FastAPI Data Service =====
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, field_validator
from datetime import datetime
import pandas as pd
from typing import Literal

app = FastAPI()

class DateRange(BaseModel):
    start: str
    end: str

    @field_validator("start", "end")
    @classmethod
    def validate_date(cls, v: str) -> str:
        datetime.strptime(v, "%Y-%m-%d")
        return v

class AnalysisRequest(BaseModel):
    dateRange: DateRange
    groupBy: Literal["day", "week", "month"]

class Summary(BaseModel):
    total: float
    avg: float
    trend: Literal["up", "down"]

class AnalysisResponse(BaseModel):
    labels: list[str]
    values: list[float]
    summary: Summary

@app.post("/analyze-sales", response_model=AnalysisResponse)
async def analyze_sales(request: AnalysisRequest) -> AnalysisResponse:
    # 从数据库加载销售数据
    df = load_sales_data(request.dateRange.start, request.dateRange.end)

    if df.empty:
        raise HTTPException(status_code=404, detail="No sales data found for the given date range")

    # 按时间维度聚合
    df["date"] = pd.to_datetime(df["date"])
    freq_map = {"day": "D", "week": "W", "month": "ME"}
    freq = freq_map[request.groupBy]

    grouped = df.groupby(pd.Grouper(key="date", freq=freq))["amount"].sum()

    labels = [d.strftime("%Y-%m-%d") for d in grouped.index]
    values = grouped.tolist()

    total = sum(values)
    avg = total / len(values) if values else 0
    trend = "up" if len(values) >= 2 and values[-1] > values[0] else "down"

    return AnalysisResponse(
        labels=labels,
        values=values,
        summary=Summary(total=round(total, 2), avg=round(avg, 2), trend=trend),
    )

def load_sales_data(start: str, end: str) -> pd.DataFrame:
    # 实际项目中从数据库加载
    # 这里用示例数据
    import numpy as np
    dates = pd.date_range(start, end)
    return pd.DataFrame({
        "date": dates,
        "amount": np.random.uniform(100, 1000, len(dates)),
    })
```

---

## 3. 场景二：SQL + ORM 混合

### 3.1 何时用 SQL，何时用 ORM？

```
┌──────────────────────────────────────────────────────────┐
│              SQL vs ORM 决策树                            │
│                                                          │
│  你的查询需求是什么？                                     │
│       │                                                  │
│       ├── 简单 CRUD                                      │
│       │   └── 用 ORM（Prisma / TypeORM / SQLAlchemy）    │
│       │       "用 Prisma 查找所有活跃用户"                 │
│       │                                                  │
│       ├── 复杂聚合/统计                                   │
│       │   └── 用原生 SQL / ORM 的原生查询                 │
│       │       "按月统计订单金额，计算环比增长率"           │
│       │                                                  │
│       ├── 窗口函数/递归查询                               │
│       │   └── 用原生 SQL                                 │
│       │       "计算用户的连续登录天数"                    │
│       │                                                  │
│       └── 性能敏感的查询                                  │
│           └── 用原生 SQL + 手动优化                       │
│               "百万级数据的分页搜索"                       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 3.2 SQL + ORM Prompt 模板

```markdown
## 混合查询描述模板

### 场景
[说明为什么需要原生 SQL 而非纯 ORM]

### ORM 部分（Prisma/TypeORM/SQLAlchemy）
- 用途：[简单查询、关联加载等]
- Model：[涉及的 model 名称]

### SQL 部分
- 用途：[复杂聚合、窗口函数等]
- 数据库：[PostgreSQL / MySQL / SQLite]
- 性能要求：[是否需要索引提示、查询计划优化]

### 结果映射
- SQL 返回结果如何映射到 TypeScript/Python 类型
- 是否需要 ORM 的 `$queryRaw` 或类似功能
```

### 3.3 完整示例

**Prompt：**

```
实现一个用户活跃度统计功能：

[ORM 部分 - Prisma]
查询用户基本信息和最近登录时间

[SQL 部分 - PostgreSQL]
计算用户的连续活跃天数（需要窗口函数）
统计本周/本月的活跃用户数
计算日活/周活/月活比率

[结果]
返回 TypeScript 类型：{ userId: string; name: string; streak: number; metrics: {...} }
```

**TypeScript + Prisma + SQL 生成：**

```typescript
// ===== 复杂统计查询 =====
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface UserActivityMetrics {
  userId: string;
  name: string;
  email: string;
  streak: number;
  totalLogins: number;
  lastLoginAt: Date | null;
}

interface PlatformMetrics {
  dailyActive: number;
  weeklyActive: number;
  monthlyActive: number;
  dauMauRatio: number;
}

async function getUserActivityMetrics(): Promise<UserActivityMetrics[]> {
  // 用 Prisma 的 $queryRaw 执行复杂 SQL
  const results = await prisma.$queryRaw<UserActivityMetrics[]>`
    WITH login_streaks AS (
      SELECT
        user_id,
        login_date,
        login_date - INTERVAL '1 day' * ROW_NUMBER() OVER (
          PARTITION BY user_id ORDER BY login_date
        ) AS streak_group
      FROM (
        SELECT DISTINCT user_id, DATE(created_at) AS login_date
        FROM user_logins
        WHERE created_at >= NOW() - INTERVAL '90 days'
      ) distinct_logins
    ),
    streak_counts AS (
      SELECT
        user_id,
        COUNT(*) AS streak_length,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY COUNT(*) DESC) AS rn
      FROM login_streaks
      GROUP BY user_id, streak_group
    )
    SELECT
      u.id AS "userId",
      u.name,
      u.email,
      COALESCE(sc.streak_length, 0)::int AS streak,
      COALESCE(ul.total_logins, 0)::int AS "totalLogins",
      ul.last_login AS "lastLoginAt"
    FROM users u
    LEFT JOIN streak_counts sc ON u.id = sc.user_id AND sc.rn = 1
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS total_logins, MAX(created_at) AS last_login
      FROM user_logins
      GROUP BY user_id
    ) ul ON u.id = ul.user_id
    ORDER BY streak DESC, "totalLogins" DESC
  `;

  return results;
}

async function getPlatformMetrics(): Promise<PlatformMetrics> {
  const results = await prisma.$queryRaw<[PlatformMetrics]>`
    SELECT
      COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN user_id END)::int AS "dailyActive",
      COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN user_id END)::int AS "weeklyActive",
      COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN user_id END)::int AS "monthlyActive",
      ROUND(
        COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN user_id END)::numeric /
        NULLIF(COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN user_id END), 0),
        4
      ) AS "dauMauRatio"
    FROM user_logins
  `;

  return results[0];
}
```

---

## 4. 场景三：React + CSS + TypeScript 前端三语言

### 4.1 三种语言的职责

```
┌──────────────────────────────────────────────────────────┐
│        React + CSS + TypeScript 职责划分                  │
│                                                          │
│  TypeScript：                                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │ - Props 类型定义                                    │  │
│  │ - 状态类型                                          │  │
│  │ - 事件处理函数                                      │  │
│  │ - API 调用逻辑                                      │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  React (JSX/TSX)：                                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │ - 组件结构                                          │  │
│  │ - 条件渲染                                          │  │
│  │ - 列表渲染                                          │  │
│  │ - 事件绑定                                          │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  CSS (Tailwind / CSS Modules)：                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ - 布局（flex, grid）                                │  │
│  │ - 间距（padding, margin）                           │  │
│  │ - 颜色、字体、阴影                                  │  │
│  │ - 响应式断点                                        │  │
│  │ - 动画/过渡                                         │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 4.2 前端组件 Prompt 模板

```markdown
## 组件描述模板

### 功能
[组件做什么，用户如何交互]

### TypeScript 层
- Props 接口：[类型定义]
- 状态管理：[useState / Zustand / React Query]
- 事件处理：[用户操作的响应逻辑]

### React 层
- 组件结构：[DOM 层次描述]
- 条件渲染：[什么条件下显示什么]
- 列表渲染：[数据如何映射为 UI]

### CSS 层（Tailwind）
- 布局：[flex / grid / 定位]
- 响应式：[移动端/桌面端的差异]
- 暗色模式：[是否支持]
- 动画：[进入/退出/交互反馈]
```

### 4.3 完整示例：数据表格组件

**Prompt：**

```
实现一个可排序的数据表格组件：

[TypeScript]
- Props: columns 定义（key, label, sortable, render?）, data 数组, onSort 回调
- 状态: 当前排序字段和方向
- 类型: 泛型支持，columns 的 key 必须是 data 元素的键

[React]
- 表头：显示列名，可排序列显示排序箭头
- 表体：按列映射数据，支持自定义 render 函数
- 空状态：无数据时显示占位

[CSS - Tailwind]
- 圆角卡片样式，悬停行高亮
- 排序箭头动画
- 响应式：移动端横向滚动
```

**生成代码：**

```typescript
// ===== TypeScript: 类型定义 =====
import { useState, useCallback, type ReactNode } from 'react';

type SortDirection = 'asc' | 'desc' | null;

interface Column<T> {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (value: T[keyof T], row: T) => ReactNode;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  onSort?: (key: string, direction: SortDirection) => void;
  emptyMessage?: string;
  className?: string;
}

interface SortState {
  key: string | null;
  direction: SortDirection;
}

// ===== React + TypeScript: 组件实现 =====
export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onSort,
  emptyMessage = '暂无数据',
  className = '',
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>({ key: null, direction: null });

  const handleSort = useCallback(
    (key: string, sortable?: boolean) => {
      if (!sortable) return;

      setSort((prev) => {
        const newDirection: SortDirection =
          prev.key === key
            ? prev.direction === 'asc'
              ? 'desc'
              : prev.direction === 'desc'
                ? null
                : 'asc'
            : 'asc';

        const newKey = newDirection === null ? null : key;
        onSort?.(key, newDirection);
        return { key: newKey, direction: newDirection };
      });
    },
    [onSort]
  );

  const sortedData = [...data].sort((a, b) => {
    if (!sort.key || !sort.direction) return 0;
    const aVal = a[sort.key];
    const bVal = b[sort.key];
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    const cmp = aVal < bVal ? -1 : 1;
    return sort.direction === 'asc' ? cmp : -cmp;
  });

  const renderSortIcon = (columnKey: string, sortable?: boolean) => {
    if (!sortable) return null;
    const isActive = sort.key === columnKey;
    return (
      <span className="ml-1 inline-flex flex-col">
        <svg
          className={`h-3 w-3 transition-colors ${
            isActive && sort.direction === 'asc' ? 'text-blue-600' : 'text-gray-300'
          }`}
          viewBox="0 0 10 6"
          fill="currentColor"
        >
          <path d="M5 0L10 6H0z" />
        </svg>
        <svg
          className={`h-3 w-3 -mt-0.5 transition-colors ${
            isActive && sort.direction === 'desc' ? 'text-blue-600' : 'text-gray-300'
          }`}
          viewBox="0 0 10 6"
          fill="currentColor"
        >
          <path d="M5 6L0 0h10z" />
        </svg>
      </span>
    );
  };

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    // CSS: Tailwind 样式
    <div className={`overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 ${
                  col.sortable ? 'cursor-pointer select-none hover:bg-gray-100' : ''
                }`}
                style={col.width ? { width: col.width } : undefined}
                onClick={() => handleSort(col.key, col.sortable)}
              >
                <div className="flex items-center">
                  {col.label}
                  {renderSortIcon(col.key, col.sortable)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {sortedData.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="transition-colors hover:bg-gray-50"
            >
              {columns.map((col) => (
                <td key={col.key} className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                  {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===== 使用示例 =====
interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  role: string;
}

const columns: Column<User>[] = [
  { key: 'name', label: '姓名', sortable: true, width: '200px' },
  { key: 'email', label: '邮箱', sortable: true },
  { key: 'age', label: '年龄', sortable: true, width: '100px' },
  {
    key: 'role',
    label: '角色',
    render: (value) => (
      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
        {String(value)}
      </span>
    ),
  },
];

function UserTable() {
  const users: User[] = [
    { id: '1', name: 'Alice', email: 'alice@example.com', age: 30, role: 'admin' },
    { id: '2', name: 'Bob', email: 'bob@example.com', age: 25, role: 'user' },
  ];

  return (
    <DataTable
      columns={columns}
      data={users}
      onSort={(key, dir) => console.log(`Sort by ${key} ${dir}`)}
    />
  );
}
```

---

## 5. 多语言上下文切换策略

### 5.1 上下文标记法

```
在 Prompt 中用明确的标记区分语言上下文：

  ┌─ [TypeScript] ─────────────────────────────┐
  │ 这部分描述 TypeScript 端的需求              │
  │ 类型定义、API 路由、前端逻辑                │
  └────────────────────────────────────────────┘

  ┌─ [Python] ─────────────────────────────────┐
  │ 这部分描述 Python 端的需求                  │
  │ 数据处理、ML 模型、后台任务                 │
  └────────────────────────────────────────────┘

  ┌─ [SQL] ────────────────────────────────────┐
  │ 这部分描述 SQL 查询需求                     │
  │ 复杂聚合、窗口函数、性能优化                │
  └────────────────────────────────────────────┘
```

### 5.2 数据契约定义

```typescript
// 在多语言 Prompt 中，先定义数据契约（TypeScript 类型）
// Python 端用 Pydantic model 保持一致

// ===== 共享数据契约 =====

// TypeScript 端
interface AnalysisRequest {
  dateRange: { start: string; end: string };
  metrics: ('revenue' | 'orders' | 'users')[];
  granularity: 'day' | 'week' | 'month';
}

interface AnalysisResponse {
  series: Array<{
    metric: string;
    data: Array<{ date: string; value: number }>;
  }>;
  summary: Record<string, { total: number; change: number }>;
}

// Python 端（对应 Pydantic model）
// class AnalysisRequest(BaseModel):
//     dateRange: DateRange
//     metrics: list[Literal["revenue", "orders", "users"]]
//     granularity: Literal["day", "week", "month"]
//
// class AnalysisResponse(BaseModel):
//     series: list[SeriesData]
//     summary: dict[str, MetricSummary]
```

---

## 6. 常见误区

### ❌ 错误 1：语言边界不清晰

```
"写一个 API 处理数据"
→ AI 不知道用 TypeScript 还是 Python
→ 可能在 TypeScript 中写了 Python 风格的代码
```

**修复**：明确标注每部分用什么语言——"[TypeScript] API 路由... [Python] 数据处理..."。

### ❌ 错误 2：类型不一致

```
TypeScript 定义了 { userId: string }
Python 返回了 { user_id: int }
→ 前端接收数据时类型不匹配
```

**修复**：在 Prompt 中定义数据契约，两端严格遵循。

### ❌ 错误 3：错误处理跨语言不统一

```
TypeScript 端返回 { error: { code, message } }
Python 端返回 { detail: string }
→ 前端需要处理两种错误格式
```

**修复**：统一错误响应格式，或在 TypeScript 网关层做格式转换。

### ❌ 错误 4：ORM 和 SQL 混用无策略

```
简单查询也用原生 SQL，复杂查询反而用 ORM
→ 代码风格不统一，维护困难
```

**修复**：制定策略——简单 CRUD 用 ORM，复杂查询用原生 SQL。

### ❌ 错误 5：CSS 与逻辑混在一起

```
在事件处理函数中动态拼接 CSS 类名
→ 样式逻辑难以维护
```

**修复**：用 Tailwind 的条件类名或 clsx/classnames 库管理。

---

## 7. 工程建议

1. **先定义数据契约再写代码**：在多语言 Prompt 中，先用 TypeScript interface 或 JSON Schema 定义 API 的请求/响应格式，再分别让 AI 生成 TypeScript 和 Python 端代码。数据契约是两端的"翻译基准"。

2. **用明确的语言标记分隔 Prompt**：在 Prompt 中用 `[TypeScript]`、`[Python]`、`[SQL]` 等标记划分不同语言的描述段落，避免 AI 在语言间混淆。每个标记下只描述该语言的职责和约束。

3. **简单 CRUD 用 ORM，复杂查询用原生 SQL**：不要所有查询都用原生 SQL，也不要所有查询都用 ORM。制定明确的决策规则：标准增删改查用 ORM，涉及窗口函数、递归查询、复杂聚合的用原生 SQL + `$queryRaw`。

4. **统一错误响应格式**：无论后端用什么语言，对外暴露的 API 错误格式应该统一。可以在网关层（如 Next.js API Route）做格式转换，让前端只需处理一种错误结构。

---

## 8. 总结

```
多语言 Prompt 的核心策略：

  1. 明确语言边界
     [TypeScript] ... [Python] ... [SQL] ...

  2. 定义数据契约
     TypeScript interface ↔ Python Pydantic model

  3. 统一错误格式
     { error: { code, message, details } }

  4. 各语言用各语言的惯用法
     TypeScript: 类型安全、Zod 验证
     Python: 类型提示、Pydantic
     SQL: 参数化查询、索引优化
```

| 场景 | 语言组合 | 关键策略 |
|------|---------|---------|
| 全栈应用 | TypeScript + Python | API 契约、数据格式统一 |
| 数据查询 | SQL + ORM | 简单用 ORM、复杂用 SQL |
| 前端组件 | React + CSS + TS | 职责分离、类型驱动 |

---

## 9. 动手练习

### 练习 1：全栈功能 Prompt

选择以下场景之一，用多语言 Prompt 让 AI 生成完整代码：

- A. 用户注册（TypeScript 前端表单 + Python 后端验证 + SQL 用户表）
- B. 数据可视化（TypeScript 图表组件 + Python 数据聚合 + SQL 查询）
- C. 文件上传（TypeScript 上传组件 + Python 文件处理 + 云存储）

要求：TypeScript 和 Python 端的类型必须一致。

### 练习 2：SQL + ORM 混合

为以下查询场景编写 Prompt，让 AI 同时生成 Prisma 查询和原生 SQL：

- 查询每个用户的订单数量，按订单数量降序排列
- 查询最近 30 天内没有下单的活跃用户
- 计算每个产品类别的月度销售额增长率

对比：哪些用 ORM 更简洁，哪些必须用 SQL？

### 练习 3：前端三语言组件

用 React + TypeScript + Tailwind 让 AI 生成以下组件之一：

- A. 可拖拽的看板卡片（拖拽排序、拖拽到不同列）
- B. 多级下拉菜单（键盘导航、搜索过滤）
- C. 响应式导航栏（桌面端水平菜单、移动端汉堡菜单）

要求：明确标注 TypeScript 逻辑部分和 CSS 样式部分。

---

**下一课**：[Lesson 07: 阶段实战——编写 AI 编程规范](./07-阶段实战-编写AI编程规范.md) —— 综合运用所有 Prompt 技能，编写一份完整的 AI 编程规范文档。

---

## 参考答案

### 练习 1：全栈功能 Prompt

**思路**：选择用户注册场景，用 `[TypeScript]`、`[Python]`、`[SQL]` 标记明确划分语言边界，先定义共享数据契约再分别生成两端代码。

**答案**：

```
实现用户注册功能：

[数据契约]
请求：{ email: string; password: string; name: string }
成功响应：{ data: { userId: string; token: string } }
错误响应：{ error: { code: string; message: string } }

[TypeScript 端 - Next.js App Router]
POST /api/register
- 用 Zod 验证请求体（email 格式、密码 >= 8 位、name 非空）
- 转发到 Python 后端做业务处理
- 错误码：VALIDATION_ERROR(400), EMAIL_EXISTS(409), INTERNAL_ERROR(500)

[Python 端 - FastAPI]
POST /register
- Pydantic model 验证输入
- 检查邮箱是否已存在
- bcrypt 哈希密码
- 插入 PostgreSQL 用户表
- 返回 userId 和 JWT token

[SQL - PostgreSQL]
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);
```

**要点**：
- 数据契约是跨语言的"翻译基准"，必须先定义
- 用 `[TypeScript]`、`[Python]`、`[SQL]` 标记明确划分语言上下文
- 错误格式统一为 `{ error: { code, message } }`，Python 端通过 FastAPI exception handler 转换

---

### 练习 2：SQL + ORM 混合

**思路**：分析三个查询场景的复杂度，判断哪些适合 ORM、哪些必须用原生 SQL。核心原则：简单 CRUD 用 ORM，涉及窗口函数/递归/复杂聚合用 SQL。

**答案**：

**场景 1：查询每个用户的订单数量，按订单数量降序**

```typescript
// 用 Prisma ORM 即可
const userOrderCounts = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    _count: { select: { orders: true } },
  },
  orderBy: { orders: { _count: 'desc' } },
});
```

结论：ORM 更简洁，无需原生 SQL。

**场景 2：最近 30 天内没有下单的活跃用户**

```typescript
// 用 Prisma 的 NOT + some 组合
const inactiveUsers = await prisma.user.findMany({
  where: {
    status: 'active',
    orders: {
      none: {
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    },
  },
});
```

结论：ORM 可以处理，但如果"活跃"定义复杂（如需要关联登录表），则用 SQL 更灵活。

**场景 3：每个产品类别的月度销售额增长率**

```typescript
// 必须用原生 SQL - 涉及窗口函数 LAG()
const results = await prisma.$queryRaw`
  WITH monthly_sales AS (
    SELECT
      c.name AS category,
      DATE_TRUNC('month', o.created_at) AS month,
      SUM(oi.quantity * oi.price) AS revenue
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    JOIN orders o ON oi.order_id = o.id
    GROUP BY c.name, DATE_TRUNC('month', o.created_at)
  ),
  with_growth AS (
    SELECT
      category,
      month,
      revenue,
      LAG(revenue) OVER (PARTITION BY category ORDER BY month) AS prev_revenue
    FROM monthly_sales
  )
  SELECT
    category,
    month,
    revenue,
    CASE WHEN prev_revenue > 0
      THEN ROUND(((revenue - prev_revenue) / prev_revenue * 100)::numeric, 2)
      ELSE NULL
    END AS growth_rate
  FROM with_growth
  ORDER BY category, month
`;
```

结论：必须用 SQL，LAG() 窗口函数无法用 ORM 表达。

**要点**：
- Prisma 的 `_count`、`some`/`none` 能覆盖大部分关联查询
- 窗口函数（LAG, ROW_NUMBER, RANK）必须用原生 SQL
- `$queryRaw` 返回的结果需要手动映射到 TypeScript 类型

---

### 练习 3：前端三语言组件

**思路**：选择响应式导航栏，明确标注 TypeScript 逻辑层和 CSS 样式层。关键是将状态管理（TS）、组件结构（JSX）、样式（Tailwind）三者职责分离。

**答案**：

```typescript
// TypeScript 层：类型定义和状态管理
import { useState, useCallback, useEffect } from 'react';

interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

interface ResponsiveNavProps {
  items: NavItem[];
  logo?: React.ReactNode;
}

// React 层：组件结构
export function ResponsiveNav({ items, logo }: ResponsiveNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // 响应式：窗口变大时自动关闭移动菜单
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleDropdown = useCallback((label: string) => {
    setActiveDropdown((prev) => (prev === label ? null : label));
  }, []);

  return (
    // CSS 层：Tailwind 样式
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex-shrink-0">{logo}</div>

          {/* 桌面端菜单 - 隐藏在移动端 */}
          <div className="hidden md:flex md:items-center md:space-x-1">
            {items.map((item) => (
              <div key={item.label} className="relative group">
                <a
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  onClick={item.children ? (e) => { e.preventDefault(); toggleDropdown(item.label); } : undefined}
                >
                  {item.label}
                  {item.children && (
                    <svg className="ml-1 inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </a>
                {/* 下拉菜单 */}
                {item.children && activeDropdown === item.label && (
                  <div className="absolute left-0 mt-1 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                    {item.children.map((child) => (
                      <a key={child.href} href={child.href} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        {child.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 移动端汉堡按钮 - 隐藏在桌面端 */}
          <button
            className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="打开菜单"
          >
            {isOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* 移动端展开菜单 */}
      {isOpen && (
        <div className="md:hidden border-t border-gray-200">
          <div className="space-y-1 px-4 pb-3 pt-2">
            {items.map((item) => (
              <a key={item.href} href={item.href} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900">
                {item.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
```

**要点**：
- TypeScript 层负责：Props 类型、状态（isOpen, activeDropdown）、事件处理
- JSX 层负责：条件渲染（桌面/移动端切换）、列表渲染（菜单项）
- Tailwind 层负责：`hidden md:flex` 实现响应式显隐、hover/transition 交互反馈
- 使用 `md:` 断点区分桌面端和移动端布局

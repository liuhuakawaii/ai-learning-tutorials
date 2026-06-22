# 第7课：阶段实战——AI 知识工作台 MVP

> **课程定位**：综合运用阶段四所学，构建完整产品
> **前置知识**：第 1-6 课的全部内容
> **预计时长**：120 分钟

## 场景引入

前六节课你分别学了信息架构、权限控制、会话管理、成本控制、安全防护和日志追踪。现在把这些碎片拼起来的机会来了——你接到一个真实需求：公司内部需要一个"AI 知识工作台"，让员工上传内部文档（产品手册、技术文档、会议纪要），然后通过对话的方式向 AI 提问，AI 基于这些文档回答并附上引用来源。你需要在一周内交付一个 MVP。这个实战课就是带你从零到一把这个产品搭出来，把前六课的知识在真实项目中串一遍。

---

## 学习目标

完成本课后，你将构建一个 AI 知识工作台 MVP，支持：

1. 用户登录和配额管理
2. 多个知识库管理
3. 带引用的问答
4. 会话历史和搜索
5. 使用统计和日志

---

## 一、项目结构

```
ai-workspace/
├── .env
├── prisma/
│   └── schema.prisma
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── chat/page.tsx
│   │   ├── chat/[id]/page.tsx
│   │   ├── knowledge/page.tsx
│   │   ├── history/page.tsx
│   │   ├── usage/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── chat/route.ts
│       ├── conversations/route.ts
│       ├── knowledge/route.ts
│       ├── documents/route.ts
│       └── usage/route.ts
├── components/
│   ├── ui/
│   ├── chat/
│   ├── knowledge/
│   └── layout/
├── lib/
│   ├── auth.ts
│   ├── prisma.ts
│   ├── openai.ts
│   ├── rag/
│   ├── tools/
│   ├── logger/
│   └── security/
└── public/
```

---

## 二、数据库模型

```sql
-- prisma/schema.prisma

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  avatar        String?
  plan          String    @default("free")
  tokenLimit    Int       @default(100000)
  tokenUsed     Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  conversations Conversation[]
  knowledgeBases KnowledgeBase[]
  usageRecords  UsageRecord[]
}

model Conversation {
  id            String    @id @default(cuid())
  userId        String
  title         String
  model         String    @default("gpt-5.5")
  systemPrompt  String?
  isArchived    Boolean   @default(false)
  isPinned      Boolean   @default(false)
  messageCount  Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  user          User      @relation(fields: [userId], references: [id])
  messages      Message[]
  
  @@index([userId, updatedAt])
}

model Message {
  id              String    @id @default(cuid())
  conversationId  String
  role            String
  content         String
  toolCalls       Json?
  tokenUsage      Json?
  createdAt       DateTime  @default(now())
  
  conversation    Conversation @relation(fields: [conversationId], references: [id])
  
  @@index([conversationId, createdAt])
}

model KnowledgeBase {
  id            String    @id @default(cuid())
  userId        String
  name          String
  description   String?
  documentCount Int       @default(0)
  chunkCount    Int       @default(0)
  status        String    @default("ready")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  user          User      @relation(fields: [userId], references: [id])
  documents     Document[]
  
  @@index([userId])
}

model Document {
  id              String    @id @default(cuid())
  knowledgeBaseId String
  filename        String
  type            String
  size            Int
  chunkCount      Int       @default(0)
  status          String    @default("indexing")
  createdAt       DateTime  @default(now())
  
  knowledgeBase   KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id])
  chunks          Chunk[]
  
  @@index([knowledgeBaseId])
}

model Chunk {
  id          String    @id @default(cuid())
  documentId  String
  content     String
  embedding   Unsupported("vector(1536)")?
  metadata    Json?
  createdAt   DateTime  @default(now())
  
  document    Document  @relation(fields: [documentId], references: [id])
  
  @@index([documentId])
}

model UsageRecord {
  id              String    @id @default(cuid())
  userId          String
  conversationId  String
  model           String
  promptTokens    Int
  completionTokens Int
  totalTokens     Int
  cost            Float
  duration        Int
  createdAt       DateTime  @default(now())
  
  user            User      @relation(fields: [userId], references: [id])
  
  @@index([userId, createdAt])
}
```

---

## 三、核心功能实现

### 3.1 聊天 API（带 RAG 和 Trace）

```typescript
// app/api/chat/route.ts
import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { checkQuota } from '@/lib/quota'
import { detectInjection } from '@/lib/security'
import { retrieve } from '@/lib/rag'
import { chatWithTrace } from '@/lib/chat-with-trace'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: '请先登录' }, { status: 401 })
  }

  // 检查配额
  const quota = await checkQuota(user.id, 'message')
  if (!quota.allowed) {
    return Response.json({ error: quota.reason }, { status: 429 })
  }

  const { message, conversationId, knowledgeBaseId } = await req.json()

  // 检测提示注入
  const injection = detectInjection(message)
  if (injection.detected) {
    return Response.json({ error: '检测到安全风险' }, { status: 400 })
  }

  // 流式响应
  const stream = await chatWithTrace(user.id, conversationId, message, {
    knowledgeBaseId,
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
}
```

### 3.2 知识库 API

```typescript
// app/api/knowledge/route.ts
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: '请先登录' }, { status: 401 })
  }

  const quota = await checkQuota(user.id, 'knowledge_base')
  if (!quota.allowed) {
    return Response.json({ error: quota.reason }, { status: 429 })
  }

  const { name, description } = await req.json()

  const knowledgeBase = await prisma.knowledgeBase.create({
    data: {
      userId: user.id,
      name,
      description,
    },
  })

  return Response.json(knowledgeBase)
}

// 获取用户的知识库列表
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: '请先登录' }, { status: 401 })
  }

  const knowledgeBases = await prisma.knowledgeBase.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return Response.json(knowledgeBases)
}
```

---

## 四、前端页面

### 4.1 仪表盘布局

```typescript
// app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { QuotaWarning } from '@/components/QuotaWarning'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header user={user} />
        <QuotaWarning user={user} />
        <main>{children}</main>
      </div>
    </div>
  )
}
```

### 4.2 对话页面

```typescript
// app/(dashboard)/chat/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { ConversationList } from '@/components/chat/ConversationList'
import { ChatInterface } from '@/components/chat/ChatInterface'

export default function ChatPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [conversations, setConversations] = useState([])

  useEffect(() => {
    fetchConversations()
  }, [])

  const fetchConversations = async () => {
    const res = await fetch('/api/conversations')
    const data = await res.json()
    setConversations(data.conversations)
  }

  return (
    <div className="chat-page">
      <div className="sidebar">
        <button className="new-chat" onClick={() => setSelectedId(null)}>
          新对话
        </button>
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
      <div className="main">
        <ChatInterface conversationId={selectedId} />
      </div>
    </div>
  )
}
```

### 4.3 知识库管理页面

```typescript
// app/(dashboard)/knowledge/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { KnowledgeBaseList } from '@/components/knowledge/KnowledgeBaseList'
import { DocumentUpload } from '@/components/knowledge/DocumentUpload'

export default function KnowledgePage() {
  const [knowledgeBases, setKnowledgeBases] = useState([])
  const [selectedKb, setSelectedKb] = useState<string | null>(null)

  useEffect(() => {
    fetchKnowledgeBases()
  }, [])

  const fetchKnowledgeBases = async () => {
    const res = await fetch('/api/knowledge')
    const data = await res.json()
    setKnowledgeBases(data)
  }

  return (
    <div className="knowledge-page">
      <h1>知识库管理</h1>

      <div className="create-section">
        <button>创建知识库</button>
      </div>

      <KnowledgeBaseList
        knowledgeBases={knowledgeBases}
        selectedId={selectedKb}
        onSelect={setSelectedKb}
      />

      {selectedKb && (
        <DocumentUpload
          knowledgeBaseId={selectedKb}
          onUploadComplete={fetchKnowledgeBases}
        />
      )}
    </div>
  )
}
```

---

## 五、验收清单

```
┌─────────────────────────────────────────────────────────────────┐
│                    阶段实战验收清单                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ 用户系统                                                    │
│  □ 可以登录/注册                                                │
│  □ 用户只能访问自己的数据                                       │
│  □ 配额限制生效                                                 │
│                                                                 │
│  ✅ 知识库                                                      │
│  □ 可以创建多个知识库                                           │
│  □ 可以上传文档并索引                                           │
│  □ 可以删除知识库                                               │
│                                                                 │
│  ✅ 对话功能                                                    │
│  □ 可以创建新对话                                               │
│  □ 支持流式响应                                                 │
│  □ 回答包含引用                                                 │
│  □ 对资料外问题能拒答                                           │
│                                                                 │
│  ✅ 会话管理                                                    │
│  □ 对话历史可查看                                               │
│  □ 支持搜索                                                     │
│  □ 支持归档                                                     │
│                                                                 │
│  ✅ 安全                                                        │
│  □ 提示注入检测                                                 │
│  □ 越权检索防护                                                 │
│  □ 敏感信息过滤                                                 │
│                                                                 │
│  ✅ 可观测性                                                    │
│  □ 请求有 Trace                                                 │
│  □ token 使用有统计                                             │
│  □ 失败样本可查询                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 常见误区

1. **一口气实现所有功能**：MVP 的核心是"最小可用"，不是"完整产品"。先实现登录 + 对话 + 一个知识库，跑通核心链路，再迭代加功能。一上来就做配额、搜索、导出，很容易陷入"什么都做了但什么都不能用"的困境。
2. **前后端不分离调试**：前端写完页面直接联调后端，出了问题不知道是前端传参错误还是后端逻辑错误。建议先用 Postman 或 curl 把所有 API 测试通过，再写前端页面。
3. **忽略错误状态的 UI**：只实现了正常流程的页面，网络错误、配额超限、文档索引失败这些异常状态没有对应的 UI 提示，用户遇到问题只会看到白屏或 loading 转圈。
4. **部署前不做端到端测试**：本地开发环境一切正常，部署到服务器后环境变量缺失、数据库连接失败、文件上传路径错误。部署前必须在 staging 环境跑一遍完整的验收清单。

---

## 工程建议

1. **按验收清单分阶段推进**：先完成用户系统（登录 + 权限 + 配额），验证通过后再做知识库，然后做对话功能，最后做可观测性。每个阶段都有可演示的成果，降低集成风险。
2. **环境变量统一管理**：把所有配置（数据库 URL、OpenAI Key、NextAuth Secret）集中到 `.env.local`，用 Zod 做 schema 验证，启动时如果缺变量直接报错，不要等到运行时才发现。
3. **数据库迁移用 Prisma Migrate**：不要手动改数据库 schema。每次修改 `schema.prisma` 后执行 `npx prisma migrate dev`，保持数据库结构和代码同步，也方便团队协作。
4. **MVP 阶段用 Vercel 一键部署**：Next.js 项目部署到 Vercel 只需要连上 GitHub 仓库，自动构建、自动部署、自带 HTTPS 和域名。不要在 MVP 阶段花时间折腾 Docker 和 CI/CD，等产品验证通过后再优化部署流程。

---

## 小结

本课综合运用了阶段四的所有知识：

1. **用户系统**：登录、权限、配额
2. **知识库管理**：创建、上传、索引
3. **对话功能**：RAG、流式、引用
4. **会话管理**：历史、搜索、归档
5. **安全防护**：注入检测、越权防护
6. **可观测性**：Trace、日志、统计

---

## 下一阶段预告

下一阶段我们将学习评估、上线与迭代：如何构建评估集、管理 Prompt 版本、监控线上质量，把产品推向生产环境。

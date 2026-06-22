# 03 PostgreSQL 与 SQLAlchemy

> 数据模型是应用的地基——地基歪了，楼越高越危险。

## 场景引入

你的 AI 应用需要存储用户信息、对话记录、Agent 配置、知识库文档——这些数据结构各异，有的是关系型的（用户-会话-消息），有的是半结构化的（Agent 的工具配置、Skill 参数）。用 MySQL？JSON 支持弱，做向量检索还要外挂。用 MongoDB？事务支持不够，关系查询麻烦。你需要一个既能处理关系型数据、又能存 JSON、还能做向量检索的数据库，以及一个能异步操作、类型安全的 ORM。

## 学习目标

- 用 SQLAlchemy 2.0 定义数据模型（关系型 + 向量扩展预备）
- 掌握 Alembic 数据库迁移
- 理解异步数据库连接和连接池
- 设计 AI 应用的核心数据模型

## 前置要求

- 已完成第 1 课环境搭建（PostgreSQL 已通过 Docker 启动）
- SQL 基础（SELECT、INSERT、JOIN、索引）
- Python 类和装饰器基础

## 数据库连接配置

```python
# backend/app/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

# 异步引擎——连接池配置
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,          # 连接池大小
    max_overflow=10,       # 超出池大小后最多额外创建的连接数
    pool_pre_ping=True,    # 使用前检测连接是否有效
    pool_recycle=3600,     # 连接最大存活时间（秒）
    echo=settings.DEBUG,   # 开发环境打印 SQL
)

# 会话工厂
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# ORM 模型基类
class Base(DeclarativeBase):
    pass

# 依赖注入用的数据库会话
async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

### 为什么用异步

AI 应用的后端需要同时处理大量 IO 密集操作：调用 LLM API、查询向量数据库、读写 Redis。同步数据库连接会阻塞整个线程，异步连接让一个线程能同时处理成百上千个请求。

SQLAlchemy 2.0 原生支持异步，通过 `create_async_engine` 和 `AsyncSession`。

## 核心数据模型

### 用户模型

```python
# backend/app/models/user.py
from datetime import datetime
from sqlalchemy import String, DateTime, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import uuid

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    
    # 关系
    sessions: Mapped[list["ChatSession"]] = relationship(back_populates="user")
```

### 对话会话模型

```python
# backend/app/models/session.py
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, func, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import uuid

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255), default="新对话")
    agent_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    
    # 关系
    user: Mapped["User"] = relationship(back_populates="sessions")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="session", order_by="Message.created_at"
    )
```

### 消息模型

```python
# backend/app/models/message.py
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, func, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import uuid

class Message(Base):
    __tablename__ = "messages"
    
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(20))  # user / assistant / system
    content: Mapped[str] = mapped_column(Text)
    
    # AI 相关元数据
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    token_usage: Mapped[int] = mapped_column(Integer, default=0)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    
    # 关系
    session: Mapped["ChatSession"] = relationship(back_populates="messages")
```

### Agent 模型

```python
# backend/app/models/agent.py
from datetime import datetime
from sqlalchemy import String, DateTime, Text, JSON, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
import uuid

class Agent(Base):
    __tablename__ = "agents"
    
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    system_prompt: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(String(100), default="gpt-4o")
    
    # 配置
    temperature: Mapped[float] = mapped_column(default=0.7)
    max_tokens: Mapped[int] = mapped_column(default=4096)
    tools: Mapped[list | None] = mapped_column(JSON, nullable=True)  # 工具配置
    
    # 状态
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(default=1)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

## Alembic 数据库迁移

数据库表结构会随着功能迭代不断变化。手动改表结构？那是灾难。Alembic 让你用代码管理数据库版本。

### 初始化 Alembic

```bash
cd backend
pip install alembic asyncpg
alembic init alembic -t async
```

配置 `alembic.ini`：

```ini
# backend/alembic.ini
[alembic]
script_location = alembic
sqlalchemy.url = postgresql+asyncpg://agent:agent123@localhost:5432/agent_platform
```

配置 `alembic/env.py`：

```python
# backend/alembic/env.py
from app.core.database import Base
from app.models import user, session, message, agent  # 导入所有模型

target_metadata = Base.metadata
```

### 创建迁移

```bash
# 自动检测模型变化，生成迁移脚本
alembic revision --autogenerate -m "create user and session tables"
```

### 执行迁移

```bash
# 应用迁移到最新版本
alembic upgrade head

# 回滚一个版本
alembic downgrade -1

# 查看当前版本
alembic current
```

### 迁移最佳实践

1. **每次改模型都生成迁移**：不要手动改数据库
2. **检查自动生成的脚本**：Alembic 不是万能的，有时需要手动修改
3. **迁移脚本要可回滚**：`upgrade` 和 `downgrade` 都要写
4. **不要删迁移历史**：除非你知道自己在做什么

## 数据库设计原则

### 1. 主键用 UUID

```python
# 好：UUID 作为主键
id: Mapped[str] = mapped_column(
    String(36), primary_key=True, default=lambda: str(uuid.uuid4())
)

# 不好：自增 ID
# id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
```

为什么用 UUID？

- 分布式系统中不会冲突
- 不暴露业务信息（自增 ID 能猜出用户数量）
- 前后端可以直接用，不需要额外映射

### 2. 时间字段带时区

```python
# 好：带时区
created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), server_default=func.now()
)

# 不好：不带时区
# created_at: Mapped[datetime] = mapped_column(DateTime)
```

### 3. 软删除优于硬删除

```python
class SoftDeleteMixin:
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

### 4. JSON 字段存灵活配置

```python
# Agent 的工具配置、Skill 的参数定义等结构不固定的数据
tools: Mapped[list | None] = mapped_column(JSON, nullable=True)
config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
```

## 练习

### 练习 1：完善数据模型

基于上面的模型定义，补充以下模型：

1. `KnowledgeBase`：知识库（名称、描述、文档数量、索引状态）
2. `Document`：文档（所属知识库、文件名、文件类型、切分数量、索引状态）
3. `Skill`：技能（名称、类型、配置 JSON、是否启用）

### 练习 2：Alembic 迁移

1. 创建所有模型的迁移脚本
2. 执行迁移，验证表结构
3. 修改一个模型（加字段），生成新迁移
4. 回滚到第一个版本，再升级回来

### 练习 3：CRUD 操作

为 `ChatSession` 实现完整的 CRUD：

```python
class SessionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create(self, user_id: str, title: str) -> ChatSession:
        ...
    
    async def get(self, session_id: str) -> ChatSession | None:
        ...
    
    async def list_by_user(
        self, user_id: str, page: int = 1, size: int = 20
    ) -> tuple[list[ChatSession], int]:
        ...
    
    async def delete(self, session_id: str) -> bool:
        ...
```

---

## 参考答案

### 练习 1

**思路**：参考已有的 User、ChatSession、Message、Agent 模型定义，补充 KnowledgeBase、Document、Skill 三个模型，注意外键关系和索引设计。

**答案**：

```python
# backend/app/models/knowledge.py
from datetime import datetime
from sqlalchemy import String, DateTime, Text, JSON, Boolean, Integer, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import uuid

class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"
    
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    document_count: Mapped[int] = mapped_column(Integer, default=0)
    indexing_status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending / indexing / ready / error
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    
    documents: Mapped[list["Document"]] = relationship(back_populates="knowledge_base")


class Document(Base):
    __tablename__ = "documents"
    
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    knowledge_base_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), index=True
    )
    filename: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(50))  # pdf / txt / md / docx
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    indexing_status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending / indexing / ready / error
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    
    knowledge_base: Mapped["KnowledgeBase"] = relationship(back_populates="documents")
```

```python
# backend/app/models/skill.py
from datetime import datetime
from sqlalchemy import String, DateTime, Text, JSON, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
import uuid

class Skill(Base):
    __tablename__ = "skills"
    
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), index=True)
    type: Mapped[str] = mapped_column(String(50))  # tool / retriever / parser
    description: Mapped[str] = mapped_column(Text, default="")
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

**要点**：
- `Document` 通过 `knowledge_base_id` 外键关联 `KnowledgeBase`，`ondelete="CASCADE"` 确保删除知识库时自动删除关联文档
- `indexing_status` 用字符串枚举比用 Boolean 更灵活，能表达"正在索引中"等中间状态
- 常见错误：忘记在 `alembic/env.py` 中导入新模型，导致迁移脚本检测不到新表

### 练习 2

**思路**：依次执行 Alembic 迁移命令，验证自动生成的迁移脚本，练习回滚和重新升级。

**答案**：

```bash
# 1. 确保所有模型在 env.py 中被导入
# backend/alembic/env.py 中添加：
# from app.models import user, session, message, agent, knowledge, skill

# 2. 创建所有模型的迁移脚本
alembic revision --autogenerate -m "create all initial tables"

# 3. 执行迁移
alembic upgrade head

# 4. 验证表结构
docker compose exec postgres psql -U agent -d agent_platform -c "\dt"
# 应该看到: users, chat_sessions, messages, agents, knowledge_bases, documents, skills

# 5. 修改模型（加字段）
# 在 User 模型中添加: avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

# 6. 生成新迁移
alembic revision --autogenerate -m "add avatar_url to users"

# 7. 执行新迁移
alembic upgrade head

# 8. 回滚到第一个版本
alembic downgrade base

# 9. 再升级回来
alembic upgrade head
```

**要点**：
- `--autogenerate` 会对比模型定义和数据库实际表结构，自动生成差异迁移脚本
- 回滚后数据会丢失（如果迁移中有 DROP TABLE），生产环境慎用 `downgrade`
- 常见错误：修改模型后忘记生成迁移，直接手动改数据库，导致环境间表结构不一致

### 练习 3

**思路**：用 SQLAlchemy 2.0 的异步 API 实现 SessionRepository 的四个 CRUD 方法，注意 `select` 查询语法和分页的 `offset`/`limit` 用法。

**答案**：

```python
# backend/app/repositories/session_repo.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.session import ChatSession
import uuid

class SessionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create(self, user_id: str, title: str) -> ChatSession:
        session = ChatSession(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=title,
        )
        self.db.add(session)
        await self.db.flush()
        return session
    
    async def get(self, session_id: str) -> ChatSession | None:
        result = await self.db.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        return result.scalar_one_or_none()
    
    async def list_by_user(
        self, user_id: str, page: int = 1, size: int = 20
    ) -> tuple[list[ChatSession], int]:
        # 查询总数
        count_result = await self.db.execute(
            select(func.count()).where(ChatSession.user_id == user_id)
        )
        total = count_result.scalar()
        
        # 分页查询
        offset = (page - 1) * size
        result = await self.db.execute(
            select(ChatSession)
            .where(ChatSession.user_id == user_id)
            .order_by(ChatSession.updated_at.desc())
            .offset(offset)
            .limit(size)
        )
        sessions = list(result.scalars().all())
        
        return sessions, total
    
    async def delete(self, session_id: str) -> bool:
        session = await self.get(session_id)
        if session is None:
            return False
        await self.db.delete(session)
        await self.db.flush()
        return True
```

**要点**：
- `select()` 是 SQLAlchemy 2.0 的新语法，替代了老版的 `session.query()`
- `flush()` 将变更发送到数据库但不提交事务，`commit()` 由 `get_db` 依赖统一处理
- 常见错误：在 Repository 层直接 `commit()`，应该由上层（Service 或依赖注入）控制事务边界，保证多个操作在同一事务内

## 本节要点

- SQLAlchemy 2.0 的 Mapped 类型注解比老版更清晰
- 异步数据库连接是 AI 应用后端的标配
- Alembic 迁移让数据库版本可控、可回滚
- UUID 主键、时区时间、JSON 灵活字段是 AI 应用的常见设计

## 常见误区

| 错误 | 原因 | 解决 |
|------|------|------|
| `asyncpg` 安装失败 | 缺少 C 编译器（Windows） | 用 `pip install asyncpg --only-binary :all:` |
| 迁移脚本不检测新模型 | 忘记在 `env.py` 中导入模型 | 确保所有模型文件都被 import |
| `expire_on_commit` 问题 | 提交后访问属性触发额外查询 | 设置 `expire_on_commit=False` |
| 连接池耗尽 | 请求结束后连接未归还 | 用 `async with session` 确保归还 |

## 工程建议

- 迁移脚本要纳入版本控制，每次改模型必须生成迁移，手动改数据库是生产事故的温床
- 异步数据库操作要配合连接池使用，避免每个请求创建新连接导致资源耗尽
- 索引设计要在项目初期就规划好，后期加索引在大表上会锁表影响线上服务
- JSON 字段适合存储结构不固定的数据，但不要滥用——频繁查询的字段应该独立建列
- 关键业务操作要使用事务保证数据一致性，不要依赖"一般不会出错"的假设

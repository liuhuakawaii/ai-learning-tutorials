# 第2课：表设计 - raw、clean、metrics

> **课程定位**：设计分层的数据表结构，支持数据产品的各种查询需求
> **前置知识**：第1课（SQLite 到 PostgreSQL 迁移）
> **预计时长**：50 分钟

---

## 场景引入

你负责一个招聘数据产品，每天从多个平台采集上万条岗位数据。产品经理要求展示"各城市薪资趋势"、"热门技能排行"等 Dashboard。你面临一个矛盾：原始数据格式混乱、字段缺失，直接查询效率低且结果不准确；但如果每次都从原始数据实时清洗和聚合，页面加载要好几秒。你需要一套分层表结构，在数据质量和查询性能之间找到平衡。

---

## 学习目标

完成本课学习后，你将能够：

1. 理解分层表设计的原则
2. 设计 raw、clean、metrics 三层表结构
3. 合理选择主键和索引
4. 处理表之间的关系
5. 优化查询性能

---

## 一、分层表设计原则

### 1.1 三层架构

```
┌──────────────────────────────────────────────────────────────┐
│                    分层表架构                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Raw Layer（原始层）                                         │
│   ├── 存储原始数据，不做任何修改                             │
│   ├── 用于追溯和重新处理                                     │
│   └── 只增不改                                               │
│                                                              │
│   Clean Layer（清洗层）                                       │
│   ├── 存储清洗后的数据                                       │
│   ├── 格式统一、无效数据过滤                                 │
│   └── 支持更新                                               │
│                                                              │
│   Metrics Layer（指标层）                                     │
│   ├── 存储聚合后的指标数据                                   │
│   ├── 预计算，查询快                                         │
│   └── 按维度汇总                                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 设计原则

```
┌──────────────────────────────────────────────────────────────┐
│                    设计原则                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 职责分离                                                  │
│     └── 每层只做一件事，不混杂                               │
│                                                              │
│  2. 可追溯                                                    │
│     └── 保留批次号、来源、时间等元信息                       │
│                                                              │
│  3. 查询友好                                                  │
│     └── 根据查询需求设计索引                                 │
│                                                              │
│  4. 扩展性                                                    │
│     └── 预留扩展字段，支持新增指标                           │
│                                                              │
│  5. 性能优先                                                  │
│     └── 高频查询走 metrics 层                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、Raw 表设计

### 2.1 设计要点

```
┌──────────────────────────────────────────────────────────────┐
│                    Raw 表设计要点                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  存储内容：                                                   │
│  ├── 原始数据（JSON 或原始字段）                             │
│  ├── 来源信息                                               │
│  ├── 采集时间                                               │
│  └── 批次号                                                 │
│                                                              │
│  设计特点：                                                   │
│  ├── 不做数据清洗                                           │
│  ├── 保留所有字段                                           │
│  ├── 只增不改（append-only）                                │
│  └── 用 JSON 存储灵活数据                                   │
│                                                              │
│  主键选择：                                                   │
│  ├── 自增 ID（推荐）                                        │
│  └── 业务唯一键 + 批次号                                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Raw 表示例

```sql
-- 原始数据表
CREATE TABLE raw_jobs (
    id              BIGSERIAL PRIMARY KEY,
    
    -- 原始数据（JSON 格式）
    raw_data        JSONB NOT NULL,
    
    -- 元数据
    source          VARCHAR(50) NOT NULL,     -- 数据来源
    source_url      VARCHAR(500),             -- 原始 URL
    crawl_time      TIMESTAMP NOT NULL,       -- 采集时间
    batch_id        VARCHAR(100) NOT NULL,    -- 批次号
    
    -- 系统字段
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_raw_jobs_source ON raw_jobs(source);
CREATE INDEX idx_raw_jobs_crawl_time ON raw_jobs(crawl_time);
CREATE INDEX idx_raw_jobs_batch_id ON raw_jobs(batch_id);
CREATE INDEX idx_raw_jobs_created_at ON raw_jobs(created_at);
```

### 2.3 JSONB 存储示例

```sql
-- 插入原始数据
INSERT INTO raw_jobs (raw_data, source, crawl_time, batch_id)
VALUES (
    '{
        "title": "高级前端工程师",
        "company": "某科技公司",
        "city": "北京",
        "salary": "20K-35K",
        "experience": "3-5年",
        "education": "本科",
        "skills": "React,TypeScript,Node.js",
        "url": "https://example.com/job/123"
    }',
    'jobs_api',
    NOW(),
    'batch_20240115_001'
);

-- 查询 JSON 字段
SELECT 
    raw_data->>'title' as title,
    raw_data->>'company' as company,
    raw_data->>'salary' as salary
FROM raw_jobs
WHERE raw_data->>'city' = '北京';
```

---

## 三、Clean 表设计

### 3.1 设计要点

```
┌──────────────────────────────────────────────────────────────┐
│                    Clean 表设计要点                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  存储内容：                                                   │
│  ├── 清洗后的结构化数据                                      │
│  ├── 标准化的字段                                           │
│  └── 计算的派生字段                                         │
│                                                              │
│  设计特点：                                                   │
│  ├── 字段类型明确                                           │
│  ├── 格式统一                                               │
│  ├── 支持更新（Upsert）                                     │
│  └── 保留来源追溯信息                                       │
│                                                              │
│  主键选择：                                                   │
│  └── 业务唯一键（如 job_id）                                │
│                                                              │
│  索引设计：                                                   │
│  ├── 主键索引                                               │
│  ├── 常用查询字段索引                                       │
│  └── 组合索引                                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Clean 表示例

```sql
-- 清洗后的数据表
CREATE TABLE clean_jobs (
    -- 主键
    job_id          VARCHAR(50) PRIMARY KEY,
    
    -- 基本信息
    title           VARCHAR(200) NOT NULL,
    company         VARCHAR(200) NOT NULL,
    city            VARCHAR(50) NOT NULL,
    district        VARCHAR(50),
    
    -- 薪资信息（统一为元/月）
    salary_min      DECIMAL(10,2),
    salary_max      DECIMAL(10,2),
    salary_avg      DECIMAL(10,2),
    
    -- 要求信息
    experience      VARCHAR(50),
    education       VARCHAR(20),
    skills          TEXT,
    description     TEXT,
    
    -- 来源信息
    source          VARCHAR(50) NOT NULL,
    source_url      VARCHAR(500),
    publish_date    DATE,
    
    -- 追溯信息
    crawl_time      TIMESTAMP NOT NULL,
    batch_id        VARCHAR(100) NOT NULL,
    raw_id          BIGINT REFERENCES raw_jobs(id),
    
    -- 系统字段
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_clean_jobs_city ON clean_jobs(city);
CREATE INDEX idx_clean_jobs_publish_date ON clean_jobs(publish_date);
CREATE INDEX idx_clean_jobs_source ON clean_jobs(source);
CREATE INDEX idx_clean_jobs_salary ON clean_jobs(salary_avg);
CREATE INDEX idx_clean_jobs_experience ON clean_jobs(experience);

-- 组合索引
CREATE INDEX idx_clean_jobs_city_date ON clean_jobs(city, publish_date);
CREATE INDEX idx_clean_jobs_city_salary ON clean_jobs(city, salary_avg);
```

### 3.3 Upsert 操作

```sql
-- 插入或更新（幂等操作）
INSERT INTO clean_jobs (
    job_id, title, company, city, salary_min, salary_max, salary_avg,
    experience, education, skills, source, source_url, publish_date,
    crawl_time, batch_id
) VALUES (
    :job_id, :title, :company, :city, :salary_min, :salary_max, :salary_avg,
    :experience, :education, :skills, :source, :source_url, :publish_date,
    :crawl_time, :batch_id
)
ON CONFLICT (job_id)
DO UPDATE SET
    title = EXCLUDED.title,
    company = EXCLUDED.company,
    city = EXCLUDED.city,
    salary_min = EXCLUDED.salary_min,
    salary_max = EXCLUDED.salary_max,
    salary_avg = EXCLUDED.salary_avg,
    experience = EXCLUDED.experience,
    education = EXCLUDED.education,
    skills = EXCLUDED.skills,
    updated_at = NOW();
```

---

## 四、Metrics 表设计

### 4.1 设计要点

```
┌──────────────────────────────────────────────────────────────┐
│                    Metrics 表设计要点                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  存储内容：                                                   │
│  ├── 聚合后的指标数据                                        │
│  ├── 按维度汇总                                             │
│  └── 预计算的统计数据                                       │
│                                                              │
│  设计特点：                                                   │
│  ├── 按时间粒度聚合（天、周、月）                           │
│  ├── 按业务维度分组                                         │
│  ├── 预计算常用指标                                         │
│  └── 支持快速查询                                           │
│                                                              │
│  主键选择：                                                   │
│  └── 维度组合 + 时间粒度                                    │
│                                                              │
│  索引设计：                                                   │
│  ├── 维度字段索引                                           │
│  ├── 时间字段索引                                           │
│  └── 组合索引                                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Metrics 表示例

```sql
-- 按城市按天聚合
CREATE TABLE metrics_city_daily (
    id              BIGSERIAL PRIMARY KEY,
    
    -- 维度
    city            VARCHAR(50) NOT NULL,
    stat_date       DATE NOT NULL,
    
    -- 指标
    job_count       INTEGER NOT NULL DEFAULT 0,
    avg_salary      DECIMAL(10,2),
    max_salary      DECIMAL(10,2),
    min_salary      DECIMAL(10,2),
    median_salary   DECIMAL(10,2),
    
    -- 唯一约束
    UNIQUE(city, stat_date)
);

-- 索引
CREATE INDEX idx_metrics_city_daily_date ON metrics_city_daily(stat_date);
CREATE INDEX idx_metrics_city_daily_city ON metrics_city_daily(city);

-- 按技能按月聚合
CREATE TABLE metrics_skill_monthly (
    id              BIGSERIAL PRIMARY KEY,
    
    -- 维度
    skill           VARCHAR(50) NOT NULL,
    stat_month      VARCHAR(7) NOT NULL,  -- 格式: 2024-01
    
    -- 指标
    demand_count    INTEGER NOT NULL DEFAULT 0,
    avg_salary      DECIMAL(10,2),
    
    -- 唯一约束
    UNIQUE(skill, stat_month)
);

-- 索引
CREATE INDEX idx_metrics_skill_monthly_month ON metrics_skill_monthly(stat_month);
```

### 4.3 聚合查询示例

```sql
-- 从 clean 表聚合到 metrics 表
INSERT INTO metrics_city_daily (city, stat_date, job_count, avg_salary, max_salary, min_salary)
SELECT 
    city,
    publish_date as stat_date,
    COUNT(*) as job_count,
    AVG(salary_avg) as avg_salary,
    MAX(salary_avg) as max_salary,
    MIN(salary_avg) as min_salary
FROM clean_jobs
WHERE publish_date = CURRENT_DATE
GROUP BY city, publish_date
ON CONFLICT (city, stat_date)
DO UPDATE SET
    job_count = EXCLUDED.job_count,
    avg_salary = EXCLUDED.avg_salary,
    max_salary = EXCLUDED.max_salary,
    min_salary = EXCLUDED.min_salary;
```

---

## 五、主键和索引设计

### 5.1 主键选择

```
┌──────────────────────────────────────────────────────────────┐
│                    主键选择                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  自增 ID（BIGSERIAL）                                         │
│  ├── 优点：简单、性能好、不重复                              │
│  ├── 缺点：无业务含义                                        │
│  └── 适用：raw 表、日志表                                    │
│                                                              │
│  业务唯一键                                                   │
│  ├── 优点：有业务含义、天然唯一                              │
│  ├── 缺点：可能变长、性能略差                                │
│  └── 适用：clean 表                                          │
│                                                              │
│  组合主键                                                     │
│  ├── 优点：精确标识                                          │
│  ├── 缺点：复杂、外键引用麻烦                                │
│  └── 适用：metrics 表（维度+时间）                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 索引设计

```sql
-- 单列索引
CREATE INDEX idx_clean_jobs_city ON clean_jobs(city);
CREATE INDEX idx_clean_jobs_salary ON clean_jobs(salary_avg);

-- 组合索引（注意顺序）
CREATE INDEX idx_clean_jobs_city_salary ON clean_jobs(city, salary_avg);

-- 部分索引（条件索引）
CREATE INDEX idx_clean_jobs_active ON clean_jobs(city) 
WHERE publish_date >= CURRENT_DATE - INTERVAL '30 days';

-- 表达式索引
CREATE INDEX idx_clean_jobs_lower_city ON clean_jobs(LOWER(city));
```

### 5.3 索引优化原则

```
┌──────────────────────────────────────────────────────────────┐
│                    索引优化原则                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 只在常用查询字段上建索引                                 │
│                                                              │
│  2. 组合索引遵循最左前缀原则                                 │
│     └── (city, date) 可以支持 city 查询                      │
│     └── 但不能只支持 date 查询                               │
│                                                              │
│  3. 高选择性的列放在前面                                     │
│     └── city 比 gender 选择性更高                            │
│                                                              │
│  4. 避免过多索引                                             │
│     └── 索引会降低写入性能                                   │
│                                                              │
│  5. 定期分析索引使用情况                                     │
│     └── 删除未使用的索引                                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 六、表关系设计

### 6.1 表关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                    表关系图                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   raw_jobs                                                      │
│   ├── id (PK)                                                   │
│   ├── raw_data (JSONB)                                          │
│   ├── batch_id                                                  │
│   └── ...                                                       │
│         │                                                       │
│         │ 1:N                                                   │
│         ▼                                                       │
│   clean_jobs                                                    │
│   ├── job_id (PK)                                               │
│   ├── raw_id (FK) → raw_jobs.id                                 │
│   ├── batch_id                                                  │
│   └── ...                                                       │
│         │                                                       │
│         │ 1:N                                                   │
│         ▼                                                       │
│   metrics_city_daily                                            │
│   ├── city + stat_date (UK)                                     │
│   └── ...                                                       │
│                                                                 │
│   metrics_skill_monthly                                         │
│   ├── skill + stat_month (UK)                                   │
│   └── ...                                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 外键设计

```sql
-- clean_jobs 引用 raw_jobs
ALTER TABLE clean_jobs 
ADD CONSTRAINT fk_clean_raw 
FOREIGN KEY (raw_id) REFERENCES raw_jobs(id);

-- 批次日志表
CREATE TABLE etl_batch_log (
    batch_id        VARCHAR(100) PRIMARY KEY,
    source          VARCHAR(50) NOT NULL,
    status          VARCHAR(20) NOT NULL,
    start_time      TIMESTAMP NOT NULL,
    end_time        TIMESTAMP,
    total_records   INTEGER,
    success_records INTEGER,
    failed_records  INTEGER
);

-- clean_jobs 引用批次日志
ALTER TABLE clean_jobs
ADD CONSTRAINT fk_clean_batch
FOREIGN KEY (batch_id) REFERENCES etl_batch_log(batch_id);
```

---

## 七、查询优化

### 7.1 查询示例

```sql
-- 查询某城市的岗位统计（走 metrics 表）
SELECT 
    city,
    stat_date,
    job_count,
    avg_salary
FROM metrics_city_daily
WHERE city = '北京'
  AND stat_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY stat_date DESC;

-- 查询热门技能（走 metrics 表）
SELECT 
    skill,
    demand_count,
    avg_salary
FROM metrics_skill_monthly
WHERE stat_month = '2024-01'
ORDER BY demand_count DESC
LIMIT 10;

-- 查询某城市的高薪岗位（走 clean 表 + 索引）
SELECT 
    job_id,
    title,
    company,
    salary_avg
FROM clean_jobs
WHERE city = '北京'
  AND salary_avg > 30000
ORDER BY salary_avg DESC
LIMIT 20;
```

### 7.2 查询性能对比

```
┌──────────────────────────────────────────────────────────────┐
│                    查询性能对比                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  场景：查询北京近30天每天的岗位数量                           │
│                                                              │
│  方式 1：从 clean_jobs 实时聚合                               │
│  ├── 查询：SELECT date, COUNT(*) FROM clean_jobs             │
│  │        WHERE city='北京' GROUP BY date                    │
│  ├── 耗时：~500ms（数据量大时更慢）                          │
│  └── 适用：临时查询、数据量小                                │
│                                                              │
│  方式 2：从 metrics_city_daily 查询                          │
│  ├── 查询：SELECT * FROM metrics_city_daily                  │
│  │        WHERE city='北京'                                  │
│  ├── 耗时：~10ms                                             │
│  └── 适用：Dashboard 展示、高频查询                          │
│                                                              │
│  结论：Dashboard 查询走 metrics 表，实时分析走 clean 表       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 常见误区

- **把所有数据都放在一张表里**：原始数据、清洗数据、聚合数据混在一起，导致查询慢、维护难、数据质量无法保证
- **Raw 表不做任何保留就直接覆盖更新**：Raw 表的核心价值是可追溯，应该只增不改（append-only），便于出问题时重新处理
- **Metrics 表的聚合粒度越细越好**：粒度过细会导致表膨胀、查询变慢，应根据实际查询需求选择合适的聚合粒度（天/周/月）
- **在 Clean 表上直接做复杂聚合查询给 Dashboard 用**：Dashboard 高频查询应该走 Metrics 表，Clean 表用于明细查询和数据追溯

---

## 工程建议

- 为每层表设计明确的职责边界：Raw 只存原始数据，Clean 存结构化清洗数据，Metrics 存预聚合指标，避免职责混杂
- 在 Raw 表中保留 JSONB 字段存储原始数据，既保留了灵活性，又能通过 GIN 索引支持高效查询
- Metrics 表使用 UPSERT 操作，确保重跑聚合任务时数据幂等，不会产生重复记录
- 定期清理过期的 Raw 数据（如保留 90 天），控制表体积，同时在批次日志中保留元信息用于追溯

---

## 动手练习

### 练习一：设计表结构

为"商品价格监控"设计三层表结构：

```
1. raw_products：原始商品数据
2. clean_products：清洗后的商品数据
3. metrics_price_daily：按天聚合的价格指标

每层至少包含 8 个字段。
```

### 练习二：设计索引

为 clean_jobs 表设计索引，支持以下查询：

```
1. 按城市查询
2. 按薪资范围查询
3. 按城市+薪资组合查询
4. 按发布时间范围查询
```

### 练习三：编写聚合 SQL

编写 SQL 从 clean_jobs 聚合到 metrics_city_daily：

```sql
-- 要求：
-- 1. 按城市和日期分组
-- 2. 计算岗位数量、平均薪资、最高薪资、最低薪资
-- 3. 使用 Upsert 避免重复
```

---

## 小结

本课的核心要点：

1. **三层架构**：raw（原始）→ clean（清洗）→ metrics（聚合）
2. **Raw 表**：存储原始数据，JSON 格式，只增不改
3. **Clean 表**：结构化数据，业务主键，支持更新
4. **Metrics 表**：聚合数据，维度+时间主键，查询快
5. **索引设计**：根据查询需求设计，遵循最左前缀原则

---

## 下一课预告

下一课我们将学习**索引、分页和查询性能**，深入优化数据库查询，支持大数据量下的高效检索。

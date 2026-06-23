# 第1课：Dashboard 信息架构

> **课程定位**：设计 Dashboard 的整体结构和信息层次
> **前置知识**：第三阶段全部课程
> **预计时长**：45 分钟

---

## 从一堆图表开始

产品经理丢过来一句话："老板想看个 Dashboard，一眼就能看到整体情况。"你打开竞品一看，满屏的图表堆在一起——指标卡、折线图、饼图、表格混杂排列，看了五分钟还是不知道该先看什么。

问题不在图表本身。那些竞品里每个图表都有数据、都做了美化，但合在一起就成了信息垃圾场。原因在于没有人想清楚三件事：

1. 用户打开页面的第一秒应该看到什么
2. 哪些信息放首页、哪些放二级页面
3. 用户看完数字之后要做什么动作

这三个问题就是信息架构要解决的。图表只是骨架上的肉，骨架搭错了，肉再多也是一团。

---

## 用户先于图表

在画任何线框图之前，先回答一个问题：谁在用这个 Dashboard？

同一个招聘数据平台，不同角色关心的事情完全不同：

**管理者**早上打开页面，想用 10 秒知道"今天数据有没有问题"。他需要核心指标的数字和异常标记，不是可以下钻的交互式图表。

**分析师**要做深度分析，需要筛选、对比、下钻。他愿意花 5 分钟在一个页面上，但前提是页面提供了足够的交互能力。

**运营人员**关心系统是否健康——任务有没有跑成功、数据有没有更新、有没有异常告警。他需要看任务状态和日志，不是业务趋势。

这三种人打开同一个 URL，期望看到的东西完全不一样。如果你试图用一个页面满足所有人，结果就是谁都不满意。

---

## 信息分层：四页结构

大多数数据产品 Dashboard 可以按信息密度分成四层：

**总览页（Overview）**——回答"现在怎么样"。放 4-6 个指标卡、1-2 个趋势图、1-2 个排名榜。用户扫一眼就知道整体状况。阅读时间 10 秒。

**分析页（Analysis）**——回答"为什么这样"。提供筛选器、多维度对比图表、详情表格。用户可以按时间、地区、类别等维度切片分析。阅读时间 1-5 分钟。

**趋势页（Trends）**——回答"在变好还是变差"。时间序列图表、同比环比对比。关注变化率而不是绝对值。

**监控页（Monitor）**——回答"系统正常吗"。任务状态、数据质量指标、告警列表。面向运维，不面向业务。时效性要求高。

分层的核心原则是：每层只回答一个问题。如果一个页面同时试图回答"现在怎么样"和"为什么这样"，用户就会在两种思维模式之间切换，认知负担急剧上升。

---

## 布局：让眼睛知道往哪看

用户打开页面后，视线会自然地按 F 型路径移动：先从左上角往右扫，再往下移，再往右扫一段。左上角是最高价值的位置。

总览页的经典布局：

```
┌─────────────────────────────────────────────┐
│  指标卡1   指标卡2   指标卡3   指标卡4      │  ← 核心数字
├─────────────────────────────┬───────────────┤
│       趋势图（8列）          │  排名榜（4列） │  ← 趋势和排名
├─────────────────────────────┴───────────────┤
│       分类分布（6列）    最近更新（6列）      │  ← 补充信息
└─────────────────────────────────────────────┘
```

用 Tailwind 栅格实现：

```tsx
<div className="grid grid-cols-12 gap-4 p-6">
  <div className="col-span-3">
    <MetricCard title="岗位总数" value="1,234" change="+5%" />
  </div>
  <div className="col-span-3">
    <MetricCard title="平均薪资" value="27,500" change="+2%" />
  </div>
  <div className="col-span-3">
    <MetricCard title="城市覆盖" value="32" change="+3" />
  </div>
  <div className="col-span-3">
    <MetricCard title="今日新增" value="156" change="-2%" />
  </div>

  <div className="col-span-8">
    <LineChart title="岗位趋势" data={trendData} />
  </div>
  <div className="col-span-4">
    <RankingList title="城市排名" data={cityRanking} />
  </div>
</div>
```

指标卡控制在 4-6 个。超过 6 个，用户注意力分散，反而记不住任何一个。选哪 4 个？回到用户角色——管理者最关心的那个数字，放第一个。

响应式适配不能省。用 `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` 做断点适配，移动端单列，平板两列，桌面四列。

---

## 筛选联动：一个状态管所有

Dashboard 里通常有多个筛选器。用户改了任何一个，所有图表都应该同步更新。实现不好会导致三个问题：

- **状态分散**——每个图表各自维护筛选状态，有的更新了，有的没更新
- **URL 不同步**——用户筛选了半天想分享给同事，发过去的链接是默认状态
- **性能浪费**——每次筛选变化都触发所有图表重新请求

解决方案是把筛选状态提到顶层，通过 Context 下发：

```tsx
interface FilterState {
  dateRange: [string, string];
  department: string;
  source: string;
}

const FilterContext = createContext<{
  filters: FilterState;
  setFilters: (f: Partial<FilterState>) => void;
} | null>(null);

function FilterBar() {
  const { filters, setFilters } = useContext(FilterContext)!;
  return (
    <div className="flex gap-3 mb-4">
      <select value={filters.department} onChange={(e) => setFilters({ department: e.target.value })}>
        <option value="all">全部部门</option>
        <option value="技术">技术</option>
        <option value="产品">产品</option>
      </select>
      <select value={filters.source} onChange={(e) => setFilters({ source: e.target.value })}>
        <option value="all">全部来源</option>
        <option value="boss">Boss直聘</option>
        <option value="lagou">拉勾</option>
      </select>
    </div>
  );
}
```

URL 同步用 `useSearchParams` 把筛选状态序列化到 query string。搜索框加 300ms 防抖，下拉选择器不需要防抖。

---

## 下钻：从数字到行动

用户看到"异常岗位 18 个"之后，下一步是想知道"哪 18 个"。这就是下钻——从总览点击进入详情。

下钻路径：
```
总览页 → 点击指标卡 → 筛选后的列表页
                     ├── 该类别的详细数据
                     ├── 相关趋势
                     └── 可执行操作（导出、标记）
```

用户从总览点进来时带着上下文——点击的是哪个指标、什么时间范围。这些上下文应该自动传递到详情页，而不是让用户重新选择一遍。技术上通过 URL 参数传递：`/analysis?department=技术&highlight=anomaly`。

---

## 技术选型的判断

**图表库**：ECharts 功能强大但包体积大，Recharts 轻量且 React 集成好。标准图表用 Recharts，需要地图/热力图/桑基图选 ECharts。

**状态管理**：筛选状态用 React Context 足够，服务端数据用 React Query 管理。Context 管 UI 状态，React Query 管服务端状态。

**要不要 SSR？** Dashboard 通常是登录后访问，SEO 不是问题，CSR 就够了。如果需要分享公开链接给客户，SSR 可以提升首屏速度。

---

## 动手练习

### 练习一：设计信息架构

为"商品价格监控"设计 Dashboard 信息架构。目标用户是运营和采购人员，核心需求是快速了解价格异常、竞品动态和价格趋势。列出 3 个页面、每个页面 3-4 个核心组件、说明面向哪个角色。

### 练习二：实现筛选联动

```tsx
// 需求：两个筛选器（来源、部门），筛选变化时指标卡和排名表同步更新
// 用 Context 管理筛选状态，用 useMemo 缓存筛选结果
// 从这里开始写代码
```

### 练习三：设计下钻路径

为"价格总览"页面设计：点击"异常价格"指标卡后跳转到哪、详情页带哪些筛选条件、如何返回。

---

## 参考答案

### 练习一

```
1. 价格总览（Overview）——面向管理者，核心指标卡+趋势图+波动排名
2. 竞品分析（Analysis）——面向运营，筛选器+多平台对比表格+价格走势图
3. 价格预警（Alerts）——面向采购，预警规则+触发记录+异常商品列表
```

### 练习二

```tsx
import { createContext, useContext, useState, useMemo } from "react";

const mockJobs = [
  { id: 1, title: "前端工程师", salary: "20-30K", source: "boss", department: "技术" },
  { id: 2, title: "后端工程师", salary: "25-35K", source: "lagou", department: "技术" },
  { id: 3, title: "产品经理", salary: "18-25K", source: "zhilian", department: "产品" },
];

const FilterContext = createContext<any>(null);

function FilterBar() {
  const { filters, setFilters } = useContext(FilterContext);
  return (
    <div className="flex gap-3 mb-4">
      <select value={filters.source} onChange={(e) => setFilters({ source: e.target.value })}>
        <option value="all">全部来源</option>
        <option value="boss">Boss直聘</option>
        <option value="lagou">拉勾</option>
      </select>
      <select value={filters.department} onChange={(e) => setFilters({ department: e.target.value })}>
        <option value="all">全部部门</option>
        <option value="技术">技术</option>
        <option value="产品">产品</option>
      </select>
    </div>
  );
}

export default function Dashboard() {
  const [filters, setFilters] = useState({ source: "all", department: "all" });
  const filteredData = useMemo(() => {
    return mockJobs.filter((j) => {
      if (filters.source !== "all" && j.source !== filters.source) return false;
      if (filters.department !== "all" && j.department !== filters.department) return false;
      return true;
    });
  }, [filters]);

  return (
    <FilterContext.Provider value={{ filters, setFilters: (p: any) => setFilters((s) => ({ ...s, ...p })) }}>
      <div className="p-6">
        <FilterBar />
        <div>筛选结果: {filteredData.length} 条</div>
      </div>
    </FilterContext.Provider>
  );
}
```

### 练习三

```
1. 点击"异常价格" → /alerts?status=unhandled，自动筛选未处理的异常商品
2. 自动带上：当前时间范围、异常类型标记（偏离均值 > 20%）、排序方式
3. 面包屑导航：总览 > 异常商品，点击返回时筛选状态保持不变
```

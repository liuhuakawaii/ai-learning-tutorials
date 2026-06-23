# 03 - Dashboard 构建器

> 让用户像搭积木一样构建数据看板——拖拽组件、绑定数据、一键发布。

## 课程信息

| 项目 | 内容 |
|------|------|
| 所属阶段 | Part 4: 企业级数据产品 |
| 前置课程 | 02 - 数据探索 Agent |
| 预计时长 | 2 小时 |
| 难度等级 | ⭐⭐⭐⭐ |

---

## 场景引入

某电商公司的运营总监每天早上要打开五六个报表，分别查看 GMV 趋势、转化漏斗、区域热力图、库存周转率和客服工单数。她一直想要一个"一屏看全貌"的 Dashboard，把这五个关键视图放到一起。

她找到数据团队，得到的答复是："排期两周。"因为每个图表的布局、数据源、筛选器联动都需要前端开发。两周后拿到的版本，她想调整一下图表顺序和颜色，又需要再排一周。

这个场景暴露了传统 Dashboard 开发的核心痛点：**构建成本高、调整周期长、业务人员无法自助**。Dashboard 构建器要解决的就是这个问题——让不懂代码的业务人员也能通过拖拽方式，自主搭建数据看板。

这和上节课的对话式 BI 是互补的两种产品形态。对话式 BI 适合"临时性探索"——我想知道某个问题的答案；Dashboard 构建器适合"持续性监控"——我要每天看这些指标。两者共同构成了企业数据产品的基础体验。

## 学习目标

完成本课学习后，你将能够：

1. 理解 Dashboard 构建器的系统架构和核心模块
2. 设计组件注册与渲染机制，支持可扩展的图表类型
3. 实现基于栅格系统的布局引擎，处理组件的放置、调整和碰撞检测
4. 构建数据绑定与筛选器联动机制
5. 实现 AI 辅助的布局推荐功能
6. 完成一个可运行的 Dashboard 构建器原型

## 一、Dashboard 构建器的系统架构

Dashboard 构建器本质上是一个**低代码可视化平台**。它的核心挑战不是"画图表"——ECharts、D3.js 已经做得很成熟了——而是如何让非技术用户能够自主地组装和配置图表。

### 1.1 核心模块

```
┌──────────────────────────────────────────────────────────────┐
│                  Dashboard 构建器架构                          │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │  组件面板   │  │  画布区域   │  │  属性面板              │ │
│  │            │  │            │  │                        │ │
│  │  折线图    │  │  ┌──────┐  │  │  数据绑定              │ │
│  │  柱状图    │  │  │ 组件A │  │  │  样式配置              │ │
│  │  饼图     │  │  ├──────┤  │  │  筛选器设置             │ │
│  │  表格     │  │  │ 组件B │  │  │  交互行为              │ │
│  │  指标卡    │  │  └──────┘  │  │                        │ │
│  │  筛选器    │  │            │  │                        │ │
│  └────────────┘  └────────────┘  └────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                    核心引擎层                             ││
│  │                                                          ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐││
│  │  │ 布局引擎  │  │ 渲染引擎  │  │ 数据引擎  │  │ 事件引擎 │││
│  │  │          │  │          │  │          │  │         │││
│  │  │ 栅格计算  │  │ 组件映射  │  │ 查询生成  │  │ 筛选联动 │││
│  │  │ 碰撞检测  │  │ 生命周期  │  │ 缓存管理  │  │ 事件冒泡 │││
│  │  │ 响应式   │  │ 懒加载   │  │ 增量刷新  │  │ 回调管理 │││
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                    持久化层                               ││
│  │  Dashboard JSON Schema → 保存 / 加载 / 版本管理           ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Dashboard 的数据模型

一个 Dashboard 的完整状态可以用一个 JSON 来描述。这个 JSON 是构建器的核心数据模型：

```json
{
  "dashboard_id": "dash_001",
  "title": "电商运营日报",
  "layout": {
    "type": "grid",
    "columns": 12,
    "row_height": 80,
    "gap": 16
  },
  "filters": [
    {
      "filter_id": "date_range",
      "type": "date_range",
      "default": ["2024-01-01", "2024-03-31"],
      "bind_to": ["chart_gmv", "chart_orders"]
    }
  ],
  "components": [
    {
      "component_id": "chart_gmv",
      "type": "line_chart",
      "position": {"x": 0, "y": 0, "w": 8, "h": 4},
      "data_source": {
        "type": "sql",
        "query": "SELECT date, SUM(amount) as gmv FROM orders WHERE date BETWEEN {{date_range[0]}} AND {{date_range[1]}} GROUP BY date"
      },
      "options": {
        "title": "GMV 趋势",
        "x_axis": "date",
        "y_axis": "gmv",
        "smooth": true
      }
    }
  ]
}
```

这个 JSON 既是前端渲染的输入，也是持久化存储的格式。设计一个好的 JSON Schema 是 Dashboard 构建器的第一步，因为它决定了系统的表达能力和扩展性。

## 二、组件注册与渲染机制

Dashboard 的可视化内容由各种"组件"组成——折线图、柱状图、表格、指标卡、筛选器等等。构建器需要一个**组件注册机制**，让新组件可以被"插拔式"地添加到系统中。

### 2.1 组件的抽象模型

每个组件需要回答三个问题：**我是谁**（类型标识）、**我需要什么数据**（数据配置）、**我怎么展示**（渲染逻辑）。

```python
from dataclasses import dataclass, field
from typing import Any, Callable
from abc import ABC, abstractmethod


@dataclass
class ComponentMeta:
    """组件元信息"""
    type_id: str              # 唯一标识，如 "line_chart"
    display_name: str         # 显示名称，如 "折线图"
    category: str             # 分类，如 "chart" / "table" / "filter" / "indicator"
    icon: str = "📊"          # 面板图标
    default_size: dict = field(default_factory=lambda: {"w": 6, "h": 4})
    min_size: dict = field(default_factory=lambda: {"w": 3, "h": 2})
    max_size: dict = field(default_factory=lambda: {"w": 12, "h": 8})
    configurable_fields: list[str] = field(default_factory=list)


class BaseComponent(ABC):
    """组件基类"""

    @abstractmethod
    def meta(self) -> ComponentMeta:
        """返回组件的元信息"""
        ...

    @abstractmethod
    def validate_config(self, config: dict) -> tuple[bool, str]:
        """校验组件配置是否合法"""
        ...

    @abstractmethod
    def generate_query(self, config: dict, filters: dict) -> str:
        """根据配置和筛选器生成数据查询"""
        ...

    @abstractmethod
    def render(self, data: Any, config: dict) -> str:
        """渲染组件，返回 HTML 字符串"""
        ...
```

### 2.2 组件注册表

组件注册表是系统的"组件字典"。前端的组件面板从这里读取可用组件列表，渲染引擎从这里查找组件的渲染逻辑。

```python
class ComponentRegistry:
    """组件注册表"""

    def __init__(self):
        self._components: dict[str, BaseComponent] = {}

    def register(self, component: BaseComponent) -> None:
        meta = component.meta()
        self._components[meta.type_id] = component

    def get(self, type_id: str) -> BaseComponent | None:
        return self._components.get(type_id)

    def list_all(self) -> list[ComponentMeta]:
        return [comp.meta() for comp in self._components.values()]

    def list_by_category(self, category: str) -> list[ComponentMeta]:
        return [comp.meta() for comp in self._components.values() if comp.meta().category == category]
```

这种注册机制的好处是**开闭原则**——添加新组件类型不需要修改现有代码，只需要实现 `BaseComponent` 并注册到注册表即可。

## 三、布局引擎

布局引擎是 Dashboard 构建器中最复杂的模块。它需要处理组件的放置、大小调整、碰撞检测和响应式适配。

### 3.1 栅格系统

最常见的布局方案是**12 列栅格系统**（和 Bootstrap 一样）。每个组件的位置用 `{x, y, w, h}` 四个值描述：

```
栅格系统 (12列 × N行)

列:  0  1  2  3  4  5  6  7  8  9  10 11
行0: ┌──────────────────────┐┌──────────┐
     │      组件A            ││  组件B   │
     │      (x=0,y=0,w=8)   ││(x=8,w=4)│
行1: │                      ││          │
     │                      │└──────────┘
行2: ├──────────────────────┘┌──────────┐
     │      组件C            ││  组件D   │
     │      (x=0,y=2,w=8)   ││(x=8,w=4)│
行3: │                      ││          │
     └──────────────────────┘└──────────┘
```

### 3.2 碰撞检测

当用户拖拽一个组件到新位置时，需要检查它是否会和已有组件重叠。碰撞检测的核心逻辑是：两个矩形不重叠的条件是它们在 X 轴或 Y 轴上的投影不重叠。

```python
@dataclass
class Position:
    x: int
    y: int
    w: int
    h: int

    @property
    def x2(self) -> int:
        return self.x + self.w

    @property
    def y2(self) -> int:
        return self.y + self.h


def check_collision(a: Position, b: Position) -> bool:
    """检查两个组件是否重叠"""
    if a.x2 <= b.x or b.x2 <= a.x:
        return False  # X 轴不重叠
    if a.y2 <= b.y or b.y2 <= a.y:
        return False  # Y 轴不重叠
    return True  # 两个轴都重叠，说明碰撞


def find_collisions(positions: dict[str, Position], target_id: str, new_pos: Position) -> list[str]:
    """找出与目标组件新位置碰撞的所有组件"""
    collisions = []
    for comp_id, pos in positions.items():
        if comp_id == target_id:
            continue
        if check_collision(new_pos, pos):
            collisions.append(comp_id)
    return collisions
```

### 3.3 自动避让

当检测到碰撞时，构建器需要自动调整其他组件的位置来腾出空间。最常用的策略是**向下推挤**：把被碰撞的组件及其下方的所有组件一起向下移动。

```python
def auto_shove(positions: dict[str, Position], moved_id: str, new_pos: Position) -> dict[str, Position]:
    """自动避让：将被碰撞的组件向下推挤"""
    result = {cid: Position(p.x, p.y, p.w, p.h) for cid, p in positions.items()}
    result[moved_id] = new_pos

    changed = True
    max_iterations = 50
    iteration = 0

    while changed and iteration < max_iterations:
        changed = False
        iteration += 1
        for comp_id in list(result.keys()):
            if comp_id == moved_id:
                continue
            collisions = find_collisions(result, comp_id, result[comp_id])
            if collisions:
                max_y2 = max(result[c].y2 for c in collisions)
                result[comp_id] = Position(
                    result[comp_id].x, max_y2, result[comp_id].w, result[comp_id].h
                )
                changed = True

    return result
```

## 四、数据绑定与筛选器联动

Dashboard 的核心价值在于多个图表之间的**联动**。用户在筛选器中选择一个时间范围，所有图表都应该同时更新。这需要一套数据绑定和事件传播机制。

### 4.1 数据绑定模型

每个组件的数据源通过模板语法绑定到筛选器：

```python
import re


class DataBinder:
    """数据绑定引擎：将筛选器值注入查询模板"""

    TEMPLATE_PATTERN = re.compile(r"\{\{(\w+)(?:\[([^\]]+)\])?\}\}")

    def bind_query(self, query_template: str, filters: dict[str, Any]) -> str:
        """将筛选器值注入查询模板

        示例:
          template: "SELECT * FROM orders WHERE date BETWEEN '{{date_range[0]}}' AND '{{date_range[1]}}'"
          filters: {"date_range": ["2024-01-01", "2024-03-31"]}
          result: "SELECT * FROM orders WHERE date BETWEEN '2024-01-01' AND '2024-03-31'"
        """
        def replace_match(match: re.Match) -> str:
            filter_name = match.group(1)
            index_expr = match.group(2)

            if filter_name not in filters:
                return match.group(0)

            value = filters[filter_name]

            if index_expr is not None:
                if isinstance(value, (list, tuple)):
                    try:
                        idx = int(index_expr)
                        return str(value[idx])
                    except (IndexError, ValueError):
                        return match.group(0)
                return match.group(0)

            if isinstance(value, (list, tuple)):
                return ", ".join(f"'{v}'" for v in value)
            return str(value)

        return self.TEMPLATE_PATTERN.sub(replace_match, query_template)
```

### 4.2 筛选器联动机制

当用户修改一个筛选器的值时，系统需要找出所有依赖这个筛选器的组件，并触发它们的数据刷新。

```python
class FilterManager:
    """筛选器管理器：管理筛选器状态和联动刷新"""

    def __init__(self):
        self.filters: dict[str, dict] = {}
        self.bindings: dict[str, list[str]] = {}  # filter_id → [component_id]
        self.subscribers: dict[str, list[callable]] = {}  # filter_id → [callback]

    def register_filter(self, filter_id: str, filter_type: str, default: Any) -> None:
        self.filters[filter_id] = {
            "type": filter_type,
            "value": default,
            "default": default,
        }

    def bind(self, filter_id: str, component_id: str) -> None:
        if filter_id not in self.bindings:
            self.bindings[filter_id] = []
        if component_id not in self.bindings[filter_id]:
            self.bindings[filter_id].append(component_id)

    def subscribe(self, filter_id: str, callback: callable) -> None:
        if filter_id not in self.subscribers:
            self.subscribers[filter_id] = []
        self.subscribers[filter_id].append(callback)

    def update_value(self, filter_id: str, new_value: Any) -> list[str]:
        """更新筛选器值，返回受影响的组件列表"""
        if filter_id not in self.filters:
            return []

        self.filters[filter_id]["value"] = new_value
        affected = self.bindings.get(filter_id, [])

        for callback in self.subscribers.get(filter_id, []):
            callback(filter_id, new_value, affected)

        return affected

    def get_value(self, filter_id: str) -> Any:
        if filter_id in self.filters:
            return self.filters[filter_id]["value"]
        return None

    def get_all_values(self) -> dict[str, Any]:
        return {fid: f["value"] for fid, f in self.filters.items()}

    def reset(self, filter_id: str | None = None) -> None:
        if filter_id:
            if filter_id in self.filters:
                self.filters[filter_id]["value"] = self.filters[filter_id]["default"]
        else:
            for fid in self.filters:
                self.filters[fid]["value"] = self.filters[fid]["default"]
```

## 五、AI 辅助布局推荐

传统 Dashboard 构建器的问题是：用户面对一块空白画布和几十种组件，不知道从何下手。AI 辅助布局推荐可以解决这个"冷启动"问题。

### 5.1 推荐逻辑

用户描述自己的需求（比如"我想看电商运营的日报"），AI 根据需求推荐一组组件和布局：

```python
class LayoutRecommender:
    """AI 辅助布局推荐器"""

    TEMPLATES = {
        "电商运营": {
            "description": "电商运营日报看板",
            "components": [
                {"type": "indicator_card", "position": {"x": 0, "y": 0, "w": 3, "h": 2},
                 "config": {"title": "今日 GMV", "metric": "gmv", "compare": "yesterday"}},
                {"type": "indicator_card", "position": {"x": 3, "y": 0, "w": 3, "h": 2},
                 "config": {"title": "订单量", "metric": "order_count", "compare": "yesterday"}},
                {"type": "indicator_card", "position": {"x": 6, "y": 0, "w": 3, "h": 2},
                 "config": {"title": "转化率", "metric": "conversion_rate", "compare": "last_week"}},
                {"type": "indicator_card", "position": {"x": 9, "y": 0, "w": 3, "h": 2},
                 "config": {"title": "客单价", "metric": "avg_order_value", "compare": "yesterday"}},
                {"type": "line_chart", "position": {"x": 0, "y": 2, "w": 8, "h": 4},
                 "config": {"title": "GMV 趋势", "x_axis": "date", "y_axis": "gmv"}},
                {"type": "bar_chart", "position": {"x": 8, "y": 2, "w": 4, "h": 4},
                 "config": {"title": "区域分布", "x_axis": "region", "y_axis": "gmv"}},
                {"type": "funnel_chart", "position": {"x": 0, "y": 6, "w": 6, "h": 4},
                 "config": {"title": "转化漏斗", "stages": ["浏览", "加购", "下单", "支付"]}},
                {"type": "table", "position": {"x": 6, "y": 6, "w": 6, "h": 4},
                 "config": {"title": "Top10 商品", "columns": ["product", "sales", "quantity"]}},
            ],
        },
        "销售管理": {
            "description": "销售团队业绩看板",
            "components": [
                {"type": "indicator_card", "position": {"x": 0, "y": 0, "w": 4, "h": 2},
                 "config": {"title": "本月签单额", "metric": "signed_amount"}},
                {"type": "indicator_card", "position": {"x": 4, "y": 0, "w": 4, "h": 2},
                 "config": {"title": "在谈商机数", "metric": "pipeline_count"}},
                {"type": "indicator_card", "position": {"x": 8, "y": 0, "w": 4, "h": 2},
                 "config": {"title": "赢单率", "metric": "win_rate"}},
                {"type": "bar_chart", "position": {"x": 0, "y": 2, "w": 6, "h": 4},
                 "config": {"title": "销售排名", "x_axis": "salesperson", "y_axis": "amount"}},
                {"type": "pie_chart", "position": {"x": 6, "y": 2, "w": 6, "h": 4},
                 "config": {"title": "商机阶段分布", "label": "stage", "value": "count"}},
            ],
        },
    }

    KEYWORD_MAP = {
        "电商": "电商运营", "GMV": "电商运营", "订单": "电商运营", "转化": "电商运营",
        "销售": "销售管理", "业绩": "销售管理", "签单": "销售管理", "商机": "销售管理",
    }

    def recommend(self, user_description: str) -> dict:
        matched_template = None
        max_match = 0

        for keyword, template_key in self.KEYWORD_MAP.items():
            if keyword in user_description:
                template = self.TEMPLATES[template_key]
                match_count = sum(1 for k in self.KEYWORD_MAP if k in user_description)
                if match_count > max_match:
                    max_match = match_count
                    matched_template = template_key

        if matched_template:
            return {
                "matched": True,
                "template_name": matched_template,
                "layout": self.TEMPLATES[matched_template],
            }

        return {
            "matched": False,
            "suggestion": "未找到匹配的模板，请尝试描述您的业务场景，如'电商运营日报'或'销售业绩看板'",
        }
```

### 5.2 推荐的局限性

AI 推荐能解决"冷启动"问题，但不能替代用户的个性化调整。推荐出来的布局是一个**起点**，用户还需要根据自己的实际业务调整组件类型、数据绑定和布局位置。

这也是为什么 Dashboard 构建器必须同时支持"AI 推荐"和"手动调整"两种模式——前者降低门槛，后者提供灵活性。

## 六、代码实战：构建 Dashboard 构建器原型

接下来我们实现一个完整的 Dashboard 构建器原型，包含组件系统、布局引擎、数据绑定和 AI 推荐。

### 6.1 项目结构

```
dashboard-builder/
├── requirements.txt
├── components.py          # 组件系统
├── layout_engine.py       # 布局引擎
├── data_binder.py         # 数据绑定
├── filter_manager.py      # 筛选器管理
├── recommender.py         # AI 推荐
├── dashboard.py           # Dashboard 主类
├── serializer.py          # 序列化与反序列化
└── demo.py                # 演示脚本
```

### 6.2 requirements.txt

```
pydantic>=2.0.0
jinja2>=3.1.0
```

### 6.3 components.py - 组件系统

```python
"""组件系统：定义组件模型、注册表和内置组件"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ComponentMeta:
    """组件元信息"""
    type_id: str
    display_name: str
    category: str
    icon: str = "📊"
    default_size: dict = field(default_factory=lambda: {"w": 6, "h": 4})
    min_size: dict = field(default_factory=lambda: {"w": 2, "h": 2})
    configurable_fields: list[str] = field(default_factory=list)


@dataclass
class ComponentInstance:
    """组件实例：一个已配置并放置在画布上的组件"""
    instance_id: str
    type_id: str
    position: dict          # {"x": int, "y": int, "w": int, "h": int}
    config: dict = field(default_factory=dict)
    data_source: dict = field(default_factory=dict)
    filter_bindings: list[str] = field(default_factory=list)


class BaseComponent(ABC):
    """组件基类"""

    @abstractmethod
    def meta(self) -> ComponentMeta:
        ...

    @abstractmethod
    def default_config(self) -> dict:
        ...

    @abstractmethod
    def validate_config(self, config: dict) -> tuple[bool, str]:
        ...

    @abstractmethod
    def generate_query(self, config: dict, filters: dict) -> str:
        ...

    @abstractmethod
    def render_html(self, data: list[dict], config: dict) -> str:
        ...


class LineChartComponent(BaseComponent):

    def meta(self) -> ComponentMeta:
        return ComponentMeta(
            type_id="line_chart",
            display_name="折线图",
            category="chart",
            icon="📈",
            default_size={"w": 6, "h": 4},
            min_size={"w": 4, "h": 3},
            configurable_fields=["title", "x_axis", "y_axis", "smooth", "color"],
        )

    def default_config(self) -> dict:
        return {"title": "折线图", "x_axis": "", "y_axis": "", "smooth": True, "color": "#2563eb"}

    def validate_config(self, config: dict) -> tuple[bool, str]:
        if not config.get("x_axis"):
            return False, "缺少 x_axis 配置"
        if not config.get("y_axis"):
            return False, "缺少 y_axis 配置"
        return True, ""

    def generate_query(self, config: dict, filters: dict) -> str:
        table = config.get("table", "data_table")
        x = config["x_axis"]
        y = config["y_axis"]
        where_clauses = []

        date_range = filters.get("date_range")
        if date_range and len(date_range) == 2:
            where_clauses.append(f"{x} BETWEEN '{date_range[0]}' AND '{date_range[1]}'")

        where_sql = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        return f"SELECT {x}, SUM({y}) as {y} FROM {table}{where_sql} GROUP BY {x} ORDER BY {x}"

    def render_html(self, data: list[dict], config: dict) -> str:
        title = config.get("title", "折线图")
        x_axis = config.get("x_axis", "x")
        y_axis = config.get("y_axis", "y")
        x_vals = [str(row.get(x_axis, "")) for row in data]
        y_vals = [row.get(y_axis, 0) for row in data]

        if not y_vals:
            return f'<div class="chart-card"><h3>{title}</h3><p>暂无数据</p></div>'

        max_val = max(y_vals) if y_vals else 1
        min_val = min(y_vals) if y_vals else 0
        val_range = max_val - min_val if max_val != min_val else 1

        points = []
        for i, val in enumerate(y_vals):
            x_pct = (i / max(len(y_vals) - 1, 1)) * 100
            y_pct = 100 - ((val - min_val) / val_range) * 80
            points.append(f"{x_pct:.1f},{y_pct:.1f}")

        polyline = " ".join(points)

        svg = f'''<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:200px;">
  <polyline points="{polyline}" fill="none" stroke="{config.get('color', '#2563eb')}" stroke-width="0.5"/>
</svg>'''

        return f'<div class="chart-card"><h3>{title}</h3>{svg}</div>'


class BarChartComponent(BaseComponent):

    def meta(self) -> ComponentMeta:
        return ComponentMeta(
            type_id="bar_chart",
            display_name="柱状图",
            category="chart",
            icon="📊",
            default_size={"w": 6, "h": 4},
            min_size={"w": 3, "h": 3},
            configurable_fields=["title", "x_axis", "y_axis", "color"],
        )

    def default_config(self) -> dict:
        return {"title": "柱状图", "x_axis": "", "y_axis": "", "color": "#10b981"}

    def validate_config(self, config: dict) -> tuple[bool, str]:
        if not config.get("x_axis"):
            return False, "缺少 x_axis 配置"
        if not config.get("y_axis"):
            return False, "缺少 y_axis 配置"
        return True, ""

    def generate_query(self, config: dict, filters: dict) -> str:
        table = config.get("table", "data_table")
        x = config["x_axis"]
        y = config["y_axis"]
        return f"SELECT {x}, SUM({y}) as {y} FROM {table} GROUP BY {x} ORDER BY {y} DESC"

    def render_html(self, data: list[dict], config: dict) -> str:
        title = config.get("title", "柱状图")
        x_axis = config.get("x_axis", "x")
        y_axis = config.get("y_axis", "y")
        color = config.get("color", "#10b981")

        vals = [row.get(y_axis, 0) for row in data]
        max_val = max(vals) if vals else 1

        bars_html = ""
        for row in data:
            label = str(row.get(x_axis, ""))
            value = row.get(y_axis, 0)
            height_pct = (value / max_val) * 100 if max_val > 0 else 0
            bars_html += f'''<div class="bar-item">
  <div class="bar" style="height:{height_pct:.0f}%;background:{color};"></div>
  <span class="bar-label">{label}</span>
  <span class="bar-value">{value:,.0f}</span>
</div>'''

        return f'<div class="chart-card"><h3>{title}</h3><div class="bar-chart">{bars_html}</div></div>'


class IndicatorCardComponent(BaseComponent):

    def meta(self) -> ComponentMeta:
        return ComponentMeta(
            type_id="indicator_card",
            display_name="指标卡",
            category="indicator",
            icon="🔢",
            default_size={"w": 3, "h": 2},
            min_size={"w": 2, "h": 2},
            configurable_fields=["title", "metric", "format", "compare"],
        )

    def default_config(self) -> dict:
        return {"title": "指标", "metric": "", "format": "number", "compare": None}

    def validate_config(self, config: dict) -> tuple[bool, str]:
        if not config.get("metric"):
            return False, "缺少 metric 配置"
        return True, ""

    def generate_query(self, config: dict, filters: dict) -> str:
        table = config.get("table", "data_table")
        metric = config["metric"]
        return f"SELECT SUM({metric}) as current_value FROM {table}"

    def render_html(self, data: list[dict], config: dict) -> str:
        title = config.get("title", "指标")
        value = data[0].get("current_value", 0) if data else 0
        fmt = config.get("format", "number")

        if fmt == "currency":
            display = f"¥{value:,.2f}"
        elif fmt == "percent":
            display = f"{value:.1%}"
        else:
            display = f"{value:,.0f}"

        compare_html = ""
        compare = config.get("compare")
        if compare and len(data) > 1:
            prev = data[1].get("current_value", 0)
            if prev > 0:
                change = (value - prev) / prev
                arrow = "↑" if change >= 0 else "↓"
                color = "#10b981" if change >= 0 else "#ef4444"
                compare_html = f'<span style="color:{color};">{arrow} {abs(change):.1%}</span>'

        return f'''<div class="indicator-card">
  <div class="indicator-title">{title}</div>
  <div class="indicator-value">{display}</div>
  {compare_html}
</div>'''


class TableComponent(BaseComponent):

    def meta(self) -> ComponentMeta:
        return ComponentMeta(
            type_id="table",
            display_name="数据表格",
            category="table",
            icon="📋",
            default_size={"w": 6, "h": 4},
            min_size={"w": 4, "h": 3},
            configurable_fields=["title", "columns", "page_size"],
        )

    def default_config(self) -> dict:
        return {"title": "数据表格", "columns": [], "page_size": 10}

    def validate_config(self, config: dict) -> tuple[bool, str]:
        if not config.get("columns"):
            return False, "缺少 columns 配置"
        return True, ""

    def generate_query(self, config: dict, filters: dict) -> str:
        table = config.get("table", "data_table")
        columns = config.get("columns", ["*"])
        page_size = config.get("page_size", 10)
        cols = ", ".join(columns) if columns else "*"
        return f"SELECT {cols} FROM {table} LIMIT {page_size}"

    def render_html(self, data: list[dict], config: dict) -> str:
        title = config.get("title", "数据表格")
        if not data:
            return f'<div class="chart-card"><h3>{title}</h3><p>暂无数据</p></div>'

        columns = list(data[0].keys())
        header = "".join(f"<th>{col}</th>" for col in columns)
        rows = ""
        for row in data:
            cells = "".join(f"<td>{row.get(col, '')}</td>" for col in columns)
            rows += f"<tr>{cells}</tr>"

        return f'''<div class="chart-card">
  <h3>{title}</h3>
  <table class="data-table"><thead><tr>{header}</tr></thead><tbody>{rows}</tbody></table>
</div>'''


class ComponentRegistry:
    """组件注册表"""

    def __init__(self):
        self._components: dict[str, BaseComponent] = {}

    def register(self, component: BaseComponent) -> None:
        meta = component.meta()
        self._components[meta.type_id] = component

    def get(self, type_id: str) -> BaseComponent | None:
        return self._components.get(type_id)

    def list_all(self) -> list[ComponentMeta]:
        return [comp.meta() for comp in self._components.values()]

    def list_by_category(self, category: str) -> list[ComponentMeta]:
        return [comp.meta() for comp in self._components.values() if comp.meta().category == category]

    def create_default_registry() -> "ComponentRegistry":
        registry = ComponentRegistry()
        registry.register(LineChartComponent())
        registry.register(BarChartComponent())
        registry.register(IndicatorCardComponent())
        registry.register(TableComponent())
        return registry
```

### 6.4 layout_engine.py - 布局引擎

```python
"""布局引擎：栅格系统、碰撞检测、自动避让"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class GridPosition:
    x: int
    y: int
    w: int
    h: int

    @property
    def x2(self) -> int:
        return self.x + self.w

    @property
    def y2(self) -> int:
        return self.y + self.h

    def to_dict(self) -> dict:
        return {"x": self.x, "y": self.y, "w": self.w, "h": self.h}


class LayoutEngine:
    """栅格布局引擎"""

    def __init__(self, columns: int = 12, gap: int = 16):
        self.columns = columns
        self.gap = gap
        self.positions: dict[str, GridPosition] = {}

    def add_component(self, comp_id: str, position: GridPosition) -> tuple[bool, str]:
        if position.x < 0 or position.y < 0:
            return False, "位置不能为负数"
        if position.w < 1 or position.h < 1:
            return False, "尺寸必须大于 0"
        if position.x + position.w > self.columns:
            return False, f"超出栅格边界: x({position.x}) + w({position.w}) > {self.columns}"

        collisions = self._find_collisions(comp_id, position)
        if collisions:
            return False, f"与组件 {collisions} 碰撞"

        self.positions[comp_id] = position
        return True, "放置成功"

    def move_component(self, comp_id: str, new_position: GridPosition, auto_shove: bool = True) -> tuple[bool, str]:
        if comp_id not in self.positions:
            return False, f"组件 {comp_id} 不存在"

        if new_position.x + new_position.w > self.columns:
            return False, f"超出栅格边界"

        if auto_shove:
            self.positions[comp_id] = new_position
            self._auto_shove()
            return True, "移动成功（已自动避让）"
        else:
            collisions = self._find_collisions(comp_id, new_position)
            if collisions:
                return False, f"与组件 {collisions} 碰撞"
            self.positions[comp_id] = new_position
            return True, "移动成功"

    def resize_component(self, comp_id: str, new_w: int, new_h: int) -> tuple[bool, str]:
        if comp_id not in self.positions:
            return False, f"组件 {comp_id} 不存在"

        old = self.positions[comp_id]
        if old.x + new_w > self.columns:
            return False, f"调整后超出栅格边界"

        new_pos = GridPosition(old.x, old.y, new_w, new_h)
        self.positions[comp_id] = new_pos
        self._auto_shove()
        return True, "调整成功"

    def remove_component(self, comp_id: str) -> bool:
        if comp_id in self.positions:
            del self.positions[comp_id]
            return True
        return False

    def get_total_height(self) -> int:
        if not self.positions:
            return 0
        return max(p.y2 for p in self.positions.values())

    def find_next_available_position(self, w: int, h: int) -> GridPosition:
        """找到下一个可用位置（从左上角开始扫描）"""
        max_y = self.get_total_height() + 1

        for y in range(max_y + 10):
            for x in range(self.columns - w + 1):
                candidate = GridPosition(x, y, w, h)
                if not self._find_collisions("__candidate__", candidate):
                    return candidate

        return GridPosition(0, max_y, w, h)

    def _find_collisions(self, target_id: str, new_pos: GridPosition) -> list[str]:
        collisions = []
        for comp_id, pos in self.positions.items():
            if comp_id == target_id:
                continue
            if self._rects_overlap(new_pos, pos):
                collisions.append(comp_id)
        return collisions

    @staticmethod
    def _rects_overlap(a: GridPosition, b: GridPosition) -> bool:
        if a.x2 <= b.x or b.x2 <= a.x:
            return False
        if a.y2 <= b.y or b.y2 <= a.y:
            return False
        return True

    def _auto_shove(self) -> None:
        changed = True
        iterations = 0

        while changed and iterations < 100:
            changed = False
            iterations += 1
            sorted_comps = sorted(self.positions.items(), key=lambda item: (item[1].y, item[1].x))

            for i, (comp_id_a, pos_a) in enumerate(sorted_comps):
                for comp_id_b, pos_b in sorted_comps[i + 1:]:
                    if self._rects_overlap(pos_a, pos_b):
                        new_y = pos_a.y2
                        self.positions[comp_id_b] = GridPosition(pos_b.x, new_y, pos_b.w, pos_b.h)
                        changed = True

    def to_dict(self) -> dict:
        return {cid: pos.to_dict() for cid, pos in self.positions.items()}
```

### 6.5 dashboard.py - Dashboard 主类

```python
"""Dashboard 主类：协调组件、布局、数据绑定和筛选器"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from typing import Any

from components import ComponentRegistry, ComponentInstance, BaseComponent
from layout_engine import LayoutEngine, GridPosition


class FilterManager:
    """筛选器管理"""

    def __init__(self):
        self.filters: dict[str, dict] = {}
        self.bindings: dict[str, list[str]] = {}

    def add_filter(self, filter_id: str, filter_type: str, default: Any, label: str = "") -> None:
        self.filters[filter_id] = {"type": filter_type, "value": default, "default": default, "label": label}

    def bind(self, filter_id: str, component_id: str) -> None:
        if filter_id not in self.bindings:
            self.bindings[filter_id] = []
        if component_id not in self.bindings[filter_id]:
            self.bindings[filter_id].append(component_id)

    def set_value(self, filter_id: str, value: Any) -> list[str]:
        if filter_id not in self.filters:
            return []
        self.filters[filter_id]["value"] = value
        return self.bindings.get(filter_id, [])

    def get_values(self) -> dict[str, Any]:
        return {fid: f["value"] for fid, f in self.filters.items()}

    def reset(self) -> None:
        for f in self.filters.values():
            f["value"] = f["default"]


class Dashboard:
    """Dashboard 主类"""

    def __init__(self, title: str, registry: ComponentRegistry | None = None):
        self.dashboard_id = f"dash_{uuid.uuid4().hex[:8]}"
        self.title = title
        self.registry = registry or ComponentRegistry.create_default_registry()
        self.layout = LayoutEngine(columns=12)
        self.filters = FilterManager()
        self.components: dict[str, ComponentInstance] = {}

    def add_component(
        self,
        type_id: str,
        config: dict,
        position: dict | None = None,
        data_source: dict | None = None,
        filter_bindings: list[str] | None = None,
    ) -> tuple[bool, str, str]:
        comp = self.registry.get(type_id)
        if not comp:
            return False, f"未知组件类型: {type_id}", ""

        valid, msg = comp.validate_config(config)
        if not valid:
            return False, f"配置校验失败: {msg}", ""

        instance_id = f"{type_id}_{uuid.uuid4().hex[:6]}"

        if position is None:
            default_size = comp.meta().default_size
            pos = self.layout.find_next_available_position(default_size["w"], default_size["h"])
        else:
            pos = GridPosition(position["x"], position["y"], position["w"], position["h"])

        placed, msg = self.layout.add_component(instance_id, pos)
        if not placed:
            return False, f"布局失败: {msg}", ""

        instance = ComponentInstance(
            instance_id=instance_id,
            type_id=type_id,
            position=pos.to_dict(),
            config=config,
            data_source=data_source or {},
            filter_bindings=filter_bindings or [],
        )

        self.components[instance_id] = instance

        for filter_id in (filter_bindings or []):
            self.filters.bind(filter_id, instance_id)

        return True, "添加成功", instance_id

    def remove_component(self, instance_id: str) -> bool:
        if instance_id not in self.components:
            return False
        self.layout.remove_component(instance_id)
        del self.components[instance_id]
        return True

    def render_component(self, instance_id: str, data: list[dict] | None = None) -> str:
        instance = self.components.get(instance_id)
        if not instance:
            return f"<p>组件不存在: {instance_id}</p>"

        comp = self.registry.get(instance.type_id)
        if not comp:
            return f"<p>未知组件类型: {instance.type_id}</p>"

        if data is None:
            data = [{"sample": 1}, {"sample": 2}]

        return comp.render_html(data, instance.config)

    def render_all(self, data_map: dict[str, list[dict]] | None = None) -> str:
        data_map = data_map or {}

        sorted_components = sorted(
            self.components.values(),
            key=lambda c: (c.position["y"], c.position["x"]),
        )

        sections = []
        for instance in sorted_components:
            data = data_map.get(instance.instance_id, [{"sample": 1}])
            html = self.render_component(instance.instance_id, data)
            sections.append(html)

        return "\n".join(sections)

    def to_json(self) -> str:
        data = {
            "dashboard_id": self.dashboard_id,
            "title": self.title,
            "layout": {"columns": self.layout.columns, "gap": self.layout.gap},
            "filters": {fid: {k: v for k, v in f.items()} for fid, f in self.filters.filters.items()},
            "components": {
                cid: {
                    "instance_id": c.instance_id,
                    "type_id": c.type_id,
                    "position": c.position,
                    "config": c.config,
                    "data_source": c.data_source,
                    "filter_bindings": c.filter_bindings,
                }
                for cid, c in self.components.items()
            },
        }
        return json.dumps(data, ensure_ascii=False, indent=2)

    def get_layout_info(self) -> str:
        lines = [f"Dashboard: {self.title}", f"组件数量: {len(self.components)}", ""]
        for cid, comp in self.components.items():
            p = comp.position
            lines.append(f"  {cid}: {comp.type_id} @ (x={p['x']}, y={p['y']}, w={p['w']}, h={p['h']})")
        lines.append(f"\n总高度: {self.layout.get_total_height()} 行")
        return "\n".join(lines)
```

### 6.6 demo.py - 演示脚本

```python
"""演示脚本：创建一个电商运营 Dashboard"""

from components import ComponentRegistry
from layout_engine import LayoutEngine, GridPosition
from dashboard import Dashboard


def main():
    print("=" * 60)
    print("Dashboard 构建器演示")
    print("=" * 60)

    dashboard = Dashboard("电商运营日报")

    dashboard.filters.add_filter("date_range", "date_range", ["2024-01-01", "2024-03-31"], "日期范围")
    dashboard.filters.add_filter("region", "select", "全部", "区域")

    ok, msg, cid_gmv = dashboard.add_component(
        type_id="indicator_card",
        config={"title": "今日 GMV", "metric": "gmv", "format": "currency", "table": "orders"},
        position={"x": 0, "y": 0, "w": 3, "h": 2},
        filter_bindings=["date_range"],
    )
    print(f"添加指标卡(GMV): {msg}")

    ok, msg, cid_orders = dashboard.add_component(
        type_id="indicator_card",
        config={"title": "订单量", "metric": "order_count", "format": "number", "table": "orders"},
        position={"x": 3, "y": 0, "w": 3, "h": 2},
        filter_bindings=["date_range"],
    )
    print(f"添加指标卡(订单量): {msg}")

    ok, msg, cid_conv = dashboard.add_component(
        type_id="indicator_card",
        config={"title": "转化率", "metric": "conversion_rate", "format": "percent", "table": "orders"},
        position={"x": 6, "y": 0, "w": 3, "h": 2},
    )
    print(f"添加指标卡(转化率): {msg}")

    ok, msg, cid_aov = dashboard.add_component(
        type_id="indicator_card",
        config={"title": "客单价", "metric": "avg_order_value", "format": "currency", "table": "orders"},
        position={"x": 9, "y": 0, "w": 3, "h": 2},
    )
    print(f"添加指标卡(客单价): {msg}")

    ok, msg, cid_trend = dashboard.add_component(
        type_id="line_chart",
        config={"title": "GMV 趋势", "x_axis": "date", "y_axis": "gmv", "table": "orders", "color": "#2563eb"},
        position={"x": 0, "y": 2, "w": 8, "h": 4},
        filter_bindings=["date_range"],
    )
    print(f"添加折线图: {msg}")

    ok, msg, cid_region = dashboard.add_component(
        type_id="bar_chart",
        config={"title": "区域分布", "x_axis": "region", "y_axis": "gmv", "table": "orders", "color": "#10b981"},
        position={"x": 8, "y": 2, "w": 4, "h": 4},
        filter_bindings=["region"],
    )
    print(f"添加柱状图: {msg}")

    ok, msg, cid_table = dashboard.add_component(
        type_id="table",
        config={"title": "Top10 商品", "columns": ["product", "sales", "quantity"], "page_size": 10, "table": "products"},
        position={"x": 0, "y": 6, "w": 12, "h": 4},
    )
    print(f"添加表格: {msg}")

    print("\n" + "=" * 60)
    print("Dashboard 布局信息:")
    print("=" * 60)
    print(dashboard.get_layout_info())

    print("\n" + "=" * 60)
    print("Dashboard JSON:")
    print("=" * 60)
    print(dashboard.to_json())

    print("\n" + "=" * 60)
    print("筛选器联动演示:")
    print("=" * 60)
    affected = dashboard.filters.set_value("date_range", ["2024-02-01", "2024-02-29"])
    print(f"修改日期范围为 2024年2月，受影响的组件: {affected}")

    print("\n" + "=" * 60)
    print("尝试放置一个会碰撞的组件:")
    print("=" * 60)
    ok, msg, _ = dashboard.add_component(
        type_id="bar_chart",
        config={"title": "重复区域", "x_axis": "region", "y_axis": "gmv", "table": "orders"},
        position={"x": 0, "y": 2, "w": 4, "h": 3},
        auto_shove=False,
    )
    print(f"结果: {msg}")

    print("\n演示完成！")


if __name__ == "__main__":
    main()
```

## 七、常见误区

### 误区一：过度追求自由布局

很多 Dashboard 构建器一开始就支持"像素级自由拖拽"——组件可以放在画布的任意位置、任意大小。这听起来很灵活，但实际使用中会带来大量问题：组件重叠、对齐困难、响应式适配困难、用户花大量时间在"调位置"上。

工程实践表明，**栅格系统**（12 列或 24 列）在灵活性和易用性之间取得了最好的平衡。用户在栅格内拖拽调整，系统自动处理对齐和碰撞，既保证了布局的整洁，又降低了用户的认知负担。

如果你确实需要自由布局（比如设计大屏展示），建议同时提供"栅格模式"和"自由模式"两种选择，让不同场景的用户各取所需。

### 误区二：每个组件直接写 SQL

最简单的实现方式是让每个组件直接绑定一条 SQL 查询。但这会导致两个问题：第一，当筛选器变化时，每个组件的 SQL 都需要重新拼接，容易出错；第二，相同数据源的多个组件会重复查询数据库。

更好的做法是引入**数据源层**——每个数据源定义一次查询逻辑，多个组件可以共享同一个数据源。筛选器变化时，数据源层统一处理查询的重新生成和执行，组件只需要关心"拿到数据后怎么渲染"。

### 误区三：忽略组件的生命周期管理

Dashboard 上的组件不是"创建了就一直存在"的。用户会频繁地添加、删除、移动和重新配置组件。如果组件绑定了定时刷新、WebSocket 推送或者 DOM 事件监听，在组件被删除时没有正确清理，就会造成内存泄漏。

每个组件应该有明确的生命周期：`create → mount → update → unmount`。在 `unmount` 阶段，必须清理所有定时器、事件监听和数据订阅。这在前端框架（React、Vue）中通常由框架自动处理，但在自研构建器中需要手动管理。

### 误区四：把 Dashboard 配置存在前端

有些原型项目把 Dashboard 的配置（组件列表、布局、筛选器绑定）存在浏览器的 localStorage 里。这在开发阶段没问题，但在生产环境中会导致：用户换一台电脑就看不到自己的 Dashboard；多人协作时无法共享；配置丢失无法恢复。

Dashboard 配置必须持久化到后端数据库，并且要有版本管理——每次保存都生成一个新版本，支持回滚到历史版本。

## 小结与练习

### 小结

1. Dashboard 构建器的核心架构分为四层：组件系统、布局引擎、数据引擎和事件引擎，其中**组件注册表**是可扩展性的关键
2. 栅格系统（12 列）是布局的最佳实践，在灵活性和易用性之间取得平衡；碰撞检测和自动避让是布局引擎的两个核心算法
3. 数据绑定通过模板语法实现筛选器到组件查询的映射，筛选器联动通过事件传播机制实现"改一个、刷新一批"
4. AI 辅助布局推荐能解决冷启动问题，但不能替代用户的个性化调整——推荐是起点，手动调整是必须
5. Dashboard 的 JSON Schema 既是前端渲染的输入，也是持久化存储的格式，设计一个好的 Schema 决定了系统的表达能力

### 练习

#### 练习一：实现饼图组件

当前的组件注册表中只有折线图、柱状图、指标卡和表格四种组件。请实现一个 `PieChartComponent`，并注册到组件注册表中。

要求：
- 实现 `BaseComponent` 的所有抽象方法
- `render_html` 能生成 SVG 格式的饼图（不需要外部图表库）
- 支持配置项：`title`、`label`（标签列）、`value`（数值列）、`color_scheme`

#### 练习二：实现撤销/重做功能

请为 Dashboard 添加撤销（Undo）和重做（Redo）功能。用户每次添加、删除或移动组件时，操作被记录到历史栈中。

要求：
- 使用命令模式（Command Pattern）实现
- 支持的操作：添加组件、删除组件、移动组件
- 撤销栈和重做栈独立管理
- 执行新操作时清空重做栈

#### 练习三：实现数据源层

请设计并实现一个数据源层（DataSourceLayer），将数据查询逻辑从组件中分离出来。

要求：
- 定义 `DataSource` 抽象类，包含 `get_query`、`execute`、`get_cache_key` 方法
- 支持多个组件共享同一个数据源
- 实现查询结果缓存，避免重复查询
- 筛选器变化时，只刷新受影响的数据源

---

## 参考答案

### 练习一：实现饼图组件

**思路**：饼图的核心是计算每个扇区的起始角度和结束角度。将数值转换为百分比，再映射到 0-360 度的角度范围。用 SVG 的 `path` 元素绘制每个扇区，通过三角函数计算弧线的坐标。

**答案**：

```python
import math


class PieChartComponent(BaseComponent):

    DEFAULT_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"]

    def meta(self) -> ComponentMeta:
        return ComponentMeta(
            type_id="pie_chart",
            display_name="饼图",
            category="chart",
            icon="🥧",
            default_size={"w": 6, "h": 4},
            min_size={"w": 3, "h": 3},
            configurable_fields=["title", "label", "value", "color_scheme"],
        )

    def default_config(self) -> dict:
        return {"title": "饼图", "label": "", "value": "", "color_scheme": "default"}

    def validate_config(self, config: dict) -> tuple[bool, str]:
        if not config.get("label"):
            return False, "缺少 label 配置"
        if not config.get("value"):
            return False, "缺少 value 配置"
        return True, ""

    def generate_query(self, config: dict, filters: dict) -> str:
        table = config.get("table", "data_table")
        label_col = config["label"]
        value_col = config["value"]
        return f"SELECT {label_col}, SUM({value_col}) as {value_col} FROM {table} GROUP BY {label_col} ORDER BY {value_col} DESC"

    def render_html(self, data: list[dict], config: dict) -> str:
        title = config.get("title", "饼图")
        label_col = config.get("label", "label")
        value_col = config.get("value", "value")

        if not data:
            return f'<div class="chart-card"><h3>{title}</h3><p>暂无数据</p></div>'

        labels = [str(row.get(label_col, "")) for row in data]
        values = [float(row.get(value_col, 0)) for row in data]
        total = sum(values)

        if total == 0:
            return f'<div class="chart-card"><h3>{title}</h3><p>数据总和为零</p></div>'

        colors = self.DEFAULT_COLORS
        cx, cy, r = 50, 50, 40
        current_angle = -math.pi / 2
        paths = []
        legend_items = []

        for i, (label, value) in enumerate(zip(labels, values)):
            pct = value / total
            angle = pct * 2 * math.pi
            end_angle = current_angle + angle

            large_arc = 1 if angle > math.pi else 0
            x1 = cx + r * math.cos(current_angle)
            y1 = cy + r * math.sin(current_angle)
            x2 = cx + r * math.cos(end_angle)
            y2 = cy + r * math.sin(end_angle)

            color = colors[i % len(colors)]
            path_d = f"M {cx},{cy} L {x1:.2f},{y1:.2f} A {r},{r} 0 {large_arc},1 {x2:.2f},{y2:.2f} Z"
            paths.append(f'<path d="{path_d}" fill="{color}" stroke="white" stroke-width="0.5"/>')

            legend_items.append(
                f'<div class="legend-item">'
                f'<span class="legend-color" style="background:{color};"></span>'
                f'<span class="legend-label">{label}</span>'
                f'<span class="legend-pct">{pct:.1%}</span>'
                f'</div>'
            )

            current_angle = end_angle

        svg = f'<svg viewBox="0 0 100 100" style="width:200px;height:200px;">{"".join(paths)}</svg>'
        legend = f'<div class="legend">{"".join(legend_items)}</div>'

        return f'<div class="chart-card"><h3>{title}</h3><div class="pie-container">{svg}{legend}</div></div>'
```

**要点**：
- 用 SVG `path` 的弧线命令（A）绘制扇区，`large_arc` 标志处理超过半圆的情况
- 起始角度从 `-π/2`（12 点钟方向）开始，顺时针绘制
- 颜色循环使用 `DEFAULT_COLORS` 列表，支持超过默认颜色数量的扇区
- 同时生成图例（legend），显示每个扇区的标签和百分比

### 练习二：实现撤销/重做功能

**思路**：使用命令模式，每个操作封装为一个 Command 对象，包含 `execute` 和 `undo` 方法。维护两个栈：undo_stack 和 redo_stack。执行新操作时压入 undo_stack 并清空 redo_stack。

**答案**：

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


class Command(ABC):
    """命令基类"""

    @abstractmethod
    def execute(self, dashboard: "Dashboard") -> bool:
        ...

    @abstractmethod
    def undo(self, dashboard: "Dashboard") -> bool:
        ...

    @abstractmethod
    def description(self) -> str:
        ...


class AddComponentCommand(Command):

    def __init__(self, type_id: str, config: dict, position: dict | None = None):
        self.type_id = type_id
        self.config = config
        self.position = position
        self.instance_id: str | None = None

    def execute(self, dashboard: "Dashboard") -> bool:
        ok, msg, cid = dashboard.add_component(self.type_id, self.config, self.position)
        if ok:
            self.instance_id = cid
        return ok

    def undo(self, dashboard: "Dashboard") -> bool:
        if self.instance_id:
            return dashboard.remove_component(self.instance_id)
        return False

    def description(self) -> str:
        return f"添加组件: {self.type_id}"


class RemoveComponentCommand(Command):

    def __init__(self, instance_id: str):
        self.instance_id = instance_id
        self.saved_instance: Any = None

    def execute(self, dashboard: "Dashboard") -> bool:
        instance = dashboard.components.get(self.instance_id)
        if instance:
            self.saved_instance = {
                "type_id": instance.type_id,
                "config": instance.config.copy(),
                "position": instance.position.copy(),
                "data_source": instance.data_source.copy(),
                "filter_bindings": instance.filter_bindings.copy(),
            }
            return dashboard.remove_component(self.instance_id)
        return False

    def undo(self, dashboard: "Dashboard") -> bool:
        if self.saved_instance:
            ok, _, cid = dashboard.add_component(
                type_id=self.saved_instance["type_id"],
                config=self.saved_instance["config"],
                position=self.saved_instance["position"],
                data_source=self.saved_instance["data_source"],
                filter_bindings=self.saved_instance["filter_bindings"],
            )
            return ok
        return False

    def description(self) -> str:
        return f"删除组件: {self.instance_id}"


class MoveComponentCommand(Command):

    def __init__(self, instance_id: str, new_position: dict):
        self.instance_id = instance_id
        self.new_position = new_position
        self.old_position: dict | None = None

    def execute(self, dashboard: "Dashboard") -> bool:
        instance = dashboard.components.get(self.instance_id)
        if not instance:
            return False
        self.old_position = instance.position.copy()
        from layout_engine import GridPosition
        ok, msg = dashboard.layout.move_component(
            self.instance_id,
            GridPosition(**self.new_position),
        )
        if ok:
            instance.position = self.new_position.copy()
        return ok

    def undo(self, dashboard: "Dashboard") -> bool:
        if self.old_position:
            from layout_engine import GridPosition
            ok, _ = dashboard.layout.move_component(
                self.instance_id,
                GridPosition(**self.old_position),
            )
            if ok:
                instance = dashboard.components.get(self.instance_id)
                if instance:
                    instance.position = self.old_position.copy()
            return ok
        return False

    def description(self) -> str:
        return f"移动组件: {self.instance_id}"


class UndoRedoManager:
    """撤销/重做管理器"""

    def __init__(self):
        self.undo_stack: list[Command] = []
        self.redo_stack: list[Command] = []

    def execute(self, command: Command, dashboard: "Dashboard") -> bool:
        success = command.execute(dashboard)
        if success:
            self.undo_stack.append(command)
            self.redo_stack.clear()
        return success

    def undo(self, dashboard: "Dashboard") -> bool:
        if not self.undo_stack:
            return False
        command = self.undo_stack.pop()
        success = command.undo(dashboard)
        if success:
            self.redo_stack.append(command)
        return success

    def redo(self, dashboard: "Dashboard") -> bool:
        if not self.redo_stack:
            return False
        command = self.redo_stack.pop()
        success = command.execute(dashboard)
        if success:
            self.undo_stack.append(command)
        return success

    def can_undo(self) -> bool:
        return len(self.undo_stack) > 0

    def can_redo(self) -> bool:
        return len(self.redo_stack) > 0

    def get_undo_description(self) -> str | None:
        if self.undo_stack:
            return self.undo_stack[-1].description()
        return None

    def get_redo_description(self) -> str | None:
        if self.redo_stack:
            return self.redo_stack[-1].description()
        return None
```

**要点**：
- 每个 Command 在 `execute` 时保存恢复所需的状态（如 `RemoveComponentCommand` 保存被删除组件的完整信息）
- `execute` 成功后才压入 undo_stack，失败时不记录
- 执行新操作时清空 redo_stack，符合标准的撤销/重做语义
- `MoveComponentCommand` 同时保存旧位置和新位置，支持双向恢复

### 练习三：实现数据源层

**思路**：将数据查询逻辑封装为独立的 DataSource 对象。组件不再直接写 SQL，而是引用一个数据源 ID。多个组件可以共享同一数据源。数据源负责查询生成、执行和缓存。

**答案**：

```python
import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class CacheEntry:
    data: list[dict]
    cache_key: str
    hit_count: int = 0


class DataSource(ABC):
    """数据源基类"""

    def __init__(self, source_id: str):
        self.source_id = source_id
        self._cache: dict[str, CacheEntry] = {}
        self._subscribers: list[str] = []

    @abstractmethod
    def get_query(self, filters: dict) -> str:
        """根据筛选器生成查询"""
        ...

    def get_cache_key(self, filters: dict) -> str:
        query = self.get_query(filters)
        return hashlib.sha256(query.encode()).hexdigest()[:16]

    def execute(self, filters: dict, force_refresh: bool = False) -> list[dict]:
        cache_key = self.get_cache_key(filters)

        if not force_refresh and cache_key in self._cache:
            entry = self._cache[cache_key]
            entry.hit_count += 1
            return entry.data

        query = self.get_query(filters)
        data = self._run_query(query)

        self._cache[cache_key] = CacheEntry(data=data, cache_key=cache_key, hit_count=0)
        return data

    def _run_query(self, query: str) -> list[dict]:
        return [{"result": "mock_data", "query": query[:50]}]

    def clear_cache(self) -> None:
        self._cache.clear()

    def subscribe(self, component_id: str) -> None:
        if component_id not in self._subscribers:
            self._subscribers.append(component_id)

    def unsubscribe(self, component_id: str) -> None:
        self._subscribers = [c for c in self._subscribers if c != component_id]

    def get_subscribers(self) -> list[str]:
        return self._subscribers.copy()


class SQLDataSource(DataSource):
    """SQL 数据源"""

    def __init__(self, source_id: str, table: str, base_query: str = ""):
        super().__init__(source_id)
        self.table = table
        self.base_query = base_query

    def get_query(self, filters: dict) -> str:
        if self.base_query:
            query = self.base_query
            for key, value in filters.items():
                if isinstance(value, (list, tuple)):
                    placeholders = ", ".join(f"'{v}'" for v in value)
                    query = query.replace(f"{{{{{key}}}}}", placeholders)
                else:
                    query = query.replace(f"{{{{{key}}}}}", str(value))
            return query

        where_clauses = []
        date_range = filters.get("date_range")
        if date_range and len(date_range) == 2:
            where_clauses.append(f"date BETWEEN '{date_range[0]}' AND '{date_range[1]}'")

        region = filters.get("region")
        if region and region != "全部":
            where_clauses.append(f"region = '{region}'")

        where_sql = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        return f"SELECT * FROM {self.table}{where_sql}"


class DataSourceManager:
    """数据源管理器"""

    def __init__(self):
        self._sources: dict[str, DataSource] = {}
        self._component_bindings: dict[str, str] = {}  # component_id → source_id

    def register_source(self, source: DataSource) -> None:
        self._sources[source.source_id] = source

    def bind_component(self, component_id: str, source_id: str) -> None:
        if source_id not in self._sources:
            raise ValueError(f"数据源不存在: {source_id}")
        self._component_bindings[component_id] = source_id
        self._sources[source_id].subscribe(component_id)

    def unbind_component(self, component_id: str) -> None:
        source_id = self._component_bindings.pop(component_id, None)
        if source_id and source_id in self._sources:
            self._sources[source_id].unsubscribe(component_id)

    def get_affected_sources(self, filter_id: str, filter_bindings: dict[str, list[str]]) -> list[str]:
        affected_components = filter_bindings.get(filter_id, [])
        source_ids = set()
        for comp_id in affected_components:
            source_id = self._component_bindings.get(comp_id)
            if source_id:
                source_ids.add(source_id)
        return list(source_ids)

    def refresh(self, source_id: str, filters: dict, force: bool = False) -> list[dict]:
        source = self._sources.get(source_id)
        if not source:
            return []
        return source.execute(filters, force_refresh=force)

    def refresh_all_affected(self, filter_id: str, filters: dict, filter_bindings: dict[str, list[str]]) -> dict[str, list[dict]]:
        results = {}
        for source_id in self.get_affected_sources(filter_id, filter_bindings):
            results[source_id] = self.refresh(source_id, filters)
        return results

    def get_cache_stats(self) -> dict:
        stats = {}
        for source_id, source in self._sources.items():
            stats[source_id] = {
                "cache_entries": len(source._cache),
                "subscribers": len(source.get_subscribers()),
            }
        return stats
```

**要点**：
- `DataSource` 是抽象基类，`SQLDataSource` 是具体实现，未来可以扩展 API 数据源、文件数据源等
- 缓存键基于生成的 SQL 查询的哈希值，相同的筛选器组合会命中缓存
- `subscribe/unsubscribe` 机制追踪哪些组件在使用某个数据源，组件被删除时自动取消订阅
- `refresh_all_affected` 方法实现了"改一个筛选器、刷新相关数据源"的联动逻辑

from typing import TypedDict, Annotated, Sequence
import operator
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
import json
import sqlite3
import pandas as pd
from pathlib import Path

from backend.config import OPENAI_API_KEY, LLM_MODEL, LLM_TEMPERATURE, DB_PATH


class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    query: str
    sql: str
    query_result: str
    analysis: str
    visualization: str
    report: str
    current_agent: str
    error: str


MOCK_MODE = not OPENAI_API_KEY


def get_llm():
    if MOCK_MODE:
        return None
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(
        model=LLM_MODEL,
        temperature=LLM_TEMPERATURE,
        api_key=OPENAI_API_KEY,
    )


def get_db_schema() -> str:
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    schema_parts = []
    for (table_name,) in tables:
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        cols = [f"  {col[1]} ({col[2]})" for col in columns]
        schema_parts.append(f"表 {table_name}:\n" + "\n".join(cols))
    conn.close()
    return "\n\n".join(schema_parts)


def execute_sql(sql: str) -> str:
    try:
        conn = sqlite3.connect(str(DB_PATH))
        df = pd.read_sql_query(sql, conn)
        conn.close()
        return df.to_json(orient="records", force_ascii=False)
    except Exception as e:
        return f"SQL 执行错误: {str(e)}"


def mock_generate_sql(query: str) -> str:
    query_lower = query.lower()
    
    if "部门" in query and ("预算" in query or "人数" in query):
        return "SELECT d.name AS 部门名称, d.budget AS 预算, COUNT(e.id) AS 人数 FROM departments d LEFT JOIN employees e ON d.id = e.department_id GROUP BY d.id, d.name, d.budget"
    elif "地区" in query and "销售" in query:
        return "SELECT region AS 地区, SUM(amount) AS 总销售额, SUM(quantity) AS 总数量 FROM sales GROUP BY region ORDER BY 总销售额 DESC"
    elif "趋势" in query or "半年" in query:
        return "SELECT strftime('%Y-%m', sale_date) AS 月份, SUM(amount) AS 销售额, SUM(quantity) AS 数量 FROM sales GROUP BY 月份 ORDER BY 月份"
    elif "绩效" in query or "评分" in query:
        return "SELECT e.name AS 员工姓名, p.quarter AS 季度, p.score AS 绩效评分, p.feedback AS 反馈 FROM performance p JOIN employees e ON p.employee_id = e.id ORDER BY p.score DESC"
    elif "产品" in query and "销售" in query:
        return "SELECT product AS 产品, SUM(amount) AS 总销售额, SUM(quantity) AS 总数量, COUNT(*) AS 订单数 FROM sales GROUP BY product ORDER BY 总销售额 DESC"
    elif "项目" in query:
        return "SELECT p.name AS 项目名称, d.name AS 所属部门, p.status AS 状态, p.budget AS 预算 FROM projects p JOIN departments d ON p.department_id = d.id ORDER BY p.budget DESC"
    elif "员工" in query:
        return "SELECT e.name AS 姓名, d.name AS 部门, e.position AS 职位, e.salary AS 薪资 FROM employees e JOIN departments d ON e.department_id = d.id ORDER BY e.salary DESC"
    else:
        return "SELECT * FROM sales LIMIT 10"


def mock_analyze(query: str, sql: str, result: str) -> str:
    try:
        data = json.loads(result)
    except:
        data = []
    
    if not data:
        return "查询结果为空，无法进行分析。"
    
    total_records = len(data)
    first_record = data[0] if data else {}
    keys = list(first_record.keys())
    
    analysis = f"## 数据分析\n\n"
    analysis += f"### 数据概览\n"
    analysis += f"- 共查询到 **{total_records}** 条记录\n"
    analysis += f"- 包含字段：{', '.join(keys)}\n\n"
    
    if "总销售额" in first_record:
        values = [d.get("总销售额", 0) for d in data if isinstance(d.get("总销售额"), (int, float))]
        if values:
            analysis += f"### 关键指标\n"
            analysis += f"- 最高销售额：**{max(values):,.0f}**\n"
            analysis += f"- 最低销售额：**{min(values):,.0f}**\n"
            analysis += f"- 平均销售额：**{sum(values)/len(values):,.0f}**\n\n"
    
    if "预算" in first_record:
        values = [d.get("预算", 0) for d in data if isinstance(d.get("预算"), (int, float))]
        if values:
            analysis += f"### 预算分析\n"
            analysis += f"- 总预算：**{sum(values):,.0f}**\n"
            analysis += f"- 平均预算：**{sum(values)/len(values):,.0f}**\n\n"
    
    analysis += "### 洞察与建议\n"
    analysis += "1. 数据分布较为均衡，各项指标表现稳定\n"
    analysis += "2. 建议关注表现突出的项目/部门，总结成功经验\n"
    analysis += "3. 可以进一步分析时间趋势，发现增长机会\n"
    
    return analysis


def mock_visualize(query: str, result: str) -> str:
    try:
        data = json.loads(result)
    except:
        data = []
    
    if not data:
        return json.dumps({"chart_type": "bar", "title": "数据可视化", "data_keys": []})
    
    keys = list(data[0].keys())
    
    if "地区" in keys or "region" in str(keys).lower():
        chart_type = "pie"
        title = "地区分布"
    elif "月份" in keys or "季度" in keys:
        chart_type = "line"
        title = "趋势分析"
    elif "产品" in keys:
        chart_type = "bar"
        title = "产品对比"
    else:
        chart_type = "bar"
        title = "数据对比"
    
    return json.dumps({
        "chart_type": chart_type,
        "title": title,
        "x_label": keys[0] if keys else "",
        "y_label": keys[1] if len(keys) > 1 else "",
        "data_keys": keys
    }, ensure_ascii=False)


def mock_report(query: str, sql: str, result: str, analysis: str, visualization: str) -> str:
    report = f"# 数据分析报告\n\n"
    report += f"## 摘要\n\n"
    report += f"针对您的问题「{query}」，我们进行了全面的数据查询与分析。\n\n"
    
    report += f"## 查询信息\n\n"
    report += f"```sql\n{sql}\n```\n\n"
    
    report += f"## 分析结果\n\n"
    report += f"{analysis}\n\n"
    
    report += f"## 可视化建议\n\n"
    try:
        viz = json.loads(visualization)
        report += f"- 推荐图表类型：**{viz.get('chart_type', 'bar')}**\n"
        report += f"- 图表标题：{viz.get('title', '数据可视化')}\n\n"
    except:
        report += "建议使用柱状图展示数据对比。\n\n"
    
    report += f"## 结论\n\n"
    report += f"1. 数据查询成功，获取了完整的分析数据\n"
    report += f"2. 通过多维度分析，发现了有价值的数据洞察\n"
    report += f"3. 建议结合可视化图表，进一步探索数据规律\n\n"
    
    report += f"---\n*报告由 AI 数据分析平台自动生成*"
    
    return report


def query_agent(state: AgentState) -> AgentState:
    query = state["query"]
    
    if MOCK_MODE:
        sql = mock_generate_sql(query)
    else:
        llm = get_llm()
        schema = get_db_schema()
        
        system_prompt = f"""你是一个专业的数据查询专家。根据用户的自然语言问题，生成正确的 SQL 查询。

数据库结构:
{schema}

规则:
1. 只生成 SELECT 语句
2. 使用 SQLite 语法
3. 确保 SQL 正确且高效
4. 只返回 SQL 语句，不要其他内容"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=query),
        ]
        
        response = llm.invoke(messages)
        sql = response.content.strip()
        
        if sql.startswith("```sql"):
            sql = sql[6:]
        if sql.startswith("```"):
            sql = sql[3:]
        if sql.endswith("```"):
            sql = sql[:-3]
        sql = sql.strip()
    
    query_result = execute_sql(sql)
    
    return {
        **state,
        "sql": sql,
        "query_result": query_result,
        "current_agent": "query",
        "messages": [AIMessage(content=f"已生成 SQL 查询:\n```sql\n{sql}\n```\n\n查询结果:\n{query_result}")],
    }


def analysis_agent(state: AgentState) -> AgentState:
    if MOCK_MODE:
        analysis = mock_analyze(state["query"], state["sql"], state["query_result"])
    else:
        llm = get_llm()
        
        system_prompt = """你是一个专业的数据分析专家。根据查询结果进行深入分析。

分析要求:
1. 识别数据中的关键趋势和模式
2. 发现有价值的洞察
3. 提供数据支持的结论
4. 给出可行的建议"""

        prompt = f"""用户问题: {state['query']}

SQL 查询: {state['sql']}

查询结果: {state['query_result']}

请进行深入的数据分析。"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=prompt),
        ]
        
        response = llm.invoke(messages)
        analysis = response.content
    
    return {
        **state,
        "analysis": analysis,
        "current_agent": "analysis",
        "messages": [AIMessage(content=analysis)],
    }


def visualization_agent(state: AgentState) -> AgentState:
    if MOCK_MODE:
        viz_json = mock_visualize(state["query"], state["query_result"])
    else:
        llm = get_llm()
        
        system_prompt = """你是一个数据可视化专家。根据分析结果，推荐最合适的图表类型和配置。

可用图表类型:
- bar: 柱状图（适合分类比较）
- line: 折线图（适合趋势展示）
- pie: 饼图（适合占比分析）
- scatter: 散点图（适合相关性分析）

请以 JSON 格式返回图表配置。"""

        prompt = f"""分析结果: {state['analysis']}

查询结果: {state['query_result']}

请推荐可视化方案，返回 JSON 格式:
{{"chart_type": "bar/line/pie/scatter", "title": "图表标题", "x_label": "X轴标签", "y_label": "Y轴标签", "data_keys": ["数据字段"]}}"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=prompt),
        ]
        
        response = llm.invoke(messages)
        
        try:
            viz_json = response.content.strip().replace("```json", "").replace("```", "").strip()
        except:
            viz_json = json.dumps({"chart_type": "bar", "title": "数据可视化", "data_keys": []})
    
    try:
        viz_config = json.loads(viz_json)
    except:
        viz_config = {"chart_type": "bar", "title": "数据可视化", "data_keys": []}
    
    return {
        **state,
        "visualization": json.dumps(viz_config, ensure_ascii=False),
        "current_agent": "visualization",
        "messages": [AIMessage(content=f"可视化方案:\n{json.dumps(viz_config, ensure_ascii=False, indent=2)}")],
    }


def report_agent(state: AgentState) -> AgentState:
    if MOCK_MODE:
        report = mock_report(
            state["query"], state["sql"], state["query_result"],
            state["analysis"], state["visualization"]
        )
    else:
        llm = get_llm()
        
        system_prompt = """你是一个专业的报告撰写专家。将数据分析结果整合为结构化报告。

报告格式:
1. 摘要（一句话总结）
2. 数据概览（关键指标）
3. 详细分析（趋势、模式、洞察）
4. 可视化建议
5. 结论与建议"""

        prompt = f"""用户问题: {state['query']}

查询结果: {state['query_result']}

分析结果: {state['analysis']}

可视化方案: {state['visualization']}

请生成完整的分析报告。"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=prompt),
        ]
        
        response = llm.invoke(messages)
        report = response.content
    
    return {
        **state,
        "report": report,
        "current_agent": "report",
        "messages": [AIMessage(content=report)],
    }


def should_continue(state: AgentState) -> str:
    if state.get("error"):
        return END
    if state["current_agent"] == "query":
        return "analysis"
    elif state["current_agent"] == "analysis":
        return "visualization"
    elif state["current_agent"] == "visualization":
        return "report"
    else:
        return END


def build_graph():
    workflow = StateGraph(AgentState)
    
    workflow.add_node("query", query_agent)
    workflow.add_node("analysis", analysis_agent)
    workflow.add_node("visualization", visualization_agent)
    workflow.add_node("report", report_agent)
    
    workflow.set_entry_point("query")
    
    workflow.add_conditional_edges("query", should_continue)
    workflow.add_conditional_edges("analysis", should_continue)
    workflow.add_conditional_edges("visualization", should_continue)
    workflow.add_edge("report", END)
    
    return workflow.compile()


graph = build_graph()


async def run_analysis(query: str) -> dict:
    result = await graph.ainvoke({
        "messages": [],
        "query": query,
        "sql": "",
        "query_result": "",
        "analysis": "",
        "visualization": "",
        "report": "",
        "current_agent": "",
        "error": "",
    })
    
    return {
        "query": query,
        "sql": result["sql"],
        "query_result": result["query_result"],
        "analysis": result["analysis"],
        "visualization": result["visualization"],
        "report": result["report"],
    }

import sqlite3
from pathlib import Path
from backend.config import DB_PATH, DATA_DIR


def init_database():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            manager TEXT,
            budget REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            department_id INTEGER,
            position TEXT,
            salary REAL,
            hire_date DATE,
            email TEXT,
            FOREIGN KEY (department_id) REFERENCES departments(id)
        );

        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            department_id INTEGER,
            status TEXT DEFAULT 'active',
            budget REAL,
            start_date DATE,
            end_date DATE,
            FOREIGN KEY (department_id) REFERENCES departments(id)
        );

        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product TEXT NOT NULL,
            region TEXT,
            amount REAL,
            quantity INTEGER,
            sale_date DATE,
            salesperson TEXT
        );

        CREATE TABLE IF NOT EXISTS performance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER,
            quarter TEXT,
            score REAL,
            feedback TEXT,
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        );
    """)

    departments = [
        ("技术部", "张三", 5000000),
        ("市场部", "李四", 3000000),
        ("销售部", "王五", 4000000),
        ("人力资源", "赵六", 2000000),
        ("财务部", "钱七", 2500000),
    ]
    cursor.executemany(
        "INSERT INTO departments (name, manager, budget) VALUES (?, ?, ?)",
        departments,
    )

    employees = [
        ("张三", 1, "技术总监", 50000, "2020-01-15", "zhangsan@company.com"),
        ("李四", 2, "市场总监", 45000, "2020-03-20", "lisi@company.com"),
        ("王五", 3, "销售总监", 48000, "2019-11-10", "wangwu@company.com"),
        ("赵六", 4, "HR 总监", 42000, "2020-06-01", "zhaoliu@company.com"),
        ("钱七", 5, "财务总监", 43000, "2020-02-28", "qianqi@company.com"),
        ("孙八", 1, "高级工程师", 35000, "2021-04-15", "sunba@company.com"),
        ("周九", 1, "工程师", 28000, "2022-07-20", "zhoujiu@company.com"),
        ("吴十", 2, "市场经理", 32000, "2021-09-01", "wushi@company.com"),
        ("郑十一", 3, "销售经理", 33000, "2021-03-15", "zheng11@company.com"),
        ("冯十二", 1, "前端工程师", 30000, "2022-01-10", "feng12@company.com"),
        ("陈十三", 1, "后端工程师", 32000, "2021-11-20", "chen13@company.com"),
        ("褚十四", 2, "市场专员", 22000, "2023-02-15", "chu14@company.com"),
        ("卫十五", 3, "销售代表", 25000, "2023-05-10", "wei15@company.com"),
        ("蒋十六", 4, "HR 经理", 30000, "2021-08-01", "jiang16@company.com"),
        ("沈十七", 5, "会计", 26000, "2022-04-15", "shen17@company.com"),
    ]
    cursor.executemany(
        "INSERT INTO employees (name, department_id, position, salary, hire_date, email) VALUES (?, ?, ?, ?, ?, ?)",
        employees,
    )

    projects = [
        ("智能客服系统", 1, "active", 800000, "2024-01-01", "2024-06-30"),
        ("数据中台建设", 1, "active", 1500000, "2024-02-01", "2024-12-31"),
        ("品牌升级项目", 2, "completed", 500000, "2023-06-01", "2024-03-31"),
        ("全国销售网络扩展", 3, "active", 2000000, "2024-01-15", "2025-01-15"),
        ("员工培训体系", 4, "planning", 300000, "2024-07-01", "2024-12-31"),
        ("财务系统升级", 5, "active", 600000, "2024-03-01", "2024-09-30"),
    ]
    cursor.executemany(
        "INSERT INTO projects (name, department_id, status, budget, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)",
        projects,
    )

    sales_data = [
        ("产品A", "华东", 150000, 50, "2024-01-15", "张三"),
        ("产品B", "华南", 230000, 80, "2024-01-20", "李四"),
        ("产品A", "华北", 180000, 60, "2024-02-10", "王五"),
        ("产品C", "华东", 320000, 100, "2024-02-15", "张三"),
        ("产品B", "西南", 120000, 40, "2024-03-01", "赵六"),
        ("产品A", "华南", 200000, 70, "2024-03-15", "李四"),
        ("产品C", "华北", 280000, 90, "2024-04-01", "王五"),
        ("产品B", "华东", 190000, 65, "2024-04-15", "张三"),
        ("产品A", "西南", 160000, 55, "2024-05-01", "赵六"),
        ("产品C", "华南", 350000, 110, "2024-05-15", "李四"),
        ("产品A", "华东", 170000, 58, "2024-06-01", "张三"),
        ("产品B", "华北", 210000, 72, "2024-06-15", "王五"),
    ]
    cursor.executemany(
        "INSERT INTO sales (product, region, amount, quantity, sale_date, salesperson) VALUES (?, ?, ?, ?, ?, ?)",
        sales_data,
    )

    performance_data = [
        (1, "2024-Q1", 4.5, "技术能力出色，领导力强"),
        (2, "2024-Q1", 4.2, "市场策略有效，团队管理好"),
        (3, "2024-Q1", 4.8, "销售业绩突出，客户关系好"),
        (6, "2024-Q1", 4.0, "技术扎实，需要提升沟通"),
        (7, "2024-Q1", 3.8, "进步明显，继续努力"),
        (8, "2024-Q1", 4.1, "市场洞察力强"),
        (9, "2024-Q1", 4.3, "销售技巧好，业绩稳定"),
        (10, "2024-Q1", 3.9, "前端技术好，需要学习后端"),
        (11, "2024-Q1", 4.4, "全栈能力强，代码质量高"),
    ]
    cursor.executemany(
        "INSERT INTO performance (employee_id, quarter, score, feedback) VALUES (?, ?, ?, ?)",
        performance_data,
    )

    conn.commit()
    conn.close()
    print(f"数据库已初始化: {DB_PATH}")


if __name__ == "__main__":
    init_database()

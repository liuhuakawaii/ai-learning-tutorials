# PDF 与文档处理

## 场景引入

你是一家公司的行政人员，需要为 50 位员工生成劳动合同。合同模板是一个 Word 文档，每个人的姓名、职位、薪资、入职日期不同。手动改 50 次模板再导出 PDF 是枯燥且容易出错的事。用 Python，你可以读取员工数据表，自动填充模板，批量生成所有合同。

## 学习目标

- 掌握 `PyPDF2` 的 PDF 合并、拆分、文本提取和水印功能
- 掌握 `python-docx` 创建和修改 Word 文档
- 理解模板填充的自动化思路
- 能编写从 Word 模板批量生成合同的脚本

## PyPDF2：PDF 操作

### 读取与提取文本

```python
from PyPDF2 import PdfReader

reader = PdfReader("report.pdf")
print(f"页数: {len(reader.pages)}")
text = reader.pages[0].extract_text()
print(text)
```

### 合并 PDF

```python
from PyPDF2 import PdfMerger

def merge_pdfs(pdf_list: list[str], output: str) -> None:
    merger = PdfMerger()
    for pdf in pdf_list:
        merger.append(pdf, outline_item=Path(pdf).stem)
    merger.write(output)
    merger.close()

merge_pdfs(["ch1.pdf", "ch2.pdf", "ch3.pdf"], "full.pdf")
```

### 拆分 PDF

```python
from PyPDF2 import PdfReader, PdfWriter

def split_to_pages(input_file: str, prefix: str = "page") -> None:
    reader = PdfReader(input_file)
    for i in range(len(reader.pages)):
        writer = PdfWriter()
        writer.add_page(reader.pages[i])
        with open(f"{prefix}_{i+1:03d}.pdf", "wb") as f:
            writer.write(f)
```

### 添加水印

```python
from PyPDF2 import PdfReader, PdfWriter

def add_watermark(input_file: str, watermark_file: str, output_file: str) -> None:
    reader = PdfReader(input_file)
    wm_page = PdfReader(watermark_file).pages[0]
    writer = PdfWriter()
    for page in reader.pages:
        page.merge_page(wm_page)
        writer.add_page(page)
    with open(output_file, "wb") as f:
        writer.write(f)
```

水印 PDF 通常是一页半透明文字，`merge_page` 将其叠加到每一页上。

### 创建水印（用 reportlab）

```python
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

def create_watermark(text: str, output: str) -> None:
    c = canvas.Canvas(output, pagesize=A4)
    c.setFont("Helvetica", 60)
    c.setFillAlpha(0.15)
    c.saveState()
    c.translate(A4[0] / 2, A4[1] / 2)
    c.rotate(45)
    c.drawCentredString(0, 0, text)
    c.restoreState()
    c.save()

create_watermark("CONFIDENTIAL", "watermark.pdf")
```

## python-docx：Word 文档操作

### 创建 Word 文档

```python
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()
doc.add_heading("项目报告", level=0)

p = doc.add_paragraph("普通文本。")
p.add_run("加粗文本。").bold = True
p.add_run("红色文本。").font.color.rgb = RGBColor(0xFF, 0, 0)

doc.add_paragraph("第一项", style="List Bullet")
doc.add_paragraph("第二项", style="List Bullet")

# 表格
table = doc.add_table(rows=3, cols=3, style="Table Grid")
headers = ["姓名", "职位", "薪资"]
for i, h in enumerate(headers):
    table.rows[0].cells[i].text = h
    table.rows[0].cells[i].paragraphs[0].runs[0].bold = True

doc.add_page_break()
doc.save("report.docx")
```

### 读取和修改 Word 文档

```python
from docx import Document

doc = Document("template.docx")

# 读取段落
for para in doc.paragraphs:
    print(para.text)

# 读取表格
for table in doc.tables:
    for row in table.rows:
        print([cell.text for cell in row.cells])

# 替换占位符（保留格式）
for para in doc.paragraphs:
    for run in para.runs:
        if "{{姓名}}" in run.text:
            run.text = run.text.replace("{{姓名}}", "张三")

doc.save("filled.docx")
```

**关键点**：直接赋值 `para.text` 会丢失所有格式，必须替换 `run.text`。

## 完整示例：从 Word 模板批量生成合同

```python
import csv
from pathlib import Path
from docx import Document
from docx.shared import Pt

TEMPLATE = "contract_template.docx"
EMPLOYEES = "employees.csv"
OUTPUT_DIR = Path("contracts")

def replace_in_paragraph(para, replacements: dict) -> None:
    for key, value in replacements.items():
        if key in para.text:
            for run in para.runs:
                if key in run.text:
                    run.text = run.text.replace(key, str(value))
                    run.font.name = "宋体"
                    run.font.size = Pt(12)

def replace_in_table(table, replacements: dict) -> None:
    for row in table.rows:
        for cell in row.cells:
            for para in cell.paragraphs:
                replace_in_paragraph(para, replacements)

def generate_contract(employee: dict, output_path: str) -> None:
    doc = Document(TEMPLATE)
    replacements = {
        "{{姓名}}": employee["姓名"],
        "{{职位}}": employee["职位"],
        "{{部门}}": employee["部门"],
        "{{薪资}}": employee["薪资"],
        "{{入职日期}}": employee["入职日期"],
    }
    for para in doc.paragraphs:
        replace_in_paragraph(para, replacements)
    for table in doc.tables:
        replace_in_table(table, replacements)
    doc.save(output_path)

def batch_generate() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    with open(EMPLOYEES, "r", encoding="utf-8") as f:
        employees = list(csv.DictReader(f))

    for emp in employees:
        name = emp["姓名"]
        output = OUTPUT_DIR / f"{name}_劳动合同.docx"
        generate_contract(emp, str(output))
        print(f"已生成: {output.name}")

    print(f"\n共生成 {len(employees)} 份合同")

if __name__ == "__main__":
    batch_generate()
```

员工数据 CSV 示例：

```csv
姓名,职位,部门,薪资,入职日期
张三,高级工程师,技术部,25000,2024年3月1日
李四,产品经理,产品部,22000,2024年3月15日
```

## 常见误区

### 1. PyPDF2 提取文本丢失格式

`extract_text()` 不保证文本顺序和格式，复杂布局的 PDF 提取结果可能混乱。精确提取考虑 `pdfplumber`。

### 2. python-docx 替换文本丢失格式

```python
# ❌ 直接赋值 paragraph.text 丢失所有格式
para.text = "新文本"
# ✅ 替换 run 中的文本
for run in para.runs:
    if "旧文本" in run.text:
        run.text = run.text.replace("旧文本", "新文本")
```

### 3. 忘记关闭 PdfMerger

```python
# ❌ 文件可能写入不完整
merger = PdfMerger()
merger.append("file.pdf")
merger.write("output.pdf")
# ✅ 用 with 语句
with PdfMerger() as merger:
    merger.append("file.pdf")
    merger.write("output.pdf")
```

## 工程建议

1. **PDF 合并拆分用 `PyPDF2`**：纯 Python，无需外部依赖
2. **Word 文档操作用 `python-docx`**：功能完善，支持样式控制
3. **精确 PDF 文本提取考虑 `pdfplumber`**：比 PyPDF2 更准确
4. **生成 PDF 推荐 `reportlab`**：从零创建 PDF 的首选
5. **批量处理前先测试单个文件**：确认模板替换正确后再批量

## 小结

本节学习了 `PyPDF2` 处理 PDF（合并、拆分、水印）和 `python-docx` 操作 Word 文档（创建、读取、模板替换）。两者结合可以实现文档自动化工作流，如批量生成合同、报告等。

## 练习

### 练习一：PDF 页面提取

编写脚本，从 PDF 中提取指定页码范围的页面，保存为新文件。支持命令行参数。

### 练习二：Word 批量转文本

编写脚本，将目录下所有 `.docx` 文件提取文本，生成同名 `.txt` 文件。

### 练习三：带水印的报告

创建脚本，接受 PDF 路径和水印文字，用 `reportlab` 生成水印页，再用 `PyPDF2` 合并。

---

## 参考答案

### 练习一

**思路**：用 `PdfReader` 读取，`PdfWriter` 写入指定页面。

**答案**：

```python
import sys
from PyPDF2 import PdfReader, PdfWriter

def extract_pages(input_file: str, start: int, end: int, output_file: str) -> None:
    reader = PdfReader(input_file)
    total = len(reader.pages)
    if start < 1 or end > total or start > end:
        print(f"错误：页码范围 1-{total}")
        return
    writer = PdfWriter()
    for i in range(start - 1, end):
        writer.add_page(reader.pages[i])
    with open(output_file, "wb") as f:
        writer.write(f)
    print(f"已提取第 {start}-{end} 页")

if __name__ == "__main__":
    extract_pages(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4])
```

**要点**：用户输入页码从 1 开始，内部转为 0 索引；做边界检查。

### 练习二

**思路**：遍历 `.docx` 文件，用 `python-docx` 提取段落文本。

**答案**：

```python
from pathlib import Path
from docx import Document

def convert_docx_to_txt(input_dir: str) -> None:
    source = Path(input_dir)
    dest = source / "txt_output"
    dest.mkdir(parents=True, exist_ok=True)

    for docx_file in source.glob("*.docx"):
        doc = Document(docx_file)
        text = "\n".join(para.text for para in doc.paragraphs)
        txt_file = dest / f"{docx_file.stem}.txt"
        txt_file.write_text(text, encoding="utf-8")
        print(f"已转换: {docx_file.name}")
```

**要点**：`doc.paragraphs` 获取所有段落；`stem` 获取不含扩展名的文件名。

### 练习三

**思路**：用 `reportlab` 在内存中生成水印页，再用 `PyPDF2` 叠加。

**答案**：

```python
import io
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

def add_watermark(input_file: str, text: str, output_file: str) -> None:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setFont("Helvetica", 50)
    c.setFillAlpha(0.15)
    c.saveState()
    c.translate(A4[0] / 2, A4[1] / 2)
    c.rotate(45)
    c.drawCentredString(0, 0, text)
    c.restoreState()
    c.save()
    buf.seek(0)

    wm_page = PdfReader(buf).pages[0]
    reader = PdfReader(input_file)
    writer = PdfWriter()
    for page in reader.pages:
        page.merge_page(wm_page)
        writer.add_page(page)
    with open(output_file, "wb") as f:
        writer.write(f)

add_watermark("report.pdf", "CONFIDENTIAL", "report_wm.pdf")
```

**要点**：`io.BytesIO` 在内存中创建临时 PDF；`setFillAlpha` 设置透明度。

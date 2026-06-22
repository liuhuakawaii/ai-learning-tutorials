"""PDF 报告生成 - 使用 reportlab 创建 PDF 文档"""

from pathlib import Path
from typing import Any

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


def _register_chinese_font() -> str:
    """尝试注册中文字体，返回可用字体名称"""
    # 常见中文字体路径
    font_paths = [
        ("SimSun", "C:/Windows/Fonts/simsun.ttc"),
        ("SimHei", "C:/Windows/Fonts/simhei.ttf"),
        ("Microsoft YaHei", "C:/Windows/Fonts/msyh.ttc"),
    ]
    for name, path in font_paths:
        if Path(path).exists():
            try:
                pdfmetrics.registerFont(TTFont(name, path))
                return name
            except Exception:
                continue
    return "Helvetica"


def create_pdf_report(
    data: list[dict[str, Any]] | dict[str, Any],
    output_path: str,
    title: str = "自动化报告",
    page_size: tuple = A4,
) -> str:
    """将数据生成 PDF 报告。

    Args:
        data: 数据源，支持字典列表或单层字典
        output_path: 输出文件路径
        title: 报告标题
        page_size: 页面尺寸

    Returns:
        输出文件的绝对路径
    """
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(output),
        pagesize=page_size,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    font_name = _register_chinese_font()
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ChineseTitle",
        parent=styles["Title"],
        fontName=font_name,
        fontSize=18,
        spaceAfter=12,
    )
    normal_style = ParagraphStyle(
        "ChineseNormal",
        parent=styles["Normal"],
        fontName=font_name,
        fontSize=10,
    )

    elements = []

    # 标题
    elements.append(Paragraph(title, title_style))
    elements.append(Spacer(1, 12 * mm))

    # 统一为列表格式
    rows = data if isinstance(data, list) else [data]

    if rows and isinstance(rows[0], dict):
        headers = list(rows[0].keys())
        table_data = [headers]
        for row in rows:
            table_data.append([str(row.get(h, "")) for h in headers])

        table = Table(table_data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4472C4")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, -1), font_name),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#D6E4F0")]),
        ]))
        elements.append(table)
    else:
        elements.append(Paragraph(str(data), normal_style))

    doc.build(elements)
    return str(output.resolve())

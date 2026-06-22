"""报表生成模块测试"""

import json
from pathlib import Path

import pytest

from toolbox.report.excel import create_excel_report
from toolbox.report.pdf import create_pdf_report
from toolbox.report.mailer import send_report_mail


class TestExcelReport:
    """Excel 报表测试"""

    def test_create_excel(self, tmp_dir):
        """生成 Excel 文件"""
        data = [
            {"姓名": "张三", "部门": "工程部", "绩效": 95},
            {"姓名": "李四", "部门": "产品部", "绩效": 88},
        ]
        output = str(tmp_dir / "report.xlsx")
        result = create_excel_report(data, output)
        assert Path(result).exists()

    def test_create_excel_empty(self, tmp_dir):
        """空数据也能生成文件"""
        data: list[dict] = []
        output = str(tmp_dir / "empty.xlsx")
        result = create_excel_report(data, output)
        assert Path(result).exists()

    def test_create_excel_dict(self, tmp_dir):
        """单层字典数据"""
        data = {"项目": "工具箱", "版本": "1.0"}
        output = str(tmp_dir / "single.xlsx")
        result = create_excel_report(data, output)
        assert Path(result).exists()


class TestPdfReport:
    """PDF 报告测试"""

    def test_create_pdf(self, tmp_dir):
        """生成 PDF 文件"""
        data = [
            {"指标": "CPU", "值": "25%", "状态": "正常"},
            {"指标": "内存", "值": "55%", "状态": "正常"},
        ]
        output = str(tmp_dir / "report.pdf")
        result = create_pdf_report(data, output, title="巡检报告")
        assert Path(result).exists()
        assert Path(result).stat().st_size > 0

    def test_create_pdf_dict(self, tmp_dir):
        """单层字典数据"""
        data = {"状态": "正常", "温度": "45°C"}
        output = str(tmp_dir / "single.pdf")
        result = create_pdf_report(data, output)
        assert Path(result).exists()


class TestMailer:
    """邮件发送测试"""

    @patch("toolbox.report.mailer.smtplib.SMTP")
    def test_send_mail(self, mock_smtp, tmp_dir):
        """发送带附件的邮件"""
        # 创建测试附件
        attachment = tmp_dir / "data.txt"
        attachment.write_text("报表数据", encoding="utf-8")

        mock_server = MagicMock()
        mock_smtp.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp.return_value.__exit__ = MagicMock(return_value=False)

        result = send_report_mail(
            to="test@example.com",
            subject="月度报表",
            body="请查收",
            attachments=[str(attachment)],
            config={"smtp_host": "localhost", "smtp_port": 25, "use_tls": False},
        )
        assert result["status"] == "成功"

    @patch("toolbox.report.mailer.smtplib.SMTP")
    def test_send_mail_failure(self, mock_smtp):
        """SMTP 连接失败"""
        mock_smtp.side_effect = ConnectionError("连接超时")

        result = send_report_mail(
            to="test@example.com",
            config={"smtp_host": "bad.host", "smtp_port": 25, "use_tls": False},
        )
        assert result["status"] == "失败"


# 需要导入 mock 以支持上面的测试
from unittest.mock import patch, MagicMock

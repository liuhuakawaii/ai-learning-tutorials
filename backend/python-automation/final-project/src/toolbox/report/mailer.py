"""邮件发送 - 发送带附件的报表邮件"""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path
from typing import Any


def send_report_mail(
    to: str,
    subject: str = "自动化报表",
    body: str = "",
    attachments: list[str] | None = None,
    config: dict | None = None,
) -> dict[str, Any]:
    """发送带附件的邮件。

    Args:
        to: 收件人邮箱地址
        subject: 邮件主题
        body: 邮件正文
        attachments: 附件文件路径列表
        config: SMTP 配置（smtp_host, smtp_port, use_tls, username, password）

    Returns:
        {"status": "成功"/"失败", "detail": 详情}
    """
    config = config or {}
    smtp_host = config.get("smtp_host", "smtp.example.com")
    smtp_port = config.get("smtp_port", 587)
    use_tls = config.get("use_tls", True)
    username = config.get("username")
    password = config.get("password")

    msg = MIMEMultipart()
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body or "请查收附件中的报表。", "plain", "utf-8"))

    # 添加附件
    for file_path in attachments or []:
        path = Path(file_path)
        if not path.exists():
            continue
        with open(path, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f"attachment; filename={path.name}")
        msg.attach(part)

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            if use_tls:
                server.starttls()
            if username and password:
                server.login(username, password)
            server.send_message(msg)
        return {"status": "成功", "detail": f"已发送至 {to}"}
    except Exception as e:
        return {"status": "失败", "detail": str(e)}

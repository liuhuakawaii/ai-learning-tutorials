"""通知发送器 - 支持邮件和 Webhook 两种通知渠道"""

import json
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

import requests


def send_notification(
    channel: str,
    message: str,
    to: str | None = None,
    subject: str = "工具箱通知",
    config: dict | None = None,
) -> dict[str, Any]:
    """发送通知消息。

    Args:
        channel: 通知渠道 - "email" / "webhook"
        message: 通知正文
        to: 收件人邮箱（email 渠道必须）
        subject: 邮件主题
        config: 通知配置

    Returns:
        {"status": "成功"/"失败", "channel": 渠道, "detail": 详情}
    """
    config = config or {}

    if channel == "email":
        return _send_email(to, subject, message, config.get("email", {}))
    elif channel == "webhook":
        return _send_webhook(message, config.get("webhook_url", ""))
    else:
        return {"status": "失败", "channel": channel, "detail": f"不支持的通知渠道: {channel}"}


def _send_email(to: str | None, subject: str, body: str, email_config: dict) -> dict[str, Any]:
    """通过 SMTP 发送邮件通知"""
    if not to:
        return {"status": "失败", "channel": "email", "detail": "缺少收件人地址"}

    smtp_host = email_config.get("smtp_host", "smtp.example.com")
    smtp_port = email_config.get("smtp_port", 587)
    use_tls = email_config.get("use_tls", True)

    msg = MIMEMultipart()
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain", "utf-8"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            if use_tls:
                server.starttls()
            # 实际使用时需登录
            # server.login(username, password)
            server.send_message(msg)
        return {"status": "成功", "channel": "email", "detail": f"已发送至 {to}"}
    except Exception as e:
        return {"status": "失败", "channel": "email", "detail": str(e)}


def _send_webhook(message: str, webhook_url: str) -> dict[str, Any]:
    """通过 Webhook 发送通知"""
    if not webhook_url:
        return {"status": "失败", "channel": "webhook", "detail": "未配置 webhook_url"}

    try:
        resp = requests.post(
            webhook_url,
            json={"text": message},
            timeout=10,
        )
        resp.raise_for_status()
        return {"status": "成功", "channel": "webhook", "detail": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"status": "失败", "channel": "webhook", "detail": str(e)}

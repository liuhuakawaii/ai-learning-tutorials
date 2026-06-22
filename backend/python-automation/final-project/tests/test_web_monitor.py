"""Web 监控模块测试"""

from unittest.mock import patch, MagicMock

import pytest

from toolbox.web_monitor.scraper import scrape_page
from toolbox.web_monitor.detector import detect_changes, clear_store
from toolbox.web_monitor.notifier import send_notification


class TestScraper:
    """网页抓取测试"""

    @patch("toolbox.web_monitor.scraper.requests.get")
    def test_scrape_basic(self, mock_get):
        """基本抓取功能"""
        mock_resp = MagicMock()
        mock_resp.text = "<html><head><title>测试页</title></head><body><p>内容</p></body></html>"
        mock_resp.status_code = 200
        mock_resp.apparent_encoding = "utf-8"
        mock_resp.encoding = "utf-8"
        mock_get.return_value = mock_resp

        result = scrape_page("https://example.com")
        assert result["title"] == "测试页"
        assert result["status_code"] == 200
        assert "hash" in result

    @patch("toolbox.web_monitor.scraper.requests.get")
    def test_scrape_with_selector(self, mock_get):
        """使用 CSS 选择器抓取"""
        mock_resp = MagicMock()
        mock_resp.text = "<html><body><h1>标题A</h1><h1>标题B</h1></body></html>"
        mock_resp.status_code = 200
        mock_resp.apparent_encoding = "utf-8"
        mock_resp.encoding = "utf-8"
        mock_get.return_value = mock_resp

        result = scrape_page("https://example.com", selector="h1")
        assert len(result["items"]) == 2
        assert "标题A" in result["items"]


class TestDetector:
    """变更检测测试"""

    def teardown_method(self):
        """每个测试后清空缓存"""
        clear_store()

    @patch("toolbox.web_monitor.detector.requests.get")
    def test_first_call_returns_false(self, mock_get):
        """首次调用返回 False（记录基准）"""
        mock_resp = MagicMock()
        mock_resp.text = "页面内容"
        mock_resp.raise_for_status = MagicMock()
        mock_resp.apparent_encoding = "utf-8"
        mock_resp.encoding = "utf-8"
        mock_get.return_value = mock_resp

        changed = detect_changes("https://example.com")
        assert changed is False

    @patch("toolbox.web_monitor.detector.requests.get")
    def test_change_detected(self, mock_get):
        """内容变化时返回 True"""
        mock_resp1 = MagicMock()
        mock_resp1.text = "原始内容"
        mock_resp1.raise_for_status = MagicMock()
        mock_resp1.apparent_encoding = "utf-8"
        mock_resp1.encoding = "utf-8"

        mock_resp2 = MagicMock()
        mock_resp2.text = "变更后内容"
        mock_resp2.raise_for_status = MagicMock()
        mock_resp2.apparent_encoding = "utf-8"
        mock_resp2.encoding = "utf-8"

        mock_get.side_effect = [mock_resp1, mock_resp2]

        detect_changes("https://example.com")
        changed = detect_changes("https://example.com")
        assert changed is True


class TestNotifier:
    """通知发送测试"""

    @patch("toolbox.web_monitor.notifier.smtplib.SMTP")
    def test_send_email(self, mock_smtp):
        """邮件发送成功"""
        mock_server = MagicMock()
        mock_smtp.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp.return_value.__exit__ = MagicMock(return_value=False)

        result = send_notification(
            "email",
            message="测试通知",
            to="test@example.com",
            config={"email": {"smtp_host": "localhost", "smtp_port": 25, "use_tls": False}},
        )
        assert result["status"] == "成功"

    def test_email_missing_to(self):
        """缺少收件人时发送失败"""
        result = send_notification("email", message="测试")
        assert result["status"] == "失败"

    @patch("toolbox.web_monitor.notifier.requests.post")
    def test_send_webhook(self, mock_post):
        """Webhook 发送成功"""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_post.return_value = mock_resp

        result = send_notification(
            "webhook",
            message="测试通知",
            config={"webhook_url": "https://hooks.example.com/test"},
        )
        assert result["status"] == "成功"

    def test_webhook_missing_url(self):
        """未配置 webhook URL 时发送失败"""
        result = send_notification("webhook", message="测试")
        assert result["status"] == "失败"

    def test_unsupported_channel(self):
        """不支持的通知渠道"""
        result = send_notification("sms", message="测试")
        assert result["status"] == "失败"

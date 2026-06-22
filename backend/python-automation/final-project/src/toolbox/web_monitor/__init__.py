"""Web 监控模块 - 网页抓取、变更检测、通知推送"""

from toolbox.web_monitor.scraper import scrape_page
from toolbox.web_monitor.detector import detect_changes
from toolbox.web_monitor.notifier import send_notification

__all__ = ["scrape_page", "detect_changes", "send_notification"]

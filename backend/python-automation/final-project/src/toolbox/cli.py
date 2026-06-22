"""CLI 入口 - 使用 click 构建命令行界面"""

import click

from toolbox.config import load_config
from toolbox.logger import setup_logger


@click.group()
@click.option("--config", "-c", default=None, help="配置文件路径")
@click.option("--verbose", "-v", is_flag=True, help="开启详细日志")
@click.pass_context
def main(ctx, config, verbose):
    """Python 自动化工具箱 - 文件处理、Web 监控、系统巡检、报表生成"""
    ctx.ensure_object(dict)
    ctx.obj["config"] = load_config(config)
    log_level = "DEBUG" if verbose else ctx.obj["config"].get("app", {}).get("log_level", "INFO")
    ctx.obj["logger"] = setup_logger(log_level)


# --------------- 文件操作子命令 ---------------
@main.group()
@click.pass_context
def file(ctx):
    """文件处理：批量重命名、分类整理、数据清洗"""


@file.command("rename")
@click.option("--dir", "-d", required=True, help="目标目录")
@click.option("--pattern", "-p", required=True, help="重命名模式，如 IMG_{n:04d}")
@click.option("--ext", default=None, help="仅处理指定扩展名")
@click.pass_context
def file_rename(ctx, dir, pattern, ext):
    """批量重命名文件"""
    from toolbox.file_ops.rename import batch_rename

    logger = ctx.obj["logger"]
    count = batch_rename(dir, pattern, ext_filter=ext)
    logger.info("共重命名 %d 个文件", count)
    click.echo(f"✅ 已重命名 {count} 个文件")


@file.command("organize")
@click.option("--dir", "-d", required=True, help="待整理目录")
@click.option("--by", type=click.Choice(["ext", "date", "size"]), default="ext", help="分类依据")
@click.pass_context
def file_organize(ctx, dir, by):
    """按规则整理文件到子目录"""
    from toolbox.file_ops.organize import organize_files

    logger = ctx.obj["logger"]
    result = organize_files(dir, group_by=by, config=ctx.obj["config"])
    logger.info("已整理 %d 个文件到 %d 个分组", result["total"], len(result["groups"]))
    click.echo(f"✅ 已整理 {result['total']} 个文件")


@file.command("clean")
@click.option("--dir", "-d", required=True, help="待清理目录")
@click.option("--older-than", type=int, default=30, help="清理 N 天前的文件")
@click.option("--dry-run", is_flag=True, help="仅预览，不实际删除")
@click.pass_context
def file_clean(ctx, dir, older_than, dry_run):
    """清理过期文件"""
    from toolbox.file_ops.cleaner import clean_old_files

    logger = ctx.obj["logger"]
    result = clean_old_files(dir, older_than_days=older_than, dry_run=dry_run)
    action = "将删除" if dry_run else "已删除"
    logger.info("%s %d 个过期文件（%d 天前）", action, result["count"], older_than)
    click.echo(f"✅ {action} {result['count']} 个文件，释放 {result['size_human']}")


# --------------- Web 监控子命令 ---------------
@main.group()
@click.pass_context
def web(ctx):
    """Web 监控：网页抓取、变更检测、通知推送"""


@web.command("scrape")
@click.option("--url", "-u", required=True, help="目标 URL")
@click.option("--selector", "-s", default=None, help="CSS 选择器")
@click.option("--output", "-o", default=None, help="输出文件路径")
@click.pass_context
def web_scrape(ctx, url, selector, output):
    """抓取网页内容"""
    from toolbox.web_monitor.scraper import scrape_page

    logger = ctx.obj["logger"]
    result = scrape_page(url, selector=selector, timeout=ctx.obj["config"].get("web_monitor", {}).get("timeout", 10))
    logger.info("成功抓取 %s，获取 %d 条数据", url, len(result["items"]))
    if output:
        import json
        with open(output, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        click.echo(f"✅ 结果已保存到 {output}")
    else:
        for item in result["items"]:
            click.echo(item)


@web.command("detect")
@click.option("--url", "-u", required=True, help="监控目标 URL")
@click.option("--interval", "-i", type=int, default=300, help="检测间隔（秒）")
@click.option("--selector", "-s", default=None, help="CSS 选择器")
@click.pass_context
def web_detect(ctx, url, interval, selector):
    """检测网页变更"""
    from toolbox.web_monitor.detector import detect_changes

    logger = ctx.obj["logger"]
    config = ctx.obj["config"].get("web_monitor", {})
    changed = detect_changes(url, selector=selector, interval=interval, config=config)
    if changed:
        logger.info("检测到 %s 发生变更", url)
        click.echo("⚠️ 检测到页面变更！")
    else:
        logger.info("%s 未发生变更", url)
        click.echo("✅ 页面无变化")


@web.command("notify")
@click.option("--channel", type=click.Choice(["email", "webhook"]), required=True, help="通知渠道")
@click.option("--to", default=None, help="收件人邮箱")
@click.option("--message", "-m", required=True, help="通知内容")
@click.option("--subject", default="工具箱通知", help="邮件主题")
@click.pass_context
def web_notify(ctx, channel, to, message, subject):
    """发送通知"""
    from toolbox.web_monitor.notifier import send_notification

    logger = ctx.obj["logger"]
    config = ctx.obj["config"].get("web_monitor", {}).get("notify", {})
    result = send_notification(channel, message=message, to=to, subject=subject, config=config)
    logger.info("通知已通过 %s 发送: %s", channel, result["status"])
    click.echo(f"✅ 通知发送{result['status']}")


# --------------- 系统巡检子命令 ---------------
@main.group()
@click.pass_context
def sys(ctx):
    """系统巡检：资源监控、进程检查、巡检报告"""


@sys.command("monitor")
@click.option("--interval", "-i", type=int, default=5, help="采集间隔（秒）")
@click.option("--count", "-n", type=int, default=10, help="采集次数")
@click.pass_context
def sys_monitor(ctx, interval, count):
    """实时监控系统资源"""
    from toolbox.sys_inspect.monitor import collect_metrics

    logger = ctx.obj["logger"]
    metrics = collect_metrics(interval=interval, count=count)
    logger.info("完成 %d 次系统指标采集", len(metrics))
    for m in metrics:
        click.echo(f"CPU: {m['cpu_percent']}%  内存: {m['memory_percent']}%  磁盘: {m['disk_percent']}%")


@sys.command("check")
@click.option("--disk", type=int, default=90, help="磁盘使用率阈值（%）")
@click.option("--memory", type=int, default=85, help="内存使用率阈值（%）")
@click.option("--cpu", type=int, default=80, help="CPU 使用率阈值（%）")
@click.pass_context
def sys_check(ctx, disk, memory, cpu):
    """检查系统资源是否超阈值"""
    from toolbox.sys_inspect.checker import check_thresholds

    logger = ctx.obj["logger"]
    alerts = check_thresholds(cpu_threshold=cpu, memory_threshold=memory, disk_threshold=disk)
    if alerts:
        for alert in alerts:
            logger.warning("告警: %s", alert["message"])
            click.echo(f"⚠️  {alert['message']}")
    else:
        logger.info("系统资源正常")
        click.echo("✅ 系统资源均在安全范围内")


@sys.command("report")
@click.option("--format", "-f", type=click.Choice(["text", "html", "json"]), default="text", help="报告格式")
@click.option("--output", "-o", default=None, help="输出文件路径")
@click.pass_context
def sys_report(ctx, format, output):
    """生成系统巡检报告"""
    from toolbox.sys_inspect.reporter import generate_report

    logger = ctx.obj["logger"]
    report = generate_report(output_format=format)
    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(report)
        logger.info("巡检报告已保存到 %s", output)
        click.echo(f"✅ 报告已保存到 {output}")
    else:
        click.echo(report)


# --------------- 报表生成子命令 ---------------
@main.group()
@click.pass_context
def report(ctx):
    """报表生成：Excel 报表、PDF 报告、邮件发送"""


@report.command("excel")
@click.option("--data", "-d", required=True, help="数据文件路径（JSON）")
@click.option("--output", "-o", required=True, help="输出 Excel 路径")
@click.option("--sheet", default="数据", help="工作表名称")
@click.pass_context
def report_excel(ctx, data, output, sheet):
    """生成 Excel 报表"""
    import json
    from toolbox.report.excel import create_excel_report

    logger = ctx.obj["logger"]
    with open(data, "r", encoding="utf-8") as f:
        dataset = json.load(f)
    create_excel_report(dataset, output, sheet_name=sheet)
    logger.info("Excel 报表已生成: %s", output)
    click.echo(f"✅ Excel 报表已保存到 {output}")


@report.command("pdf")
@click.option("--data", "-d", required=True, help="数据文件路径（JSON）")
@click.option("--output", "-o", required=True, help="输出 PDF 路径")
@click.option("--title", default="自动化报告", help="报告标题")
@click.pass_context
def report_pdf(ctx, data, output, title):
    """生成 PDF 报告"""
    import json
    from toolbox.report.pdf import create_pdf_report

    logger = ctx.obj["logger"]
    with open(data, "r", encoding="utf-8") as f:
        dataset = json.load(f)
    create_pdf_report(dataset, output, title=title)
    logger.info("PDF 报告已生成: %s", output)
    click.echo(f"✅ PDF 报告已保存到 {output}")


@report.command("mail")
@click.option("--to", required=True, help="收件人邮箱")
@click.option("--subject", default="自动化报表", help="邮件主题")
@click.option("--body", default="", help="邮件正文")
@click.option("--attach", multiple=True, help="附件路径（可多次指定）")
@click.pass_context
def report_mail(ctx, to, subject, body, attach):
    """通过邮件发送报表"""
    from toolbox.report.mailer import send_report_mail

    logger = ctx.obj["logger"]
    config = ctx.obj["config"].get("report", {}).get("mailer", {})
    result = send_report_mail(to, subject=subject, body=body, attachments=list(attach), config=config)
    logger.info("邮件已发送至 %s: %s", to, result["status"])
    click.echo(f"✅ 邮件发送{result['status']}")


if __name__ == "__main__":
    main()

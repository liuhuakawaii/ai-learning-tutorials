"""文件操作模块测试"""

import os
import time
from pathlib import Path

import pytest

from toolbox.file_ops.rename import batch_rename
from toolbox.file_ops.organize import organize_files
from toolbox.file_ops.cleaner import clean_old_files


class TestBatchRename:
    """批量重命名测试"""

    def test_basic_rename(self, tmp_dir):
        """基本重命名功能"""
        for i in range(3):
            (tmp_dir / f"old_{i}.txt").write_text(f"内容{i}", encoding="utf-8")

        count = batch_rename(str(tmp_dir), "new_{n:03d}")
        assert count == 3
        assert (tmp_dir / "new_001.txt").exists()
        assert (tmp_dir / "new_002.txt").exists()
        assert (tmp_dir / "new_003.txt").exists()

    def test_ext_filter(self, tmp_dir):
        """仅重命名指定扩展名"""
        (tmp_dir / "a.txt").write_text("文本", encoding="utf-8")
        (tmp_dir / "b.jpg").write_text("图片", encoding="utf-8")

        count = batch_rename(str(tmp_dir), "doc_{n}", ext_filter=".txt")
        assert count == 1
        assert (tmp_dir / "doc_1.txt").exists()
        assert (tmp_dir / "b.jpg").exists()  # 未被修改

    def test_empty_dir(self, tmp_dir):
        """空目录返回 0"""
        count = batch_rename(str(tmp_dir), "file_{n}")
        assert count == 0

    def test_nonexistent_dir(self):
        """目录不存在时抛出异常"""
        with pytest.raises(FileNotFoundError):
            batch_rename("/不存在的目录", "file_{n}")


class TestOrganizeFiles:
    """文件分类整理测试"""

    def test_organize_by_ext(self, tmp_dir, sample_files):
        """按扩展名分类"""
        result = organize_files(str(tmp_dir), group_by="ext")
        assert result["total"] == 5
        assert "documents" in result["groups"]
        assert "images" in result["groups"]
        assert "archives" in result["groups"]

    def test_organize_by_size(self, tmp_dir):
        """按文件大小分类"""
        small = tmp_dir / "small.txt"
        small.write_text("x" * 100, encoding="utf-8")

        result = organize_files(str(tmp_dir), group_by="size")
        assert result["total"] == 1
        assert "small" in result["groups"]

    def test_organize_nonexistent_dir(self):
        """目录不存在时抛出异常"""
        with pytest.raises(FileNotFoundError):
            organize_files("/不存在的目录")


class TestCleanOldFiles:
    """过期文件清理测试"""

    def test_clean_old_files(self, tmp_dir):
        """清理超期文件"""
        old_file = tmp_dir / "old.log"
        old_file.write_text("旧数据", encoding="utf-8")
        # 将修改时间设为 60 天前
        old_time = time.time() - 60 * 86400
        os.utime(str(old_file), (old_time, old_time))

        new_file = tmp_dir / "new.log"
        new_file.write_text("新数据", encoding="utf-8")

        result = clean_old_files(str(tmp_dir), older_than_days=30)
        assert result["count"] == 1
        assert not old_file.exists()
        assert new_file.exists()

    def test_dry_run(self, tmp_dir):
        """预览模式不删除文件"""
        old_file = tmp_dir / "old.log"
        old_file.write_text("旧数据", encoding="utf-8")
        old_time = time.time() - 60 * 86400
        os.utime(str(old_file), (old_time, old_time))

        result = clean_old_files(str(tmp_dir), older_than_days=30, dry_run=True)
        assert result["count"] == 1
        assert old_file.exists()  # 文件仍在

    def test_nonexistent_dir(self):
        """目录不存在时抛出异常"""
        with pytest.raises(FileNotFoundError):
            clean_old_files("/不存在的目录")

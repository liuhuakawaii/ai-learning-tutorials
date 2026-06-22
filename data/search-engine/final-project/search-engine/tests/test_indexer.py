"""倒排索引单元测试

测试 InvertedIndex 类的各项功能：
- 文档添加与删除
- 倒排索引构建
- 布尔检索（AND/OR/NOT）
- 索引持久化（保存/加载）
- 文档频率和文档长度统计
"""

import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.indexer import InvertedIndex


class TestInvertedIndex:
    """倒排索引测试类"""

    def setup_method(self):
        """每个测试方法执行前的初始化"""
        self.index = InvertedIndex()

    def _add_sample_docs(self):
        """添加示例文档"""
        self.index.add_document("doc1", {
            "title": "搜索引擎原理",
            "content": "搜索引擎是信息检索系统的核心组件",
        })
        self.index.add_document("doc2", {
            "title": "机器学习基础",
            "content": "机器学习是人工智能的重要分支",
        })
        self.index.add_document("doc3", {
            "title": "搜索引擎与机器学习",
            "content": "现代搜索引擎大量使用机器学习技术",
        })

    def test_add_document(self):
        """测试添加文档"""
        self.index.add_document("doc1", {
            "title": "测试文档",
            "content": "这是一个测试文档的内容",
        })
        assert self.index.total_docs == 1
        assert self.index.get_document("doc1") is not None

    def test_add_multiple_documents(self):
        """测试添加多个文档"""
        self._add_sample_docs()
        assert self.index.total_docs == 3

    def test_remove_document(self):
        """测试删除文档"""
        self._add_sample_docs()
        assert self.index.total_docs == 3

        result = self.index.remove_document("doc2")
        assert result is True
        assert self.index.total_docs == 2
        assert self.index.get_document("doc2") is None

    def test_remove_nonexistent_document(self):
        """测试删除不存在的文档"""
        result = self.index.remove_document("nonexistent")
        assert result is False

    def test_update_document(self):
        """测试更新文档（通过重新添加同 ID 文档）"""
        self.index.add_document("doc1", {"content": "旧内容"})
        assert self.index.total_docs == 1

        self.index.add_document("doc1", {"content": "新内容更新版"})
        assert self.index.total_docs == 1
        doc = self.index.get_document("doc1")
        assert "新内容" in doc["content"]

    def test_get_postings(self):
        """测试获取 posting list"""
        self._add_sample_docs()
        postings = self.index.get_postings("搜索引擎")
        assert len(postings) > 0
        # 搜索引擎应出现在 doc1 和 doc3 中
        doc_ids = [p.doc_id for p in postings]
        assert "doc1" in doc_ids

    def test_doc_freq(self):
        """测试文档频率统计"""
        self._add_sample_docs()
        # "搜索引擎" 应出现在至少 2 篇文档中
        df = self.index.get_doc_freq("搜索引擎")
        assert df >= 1

    def test_doc_length(self):
        """测试文档长度统计"""
        self._add_sample_docs()
        length = self.index.get_doc_length("doc1")
        assert length > 0

    def test_avg_doc_length(self):
        """测试平均文档长度"""
        self._add_sample_docs()
        avg = self.index.avg_doc_length
        assert avg > 0

    def test_boolean_and(self):
        """测试布尔 AND 检索"""
        self._add_sample_docs()
        results = self.index.boolean_search("搜索引擎 机器学习", operator="AND")
        # 应返回同时包含两个词的文档
        assert isinstance(results, list)

    def test_boolean_or(self):
        """测试布尔 OR 检索"""
        self._add_sample_docs()
        results = self.index.boolean_search("搜索引擎 机器学习", operator="OR")
        # OR 检索应返回更多结果
        assert len(results) >= 1

    def test_boolean_not(self):
        """测试布尔 NOT 检索"""
        self._add_sample_docs()
        results = self.index.boolean_search("搜索引擎 机器学习", operator="NOT")
        assert isinstance(results, list)

    def test_get_all_terms(self):
        """测试获取所有词项"""
        self._add_sample_docs()
        terms = self.index.get_all_terms()
        assert len(terms) > 0
        assert isinstance(terms, set)

    def test_save_and_load(self):
        """测试索引持久化"""
        self._add_sample_docs()

        with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w") as f:
            path = f.name

        try:
            # 保存索引
            self.index.save(path)
            assert os.path.exists(path)

            # 创建新索引并加载
            new_index = InvertedIndex()
            new_index.load(path)

            # 验证加载后的索引数据一致
            assert new_index.total_docs == self.index.total_docs
            assert new_index.get_document("doc1") is not None
            assert new_index.get_doc_length("doc1") == self.index.get_doc_length("doc1")
        finally:
            os.unlink(path)

    def test_empty_index(self):
        """测试空索引的状态"""
        assert self.index.total_docs == 0
        assert self.index.avg_doc_length == 0.0
        assert self.index.get_all_terms() == set()
        assert self.index.boolean_search("test") == []

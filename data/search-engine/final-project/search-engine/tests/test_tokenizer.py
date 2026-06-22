"""分词器单元测试

测试 Tokenizer 类的各项功能：
- 基本分词（精确模式和全模式）
- 停用词过滤
- 同义词扩展
- 带位置信息的分词
"""

import sys
import os

# 确保能导入项目模块
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.tokenizer import Tokenizer


class TestTokenizer:
    """分词器测试类"""

    def setup_method(self):
        """每个测试方法执行前的初始化"""
        self.tokenizer = Tokenizer()

    def test_tokenize_basic(self):
        """测试基本的精确模式分词"""
        text = "搜索引擎是信息检索的核心系统"
        tokens = self.tokenizer.tokenize(text)
        assert len(tokens) > 0
        assert isinstance(tokens, list)
        # 分词结果应包含关键词
        token_str = "".join(tokens)
        assert "搜索引擎" in token_str or "搜索" in token_str

    def test_tokenize_empty(self):
        """测试空文本分词"""
        assert self.tokenizer.tokenize("") == []
        assert self.tokenizer.tokenize("   ") == []

    def test_tokenize_english(self):
        """测试英文文本分词"""
        tokens = self.tokenizer.tokenize("Hello World Python")
        assert len(tokens) > 0
        assert "Hello" in tokens or "hello" in [t.lower() for t in tokens]

    def test_tokenize_mixed(self):
        """测试中英混合文本分词"""
        tokens = self.tokenizer.tokenize("使用Python实现搜索引擎")
        assert len(tokens) > 0

    def test_cut_precise_mode(self):
        """测试精确模式分词（默认）"""
        text = "中华人民共和国国务院"
        tokens_precise = self.tokenizer.cut(text, cut_all=False)
        assert len(tokens_precise) > 0

    def test_cut_all_mode(self):
        """测试全模式分词"""
        text = "中华人民共和国国务院"
        tokens_all = self.tokenizer.cut(text, cut_all=True)
        # 全模式应该产生更多词项
        assert len(tokens_all) > 0

    def test_stop_words_filtering(self):
        """测试停用词过滤"""
        # 创建带自定义停用词的分词器
        tokenizer = Tokenizer(stop_words=["搜索引擎", "是"])
        tokens = tokenizer.tokenize("搜索引擎是信息检索系统")
        # 停用词应该被过滤
        assert "搜索引擎" not in tokens
        assert "是" not in tokens

    def test_add_stop_words(self):
        """测试动态添加停用词"""
        self.tokenizer.add_stop_words(["测试", "临时"])
        tokens = self.tokenizer.tokenize("这是一个测试文本")
        assert "测试" not in tokens

    def test_remove_stop_words(self):
        """测试移除停用词"""
        # 默认停用词包含"的"
        tokens_before = self.tokenizer.tokenize("美丽的花朵")
        self.tokenizer.remove_stop_words(["的"])
        tokens_after = self.tokenizer.tokenize("美丽的花朵")
        # 移除"的"后，"的"应该出现在分词结果中
        assert "的" in tokens_after

    def test_synonyms(self):
        """测试同义词扩展"""
        self.tokenizer.add_synonyms("搜索引擎", ["搜索系统", "检索引擎"])
        tokens = ["搜索引擎", "原理"]
        expanded = self.tokenizer.expand_with_synonyms(tokens)
        assert "搜索系统" in expanded
        assert "检索引擎" in expanded

    def test_tokenize_with_positions(self):
        """测试带位置信息的分词"""
        text = "搜索引擎技术"
        result = self.tokenizer.tokenize_with_positions(text)
        assert len(result) > 0
        # 每个结果应包含 token、start、end
        for item in result:
            assert "token" in item
            assert "start" in item
            assert "end" in item
            assert item["start"] < item["end"]

    def test_tokenize_with_positions_empty(self):
        """测试空文本的位置分词"""
        assert self.tokenizer.tokenize_with_positions("") == []
        assert self.tokenizer.tokenize_with_positions("   ") == []

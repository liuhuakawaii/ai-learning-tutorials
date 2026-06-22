"""中文分词器模块

基于 jieba 实现中文分词，支持：
- 精确模式分词（适合搜索引擎索引）
- 搜索引擎模式分词（适合搜索召回）
- 自定义词典加载
- 停用词过滤
- 同义词扩展
"""

from typing import Dict, List, Optional, Set

import jieba

from config.settings import settings


class Tokenizer:
    """中文分词器

    封装 jieba 分词能力，提供搜索引擎所需的分词功能。
    支持自定义词典、停用词过滤、同义词扩展。

    用法示例：
        tokenizer = Tokenizer()
        tokens = tokenizer.tokenize("搜索引擎是信息检索的核心系统")
        # ["搜索引擎", "信息检索", "核心", "系统"]

        tokens = tokenizer.cut("搜索引擎是信息检索的核心系统", cut_all=True)
        # ["搜索引擎", "搜索", "引擎", "信息", "检索", "核心", "系统"]
    """

    def __init__(
        self,
        dict_path: Optional[str] = None,
        user_dict_path: Optional[str] = None,
        stop_words: Optional[List[str]] = None,
    ):
        """初始化分词器

        Args:
            dict_path: jieba 词典路径，为空则使用默认词典
            user_dict_path: 自定义用户词典路径
            stop_words: 停用词列表，为空则使用默认停用词
        """
        self._stop_words: Set[str] = set(
            stop_words or settings.tokenizer.stop_words
        )
        self._synonyms: Dict[str, List[str]] = {}

        # 加载自定义词典
        if dict_path:
            jieba.set_dictionary(dict_path)
        if user_dict_path:
            jieba.load_userdict(user_dict_path)

    def tokenize(self, text: str) -> List[str]:
        """精确模式分词（默认用于索引和搜索）

        使用 jieba 的精确模式对文本进行分词，适合搜索引擎索引构建。
        分词后过滤停用词，返回有效词项列表。

        Args:
            text: 待分词的文本

        Returns:
            过滤停用词后的词项列表
        """
        if not text or not text.strip():
            return []

        words = jieba.lcut(text.strip())
        return [
            word.strip()
            for word in words
            if word.strip() and word.strip() not in self._stop_words
        ]

    def cut(self, text: str, cut_all: bool = False) -> List[str]:
        """通用分词接口

        支持精确模式和全模式两种分词策略：
        - 精确模式（cut_all=False）：最精确的切分，适合索引
        - 全模式（cut_all=True）：把所有可能的词都扫描出来，适合搜索召回

        Args:
            text: 待分词的文本
            cut_all: 是否使用全模式，默认 False（精确模式）

        Returns:
            分词结果列表
        """
        if not text or not text.strip():
            return []

        if cut_all:
            words = jieba.lcut(text.strip(), cut_all=True)
        else:
            words = jieba.lcut(text.strip())

        return [
            word.strip()
            for word in words
            if word.strip() and word.strip() not in self._stop_words
        ]

    def add_stop_words(self, words: List[str]) -> None:
        """动态添加停用词

        Args:
            words: 要添加的停用词列表
        """
        self._stop_words.update(words)

    def remove_stop_words(self, words: List[str]) -> None:
        """移除停用词

        Args:
            words: 要从停用词表中移除的词列表
        """
        for word in words:
            self._stop_words.discard(word)

    def add_synonyms(self, word: str, synonyms: List[str]) -> None:
        """添加同义词映射

        在搜索召回阶段，可以利用同义词扩展查询，提高召回率。

        Args:
            word: 原始词
            synonyms: 同义词列表
        """
        self._synonyms[word] = synonyms

    def expand_with_synonyms(self, tokens: List[str]) -> List[str]:
        """使用同义词扩展词项列表

        Args:
            tokens: 原始词项列表

        Returns:
            包含同义词的扩展词项列表
        """
        expanded = list(tokens)
        for token in tokens:
            if token in self._synonyms:
                expanded.extend(self._synonyms[token])
        return expanded

    def tokenize_with_positions(self, text: str) -> List[Dict]:
        """带位置信息的分词

        返回每个词项的文本和在原文中的起止位置，适合搜索高亮等场景。

        Args:
            text: 待分词的文本

        Returns:
            包含词项和位置信息的字典列表
        """
        if not text or not text.strip():
            return []

        result = []
        for word in jieba.tokenize(text.strip()):
            token = word[0].strip()
            if token and token not in self._stop_words:
                result.append({
                    "token": token,
                    "start": word[1],
                    "end": word[2],
                })
        return result

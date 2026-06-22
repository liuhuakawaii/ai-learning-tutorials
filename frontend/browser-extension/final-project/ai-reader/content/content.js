// AI 阅读助手 - Content Script
// 负责：页面内容提取、划词翻译弹窗、阅读模式、阅读统计
// 运行在网页的隔离上下文中，可访问 DOM 但与网页脚本互相隔离

(function () {
  'use strict';

  // ========== 阅读统计 ==========
  let startTime = Date.now();
  let isReaderModeActive = false;
  let currentFontSize = 16;

  // 计算页面字数（中文按字符计，英文按空格分词计）
  function countWords(text) {
    const cleanText = text.replace(/\s+/g, ' ').trim();
    // 中文字符数
    const chineseChars = (cleanText.match(/[\u4e00-\u9fff]/g) || []).length;
    // 英文单词数
    const englishWords = cleanText.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(w => w.length > 0).length;
    return chineseChars + englishWords;
  }

  // 估算阅读时间（中文 400 字/分钟，英文 200 词/分钟）
  function estimateReadingTime(wordCount) {
    const minutes = Math.ceil(wordCount / 350);
    if (minutes < 1) return '不到 1 分钟';
    return `约 ${minutes} 分钟`;
  }

  // ========== Readability 内容提取 ==========
  // 简化版 Readability 提取逻辑（生产环境应引入 @mozilla/readability 库）
  function extractArticleContent() {
    // 优先尝试常见的文章容器选择器
    const selectors = [
      'article',
      '[role="main"]',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      '#content',
      'main'
    ];

    let articleEl = null;
    for (const selector of selectors) {
      articleEl = document.querySelector(selector);
      if (articleEl && articleEl.textContent.trim().length > 200) break;
      articleEl = null;
    }

    // 兜底：使用 body
    if (!articleEl) {
      articleEl = document.body;
    }

    // 移除不需要的元素
    const clone = articleEl.cloneNode(true);
    const removeSelectors = 'script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar, .comment';
    clone.querySelectorAll(removeSelectors).forEach(el => el.remove());

    const text = clone.textContent.replace(/\s+/g, ' ').trim();
    const title = document.title;

    return { title, text, wordCount: countWords(text) };
  }

  // ========== 划词翻译功能 ==========
  let translationPopup = null;

  function createTranslationPopup() {
    if (translationPopup) return;

    translationPopup = document.createElement('div');
    translationPopup.id = 'ai-reader-translate-popup';
    translationPopup.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      max-width: 360px;
      font-size: 14px;
      line-height: 1.6;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    document.body.appendChild(translationPopup);
  }

  function showTranslationPopup(text, x, y) {
    createTranslationPopup();
    translationPopup.innerHTML = `
      <div style="margin-bottom:6px;font-size:12px;color:#999;">翻译中...</div>
      <div style="font-size:13px;">${text}</div>
    `;
    translationPopup.style.display = 'block';

    // 定位：优先在选中文本下方，空间不够则放上方
    const rect = translationPopup.getBoundingClientRect();
    let left = x;
    let top = y + 10;

    if (left + rect.width > window.innerWidth - 10) {
      left = window.innerWidth - rect.width - 10;
    }
    if (top + rect.height > window.innerHeight - 10) {
      top = y - rect.height - 10;
    }

    translationPopup.style.left = `${Math.max(10, left)}px`;
    translationPopup.style.top = `${Math.max(10, top)}px`;

    // 发送翻译请求到 background
    chrome.runtime.sendMessage({
      action: 'translate',
      text,
      targetLang: 'zh'
    }, (result) => {
      if (result && !result.error) {
        translationPopup.innerHTML = `
          <div style="margin-bottom:6px;font-size:12px;color:#999;">原文</div>
          <div style="margin-bottom:8px;font-size:13px;color:#555;">${text}</div>
          <div style="margin-bottom:6px;font-size:12px;color:#999;">译文</div>
          <div style="font-size:14px;font-weight:500;">${result.translation}</div>
        `;
      } else {
        translationPopup.innerHTML = `
          <div style="color:#e53935;font-size:13px;">翻译失败：${result?.error || '请检查 API 设置'}</div>
        `;
      }
    });
  }

  function hideTranslationPopup() {
    if (translationPopup) {
      translationPopup.style.display = 'none';
    }
  }

  // 监听鼠标松开事件，检测选中文本
  document.addEventListener('mouseup', (e) => {
    // 忽略翻译弹窗自身的点击
    if (translationPopup && translationPopup.contains(e.target)) return;

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText.length > 0 && selectedText.length < 1000) {
      // 获取选中文本的位置
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      showTranslationPopup(selectedText, rect.left, rect.bottom);
    } else {
      hideTranslationPopup();
    }
  });

  // 点击页面其他区域关闭弹窗
  document.addEventListener('mousedown', (e) => {
    if (translationPopup && !translationPopup.contains(e.target)) {
      hideTranslationPopup();
    }
  });

  // ========== 阅读模式 ==========
  let readerModeOverlay = null;
  let originalBodyHTML = '';

  function enterReaderMode() {
    if (isReaderModeActive) return;

    const { title, text } = extractArticleContent();
    originalBodyHTML = document.body.innerHTML;

    // 将正文按段落分割
    const paragraphs = text.split(/[。！？\n]+/).filter(p => p.trim().length > 10);

    readerModeOverlay = document.createElement('div');
    readerModeOverlay.id = 'ai-reader-mode-overlay';
    readerModeOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2147483646;
      background: #faf8f5;
      overflow-y: auto;
      padding: 40px 20px;
    `;

    readerModeOverlay.innerHTML = `
      <div style="max-width:680px;margin:0 auto;font-family:Georgia,'Noto Serif SC',serif;">
        <div style="text-align:right;margin-bottom:20px;">
          <button id="ai-reader-exit" style="
            background:#f0f0f0;border:none;padding:8px 16px;border-radius:6px;
            cursor:pointer;font-size:13px;color:#666;
          ">退出阅读模式</button>
        </div>
        <h1 style="font-size:28px;line-height:1.4;margin-bottom:24px;color:#222;">${title}</h1>
        <div id="ai-reader-content" style="font-size:${currentFontSize}px;line-height:1.8;color:#333;">
          ${paragraphs.map(p => `<p style="margin-bottom:16px;text-indent:2em;">${p.trim()}</p>`).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(readerModeOverlay);
    document.body.style.overflow = 'hidden';

    // 退出按钮事件
    document.getElementById('ai-reader-exit').addEventListener('click', exitReaderMode);

    isReaderModeActive = true;
  }

  function exitReaderMode() {
    if (!isReaderModeActive) return;
    readerModeOverlay.remove();
    document.body.style.overflow = '';
    isReaderModeActive = false;
  }

  function changeFontSize() {
    currentFontSize = currentFontSize >= 24 ? 14 : currentFontSize + 2;
    const contentEl = document.getElementById('ai-reader-content');
    if (contentEl) {
      contentEl.style.fontSize = `${currentFontSize}px`;
    }
  }

  // ========== 消息监听 ==========
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'extractContent': {
        const content = extractArticleContent();
        sendResponse(content);
        break;
      }

      case 'toggleReaderMode': {
        if (isReaderModeActive) {
          exitReaderMode();
        } else {
          enterReaderMode();
        }
        sendResponse({ success: true });
        break;
      }

      case 'changeFontSize': {
        changeFontSize();
        sendResponse({ success: true });
        break;
      }

      case 'getReadingStats': {
        const content = extractArticleContent();
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        sendResponse({
          readingTime: minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`,
          wordCount: content.wordCount
        });
        break;
      }
    }
    // 返回 true 表示异步 sendResponse
    return true;
  });

  // ========== 初始化 ==========
  console.log('[AI 阅读助手] Content script 已加载');
})();

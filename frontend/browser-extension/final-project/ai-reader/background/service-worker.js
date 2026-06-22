// AI 阅读助手 - Background Service Worker
// 负责：LLM API 调用、笔记存储、右键菜单、扩展生命周期管理
// 注意：Service Worker 空闲时会被终止，不能依赖全局变量存储状态

// ========== 安装和更新事件 ==========
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 首次安装：初始化默认设置
    chrome.storage.local.set({
      apiEndpoint: 'https://api.openai.com/v1',
      notes: [],
      readingHistory: []
    });
    console.log('[AI 阅读助手] 扩展已安装');
  }

  // 创建右键菜单
  createContextMenus();
});

// ========== 右键菜单 ==========
function createContextMenus() {
  chrome.contextMenus.create({
    id: 'ai-reader-translate',
    title: 'AI 翻译：%s',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'ai-reader-summarize',
    title: 'AI 摘要：当前页面',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'ai-reader-save-note',
    title: '保存选中文本为笔记',
    contexts: ['selection']
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'ai-reader-translate':
      // 翻译选中文本
      const translateResult = await callLLMTranslate(info.selectionText, 'zh');
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'AI 翻译',
        message: translateResult.translation || translateResult.error
      });
      break;

    case 'ai-reader-summarize':
      // 发送消息给 content script 提取内容，然后生成摘要
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
        if (response && response.text) {
          const summary = await callLLMSummarize(response.text, response.title, 'brief');
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'AI 摘要',
            message: summary.summary || summary.error
          });
        }
      } catch {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'AI 摘要',
          message: '无法提取页面内容，请刷新页面后重试'
        });
      }
      break;

    case 'ai-reader-save-note':
      await saveNote({
        id: Date.now().toString(),
        text: info.selectionText,
        url: tab.url,
        title: tab.title,
        createdAt: new Date().toISOString()
      });
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '笔记已保存',
        message: info.selectionText.substring(0, 50) + (info.selectionText.length > 50 ? '...' : '')
      });
      break;
  }
});

// ========== 消息处理 ==========
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 使用 async 处理函数包装，确保异步操作正确返回
  handleMessage(message, sender).then(sendResponse).catch(err => {
    sendResponse({ error: err.message });
  });
  // 返回 true 表示异步发送响应
  return true;
});

async function handleMessage(message, sender) {
  switch (message.action) {
    case 'summarize':
      return callLLMSummarize(message.text, message.title, message.style);

    case 'translate':
      return callLLMTranslate(message.text, message.targetLang);

    case 'saveNote':
      return saveNote(message.note);

    case 'getNotes':
      return getNotes(message.url);

    case 'deleteNote':
      return deleteNote(message.id);

    default:
      return { error: `未知操作: ${message.action}` };
  }
}

// ========== LLM API 调用 ==========
async function getAPISettings() {
  const { apiKey, apiEndpoint } = await chrome.storage.local.get(['apiKey', 'apiEndpoint']);
  if (!apiKey) {
    throw new Error('请先在设置中配置 API Key');
  }
  return { apiKey, apiEndpoint: apiEndpoint || 'https://api.openai.com/v1' };
}

async function callLLM(messages) {
  const { apiKey, apiEndpoint } = await getAPISettings();

  const response = await fetch(`${apiEndpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.3,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API 请求失败 (${response.status})`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callLLMSummarize(text, title, style) {
  // 截取前 3000 字避免 token 超限
  const truncatedText = text.substring(0, 3000);

  const stylePrompts = {
    brief: '用 2-3 句话概括文章核心内容，简洁精炼。',
    detailed: '用详细的段落概括文章的主要内容，包含关键细节。',
    bullets: '提取文章的 5-8 个关键要点，每条用一句话概括，以列表形式输出。'
  };

  const prompt = stylePrompts[style] || stylePrompts.brief;

  const messages = [
    {
      role: 'system',
      content: '你是一个专业的文章摘要助手。请根据用户要求生成高质量的中文摘要。'
    },
    {
      role: 'user',
      content: `文章标题：${title}\n\n文章正文：\n${truncatedText}\\n\n请${prompt}`
    }
  ];

  const summary = await callLLM(messages);
  return { summary };
}

async function callLLMTranslate(text, targetLang) {
  const langNames = { zh: '中文', en: '英文', ja: '日文', ko: '韩文' };
  const targetName = langNames[targetLang] || '中文';

  const messages = [
    {
      role: 'system',
      content: `你是一个专业的翻译助手。请将用户输入的文本翻译成${targetName}。只输出翻译结果，不要添加解释。`
    },
    {
      role: 'user',
      content: text
    }
  ];

  const translation = await callLLM(messages);
  return { translation };
}

// ========== 笔记存储 ==========
async function saveNote(note) {
  const { notes = [] } = await chrome.storage.local.get('notes');
  notes.unshift(note);
  // 限制最多保存 500 条笔记
  if (notes.length > 500) notes.length = 500;
  await chrome.storage.local.set({ notes });
  return { success: true };
}

async function getNotes(url) {
  const { notes = [] } = await chrome.storage.local.get('notes');
  // 如果提供了 URL，只返回该页面的笔记
  if (url) {
    const pageNotes = notes.filter(note => note.url === url);
    return { notes: pageNotes };
  }
  return { notes };
}

async function deleteNote(id) {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const filtered = notes.filter(note => note.id !== id);
  await chrome.storage.local.set({ notes: filtered });
  return { success: true };
}

console.log('[AI 阅读助手] Service Worker 已启动');

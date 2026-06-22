// AI 阅读助手 - Popup 主逻辑
// 负责：标签页切换、摘要生成、翻译、笔记管理、阅读模式

// ========== DOM 元素引用 ==========
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const btnSummarize = document.getElementById('btn-summarize');
const summaryStyle = document.getElementById('summary-style');
const summaryResult = document.getElementById('summary-result');
const targetLang = document.getElementById('target-lang');
const translateResult = document.getElementById('translate-result');
const noteInput = document.getElementById('note-input');
const btnAddNote = document.getElementById('btn-add-note');
const notesList = document.getElementById('notes-list');
const btnReaderMode = document.getElementById('btn-reader-mode');
const btnFontSize = document.getElementById('btn-font-size');
const readingTime = document.getElementById('reading-time');
const wordCount = document.getElementById('word-count');
const btnSettings = document.getElementById('btn-settings');
const settingsPanel = document.getElementById('settings-panel');
const apiKeyInput = document.getElementById('api-key');
const apiEndpointInput = document.getElementById('api-endpoint');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnCancelSettings = document.getElementById('btn-cancel-settings');

// ========== 标签页切换 ==========
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${target}`).classList.add('active');
  });
});

// ========== 消息通信工具函数 ==========
// 向当前标签页的 content script 发送消息
async function sendToContent(action, data = {}) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error('无法获取当前标签页');
  try {
    return await chrome.tabs.sendMessage(tab.id, { action, ...data });
  } catch {
    throw new Error('无法连接到页面，请刷新页面后重试');
  }
}

// 向 background service worker 发送消息
async function sendToBackground(action, data = {}) {
  return chrome.runtime.sendMessage({ action, ...data });
}

// ========== AI 摘要功能 ==========
btnSummarize.addEventListener('click', async () => {
  const style = summaryStyle.value;
  summaryResult.innerHTML = '<div class="loading">正在生成摘要</div>';
  btnSummarize.disabled = true;

  try {
    // 1. 让 content script 提取页面内容
    const extractResult = await sendToContent('extractContent');
    if (!extractResult || !extractResult.text) {
      throw new Error('无法提取页面内容');
    }

    // 2. 发送给 background 调用 LLM API 生成摘要
    const result = await sendToBackground('summarize', {
      text: extractResult.text,
      title: extractResult.title,
      style
    });

    if (result.error) {
      throw new Error(result.error);
    }

    // 3. 渲染摘要结果
    renderSummary(result.summary, style);
  } catch (err) {
    summaryResult.innerHTML = `<div class="error">${err.message}</div>`;
  } finally {
    btnSummarize.disabled = false;
  }
});

function renderSummary(text, style) {
  if (style === 'bullets') {
    const items = text.split('\n').filter(line => line.trim());
    summaryResult.innerHTML = `<div class="summary-bullets"><ul>${
      items.map(item => `<li>${item.replace(/^[-•*]\s*/, '')}</li>`).join('')
    </ul></div>`;
  } else {
    summaryResult.innerHTML = `<div class="summary-${style}">${text}</div>`;
  }
}

// ========== 翻译功能 ==========
// 监听来自 content script 的划词翻译消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'translateSelection') {
    handleTranslate(message.text);
  }
});

targetLang.addEventListener('change', () => {
  // 如果有待翻译文本，重新翻译
  const lastText = translateResult.dataset.lastText;
  if (lastText) {
    handleTranslate(lastText);
  }
});

async function handleTranslate(text) {
  translateResult.dataset.lastText = text;
  translateResult.innerHTML = '<div class="loading">正在翻译</div>';

  try {
    const lang = targetLang.value;
    const result = await sendToBackground('translate', { text, targetLang: lang });

    if (result.error) {
      throw new Error(result.error);
    }

    translateResult.innerHTML = `
      <div style="margin-bottom:8px;font-size:12px;color:#999;">原文：</div>
      <div style="margin-bottom:12px;font-size:13px;">${text}</div>
      <div style="margin-bottom:8px;font-size:12px;color:#999;">译文：</div>
      <div style="font-size:13px;font-weight:500;">${result.translation}</div>
    `;
  } catch (err) {
    translateResult.innerHTML = `<div class="error">${err.message}</div>`;
  }
}

// ========== 笔记管理 ==========
btnAddNote.addEventListener('click', async () => {
  const text = noteInput.value.trim();
  if (!text) return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const note = {
      id: Date.now().toString(),
      text,
      url: tab.url,
      title: tab.title,
      createdAt: new Date().toISOString()
    };

    await sendToBackground('saveNote', { note });
    noteInput.value = '';
    loadNotes();
  } catch (err) {
    alert('保存笔记失败：' + err.message);
  }
});

async function loadNotes() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const result = await sendToBackground('getNotes', { url: tab.url });

    if (result.notes && result.notes.length > 0) {
      notesList.innerHTML = result.notes.map(note => `
        <div class="note-item" data-id="${note.id}">
          <div class="note-text">${note.text}</div>
          <div class="note-meta">${new Date(note.createdAt).toLocaleString('zh-CN')}</div>
          <button class="note-delete" data-id="${note.id}">&times;</button>
        </div>
      `).join('');

      // 绑定删除按钮
      notesList.querySelectorAll('.note-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          await sendToBackground('deleteNote', { id: btn.dataset.id });
          loadNotes();
        });
      });
    } else {
      notesList.innerHTML = '<p class="placeholder">暂无笔记</p>';
    }
  } catch {
    notesList.innerHTML = '<p class="placeholder">无法加载笔记</p>';
  }
}

// ========== 阅读模式 ==========
btnReaderMode.addEventListener('click', async () => {
  try {
    await sendToContent('toggleReaderMode');
    window.close();
  } catch (err) {
    alert('无法进入阅读模式：' + err.message);
  }
});

btnFontSize.addEventListener('click', async () => {
  try {
    await sendToContent('changeFontSize');
  } catch {
    // content script 可能未加载，忽略
  }
});

async function loadReadingStats() {
  try {
    const result = await sendToContent('getReadingStats');
    if (result) {
      readingTime.textContent = result.readingTime || '--';
      wordCount.textContent = result.wordCount || '--';
    }
  } catch {
    // 静默失败，统计数据非关键功能
  }
}

// ========== 设置面板 ==========
btnSettings.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
});

btnSaveSettings.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  const endpoint = apiEndpointInput.value.trim();

  if (!apiKey) {
    alert('请输入 API Key');
    return;
  }

  await chrome.storage.local.set({
    apiKey,
    apiEndpoint: endpoint || 'https://api.openai.com/v1'
  });

  settingsPanel.classList.add('hidden');
  alert('设置已保存');
});

btnCancelSettings.addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
});

async function loadSettings() {
  const { apiKey, apiEndpoint } = await chrome.storage.local.get(['apiKey', 'apiEndpoint']);
  if (apiKey) apiKeyInput.value = apiKey;
  if (apiEndpoint) apiEndpointInput.value = apiEndpoint;
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadNotes();
  loadReadingStats();
});

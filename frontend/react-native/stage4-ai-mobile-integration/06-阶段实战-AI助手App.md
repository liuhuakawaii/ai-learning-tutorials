# 阶段实战：AI 助手 App

## 场景引入

前五节课分别学习了移动端推理、语音交互、图像识别、实时对话和离线能力。现在把它们整合成一个完整的 AI 助手 App。

核心能力：用户通过文字、语音或图片与 AI 对话，支持流式响应和 Markdown 渲染，离线时自动降级到本地模型，对话历史持久化。这不是 demo，而是可以实际使用的工具。

## 学习目标

- 掌握 AI 助手 App 的整体架构设计
- 实现多模态输入（文字、语音、图片）
- 构建流式对话界面与对话历史管理
- 设计离线降级方案与设置页面

## 目录结构

```
src/
├── services/    # AIClient, StreamingAIClient, HybridAIService, STTService, TTSService, ImageService, OCRService, ChatStorage, ModelManager
├── hooks/       # useStreamingChat, useLanguage
├── components/  # ChatBubble, StreamingMarkdown, InputToolbar
├── screens/     # ChatScreen, ConversationListScreen, SettingsScreen
└── App.tsx
```

## 核心类型

```typescript
// src/types/index.ts
export interface Conversation { id: string; title: string; messages: ChatMessage[]; createdAt: number; updatedAt: number; }
export interface ChatMessage {
  id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: number;
  type: 'text' | 'image' | 'voice'; imageUri?: string;
}
export type AppMode = 'online' | 'offline' | 'auto';
```

## 消息气泡组件

```typescript
// src/components/ChatBubble.tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { ChatMessage } from '../types';

export function ChatBubble({ message, isStreaming }: { message: ChatMessage; isStreaming?: boolean }) {
  const isUser = message.role === 'user';
  return (
    <View style={[st.row, isUser && st.rowRev]}>
      {!isUser && <View style={st.avatar}><Text style={st.avText}>AI</Text></View>}
      <View style={[st.bubble, isUser ? st.user : st.ai]}>
        {message.type === 'image' && message.imageUri && <Image source={{ uri: message.imageUri }} style={st.img} />}
        {isUser ? <Text style={st.userText}>{message.content}</Text> :
          <Markdown style={md}>{isStreaming ? message.content + '▊' : message.content}</Markdown>}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 4, paddingHorizontal: 12, alignItems: 'flex-end' },
  rowRev: { flexDirection: 'row-reverse' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  avText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  bubble: { maxWidth: '78%', borderRadius: 16, padding: 12 },
  user: { backgroundColor: '#007AFF', borderBottomRightRadius: 4 },
  ai: { backgroundColor: '#f0f0f0', borderBottomLeftRadius: 4 },
  userText: { color: '#fff', fontSize: 16, lineHeight: 22 },
  img: { width: 200, height: 150, borderRadius: 8, marginBottom: 8 },
});
const md = { body: { fontSize: 16, lineHeight: 22, color: '#333' }, code_inline: { backgroundColor: '#e8e8e8', paddingHorizontal: 4, borderRadius: 3, fontFamily: 'monospace' }, link: { color: '#007AFF' } };
```

## 输入工具栏

```typescript
// src/components/InputToolbar.tsx
import React, { useState, useRef, useCallback } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet, Animated, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { STTService } from '../services/STTService';

interface Props {
  onSendText: (text: string) => void;
  onSendImage: (uri: string) => void;
  onSendVoice: (text: string) => void;
  disabled: boolean;
}

export function InputToolbar({ onSendText, onSendImage, onSendVoice, disabled }: Props) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [recording, setRecording] = useState(false);
  const sttRef = useRef(new STTService()).current;
  const scale = useRef(new Animated.Value(1)).current;

  const handleSend = () => { if (text.trim()) { onSendText(text.trim()); setText(''); } };

  const handleVoiceIn = useCallback(async () => {
    setRecording(true);
    Animated.spring(scale, { toValue: 1.3, useNativeDriver: true }).start();
    await sttRef.startListening('zh-CN', (t) => {
      onSendVoice(t); setRecording(false);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
    });
  }, [onSendVoice]);

  const handleVoiceOut = useCallback(async () => {
    await sttRef.stopListening(); setRecording(false);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  }, []);

  const handleCamera = useCallback(async () => {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) { Alert.alert('提示', '需要相机权限'); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!r.canceled) onSendImage(r.assets[0].uri);
  }, [onSendImage]);

  return (
    <View style={styles.container}>
      <View style={styles.modeBar}>
        {(['text', 'voice'] as const).map(m => (
          <Pressable key={m} onPress={() => setMode(m)} style={[styles.modeBtn, mode === m && styles.modeActive]}>
            <Text style={styles.modeText}>{m === 'text' ? '文字' : '语音'}</Text>
          </Pressable>
        ))}
        <Pressable onPress={handleCamera} style={styles.modeBtn}><Text style={styles.modeText}>拍照</Text></Pressable>
      </View>
      {mode === 'text' ? (
        <View style={styles.textRow}>
          <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="输入消息..."
            multiline maxLength={2000} editable={!disabled} />
          <Pressable onPress={handleSend} style={[styles.sendBtn, (!text.trim() || disabled) && { opacity: 0.4 }]}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>发送</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ alignItems: 'center', padding: 20 }}>
          <Pressable onPressIn={handleVoiceIn} onPressOut={handleVoiceOut}>
            <Animated.View style={[styles.voiceBtn, { transform: [{ scale }] }]}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>{recording ? '松开发送' : '按住说话'}</Text>
            </Animated.View>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  modeBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }, modeActive: { backgroundColor: '#e3f2fd' },
  modeText: { fontSize: 13, color: '#666' },
  textRow: { flexDirection: 'row', padding: 10, alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, fontSize: 16, maxHeight: 100, marginRight: 8 },
  sendBtn: { backgroundColor: '#007AFF', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  voiceBtn: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
});
```

## 主对话界面

```typescript
// src/screens/ChatScreen.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, FlatList, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { ChatBubble } from '../components/ChatBubble';
import { InputToolbar } from '../components/InputToolbar';
import { useStreamingChat } from '../hooks/useStreamingChat';
import { ImageService } from '../services/ImageService';
import { OCRService } from '../services/OCRService';
import { ChatStorage } from '../services/ChatStorage';
import { ChatMessage, AppMode } from '../types';

interface Props { apiKey: string; conversationId?: string; appMode: AppMode; }

export function ChatScreen({ apiKey, conversationId, appMode }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [processing, setProcessing] = useState(false);
  const listRef = useRef<FlatList>(null);
  const imgSvc = useRef(new ImageService()).current;
  const ocrSvc = useRef(new OCRService()).current;
  const storage = useRef(new ChatStorage()).current;
  const { isStreaming, currentText, sendMessage } = useStreamingChat({ apiKey });

  useEffect(() => { if (conversationId) storage.get(conversationId).then(c => c && setMessages(c.messages)); }, [conversationId]);

  const addMsg = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const full = { ...msg, id: Date.now().toString(), timestamp: Date.now() };
    setMessages(prev => [...prev, full]);
    setTimeout(() => listRef.current?.scrollToEnd(), 100);
  }, []);

  const handleText = useCallback(async (text: string) => {
    addMsg({ role: 'user', content: text, type: 'text' });
    setProcessing(true);
    try { await sendMessage(text); } catch { addMsg({ role: 'assistant', content: '错误，请重试。', type: 'text' }); }
    setProcessing(false);
  }, [addMsg, sendMessage]);

  const handleImage = useCallback(async (uri: string) => {
    addMsg({ role: 'user', content: '[图片]', type: 'image', imageUri: uri });
    setProcessing(true);
    try {
      const processed = await imgSvc.preprocessForOCR(uri);
      const blocks = await ocrSvc.recognizeText(processed);
      const text = ocrSvc.mergeSameLineBlocks(blocks).join('\n');
      addMsg({ role: 'assistant', content: text.trim() ? `识别到文字：\n\n${text}` : '未识别到文字', type: 'text' });
    } catch { addMsg({ role: 'assistant', content: '识别失败', type: 'text' }); }
    setProcessing(false);
  }, [addMsg, imgSvc, ocrSvc]);

  const display = [...messages];
  if (isStreaming && currentText) display.push({ id: 'stream', role: 'assistant', content: currentText, timestamp: Date.now(), type: 'text' });

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={s.status}><Text style={s.statusText}>{appMode === 'offline' ? '离线模式' : '在线模式'}</Text></View>
      <FlatList ref={listRef} data={display} keyExtractor={i => i.id}
        renderItem={({ item }) => <ChatBubble message={item} isStreaming={item.id === 'stream'} />}
        contentContainerStyle={{ paddingVertical: 12 }} />
      {processing && !isStreaming && (
        <View style={s.loading}><ActivityIndicator size="small" color="#007AFF" /><Text style={{ marginLeft: 8, color: '#999' }}>思考中...</Text></View>
      )}
      <InputToolbar onSendText={handleText} onSendImage={handleImage} onSendVoice={(t) => handleText(t)} disabled={processing} />
    </View>
  );
}

const s = StyleSheet.create({
  status: { paddingVertical: 6, paddingHorizontal: 16, backgroundColor: '#f8f8f8', borderBottomWidth: 1, borderBottomColor: '#eee' },
  statusText: { fontSize: 12, color: '#999' },
  loading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
});
```

## 设置页面

```typescript
// src/screens/SettingsScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { ModelManager } from '../services/ModelManager';
import { AppMode } from '../types';

interface Props { appMode: AppMode; onModeChange: (m: AppMode) => void; }

export function SettingsScreen({ appMode, onModeChange }: Props) {
  const [models, setModels] = useState<Array<{ name: string; sizeMB: number }>>([]);
  const mgr = new ModelManager();
  useEffect(() => { mgr.listModels().then(setModels); }, []);

  const modeLabels: Record<AppMode, string> = { online: '在线模式', auto: '自动切换', offline: '离线模式' };
  const modeDescs: Record<AppMode, string> = { online: '云端 API，质量最高', auto: '有网用云端，无网用本地', offline: '仅本地模型' };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <Text style={s.section}>AI 模式</Text>
      <View style={s.card}>
        {(['online', 'auto', 'offline'] as AppMode[]).map(m => (
          <Pressable key={m} onPress={() => onModeChange(m)} style={[s.modeOpt, appMode === m && s.modeActive]}>
            <Text style={s.modeTitle}>{modeLabels[m]}</Text>
            <Text style={s.modeDesc}>{modeDescs[m]}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.section}>已下载模型</Text>
      <View style={s.card}>
        {models.length === 0 ? <Text style={{ padding: 16, color: '#999', textAlign: 'center' }}>暂无模型</Text> :
          models.map(m => (
            <View key={m.name} style={s.modelRow}>
              <View><Text style={{ fontWeight: '500' }}>{m.name}</Text><Text style={{ color: '#999', fontSize: 12 }}>{m.sizeMB} MB</Text></View>
              <Pressable onPress={() => Alert.alert('删除', `确认删除 ${m.name}？`, [
                { text: '取消' }, { text: '删除', style: 'destructive', onPress: () => mgr.deleteModel(m.name).then(() => mgr.listModels().then(setModels)) },
              ])}><Text style={{ color: '#ff3b30' }}>删除</Text></Pressable>
            </View>
          ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  section: { fontSize: 13, color: '#999', marginTop: 20, marginBottom: 8, marginLeft: 16 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  modeOpt: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }, modeActive: { backgroundColor: '#e3f2fd' },
  modeTitle: { fontSize: 16, fontWeight: '600', color: '#333' }, modeDesc: { fontSize: 13, color: '#999', marginTop: 2 },
  modelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
});
```

## App 入口

```typescript
// src/App.tsx
import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ChatScreen } from './screens/ChatScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AppMode } from './types';

const Tab = createBottomTabNavigator();

export default function App() {
  const [mode, setMode] = useState<AppMode>('auto');
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="对话" options={{ headerShown: false }}>
          {() => <ChatScreen apiKey="your-api-key" appMode={mode} />}
        </Tab.Screen>
        <Tab.Screen name="设置" options={{ headerShown: false }}>
          {() => <SettingsScreen appMode={mode} onModeChange={setMode} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
```

## 常见误区

1. **所有功能堆到一个组件**：ChatScreen 不应包含 OCR/TTS/STT 逻辑，通过 Service 层解耦。
2. **不做状态管理**：对话列表和当前对话分别存放，切换时不同步，应用统一状态管理。
3. **流式内容直接加入 messages**：保存时会保存不完整内容，用独立 state 管理流式。
4. **大图片直接发给 API**：4000×3000 图片直接传很慢且贵，必须先压缩。
5. **不做错误边界**：一个 Service 报错不应导致 App 崩溃。

## 工程建议

- **API Key 安全**：用 react-native-keychain 存储，不硬编码
- **自动保存**：每次新消息后自动保存对话
- **图片压缩**：发送前压缩到 1024px 宽度、80% 质量
- **流式中断**：发新消息时自动取消上一个流式请求
- **内存管理**：长对话定期做上下文压缩

## 小结

AI 助手 App 架构：多模态输入（文字/语音/图片）→ 服务层（AI + OCR + STT/TTS）→ 离线/在线切换 → UI（流式对话 + Markdown）。InputToolbar 统一管理输入，ChatScreen 串联所有服务。工程重点：状态管理、错误处理、图片压缩、对话持久化。

## 练习

### 练习一：对话列表页面

实现 ConversationListScreen：展示历史对话，支持搜索、删除和新建。

### 练习二：测试计划

列出 AI 助手 App 的测试点、边界情况和异常场景。

---

## 参考答案

### 练习一

**思路**：ChatStorage 加载对话，FlatList 展示，搜索 `filter(c => c.title.includes(query))` 过滤，长按删除。每项显示标题、最后消息预览和时间。点击调用 `onSelect(item.id)` 切换对话。

**要点**：搜索同时匹配标题和内容；长按删除防误操作；空状态有友好提示。

### 练习二

**测试计划**：

| 模块 | 测试点 | 操作 | 预期 |
|------|--------|------|------|
| 文字对话 | 正常发送 | 输入文字发送 | 显示用户消息 + AI 流式回复 |
| 文字对话 | 空消息 | 不输入点发送 | 无响应 |
| 文字对话 | 流式中断 | 回复中发新消息 | 取消旧的，发新的 |
| 语音输入 | 正常录音 | 按住说话松开 | 识别文字并发送 |
| 语音输入 | 权限拒绝 | 拒绝麦克风权限 | 提示需要权限 |
| 图片识别 | 拍照 OCR | 拍含文字图片 | 显示识别结果 |
| 图片识别 | 无文字图片 | 拍纯色图 | 提示未识别到文字 |
| 离线模式 | 自动切换 | 断网发消息 | 用离线模型 |
| 对话管理 | 历史保存 | 发消息后退出重开 | 对话还在 |
| 边界 | 快速连续发送 | 快速点发送多次 | 不重复不崩溃 |
| 边界 | Token 超限 | 接近每日额度 | 提示用户 |

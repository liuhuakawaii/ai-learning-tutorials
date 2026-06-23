# 阶段实战：AI 助手 App

## 做什么

构建移动端 AI 助手：对话界面 + 语音交互 + 图像识别 + 离线能力。这是一个完整的 AI 移动应用。

## 功能清单

1. AI 对话（流式响应）
2. 语音输入（语音转文字）
3. 图像识别（拍照/选图 → AI 分析）
4. 对话历史（本地持久化）
5. 离线模式（设备端模型）

## 技术栈

- OpenAI API（云端 AI）
- expo-speech（TTS）
- expo-image-picker（图片选择）
- AsyncStorage（对话历史）
- Zustand（状态管理）

## 对话 Store

```typescript
// stores/chat.ts
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  image?: string
}

interface ChatStore {
  messages: Message[]
  conversations: { id: string; title: string; messages: Message[] }[]
  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => void
  clearMessages: () => void
  saveConversation: () => void
}

export const useChatStore = create()(persist(
  (set, get) => ({
    messages: [],
    conversations: [],
    addMessage: (msg) => set((s) => ({
      messages: [...s.messages, { ...msg, id: Date.now().toString(), timestamp: new Date().toISOString() }],
    })),
    clearMessages: () => set({ messages: [] }),
    saveConversation: () => {
      const { messages, conversations } = get()
      if (messages.length === 0) return
      set({
        conversations: [{ id: Date.now().toString(), title: messages[0].content.slice(0, 20), messages }, ...conversations],
        messages: [],
      })
    },
  }),
  { name: 'chat-history', storage: createJSONStorage(() => AsyncStorage) }
))
```

## 对话界面

```tsx
// app/chat.tsx
export default function ChatScreen() {
  const { messages, addMessage } = useChatStore()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  async function send(text?: string, imageUri?: string) {
    const content = text || input
    if (!content.trim() && !imageUri) return

    addMessage({ role: 'user', content, image: imageUri })
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await response.json()
      addMessage({ role: 'assistant', content: data.choices[0].message.content })
    } catch (err) {
      addMessage({ role: 'assistant', content: '抱歉，出了点问题。' })
    }
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => <MessageBubble message={item} />}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />
      <View style={styles.inputBar}>
        <TouchableOpacity onPress={pickImage}><Ionicons name="image-outline" size={24} /></TouchableOpacity>
        <TouchableOpacity onPress={startVoice}><Ionicons name="mic-outline" size={24} /></TouchableOpacity>
        <TextInput value={input} onChangeText={setInput} placeholder="输入消息..." />
        <TouchableOpacity onPress={() => send()} disabled={loading}>
          <Ionicons name="send" size={24} color={loading ? '#ccc' : '#3b82f6'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}
```

## 图像识别

```typescript
import * as ImagePicker from 'expo-image-picker'

async function pickImage() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    base64: true,
  })
  if (result.canceled) return

  const imageUri = result.assets[0].uri
  const base64 = result.assets[0].base64

  addMessage({ role: 'user', content: '请分析这张图片', image: imageUri })
  setLoading(true)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '请描述这张图片的内容' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
        ],
      }],
    }),
  })

  const data = await response.json()
  addMessage({ role: 'assistant', content: data.choices[0].message.content })
  setLoading(false)
}
```

## 语音交互

```typescript
import * as Speech from 'expo-speech'

// TTS：朗读 AI 回复
function speakReply(text: string) {
  Speech.speak(text, { language: 'zh-CN', rate: 1.0 })
}

// STT：语音输入（需要 expo-speech-recognition 或类似库）
async function startVoice() {
  // 使用 expo-speech-recognition
  const result = await startSpeechRecognition()
  if (result) {
    setInput(result)
    send(result)
  }
}
```

## 对话历史

```tsx
// app/history.tsx
export default function HistoryScreen() {
  const conversations = useChatStore(s => s.conversations)
  const router = useRouter()

  return (
    <FlatList
      data={conversations}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => router.push(`/conversation/${item.id}`)}>
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>{item.messages.length} 条消息</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  )
}
```

## 练习

### 练习一：完整 AI 助手

实现全部功能：对话 + 图像识别 + 语音 + 历史。

### 练习二：流式响应

实现打字机效果的流式响应，AI 回复逐字显示。

### 练习三：多模态输入

支持在一条消息中同时包含文字和图片，发送给 AI 分析。

---

## 参考答案

### 练习一

按本课代码结构：Store → 对话界面 → 图像识别 → 语音 → 历史列表。

### 练习二

```typescript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-4o-mini', messages, stream: true }),
})

const reader = response.body.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value)
  // 解析 SSE 数据，逐步更新消息
}
```

### 练习三

```typescript
// 用 OpenAI 的 vision API
const content = [
  { type: 'text', text: userText },
  { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
]
```

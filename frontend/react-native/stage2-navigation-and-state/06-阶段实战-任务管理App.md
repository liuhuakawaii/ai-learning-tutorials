# 阶段实战：任务管理 App

## 做什么

构建任务管理 App：任务列表（增删改查）、分类管理、提醒通知、本地存储持久化。综合运用导航、表单、手势动画、本地存储、推送通知。

## 功能清单

1. 任务 CRUD（标题、描述、截止日期、优先级、分类）
2. 分类管理（自定义分类、颜色标记）
3. 任务筛选（按分类、状态、优先级）
4. 本地持久化（MMKV 或 AsyncStorage）
5. 推送通知（到期提醒）
6. 手势交互（左滑删除、长按排序）

## 数据模型

```typescript
// types/task.ts
export interface Task {
  id: string
  title: string
  description?: string
  categoryId: string
  priority: 'low' | 'medium' | 'high'
  status: 'todo' | 'doing' | 'done'
  dueDate?: string
  createdAt: string
}

export interface Category {
  id: string
  name: string
  color: string
}
```

## 状态管理

```typescript
// stores/tasks.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface TaskStore {
  tasks: Task[]
  categories: Category[]
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void
  updateTask: (id: string, data: Partial<Task>) => void
  deleteTask: (id: string) => void
  addCategory: (category: Omit<Category, 'id'>) => void
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set) => ({
      tasks: [],
      categories: [
        { id: '1', name: '工作', color: '#3b82f6' },
        { id: '2', name: '个人', color: '#10b981' },
        { id: '3', name: '学习', color: '#f59e0b' },
      ],
      addTask: (task) => set((s) => ({
        tasks: [...s.tasks, { ...task, id: Date.now().toString(), createdAt: new Date().toISOString() }],
      })),
      updateTask: (id, data) => set((s) => ({
        tasks: s.tasks.map(t => t.id === id ? { ...t, ...data } : t),
      })),
      deleteTask: (id) => set((s) => ({
        tasks: s.tasks.filter(t => t.id !== id),
      })),
      addCategory: (cat) => set((s) => ({
        categories: [...s.categories, { ...cat, id: Date.now().toString() }],
      })),
    }),
    { name: 'tasks', storage: createJSONStorage(() => AsyncStorage) }
  )
)
```

## 任务列表（FlatList）

```tsx
// app/(tabs)/index.tsx
export default function TaskList() {
  const tasks = useTaskStore(s => s.tasks)
  const categories = useTaskStore(s => s.categories)
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.categoryId === filter)

  return (
    <View style={{ flex: 1 }}>
      <CategoryFilter categories={categories} active={filter} onChange={setFilter} />
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <TaskCard task={item} />}
        ListEmptyComponent={<EmptyState icon="checkbox-outline" title="暂无任务" />}
      />
      <FAB onPress={() => router.push('/task/new')} />
    </View>
  )
}
```

## 任务表单

```tsx
// app/task/new.tsx
export default function NewTask() {
  const addTask = useTaskStore(s => s.addTask)
  const categories = useTaskStore(s => s.categories)
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '')
  const [priority, setPriority] = useState<Task['priority']>('medium')

  function handleSave() {
    if (!title.trim()) return
    addTask({ title, description, categoryId, priority, status: 'todo' })
    router.back()
  }

  return (
    <View style={{ padding: 16 }}>
      <TextInput value={title} onChangeText={setTitle} placeholder="任务标题" />
      <TextInput value={description} onChangeText={setDescription} placeholder="描述（可选）" multiline />
      <CategoryPicker categories={categories} selected={categoryId} onSelect={setCategoryId} />
      <PriorityPicker selected={priority} onSelect={setPriority} />
      <Button title="保存" onPress={handleSave} />
    </View>
  )
}
```

## 左滑删除

```tsx
import { Swipeable } from 'react-native-gesture-handler'

function TaskCard({ task }) {
  const deleteTask = useTaskStore(s => s.deleteTask)

  const renderRightActions = () => (
    <TouchableOpacity onPress={() => deleteTask(task.id)}
      style={{ backgroundColor: '#ef4444', justifyContent: 'center', paddingHorizontal: 20 }}>
      <Text style={{ color: '#fff' }}>删除</Text>
    </TouchableOpacity>
  )

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <View style={styles.card}>
        <Text>{task.title}</Text>
      </View>
    </Swipeable>
  )
}
```

## 推送通知

```typescript
// utils/notifications.ts
import * as Notifications from 'expo-notifications'

export async function scheduleReminder(task: Task) {
  if (!task.dueDate) return
  const due = new Date(task.dueDate)
  const now = new Date()
  if (due <= now) return

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '任务到期提醒',
      body: `"${task.title}" 即将到期`,
    },
    trigger: { date: new Date(due.getTime() - 30 * 60 * 1000) }, // 提前 30 分钟
  })
}
```

## 练习

### 练习一：完整 App

实现任务管理 App 的全部功能。

### 练习二：拖拽排序

实现长按拖拽排序，调整任务优先顺序。

### 练习三：统计页面

添加统计 Tab：按分类饼图、按状态柱状图、本周完成数量。

---

## 参考答案

### 练习一

按本课代码结构：类型定义 → Store → 列表页 → 表单页 → 手势交互 → 通知。

### 练习二

```tsx
import DraggableFlatList from 'react-native-draggable-flatlist'

<DraggableFlatList
  data={tasks}
  onDragEnd={({ data }) => setTasks(data)}
  renderItem={({ item, drag }) => (
    <TouchableOpacity onLongPress={drag}>
      <TaskCard task={item} />
    </TouchableOpacity>
  )}
/>
```

### 练习三

```tsx
import { PieChart, BarChart } from 'react-native-chart-kit'

// 按分类统计
const byCategory = categories.map(cat => ({
  name: cat.name,
  count: tasks.filter(t => t.categoryId === cat.id).length,
  color: cat.color,
}))
```

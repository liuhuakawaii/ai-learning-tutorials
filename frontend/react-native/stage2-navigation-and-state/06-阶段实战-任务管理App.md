# 阶段实战：任务管理 App

## 场景引入

综合前五课知识，构建完整任务管理 App：创建/编辑/删除任务，按优先级分组，按状态筛选，手势滑动完成/删除，本地推送提醒，SQLite 持久化。

## 学习目标

- 综合运用导航、手势、表单、存储、通知技术
- 理解任务 CRUD 架构设计
- 实现分组、筛选列表与手势交互

## 数据模型与数据库

```tsx
// src/database/schema.ts
import * as SQLite from 'expo-sqlite';

export interface Task {
  id: number; title: string; description: string | null;
  priority: 'low' | 'medium' | 'high'; status: 'pending' | 'done';
  due_date: string | null; reminder_id: string | null;
  created_at: string; updated_at: string;
}

export class TaskDatabase {
  private db: SQLite.SQLiteDatabase;
  constructor() {
    this.db = SQLite.openDatabaseSync('task_manager.db');
    this.db.execSync(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT,
      priority TEXT DEFAULT 'medium', status TEXT DEFAULT 'pending',
      due_date TEXT, reminder_id TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );`);
  }

  getAll(filters?: { status?: string; sortBy?: string }): Task[] {
    let sql = 'SELECT * FROM tasks WHERE 1=1'; const p: string[] = [];
    if (filters?.status) { sql += ' AND status = ?'; p.push(filters.status); }
    if (filters?.sortBy === 'due_date') sql += ' ORDER BY due_date IS NULL, due_date ASC';
    else if (filters?.sortBy === 'priority') sql += " ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END";
    else sql += ' ORDER BY created_at DESC';
    return this.db.getAllSync<Task>(sql, p);
  }

  getById(id: number): Task | null { return this.db.getFirstSync('SELECT * FROM tasks WHERE id = ?', [id]); }

  create(data: { title: string; description?: string; priority?: string; due_date?: string }): number {
    return this.db.runSync('INSERT INTO tasks (title,description,priority,due_date) VALUES (?,?,?,?)',
      [data.title, data.description || null, data.priority || 'medium', data.due_date || null]).lastInsertRowId;
  }

  update(id: number, data: Partial<Task>): void {
    const e = Object.entries(data).filter(([k]) => k !== 'id');
    this.db.runSync(`UPDATE tasks SET ${e.map(([k]) => `${k}=?`).join(',')},updated_at=datetime('now') WHERE id=?`, [...e.map(([, v]) => v), id]);
  }

  delete(id: number): void { this.db.runSync('DELETE FROM tasks WHERE id = ?', [id]); }
}
export const taskDB = new TaskDatabase();
```

## 自定义 Hook

```tsx
// src/hooks/useTasks.ts
import { useState, useCallback } from 'react';
import { taskDB, Task } from '../database/schema';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const refresh = useCallback(() => { setLoading(true); try { setTasks(taskDB.getAll()); } finally { setLoading(false); } }, []);
  const createTask = useCallback((d: Parameters<typeof taskDB.create>[0]) => { const id = taskDB.create(d); refresh(); return id; }, [refresh]);
  const toggleStatus = useCallback((id: number, cur: string) => { taskDB.update(id, { status: cur === 'pending' ? 'done' : 'pending' as Task['status'] }); refresh(); }, [refresh]);
  const deleteTask = useCallback((id: number) => { taskDB.delete(id); refresh(); }, [refresh]);
  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);
  return { tasks: filtered, loading, filter, setFilter, refresh, createTask, toggleStatus, deleteTask };
}
```

## 任务列表：分组与筛选

```tsx
// src/screens/TaskListScreen.tsx
import { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTasks } from '../hooks/useTasks';
import { TaskCard } from '../components/TaskCard';

const COLORS: Record<string, string> = { high: '#FF3B30', medium: '#FF9500', low: '#34C759' };
const LABELS: Record<string, string> = { high: '高', medium: '中', low: '低' };

export default function TaskListScreen() {
  const { tasks, loading, filter, setFilter, refresh, toggleStatus, deleteTask } = useTasks();
  useEffect(() => { refresh(); }, []);

  const grouped = ['high', 'medium', 'low'].map((p) => ({
    priority: p, tasks: tasks.filter((t) => t.priority === p),
  })).filter((g) => g.tasks.length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F7' }}>
      <View style={s.filterRow}>
        {['all', 'pending', 'done'].map((f) => (
          <TouchableOpacity key={f} style={[s.chip, filter === f && s.chipActive]} onPress={() => setFilter(f)}>
            <Text style={[s.chipText, filter === f && { color: '#fff' }]}>{f === 'all' ? '全部' : f === 'pending' ? '待办' : '已完成'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList data={grouped} keyExtractor={(i) => i.priority}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInRight.delay(index * 100).duration(300)} style={{ marginBottom: 16 }}>
            <View style={s.groupHeader}>
              <View style={[s.dot, { backgroundColor: COLORS[item.priority] }]} />
              <Text style={s.groupTitle}>{LABELS[item.priority]}优先级 ({item.tasks.length})</Text>
            </View>
            {item.tasks.map((task) => (
              <TaskCard key={task.id} task={task}
                onToggle={() => toggleStatus(task.id, task.status)}
                onDelete={() => deleteTask(task.id)}
                onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })} />
            ))}
          </Animated.View>
        )}
        ListEmptyComponent={<View style={{ alignItems: 'center', marginTop: 80 }}><Ionicons name="checkbox-outline" size={48} color="#C7C7CC" /><Text style={{ color: '#8E8E93', marginTop: 8 }}>暂无任务</Text></View>} />
      <TouchableOpacity style={s.fab} onPress={() => router.push('/task/create')}><Ionicons name="add" size={28} color="#fff" /></TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  filterRow: { flexDirection: 'row', padding: 16, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#E5E5EA' },
  chipActive: { backgroundColor: '#007AFF' }, chipText: { fontSize: 14, color: '#3C3C43' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 }, groupTitle: { fontSize: 14, fontWeight: '600', color: '#8E8E93' },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', elevation: 6 },
});
```

## TaskCard 组件：手势滑动

```tsx
// src/components/TaskCard.tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Task } from '../database/schema';

const COLORS: Record<string, string> = { high: '#FF3B30', medium: '#FF9500', low: '#34C759' };

export function TaskCard({ task, onToggle, onDelete, onPress }: { task: Task; onToggle: () => void; onDelete: () => void; onPress: () => void }) {
  const x = useSharedValue(0), h = useSharedValue(72), o = useSharedValue(1);
  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onUpdate((e) => { x.value = Math.max(-100, Math.min(100, e.translationX)); })
    .onEnd((e) => {
      if (e.translationX < -80) { x.value = withSpring(-400); h.value = withSpring(0); o.value = withSpring(0, {}, () => { 'worklet'; runOnJS(onDelete)(); }); }
      else if (e.translationX > 80) { x.value = withSpring(0); runOnJS(onToggle)(); }
      else x.value = withSpring(0);
    });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], height: h.value, opacity: o.value }));
  const PRIORITY_LABELS: Record<string, string> = { high: '高', medium: '中', low: '低' };

  return (
    <View style={{ marginVertical: 3, marginHorizontal: 16 }}>
      <View style={st.actionBg}>
        <View style={[st.action, { backgroundColor: '#FF3B30' }]}><Ionicons name="trash-outline" size={18} color="#fff" /><Text style={st.actionText}>删除</Text></View>
        <View style={[st.action, { backgroundColor: '#34C759' }]}><Ionicons name="checkmark-outline" size={18} color="#fff" /><Text style={st.actionText}>完成</Text></View>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[st.card, style]}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }} onPress={onPress}>
            <TouchableOpacity onPress={onToggle}>
              <Ionicons name={task.status === 'done' ? 'checkbox' : 'square-outline'} size={24} color={task.status === 'done' ? '#34C759' : '#C7C7CC'} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[{ fontSize: 16 }, task.status === 'done' && { textDecorationLine: 'line-through', color: '#8E8E93' }]} numberOfLines={1}>{task.title}</Text>
              {task.due_date && <Text style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>{new Date(task.due_date).toLocaleDateString('zh-CN')}</Text>}
            </View>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: COLORS[task.priority] + '20' }}>
              <Text style={{ color: COLORS[task.priority], fontSize: 12, fontWeight: '600' }}>{PRIORITY_LABELS[task.priority]}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const st = StyleSheet.create({
  actionBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 68, borderRadius: 10, flexDirection: 'row', overflow: 'hidden' },
  action: { flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 4 },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden' },
});
```

## 创建任务表单

```tsx
// src/screens/CreateTaskScreen.tsx
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { taskDB } from '../database/schema';
import * as Notifications from 'expo-notifications';

const schema = z.object({
  title: z.string().min(1, '标题不能为空').max(100),
  description: z.string().max(500).optional(),
  priority: z.enum(['low', 'medium', 'high']),
});
type FormData = z.infer<typeof schema>;

export default function CreateTaskScreen() {
  const [dueDate, setDueDate] = useState<Date>();
  const [showDate, setShowDate] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema), defaultValues: { title: '', description: '', priority: 'medium' },
  });

  const onSubmit = async (data: FormData) => {
    const id = taskDB.create({ ...data, due_date: dueDate?.toISOString() });
    if (dueDate) {
      const t = new Date(dueDate.getTime() - 30 * 60 * 1000);
      if (t > new Date()) {
        const nid = await Notifications.scheduleNotificationAsync({
          content: { title: '任务即将到期', body: `《${data.title}》将在 30 分钟后到期`, data: { taskId: id }, sound: 'default' },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: t },
        });
        taskDB.update(id, { reminder_id: nid });
      }
    }
    router.back();
  };

  return (
    <ScrollView style={{ flex: 1, padding: 16, backgroundColor: '#F2F2F7' }} keyboardShouldPersistTaps="handled">
      <Controller control={control} name="title" render={({ field: { onChange, onBlur, value } }) => (
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontWeight: '600', marginBottom: 6 }}>标题 *</Text>
          <TextInput style={{ borderWidth: 1, borderColor: errors.title ? '#FF3B30' : '#D1D1D6', borderRadius: 8, padding: 12, backgroundColor: '#fff' }} value={value} onChangeText={onChange} onBlur={onBlur} placeholder="输入标题" autoFocus />
          {errors.title && <Text style={{ color: '#FF3B30', fontSize: 12, marginTop: 4 }}>{errors.title.message}</Text>}
        </View>
      )} />

      <Controller control={control} name="priority" render={({ field: { onChange, value } }) => (
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontWeight: '600', marginBottom: 6 }}>优先级</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['low', 'medium', 'high'] as const).map((p) => (
              <TouchableOpacity key={p} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: value === p ? '#007AFF' : '#D1D1D6', backgroundColor: value === p ? '#007AFF' : '#fff' }} onPress={() => onChange(p)}>
                <Text style={{ color: value === p ? '#fff' : '#3C3C43' }}>{p === 'low' ? '低' : p === 'medium' ? '中' : '高'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )} />

      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontWeight: '600', marginBottom: 6 }}>截止日期</Text>
        <TouchableOpacity style={{ borderWidth: 1, borderColor: '#D1D1D6', borderRadius: 8, padding: 12, backgroundColor: '#fff' }} onPress={() => setShowDate(true)}>
          <Text>{dueDate ? dueDate.toLocaleDateString('zh-CN') : '选择截止日期（可选）'}</Text>
        </TouchableOpacity>
        {showDate && <DateTimePicker value={dueDate || new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} minimumDate={new Date()} onChange={(_, d) => { setShowDate(Platform.OS === 'ios'); if (d) setDueDate(d); }} />}
      </View>

      <TouchableOpacity style={{ backgroundColor: '#007AFF', padding: 16, borderRadius: 10, alignItems: 'center' }} onPress={handleSubmit(onSubmit)}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>创建任务</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

## 根布局

```tsx
// app/_layout.tsx
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
});

export default function RootLayout() {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const { taskId } = r.notification.request.content.data;
      if (taskId) router.push({ pathname: '/task/[id]', params: { id: String(taskId) } });
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="task/create" options={{ title: '新建任务', presentation: 'modal' }} />
        <Stack.Screen name="task/[id]" options={{ title: '任务详情' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
```

## 常见误区与工程建议

1. 数据库操作应放 `useEffect` 或回调，不要在渲染函数中
2. 手势 `activeOffsetX` 必须设置，防止与列表滚动冲突
3. 表单提交后用 `useFocusEffect` 或事件总线刷新列表
4. 推送提醒保存 `notificationId`，删除任务时同步取消
5. 列表用 `FlatList`，表单用 `react-hook-form`，数据库初始化放启动时

## 小结

综合运用导航、手势、表单、存储、通知，每个模块单一职责：数据库层、UI 层、业务逻辑层分离清晰。

## 练习

### 练习一：任务统计

在 Tab 栏添加"统计"Tab，展示任务总数、待办数、已完成数、按优先级分布。

### 练习二：任务搜索

在列表顶部添加搜索栏，按标题关键词实时搜索。

---

## 参考答案

### 练习一

**思路**：新增 Tab 页面，用 `taskDB.getAll()` 统计数据。

**答案**：

```tsx
// app/(tabs)/stats.tsx
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { taskDB } from '../../src/database/schema';

export default function StatsScreen() {
  const [s, setS] = useState({ total: 0, pending: 0, done: 0, high: 0, medium: 0, low: 0 });
  useEffect(() => {
    const a = taskDB.getAll();
    setS({ total: a.length, pending: a.filter(t => t.status === 'pending').length, done: a.filter(t => t.status === 'done').length, high: a.filter(t => t.priority === 'high').length, medium: a.filter(t => t.priority === 'medium').length, low: a.filter(t => t.priority === 'low').length });
  }, []);
  const rate = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#F2F2F7' }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16 }}>任务概览</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          {[['总数', s.total, '#007AFF'], ['待办', s.pending, '#FF9500'], ['已完成', s.done, '#34C759'], ['完成率', `${rate}%`, '#5856D6']].map(([l, v, c]) => (
            <View key={l as string} style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 28, fontWeight: '700', color: c as string }}>{v as number | string}</Text>
              <Text style={{ fontSize: 12, color: '#8E8E93' }}>{l}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
```

### 练习二

**思路**：`TextInput` + `filter` 实时搜索。

**答案**：

```tsx
function SearchableTaskList() {
  const [kw, setKw] = useState('');
  const all = taskDB.getAll();
  const results = kw.trim() ? all.filter(t => t.title.toLowerCase().includes(kw.toLowerCase())) : [];
  return (
    <View style={{ flex: 1 }}>
      <TextInput value={kw} onChangeText={setKw} placeholder="搜索任务..."
        style={{ borderWidth: 1, borderColor: '#D1D1D6', borderRadius: 8, padding: 12, margin: 16, backgroundColor: '#fff' }} />
      <FlatList data={results} keyExtractor={i => i.id.toString()}
        renderItem={({ item }) => (
          <View style={{ padding: 12, marginHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' }}>
            <Text style={{ fontSize: 16 }}>{item.title}</Text>
          </View>
        )}
        ListEmptyComponent={kw.length > 0 ? <Text style={{ textAlign: 'center', color: '#8E8E93', marginTop: 32 }}>未找到匹配任务</Text> : null} />
    </View>
  );
}
```

**要点**：空关键词时清空结果，`toLowerCase()` 做不区分大小写搜索。

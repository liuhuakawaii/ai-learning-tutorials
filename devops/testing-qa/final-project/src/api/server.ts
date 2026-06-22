import express from 'express';
import { TodoStore } from '../store/todo-store.js';
import { TodoService } from '../services/todo-service.js';
import { CreateTodoSchema, UpdateTodoSchema } from '../models/todo.js';

const app = express();
app.use(express.json());

const store = new TodoStore();
const service = new TodoService(store);

// 获取所有 Todo
app.get('/api/todos', (_req, res) => {
  const todos = service.getAll();
  res.json({ data: todos });
});

// 获取单个 Todo
app.get('/api/todos/:id', (req, res) => {
  const todo = service.getById(req.params.id);
  if (!todo) {
    res.status(404).json({ error: 'Todo 不存在' });
    return;
  }
  res.json({ data: todo });
});

// 创建 Todo
app.post('/api/todos', (req, res) => {
  try {
    const input = CreateTodoSchema.parse(req.body);
    const todo = service.create(input);
    res.status(201).json({ data: todo });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 更新 Todo
app.patch('/api/todos/:id', (req, res) => {
  try {
    const input = UpdateTodoSchema.parse(req.body);
    const todo = service.update(req.params.id, input);
    if (!todo) {
      res.status(404).json({ error: 'Todo 不存在' });
      return;
    }
    res.json({ data: todo });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 删除 Todo
app.delete('/api/todos/:id', (req, res) => {
  const deleted = service.delete(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Todo 不存在' });
    return;
  }
  res.status(204).send();
});

// 切换完成状态
app.post('/api/todos/:id/toggle', (req, res) => {
  const todo = service.toggleComplete(req.params.id);
  if (!todo) {
    res.status(404).json({ error: 'Todo 不存在' });
    return;
  }
  res.json({ data: todo });
});

// 获取统计
app.get('/api/todos/stats', (_req, res) => {
  const stats = service.getStats();
  res.json({ data: stats });
});

// 清除已完成
app.post('/api/todos/clear-completed', (_req, res) => {
  const count = service.clearCompleted();
  res.json({ data: { deleted: count } });
});

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export { app, store, service };

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TodoService } from '@/services/todo-service.js';
import { TodoStore } from '@/store/todo-store.js';

describe('TodoService', () => {
  let store: TodoStore;
  let service: TodoService;
  let idCounter = 0;

  beforeEach(() => {
    store = new TodoStore();
    service = new TodoService(store);
    idCounter = 0;

    // Mock crypto.randomUUID
    vi.stubGlobal('crypto', {
      randomUUID: () => `mock-uuid-${++idCounter}`,
    });
  });

  describe('create', () => {
    it('创建有效的 Todo', () => {
      const todo = service.create({ title: '新任务' });
      expect(todo.title).toBe('新任务');
      expect(todo.completed).toBe(false);
      expect(todo.id).toBeDefined();
    });

    it('空标题抛出验证错误', () => {
      expect(() => service.create({ title: '' })).toThrow();
    });

    it('超长标题抛出验证错误', () => {
      expect(() => service.create({ title: 'a'.repeat(201) })).toThrow();
    });
  });

  describe('getAll', () => {
    it('返回所有 Todo', () => {
      service.create({ title: '任务1' });
      service.create({ title: '任务2' });
      expect(service.getAll()).toHaveLength(2);
    });
  });

  describe('getById', () => {
    it('返回存在的 Todo', () => {
      const todo = service.create({ title: '任务' });
      expect(service.getById(todo.id)).toEqual(todo);
    });

    it('不存在返回 null', () => {
      expect(service.getById('nonexistent')).toBeNull();
    });
  });

  describe('update', () => {
    it('更新标题', () => {
      const todo = service.create({ title: '原标题' });
      const updated = service.update(todo.id, { title: '新标题' });
      expect(updated!.title).toBe('新标题');
    });

    it('更新完成状态', () => {
      const todo = service.create({ title: '任务' });
      const updated = service.update(todo.id, { completed: true });
      expect(updated!.completed).toBe(true);
    });

    it('不存在的 ID 返回 null', () => {
      expect(service.update('nonexistent', { title: '新标题' })).toBeNull();
    });
  });

  describe('delete', () => {
    it('删除存在的 Todo', () => {
      const todo = service.create({ title: '任务' });
      expect(service.delete(todo.id)).toBe(true);
      expect(service.getById(todo.id)).toBeNull();
    });
  });

  describe('toggleComplete', () => {
    it('未完成切换为已完成', () => {
      const todo = service.create({ title: '任务' });
      const toggled = service.toggleComplete(todo.id);
      expect(toggled!.completed).toBe(true);
    });

    it('已完成切换为未完成', () => {
      const todo = service.create({ title: '任务' });
      service.update(todo.id, { completed: true });
      const toggled = service.toggleComplete(todo.id);
      expect(toggled!.completed).toBe(false);
    });
  });

  describe('clearCompleted', () => {
    it('清除所有已完成的 Todo', () => {
      const t1 = service.create({ title: '任务1' });
      service.create({ title: '任务2' });
      service.update(t1.id, { completed: true });

      const deleted = service.clearCompleted();
      expect(deleted).toBe(1);
      expect(service.getAll()).toHaveLength(1);
    });
  });

  describe('getByStatus', () => {
    it('按状态筛选', () => {
      const t1 = service.create({ title: '待办' });
      service.create({ title: '待办2' });
      service.update(t1.id, { completed: true });

      expect(service.getByStatus(true)).toHaveLength(1);
      expect(service.getByStatus(false)).toHaveLength(1);
    });
  });

  describe('search', () => {
    it('按关键词搜索', () => {
      service.create({ title: '学习 Vitest' });
      service.create({ title: '学习 Playwright' });
      service.create({ title: '写代码' });

      expect(service.search('Vitest')).toHaveLength(1);
      expect(service.search('学习')).toHaveLength(2);
      expect(service.search('不存在')).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('返回正确的统计信息', () => {
      const t1 = service.create({ title: '任务1' });
      service.create({ title: '任务2' });
      service.create({ title: '任务3' });
      service.update(t1.id, { completed: true });

      const stats = service.getStats();
      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(1);
      expect(stats.pending).toBe(2);
    });
  });
});

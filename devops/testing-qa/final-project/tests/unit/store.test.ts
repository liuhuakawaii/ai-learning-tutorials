import { describe, it, expect, beforeEach } from 'vitest';
import { TodoStore } from '@/store/todo-store.js';
import type { Todo } from '@/models/todo.js';

describe('TodoStore', () => {
  let store: TodoStore;

  beforeEach(() => {
    store = new TodoStore();
  });

  describe('create', () => {
    it('创建 Todo 并返回完整对象', () => {
      const todo = store.create(
        { title: '测试任务' },
        () => 'test-id-1',
        () => '2024-01-01T00:00:00.000Z'
      );

      expect(todo.id).toBe('test-id-1');
      expect(todo.title).toBe('测试任务');
      expect(todo.completed).toBe(false);
      expect(todo.createdAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('标题会自动去除首尾空白', () => {
      const todo = store.create(
        { title: '  带空格的任务  ' },
        () => 'test-id-2',
        () => '2024-01-01T00:00:00.000Z'
      );

      expect(todo.title).toBe('带空格的任务');
    });
  });

  describe('getAll', () => {
    it('空 store 返回空数组', () => {
      expect(store.getAll()).toEqual([]);
    });

    it('返回按创建时间降序排列的列表', () => {
      store.create({ title: '任务1' }, () => 'id-1', () => '2024-01-01T00:00:00.000Z');
      store.create({ title: '任务2' }, () => 'id-2', () => '2024-01-02T00:00:00.000Z');

      const all = store.getAll();
      expect(all).toHaveLength(2);
      expect(all[0].id).toBe('id-2');
      expect(all[1].id).toBe('id-1');
    });
  });

  describe('getById', () => {
    it('返回存在的 Todo', () => {
      store.create({ title: '任务' }, () => 'id-1', () => '2024-01-01T00:00:00.000Z');
      expect(store.getById('id-1')).toBeDefined();
    });

    it('不存在的 ID 返回 undefined', () => {
      expect(store.getById('nonexistent')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('更新标题', () => {
      store.create({ title: '原标题' }, () => 'id-1', () => '2024-01-01T00:00:00.000Z');
      const updated = store.update('id-1', { title: '新标题' }, () => '2024-01-02T00:00:00.000Z');

      expect(updated).not.toBeNull();
      expect(updated!.title).toBe('新标题');
      expect(updated!.updatedAt).toBe('2024-01-02T00:00:00.000Z');
    });

    it('更新完成状态', () => {
      store.create({ title: '任务' }, () => 'id-1', () => '2024-01-01T00:00:00.000Z');
      const updated = store.update('id-1', { completed: true }, () => '2024-01-02T00:00:00.000Z');

      expect(updated!.completed).toBe(true);
    });

    it('不存在的 ID 返回 null', () => {
      expect(store.update('nonexistent', { title: '新标题' }, () => '2024-01-02T00:00:00.000Z')).toBeNull();
    });
  });

  describe('delete', () => {
    it('删除存在的 Todo 返回 true', () => {
      store.create({ title: '任务' }, () => 'id-1', () => '2024-01-01T00:00:00.000Z');
      expect(store.delete('id-1')).toBe(true);
      expect(store.getById('id-1')).toBeUndefined();
    });

    it('删除不存在的 Todo 返回 false', () => {
      expect(store.delete('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('清空所有数据', () => {
      store.create({ title: '任务1' }, () => 'id-1', () => '2024-01-01T00:00:00.000Z');
      store.create({ title: '任务2' }, () => 'id-2', () => '2024-01-02T00:00:00.000Z');
      store.clear();
      expect(store.count()).toBe(0);
    });
  });
});

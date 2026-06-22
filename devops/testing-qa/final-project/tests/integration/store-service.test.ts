import { describe, it, expect, beforeEach } from 'vitest';
import { TodoStore } from '@/store/todo-store.js';
import { TodoService } from '@/services/todo-service.js';

describe('Store + Service 集成测试', () => {
  let store: TodoStore;
  let service: TodoService;

  beforeEach(() => {
    store = new TodoStore();
    service = new TodoService(store);
  });

  it('完整的 Todo 生命周期', () => {
    // 创建
    const todo = service.create({ title: '生命周期测试' });
    expect(todo.id).toBeDefined();
    expect(todo.completed).toBe(false);

    // 查询
    const found = service.getById(todo.id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe('生命周期测试');

    // 更新
    const updated = service.update(todo.id, { title: '已更新', completed: true });
    expect(updated!.title).toBe('已更新');
    expect(updated!.completed).toBe(true);

    // 统计
    const stats = service.getStats();
    expect(stats.total).toBe(1);
    expect(stats.completed).toBe(1);

    // 删除
    expect(service.delete(todo.id)).toBe(true);
    expect(service.getById(todo.id)).toBeNull();
    expect(service.getStats().total).toBe(0);
  });

  it('多个 Todo 的批量操作', () => {
    service.create({ title: '任务1' });
    service.create({ title: '任务2' });
    service.create({ title: '任务3' });

    const all = service.getAll();
    expect(all).toHaveLength(3);

    // 批量完成
    all.forEach(t => service.update(t.id, { completed: true }));
    expect(service.getByStatus(true)).toHaveLength(3);
    expect(service.getByStatus(false)).toHaveLength(0);

    // 清除已完成
    const deleted = service.clearCompleted();
    expect(deleted).toBe(3);
    expect(service.getAll()).toHaveLength(0);
  });

  it('搜索与筛选的组合使用', () => {
    service.create({ title: '学习 Vitest 测试框架' });
    service.create({ title: '学习 Playwright E2E' });
    service.create({ title: '编写业务代码' });

    expect(service.search('学习')).toHaveLength(2);
    expect(service.search('Vitest')).toHaveLength(1);
    expect(service.search('Playwright')).toHaveLength(1);
    expect(service.search('不存在')).toHaveLength(0);
  });

  it('Store 的数据在 Service 层保持一致性', () => {
    const todo = service.create({ title: '一致性测试' });

    // 通过 Store 直接验证
    const storeTodo = store.getById(todo.id);
    expect(storeTodo).toEqual(todo);

    // 通过 Service 更新后 Store 也变化
    service.update(todo.id, { completed: true });
    expect(store.getById(todo.id)!.completed).toBe(true);
  });
});

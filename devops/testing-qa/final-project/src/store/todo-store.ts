import { type Todo, type CreateTodoInput, type UpdateTodoInput } from '../models/todo.js';

/**
 * 内存数据库 - 用于测试的内存存储
 */
export class TodoStore {
  private todos: Map<string, Todo> = new Map();

  getAll(): Todo[] {
    return Array.from(this.todos.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getById(id: string): Todo | undefined {
    return this.todos.get(id);
  }

  create(input: CreateTodoInput, generateId: () => string, now: () => string): Todo {
    const todo: Todo = {
      id: generateId(),
      title: input.title.trim(),
      completed: false,
      createdAt: now(),
      updatedAt: now(),
    };
    this.todos.set(todo.id, todo);
    return todo;
  }

  update(id: string, input: UpdateTodoInput, now: () => string): Todo | null {
    const existing = this.todos.get(id);
    if (!existing) return null;

    const updated: Todo = {
      ...existing,
      ...(input.title !== undefined && { title: input.title.trim() }),
      ...(input.completed !== undefined && { completed: input.completed }),
      updatedAt: now(),
    };
    this.todos.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.todos.delete(id);
  }

  clear(): void {
    this.todos.clear();
  }

  count(): number {
    return this.todos.size;
  }
}

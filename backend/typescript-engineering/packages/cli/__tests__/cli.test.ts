import { describe, it, expect } from 'vitest';
import { findCommand, listCommands, parseArgs } from '../src/index';

describe('CLI — 命令注册', () => {
  it('listCommands 返回所有注册的命令', () => {
    const cmds = listCommands();
    expect(cmds.length).toBeGreaterThan(0);
    const names = cmds.map((c) => c.name);
    expect(names).toContain('user:list');
    expect(names).toContain('tool:list');
    expect(names).toContain('init');
    expect(names).toContain('config:show');
  });

  it('findCommand 能找到已注册的命令', () => {
    const cmd = findCommand('user:list');
    expect(cmd).toBeDefined();
    expect(cmd?.description).toBe('列出所有用户');
  });

  it('findCommand 对未知命令返回 undefined', () => {
    expect(findCommand('unknown:cmd')).toBeUndefined();
  });
});

describe('CLI — 参数解析', () => {
  it('parseArgs 正确解析命令名和参数', () => {
    const result = parseArgs(['user:create', 'test@example.com', '测试用户']);
    expect(result.command).toBe('user:create');
    expect(result.args).toEqual(['test@example.com', '测试用户']);
    expect(Object.keys(result.options)).toHaveLength(0);
  });

  it('parseArgs 正确解析 --key=value 选项', () => {
    const result = parseArgs(['tool:list', '--page=2', '--size=20']);
    expect(result.command).toBe('tool:list');
    expect(result.options.page).toBe('2');
    expect(result.options.size).toBe('20');
  });

  it('parseArgs 处理无参数情况', () => {
    const result = parseArgs([]);
    expect(result.command).toBe('');
    expect(result.args).toEqual([]);
  });

  it('parseArgs 处理混合参数和选项', () => {
    const result = parseArgs(['user:create', 'a@b.com', 'A', '--role=admin']);
    expect(result.command).toBe('user:create');
    expect(result.args).toEqual(['a@b.com', 'A']);
    expect(result.options.role).toBe('admin');
  });
});

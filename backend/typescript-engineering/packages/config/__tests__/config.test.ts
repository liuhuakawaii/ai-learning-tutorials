import { describe, it, expect } from 'vitest';
import { getDefaultConfig, validateConfig, loadConfig } from '../src/index';

describe('配置包 — 默认配置', () => {
  it('getDefaultConfig 返回完整配置对象', () => {
    const config = getDefaultConfig();
    expect(config.appName).toBe('ts-tool-platform');
    expect(config.env).toBe('development');
    expect(config.port).toBe(3000);
    expect(config.logLevel).toBe('info');
  });

  it('默认配置包含数据库设置', () => {
    const config = getDefaultConfig();
    expect(config.database.type).toBe('sqlite');
    expect(config.database.host).toBe('localhost');
  });

  it('默认配置包含认证设置', () => {
    const config = getDefaultConfig();
    expect(config.auth.secret).toBeDefined();
    expect(config.auth.expiresIn).toBe('7d');
  });

  it('默认配置包含 CORS 设置', () => {
    const config = getDefaultConfig();
    expect(Array.isArray(config.cors.origins)).toBe(true);
    expect(config.cors.credentials).toBe(true);
  });
});

describe('配置包 — 配置校验', () => {
  it('默认配置通过校验', () => {
    const errors = validateConfig(getDefaultConfig());
    expect(errors).toHaveLength(0);
  });

  it('空 appName 触发校验错误', () => {
    const config = { ...getDefaultConfig(), appName: '' };
    const errors = validateConfig(config);
    expect(errors).toContain('appName 不能为空');
  });

  it('无效端口触发校验错误', () => {
    const config = { ...getDefaultConfig(), port: 99999 };
    const errors = validateConfig(config);
    expect(errors.some((e) => e.includes('port'))).toBe(true);
  });

  it('生产环境使用开发密钥触发校验错误', () => {
    const config = { ...getDefaultConfig(), env: 'production' as const };
    const errors = validateConfig(config);
    expect(errors.some((e) => e.includes('开发密钥'))).toBe(true);
  });
});

describe('配置包 — 配置加载', () => {
  it('loadConfig 在无配置文件时返回默认配置', () => {
    // 使用一个不存在的目录，确保不会找到配置文件
    const config = loadConfig('/nonexistent-dir-for-test');
    expect(config.appName).toBe('ts-tool-platform');
    expect(config.port).toBe(3000);
  });
});

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** 应用配置结构 */
export interface AppConfig {
  /** 应用名称 */
  appName: string;
  /** 运行环境 */
  env: 'development' | 'production' | 'test';
  /** API 服务端口 */
  port: number;
  /** 日志级别 */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** 数据库配置 */
  database: DatabaseConfig;
  /** 认证配置 */
  auth: AuthConfig;
  /** CORS 配置 */
  cors: CorsConfig;
}

/** 数据库配置 */
export interface DatabaseConfig {
  /** 数据库类型 */
  type: 'sqlite' | 'postgres' | 'mysql';
  /** 连接地址 */
  host: string;
  /** 端口 */
  port: number;
  /** 数据库名 */
  database: string;
}

/** 认证配置 */
export interface AuthConfig {
  /** JWT 密钥（生产环境应从环境变量读取） */
  secret: string;
  /** Token 过期时间 */
  expiresIn: string;
}

/** CORS 配置 */
export interface CorsConfig {
  /** 允许的来源 */
  origins: string[];
  /** 是否允许携带凭证 */
  credentials: boolean;
}

/** 默认配置 */
export function getDefaultConfig(): AppConfig {
  return {
    appName: 'ts-tool-platform',
    env: 'development',
    port: 3000,
    logLevel: 'info',
    database: {
      type: 'sqlite',
      host: 'localhost',
      port: 5432,
      database: 'ts_tool_platform.db',
    },
    auth: {
      secret: 'dev-secret-do-not-use-in-production',
      expiresIn: '7d',
    },
    cors: {
      origins: ['http://localhost:5173'],
      credentials: true,
    },
  };
}

/** 配置文件名 */
const CONFIG_FILE_NAMES = ['ts-tool.config.json', 'ts-tool.config.js', '.ts-toolrc.json'];

/**
 * 加载配置
 * 按优先级查找配置文件：环境变量 > 配置文件 > 默认值
 */
export function loadConfig(rootDir?: string): AppConfig {
  const defaults = getDefaultConfig();
  const dir = rootDir ?? process.cwd();

  // 尝试从配置文件加载
  for (const fileName of CONFIG_FILE_NAMES) {
    const filePath = resolve(dir, fileName);
    if (existsSync(filePath)) {
      try {
        const raw = readFileSync(filePath, 'utf-8');
        const fileConfig = JSON.parse(raw);
        return mergeConfig(defaults, fileConfig);
      } catch {
        // 配置文件解析失败，使用默认值
      }
    }
  }

  // 从环境变量覆盖
  return applyEnvOverrides(defaults);
}

/** 深度合并配置（文件配置覆盖默认值） */
function mergeConfig(defaults: AppConfig, overrides: Partial<AppConfig>): AppConfig {
  return {
    ...defaults,
    ...overrides,
    database: { ...defaults.database, ...overrides.database },
    auth: { ...defaults.auth, ...overrides.auth },
    cors: { ...defaults.cors, ...overrides.cors },
  };
}

/** 从环境变量覆盖配置 */
function applyEnvOverrides(config: AppConfig): AppConfig {
  const result = { ...config };
  if (process.env.APP_NAME) result.appName = process.env.APP_NAME;
  if (process.env.NODE_ENV) result.env = process.env.NODE_ENV as AppConfig['env'];
  if (process.env.PORT) result.port = Number(process.env.PORT);
  if (process.env.LOG_LEVEL) result.logLevel = result.logLevel;
  if (process.env.DB_TYPE) result.database.type = process.env.DB_TYPE as DatabaseConfig['type'];
  if (process.env.DB_HOST) result.database.host = process.env.DB_HOST;
  if (process.env.DB_PORT) result.database.port = Number(process.env.DB_PORT);
  if (process.env.DB_NAME) result.database.database = process.env.DB_NAME;
  if (process.env.JWT_SECRET) result.auth.secret = process.env.JWT_SECRET;
  if (process.env.JWT_EXPIRES_IN) result.auth.expiresIn = process.env.JWT_EXPIRES_IN;
  return result;
}

/** 校验配置完整性 */
export function validateConfig(config: AppConfig): string[] {
  const errors: string[] = [];
  if (!config.appName) errors.push('appName 不能为空');
  if (config.port < 1 || config.port > 65535) errors.push('port 必须在 1-65535 之间');
  if (config.env === 'production' && config.auth.secret.includes('dev-')) {
    errors.push('生产环境不能使用开发密钥');
  }
  return errors;
}

import type { Command } from './index';
import { UserStatus, UserRole } from '@ts-tool-platform/shared-types';

/** 用户相关命令 */
export const userCommands: Command[] = [
  {
    name: 'user:list',
    description: '列出所有用户',
    options: [
      { flag: '--page', description: '页码', defaultValue: '1' },
      { flag: '--size', description: '每页数量', defaultValue: '10' },
    ],
    async handler(_args, options) {
      const page = Number(options.page ?? '1');
      const size = Number(options.size ?? '10');
      console.log(`查询用户列表 (第 ${page} 页，每页 ${size} 条)`);
      // 实际项目中应调用 API
      console.log('暂无数据（请先通过 API 创建用户）');
    },
  },
  {
    name: 'user:create',
    description: '创建新用户',
    args: ['email', 'name'],
    options: [
      { flag: '--role', description: '用户角色 (admin/editor/viewer)', defaultValue: 'viewer' },
    ],
    async handler(args, options) {
      const [email, name] = args;
      if (!email || !name) {
        console.error('错误：邮箱和名称为必填参数');
        console.log('用法: ts-tool user:create <email> <name> [--role=admin|editor|viewer]');
        return;
      }
      const role = (options.role as UserRole) ?? UserRole.Viewer;
      console.log(`创建用户: ${name} <${email}>, 角色: ${role}`);
      // 实际项目中应调用 API
      console.log('用户创建成功（模拟）');
    },
  },
  {
    name: 'user:info',
    description: '查看用户详情',
    args: ['id'],
    async handler(args) {
      const [id] = args;
      if (!id) {
        console.error('错误：请提供用户 ID');
        console.log('用法: ts-tool user:info <id>');
        return;
      }
      console.log(`查询用户 ${id} 的详细信息...`);
      // 实际项目中应调用 API
      console.log('未找到用户（模拟）');
    },
  },
];

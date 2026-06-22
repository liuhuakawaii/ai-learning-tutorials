import type { Command } from './index';
import { loadConfig, getDefaultConfig } from '@ts-tool-platform/config';
import { toSlug } from '@ts-tool-platform/shared-types';

/** 项目初始化命令 */
export const initCommands: Command[] = [
  {
    name: 'init',
    description: '初始化项目配置',
    options: [
      { flag: '--name', description: '项目名称', defaultValue: 'my-ts-tool' },
      { flag: '--port', description: 'API 端口', defaultValue: '3000' },
    ],
    async handler(_args, options) {
      const projectName = options.name ?? 'my-ts-tool';
      const port = options.port ?? '3000';
      console.log(`初始化项目: ${projectName}`);
      console.log(`  API 端口: ${port}`);
      console.log(`  Slug: ${toSlug(projectName)}`);

      const config = getDefaultConfig();
      console.log('默认配置:');
      console.log(JSON.stringify(config, null, 2));
      console.log('\n项目初始化完成（模拟）');
    },
  },
  {
    name: 'config:show',
    description: '显示当前配置',
    async handler() {
      try {
        const config = loadConfig();
        console.log('当前配置:');
        console.log(JSON.stringify(config, null, 2));
      } catch {
        console.log('未找到配置文件，使用默认配置:');
        console.log(JSON.stringify(getDefaultConfig(), null, 2));
      }
    },
  },
];

import type { Command } from './index';

/** 工具相关命令 */
export const toolCommands: Command[] = [
  {
    name: 'tool:list',
    description: '列出所有工具',
    options: [
      { flag: '--page', description: '页码', defaultValue: '1' },
      { flag: '--size', description: '每页数量', defaultValue: '10' },
      { flag: '--category', description: '按分类筛选' },
    ],
    async handler(_args, options) {
      const page = Number(options.page ?? '1');
      const size = Number(options.size ?? '10');
      const category = options.category;
      console.log(`查询工具列表 (第 ${page} 页，每页 ${size} 条)`);
      if (category) console.log(`分类筛选: ${category}`);
      console.log('暂无数据（请先通过 API 创建工具）');
    },
  },
  {
    name: 'tool:create',
    description: '创建新工具',
    args: ['name', 'slug'],
    options: [
      { flag: '--desc', description: '工具描述', defaultValue: '' },
      { flag: '--category', description: '工具分类', defaultValue: '未分类' },
      { flag: '--public', description: '是否公开', defaultValue: 'true' },
    ],
    async handler(args, options) {
      const [name, slug] = args;
      if (!name || !slug) {
        console.error('错误：名称和 slug 为必填参数');
        console.log('用法: ts-tool tool:create <name> <slug> [--desc=...] [--category=...]');
        return;
      }
      console.log(`创建工具: ${name} (${slug})`);
      console.log(`  描述: ${options.desc || '无'}`);
      console.log(`  分类: ${options.category}`);
      console.log(`  公开: ${options.public}`);
      console.log('工具创建成功（模拟）');
    },
  },
  {
    name: 'tool:search',
    description: '搜索工具',
    args: ['keyword'],
    async handler(args) {
      const [keyword] = args;
      if (!keyword) {
        console.error('错误：请提供搜索关键词');
        console.log('用法: ts-tool tool:search <keyword>');
        return;
      }
      console.log(`搜索工具: "${keyword}"...`);
      console.log('未找到匹配的工具（模拟）');
    },
  },
];

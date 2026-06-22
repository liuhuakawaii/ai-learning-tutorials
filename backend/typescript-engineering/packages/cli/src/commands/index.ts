import { loadConfig } from '@ts-tool-platform/config';
import { userCommands } from './user';
import { toolCommands } from './tool';
import { initCommands } from './init';

/** CLI 命令定义 */
export interface Command {
  name: string;
  description: string;
  args?: string[];
  options?: CommandOption[];
  handler: (args: string[], options: Record<string, string>) => Promise<void>;
}

/** 命令选项定义 */
export interface CommandOption {
  flag: string;
  description: string;
  required?: boolean;
  defaultValue?: string;
}

/** 所有注册的命令 */
const commands: Command[] = [
  ...userCommands,
  ...toolCommands,
  ...initCommands,
];

/** 查找命令 */
export function findCommand(name: string): Command | undefined {
  return commands.find((cmd) => cmd.name === name);
}

/** 列出所有命令 */
export function listCommands(): Command[] {
  return [...commands];
}

/** 打印帮助信息 */
export function printHelp(): void {
  console.log('ts-tool — TypeScript 工具平台 CLI\n');
  console.log('用法: ts-tool <command> [options]\n');
  console.log('可用命令:');
  const maxNameLen = Math.max(...commands.map((c) => c.name.length));
  commands.forEach((cmd) => {
    const padding = ' '.repeat(maxNameLen - cmd.name.length + 2);
    console.log(`  ${cmd.name}${padding}${cmd.description}`);
  });
  console.log('\n使用 ts-tool <command> --help 查看命令详细帮助');
}

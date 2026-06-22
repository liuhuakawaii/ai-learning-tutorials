/**
 * @ts-tool-platform/cli
 *
 * 平台命令行工具入口
 * 提供用户管理、工具管理、项目初始化等命令
 */

import { findCommand, listCommands, printHelp } from './commands/index';

/** 解析命令行参数 */
function parseArgs(argv: string[]): { command: string; args: string[]; options: Record<string, string> } {
  const args: string[] = [];
  const options: Record<string, string> = {};
  let command = '';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      options[key] = value ?? 'true';
    } else if (!command) {
      command = arg;
    } else {
      args.push(arg);
    }
  }

  return { command, args, options };
}

/** CLI 主入口 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    printHelp();
    return;
  }

  const { command, args, options } = parseArgs(argv);
  const cmd = findCommand(command);

  if (!cmd) {
    console.error(`未知命令: ${command}`);
    console.log('使用 --help 查看可用命令');
    process.exit(1);
  }

  if (options.help) {
    console.log(`${cmd.name} — ${cmd.description}`);
    if (cmd.args?.length) {
      console.log(`\n参数: ${cmd.args.join(', ')}`);
    }
    if (cmd.options?.length) {
      console.log('\n选项:');
      cmd.options.forEach((opt) => {
        console.log(`  ${opt.flag}  ${opt.description}${opt.defaultValue ? ` (默认: ${opt.defaultValue})` : ''}`);
      });
    }
    return;
  }

  try {
    await cmd.handler(args, options);
  } catch (err) {
    console.error(`命令执行失败: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();

export { findCommand, listCommands, printHelp, parseArgs };

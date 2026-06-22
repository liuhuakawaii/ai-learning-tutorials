#!/usr/bin/env node
import { Command } from 'commander';
import { getTemplate, listTemplates } from './prompt-templates';
import { reviewCode } from './code-reviewer';
import { generateTests } from './test-generator';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const program = new Command();

program
  .name('ai-kit')
  .description('AI Code Assistant Kit - AI辅助开发工具集')
  .version('1.0.0');

program
  .command('templates')
  .description('列出所有可用的 Prompt 模板')
  .action(() => {
    const templates = listTemplates();
    console.log('\n可用 Prompt 模板：\n');
    templates.forEach((t: { name: string; description: string; scenario: string }, i: number) => {
      console.log(`  ${i + 1}. ${t.name}`);
      console.log(`     ${t.description}`);
      console.log(`     场景: ${t.scenario}\n`);
    });
  });

program
  .command('template <name>')
  .description('获取指定的 Prompt 模板')
  .option('-v, --variables <vars>', '变量替换 (JSON格式)')
  .action((name: string, opts: { variables?: string }) => {
    const template = getTemplate(name);
    if (!template) {
      console.error(`模板 "${name}" 不存在。使用 "ai-kit templates" 查看可用模板。`);
      process.exit(1);
    }
    let content = template.content;
    if (opts.variables) {
      try {
        const vars = JSON.parse(opts.variables);
        Object.entries(vars).forEach(([key, value]) => {
          content = content.replace(new RegExp(`\\{${key}\\}`, 'g'), value as string);
        });
      } catch {
        console.error('变量格式错误，请使用 JSON 格式');
        process.exit(1);
      }
    }
    console.log(`\n模板: ${template.name}\n`);
    console.log(content);
  });

program
  .command('review <file>')
  .description('使用 AI 规则审查代码文件')
  .option('-o, --output <file>', '输出报告文件路径')
  .action((file: string, opts: { output?: string }) => {
    const filePath = resolve(file);
    if (!existsSync(filePath)) {
      console.error(`文件不存在: ${filePath}`);
      process.exit(1);
    }
    const code = readFileSync(filePath, 'utf-8');
    const report = reviewCode(code, file);
    console.log('\n代码审查报告：\n');
    console.log(report.summary);
    console.log(`\n发现 ${report.issues.length} 个问题：\n`);
    report.issues.forEach((issue: { severity: string; line: number; message: string }, i: number) => {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`  ${icon} [${issue.severity.toUpperCase()}] 第${issue.line}行: ${issue.message}`);
    });
    if (opts.output) {
      writeFileSync(resolve(opts.output), JSON.stringify(report, null, 2));
      console.log(`\n报告已保存到: ${opts.output}`);
    }
  });

program
  .command('test <file>')
  .description('为代码文件生成测试骨架')
  .option('-f, --framework <fw>', '测试框架 (vitest|jest|pytest)', 'vitest')
  .option('-o, --output <file>', '输出测试文件路径')
  .action((file: string, opts: { framework: string; output?: string }) => {
    const filePath = resolve(file);
    if (!existsSync(filePath)) {
      console.error(`文件不存在: ${filePath}`);
      process.exit(1);
    }
    const code = readFileSync(filePath, 'utf-8');
    const testCode = generateTests(code, file, opts.framework);
    if (opts.output) {
      writeFileSync(resolve(opts.output), testCode);
      console.log(`测试文件已生成: ${opts.output}`);
    } else {
      console.log('\n生成的测试代码：\n');
      console.log(testCode);
    }
  });

program.parse();

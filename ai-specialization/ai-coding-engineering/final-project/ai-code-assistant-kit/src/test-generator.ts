/** 函数信息接口 */
interface FunctionInfo {
  /** 函数名 */
  name: string;
  /** 参数列表 */
  params: string[];
  /** 返回类型 */
  returnType: string;
  /** 是否异步 */
  isAsync: boolean;
  /** 是否导出 */
  isExport: boolean;
}

/**
 * 根据源代码生成测试用例
 * @param sourceCode - 源代码字符串
 * @param fileName - 文件名
 * @param framework - 测试框架 (vitest/jest/pytest)
 * @returns 生成的测试代码
 */
export function generateTests(sourceCode: string, fileName: string, framework: string = 'vitest'): string {
  const functions = extractFunctions(sourceCode);
  const isTypeScript = fileName.endsWith('.ts') || fileName.endsWith('.tsx');
  const isPython = fileName.endsWith('.py');

  if (isPython) {
    return generatePythonTests(functions, fileName);
  }

  switch (framework) {
    case 'jest':
      return generateJestTests(functions, fileName, isTypeScript);
    case 'vitest':
    default:
      return generateVitestTests(functions, fileName, isTypeScript);
  }
}

function extractFunctions(code: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];

  const patterns = [
    /export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?/g,
    /(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?/g,
    /export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?::\s*(\w+))?\s*=>/g,
    /const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?::\s*(\w+))?\s*=>/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      const name = match[1];
      const params = match[2]
        ? match[2].split(',').map((p) => p.trim().split(':')[0].trim().replace(/\?.*/, ''))
        : [];
      const returnType = match[3] || 'void';
      const isAsync = match[0].includes('async');
      const isExport = match[0].includes('export');

      if (!functions.find((f) => f.name === name)) {
        functions.push({ name, params, returnType, isAsync, isExport });
      }
    }
  }

  return functions;
}

function generateVitestTests(functions: FunctionInfo[], fileName: string, isTS: boolean): string {
  const importPath = fileName.replace(/\.tsx?$/, '').replace(/.*src[\\/]/, '../');

  const lines: string[] = [
    `import { describe, it, expect${functions.some((f) => f.isAsync) ? ', vi' : ''} } from 'vitest';`,
    `import { ${functions.map((f) => f.name).join(', ')} } from '${importPath}';`,
    '',
  ];

  for (const fn of functions) {
    lines.push(`describe('${fn.name}', () => {`);

    // Happy path
    lines.push(`  it('应该正常执行', ${fn.isAsync ? 'async ' : ''}() => {`);
    lines.push(`    // TODO: 准备测试数据`);
    lines.push(`    const result = ${fn.isAsync ? 'await ' : ''}${fn.name}(${fn.params.map(() => '/* TODO */').join(', ')});`);
    lines.push(`    expect(result).toBeDefined();`);
    lines.push(`  });`);
    lines.push('');

    // Edge cases
    lines.push(`  it('应该处理边界情况', ${fn.isAsync ? 'async ' : ''}() => {`);
    lines.push(`    // TODO: 测试边界条件`);
    lines.push(`    // expect(() => ${fn.name}(null)).toThrow();`);
    lines.push(`  });`);
    lines.push('');

    // Error cases
    lines.push(`  it('应该正确处理错误', ${fn.isAsync ? 'async ' : ''}() => {`);
    lines.push(`    // TODO: 测试错误路径`);
    lines.push(`  });`);

    lines.push('});');
    lines.push('');
  }

  return lines.join('\n');
}

function generateJestTests(functions: FunctionInfo[], fileName: string, isTS: boolean): string {
  const importPath = fileName.replace(/\.tsx?$/, '').replace(/.*src[\\/]/, '../');

  const lines: string[] = [
    `import { ${functions.map((f) => f.name).join(', ')} } from '${importPath}';`,
    '',
  ];

  for (const fn of functions) {
    lines.push(`describe('${fn.name}', () => {`);

    lines.push(`  it('should execute successfully', ${fn.isAsync ? 'async ' : ''}() => {`);
    lines.push(`    // TODO: Prepare test data`);
    lines.push(`    const result = ${fn.isAsync ? 'await ' : ''}${fn.name}(${fn.params.map(() => '/* TODO */').join(', ')});`);
    lines.push(`    expect(result).toBeDefined();`);
    lines.push(`  });`);
    lines.push('');

    lines.push(`  it('should handle edge cases', ${fn.isAsync ? 'async ' : ''}() => {`);
    lines.push(`    // TODO: Test edge conditions`);
    lines.push(`  });`);
    lines.push('');

    lines.push(`  it('should handle errors', ${fn.isAsync ? 'async ' : ''}() => {`);
    lines.push(`    // TODO: Test error paths`);
    lines.push(`  });`);

    lines.push('});');
    lines.push('');
  }

  return lines.join('\n');
}

function generatePythonTests(functions: FunctionInfo[], fileName: string): string {
  const moduleName = fileName.replace(/\.py$/, '').replace(/.*[\\/]/, '');

  const lines: string[] = [
    `import pytest`,
    `from ${moduleName} import ${functions.map((f) => f.name).join(', ')}`,
    '',
  ];

  for (const fn of functions) {
    lines.push(`class Test${fn.name.charAt(0).toUpperCase() + fn.name.slice(1)}:`);

    lines.push(`    def test_${fn.name}_success(self):`);
    lines.push(`        """测试 ${fn.name} 正常执行"""`);
    lines.push(`        # TODO: 准备测试数据`);
    lines.push(`        result = ${fn.name}(${fn.params.map(() => 'None').join(', ')})`);
    lines.push(`        assert result is not None`);
    lines.push('');

    lines.push(`    def test_${fn.name}_edge_case(self):`);
    lines.push(`        """测试 ${fn.name} 边界条件"""`);
    lines.push(`        # TODO: 测试边界条件`);
    lines.push('');

    lines.push(`    def test_${fn.name}_error(self):`);
    lines.push(`        """测试 ${fn.name} 错误处理"""`);
    lines.push(`        # TODO: 测试错误路径`);
    lines.push(`        # with pytest.raises(ValueError):`);
    lines.push(`        #     ${fn.name}(None)`);
    lines.push('');
  }

  return lines.join('\n');
}

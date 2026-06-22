export interface PromptVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'code';
  required: boolean;
  defaultValue?: string;
}

export interface PromptExample {
  input: Record<string, string>;
  expectedOutput: string;
  description?: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: 'coding' | 'review' | 'testing' | 'documentation' | 'refactoring';
  version: string;
  author: string;
  supportedModels: string[];
  content: string;
  variables: PromptVariable[];
  examples: PromptExample[];
  tags: string[];
}

export interface ReviewSeverity {
  level: 'critical' | 'warning' | 'info';
  label: string;
  color: string;
}

export interface ReviewSuggestion {
  id: string;
  line: number | null;
  severity: ReviewSeverity;
  category: string;
  message: string;
  suggestion: string;
  ruleId: string;
}

export interface ReviewResult {
  file: string;
  timestamp: string;
  suggestions: ReviewSuggestion[];
  score: {
    security: number;
    quality: number;
    performance: number;
    overall: number;
  };
  summary: string;
}

export interface TestCase {
  description: string;
  input: string;
  expected: string;
  type: 'unit' | 'integration' | 'edge-case';
}

export interface TestSuite {
  functionName: string;
  functionSignature: string;
  framework: 'vitest' | 'jest' | 'mocha';
  cases: TestCase[];
  setupCode?: string;
  teardownCode?: string;
}

export interface ProjectConfig {
  name: string;
  version: string;
  promptDir: string;
  outputDir: string;
  testFramework: 'vitest' | 'jest' | 'mocha';
  language: 'typescript' | 'javascript' | 'python';
}

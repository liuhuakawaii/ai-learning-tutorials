import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // 测试目录
  testDir: './tests/e2e',

  // 每个测试的超时时间
  timeout: 30000,

  // 断言超时
  expect: { timeout: 5000 },

  // 并行运行
  fullyParallel: true,

  // CI 环境下失败不重试，本地重试 1 次
  retries: process.env.CI ? 0 : 1,

  // CI 环境下禁用并行以减少资源消耗
  workers: process.env.CI ? 1 : undefined,

  // 报告器配置
  reporter: [
    ['html', { outputFolder: 'reports/playwright-report' }],
    ['json', { outputFile: 'reports/playwright-results.json' }],
    ['list'],
  ],

  // 全局测试设置
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // 浏览器项目配置
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // 开发服务器配置
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

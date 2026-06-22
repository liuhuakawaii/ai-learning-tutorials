# Playwright 入门

## 场景引入

用户反馈"点击注册按钮没反应"。你检查代码，事件绑定正确，单元测试通过。但真实浏览器里，按钮被一个半透明 loading 遮罩挡住了——测试环境里没有这个遮罩。

E2E 测试的意义：在真实浏览器中，从用户视角验证完整操作流程。

## 学习目标

- 理解 Playwright 相比 Cypress/Puppeteer 的优势
- 掌握核心 API：goto、locator、click、fill
- 理解自动等待机制
- 学会 Page Object Model
- 配置多浏览器测试

---

## 为什么选 Playwright

| 特性 | Playwright | Cypress | Puppeteer |
|------|-----------|---------|-----------|
| 浏览器支持 | Chromium/Firefox/WebKit | 仅 Chromium | 仅 Chromium |
| 多标签页 | 支持 | 不支持 | 支持 |
| 并行执行 | 原生支持 | 需付费 | 需手动 |
| 测试生成器 | `codegen` | 无 | 无 |
| 维护方 | Microsoft | Cypress.io | Google |

核心优势：跨浏览器引擎、自动等待、代码生成器。

---

## 安装配置

```bash
npm init playwright@latest
```

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI
  }
})
```

---

## 核心 API

### 导航与断言

```typescript
import { test, expect } from '@playwright/test'

test('首页加载', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/首页/)
  await expect(page.locator('h1')).toContainText('欢迎')
})
```

### 元素定位

推荐的定位策略优先级：

1. `getByRole` — 语义角色（推荐）
2. `getByLabel` — 表单标签
3. `getByText` — 可见文本
4. `getByTestId` — data-testid（兜底）

```typescript
test('定位元素', async ({ page }) => {
  await page.goto('/products')
  const searchBtn = page.getByRole('button', { name: '搜索' })
  const emailInput = page.getByLabel('邮箱地址')
  const heading = page.getByText('商品列表')
  const price = page.getByTestId('product-price')
})
```

### 交互操作

```typescript
test('用户登录', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('邮箱').fill('test@example.com')
  await page.getByLabel('密码').fill('password123')
  await page.getByRole('button', { name: '登录' }).click()

  await expect(page.getByText('登录成功')).toBeVisible()
  await expect(page).toHaveURL('/dashboard')
})
```

---

## 自动等待机制

Playwright 执行操作前自动等待元素满足：**可见 → 稳定（无动画）→ 已启用 → 可接收事件（无遮挡）**。

```typescript
test('自动等待', async ({ page }) => {
  await page.goto('/slow-loading')
  // 不需要 setTimeout 或 waitForSelector
  await page.getByRole('button', { name: '提交' }).click()
  // 断言也有自动等待，持续检查直到条件满足或超时
  await expect(page.getByText('提交成功')).toBeVisible()
})
```

调整超时：
```typescript
// 全局
use: { actionTimeout: 10000, navigationTimeout: 30000 }
// 单次操作
await page.getByRole('button').click({ timeout: 60000 })
```

---

## Page Object Model

POM 把页面元素和操作封装成类，测试代码更易维护。

```typescript
// pages/LoginPage.ts
import { Page, Locator, expect } from '@playwright/test'

export class LoginPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.getByLabel('邮箱')
    this.passwordInput = page.getByLabel('密码')
    this.submitButton = page.getByRole('button', { name: '登录' })
    this.errorMessage = page.getByRole('alert')
  }

  async goto() { await this.page.goto('/login') }

  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
}
```

```typescript
// e2e/login.spec.ts
import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/LoginPage'

test.describe('登录', () => {
  test('成功登录跳转仪表盘', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login('admin@example.com', 'admin123')
    await expect(page).toHaveURL('/dashboard')
  })

  test('错误密码显示提示', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login('admin@example.com', 'wrong')
    await expect(loginPage.errorMessage).toHaveText('账号或密码错误')
  })
})
```

---

## 多浏览器测试

```bash
# 运行指定浏览器
npx playwright test --project=chromium
npx playwright test --project=firefox --project=webkit
```

添加移动端设备：
```typescript
projects: [
  { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  { name: 'mobile-safari', use: { ...devices['iPhone 13'] } }
]
```

---

## codegen 录制测试

```bash
npx playwright codegen http://localhost:3000
```

打开浏览器后，操作自动生成测试代码，可直接复制到测试文件。

---

## 常见误区

1. **手动 `waitForTimeout(1000)`**：Playwright 内置智能等待，大多数情况不需要。
2. **过度依赖文本选择器**：国际化场景下 `getByText` 会失败，优先 `getByRole`。
3. **测试间共享状态**：每个测试应独立，用 `beforeEach` 重置。
4. **只跑 Chromium**：WebKit 样式可能完全不同，CI 至少覆盖两种引擎。
5. **POM 中包含断言**：Page Object 只封装操作，断言留在测试文件。

---

## 工程建议

- 用 `test.describe` 按功能分组
- CI 开启 `retries: 2` 处理偶发网络波动
- `trace: 'on-first-retry'` 失败重试时记录详细日志
- 用 `test.skip` 标记已知问题
- 为常用操作创建 fixtures 减少重复

---

## 小结

- Playwright 支持三大浏览器引擎，适合跨浏览器验证
- 自动等待消除大部分 flaky test 根源
- POM 分离页面操作和测试逻辑
- `codegen` 快速生成测试骨架
- 多浏览器配置确保跨引擎一致性

---

## 练习

### 练习一：基础导航测试
访问首页，验证标题包含"首页"，点击"开始使用"链接跳转到 `/getting-started`。

### 练习二：POM 测试搜索
创建 SearchPage 的 Page Object，编写测试验证搜索功能。

### 练习三：多浏览器配置
添加 iPhone 13 和 Pixel 5 配置，编写在所有设备通过的基础测试。

---

## 参考答案

### 练习一

```typescript
import { test, expect } from '@playwright/test'

test('首页导航', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/首页/)
  const link = page.getByRole('link', { name: '开始使用' })
  await expect(link).toBeVisible()
  await link.click()
  await expect(page).toHaveURL('/getting-started')
})
```

### 练习二

```typescript
// pages/SearchPage.ts
import { Page, Locator, expect } from '@playwright/test'

export class SearchPage {
  readonly page: Page
  readonly searchInput: Locator
  readonly searchButton: Locator
  readonly resultItems: Locator
  readonly noResultMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.searchInput = page.getByPlaceholder('输入搜索关键词')
    this.searchButton = page.getByRole('button', { name: '搜索' })
    this.resultItems = page.getByTestId('search-result-item')
    this.noResultMessage = page.getByText('没有找到相关内容')
  }

  async goto() { await this.page.goto('/search') }

  async search(keyword: string) {
    await this.searchInput.fill(keyword)
    await this.searchButton.click()
  }
}

// e2e/search.spec.ts
import { test, expect } from '@playwright/test'
import { SearchPage } from '../pages/SearchPage'

test.describe('搜索', () => {
  test('返回结果', async ({ page }) => {
    const sp = new SearchPage(page)
    await sp.goto()
    await sp.search('Playwright')
    await expect(sp.resultItems.first()).toBeVisible()
  })

  test('无结果显示空状态', async ({ page }) => {
    const sp = new SearchPage(page)
    await sp.goto()
    await sp.search('xyznotexist123')
    await expect(sp.noResultMessage).toBeVisible()
  })
})
```

### 练习三

```typescript
// playwright.config.ts 新增
{ name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
{ name: 'mobile-safari', use: { ...devices['iPhone 13'] } }

// e2e/responsive.spec.ts
import { test, expect } from '@playwright/test'

test('所有设备正常显示', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /欢迎/ })).toBeVisible()
  await expect(page.getByRole('button', { name: '开始使用' })).toBeEnabled()
})

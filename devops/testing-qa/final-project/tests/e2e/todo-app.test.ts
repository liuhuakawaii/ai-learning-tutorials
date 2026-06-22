import { test, expect } from '@playwright/test';

test.describe('Todo 应用 E2E 测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('页面加载并显示标题', async ({ page }) => {
    await expect(page).toHaveTitle(/Todo/i);
  });

  test('创建新的 Todo', async ({ page }) => {
    const input = page.getByPlaceholder(/输入.*任务/i);
    await input.fill('E2E 测试任务');
    await input.press('Enter');

    await expect(page.getByText('E2E 测试任务')).toBeVisible();
  });

  test('标记 Todo 为已完成', async ({ page }) => {
    // 先创建一个 Todo
    const input = page.getByPlaceholder(/输入.*任务/i);
    await input.fill('待完成的任务');
    await input.press('Enter');

    // 点击完成按钮
    const todoItem = page.getByText('待完成的任务');
    await todoItem.click();

    // 验证已完成状态
    await expect(todoItem).toHaveCSS('text-decoration-line', 'line-through');
  });

  test('删除 Todo', async ({ page }) => {
    // 先创建一个 Todo
    const input = page.getByPlaceholder(/输入.*任务/i);
    await input.fill('待删除的任务');
    await input.press('Enter');

    // 悬停并点击删除按钮
    const todoItem = page.getByText('待删除的任务');
    await todoItem.hover();
    await page.getByRole('button', { name: /删除/i }).click();

    // 验证已删除
    await expect(todoItem).not.toBeVisible();
  });

  test('筛选 Todo 状态', async ({ page }) => {
    // 创建两个 Todo
    const input = page.getByPlaceholder(/输入.*任务/i);
    await input.fill('未完成任务');
    await input.press('Enter');
    await input.fill('已完成任务');
    await input.press('Enter');

    // 完成第二个
    await page.getByText('已完成任务').click();

    // 筛选已完成
    await page.getByRole('button', { name: /已完成/i }).click();
    await expect(page.getByText('已完成任务')).toBeVisible();
    await expect(page.getByText('未完成任务')).not.toBeVisible();

    // 筛选未完成
    await page.getByRole('button', { name: /未完成/i }).click();
    await expect(page.getByText('未完成任务')).toBeVisible();
    await expect(page.getByText('已完成任务')).not.toBeVisible();
  });

  test('显示 Todo 统计信息', async ({ page }) => {
    const input = page.getByPlaceholder(/输入.*任务/i);
    await input.fill('统计测试任务');
    await input.press('Enter');

    await expect(page.getByText(/1.*项.*未完成/i)).toBeVisible();
  });
});

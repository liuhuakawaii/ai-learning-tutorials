# 测试策略——视觉回归测试、截图对比、自动化测试

## 3D 应用能写测试吗

传统前端测试——单元测试、集成测试、E2E 测试——在 3D 应用上都有困难。渲染结果是像素，不是 DOM 元素。你怎么断言"画面正确"？

答案：截图对比。把渲染结果截成图片，和基准图比较。

## 截图对比的原理

```ts
function captureScreenshot(renderer: THREE.WebGLRenderer): string {
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
}
```

对比两张图片的像素差异：

```ts
function compareImages(
    actual: ImageData,
    expected: ImageData,
    tolerance: number
): { match: boolean; diffPercentage: number; diffImage: ImageData } {
    if (actual.width !== expected.width || actual.height !== expected.height) {
        return { match: false, diffPercentage: 100, diffImage: actual };
    }

    const diff = new ImageData(actual.width, actual.height);
    let diffPixels = 0;
    const totalPixels = actual.width * actual.height;

    for (let i = 0; i < actual.data.length; i += 4) {
        const dr = Math.abs(actual.data[i] - expected.data[i]);
        const dg = Math.abs(actual.data[i + 1] - expected.data[i + 1]);
        const db = Math.abs(actual.data[i + 2] - expected.data[i + 2]);
        const da = Math.abs(actual.data[i + 3] - expected.data[i + 3]);

        if (dr + dg + db + da > tolerance * 4) {
            diffPixels++;
            diff.data[i] = 255;     // 红色标记差异
            diff.data[i + 1] = 0;
            diff.data[i + 2] = 0;
            diff.data[i + 3] = 255;
        } else {
            diff.data[i] = actual.data[i];
            diff.data[i + 1] = actual.data[i + 1];
            diff.data[i + 2] = actual.data[i + 2];
            diff.data[i + 3] = actual.data[i + 3];
        }
    }

    return {
        match: diffPixels / totalPixels < 0.01, // 1% 容差
        diffPercentage: diffPixels / totalPixels * 100,
        diffImage: diff
    };
}
```

## 用 Playwright 做视觉测试

Playwright 支持截图对比：

```ts
// tests/visual.spec.ts
import { test, expect } from '@playwright/test';

test('scene renders correctly', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000); // 等待渲染稳定

    // 截图并对比
    await expect(page).toHaveScreenshot('scene-default.png', {
        maxDiffPixelRatio: 0.01
    });
});

test('object selection highlights', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(1000);

    // 点击物体
    await page.mouse.click(400, 300);
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('scene-selected.png', {
        maxDiffPixelRatio: 0.01
    });
});
```

## 处理非确定性渲染

3D 渲染可能有微小的不确定性（浮点精度、随机种子、时间依赖）。解决方案：

```ts
// 固定随机种子
Math.random = () => 0.5;

// 固定时间
const FIXED_TIME = 1700000000000;
performance.now = () => FIXED_TIME;

// 固定相机
camera.position.set(5, 5, 10);
camera.lookAt(0, 0, 0);
```

## WebGL 状态测试

不只测像素，还可以测 WebGL 状态：

```ts
test('draw calls count', async ({ page }) => {
    await page.goto('http://localhost:3000');

    const stats = await page.evaluate(() => {
        const info = (window as any).__rendererInfo;
        return {
            drawCalls: info.render.calls,
            triangles: info.render.triangles,
            geometries: info.memory.geometries
        };
    });

    expect(stats.drawCalls).toBeLessThan(100);
    expect(stats.triangles).toBeLessThan(500000);
});
```

## 性能基准测试

```ts
test('frame time under budget', async ({ page }) => {
    await page.goto('http://localhost:3000');

    const frameTimes = await page.evaluate(async () => {
        const times: number[] = [];
        for (let i = 0; i < 60; i++) {
            const start = performance.now();
            (window as any).__render();
            times.push(performance.now() - start);
            await new Promise(r => requestAnimationFrame(r));
        }
        return times;
    });

    const avg = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
    const p95 = frameTimes.sort((a, b) => a - b)[Math.floor(frameTimes.length * 0.95)];

    expect(avg).toBeLessThan(16.67); // 60fps 预算
    expect(p95).toBeLessThan(33.33); // 95th percentile < 30fps
});
```

## 单元测试：数学和逻辑

渲染之外的代码可以正常单元测试：

```ts
// tests/math.test.ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

describe('Octree', () => {
    it('should find objects in query range', () => {
        const octree = new Octree(new THREE.Box3(
            new THREE.Vector3(-100, -100, -100),
            new THREE.Vector3(100, 100, 100)
        ));

        const obj = { position: new THREE.Vector3(5, 5, 5) };
        octree.insert(obj);

        const results = octree.query(new THREE.Sphere(
            new THREE.Vector3(0, 0, 0), 20
        ));
        expect(results).toContain(obj);
    });
});

describe('CommandHistory', () => {
    it('should undo and redo', () => {
        const history = new CommandHistory();
        let value = 0;

        history.execute({
            type: 'set',
            execute: () => { value = 1; },
            undo: () => { value = 0; }
        });

        expect(value).toBe(1);
        history.undo();
        expect(value).toBe(0);
        history.redo();
        expect(value).toBe(1);
    });
});
```

## 测试金字塔

```
        /  \
       / E2E \      ← 少量，截图对比
      /--------\
     / 集成测试  \   ← 中量，模块交互
    /------------\
   /   单元测试    \  ← 大量，纯逻辑
  /________________\
```

3D 应用的测试重点：

- **单元测试**：数学计算、场景管理器、命令系统、序列化
- **集成测试**：加载器 + 场景、物理 + 渲染
- **E2E 测试**：关键路径的截图对比（不要求覆盖所有状态）

## CI 集成

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
    test:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
            - run: npm ci
            - run: npm run test:unit      # 单元测试
            - run: npx playwright install  # 安装浏览器
            - run: npm run test:visual     # 视觉测试
```

视觉测试在 CI 中可能因为 GPU 差异而失败。解决方案：

1. 用 `--update-snapshots` 更新基准图
2. 增大容差
3. 只在特定环境跑视觉测试

## 练习

### 练习一：实现截图对比

写一个函数 `assertScreenshotMatch(actual: string, expected: string, tolerance: number)`，对比两张 base64 编码的 PNG 截图。返回差异百分比和差异图。

### 练习二：Playwright 视觉测试

用 Playwright 为一个 Three.js 场景写 3 个视觉测试：

1. 默认渲染正确
2. 物体选中后高亮
3. 不同相机角度渲染正确

### 练习三：性能断言

写一个测试，验证：

1. 场景 draw call < 200
2. 三角形数 < 100000
3. 帧时间 < 16.67ms

---

## 参考答案

### 练习一

```ts
async function assertScreenshotMatch(
    actual: string,
    expected: string,
    tolerance: number
): Promise<{ match: boolean; diff: number }> {
    const loadImage = (src: string): Promise<ImageData> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0);
                resolve(ctx.getImageData(0, 0, img.width, img.height));
            };
            img.src = src;
        });
    };

    const [actualImg, expectedImg] = await Promise.all([
        loadImage(actual),
        loadImage(expected)
    ]);

    const result = compareImages(actualImg, expectedImg, tolerance);
    return { match: result.match, diff: result.diffPercentage };
}
```

### 练习二

```ts
import { test, expect } from '@playwright/test';

test('default render', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot('default.png', { maxDiffPixelRatio: 0.01 });
});

test('selection highlight', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(1000);
    await page.mouse.click(400, 300);
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('selected.png', { maxDiffPixelRatio: 0.01 });
});

test('different angle', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
        (window as any).__setCameraAngle(Math.PI / 4, Math.PI / 4);
    });
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('angle45.png', { maxDiffPixelRatio: 0.01 });
});
```

### 练习三

```ts
test('performance budget', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);

    const stats = await page.evaluate(() => {
        const renderer = (window as any).__renderer;
        const info = renderer.info;
        const times: number[] = [];

        for (let i = 0; i < 30; i++) {
            const start = performance.now();
            renderer.render((window as any).__scene, (window as any).__camera);
            times.push(performance.now() - start);
        }

        return {
            drawCalls: info.render.calls,
            triangles: info.render.triangles,
            avgFrameTime: times.reduce((a, b) => a + b) / times.length
        };
    });

    expect(stats.drawCalls).toBeLessThan(200);
    expect(stats.triangles).toBeLessThan(100000);
    expect(stats.avgFrameTime).toBeLessThan(16.67);
});
```

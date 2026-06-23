# 阶段实战：为 3D 应用完成完整性能优化

## 目标

用前四节课的分析方法和优化手段，为一个"有问题"的 3D 场景做完整性能优化。不是理论讲解，是动手排查和修复。

## 准备一个"慢"场景

先创建一个有明显性能问题的场景：

```ts
function createSlowScene(): THREE.Scene {
    const scene = new THREE.Scene();

    // 问题 1：每个物体独立材质（1000 种材质 = 1000 次材质切换）
    for (let i = 0; i < 1000; i++) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff })
        );
        mesh.position.set(
            Math.random() * 100 - 50,
            Math.random() * 10,
            Math.random() * 100 - 50
        );
        scene.add(mesh);
    }

    // 问题 2：大纹理（4K 纹理用在小物体上）
    const texture = new THREE.TextureLoader().load('4096x4096.png');

    // 问题 3：每帧更新所有物体的矩阵（即使没动）
    // 默认 matrixAutoUpdate = true

    // 问题 4：没有视锥裁剪优化
    // 默认 frustumCulled = true，但物体分散在大区域

    return scene;
}
```

## 第一步：量化现状

```ts
function measureBaseline(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const info = renderer.info;
    const frameTimes: number[] = [];

    // 预热
    for (let i = 0; i < 10; i++) {
        renderer.render(scene, camera);
    }

    // 测量 60 帧
    for (let i = 0; i < 60; i++) {
        const start = performance.now();
        renderer.render(scene, camera);
        frameTimes.push(performance.now() - start);
    }

    frameTimes.sort((a, b) => a - b);

    return {
        avgFrameTime: frameTimes.reduce((a, b) => a + b) / frameTimes.length,
        p50FrameTime: frameTimes[30],
        p95FrameTime: frameTimes[57],
        maxFrameTime: frameTimes[59],
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures
    };
}
```

预期数据：

```
avgFrameTime: ~15ms
drawCalls: ~1000
triangles: ~12000
geometries: ~1000
textures: ~1001
```

draw call 是主要瓶颈——1000 次材质切换。

## 第二步：分析瓶颈

```ts
function analyzeBottlenecks(stats: ReturnType<typeof measureBaseline>) {
    const issues: string[] = [];

    if (stats.drawCalls > 200) {
        issues.push(`Draw calls too high: ${stats.drawCalls}. Target: <200`);
    }
    if (stats.geometries > 500) {
        issues.push(`Too many geometries: ${stats.geometries}. Consider merging.`);
    }
    if (stats.textures > 50) {
        issues.push(`Too many textures: ${stats.textures}. Consider atlas.`);
    }
    if (stats.p95FrameTime > 16.67) {
        issues.push(`Frame time budget exceeded: ${stats.p95FrameTime.toFixed(2)}ms`);
    }

    return issues;
}
```

## 第三步：优化方案

### 优化 1：材质共享

```ts
function optimizeMaterials(scene: THREE.Scene) {
    const colorGroups = new Map<number, THREE.Mesh[]>();

    scene.traverse(obj => {
        if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            const color = (mesh.material as THREE.MeshStandardMaterial).color.getHex();
            if (!colorGroups.has(color)) colorGroups.set(color, []);
            colorGroups.get(color)!.push(mesh);
        }
    });

    // 每组共享一个材质
    for (const [color, meshes] of colorGroups) {
        const material = new THREE.MeshStandardMaterial({ color });
        for (const mesh of meshes) {
            mesh.material.dispose();
            mesh.material = material;
        }
    }

    return colorGroups.size; // 返回材质数量
}
```

### 优化 2：几何体合并

```ts
function mergeStaticMeshes(scene: THREE.Scene) {
    const materialGroups = new Map<THREE.Material, THREE.Mesh[]>();

    scene.traverse(obj => {
        if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            if (!materialGroups.has(mesh.material as THREE.Material)) {
                materialGroups.set(mesh.material as THREE.Material, []);
            }
            materialGroups.get(mesh.material as THREE.Material)!.push(mesh);
        }
    });

    let mergedCount = 0;
    for (const [material, meshes] of materialGroups) {
        if (meshes.length < 2) continue;

        const geometries = meshes.map(m => {
            const geo = m.geometry.clone();
            geo.applyMatrix4(m.matrixWorld);
            return geo;
        });

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        const mergedMesh = new THREE.Mesh(merged, material);
        scene.add(mergedMesh);

        // 移除原始物体
        for (const mesh of meshes) {
            scene.remove(mesh);
            mesh.geometry.dispose();
        }
        mergedCount += meshes.length;
    }

    return mergedCount;
}
```

### 优化 3：纹理优化

```ts
function optimizeTextures(scene: THREE.Scene) {
    scene.traverse(obj => {
        if ((obj as THREE.Mesh).isMesh) {
            const material = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (material.map) {
                // 降低纹理分辨率
                const image = material.map.image;
                if (image && image.width > 1024) {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1024;
                    canvas.height = 1024;
                    canvas.getContext('2d')!.drawImage(image, 0, 0, 1024, 1024);
                    material.map.image = canvas;
                    material.map.needsUpdate = true;
                }
            }
        }
    });
}
```

### 优化 4：静态物体矩阵优化

```ts
function optimizeStaticTransforms(scene: THREE.Scene) {
    let count = 0;
    scene.traverse(obj => {
        if ((obj as THREE.Mesh).isMesh) {
            obj.matrixAutoUpdate = false;
            obj.updateMatrix();
            obj.updateMatrixWorld();
            count++;
        }
    });
    return count;
}
```

## 第四步：验证优化效果

```ts
function runOptimization() {
    const scene = createSlowScene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(0, 20, 50);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(1920, 1080);

    // 优化前
    const before = measureBaseline(renderer, scene, camera);
    console.log('Before:', before);
    console.log('Issues:', analyzeBottlenecks(before));

    // 逐步优化
    const materialCount = optimizeMaterials(scene);
    console.log(`Shared materials: ${materialCount}`);

    const mergedCount = mergeStaticMeshes(scene);
    console.log(`Merged meshes: ${mergedCount}`);

    optimizeTextures(scene);
    optimizeStaticTransforms(scene);

    // 优化后
    const after = measureBaseline(renderer, scene, camera);
    console.log('After:', after);

    // 对比
    console.log('\nImprovement:');
    console.log(`Draw calls: ${before.drawCalls} → ${after.drawCalls}`);
    console.log(`Geometries: ${before.geometries} → ${after.geometries}`);
    console.log(`Avg frame time: ${before.avgFrameTime.toFixed(2)}ms → ${after.avgFrameTime.toFixed(2)}ms`);
}
```

预期结果：

```
Before:
  drawCalls: ~1000
  geometries: ~1000
  avgFrameTime: ~15ms

After:
  drawCalls: ~10 (每种材质一个)
  geometries: ~10 (每种材质合并后的几何体)
  avgFrameTime: ~2ms
```

## 第五步：建立性能预算

```ts
const PERFORMANCE_BUDGET = {
    maxDrawCalls: 100,
    maxTriangles: 500000,
    maxGeometries: 100,
    maxTextures: 50,
    maxFrameTime: 16.67, // 60fps
    maxMemory: 200 * 1024 * 1024 // 200MB
};

function checkBudget(stats: ReturnType<typeof measureBaseline>): string[] {
    const violations: string[] = [];

    if (stats.drawCalls > PERFORMANCE_BUDGET.maxDrawCalls) {
        violations.push(`Draw calls: ${stats.drawCalls}/${PERFORMANCE_BUDGET.maxDrawCalls}`);
    }
    if (stats.triangles > PERFORMANCE_BUDGET.maxTriangles) {
        violations.push(`Triangles: ${stats.triangles}/${PERFORMANCE_BUDGET.maxTriangles}`);
    }
    // ... 其他检查

    return violations;
}
```

## 练习

### 练习一：完整优化流程

基于上面的代码，完成一个完整的优化流程。要求：

1. 创建一个有 500 个物体的"慢"场景
2. 测量优化前的性能数据
3. 执行至少 3 种优化
4. 测量优化后的性能数据
5. 输出对比报告

### 练习二：性能预算 CI

写一个测试，验证场景满足性能预算。如果超过预算，测试失败并输出具体超标项。

### 练习三：自定义优化器

实现一个 `SceneOptimizer` 类，自动检测场景中的性能问题并应用修复：

```ts
class SceneOptimizer {
    analyze(scene: THREE.Scene): { issue: string; fix: () => void }[] { ... }
    optimize(scene: THREE.Scene): void { ... }
}
```

---

## 参考答案

### 练习一

代码框架已在上面给出。关键补充：

```ts
// 创建"慢"场景
function createSlowScene() {
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0x404040));
    scene.add(new THREE.DirectionalLight(0xffffff, 1));

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 500; i++) {
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.8, 0.5)
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            Math.random() * 50 - 25,
            Math.random() * 10,
            Math.random() * 50 - 25
        );
        scene.add(mesh);
    }
    return scene;
}
```

### 练习二

```ts
test('scene meets performance budget', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);

    const stats = await page.evaluate(() => {
        const renderer = (window as any).__renderer;
        const info = renderer.info;
        return {
            drawCalls: info.render.calls,
            triangles: info.render.triangles,
            geometries: info.memory.geometries,
            textures: info.memory.textures
        };
    });

    const violations = [];
    if (stats.drawCalls > 100) violations.push(`Draw calls: ${stats.drawCalls}`);
    if (stats.triangles > 500000) violations.push(`Triangles: ${stats.triangles}`);
    if (stats.geometries > 100) violations.push(`Geometries: ${stats.geometries}`);

    expect(violations).toEqual([]);
});
```

### 练习三

```ts
class SceneOptimizer {
    analyze(scene: THREE.Scene) {
        const issues: { issue: string; fix: () => void }[] = [];

        // 检查材质重复
        const materials = new Map<string, THREE.Mesh[]>();
        scene.traverse(obj => {
            if ((obj as THREE.Mesh).isMesh) {
                const mesh = obj as THREE.Mesh;
                const key = JSON.stringify((mesh.material as any).toJSON());
                if (!materials.has(key)) materials.set(key, []);
                materials.get(key)!.push(mesh);
            }
        });

        for (const [key, meshes] of materials) {
            if (meshes.length > 10) {
                issues.push({
                    issue: `${meshes.length} meshes with identical material`,
                    fix: () => {
                        const shared = meshes[0].material;
                        meshes.forEach(m => { m.material = shared; });
                    }
                });
            }
        }

        return issues;
    }

    optimize(scene: THREE.Scene) {
        const issues = this.analyze(scene);
        for (const issue of issues) {
            console.log(`Fixing: ${issue.issue}`);
            issue.fix();
        }
    }
}
```

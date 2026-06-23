# 阶段实战：阅读 Three.js 源码，画出完整渲染调用链

## 这节课要做什么

前四节课分别讲了场景图、渲染管线、几何缓冲区、材质系统。这节课把它们串起来——通过阅读 Three.js 源码，画出从 `renderer.render(scene, camera)` 到 `gl.drawElements()` 的完整调用链。

这不是学术练习。你遇到性能问题时，需要知道"慢在哪一步"；你需要自定义渲染行为时，需要知道"在哪里插入"。这些都依赖对调用链的理解。

## 源码在哪里

Three.js 的渲染核心在 `src/renderers/` 目录下：

```
src/renderers/
├── WebGLRenderer.js          # 主入口
├── webgl/
│   ├── WebGLRenderLists.js   # 渲染列表管理
│   ├── WebGLPrograms.js      # shader program 管理
│   ├── WebGLProgram.js       # 单个 program 封装
│   ├── WebGLState.js         # GL 状态管理
│   ├── WebGLTextures.js      # 纹理管理
│   ├── WebGLGeometries.js    # 几何体管理
│   ├── WebGLMaterials.js     # 材质管理
│   ├── WebGLObjects.js       # 物体管理
│   └── WebGLBufferRenderer.js # draw call 发射
```

## 第一步：render() 入口

```ts
// src/renderers/WebGLRenderer.js
render(scene, camera) {
    // 1. 参数检查
    // 2. 更新场景图
    scene.updateMatrixWorld();

    // 3. 确保相机矩阵是最新的
    camera.updateMatrixWorld();

    // 4. 准备渲染列表
    if (scene.isScene) {
        scene.onBeforeRender(this, scene, camera, _currentRenderTarget);
    }

    _currentMaterialId = -1;
    _currentCamera = camera;

    // 5. 编译渲染列表
    _currentRenderList = _renderLists.get(scene, camera);
    _currentRenderList.init();

    // 6. 投影矩阵（用于视锥裁剪）
    _projScreenMatrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
    );
    _frustum.setFromProjectionMatrix(_projScreenMatrix);

    // 7. 遍历场景图，收集物体
    projectObject(scene, scene, camera);

    // 8. 排序
    _currentRenderList.sort();

    // 9. 渲染背景
    renderBackground(scene);

    // 10. 渲染不透明物体
    renderScene(_currentRenderList.opaque, scene, camera);

    // 11. 渲染透明物体
    renderScene(_currentRenderList.transparent, scene, camera);

    // 12. 清理
    if (scene.isScene) {
        scene.onAfterRender(this, scene, camera, _currentRenderTarget);
    }
}
```

## 第二步：projectObject——场景图遍历

```ts
function projectObject(object, scene, camera) {
    if (!object.visible) return;

    // 检查是否是光源、反射探针等
    if (object.isLight) {
        // 收集光源信息
    } else if (object.isMesh || object.isLine || object.isPoints) {
        // 关键：检查是否在视锥内
        if (object.frustumCulled === false || _frustum.intersectsObject(object)) {
            // 收集到渲染列表
            _currentRenderList.push(
                object,
                object.geometry,
                object.material,
                object.renderOrder,
                _vector3.setFromMatrixPosition(object.matrixWorld) // 用于距离排序
            );
        }
    }

    // 递归子节点
    for (const child of object.children) {
        projectObject(child, scene, camera);
    }
}
```

注意 `_vector3.setFromMatrixPosition(object.matrixWorld)` ——这在遍历时就计算了物体的世界坐标，后面排序时直接用。

## 第三步：RenderList 排序

```ts
// src/renderers/webgl/WebGLRenderLists.js
sort(customOpaqueSort, customTransparentSort) {
    if (this.opaque.length > 1) {
        this.opaque.sort(customOpaqueSort || painterSortStable);
    }
    if (this.transparent.length > 1) {
        this.transparent.sort(customTransparentSort || reversePainterSortStable);
    }
}
```

排序函数回顾：

- 不透明：先按 material.id，再按 renderOrder，最后按 z
- 透明：先按 renderOrder，再按 material.id，最后按 z（反向）

## 第四步：renderScene——发射 draw call

```ts
function renderScene(renderList, scene, camera) {
    for (let i = 0; i < renderList.length; i++) {
        const renderItem = renderList[i];
        const { object, geometry, material, group } = renderItem;

        // 设置物体的 modelView 矩阵
        object.modelViewMatrix.multiplyMatrices(
            camera.matrixWorldInverse,
            object.matrixWorld
        );
        object.normalMatrix.getNormalMatrix(object.modelViewMatrix);

        // 渲染物体
        renderObject(object, scene, camera, geometry, material, group);
    }
}
```

## 第五步：renderObject——状态切换

```ts
function renderObject(object, scene, camera, geometry, material, group) {
    // onBeforeRender 钩子
    object.onBeforeRender(this, scene, camera, geometry, material, group);

    // 应用材质（切换 shader、绑定 uniform、绑定纹理）
    material.onBeforeRender(this, scene, camera, geometry, material, group);

    // 获取或创建 WebGLProgram
    const program = setProgram(camera, scene, material, object);

    // 设置物体特定的 uniform
    program.getUniforms().setValue('modelMatrix', object.matrixWorld);
    program.getUniforms().setValue('modelViewMatrix', object.modelViewMatrix);
    program.getUniforms().setValue('normalMatrix', object.normalMatrix);

    // 绑定几何体缓冲区
    const buffers = geometries.get(geometry);
    state.setVertexArrays(buffers);

    // 发射 draw call
    if (geometry.index !== null) {
        const index = geometry.index;
        renderer.render(buffers, index); // gl.drawElements
    } else {
        renderer.render(buffers); // gl.drawArrays
    }

    object.onAfterRender(this, scene, camera, geometry, material, group);
}
```

## 第六步：setProgram——材质切换的核心

```ts
function setProgram(camera, scene, material, object) {
    // 检查是否需要切换材质
    let needsProgramChange = false;

    if (material.version !== materialProperties.__version) {
        needsProgramChange = true;
    }

    // 获取或编译 shader program
    const program = programCache.acquireProgram(material, parameters);

    if (program.code !== _currentProgramCode) {
        // 切换 shader program
        gl.useProgram(program.program);
        _currentProgramCode = program.code;
    }

    // 更新 uniform
    materialProperties.currentProgram = program;
    materialProperties.uniforms = program.getUniforms();

    // 上传 uniform 值
    const uniforms = materialProperties.uniforms;
    uniforms.setValue('projectionMatrix', camera.projectionMatrix);
    uniforms.setValue('viewMatrix', camera.matrixWorldInverse);

    // 处理材质特定的 uniform
    refreshMaterialUniforms(uniforms, material);

    return program;
}
```

## 完整调用链图

```
renderer.render(scene, camera)
│
├── scene.updateMatrixWorld()          ← 场景图矩阵更新
│   └── Object3D.updateMatrixWorld()   ← 递归，dirty flag
│
├── camera.updateMatrixWorld()
│
├── _renderLists.get(scene, camera)    ← 获取/创建 RenderList
│
├── projectObject(scene)               ← 遍历场景图
│   ├── 检查 visible
│   ├── 视锥裁剪（Frustum.intersectsObject）
│   └── 收集到 opaque / transparent 列表
│
├── _currentRenderList.sort()          ← 排序
│   ├── opaque: painterSortStable (material.id → renderOrder → z)
│   └── transparent: reversePainterSortStable (renderOrder → material.id → -z)
│
├── renderBackground()
│
├── renderScene(opaque)
│   └── renderObject() × N
│       ├── onBeforeRender()
│       ├── setProgram()
│       │   ├── programCache.acquireProgram()
│       │   ├── gl.useProgram()       ← shader 切换
│       │   └── refreshMaterialUniforms() ← uniform 上传
│       ├── state.setVertexArrays()    ← VAO 绑定
│       ├── gl.drawElements()          ← draw call
│       └── onAfterRender()
│
└── renderScene(transparent)
    └── renderObject() × N
```

## 你需要做的练习

### 练习一：找到 draw call 发射点

在 Three.js 源码中找到 `gl.drawElements()` 或 `gl.drawArrays()` 的调用位置。回答：

1. 它在哪个文件的哪个函数里？
2. draw call 之前做了哪些状态设置？
3. draw call 之后做了什么清理？

### 练习二：添加自定义渲染钩子

利用 `onBeforeRender` 和 `onAfterRender`，为每个 Mesh 添加渲染计数器。在每帧结束时，输出每个材质被渲染了多少次。

```ts
const renderCounts = new Map();

// 你的实现
```

### 练习三：画自己的调用链图

基于源码阅读，用你自己的理解画一张调用链图。要求标注：

1. 每一步的输入和输出
2. 可能的性能瓶颈点
3. 可以插入自定义逻辑的位置

---

## 参考答案

### 练习一

`gl.drawElements()` 在 `src/renderers/webgl/WebGLBufferRenderer.js` 的 `render()` 方法中。之前的操作包括：绑定 VAO、设置 element array buffer、检查实例化渲染。之后通常没有清理（GPU 异步执行）。

### 练习二

```ts
const renderCounts = new Map<string, number>();

mesh.onBeforeRender = () => {
    const key = mesh.material.type;
    renderCounts.set(key, (renderCounts.get(key) || 0) + 1);
};

// 每帧结束时
function logRenderCounts() {
    for (const [type, count] of renderCounts) {
        console.log(`${type}: ${count} draw calls`);
    }
    renderCounts.clear();
}
```

### 练习三

调用链中的关键瓶颈：

1. `projectObject` 遍历——物体数量多时遍历慢
2. `sort()` 排序——物体多时排序慢
3. `setProgram` 状态切换——材质种类多时切换频繁
4. `gl.drawElements` 本身——三角形极多时才成为瓶颈

可插入自定义逻辑的位置：

- `onBeforeRender`：物体级别
- `material.onBeforeCompile`：shader 级别
- `scene.onBeforeRender`：场景级别

# 插件系统——事件总线、扩展注册、生命周期管理

## 为什么编辑器需要插件系统

一个 3D 编辑器如果把所有功能都写在核心代码里——选择、变换、材质编辑、动画编辑、导出、导入、性能分析——代码会变成一团意大利面。每个功能都依赖其他功能，改一个地方牵动全身。

插件系统的目标：让功能可以独立开发、独立加载、独立卸载。

## 事件总线：插件间的通信

插件之间不应该直接引用。A 插件不需要知道 B 插件的存在，只需要通过事件通信：

```ts
class EventBus {
    private listeners = new Map<string, Set<Function>>();

    on(event: string, callback: Function) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
        return () => this.off(event, callback); // 返回取消函数
    }

    off(event: string, callback: Function) {
        this.listeners.get(event)?.delete(callback);
    }

    emit(event: string, ...args: any[]) {
        this.listeners.get(event)?.forEach(cb => cb(...args));
    }

    once(event: string, callback: Function) {
        const unsub = this.on(event, (...args) => {
            unsub();
            callback(...args);
        });
        return unsub;
    }
}

// 全局事件总线
export const eventBus = new EventBus();
```

使用模式：

```ts
// 选择插件
eventBus.emit('selection:changed', selectedObjects);

// 材质插件
eventBus.on('selection:changed', (objects) => {
    if (objects.length === 1 && objects[0].material) {
        showMaterialEditor(objects[0].material);
    }
});
```

## 插件的接口定义

每个插件需要暴露统一的接口：

```ts
interface EditorPlugin {
    name: string;
    version: string;

    // 生命周期
    init(context: EditorContext): void;
    destroy(): void;

    // 可选
    onActivate?(): void;
    onDeactivate?(): void;
    serialize?(): any;       // 保存插件状态
    deserialize?(data: any): void; // 恢复插件状态
}

interface EditorContext {
    scene: THREE.Scene;
    camera: THREE.Camera;
    renderer: THREE.WebGLRenderer;
    eventBus: EventBus;
    selection: SelectionManager;
    history: CommandHistory;
}
```

`EditorContext` 是插件和编辑器核心之间的契约。插件通过 context 访问编辑器能力，不直接 import 核心模块。

## 插件注册与管理

```ts
class PluginManager {
    private plugins = new Map<string, EditorPlugin>();
    private context: EditorContext;

    constructor(context: EditorContext) {
        this.context = context;
    }

    register(plugin: EditorPlugin) {
        if (this.plugins.has(plugin.name)) {
            throw new Error(`Plugin ${plugin.name} already registered`);
        }
        plugin.init(this.context);
        this.plugins.set(plugin.name, plugin);
    }

    unregister(name: string) {
        const plugin = this.plugins.get(name);
        if (plugin) {
            plugin.destroy();
            this.plugins.delete(name);
        }
    }

    activate(name: string) {
        this.plugins.get(name)?.onActivate?.();
    }

    deactivate(name: string) {
        this.plugins.get(name)?.onDeactivate?.();
    }

    serialize(): any {
        const state: any = {};
        for (const [name, plugin] of this.plugins) {
            if (plugin.serialize) {
                state[name] = plugin.serialize();
            }
        }
        return state;
    }
}
```

## 生命周期管理

插件的生命周期：

```
register → init → (activate ↔ deactivate) → destroy
```

`init` 做一次性初始化（注册事件监听、创建 UI 容器）。

`activate/deactivate` 做功能的启用/禁用（显示/隐藏面板、启用/禁用快捷键）。

`destroy` 做清理（移除事件监听、销毁 UI、释放资源）。

常见错误：插件注册了事件监听但没在 destroy 时取消，导致内存泄漏。

```ts
class MaterialPlugin implements EditorPlugin {
    name = 'material-editor';
    version = '1.0.0';
    private unsubscribes: Function[] = [];

    init(context: EditorContext) {
        // 注册事件，保存取消函数
        this.unsubscribes.push(
            context.eventBus.on('selection:changed', this.onSelectionChange)
        );
        this.unsubscribes.push(
            context.eventBus.on('scene:modified', this.onSceneChange)
        );
    }

    destroy() {
        // 取消所有事件监听
        this.unsubscribes.forEach(unsub => unsub());
        this.unsubscribes = [];
    }

    private onSelectionChange = (objects: THREE.Object3D[]) => {
        // 处理选择变化
    }

    private onSceneChange = () => {
        // 处理场景变化
    }
}
```

## 实现一个具体的插件：网格辅助线

```ts
class GridPlugin implements EditorPlugin {
    name = 'grid';
    version = '1.0.0';
    private grid: THREE.GridHelper;
    private context: EditorContext;

    init(context: EditorContext) {
        this.context = context;
        this.grid = new THREE.GridHelper(100, 100, 0x888888, 0x444444);
        context.scene.add(this.grid);
    }

    destroy() {
        this.context.scene.remove(this.grid);
        this.grid.geometry.dispose();
        (this.grid.material as THREE.Material).dispose();
    }

    serialize() {
        return { visible: this.grid.visible, size: 100 };
    }

    deserialize(data: any) {
        this.grid.visible = data.visible;
    }
}
```

## 插件之间的依赖

有些插件依赖其他插件。比如"材质编辑器"依赖"选择插件"提供的选中物体信息。

处理依赖的方式：

```ts
interface EditorPlugin {
    // ...
    dependencies?: string[]; // 依赖的插件名称
}

// 注册时检查依赖
register(plugin: EditorPlugin) {
    if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
            if (!this.plugins.has(dep)) {
                throw new Error(`Plugin ${plugin.name} requires ${dep}`);
            }
        }
    }
    // ...
}
```

## UI 集成模式

插件通常需要 UI 面板。两种集成方式：

**声明式**：插件返回 UI 描述，编辑器负责渲染。

```ts
interface EditorPlugin {
    // ...
    getPanel?(): PanelConfig;
}

interface PanelConfig {
    title: string;
    component: any; // React/Vue 组件
    position: 'left' | 'right' | 'bottom';
}
```

**命令式**：插件直接操作 DOM 或 UI 框架。

```ts
init(context: EditorContext) {
    const panel = document.createElement('div');
    panel.innerHTML = '<button id="toggle-grid">Toggle Grid</button>';
    document.getElementById('sidebar')!.appendChild(panel);
}
```

声明式更好维护，但命令式更灵活。

## 练习

### 练习一：实现事件总线

实现上面的 EventBus 类，要求：

- 支持 `on`、`off`、`emit`、`once`
- 返回取消函数
- 处理回调中的异常（一个回调抛错不影响其他回调）

### 练习二：实现选择插件

创建一个 SelectionPlugin，功能：

- 点击物体时添加到选择列表
- 支持多选（Shift+点击）
- 通过事件总线广播选择变化
- 提供 `getSelected()` 方法

### 练习三：插件生命周期测试

创建两个插件 A 和 B，B 依赖 A。测试：

1. 先注册 B（应该报错）
2. 先注册 A，再注册 B
3. 销毁 A，验证 B 的行为
4. 验证事件监听是否正确清理

---

## 参考答案

### 练习一

```ts
class EventBus {
    private listeners = new Map<string, Set<Function>>();

    on(event: string, callback: Function) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
        return () => this.off(event, callback);
    }

    off(event: string, callback: Function) {
        this.listeners.get(event)?.delete(callback);
    }

    emit(event: string, ...args: any[]) {
        const cbs = this.listeners.get(event);
        if (!cbs) return;
        for (const cb of cbs) {
            try {
                cb(...args);
            } catch (e) {
                console.error(`Event handler error for "${event}":`, e);
            }
        }
    }

    once(event: string, callback: Function) {
        const unsub = this.on(event, (...args) => {
            unsub();
            callback(...args);
        });
        return unsub;
    }
}
```

### 练习二

```ts
class SelectionPlugin implements EditorPlugin {
    name = 'selection';
    version = '1.0.0';
    private selected = new Set<THREE.Object3D>();
    private context!: EditorContext;
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();

    init(context: EditorContext) {
        this.context = context;
        context.renderer.domElement.addEventListener('click', this.onClick);
    }

    destroy() {
        this.context.renderer.domElement.removeEventListener('click', this.onClick);
        this.selected.clear();
    }

    private onClick = (event: MouseEvent) => {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.context.camera);
        const hits = this.raycaster.intersectObjects(
            this.context.scene.children, true
        );

        if (event.shiftKey) {
            if (hits.length > 0) {
                const obj = hits[0].object;
                if (this.selected.has(obj)) {
                    this.selected.delete(obj);
                } else {
                    this.selected.add(obj);
                }
            }
        } else {
            this.selected.clear();
            if (hits.length > 0) this.selected.add(hits[0].object);
        }

        this.context.eventBus.emit('selection:changed', [...this.selected]);
    }

    getSelected() { return [...this.selected]; }
}
```

### 练习三

关键验证点：

1. 注册 B 时检查 dependencies，A 未注册则抛错
2. 销毁 A 后，B 仍然存在但可能功能异常（取决于实现）
3. destroy 后事件监听数为 0（通过 EventBus 的 listeners Map 验证）

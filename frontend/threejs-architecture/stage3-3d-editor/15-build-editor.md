# 阶段实战：构建简化版 3D 编辑器

## 目标

把前三阶段的知识组合成一个可工作的 3D 编辑器原型。不要求完整功能，要求架构清晰。

核心功能：

1. 场景中有物体列表
2. 点击选中物体
3. 移动 Gizmo 拖拽移动
4. Ctrl+Z / Ctrl+Y 撤销重做
5. 保存/加载场景

## 架构总览

```
Editor
├── Core
│   ├── Scene           # THREE.Scene
│   ├── Camera          # THREE.PerspectiveCamera
│   ├── Renderer        # THREE.WebGLRenderer
│   └── RenderLoop      # requestAnimationFrame
├── Input
│   ├── MouseHandler    # 鼠标事件
│   └── KeyboardHandler # 键盘快捷键
├── Interaction
│   ├── SelectionManager
│   └── TransformControls
├── History
│   └── CommandHistory
├── Serialization
│   └── SceneSerializer
└── UI
    ├── Outliner         # 物体列表
    ├── Properties       # 属性面板
    └── Toolbar          # 工具栏
```

## 第一步：Editor 核心

```ts
class Editor {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    history: CommandHistory;
    selection: SelectionManager;
    eventBus: EventBus;

    constructor(container: HTMLElement) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75, window.innerWidth / window.innerHeight, 0.1, 1000
        );
        this.camera.position.set(5, 5, 10);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(this.renderer.domElement);

        this.eventBus = new EventBus();
        this.history = new CommandHistory();
        this.selection = new SelectionManager(this);

        this.setupLights();
        this.setupGrid();
        this.setupControls();
        this.setupKeyboard();
        this.animate();
    }

    private setupLights() {
        const ambient = new THREE.AmbientLight(0x404040);
        const directional = new THREE.DirectionalLight(0xffffff, 1);
        directional.position.set(5, 10, 7);
        this.scene.add(ambient, directional);
    }

    private setupGrid() {
        const grid = new THREE.GridHelper(20, 20, 0x888888, 0x444444);
        this.scene.add(grid);
    }

    private setupControls() {
        const controls = new OrbitControls(this.camera, this.renderer.domElement);
        controls.enableDamping = true;
        (this as any).controls = controls;
    }

    private setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.history.undo();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                this.history.redo();
            }
            if (e.key === 'Delete') {
                this.deleteSelected();
            }
        });
    }

    private animate = () => {
        requestAnimationFrame(this.animate);
        (this as any).controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    addObject(object: THREE.Object3D) {
        const cmd = new CreateCommand(this.scene, object);
        this.history.execute(cmd);
        this.eventBus.emit('scene:changed');
    }

    deleteSelected() {
        const selected = this.selection.getSelected();
        for (const obj of selected) {
            const cmd = new DeleteCommand(this.scene, obj);
            this.history.execute(cmd);
        }
        this.selection.clear();
        this.eventBus.emit('scene:changed');
    }
}
```

## 第二步：选择管理

```ts
class SelectionManager {
    private selected = new Set<THREE.Object3D>();
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();
    private highlights = new Map<THREE.Object3D, THREE.Mesh>();

    constructor(private editor: Editor) {
        editor.renderer.domElement.addEventListener('click', this.onClick);
    }

    private onClick = (event: MouseEvent) => {
        // 忽略 UI 元素的点击
        if (event.target !== this.editor.renderer.domElement) return;

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.editor.camera);
        const hits = this.raycaster.intersectObjects(
            this.editor.scene.children, true
        );

        const hit = hits.find(h => h.object.userData.selectable !== false);

        if (!hit) {
            this.clear();
        } else if (event.shiftKey) {
            this.toggle(hit.object);
        } else {
            this.clear();
            this.add(hit.object);
        }
    }

    add(object: THREE.Object3D) {
        this.selected.add(object);
        this.addHighlight(object);
        this.editor.eventBus.emit('selection:changed', [...this.selected]);
    }

    clear() {
        for (const obj of this.selected) {
            this.removeHighlight(obj);
        }
        this.selected.clear();
        this.editor.eventBus.emit('selection:changed', []);
    }

    toggle(object: THREE.Object3D) {
        if (this.selected.has(object)) {
            this.selected.delete(object);
            this.removeHighlight(object);
        } else {
            this.selected.add(object);
            this.addHighlight(object);
        }
        this.editor.eventBus.emit('selection:changed', [...this.selected]);
    }

    getSelected(): THREE.Object3D[] {
        return [...this.selected];
    }

    private addHighlight(object: THREE.Object3D) {
        if (!(object as THREE.Mesh).isMesh) return;
        const box = new THREE.BoxHelper(object, 0xffff00);
        this.editor.scene.add(box);
        this.highlights.set(object, box as any);
    }

    private removeHighlight(object: THREE.Object3D) {
        const highlight = this.highlights.get(object);
        if (highlight) {
            this.editor.scene.remove(highlight);
            this.highlights.delete(object);
        }
    }
}
```

## 第三步：TransformControls 集成

```ts
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';

class TransformManager {
    private controls: TransformControls;
    private currentObject: THREE.Object3D | null = null;
    private startPosition: THREE.Vector3 = new THREE.Vector3();

    constructor(private editor: Editor) {
        this.controls = new TransformControls(
            editor.camera,
            editor.renderer.domElement
        );
        this.controls.addEventListener('dragging-changed', (event) => {
            (editor as any).controls.enabled = !event.value;
        });
        this.controls.addEventListener('objectChange', this.onTransform);
        editor.scene.add(this.controls);

        editor.eventBus.on('selection:changed', this.onSelectionChange);
    }

    private onSelectionChange = (objects: THREE.Object3D[]) => {
        if (objects.length === 1) {
            this.attach(objects[0]);
        } else {
            this.detach();
        }
    }

    attach(object: THREE.Object3D) {
        this.currentObject = object;
        this.startPosition.copy(object.position);
        this.controls.attach(object);
    }

    detach() {
        this.currentObject = null;
        this.controls.detach();
    }

    setMode(mode: 'translate' | 'rotate' | 'scale') {
        this.controls.setMode(mode);
    }

    private onTransform = () => {
        if (!this.currentObject) return;

        // 创建移动命令
        const cmd = new MoveCommand(
            this.currentObject,
            this.startPosition.clone(),
            this.currentObject.position.clone()
        );

        // 不立即执行（TransformControls 已经移动了物体）
        // 只是记录到历史
        this.editor.history.execute(cmd);
        this.startPosition.copy(this.currentObject.position);
    }
}
```

## 第四步：UI 面板

```ts
class Outliner {
    private container: HTMLElement;

    constructor(private editor: Editor) {
        this.container = document.createElement('div');
        this.container.id = 'outliner';
        this.container.style.cssText = `
            position: absolute; top: 10px; left: 10px;
            width: 200px; background: rgba(0,0,0,0.8);
            color: white; padding: 10px; font-family: monospace;
        `;
        document.body.appendChild(this.container);

        editor.eventBus.on('scene:changed', this.update);
        editor.eventBus.on('selection:changed', this.update);
        this.update();
    }

    private update = () => {
        const selected = new Set(this.editor.selection.getSelected());
        this.container.innerHTML = '<h3>Outliner</h3>';

        this.editor.scene.children.forEach(obj => {
            if (obj.userData.selectable === false) return;
            const div = document.createElement('div');
            div.textContent = obj.name || obj.type;
            div.style.cssText = `
                padding: 4px 8px; cursor: pointer;
                background: ${selected.has(obj) ? '#333' : 'transparent'};
            `;
            div.onclick = () => {
                this.editor.selection.clear();
                this.editor.selection.add(obj);
            };
            this.container.appendChild(div);
        });
    }
}
```

## 第五步：组装

```ts
const editor = new Editor(document.getElementById('app')!);

// 添加一些物体
const box = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xff0000 })
);
box.name = 'Red Box';
editor.addObject(box);

const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0x00ff00 })
);
sphere.position.x = 3;
sphere.name = 'Green Sphere';
editor.addObject(sphere);

// 初始化 UI
const outliner = new Outliner(editor);
const transform = new TransformManager(editor);

// 工具栏
document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'g': transform.setMode('translate'); break;
        case 'r': transform.setMode('rotate'); break;
        case 's': transform.setMode('scale'); break;
    }
});
```

## 练习

### 练习一：完成编辑器

基于上面的代码，完成一个可运行的编辑器。要求：

- 能添加 Box 和 Sphere
- 能选中、移动、删除
- Ctrl+Z / Ctrl+Y 有效
- 有 Outliner 面板显示物体列表

### 练习二：添加保存/加载

实现保存场景到 localStorage 和从 localStorage 加载。使用第 13 节的序列化方案。

### 练习三：添加插件

实现一个 WireframePlugin，功能：

- 工具栏按钮切换线框显示
- 给所有 Mesh 叠加线框
- 支持撤销/重做

---

## 参考答案

### 练习一

代码框架已在上面给出。关键补充：

```ts
// 在 Editor 构造函数最后
window.addEventListener('resize', () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
});
```

### 练习二

```ts
// 保存
function saveToLocalStorage(editor: Editor) {
    const serializer = new SceneSerializer();
    const data = serializer.serialize(editor.scene);
    localStorage.setItem('editor-scene', JSON.stringify(data));
}

// 加载
function loadFromLocalStorage(editor: Editor) {
    const json = localStorage.getItem('editor-scene');
    if (!json) return;
    const data = JSON.parse(json);
    const serializer = new SceneSerializer();
    const scene = serializer.deserialize(data);
    // 清空当前场景，加载新场景
    while (editor.scene.children.length > 0) {
        editor.scene.remove(editor.scene.children[0]);
    }
    scene.children.forEach(obj => editor.scene.add(obj));
}
```

### 练习三

```ts
class WireframePlugin implements EditorPlugin {
    name = 'wireframe';
    version = '1.0.0';
    private wireframes = new Map<THREE.Mesh, THREE.LineSegments>();
    private enabled = false;

    init(context: EditorContext) {
        context.eventBus.on('scene:changed', this.update);
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            this.addWireframes();
        } else {
            this.removeWireframes();
        }
    }

    private addWireframes() {
        this.context.scene.traverse(obj => {
            if ((obj as THREE.Mesh).isMesh) {
                const mesh = obj as THREE.Mesh;
                const wire = new THREE.WireframeGeometry(mesh.geometry);
                const line = new THREE.LineSegments(wire,
                    new THREE.LineBasicMaterial({ color: 0x00ff00 }));
                mesh.add(line);
                this.wireframes.set(mesh, line);
            }
        });
    }

    private removeWireframes() {
        for (const [mesh, line] of this.wireframes) {
            mesh.remove(line);
        }
        this.wireframes.clear();
    }
}
```

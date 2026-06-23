# 场景序列化——JSON/GLTF 导出、自定义格式设计

## 3D 场景需要"保存"和"加载"

编辑器做好的场景需要保存到文件，下次打开时恢复。这要求把 Three.js 的场景图——Object3D、Mesh、Material、Geometry——转换成可存储的格式。

## Three.js 内置的 JSON 格式

Three.js 有自己的 JSON 序列化：

```ts
// 导出
const json = scene.toJSON();
const jsonStr = JSON.stringify(json, null, 2);

// 导入
const loader = new THREE.ObjectLoader();
const loadedScene = loader.parse(json);
```

`toJSON()` 生成的结构：

```json
{
    "metadata": {
        "version": 4.6,
        "type": "Object",
        "generator": "Object3D.toJSON"
    },
    "object": {
        "uuid": "...",
        "type": "Scene",
        "children": [
            {
                "type": "Mesh",
                "geometry": "geometry-uuid-1",
                "material": "material-uuid-1",
                "position": [0, 0, 0],
                "rotation": [0, 0, 0],
                "scale": [1, 1, 1]
            }
        ],
        "geometries": [
            {
                "uuid": "geometry-uuid-1",
                "type": "BoxGeometry",
                "width": 1,
                "height": 1,
                "depth": 1
            }
        ],
        "materials": [
            {
                "uuid": "material-uuid-1",
                "type": "MeshStandardMaterial",
                "color": 16711680,
                "roughness": 0.5,
                "metalness": 0.1
            }
        ]
    }
}
```

注意几何体和材质是按 UUID 引用的，而不是嵌套在物体里。多个物体可以引用同一个几何体/材质。

## JSON 格式的问题

Three.js 的 JSON 格式有几个限制：

1. **不支持纹理**：纹理图片不会内嵌，只存 URL
2. **不支持自定义属性**：自定义 geometry attribute 丢失
3. **体积大**：顶点数据以 JSON 数组存储，比二进制大 3-4 倍
4. **不通用**：其他工具读不了

## GLTF：工业标准

GLTF（GL Transmission Format）是 3D 行业的标准格式。Three.js 通过 `GLTFExporter` 支持导出：

```ts
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';

const exporter = new GLTFExporter();

// 导出为 GLB（二进制 GLTF）
exporter.parse(
    scene,
    (glb) => {
        // glb 是 ArrayBuffer
        const blob = new Blob([glb], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        // 触发下载
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scene.glb';
        a.click();
    },
    (error) => console.error(error),
    { binary: true }
);
```

GLTF 的优势：

- 行业标准，Blender/Unity/Unreal 都支持
- 二进制格式（GLB）体积小
- 支持纹理（嵌入或外部引用）
- 支持动画、材质、相机

## 自定义序列化格式

很多 3D 应用需要自定义格式，因为：

- 需要存储应用特有的数据（编辑器状态、图层信息、权限）
- 需要增量更新（只保存变化部分）
- 需要版本兼容（旧版本文件能被新版本读取）

自定义格式的设计：

```ts
interface SceneFile {
    version: number;
    metadata: {
        created: string;
        modified: string;
        author: string;
    };
    objects: SerializedObject[];
    resources: {
        geometries: SerializedGeometry[];
        materials: SerializedMaterial[];
        textures: SerializedTexture[];
    };
}

interface SerializedObject {
    uuid: string;
    type: string;
    name: string;
    transform: {
        position: [number, number, number];
        rotation: [number, number, number];
        scale: [number, number, number];
    };
    geometryRef?: string;  // UUID 引用
    materialRef?: string;  // UUID 引用
    children: string[];    // 子对象 UUID 列表
    customData?: any;      // 应用特有数据
}
```

## 纹理的序列化策略

纹理不能简单地 JSON.stringify。策略：

1. **外部引用**：只存 URL，加载时重新请求。适合 web 应用。
2. **Base64 内嵌**：把图片转成 Base64 编码。文件自包含但体积大。
3. **二进制打包**：纹理作为独立文件，和场景描述文件一起打包。

```ts
// Base64 内嵌
async function serializeTexture(texture: THREE.Texture): Promise<string> {
    const canvas = document.createElement('canvas');
    const image = texture.image;
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d')!.drawImage(image, 0, 0);
    return canvas.toDataURL('image/png');
}

// 恢复
function deserializeTexture(data: string): THREE.Texture {
    const loader = new THREE.TextureLoader();
    const texture = loader.load(data);
    return texture;
}
```

## 大场景的增量序列化

完整序列化一个 10 万面片的场景可能需要几秒。编辑器通常用增量策略：

- 首次保存：完整序列化
- 后续保存：只序列化变化的部分

```ts
class IncrementalSerializer {
    private lastSnapshot: Map<string, string> = new Map();

    save(scene: THREE.Scene): { added: any[], modified: any[], removed: string[] } {
        const current = new Map<string, string>();
        const added = [];
        const modified = [];
        const removed = [];

        scene.traverse(obj => {
            const json = JSON.stringify(obj.toJSON());
            current.set(obj.uuid, json);

            if (!this.lastSnapshot.has(obj.uuid)) {
                added.push(obj.toJSON());
            } else if (this.lastSnapshot.get(obj.uuid) !== json) {
                modified.push(obj.toJSON());
            }
        });

        for (const [uuid] of this.lastSnapshot) {
            if (!current.has(uuid)) removed.push(uuid);
        }

        this.lastSnapshot = current;
        return { added, modified, removed };
    }
}
```

## 版本兼容

文件格式会随功能迭代变化。需要版本兼容策略：

```ts
function loadScene(data: any): THREE.Scene {
    const version = data.version || 1;

    // 版本迁移
    if (version < 2) {
        data = migrateV1ToV2(data);
    }
    if (version < 3) {
        data = migrateV2ToV3(data);
    }

    // 当前版本解析
    return parseSceneV3(data);
}

function migrateV1ToV2(data: any): any {
    // V1 的 position 是 {x,y,z}，V2 改成 [x,y,z]
    for (const obj of data.objects) {
        if (obj.transform.position.x !== undefined) {
            obj.transform.position = [
                obj.transform.position.x,
                obj.transform.position.y,
                obj.transform.position.z
            ];
        }
    }
    data.version = 2;
    return data;
}
```

## 练习

### 练习一：自定义 JSON 序列化

实现 `serializeScene(scene)` 和 `deserializeScene(json)` 函数。要求：

- 支持 Mesh、Group、PointLight
- 几何体和材质按 UUID 引用
- 支持 MeshStandardMaterial 的主要属性

### 练习二：GLTF 导出实验

创建一个包含 3 个不同材质物体的场景，用 GLTFExporter 导出为 GLB 文件。然后用 GLTFLoader 加载回来，验证场景是否正确恢复。

### 练习三：增量序列化测试

实现增量序列化，测试：

1. 保存初始场景
2. 添加一个物体，保存增量
3. 修改一个物体的位置，保存增量
4. 删除一个物体，保存增量
5. 用这三次增量恢复最终场景

---

## 参考答案

### 练习一

```ts
function serializeScene(scene: THREE.Scene): any {
    const geometries: any[] = [];
    const materials: any[] = [];
    const geometrySet = new Set<string>();
    const materialSet = new Set<string>();

    function serializeObject(obj: THREE.Object3D): any {
        const result: any = {
            uuid: obj.uuid,
            type: obj.type,
            name: obj.name,
            position: obj.position.toArray(),
            rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
            scale: obj.scale.toArray()
        };

        if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            if (mesh.geometry && !geometrySet.has(mesh.geometry.uuid)) {
                geometrySet.add(mesh.geometry.uuid);
                geometries.push(serializeGeometry(mesh.geometry));
            }
            if (mesh.material && !materialSet.has(mesh.material.uuid)) {
                materialSet.add(mesh.material.uuid);
                materials.push(serializeMaterial(mesh.material));
            }
            result.geometryRef = mesh.geometry.uuid;
            result.materialRef = mesh.material.uuid;
        }

        result.children = obj.children.map(c => serializeObject(c));
        return result;
    }

    return {
        version: 1,
        object: serializeObject(scene),
        geometries,
        materials
    };
}
```

### 练习二

GLTFExporter 会把几何体转成 GLTF 的 accessors，材质转成 PBR material。加载回来后材质参数基本一致，但 ShaderMaterial 会丢失。

### 练习三

增量格式示例：

```json
{ "type": "delta", "added": [{...}], "modified": [], "removed": [] }
```

恢复时按顺序应用每个增量即可。

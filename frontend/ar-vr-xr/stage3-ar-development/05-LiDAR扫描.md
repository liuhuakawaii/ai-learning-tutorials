# LiDAR 环境扫描

## 场景引入

你走进一个空荡荡的房间，打开手机 AR 扫描功能，举着手机绕房间走一圈。几秒钟后，屏幕上出现完整的房间 3D 模型——墙壁、门窗、家具都精确还原。然后打开家具商城 App，把虚拟沙发"放"在客厅里，大小、位置、阴影都与真实环境完美融合。

这就是 LiDAR 环境扫描的能力——通过激光测距获取环境深度信息，构建三维网格，让虚拟内容与真实环境进行物理级别的交互。

## 学习目标

- 理解 LiDAR 传感器的工作原理和数据格式
- 使用 WebXR Mesh Detection 获取环境网格
- 实现点云处理与三维重建
- 构建基于环境网格的碰撞检测系统

## 核心概念

### LiDAR 工作原理

LiDAR（Light Detection And Ranging）通过发射激光脉冲并测量反射时间计算距离。移动设备使用 dToF 方案，每秒采集数万个深度点。iPhone 12 Pro 及以后的 Pro 机型、iPad Pro 都配备 LiDAR。

### 环境网格

环境网格将离散深度点连接成三角网格：`深度图 → 点云生成 → 表面重建 → 三角网格`。

## WebXR Mesh Detection

```javascript
class LiDARScanner {
  constructor() {
    this.meshes = new Map();
    this.session = null;
    this.callbacks = { meshAdded: [], meshUpdated: [] };
  }

  async start() {
    this.session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['local', 'mesh-detection'],
      optionalFeatures: ['depth-sensing', 'hit-test'],
      depthSensing: { usagePreference: ['cpu-optimized'], dataFormatPreference: ['float32'] }
    });
    this.session.addEventListener('mesheschanged', this.onMeshesChanged.bind(this));
    return this.session;
  }

  onMeshesChanged(event) {
    for (const mesh of event.detector.meshes) {
      const isNew = !this.meshes.has(mesh.meshSpace);
      this.meshes.set(mesh.meshSpace, mesh);
      this.emit(isNew ? 'meshAdded' : 'meshUpdated', mesh);
    }
  }

  on(event, cb) { this.callbacks[event]?.push(cb); }
  emit(event, data) { this.callbacks[event]?.forEach(cb => cb(data)); }

  getMeshVertices(mesh) {
    return {
      vertices: new Float32Array(mesh.positions),
      indices: new Uint32Array(mesh.indices),
      normals: mesh.normals ? new Float32Array(mesh.normals) : null
    };
  }
}
```

### 环境网格渲染

```javascript
import * as THREE from 'three';

class EnvironmentMeshRenderer {
  constructor(scene) {
    this.scene = scene;
    this.meshObjects = new Map();
    this.material = new THREE.MeshStandardMaterial({
      color: 0x888888, transparent: true, opacity: 0.3, side: THREE.DoubleSide
    });
    this.wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00, wireframe: true, transparent: true, opacity: 0.5
    });
  }

  addMesh(meshId, meshData, pose) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(meshData.vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
    geometry.computeVertexNormals();

    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, this.material.clone()));
    group.add(new THREE.Mesh(geometry, this.wireframeMaterial.clone()));
    group.position.setFromMatrixPosition(pose);
    group.quaternion.setFromRotationMatrix(pose);
    this.meshObjects.set(meshId, group);
    this.scene.add(group);
  }

  updateMesh(meshId, meshData, pose) {
    const group = this.meshObjects.get(meshId);
    if (!group) return;
    group.children.forEach(child => {
      child.geometry.setAttribute('position', new THREE.BufferAttribute(meshData.vertices, 3));
      child.geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
      child.geometry.attributes.position.needsUpdate = true;
      child.geometry.computeVertexNormals();
    });
    group.position.setFromMatrixPosition(pose);
    group.quaternion.setFromRotationMatrix(pose);
  }

  removeMesh(meshId) {
    const group = this.meshObjects.get(meshId);
    if (group) {
      this.scene.remove(group);
      group.children.forEach(c => { c.geometry.dispose(); c.material.dispose(); });
      this.meshObjects.delete(meshId);
    }
  }

  setOpacity(v) { this.meshObjects.forEach(o => { o.children[0].material.opacity = v; }); }
}
```

## 碰撞检测

```javascript
class EnvironmentCollider {
  constructor() { this.colliders = []; this.raycaster = new THREE.Raycaster(); }

  addColliderFromMesh(meshData, pose) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(meshData.vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry);
    mesh.position.setFromMatrixPosition(pose);
    mesh.quaternion.setFromRotationMatrix(pose);
    mesh.updateMatrixWorld(true);
    this.colliders.push(mesh);
  }

  raycast(origin, direction, maxDistance = 10) {
    this.raycaster.set(origin, direction);
    this.raycaster.far = maxDistance;
    const hits = this.raycaster.intersectObjects(this.colliders);
    return hits.length > 0 ? hits[0] : null;
  }

  sphereCollision(center, radius) {
    const dirs = [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0),
                  new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0),
                  new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)];
    for (const dir of dirs) {
      const hit = this.raycast(center, dir, radius);
      if (hit) return { hit: true, point: hit.point, normal: hit.face.normal };
    }
    return { hit: false };
  }
}
```

## 项目实践：AR 家具摆放

```javascript
class ARFurniturePlacer {
  constructor() {
    this.scanner = new LiDARScanner();
    this.collider = new EnvironmentCollider();
    this.placedFurniture = [];
    this.selectedModel = null;
  }

  async init(scene, camera, renderer) {
    this.scene = scene;
    this.meshRenderer = new EnvironmentMeshRenderer(scene);
    this.scanner.on('meshAdded', (m) => this.onMeshAdded(m));
    this.scanner.on('meshUpdated', (m) => this.onMeshUpdated(m));
    await this.scanner.start();
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    renderer.domElement.addEventListener('select', this.onSelect.bind(this));
  }

  onMeshAdded(mesh) {
    const frame = this.scanner.session.currentFrame;
    const refSpace = this.scanner.session.requestReferenceSpace('local');
    const pose = frame.getPose(mesh.meshSpace, refSpace);
    const meshData = this.scanner.getMeshVertices(mesh);
    this.meshRenderer.addMesh(mesh.meshSpace, meshData, pose.transform.matrix);
    this.collider.addColliderFromMesh(meshData, new THREE.Matrix4().fromArray(pose.transform.matrix));
  }

  onMeshUpdated(mesh) {
    const frame = this.scanner.session.currentFrame;
    const refSpace = this.scanner.session.requestReferenceSpace('local');
    const pose = frame.getPose(mesh.meshSpace, refSpace);
    const meshData = this.scanner.getMeshVertices(mesh);
    this.meshRenderer.updateMesh(mesh.meshSpace, meshData, pose.transform.matrix);
  }

  async onSelect(event) {
    if (!this.selectedModel) return;
    const hitSource = await this.scanner.session.requestHitTestSource({ space: this.scanner.session.viewerSpace });
    const hits = event.frame.getHitTestResults(hitSource);
    if (hits.length > 0) {
      const pose = hits[0].getPose(this.scanner.session.requestReferenceSpace('local'));
      const loader = new THREE.GLTFLoader();
      const gltf = await new Promise(r => loader.load(this.selectedModel, r));
      const model = gltf.scene;
      model.position.setFromMatrixPosition(pose.transform.matrix);
      model.quaternion.setFromRotationMatrix(pose.transform.matrix);
      this.scene.add(model);
      this.placedFurniture.push({ model, modelUrl: this.selectedModel });
    }
  }

  toggleMeshVisibility(visible) { this.meshRenderer.setOpacity(visible ? 0.3 : 0); }
}
```

## 常见误区

### 1. 以为所有设备都有 LiDAR

LiDAR 仅在 iPhone Pro 和 iPad Pro 上配备。应用必须提供降级方案，如纯视觉 SLAM。

### 2. 环境网格可以直接用于物理模拟

扫描的网格有噪声和空洞，直接用于物理模拟会导致穿模。需要网格简化、孔洞填充等预处理。

### 3. 忽视扫描质量的影响

扫描质量直接决定 AR 内容稳定性。UI 上应提供扫描进度和质量指标。

## 工程建议

1. **扫描引导**：可视化扫描进度，提示用户覆盖所有区域
2. **网格缓存**：扫描结果缓存到本地，下次直接加载
3. **LOD 策略**：远处低精度，近处高精度
4. **遮挡处理**：利用环境网格实现正确遮挡关系
5. **功耗管理**：非必要时暂停 LiDAR 扫描

## 小结

LiDAR 环境扫描将 AR 从"叠加虚拟内容"提升到"理解真实环境"。通过深度传感器获取三维结构，实现精确的虚拟物体放置和碰撞检测。

## 练习

### 练习一：网格简化算法

实现网格简化，将三角形数量减少到 25%，同时保持几何特征。

### 练习二：AR 测量工具

基于 LiDAR 深度数据，用户在两点间画线，系统显示实际距离。

---

## 参考答案

### 练习一

**思路**：边折叠算法，优先折叠短边和平坦区域。顶点映射管理合并关系，退化三角形自动消除。

**答案**：

```javascript
class MeshSimplifier {
  constructor(targetRatio = 0.25) { this.targetRatio = targetRatio; }

  simplify(vertices, indices) {
    const target = Math.floor(indices.length / 3 * this.targetRatio);
    const vMap = new Map();
    for (let i = 0; i < vertices.length / 3; i++) vMap.set(i, i);

    const edges = [];
    for (let i = 0; i < indices.length; i += 3) {
      for (const [a, b] of [[0,1],[1,2],[2,0]]) {
        const v0 = indices[i+a], v1 = indices[i+b];
        const dx = vertices[v0*3]-vertices[v1*3], dy = vertices[v0*3+1]-vertices[v1*3+1], dz = vertices[v0*3+2]-vertices[v1*3+2];
        edges.push({ v0, v1, cost: Math.sqrt(dx*dx+dy*dy+dz*dz) });
      }
    }
    edges.sort((a, b) => a.cost - b.cost);

    const resolve = (v) => { while (vMap.get(v) !== v) v = vMap.get(v); return v; };
    let triCount = indices.length / 3;

    for (const edge of edges) {
      if (triCount <= target) break;
      const v0 = resolve(edge.v0), v1 = resolve(edge.v1);
      if (v0 === v1) continue;
      vMap.set(v1, v0);
      vertices[v0*3] = (vertices[v0*3]+vertices[v1*3])/2;
      vertices[v0*3+1] = (vertices[v0*3+1]+vertices[v1*3+1])/2;
      vertices[v0*3+2] = (vertices[v0*3+2]+vertices[v1*3+2])/2;
      triCount--;
    }

    const newIdx = [];
    for (let i = 0; i < indices.length; i += 3) {
      const a = resolve(indices[i]), b = resolve(indices[i+1]), c = resolve(indices[i+2]);
      if (a !== b && b !== c && a !== c) newIdx.push(a, b, c);
    }
    return { vertices, indices: new Uint32Array(newIdx), triangleCount: newIdx.length / 3 };
  }
}
```

**要点**：边折叠是最经典的简化算法；中点位置是简化版本，生产环境应使用 QEM。

### 练习二

**思路**：hit-test 获取 3D 表面坐标，保存两个端点计算欧几里得距离，Three.js Line 绘制测量线。

**答案**：

```javascript
class ARMeasureTool {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.points = []; this.line = null; this.label = null;
    this.markers = []; this.measurements = [];
  }

  async addPoint(hitResult, frame, referenceSpace) {
    const pose = hitResult.getPose(referenceSpace);
    const pos = new THREE.Vector3(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x2196f3 })
    );
    marker.position.copy(pos);
    this.scene.add(marker);
    this.markers.push(marker);
    this.points.push(pos);

    if (this.points.length === 2) {
      const [start, end] = this.points;
      const distance = start.distanceTo(end);

      this.line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([start, end]),
        new THREE.LineBasicMaterial({ color: 0x2196f3 })
      );
      this.scene.add(this.line);

      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      mid.y += 0.05;
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.roundRect(0, 0, 256, 64, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`${(distance*100).toFixed(1)} cm`, 128, 42);

      this.label = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false })
      );
      this.label.scale.set(0.2, 0.05, 1);
      this.label.position.copy(mid);
      this.scene.add(this.label);

      const result = { start: start.clone(), end: end.clone(), distance };
      this.measurements.push(result);
      this.points = [];
      return result;
    }
    return null;
  }

  clear() {
    if (this.line) { this.scene.remove(this.line); this.line.geometry.dispose(); }
    if (this.label) { this.scene.remove(this.label); }
    this.markers.forEach(m => { this.scene.remove(m); m.geometry.dispose(); });
    this.markers = []; this.points = [];
  }
}
```

**要点**：hit-test 将 2D 屏幕点击转换为 3D 表面交点；精灵图标签始终面向相机；自动米转厘米。

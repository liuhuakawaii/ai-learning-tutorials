# GPS 地理定位 AR

## 场景引入

你走在一条陌生的商业街上，打开手机 AR 导航，屏幕上浮现出附近餐厅、咖啡店的名称和距离。走到一个历史景点，手机自动弹出这个建筑的历史介绍。这就是 GPS 地理定位 AR——将虚拟信息锚定在真实世界的地理位置上，是 Pokémon Go 等应用的技术基础。

## 学习目标

- 理解 GPS 定位精度的物理限制及补偿策略
- 使用 Geolocation API 获取设备位置
- 实现地理围栏触发机制
- 构建 POI 标注与渲染系统

## 核心概念

### GPS 定位精度

| 环境 | 精度 | 说明 |
|------|------|------|
| 室外开阔 | 3-5 米 | 最佳条件 |
| 城市街道 | 5-15 米 | 建筑遮挡导致多径效应 |
| 室内 | 无法定位 | 信号无法穿透建筑 |

5-15 米的误差意味着虚拟标注可能"漂浮"在错误位置，需要辅助定位手段。

### 地理围栏与坐标转换

地理围栏是虚拟的地理边界，设备进入或离开时触发动作。将经纬度转换为 3D 坐标需要 Haversine 公式计算距离、球面三角公式计算方位角。

## Geolocation API

```javascript
class GeoLocator {
  constructor() {
    this.currentPosition = null;
    this.watchId = null;
    this.callbacks = [];
  }

  async getCurrentPosition() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.currentPosition = {
            latitude: pos.coords.latitude, longitude: pos.coords.longitude,
            altitude: pos.coords.altitude, accuracy: pos.coords.accuracy,
            heading: pos.coords.heading
          };
          resolve(this.currentPosition);
        },
        reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  startWatching() {
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.currentPosition = {
          latitude: pos.coords.latitude, longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy, heading: pos.coords.heading
        };
        this.callbacks.forEach(cb => cb(this.currentPosition));
      },
      (err) => console.error('定位错误:', err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 1000 }
    );
  }

  onUpdate(callback) { this.callbacks.push(callback); }
  stop() { if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId); }
}
```

### 坐标转换工具

```javascript
class GeoMath {
  static EARTH_RADIUS = 6371000;
  static toRadians(deg) { return deg * Math.PI / 180; }
  static toDegrees(rad) { return rad * 180 / Math.PI; }

  static distance(lat1, lon1, lat2, lon2) {
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon/2)**2;
    return this.EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  static bearing(lat1, lon1, lat2, lon2) {
    const dLon = this.toRadians(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(this.toRadians(lat2));
    const x = Math.cos(this.toRadians(lat1)) * Math.sin(this.toRadians(lat2)) -
              Math.sin(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.cos(dLon);
    return (this.toDegrees(Math.atan2(y, x)) + 360) % 360;
  }

  static geoToLocal(userLat, userLon, poiLat, poiLon, poiAlt = 0) {
    const dist = this.distance(userLat, userLon, poiLat, poiLon);
    const brng = this.toRadians(this.bearing(userLat, userLon, poiLat, poiLon));
    return { x: dist * Math.sin(brng), y: poiAlt, z: -dist * Math.cos(brng) };
  }
}
```

## 地理围栏系统

```javascript
class GeofenceManager {
  constructor() {
    this.fences = new Map();
    this.insideFences = new Set();
    this.callbacks = { enter: [], exit: [] };
  }

  addFence(fence) {
    this.fences.set(fence.id, {
      ...fence, centerLat: fence.center.latitude, centerLon: fence.center.longitude
    });
  }

  onEnter(callback) { this.callbacks.enter.push(callback); }
  onExit(callback) { this.callbacks.exit.push(callback); }

  update(userLat, userLon) {
    for (const [id, fence] of this.fences) {
      const dist = GeoMath.distance(userLat, userLon, fence.centerLat, fence.centerLon);
      const isInside = dist <= fence.radius;
      const wasInside = this.insideFences.has(id);
      if (isInside && !wasInside) {
        this.insideFences.add(id);
        this.callbacks.enter.forEach(cb => cb(fence, dist));
      } else if (!isInside && wasInside) {
        this.insideFences.delete(id);
        this.callbacks.exit.forEach(cb => cb(fence, dist));
      }
    }
  }
}
```

## POI 标注渲染

```javascript
class POIManager {
  constructor(scene) {
    this.scene = scene;
    this.pois = [];
    this.poiGroup = new THREE.Group();
    this.scene.add(this.poiGroup);
    this.maxRenderDistance = 500;
  }

  addPOI(config) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.roundRect(0, 0, 256, 128, 12); ctx.fill();
    ctx.font = '48px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(config.icon || '📍', 128, 50);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif';
    ctx.fillText(config.title, 128, 85);

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false })
    );
    sprite.scale.set(1.5, 0.75, 1);
    this.poiGroup.add(sprite);
    this.pois.push({
      id: config.id, latitude: config.latitude, longitude: config.longitude,
      title: config.title, icon: config.icon || '📍', sprite, distance: 0
    });
  }

  update(userLat, userLon) {
    for (const poi of this.pois) {
      const localPos = GeoMath.geoToLocal(userLat, userLon, poi.latitude, poi.longitude);
      poi.sprite.position.set(localPos.x, localPos.y + 1.5, localPos.z);
      poi.distance = GeoMath.distance(userLat, userLon, poi.latitude, poi.longitude);
      poi.sprite.visible = poi.distance <= this.maxRenderDistance;
      if (poi.sprite.visible) {
        poi.sprite.material.opacity = Math.max(0.3, 1 - poi.distance / this.maxRenderDistance);
        this.updateLabel(poi);
      }
    }
  }

  updateLabel(poi) {
    const canvas = poi.sprite.material.map.image;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.roundRect(0, 0, 256, 128, 12); ctx.fill();
    ctx.font = '48px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(poi.icon, 128, 50);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.fillText(poi.title, 128, 85);
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#aaa';
    ctx.fillText(poi.distance >= 1000 ? `${(poi.distance/1000).toFixed(1)} km` : `${Math.round(poi.distance)} m`, 128, 110);
    poi.sprite.material.map.needsUpdate = true;
  }
}
```

## 项目实践：AR 城市导览

```javascript
class CityARGuide {
  constructor() {
    this.locator = new GeoLocator();
    this.geofenceManager = new GeofenceManager();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  }

  async init(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    renderer.xr.enabled = true;
    renderer.setSize(window.innerWidth, window.innerHeight);
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['local'],
      optionalFeatures: ['geo', 'dom-overlay'],
      domOverlay: { root: document.getElementById('ui') }
    });
    await renderer.xr.setSession(session);

    this.poiManager = new POIManager(this.scene);
    await this.locator.getCurrentPosition();
    this.locator.startWatching();
    this.locator.onUpdate((pos) => {
      this.geofenceManager.update(pos.latitude, pos.longitude);
      this.poiManager.update(pos.latitude, pos.longitude);
    });
    this.geofenceManager.onEnter((fence) => {
      const n = document.getElementById('notification');
      n.textContent = `您已进入 ${fence.name} 区域`;
      n.classList.add('visible');
      setTimeout(() => n.classList.remove('visible'), 3000);
    });
    renderer.setAnimationLoop(() => renderer.render(this.scene, this.camera));
  }
}
```

## 常见误区

### 1. 过度依赖 GPS 精度

GPS 5-15 米误差对 AR 场景不够。GPS 适合粗定位，精确定位需要视觉方案辅助。

### 2. 忽视坐标系转换

经度 1° 对应的地面距离随纬度变化。必须使用 Haversine 公式，不能直接用经纬度差值。

### 3. 不考虑设备朝向

AR 中 POI 位置需要相对于用户视角方向。用户转身 180° 时 POI 应出现在背后，必须结合罗盘数据。

## 工程建议

1. **多源融合**：GPS 粗定位 + 视觉/SLAM 精定位 + IMU 姿态补偿
2. **缓存策略**：POI 数据按地理区块缓存，预加载相邻区块
3. **精度提示**：UI 上显示定位精度，不足时提示用户移动到开阔区域
4. **省电优化**：非导航状态降低 GPS 更新频率
5. **离线支持**：预下载热门区域 POI 数据

## 小结

GPS 地理定位 AR 将虚拟信息锚定在真实地理位置上。关键挑战在于 GPS 精度有限，需要通过地理围栏、距离筛选、多源融合等策略优化体验。

## 练习

### 练习一：距离衰减渲染

实现 POI 渲染：50 米内完全不透明，50-200 米线性衰减，200 米外只显示图标，500 米外隐藏。

### 练习二：AR 指南针

实现 AR 指南针，显示 N/S/E/W 方向，精度 ±5°，处理罗盘噪声。

---

## 参考答案

### 练习一

**思路**：分段函数控制透明度和内容显隐，信息渐进降级。

**答案**：

```javascript
class DistanceBasedPOIRenderer {
  updatePOI(poi, distance) {
    if (distance < 50) {
      poi.sprite.visible = true; poi.sprite.material.opacity = 1.0;
      poi.showTitle = true; poi.showDescription = true;
    } else if (distance < 200) {
      poi.sprite.visible = true;
      poi.sprite.material.opacity = 1.0 - (distance - 50) / 150;
      poi.showTitle = true; poi.showDescription = false;
    } else if (distance < 500) {
      poi.sprite.visible = true; poi.sprite.material.opacity = 0.6;
      poi.showTitle = false; poi.sprite.scale.set(0.75, 0.375, 1);
    } else {
      poi.sprite.visible = false;
    }
  }

  renderAll(pois, userLat, userLon) {
    for (const poi of pois) {
      const dist = GeoMath.distance(userLat, userLon, poi.latitude, poi.longitude);
      this.updatePOI(poi, dist);
    }
  }
}
```

**要点**：四个渲染区域清晰定义；缩放让远处 POI 占用更少空间；信息渐进降级避免远处信息过载。

### 练习二

**思路**：DeviceOrientationEvent 获取罗盘朝向，一阶低通滤波平滑噪声，Canvas 绘制刻度盘。

**答案**：

```javascript
class ARCompass {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.heading = 0; this.smoothed = 0; this.alpha = 0.15; this.initialized = false;
  }

  async start() {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') return false;
    }
    window.addEventListener('deviceorientation', (e) => {
      if (e.alpha === null) return;
      let heading = e.webkitCompassHeading !== undefined ? e.webkitCompassHeading : 360 - e.alpha;
      if (!this.initialized) { this.smoothed = heading; this.initialized = true; }
      let diff = heading - this.smoothed;
      if (diff > 180) diff -= 360; if (diff < -180) diff += 360;
      this.smoothed = (this.smoothed + diff * this.alpha + 360) % 360;
      this.heading = this.smoothed;
    });
    return true;
  }

  render() {
    const { width, height } = this.canvas;
    const cx = width / 2, cy = height / 2, r = Math.min(cx, cy) * 0.4;
    this.ctx.clearRect(0, 0, width, height);

    for (let deg = 0; deg < 360; deg += 10) {
      const angle = ((deg - this.heading) * Math.PI) / 180 - Math.PI / 2;
      const inner = deg % 30 === 0 ? r - 15 : r - 8;
      this.ctx.strokeStyle = deg % 90 === 0 ? '#fff' : '#666';
      this.ctx.lineWidth = deg % 90 === 0 ? 2 : 1;
      this.ctx.beginPath();
      this.ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      this.ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      this.ctx.stroke();
    }

    [{ l: 'N', d: 0, c: '#f44336' }, { l: 'E', d: 90 }, { l: 'S', d: 180 }, { l: 'W', d: 270 }
    ].forEach(({ l, d, c }) => {
      const angle = ((d - this.heading) * Math.PI) / 180 - Math.PI / 2;
      this.ctx.fillStyle = c || '#fff'; this.ctx.font = 'bold 16px sans-serif';
      this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
      this.ctx.fillText(l, cx + Math.cos(angle) * (r - 28), cy + Math.sin(angle) * (r - 28));
    });

    this.ctx.fillStyle = '#2196f3';
    this.ctx.beginPath(); this.ctx.moveTo(cx, cy - r - 5);
    this.ctx.lineTo(cx - 6, cy - r + 5); this.ctx.lineTo(cx + 6, cy - r + 5); this.ctx.fill();
    this.ctx.fillStyle = '#fff'; this.ctx.font = '14px monospace'; this.ctx.textAlign = 'center';
    this.ctx.fillText(`${Math.round(this.heading)}°`, cx, cy + r + 20);
  }
}
```

**要点**：iOS/Android 罗盘格式不同需分别处理；角度差插值处理 360°/0° 边界；刻度盘固定，方向文字随 heading 旋转。

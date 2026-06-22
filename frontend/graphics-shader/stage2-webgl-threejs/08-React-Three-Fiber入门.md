# 第八课：React Three Fiber 入门

## 场景引入

你已经学会了用 Three.js 命令式地创建 3D 场景——new 一个 Mesh，设置 position，添加到 scene。但当项目变复杂，你需要管理几十个物体的交互、动画和状态更新时，命令式代码会变得难以维护。React Three Fiber（简称 R3F）让你可以用 React 的声明式语法来写 Three.js，组件化、状态管理、生命周期全部由 React 接管。

## 学习目标

1. 理解 R3F 的定位：React 渲染器，而非 Three.js 封装库
2. 掌握 Canvas 组件和基本 JSX 场景搭建
3. 学会使用 useFrame 和 useThree Hooks
4. 理解声明式与命令式 3D 编程的差异
5. 能用 R3F 搭建一个带动画的 3D 场景

## 一、R3F 是什么

React Three Fiber 不是 Three.js 的封装库，而是一个**自定义 React 渲染器**。它让 React 的 reconciler 直接操作 Three.js 对象，而不是 DOM 节点。

```
传统 React:     JSX ──▶ React Reconciler ──▶ DOM 元素
R3F:            JSX ──▶ React Reconciler ──▶ Three.js 对象
```

这意味着 `<mesh>` 不会创建 DOM 元素，而是创建 `THREE.Mesh` 实例。React 的所有特性（hooks、context、suspense）都可以在 3D 场景中使用。

## 二、命令式 vs 声明式对比

```
命令式 Three.js                    声明式 R3F
─────────────────                  ─────────────────
const mesh = new THREE.Mesh()      <mesh>
mesh.position.set(0, 1, 0)          <boxGeometry />
mesh.geometry = new BoxGeometry()    <meshStandardMaterial />
mesh.material = new MeshStandard() </mesh>
scene.add(mesh)

需要手动管理：                      React 自动管理：
- 对象创建与销毁                    - 组件卸载自动 dispose
- position/rotation 更新            - 属性变化自动同步
- 事件监听绑定                      - JSX 属性即 Three.js 属性
- 动画循环                          - useFrame 处理动画
```

声明式的优势在于：状态变化自动触发重渲染，组件封装天然支持复用，与 React 生态无缝集成。

## 三、Canvas 组件与基本场景

Canvas 是 R3F 的入口组件，它创建 WebGL 渲染器和场景根节点。

```tsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

function App() {
  return (
    <Canvas
      camera={{ position: [3, 3, 5], fov: 60 }}
      shadows
      gl={{ antialias: true, toneMapping: 3 }}
    >
      {/* 光照 */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} castShadow />

      {/* 地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>

      {/* 物体 */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="hotpink" />
      </mesh>

      {/* 控制器 */}
      <OrbitControls />
    </Canvas>
  )
}
```

**关键规则：** Canvas 内部的 JSX 标签名就是 Three.js 类名的小写形式。`<mesh>` → `THREE.Mesh`，`<boxGeometry>` → `THREE.BoxGeometry`。

## 四、args 与属性传递

R3F 中，构造函数参数通过 `args` 传递，实例属性直接作为 JSX 属性。

```tsx
// boxGeometry args 对应构造函数参数：[width, height, depth]
<boxGeometry args={[1, 2, 1]} />

// 等价于命令式：
// new THREE.BoxGeometry(1, 2, 1)

// 属性直接传递
<mesh position={[0, 1, 0]} rotation={[0, Math.PI / 4, 0]} castShadow />

// 等价于命令式：
// mesh.position.set(0, 1, 0)
// mesh.rotation.set(0, Math.PI / 4, 0)
// mesh.castShadow = true
```

对于嵌套属性，使用连字符语法：

```tsx
// meshStandardMaterial 的 color 属性
<meshStandardMaterial color="hotpink" roughness={0.5} metalness={0.8} />

// 等价于：
// material.color.set('hotpink')
// material.roughness = 0.5
// material.metalness = 0.8
```

## 五、useFrame 动画 Hook

useFrame 在每一帧调用，相当于 Three.js 的 `requestAnimationFrame` 循环。

```tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'

function SpinningBox() {
  const meshRef = useRef<Mesh>(null!)

  useFrame((state, delta) => {
    // state 包含 clock、camera、scene 等
    // delta 是上一帧到这一帧的时间差（秒）
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.5
      meshRef.current.rotation.y += delta * 0.8

      // 使用 clock 做基于时间的动画
      meshRef.current.position.y =
        Math.sin(state.clock.elapsedTime) * 0.5 + 1
    }
  })

  return (
    <mesh ref={meshRef} position={[0, 1, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  )
}
```

useFrame 接收一个回调 `(state, delta) => void`，在每个动画帧执行。`delta` 是帧间隔时间，用它而非固定值来保证动画在不同刷新率下速度一致。

## 六、useThree 获取渲染上下文

useThree 提供对 Three.js 核心对象的访问。

```tsx
import { useThree } from '@react-three/fiber'

function SceneInfo() {
  const { camera, scene, gl, size, viewport } = useThree()

  // camera: 当前相机
  // scene: 当前场景
  // gl: WebGLRenderer 实例
  // size: Canvas 像素尺寸
  // viewport: 视口尺寸（考虑 DPR）

  return null // 这个组件不渲染任何 3D 对象
}
```

## 七、完整的带动画场景

```tsx
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { useRef, useState } from 'react'
import type { Mesh, Group } from 'three'

function FloatingTorus() {
  const torusRef = useRef<Mesh>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    torusRef.current.rotation.x = t * 0.3
    torusRef.current.rotation.z = t * 0.2
    torusRef.current.position.y = Math.sin(t * 0.8) * 0.3 + 1.5
  })

  return (
    <mesh ref={torusRef} position={[0, 1.5, 0]}>
      <torusGeometry args={[0.7, 0.25, 32, 64]} />
      <meshStandardMaterial color="#4488ff" metalness={0.6} roughness={0.3} />
    </mesh>
  )
}

function ClickableBox() {
  const [hovered, setHovered] = useState(false)
  const [clicked, setClicked] = useState(false)
  const meshRef = useRef<Mesh>(null!)

  useFrame((_, delta) => {
    if (meshRef.current) {
      const targetScale = clicked ? 1.5 : 1.0
      meshRef.current.scale.lerp(
        { x: targetScale, y: targetScale, z: targetScale } as any,
        delta * 5
      )
    }
  })

  return (
    <mesh
      ref={meshRef}
      position={[-2, 0.5, 0]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={() => setClicked((prev) => !prev)}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={hovered ? 'yellow' : 'hotpink'} />
    </mesh>
  )
}

function RotatingGroup() {
  const groupRef = useRef<Group>(null!)

  useFrame((state) => {
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.2
  })

  return (
    <group ref={groupRef} position={[2, 0, 0]}>
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color="lime" />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.2, 32, 32]} />
        <meshStandardMaterial color="cyan" />
      </mesh>
    </group>
  )
}

export default function App() {
  return (
    <Canvas camera={{ position: [4, 3, 6], fov: 50 }} shadows>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 8, 5]} castShadow intensity={1} />

      <Grid
        args={[20, 20]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#666"
        sectionSize={5}
      />

      <FloatingTorus />
      <ClickableBox />
      <RotatingGroup />

      <OrbitControls makeDefault />
    </Canvas>
  )
}
```

## 常见误区

### 1. 在 useFrame 中创建新对象

`useFrame` 每帧执行，在内部 `new THREE.Vector3()` 会导致每帧分配新对象，触发 GC 导致卡顿。应该预创建对象并复用。

### 2. 把 R3F 当成 Three.js 的简单封装

R3F 是 React 渲染器，不是 API 映射库。它的更新机制、生命周期、事件系统都遵循 React 的规则。用写 Three.js 的思路写 R3F 会处处碰壁。

### 3. 忘记 dispose 资源

虽然 R3F 在组件卸载时会自动 dispose geometry 和 material，但纹理、RenderTarget 等需要手动管理。使用 `useEffect` 的清理函数处理。

### 4. 不理解 args 的作用

args 对应 Three.js 构造函数的参数，且 **args 变化时会重新创建对象**。如果 args 每帧都不同（比如从 state 计算），会导致每帧重建 geometry，性能极差。

## 工程建议

1. **组件粒度适中：** 一个 3D 物体（mesh + geometry + material）一个组件，不要把整个场景塞进一个组件
2. **用 Drei 简化常见任务：** OrbitControls、Environment、Text 等高频需求，Drei 都有现成封装
3. **Canvas 属性尽量少变：** Canvas 的 `gl`、`camera` 等属性变化会导致整个渲染器重建
4. **开发时用 React DevTools：** R3F 的组件树可以在 React DevTools 中查看，调试很方便

## 小结

R3F 让 Three.js 开发从命令式变为声明式，组件化思维让 3D 场景的管理和维护变得更加清晰。useFrame 和 useThree 是连接 React 世界和 Three.js 世界的桥梁，掌握它们就能在 React 中自如地操控 3D 场景。

## 练习

1. 用 R3F 创建一个包含 3 个不同几何体（球、立方体、圆环）的场景，每个物体有独立的自转动画
2. 实现一个鼠标 hover 效果：鼠标悬停在物体上时改变颜色，移开后恢复
3. 尝试用 useThree 获取当前相机位置，并在控制台打印出来

---

## 参考答案

### 练习一

**思路**：用 R3F 的声明式语法创建三个 Mesh，每个 Mesh 用 `useFrame` 钩子实现独立的自转动画。通过 `useRef` 获取 Mesh 引用，在每帧中更新 `rotation` 属性。

**答案**：

```tsx
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function RotatingSphere() {
    const meshRef = useRef<THREE.Mesh>(null!);

    useFrame((_, delta) => {
        meshRef.current.rotation.y += delta * 0.6;
        meshRef.current.rotation.x += delta * 0.3;
    });

    return (
        <mesh ref={meshRef} position={[-3, 0, 0]}>
            <sphereGeometry args={[0.8, 32, 32]} />
            <meshStandardMaterial color="#4fc3f7" />
        </mesh>
    );
}

function RotatingBox() {
    const meshRef = useRef<THREE.Mesh>(null!);

    useFrame((_, delta) => {
        meshRef.current.rotation.x += delta * 0.5;
        meshRef.current.rotation.z += delta * 0.4;
    });

    return (
        <mesh ref={meshRef} position={[0, 0, 0]}>
            <boxGeometry args={[1.2, 1.2, 1.2]} />
            <meshStandardMaterial color="#ff7043" />
        </mesh>
    );
}

function RotatingTorus() {
    const meshRef = useRef<THREE.Mesh>(null!);

    useFrame((_, delta) => {
        meshRef.current.rotation.x += delta * 0.7;
        meshRef.current.rotation.y += delta * 0.2;
    });

    return (
        <mesh ref={meshRef} position={[3, 0, 0]}>
            <torusGeometry args={[0.6, 0.25, 16, 32]} />
            <meshStandardMaterial color="#66bb6a" />
        </mesh>
    );
}

export default function App() {
    return (
        <Canvas camera={{ position: [0, 2, 8], fov: 60 }}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 5, 5]} intensity={1.0} />

            <RotatingSphere />
            <RotatingBox />
            <RotatingTorus />
        </Canvas>
    );
}
```

**要点**：
- R3F 中每个 3D 物体封装为独立组件，职责清晰
- `useFrame` 的 `delta` 参数是上一帧到当前帧的时间差（秒），乘以速度保证帧率无关的匀速旋转
- `args` 对应 Three.js 构造函数的参数数组，如 `SphereGeometry(radius, widthSegments, heightSegments)`
- `Canvas` 的 `camera` 属性可以直接配置相机参数，无需手动创建 PerspectiveCamera

---

### 练习二

**思路**：用 R3F 的 `onPointerOver` 和 `onPointerOut` 事件处理 hover 状态，用 `useState` 管理颜色。悬停时改变材质颜色并设置 `emissive`，移开时恢复。

**答案**：

```tsx
import { useState } from "react";
import { Canvas } from "@react-three/fiber";

interface HoverObjectProps {
    position: [number, number, number];
    defaultColor: string;
    hoverColor: string;
    geometry: "sphere" | "box" | "torus";
}

function HoverObject({ position, defaultColor, hoverColor, geometry }: HoverObjectProps) {
    const [hovered, setHovered] = useState(false);

    const GeometryComponent = () => {
        switch (geometry) {
            case "sphere":
                return <sphereGeometry args={[0.7, 32, 32]} />;
            case "box":
                return <boxGeometry args={[1, 1, 1]} />;
            case "torus":
                return <torusGeometry args={[0.5, 0.2, 16, 32]} />;
        }
    };

    return (
        <mesh
            position={position}
            onPointerOver={(e) => {
                e.stopPropagation(); // 防止事件穿透
                setHovered(true);
                document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
                setHovered(false);
                document.body.style.cursor = "default";
            }}
        >
            <GeometryComponent />
            <meshStandardMaterial
                color={hovered ? hoverColor : defaultColor}
                emissive={hovered ? hoverColor : "#000000"}
                emissiveIntensity={hovered ? 0.3 : 0}
            />
        </mesh>
    );
}

export default function App() {
    return (
        <Canvas camera={{ position: [0, 2, 8], fov: 60 }}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 5, 5]} intensity={1.0} />

            <HoverObject position={[-3, 0, 0]} defaultColor="#4fc3f7" hoverColor="#ff1744" geometry="sphere" />
            <HoverObject position={[0, 0, 0]} defaultColor="#ff7043" hoverColor="#00e5ff" geometry="box" />
            <HoverObject position={[3, 0, 0]} defaultColor="#66bb6a" hoverColor="#ffea00" geometry="torus" />
        </Canvas>
    );
}
```

**要点**：
- `onPointerOver` / `onPointerOut` 是 R3F 封装的指针事件，自动处理射线检测
- `e.stopPropagation()` 防止事件冒泡到父物体，避免多个物体同时响应
- `emissive` 让物体在 hover 时自发光，增强视觉反馈
- `document.body.style.cursor` 改变鼠标样式，提供额外的交互提示

---

### 练习三

**思路**：在 R3F 组件中用 `useThree` 钩子获取 `camera` 对象，在 `useFrame` 中每帧打印相机位置。

**答案**：

```tsx
import { useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function CameraLogger() {
    const { camera } = useThree();

    // 组件挂载时打印初始位置
    useEffect(() => {
        console.log("相机初始位置:", camera.position);
        console.log("相机类型:", camera.type === "PerspectiveCamera" ? "透视相机" : "正交相机");
        console.log("FOV:", (camera as THREE.PerspectiveCamera).fov);
    }, [camera]);

    // 每帧打印（用 throttle 限制频率避免刷屏）
    let lastLogTime = 0;
    useFrame(() => {
        const now = performance.now();
        if (now - lastLogTime > 1000) { // 每秒打印一次
            const pos = camera.position;
            console.log(`相机位置: x=${pos.x.toFixed(2)}, y=${pos.y.toFixed(2)}, z=${pos.z.toFixed(2)}`);
            lastLogTime = now;
        }
    });

    return null; // 不渲染任何内容
}

function RotatingBox() {
    return (
        <mesh rotation={[0.5, 0.5, 0]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#4fc3f7" />
        </mesh>
    );
}

export default function App() {
    return (
        <Canvas camera={{ position: [3, 2, 5], fov: 75 }}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 5, 5]} intensity={1.0} />
            <RotatingBox />
            <CameraLogger />
        </Canvas>
    );
}
```

**要点**：
- `useThree()` 返回 R3F 的内部状态对象，包含 `camera`、`scene`、`gl`（渲染器）等
- `useEffect` 依赖 `[camera]` 确保在相机引用变化时重新订阅
- 不要在 `useFrame` 中无条件 `console.log`，每秒 60 条日志会严重影响性能
- `CameraLogger` 返回 `null`，它是一个"逻辑组件"，只负责副作用不负责渲染

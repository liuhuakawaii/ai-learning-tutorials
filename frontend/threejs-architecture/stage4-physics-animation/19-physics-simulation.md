# 物理模拟——布料/流体/软体的简化实现

## 刚体之外的物理

物理引擎处理的是刚体——形状不变的物体。但现实世界有很多非刚体：旗帜飘动、水面波纹、果冻晃动。这些效果需要不同的模拟方法。

完全精确的物理模拟（有限元、流体力学）对实时渲染太重了。Three.js 场景里用的是简化方法——够好看就行，不追求物理精确。

## 布料模拟：弹簧-质点模型

把布料想象成一张网格，每个交叉点是一个质点，相邻质点之间用弹簧连接。

```
质点(0,0) --- 质点(0,1) --- 质点(0,2)
   |              |              |
质点(1,0) --- 质点(1,1) --- 质点(1,2)
   |              |              |
质点(2,0) --- 质点(2,1) --- 质点(2,2)
```

每帧对每个质点计算：

1. **弹簧力**：相邻质点之间的拉伸/压缩力
2. **重力**：向下的常力
3. **阻尼**：速度衰减
4. **约束**：固定点（如旗杆上的点）

```ts
class ClothSimulation {
    private positions: Float32Array;
    private velocities: Float32Array;
    private forces: Float32Array;
    private width: number;
    private height: number;
    private restLength: number;
    private stiffness: number;
    private damping: number;

    constructor(width: number, height: number, restLength = 0.1) {
        this.width = width;
        this.height = height;
        this.restLength = restLength;
        this.stiffness = 500;
        this.damping = 0.98;

        const count = width * height;
        this.positions = new Float32Array(count * 3);
        this.velocities = new Float32Array(count * 3);
        this.forces = new Float32Array(count * 3);

        // 初始化位置
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 3;
                this.positions[i] = x * restLength;
                this.positions[i + 1] = 0;
                this.positions[i + 2] = y * restLength;
            }
        }
    }

    step(dt: number) {
        const { positions, velocities, forces, width, height, restLength, stiffness, damping } = this;

        // 清除力
        forces.fill(0);

        // 施加重力
        for (let i = 1; i < forces.length; i += 3) {
            forces[i] = -9.8;
        }

        // 施加弹簧力
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 3;

                // 右邻居
                if (x < width - 1) {
                    this.applySpringForce(i, i + 3);
                }
                // 下邻居
                if (y < height - 1) {
                    this.applySpringForce(i, i + width * 3);
                }
            }
        }

        // 更新速度和位置（Verlet 积分的简化版）
        for (let i = 0; i < positions.length; i += 3) {
            velocities[i] += forces[i] * dt;
            velocities[i + 1] += forces[i + 1] * dt;
            velocities[i + 2] += forces[i + 2] * dt;

            velocities[i] *= damping;
            velocities[i + 1] *= damping;
            velocities[i + 2] *= damping;

            positions[i] += velocities[i] * dt;
            positions[i + 1] += velocities[i + 1] * dt;
            positions[i + 2] += velocities[i + 2] * dt;
        }

        // 约束：固定第一行
        for (let x = 0; x < width; x++) {
            const i = x * 3;
            velocities[i] = 0;
            velocities[i + 1] = 0;
            velocities[i + 2] = 0;
        }
    }

    private applySpringForce(i1: number, i2: number) {
        const dx = this.positions[i2] - this.positions[i1];
        const dy = this.positions[i2 + 1] - this.positions[i1 + 1];
        const dz = this.positions[i2 + 2] - this.positions[i1 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const force = this.stiffness * (dist - this.restLength);
        const fx = force * dx / dist;
        const fy = force * dy / dist;
        const fz = force * dz / dist;

        this.forces[i1] += fx;
        this.forces[i1 + 1] += fy;
        this.forces[i1 + 2] += fz;
        this.forces[i2] -= fx;
        this.forces[i2 + 1] -= fy;
        this.forces[i2 + 2] -= fz;
    }
}
```

## 与 Three.js 集成

布料的顶点每帧都在变，需要更新 geometry：

```ts
const geometry = new THREE.PlaneGeometry(2, 2, 20, 20);
const material = new THREE.MeshStandardMaterial({
    color: 0x3366ff,
    side: THREE.DoubleSide
});
const clothMesh = new THREE.Mesh(geometry, material);
scene.add(clothMesh);

const simulation = new ClothSimulation(21, 21, 0.1);

function animate() {
    simulation.step(1 / 60);

    // 同步顶点
    const posAttr = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < simulation.positions.length; i++) {
        posAttr.array[i] = simulation.positions[i];
    }
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals(); // 重新计算法线

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
```

## 简化流体：SPH 的极简版

光滑粒子流体动力学（SPH）把流体分成粒子，每个粒子受邻居的影响。完整实现很复杂，这里给一个极简版——只模拟"水滴聚拢"的效果：

```ts
class SimpleFluid {
    private positions: Float32Array;
    private velocities: Float32Array;
    private count: number;
    private radius = 0.1; // 粒子半径
    private pressure = 100;
    private viscosity = 0.1;

    constructor(count: number) {
        this.count = count;
        this.positions = new Float32Array(count * 3);
        this.velocities = new Float32Array(count * 3);

        // 随机初始化在一个区域内
        for (let i = 0; i < count; i++) {
            this.positions[i * 3] = (Math.random() - 0.5) * 2;
            this.positions[i * 3 + 1] = Math.random() * 3;
            this.positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
        }
    }

    step(dt: number) {
        // 简化的压力和粘性
        for (let i = 0; i < this.count; i++) {
            let fx = 0, fy = -9.8, fz = 0; // 重力

            // 和邻居的排斥力（简化版密度计算）
            for (let j = 0; j < this.count; j++) {
                if (i === j) continue;
                const dx = this.positions[j * 3] - this.positions[i * 3];
                const dy = this.positions[j * 3 + 1] - this.positions[i * 3 + 1];
                const dz = this.positions[j * 3 + 2] - this.positions[i * 3 + 2];
                const dist2 = dx * dx + dy * dy + dz * dz;
                if (dist2 < this.radius * this.radius * 4) {
                    const dist = Math.sqrt(dist2);
                    const force = this.pressure * (1 - dist / (this.radius * 2));
                    fx -= force * dx / dist;
                    fy -= force * dy / dist;
                    fz -= force * dz / dist;
                }
            }

            // 粘性力
            fx -= this.velocities[i * 3] * this.viscosity;
            fy -= this.velocities[i * 3 + 1] * this.viscosity;
            fz -= this.velocities[i * 3 + 2] * this.viscosity;

            this.velocities[i * 3] += fx * dt;
            this.velocities[i * 3 + 1] += fy * dt;
            this.velocities[i * 3 + 2] += fz * dt;

            this.positions[i * 3] += this.velocities[i * 3] * dt;
            this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
            this.positions[i * 3 + 2] += this.positions[i * 3 + 2] * dt;

            // 地面约束
            if (this.positions[i * 3 + 1] < 0) {
                this.positions[i * 3 + 1] = 0;
                this.velocities[i * 3 + 1] *= -0.3; // 反弹
            }
        }
    }
}
```

注意：这个 O(n²) 的邻居搜索在粒子数多时极慢。真正的 SPH 用空间哈希或网格加速。

## 软体：用 FEM 或简化的质量-弹簧

软体（如果冻、橡皮球）的核心是"形状可以改变，但会恢复"。最简单的方法是在刚体形状的表面加弹簧：

```ts
class SoftBody {
    private positions: Float32Array;
    private restPositions: Float32Array;
    private velocities: Float32Array;
    private stiffness: number;

    constructor(geometry: THREE.BufferGeometry, stiffness = 100) {
        const posAttr = geometry.attributes.position;
        this.positions = new Float32Array(posAttr.array);
        this.restPositions = new Float32Array(posAttr.array);
        this.velocities = new Float32Array(this.positions.length);
        this.stiffness = stiffness;
    }

    applyForce(point: THREE.Vector3, force: THREE.Vector3, radius: number) {
        for (let i = 0; i < this.positions.length; i += 3) {
            const dx = this.positions[i] - point.x;
            const dy = this.positions[i + 1] - point.y;
            const dz = this.positions[i + 2] - point.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < radius) {
                const factor = 1 - dist / radius;
                this.velocities[i] += force.x * factor;
                this.velocities[i + 1] += force.y * factor;
                this.velocities[i + 2] += force.z * factor;
            }
        }
    }

    step(dt: number) {
        for (let i = 0; i < this.positions.length; i += 3) {
            // 弹回原始位置的力
            const dx = this.restPositions[i] - this.positions[i];
            const dy = this.restPositions[i + 1] - this.positions[i + 1];
            const dz = this.restPositions[i + 2] - this.positions[i + 2];

            this.velocities[i] += dx * this.stiffness * dt;
            this.velocities[i + 1] += dy * this.stiffness * dt;
            this.velocities[i + 2] += dz * this.stiffness * dt;

            // 阻尼
            this.velocities[i] *= 0.95;
            this.velocities[i + 1] *= 0.95;
            this.velocities[i + 2] *= 0.95;

            this.positions[i] += this.velocities[i] * dt;
            this.positions[i + 1] += this.velocities[i + 1] * dt;
            this.positions[i + 2] += this.velocities[i + 2] * dt;
        }
    }
}
```

## 练习

### 练习一：实现布料

基于上面的 ClothSimulation，创建一个挂在两个角上的布料。让它在风中飘动（给每个质点加随机的水平力）。

### 练习二：布料与球体碰撞

给布料添加球体碰撞约束——当质点进入球体内部时，把它推到球体表面。

### 练习三：性能优化

把布料模拟的弹簧力计算从 O(n²) 优化到 O(n)（只计算相邻质点的弹簧力，不用遍历所有质点）。

---

## 参考答案

### 练习一

在 `step()` 方法中，固定第一行和最后一行的质点：

```ts
// 约束：固定第一行和最后一行
for (let x = 0; x < width; x++) {
    const i = x * 3;
    this.velocities[i] = 0;
    this.velocities[i + 1] = 0;
    this.velocities[i + 2] = 0;
    const j = ((height - 1) * width + x) * 3;
    this.velocities[j] = 0;
    this.velocities[j + 1] = 0;
    this.velocities[j + 2] = 0;
}
```

风力：

```ts
// 在施加重力之后
for (let i = 0; i < forces.length; i += 3) {
    forces[i] += Math.sin(Date.now() * 0.001 + positions[i + 2] * 5) * 2;
    forces[i + 2] += Math.cos(Date.now() * 0.0015 + positions[i] * 3) * 1;
}
```

### 练习二

```ts
private constrainToSphere(cx: number, cy: number, cz: number, radius: number) {
    for (let i = 0; i < this.positions.length; i += 3) {
        const dx = this.positions[i] - cx;
        const dy = this.positions[i + 1] - cy;
        const dz = this.positions[i + 2] - cz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < radius) {
            // 推到球面
            this.positions[i] = cx + dx / dist * radius;
            this.positions[i + 1] = cy + dy / dist * radius;
            this.positions[i + 2] = cz + dz / dist * radius;
        }
    }
}
```

### 练习三

当前代码已经是 O(n)——只计算右邻居和下邻居的弹簧力。如果需要更稳定的布料，可以加对角线弹簧和弯曲弹簧，但计算量会增加。

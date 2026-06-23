# 骨骼动画——Skeleton/SkinnedMesh、动画混合、状态机

## 角色动画不是"播放视频"

把一个角色动画理解为"一系列帧"是最大的误解。骨骼动画的核心是：角色的网格绑定到一组骨骼（Skeleton），每帧根据骨骼的变换矩阵重新计算顶点位置。动画数据不是图片序列，而是骨骼在不同时间点的旋转/位移。

这意味着可以在运行时混合多个动画、调整播放速度、IK 修正。

## 骨骼系统的基础结构

```
Skeleton
├── Bone[]              # 骨骼数组（有序）
└── boneInverses[]      # 每根骨骼的逆绑定矩阵

SkinnedMesh
├── geometry            # 带 skinIndex 和 skinWeight 属性
├── skeleton            # Skeleton 实例
└── bindMatrix          # 绑定矩阵
```

### Bone

Bone 就是 Object3D，可以有父子关系。骨骼层级形成一棵树：

```
Hips (根骨骼)
├── Spine
│   ├── Chest
│   │   ├── Head
│   │   ├── LeftArm
│   │   │   ├── LeftForeArm
│   │   │   └── LeftHand
│   │   └── RightArm
│   │       ├── RightForeArm
│   │       └── RightHand
├── LeftUpLeg
│   └── LeftLeg
│       └── LeftFoot
└── RightUpLeg
    └── RightLeg
        └── RightFoot
```

每根骨骼的变换会传播到子骨骼（和 Object3D 的矩阵更新链一样）。

### SkinnedMesh

SkinnedMesh 的 geometry 有两个关键属性：

- `skinIndex`：每个顶点受哪些骨骼影响（最多 4 根）
- `skinWeight`：每根骨骼的权重（总和为 1）

```ts
// 一个顶点可能这样被影响
skinIndex: [2, 5, 0, 0]    // 骨骼 2、5、0、0
skinWeight: [0.6, 0.3, 0.1, 0]  // 权重 60%、30%、10%、0%
```

GPU 在 vertex shader 里用这些权重混合骨骼矩阵，得到最终的顶点位置：

```glsl
// vertex shader（简化）
mat4 skinMatrix =
    skinWeight.x * boneMatrices[int(skinIndex.x)] +
    skinWeight.y * boneMatrices[int(skinIndex.y)] +
    skinWeight.z * boneMatrices[int(skinIndex.z)] +
    skinWeight.w * boneMatrices[int(skinIndex.w)];

vec4 skinnedPosition = skinMatrix * vec4(position, 1.0);
```

## AnimationClip 与 AnimationMixer

```ts
// 加载带动画的模型
const gltf = await loader.loadAsync('character.glb');
const model = gltf.scene;
const animations = gltf.animations; // AnimationClip[]

// 创建动画混合器
const mixer = new THREE.AnimationMixer(model);

// 播放一个动画
const action = mixer.clipAction(animations[0]);
action.play();

// 每帧更新
function animate() {
    mixer.update(deltaTime);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
```

AnimationClip 内部包含多条 Track，每条 Track 对应一个属性的关键帧序列：

```
AnimationClip
├── KeyframeTrack: Hips.position
│   └── times: [0, 0.5, 1.0], values: [0,0,0, 0,1,0, 0,0,0]
├── KeyframeTrack: Hips.quaternion
│   └── times: [0, 0.5, 1.0], values: [q0, q1, q2]
├── KeyframeTrack: LeftArm.quaternion
│   └── ...
└── ...
```

## 动画混合

同时播放多个动画并混合：

```ts
const walkAction = mixer.clipAction(walkClip);
const runAction = mixer.clipAction(runClip);

walkAction.play();
runAction.play();

// 控制权重
walkAction.weight = 0.7; // 70% walk
runAction.weight = 0.3; // 30% run

// 平滑过渡
function blendTo(target: THREE.AnimationAction, duration: number) {
    const current = walkAction.weight > 0 ? walkAction : runAction;
    target.enabled = true;
    target.weight = 0;
    target.play();

    // 交叉淡入淡出
    current.crossFadeTo(target, duration);
}
```

`crossFadeTo` 做的事情：在 duration 时间内，把当前动作的 weight 从 1 降到 0，目标动作的 weight 从 0 升到 1。

## 动画状态机

角色动画通常用状态机管理：Idle → Walk → Run → Jump → Land → Idle。

```ts
class AnimationStateMachine {
    private currentState: string;
    private states = new Map<string, {
        action: THREE.AnimationAction;
        transitions: Map<string, { condition: () => boolean; duration: number }>;
    }>();

    constructor(private mixer: THREE.AnimationMixer) {}

    addState(
        name: string,
        clip: THREE.AnimationClip,
        transitions: { target: string; condition: () => boolean; duration: number }[]
    ) {
        const action = this.mixer.clipAction(clip);
        action.play();
        action.weight = 0;

        this.states.set(name, {
            action,
            transitions: new Map(
                transitions.map(t => [t.target, { condition: t.condition, duration: t.duration }])
            )
        });
    }

    setState(name: string) {
        if (this.currentState === name) return;
        const prev = this.states.get(this.currentState);
        const next = this.states.get(name);
        if (!next) return;

        if (prev) {
            prev.action.crossFadeTo(next.action, 0.3);
        }
        next.action.weight = 1;
        this.currentState = name;
    }

    update() {
        const state = this.states.get(this.currentState);
        if (!state) return;

        // 检查转换条件
        for (const [target, transition] of state.transitions) {
            if (transition.condition()) {
                this.setState(target);
                return;
            }
        }
    }
}

// 使用
const fsm = new AnimationStateMachine(mixer);
fsm.addState('idle', idleClip, [
    { target: 'walk', condition: () => velocity > 0.1, duration: 0.3 }
]);
fsm.addState('walk', walkClip, [
    { target: 'idle', condition: () => velocity < 0.1, duration: 0.3 },
    { target: 'run', condition: () => velocity > 3, duration: 0.2 }
]);
fsm.addState('run', runClip, [
    { target: 'walk', condition: () => velocity < 3, duration: 0.2 }
]);
fsm.setState('idle');
```

## IK（反向运动学）

有时候你需要"手放到桌上"而不是"手动旋转每个关节"。IK 解决的是：给定末端位置，反推每根骨骼的旋转。

Three.js 内置了 IK 实现：

```ts
import { CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver';

const iks = [
    {
        effector: handBoneIndex,
        links: [forearmBoneIndex, armBoneIndex],
        target: targetPosition
    }
];

const ikSolver = new CCDIKSolver(mesh, iks);

// 每帧
ikSolver.update();
```

## 练习

### 练习一：加载和播放动画

加载一个 GLTF 角色模型（可用 Mixamo 的免费模型），播放 idle 动画。

### 练习二：动画混合

实现一个简单的混合：角色从 idle 过渡到 walk（按 W 键），从 walk 过渡到 idle（松开 W 键）。过渡时间 0.3 秒。

### 练习三：状态机

基于上面的 AnimationStateMachine，添加 jump 状态。要求：

- 按空格键触发 jump
- jump 播放完成后自动回到 idle
- jump 过程中不能再次 jump

---

## 参考答案

### 练习一

```ts
const loader = new GLTFLoader();
const gltf = await loader.loadAsync('character.glb');
const model = gltf.scene;
scene.add(model);

const mixer = new THREE.AnimationMixer(model);
const idleClip = gltf.animations.find(a => a.name === 'Idle') || gltf.animations[0];
const idleAction = mixer.clipAction(idleClip);
idleAction.play();
```

### 练习二

```ts
let isWalking = false;
const walkAction = mixer.clipAction(walkClip);
const idleAction = mixer.clipAction(idleClip);
idleAction.play();

document.addEventListener('keydown', (e) => {
    if (e.key === 'w' && !isWalking) {
        isWalking = true;
        idleAction.crossFadeTo(walkAction, 0.3);
        walkAction.play();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'w' && isWalking) {
        isWalking = false;
        walkAction.crossFadeTo(idleAction, 0.3);
    }
});
```

### 练习三

```ts
fsm.addState('jump', jumpClip, []);

document.addEventListener('keydown', (e) => {
    if (e.key === ' ' && fsm.currentState !== 'jump') {
        fsm.setState('jump');
        // jump 完成后回到 idle
        const jumpClip = jumpClip;
        const duration = jumpClip.duration;
        setTimeout(() => fsm.setState('idle'), duration * 1000);
    }
});
```

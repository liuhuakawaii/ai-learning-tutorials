# 阶段实战：构建带物理和动画的交互场景

## 目标

把物理引擎、骨骼动画、粒子系统组合成一个可交互的 3D 场景。不是做一个完整游戏，而是验证这些系统如何协同工作。

场景设定：

- 一个可行走的角色（WASD 移动，空格跳跃）
- 地面上有可踢的球体（物理交互）
- 角色跳起时产生粒子拖尾
- 角色有 idle / walk / jump 动画

## 架构

```
Scene
├── PhysicsWorld        # cannon-es
├── CharacterController
│   ├── SkinnedMesh     # 角色模型
│   ├── AnimationFSM    # 动画状态机
│   └── PhysicsBody     # 角色的物理胶囊体
├── Interactables
│   └── PhysicsBall[]   # 可交互的球体
└── Effects
    └── ParticleSystem  # 跳跃粒子
```

## 第一步：物理世界搭建

```ts
import * as CANNON from 'cannon-es';

function setupPhysics(): CANNON.World {
    const world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.allowSleep = true;

    // 地面
    const groundBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane()
    });
    groundBody.quaternion.setFromEulerAngles(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    return world;
}
```

## 第二步：角色物理体

角色用胶囊体（Cylinder + 两个半球）做碰撞：

```ts
function createCharacterBody(world: CANNON.World): CANNON.Body {
    const body = new CANNON.Body({
        mass: 70,
        shape: new CANNON.Cylinder(0.3, 0.3, 1.6, 8),
        position: new CANNON.Vec3(0, 1, 0),
        linearDamping: 0.9,
        angularDamping: 1.0 // 防止角色旋转
    });

    // 锁定旋转（角色不应该倒下）
    body.angularFactor.set(0, 0, 0);

    world.addBody(body);
    return body;
}
```

## 第三步：角色控制器

```ts
class CharacterController {
    private body: CANNON.Body;
    private mesh: THREE.Group;
    private mixer: THREE.AnimationMixer;
    private fsm: AnimationStateMachine;
    private moveSpeed = 5;
    private jumpForce = 8;
    private input = { forward: false, backward: false, left: false, right: false, jump: false };
    private canJump = false;

    constructor(
        private scene: THREE.Scene,
        private world: CANNON.World,
        model: THREE.Group,
        animations: THREE.AnimationClip[]
    ) {
        this.mesh = model;
        this.body = createCharacterBody(world);
        this.mixer = new THREE.AnimationMixer(model);

        // 动画状态机
        this.fsm = new AnimationStateMachine(this.mixer);
        const idleClip = animations.find(a => a.name === 'Idle') || animations[0];
        const walkClip = animations.find(a => a.name === 'Walk') || animations[1];
        const jumpClip = animations.find(a => a.name === 'Jump') || animations[2];

        this.fsm.addState('idle', idleClip, [
            { target: 'walk', condition: () => this.isMoving(), duration: 0.2 }
        ]);
        this.fsm.addState('walk', walkClip, [
            { target: 'idle', condition: () => !this.isMoving(), duration: 0.2 }
        ]);
        this.fsm.addState('jump', jumpClip, []);
        this.fsm.setState('idle');

        this.setupInput();
        this.setupGroundDetection();
        scene.add(model);
    }

    private isMoving(): boolean {
        return this.input.forward || this.input.backward ||
               this.input.left || this.input.right;
    }

    private setupInput() {
        document.addEventListener('keydown', (e) => {
            switch (e.key.toLowerCase()) {
                case 'w': this.input.forward = true; break;
                case 's': this.input.backward = true; break;
                case 'a': this.input.left = true; break;
                case 'd': this.input.right = true; break;
                case ' ': this.input.jump = true; break;
            }
        });
        document.addEventListener('keyup', (e) => {
            switch (e.key.toLowerCase()) {
                case 'w': this.input.forward = false; break;
                case 's': this.input.backward = false; break;
                case 'a': this.input.left = false; break;
                case 'd': this.input.right = false; break;
            }
        });
    }

    private setupGroundDetection() {
        this.body.addEventListener('collide', (e: CANNON.ICollisionEvent) => {
            const contact = e.contact;
            // 检查是否是脚部碰撞（法线朝上）
            if (contact.ni.y > 0.5) {
                this.canJump = true;
            }
        });
    }

    update(dt: number, camera: THREE.Camera) {
        // 计算移动方向
        const direction = new THREE.Vector3();
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();

        const right = new THREE.Vector3().crossVectors(
            cameraDirection, new THREE.Vector3(0, 1, 0)
        ).normalize();

        if (this.input.forward) direction.add(cameraDirection);
        if (this.input.backward) direction.sub(cameraDirection);
        if (this.input.left) direction.sub(right);
        if (this.input.right) direction.add(right);
        direction.normalize();

        // 应用移动
        this.body.velocity.x = direction.x * this.moveSpeed;
        this.body.velocity.z = direction.z * this.moveSpeed;

        // 跳跃
        if (this.input.jump && this.canJump) {
            this.body.velocity.y = this.jumpForce;
            this.canJump = false;
            this.fsm.setState('jump');
        }

        // 同步 mesh 到物理体
        this.mesh.position.copy(this.body.position as any);
        this.mesh.position.y -= 0.8; // 胶囊体中心偏移

        // 朝向移动方向
        if (direction.lengthSq() > 0.01) {
            const angle = Math.atan2(direction.x, direction.z);
            this.mesh.rotation.y = angle;
        }

        // 更新动画
        if (this.canJump && this.fsm.currentState === 'jump') {
            this.fsm.setState('idle');
        }
        this.fsm.update();
        this.mixer.update(dt);
    }
}
```

## 第四步：可交互球体

```ts
function createPhysicsBall(
    world: CANNON.World,
    scene: THREE.Scene,
    position: THREE.Vector3
): { mesh: THREE.Mesh; body: CANNON.Body } {
    const radius = 0.3;
    const geometry = new THREE.SphereGeometry(radius, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0xff4444 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    scene.add(mesh);

    const body = new CANNON.Body({
        mass: 2,
        shape: new CANNON.Sphere(radius),
        position: new CANNON.Vec3(position.x, position.y, position.z),
        material: new CANNON.Material({ restitution: 0.5, friction: 0.3 })
    });
    world.addBody(body);

    return { mesh, body };
}
```

## 第五步：跳跃粒子

```ts
class JumpParticles {
    private particles: THREE.Points;
    private positions: Float32Array;
    private velocities: Float32Array;
    private lifetimes: Float32Array;
    private count = 100;
    private active = false;

    constructor() {
        this.positions = new Float32Array(this.count * 3);
        this.velocities = new Float32Array(this.count * 3);
        this.lifetimes = new Float32Array(this.count);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position',
            new THREE.BufferAttribute(this.positions, 3));

        this.particles = new THREE.Points(geometry, new THREE.PointsMaterial({
            size: 0.1,
            color: 0x00ffff,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }));
    }

    emit(position: THREE.Vector3) {
        this.active = true;
        for (let i = 0; i < this.count; i++) {
            this.positions[i * 3] = position.x;
            this.positions[i * 3 + 1] = position.y;
            this.positions[i * 3 + 2] = position.z;
            this.velocities[i * 3] = (Math.random() - 0.5) * 3;
            this.velocities[i * 3 + 1] = Math.random() * -2;
            this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 3;
            this.lifetimes[i] = Math.random();
        }
        (this.particles.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    update(dt: number) {
        if (!this.active) return;
        let alive = false;
        for (let i = 0; i < this.count; i++) {
            if (this.lifetimes[i] <= 0) continue;
            alive = true;
            this.lifetimes[i] -= dt;
            this.positions[i * 3] += this.velocities[i * 3] * dt;
            this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
            this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
        }
        if (!alive) this.active = false;
        (this.particles.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    getObject() { return this.particles; }
}
```

## 第六步：组装主循环

```ts
async function main() {
    // 初始化
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 3, 8);

    const world = setupPhysics();

    // 地面
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(50, 50),
        new THREE.MeshStandardMaterial({ color: 0x555555 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // 灯光
    scene.add(new THREE.AmbientLight(0x404040));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    // 角色（需要加载 GLTF 模型）
    // const gltf = await loader.loadAsync('character.glb');
    // const controller = new CharacterController(scene, world, gltf.scene, gltf.animations);

    // 物理球体
    const balls = [];
    for (let i = 0; i < 5; i++) {
        balls.push(createPhysicsBall(world, scene,
            new THREE.Vector3(Math.random() * 10 - 5, 1, Math.random() * 10 - 5)));
    }

    // 粒子
    const jumpParticles = new JumpParticles();
    scene.add(jumpParticles.getObject());

    // 主循环
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const dt = Math.min(clock.getDelta(), 0.05);

        // 物理步进
        world.step(1 / 60, dt, 3);

        // 更新角色
        // controller.update(dt, camera);

        // 同步球体
        for (const ball of balls) {
            ball.mesh.position.copy(ball.body.position as any);
            ball.mesh.quaternion.copy(ball.body.quaternion as any);
        }

        // 更新粒子
        jumpParticles.update(dt);

        renderer.render(scene, camera);
    }
    animate();
}
```

## 练习

### 练习一：完成场景

基于上面的代码，完成一个可运行的场景。角色模型可以用简单的几何体代替（圆柱体做身体，球体做头）。

### 练习二：添加碰撞反馈

当角色踢到球体时，球体飞出并产生粒子效果。提示：检测角色物理体和球体的碰撞事件。

### 练习三：添加相机跟随

实现一个第三人称相机，平滑跟随角色移动。要求：

- 相机在角色后方偏上
- 鼠标可以旋转视角
- 相机不穿入地面

---

## 参考答案

### 练习一

简化角色（不用 GLTF）：

```ts
const bodyGroup = new THREE.Group();
const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0x3366ff })
);
torso.position.y = 1;
bodyGroup.add(torso);

const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xffcc99 })
);
head.position.y = 1.7;
bodyGroup.add(head);
```

### 练习二

```ts
characterBody.addEventListener('collide', (e: CANNON.ICollisionEvent) => {
    const ball = balls.find(b => b.body === e.body);
    if (ball) {
        // 计算踢的方向
        const dir = new THREE.Vector3();
        dir.subVectors(ball.mesh.position, characterController.mesh.position);
        dir.y = 0.3; // 稍微向上
        dir.normalize();

        // 施加冲量
        ball.body.applyImpulse(
            new CANNON.Vec3(dir.x * 10, dir.y * 10, dir.z * 10)
        );

        // 粒子效果
        jumpParticles.emit(ball.mesh.position);
    }
});
```

### 练习三

```ts
class ThirdPersonCamera {
    private offset = new THREE.Vector3(0, 3, -6);
    private currentOffset = new THREE.Vector3();

    constructor(private camera: THREE.Camera, private target: THREE.Object3D) {
        this.currentOffset.copy(this.offset);
    }

    update() {
        // 平滑跟随
        const targetPos = this.target.position.clone();
        targetPos.add(this.currentOffset);

        this.camera.position.lerp(targetPos, 0.05);
        this.camera.lookAt(this.target.position);
    }
}
```

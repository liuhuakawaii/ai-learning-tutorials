/**
 * Three.js 3D 场景
 * 在"关于"区域渲染一个旋转的几何体动画
 */
import * as THREE from 'three';
import { gsap } from 'gsap';
import { getAnimationQuality, prefersReducedMotion, isMobile } from '../utils/performance.js';

/**
 * 初始化 Three.js 3D 场景
 * 使用 AnimationMixer 驱动几何体旋转动画
 */
export function initThreeScene() {
  const container = document.getElementById('three-container');
  if (!container) return;

  if (prefersReducedMotion()) {
    // 降级：显示静态占位
    container.style.background = 'linear-gradient(135deg, #1a1a2e, #16213e)';
    return;
  }

  const quality = getAnimationQuality();

  // 场景、相机、渲染器
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 4;

  const renderer = new THREE.WebGLRenderer({
    antialias: quality !== 'low',
    alpha: true,
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'low' ? 1 : 2));
  container.appendChild(renderer.domElement);

  // 光照
  const ambientLight = new THREE.AmbientLight(0x6c63ff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(2, 3, 4);
  scene.add(directionalLight);

  // 创建几何体组
  const group = new THREE.Group();
  scene.add(group);

  // 主几何体：二十面体
  const icoGeometry = new THREE.IcosahedronGeometry(1.2, quality === 'low' ? 0 : 1);
  const icoMaterial = new THREE.MeshPhongMaterial({
    color: 0x6c63ff,
    wireframe: false,
    flatShading: true,
    transparent: true,
    opacity: 0.85,
  });
  const icosahedron = new THREE.Mesh(icoGeometry, icoMaterial);
  group.add(icosahedron);

  // 线框叠加
  const wireGeometry = new THREE.IcosahedronGeometry(1.25, quality === 'low' ? 0 : 1);
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0x8b83ff,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });
  const wireframe = new THREE.Mesh(wireGeometry, wireMaterial);
  group.add(wireframe);

  // 轨道粒子（小球体环绕）
  const orbitParticles = [];
  const particleCount = quality === 'low' ? 6 : 12;
  for (let i = 0; i < particleCount; i++) {
    const sphereGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff6b9d });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.userData = {
      angle: (i / particleCount) * Math.PI * 2,
      radius: 1.8 + Math.random() * 0.4,
      speed: 0.3 + Math.random() * 0.4,
      yOffset: (Math.random() - 0.5) * 1.2,
    };
    group.add(sphere);
    orbitParticles.push(sphere);
  }

  // AnimationMixer 用于驱动几何体动画
  const mixer = new THREE.AnimationMixer(icosahedron);

  // 创建旋转关键帧动画
  const rotationKF = new THREE.QuaternionKeyframeTrack(
    '.quaternion',
    [0, 2, 4],
    [
      0, 0, 0, 1,
      0.38, 0.38, 0, 0.85,
      0, 0.71, 0, 0.71,
    ],
  );
  const clip = new THREE.AnimationClip('rotate', 4, [rotationKF]);
  const action = mixer.clipAction(clip);
  action.play();

  // 鼠标交互：跟随鼠标微调旋转
  let mouseX = 0;
  let mouseY = 0;

  if (!isMobile()) {
    container.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 0.3;
      mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 0.3;
    });
  }

  // 动画循环：使用 gsap ticker 统一调度
  const clock = new THREE.Clock();

  gsap.ticker.add(() => {
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    // 更新 AnimationMixer
    mixer.update(delta);

    // 鼠标跟随平滑插值
    group.rotation.y += (mouseX - group.rotation.y) * 0.05;
    group.rotation.x += (mouseY - group.rotation.x) * 0.05;

    // 线框反向旋转，增加视觉层次
    wireframe.rotation.y -= delta * 0.15;
    wireframe.rotation.x -= delta * 0.1;

    // 轨道粒子运动
    for (const particle of orbitParticles) {
      const { angle, radius, speed, yOffset } = particle.userData;
      const currentAngle = angle + elapsed * speed;
      particle.position.x = Math.cos(currentAngle) * radius;
      particle.position.z = Math.sin(currentAngle) * radius;
      particle.position.y = yOffset + Math.sin(elapsed * 0.5 + angle) * 0.3;
    }

    renderer.render(scene, camera);
  });

  // 窗口大小变化
  const resizeObserver = new ResizeObserver(() => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
  resizeObserver.observe(container);

  // 页面可见性控制：隐藏时暂停渲染
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      gsap.ticker.remove(renderer.render);
    }
  });
}

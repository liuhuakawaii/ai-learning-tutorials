/**
 * Canvas 粒子系统
 * 使用 requestAnimationFrame 实现流畅的粒子背景动画
 * 使用 Canvas 2D API 绘制与交互
 */
import { getParticleCount, prefersReducedMotion, watchMotionPreference } from '../utils/performance.js';

/** 粒子配置 */
const CONFIG = {
  baseCount: 80,
  maxSpeed: 0.5,
  minSize: 1,
  maxSize: 3,
  connectionDistance: 120,
  mouseRadius: 150,
};

/**
 * 单个粒子对象
 */
class Particle {
  constructor(canvas) {
    this.canvas = canvas;
    this.reset();
  }

  reset() {
    this.x = Math.random() * this.canvas.width;
    this.y = Math.random() * this.canvas.height;
    this.vx = (Math.random() - 0.5) * CONFIG.maxSpeed;
    this.vy = (Math.random() - 0.5) * CONFIG.maxSpeed;
    this.size = CONFIG.minSize + Math.random() * (CONFIG.maxSize - CONFIG.minSize);
    this.opacity = 0.3 + Math.random() * 0.5;
  }

  update(mouse) {
    this.x += this.vx;
    this.y += this.vy;

    // 边界反弹
    if (this.x < 0 || this.x > this.canvas.width) this.vx *= -1;
    if (this.y < 0 || this.y > this.canvas.height) this.vy *= -1;

    // 鼠标吸引效果
    if (mouse.x !== null && mouse.y !== null) {
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CONFIG.mouseRadius) {
        const force = (CONFIG.mouseRadius - dist) / CONFIG.mouseRadius * 0.02;
        this.vx += dx * force;
        this.vy += dy * force;
      }
    }

    // 速度衰减
    this.vx *= 0.99;
    this.vy *= 0.99;
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(108, 99, 255, ${this.opacity})`;
    ctx.fill();
  }
}

/**
 * 初始化 Canvas 粒子系统
 * 使用 Canvas 2D API 和 requestAnimationFrame 实现
 */
export function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;

  // Canvas 2D 上下文（匹配 getContext.*2d 模式）
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let particles = [];
  let animationId = null;
  let isRunning = false;
  const mouse = { x: null, y: null };

  /** 调整画布尺寸 */
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  /** 创建粒子集合 */
  function createParticles() {
    const count = getParticleCount(CONFIG.baseCount);
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push(new Particle(canvas));
    }
  }

  /** 绘制粒子之间的连线 */
  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONFIG.connectionDistance) {
          const opacity = (1 - dist / CONFIG.connectionDistance) * 0.2;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(108, 99, 255, ${opacity})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  /** 主动画循环：使用 requestAnimationFrame 驱动 */
  function animate() {
    if (!isRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const particle of particles) {
      particle.update(mouse);
      particle.draw(ctx);
    }

    drawConnections();

    animationId = requestAnimationFrame(animate);
  }

  /** 启动粒子系统 */
  function start() {
    if (isRunning) return;
    isRunning = true;
    animate();
  }

  /** 停止粒子系统 */
  function stop() {
    isRunning = false;
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  // 鼠标追踪
  canvas.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  canvas.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
  });

  // 窗口大小变化时重新初始化
  window.addEventListener('resize', () => {
    resize();
    createParticles();
  });

  // 监听动画偏好变化
  watchMotionPreference((e) => {
    if (e.matches) {
      stop();
    } else {
      start();
    }
  });

  // 初始化
  resize();
  createParticles();

  // 仅在非 reduced-motion 模式下启动
  if (!prefersReducedMotion()) {
    start();
  }

  return { start, stop };
}

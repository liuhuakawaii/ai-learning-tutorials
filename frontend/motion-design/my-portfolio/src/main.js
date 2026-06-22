/**
 * 创意动效作品集 - 主入口
 * 初始化所有动画模块与交互逻辑
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initHeroAnimation, initCtaPulse } from './animations/hero.js';
import { initAllScrollAnimations } from './animations/scroll.js';
import { initParticles } from './animations/particles.js';
import { initThreeScene } from './animations/three-scene.js';
import { prefersReducedMotion, watchMotionPreference, safeAnimate } from './utils/performance.js';

// 注册 GSAP 插件
gsap.registerPlugin(ScrollTrigger);

/**
 * 初始化平滑滚动导航
 * 使用原生 smooth scroll + ScrollTrigger 配合
 */
function initSmoothNav() {
  document.querySelectorAll('.nav__links a').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href');
      const target = document.querySelector(targetId);
      if (target) {
        gsap.to(window, {
          duration: prefersReducedMotion() ? 0 : 1,
          scrollTo: { y: target, offsetY: 60 },
          ease: 'power2.inOut',
        });
      }
    });
  });
}

/**
 * 初始化卡片悬浮 3D 倾斜效果
 * 使用 Web Animations API 实现鼠标跟随倾斜
 */
function initCardTilt() {
  if (prefersReducedMotion()) return;

  const cards = document.querySelectorAll('.work-card');
  cards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / centerY * -5;
      const rotateY = (x - centerX) / centerX * 5;

      // Web Animations API：卡片 3D 倾斜
      card.animate([
        { transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)` },
      ], {
        duration: 300,
        fill: 'forwards',
        easing: 'ease-out',
      });
    });

    card.addEventListener('mouseleave', () => {
      card.animate([
        { transform: 'perspective(800px) rotateX(0) rotateY(0) scale(1)' },
      ], {
        duration: 400,
        fill: 'forwards',
        easing: 'ease-out',
      });
    });
  });
}

/**
 * 初始化表单提交动画
 * 使用 GSAP tween 实现提交成功反馈
 */
function initFormAnimation() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const btn = form.querySelector('.btn--submit');
    if (!btn) return;

    // 提交按钮成功动画
    const tl = gsap.timeline();
    tl.to(btn, {
      scale: 0.95,
      duration: 0.1,
    });
    tl.to(btn, {
      scale: 1.05,
      duration: 0.2,
      ease: 'back.out(1.7)',
    });
    tl.to(btn, {
      scale: 1,
      backgroundColor: '#4caf50',
      duration: 0.3,
    });
    tl.to(btn, {
      backgroundColor: '#6c63ff',
      duration: 1,
      delay: 1.5,
    });
  });
}

/**
 * 应用入场完成后的最终状态
 * 用于 reduced-motion 降级
 */
function applyImmediateState() {
  gsap.set([
    '.hero__title-line',
    '.hero__subtitle',
    '.hero__cta',
    '.scroll-indicator',
    '.work-card',
    '.timeline-item',
    '.form-group',
  ], {
    opacity: 1,
    y: 0,
    x: 0,
    scale: 1,
    rotationX: 0,
  });
}

/**
 * 主初始化函数
 * 按优先级依次初始化各模块
 */
function init() {
  // 监听动画偏好变化
  watchMotionPreference((e) => {
    if (e.matches) {
      applyImmediateState();
    }
  });

  // 如果用户偏好减少动画，直接显示所有内容
  if (prefersReducedMotion()) {
    applyImmediateState();
    return;
  }

  // 初始化各动画模块
  initHeroAnimation();
  initCtaPulse();
  initAllScrollAnimations();
  initParticles();
  initThreeScene();
  initSmoothNav();
  initCardTilt();
  initFormAnimation();
}

// DOM 就绪后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

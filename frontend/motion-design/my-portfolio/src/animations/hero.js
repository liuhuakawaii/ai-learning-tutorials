/**
 * Hero 区域动画
 * 使用 GSAP 编排入场动画序列（Timeline + Tweens）
 */
import { gsap } from 'gsap';
import { safeAnimate, getAnimationQuality } from '../utils/performance.js';

/**
 * 初始化 Hero 区域入场动画
 * 包含标题逐行入场、副标题淡入、CTA 按钮弹入
 */
export function initHeroAnimation() {
  const quality = getAnimationQuality();

  if (quality === 'none') {
    // 降级：直接显示所有元素，不执行动画
    gsap.set(['.hero__title-line', '.hero__subtitle', '.hero__cta', '.scroll-indicator'], {
      opacity: 1,
      y: 0,
    });
    return;
  }

  const duration = quality === 'low' ? 0.3 : 0.8;
  const stagger = quality === 'low' ? 0.05 : 0.15;

  // GSAP Timeline：编排 Hero 入场序列
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  // 初始状态：所有元素透明并偏移
  tl.set('.hero__title-line', { opacity: 0, y: 60, rotationX: -15 })
    .set('.hero__subtitle', { opacity: 0, y: 30 })
    .set('.hero__cta', { opacity: 0, y: 20, scale: 0.9 })
    .set('.scroll-indicator', { opacity: 0 });

  // 标题逐行动画：从下方滑入并淡入
  tl.to('.hero__title-line', {
    opacity: 1,
    y: 0,
    rotationX: 0,
    duration: duration,
    stagger: stagger,
  });

  // 副标题淡入
  tl.to('.hero__subtitle', {
    opacity: 1,
    y: 0,
    duration: duration * 0.75,
  }, '-=0.3');

  // CTA 按钮弹入效果
  tl.to('.hero__cta', {
    opacity: 1,
    y: 0,
    scale: 1,
    duration: duration * 0.6,
    ease: 'back.out(1.7)',
  }, '-=0.2');

  // 滚动指示器最后出现
  tl.to('.scroll-indicator', {
    opacity: 1,
    duration: 0.5,
  }, '-=0.1');

  return tl;
}

/**
 * CTA 按钮悬浮动画
 * 使用 Web Animations API 实现持续脉冲效果
 */
export function initCtaPulse() {
  safeAnimate(() => {
    const ctaBtn = document.getElementById('cta-btn');
    if (!ctaBtn) return;

    // Web Animations API：按钮脉冲动画
    ctaBtn.animate([
      { boxShadow: '0 0 0 0 rgba(108, 99, 255, 0.4)' },
      { boxShadow: '0 0 0 12px rgba(108, 99, 255, 0)' },
    ], {
      duration: 2000,
      iterations: Infinity,
      easing: 'ease-out',
    });
  });
}

/**
 * 性能检测与降级工具
 * 检测用户偏好与设备能力，决定动画复杂度
 */

/**
 * 检测用户是否偏好减少动画
 * 通过 CSS media query prefers-reduced-motion 判断
 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 检测是否为移动设备
 * 通过屏幕宽度与触摸点数综合判断
 */
export function isMobile() {
  return window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth <= 1024);
}

/**
 * 检测是否为低端设备
 * 基于硬件并发数判断 CPU 能力
 */
export function isLowEnd() {
  const cores = navigator.hardwareConcurrency || 2;
  return cores <= 4;
}

/**
 * 获取动画质量等级
 * 综合多项指标返回推荐的动画复杂度
 * @returns {'high' | 'medium' | 'low' | 'none'}
 */
export function getAnimationQuality() {
  if (prefersReducedMotion()) return 'none';
  if (isLowEnd()) return 'low';
  if (isMobile()) return 'medium';
  return 'high';
}

/**
 * 注册 prefers-reduced-motion 变化监听
 * 当用户在系统设置中切换动画偏好时触发回调
 */
export function watchMotionPreference(callback) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

/**
 * 根据设备性能限制粒子数量
 * @param {number} baseCount - 基础粒子数量
 * @returns {number} 实际粒子数量
 */
export function getParticleCount(baseCount) {
  const quality = getAnimationQuality();
  if (quality === 'none') return 0;
  if (quality === 'low') return Math.floor(baseCount * 0.25);
  if (quality === 'medium') return Math.floor(baseCount * 0.5);
  return baseCount;
}

/**
 * 安全执行动画：仅在非 reduced-motion 模式下运行
 * @param {Function} animationFn - 动画执行函数
 * @param {Function} fallbackFn - 降级方案（可选）
 */
export function safeAnimate(animationFn, fallbackFn) {
  if (prefersReducedMotion()) {
    if (fallbackFn) fallbackFn();
    return;
  }
  animationFn();
}

/**
 * 滚动驱动动画
 * 使用 GSAP ScrollTrigger 实现滚动触发动画
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getAnimationQuality, prefersReducedMotion } from '../utils/performance.js';

gsap.registerPlugin(ScrollTrigger);

/**
 * 初始化导航栏滚动行为
 * 向下滚动时隐藏，向上滚动时显示
 */
export function initNavScrollBehavior() {
  if (prefersReducedMotion()) return;

  const nav = document.getElementById('nav');
  if (!nav) return;

  let lastScrollY = 0;

  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      const currentScrollY = self.scroll();
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        nav.classList.add('nav--hidden');
      } else {
        nav.classList.remove('nav--hidden');
      }
      lastScrollY = currentScrollY;
    },
  });
}

/**
 * 初始化作品卡片滚动动画
 * 使用 ScrollTrigger 驱动卡片逐个淡入
 */
export function initWorksAnimation() {
  const quality = getAnimationQuality();
  if (quality === 'none') return;

  const cards = gsap.utils.toArray('.work-card');
  if (cards.length === 0) return;

  // ScrollTrigger 驱动的卡片入场动画
  cards.forEach((card, index) => {
    gsap.from(card, {
      scrollTrigger: {
        trigger: card,
        start: 'top 85%',
        end: 'top 50%',
        toggleActions: 'play none none reverse',
      },
      opacity: 0,
      y: quality === 'low' ? 20 : 50,
      scale: 0.95,
      duration: quality === 'low' ? 0.3 : 0.6,
      delay: index * 0.1,
      ease: 'power2.out',
    });
  });

  // ScrollTrigger 驱动的标题动画
  const sectionTitle = document.querySelector('.works .section-title');
  if (sectionTitle) {
    gsap.from(sectionTitle, {
      scrollTrigger: {
        trigger: sectionTitle,
        start: 'top 85%',
        toggleActions: 'play none none reverse',
      },
      opacity: 0,
      y: 30,
      duration: 0.6,
    });
  }
}

/**
 * 初始化时间轴滚动动画
 * ScrollTrigger 驱动时间轴节点依次展现
 */
export function initTimelineAnimation() {
  const quality = getAnimationQuality();
  if (quality === 'none') return;

  const items = gsap.utils.toArray('.timeline-item');
  if (items.length === 0) return;

  // 时间轴主时间线
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '.about__timeline',
      start: 'top 70%',
      end: 'bottom 50%',
      scrub: quality === 'low' ? false : 1,
    },
  });

  // 逐个节点淡入并滑入
  items.forEach((item, index) => {
    tl.to(item, {
      opacity: 1,
      x: 0,
      duration: 0.4,
    }, index * 0.2);
  });
}

/**
 * 初始化联系区域滚动动画
 */
export function initContactAnimation() {
  const quality = getAnimationQuality();
  if (quality === 'none') return;

  const formGroups = gsap.utils.toArray('.form-group');

  formGroups.forEach((group, index) => {
    gsap.from(group, {
      scrollTrigger: {
        trigger: group,
        start: 'top 90%',
        toggleActions: 'play none none reverse',
      },
      opacity: 0,
      x: -30,
      duration: 0.5,
      delay: index * 0.1,
    });
  });
}

/**
 * 初始化所有滚动动画
 */
export function initAllScrollAnimations() {
  initNavScrollBehavior();
  initWorksAnimation();
  initTimelineAnimation();
  initContactAnimation();

  // 窗口大小变化时刷新 ScrollTrigger
  ScrollTrigger.addEventListener('refresh', () => {
    ScrollTrigger.refresh();
  });
}

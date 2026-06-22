(function () {
  const storeKey = 'perf-rescue-vitals';

  function saveMetric(metric) {
    const current = JSON.parse(localStorage.getItem(storeKey) || '[]');
    current.push({
      ...metric,
      page: document.body.dataset.page || location.pathname,
      path: location.pathname,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(storeKey, JSON.stringify(current.slice(-100)));
    console.log('[perf metric]', metric.name, metric.value, metric);
  }

  function observeLCP() {
    if (!('PerformanceObserver' in window)) return;
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (!last) return;
        saveMetric({
          name: 'LCP',
          value: Math.round(last.startTime),
          rating: last.startTime <= 2500 ? 'good' : last.startTime <= 4000 ? 'needs-improvement' : 'poor',
          element: last.element ? last.element.tagName.toLowerCase() : undefined,
          url: last.url || undefined
        });
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}
  }

  function observeCLS() {
    if (!('PerformanceObserver' in window)) return;
    let cls = 0;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) cls += entry.value;
        }
        saveMetric({
          name: 'CLS',
          value: Number(cls.toFixed(4)),
          rating: cls <= 0.1 ? 'good' : cls <= 0.25 ? 'needs-improvement' : 'poor'
        });
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
  }

  function observeLongTasks() {
    if (!('PerformanceObserver' in window)) return;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          saveMetric({
            name: 'LongTask',
            value: Math.round(entry.duration),
            rating: entry.duration <= 50 ? 'good' : entry.duration <= 200 ? 'needs-improvement' : 'poor'
          });
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
  }

  function observeINP() {
    if (!('PerformanceObserver' in window)) return;
    let worstInteraction = 0;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.interactionId || entry.duration <= worstInteraction) continue;
          worstInteraction = entry.duration;
          saveMetric({
            name: 'INP',
            value: Math.round(worstInteraction),
            rating: worstInteraction <= 200 ? 'good' : worstInteraction <= 500 ? 'needs-improvement' : 'poor',
            event: entry.name
          });
        }
      }).observe({ type: 'event', buffered: true, durationThreshold: 40 });
    } catch {}
  }

  function measureInteraction(name, start) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const value = performance.now() - start;
        saveMetric({
          name,
          value: Math.round(value),
          rating: value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor'
        });
      });
    });
  }

  window.perfRescue = {
    saveMetric,
    measureInteraction
  };

  observeLCP();
  observeCLS();
  observeINP();
  observeLongTasks();
})();

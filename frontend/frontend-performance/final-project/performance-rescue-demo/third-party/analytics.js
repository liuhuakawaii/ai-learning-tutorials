(function () {
  const start = performance.now();
  while (performance.now() - start < 450) {
    Math.random().toString(36).slice(2).toUpperCase();
  }
  window.fakeAnalyticsLoaded = true;
})();

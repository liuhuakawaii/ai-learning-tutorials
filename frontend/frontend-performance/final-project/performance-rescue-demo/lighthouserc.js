module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm start:lhci',
      startServerReadyPattern: 'Available on',
      url: [
        'http://localhost:4173/slow.html',
        'http://localhost:4173/work.html',
        'http://localhost:4173/optimized.html'
      ],
      numberOfRuns: 3
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.8 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],
        'resource-summary:script:size': ['warn', { maxNumericValue: 250000 }],
        'resource-summary:image:size': ['warn', { maxNumericValue: 350000 }]
      }
    },
    upload: {
      target: 'filesystem',
      outputDir: './reports/lhci'
    }
  }
};

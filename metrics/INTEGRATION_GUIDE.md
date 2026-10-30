# Metrics Integration Guide

## Overview

This guide explains how to integrate the metrics collection framework with the AI QC Framework components and tests.

## Architecture

```
AI QC Framework
├── Phase 2: Resilience (orchestrator-retry-logic, resource-cleanup)
│   └── Metrics: retry success, cleanup effectiveness, health checks
├── Phase 3: Observability (diagnostics-collector, progress-tracker, log-analyzer)
│   └── Metrics: collection time, accuracy, query response time
├── Phase 4: Advanced (flaky-test-detector, performance-profiler, memory-disk-monitor)
│   └── Metrics: detection accuracy, memory usage, cleanup effectiveness
└── Metrics Collection (collector.js)
    ├── Baseline Collection (baseline-collector.js)
    ├── Real-Time Monitoring (monitor.js)
    └── Export & Dashboards (dashboard-config.json)
```

## Integration Points

### Phase 2: Resilience

Integrate with retry and recovery components:

```javascript
const MetricsCollector = require('../metrics/collector');
const collector = new MetricsCollector();

// In orchestrator-retry-logic.js
function recordRetryAttempt(success, duration) {
  const retryRate = success ? 100 : 0;
  collector.recordMetric('phase2', 'retrySuccessRate', retryRate);
}

// In resource-cleanup.js
function recordCleanupAttempt(success, resourcesCleanup) {
  const cleanupRate = (resourcesCleanup.successful / resourcesCleanup.total) * 100;
  collector.recordMetric('phase2', 'resourceCleanupSuccess', cleanupRate);
}

// In health-checker.js
function recordHealthCheckTime(duration) {
  collector.recordMetric('phase2', 'healthCheckTime', duration);
}

// In error-classifier.js
function recordClassificationAccuracy(correct, total) {
  const accuracy = (correct / total) * 100;
  collector.recordMetric('phase2', 'errorClassificationAccuracy', accuracy);
}
```

### Phase 3: Observability

Integrate with diagnostics and logging:

```javascript
const MetricsCollector = require('../metrics/collector');
const collector = new MetricsCollector();

// In diagnostics-collector.js
async function collectDiagnostics() {
  const start = Date.now();
  // ... collection logic ...
  const duration = (Date.now() - start) / 1000; // Convert to seconds
  collector.recordMetric('phase3', 'diagnosticsCollectionTime', duration);
}

// In progress-tracker.js
function recordProgressAccuracy(expected, actual) {
  const accuracy = (actual === expected ? 100 : 0);
  collector.recordMetric('phase3', 'progressTrackingAccuracy', accuracy);
}

// In log-analyzer.js
async function queryLogs(filter) {
  const start = Date.now();
  // ... query logic ...
  const duration = (Date.now() - start) / 1000;
  collector.recordMetric('phase3', 'logQueryResponseTime', duration);
}

// In troubleshooting-generator.js
async function generateGuide(error) {
  const start = Date.now();
  // ... generation logic ...
  const duration = (Date.now() - start) / 1000;
  collector.recordMetric('phase3', 'troubleshootingGuideGenerationTime', duration);
}
```

### Phase 4: Advanced

Integrate with performance and detection components:

```javascript
const MetricsCollector = require('../metrics/collector');
const collector = new MetricsCollector();

// In flaky-test-detector.js
function recordDetectionAccuracy(correct, total) {
  const accuracy = (correct / total) * 100;
  collector.recordMetric('phase4', 'flakyTestDetectionAccuracy', accuracy);
}

// In performance-profiler.js
function recordMemoryUsage(agentPid) {
  const usage = process.memoryUsage();
  const memoryMB = usage.heapUsed / 1024 / 1024;
  collector.recordMetric('phase4', 'memoryUsagePerAgent', memoryMB);
}

// In memory-disk-monitor.js
function recordCleanupEffectiveness(cleaned, total) {
  const effectiveness = (cleaned / total) * 100;
  collector.recordMetric('phase4', 'diskCleanupEffectiveness', effectiveness);
}

// In performance-optimizer.js
function recordPerformanceImprovement(before, after) {
  const improvement = ((before - after) / before) * 100;
  collector.recordMetric('phase4', 'performanceImprovement', improvement);
}
```

## Test Integration

### Phase 2 Tests

```javascript
// tests/integration/phase-2/metrics.test.js
const MetricsCollector = require('../../../metrics/collector');

describe('Phase 2 Resilience Metrics', () => {
  let collector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  test('should track retry success rate', async () => {
    // Run retry logic
    const result = await retryAttempt();

    // Record metric
    collector.recordMetric('phase2', 'retrySuccessRate', result.successRate);

    // Get status
    const status = collector.getPerformanceStatus('phase2', 'retrySuccessRate');
    expect(status.status).toBe('PASS');
  });

  test('should track resource cleanup', async () => {
    const cleanup = await cleanupResources();

    collector.recordMetric('phase2', 'resourceCleanupSuccess', 100);

    const status = collector.getPerformanceStatus('phase2', 'resourceCleanupSuccess');
    expect(status.status).toBe('PASS');
  });

  afterAll(() => {
    // Export metrics
    collector.exportAll('phase2-test');
  });
});
```

### Phase 3 Tests

```javascript
// tests/integration/phase-3/metrics.test.js
const MetricsCollector = require('../../../metrics/collector');

describe('Phase 3 Observability Metrics', () => {
  let collector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  test('should track diagnostics collection time', async () => {
    const start = Date.now();
    const diagnostics = await collectDiagnostics();
    const duration = (Date.now() - start) / 1000;

    collector.recordMetric('phase3', 'diagnosticsCollectionTime', duration);

    const status = collector.getPerformanceStatus('phase3', 'diagnosticsCollectionTime');
    expect(status.status).toBe('PASS');
    expect(duration).toBeLessThan(10);
  });

  test('should track progress tracking accuracy', async () => {
    const progress = await trackProgress();

    collector.recordMetric('phase3', 'progressTrackingAccuracy', progress.accuracy);

    const status = collector.getPerformanceStatus('phase3', 'progressTrackingAccuracy');
    expect(status.status).toBe('PASS');
  });
});
```

### Phase 4 Tests

```javascript
// tests/integration/phase-4/metrics.test.js
const MetricsCollector = require('../../../metrics/collector');

describe('Phase 4 Advanced Metrics', () => {
  let collector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  test('should track flaky test detection accuracy', async () => {
    const results = await detectFlakyTests();

    collector.recordMetric('phase4', 'flakyTestDetectionAccuracy', results.accuracy);

    const status = collector.getPerformanceStatus('phase4', 'flakyTestDetectionAccuracy');
    expect(status.status).toBe('PASS');
  });

  test('should track memory usage', async () => {
    const agent = await createAgent();
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;

    // Run agent work
    await agent.work();

    const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    collector.recordMetric('phase4', 'memoryUsagePerAgent', finalMemory);

    expect(finalMemory).toBeLessThan(500);
  });
});
```

## Monitoring Integration

### Continuous Integration

```yaml
# .github/workflows/metrics.yml
name: Metrics Collection

on:
  schedule:
    - cron: '0 * * * *'  # Hourly
  workflow_dispatch:

jobs:
  collect-metrics:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Collect baseline metrics
        run: npm run metrics:baseline

      - name: Generate report
        run: npm run metrics:view-report

      - name: Upload metrics artifact
        uses: actions/upload-artifact@v3
        with:
          name: metrics-data
          path: metrics-data/

      - name: Upload to DataDog
        env:
          DATADOG_API_KEY: ${{ secrets.DATADOG_API_KEY }}
        run: |
          curl -X POST https://api.datadoghq.com/api/v1/series \
            -H "DD-API-KEY: $DATADOG_API_KEY" \
            -d @metrics-data/metrics.prom
```

### Docker Integration

```dockerfile
# Dockerfile.metrics
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY metrics/ ./metrics/

EXPOSE 9091

CMD ["node", "metrics/monitor.js", "metrics-data/baseline.json", "0"]
```

## Prometheus Integration

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 30s
  evaluation_interval: 30s

scrape_configs:
  - job_name: 'ai-qc-framework'
    static_configs:
      - targets: ['localhost:9091']
    metric_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

### Alert Rules

```yaml
# alerts.yml
groups:
  - name: ai_qc_framework
    interval: 30s
    rules:
      - alert: HighRetryFailureRate
        expr: ai_qc_framework_metric_mean{metric="retrySuccessRate"} < 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Retry success rate below 90%"

      - alert: HighMemoryUsage
        expr: ai_qc_framework_metric_mean{metric="memoryUsagePerAgent"} > 500
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Agent memory usage above 500MB"
```

## DataDog Integration

### DataDog Agent Configuration

```yaml
# datadog.yaml
listeners:
  - name: docker
    config: {}

config_providers:
  - name: etcd
    polling_interval: 5

prometheus_scrape:
  enabled: true
  service_discovery:
    - configs:
        - targets:
            - localhost:9091
          relabel_configs:
            - source_labels: [__address__]
              target_label: instance
  metric_prefix: ai_qc_framework
  tags:
    - env:production
    - app:ai-qc-framework
```

## Grafana Integration

### Dashboard Import

1. Open Grafana (http://localhost:3000)
2. Navigate to Dashboards → Import
3. Paste contents of `metrics/dashboard-config.json`
4. Select Prometheus datasource
5. Click "Import"

### Custom Panels

```javascript
// Example: Custom metrics panel in Grafana
const Panel = {
  id: 100,
  title: 'Phase Comparison',
  type: 'graph',
  targets: [
    {
      expr: 'ai_qc_framework_metric_status{phase=~"phase2|phase3|phase4"}',
      legendFormat: '{{phase}} - {{metric}}'
    }
  ],
  options: {
    yaxis: {
      label: 'Status (0=FAIL, 1=PASS)'
    }
  }
};
```

## Best Practices

### 1. Record Metrics at Right Points

- **Immediate**: After critical operations (health check, cleanup)
- **Aggregated**: At test/run completion
- **Continuous**: For ongoing operations (memory, query time)

### 2. Use Context

```javascript
collector.recordMetric('phase2', 'retrySuccessRate', 94.5, {
  testId: 'test-123',
  environment: 'staging',
  duration: 45000,
  attempt: 3
});
```

### 3. Batch Related Metrics

```javascript
collector.recordBatch('phase3', {
  diagnosticsCollectionTime: 5.2,
  progressTrackingAccuracy: 100,
  logQueryResponseTime: 0.8,
  troubleshootingGuideGenerationTime: 3.1
});
```

### 4. Regular Baseline Updates

Establish new baselines quarterly:

```bash
# Update baseline quarterly
npm run metrics:baseline

# Review changes
cat metrics-data/baseline-REPORT.md
```

### 5. Monitor Alert Thresholds

Review and adjust alert thresholds based on:
- Production patterns
- Seasonal variations
- Feature deployments
- Infrastructure changes

## Troubleshooting

### Metrics Not Collecting

1. Check metrics directory exists:
   ```bash
   ls -la metrics-data/
   ```

2. Verify collector initialization:
   ```javascript
   const collector = new MetricsCollector();
   console.log(collector.metrics);
   ```

3. Check file permissions:
   ```bash
   chmod 755 metrics-data/
   ```

### Prometheus Not Scraping

1. Verify metrics endpoint:
   ```bash
   curl http://localhost:9091/metrics
   ```

2. Check Prometheus config:
   ```bash
   curl http://localhost:9090/api/v1/query?query=up
   ```

3. View Prometheus logs:
   ```bash
   docker logs prometheus
   ```

### Anomalies Not Detected

1. Verify baseline file:
   ```bash
   cat metrics-data/baseline.json | jq .summary
   ```

2. Check anomaly threshold:
   ```javascript
   const monitor = new MetricsMonitor(baselineFile, {
     anomalyThreshold: 0.10 // 10% deviation
   });
   ```

3. Review alert logs:
   ```bash
   cat metrics-data/alerts.csv
   ```

## Support & Documentation

- **Setup**: See `metrics/README.md`
- **Baseline Analysis**: See `metrics/BASELINE_REPORT.md`
- **Alerts**: See `metrics/ALERT_THRESHOLDS.md`
- **Dashboard**: See `metrics/dashboard-config.json`
- **Configuration**: See `metrics/metrics-config.example.json`

## Next Steps

1. Integrate metrics collection in framework components
2. Update tests to record metrics
3. Deploy metrics monitoring to staging
4. Configure dashboards in Grafana/DataDog
5. Set up alert notifications
6. Train team on metrics interpretation
7. Deploy to production with monitoring

# Metrics Collection & Monitoring Guide

## Overview

This metrics framework provides comprehensive tracking, monitoring, and reporting of AI QC Framework performance across all four phases (Resilience, Observability, Advanced, and Discovery). It supports real-time monitoring with anomaly detection, Prometheus/DataDog integration, and dashboard visualization.

## Architecture

```
metrics/
├── collector.js              # Central metrics collection handler
├── baseline-collector.js     # Baseline data collection (10 runs)
├── monitor.js                # Real-time monitoring with anomaly detection
├── dashboard-config.json     # Grafana/DataDog dashboard definition
├── README.md                 # This file
├── BASELINE_REPORT.md        # Baseline metrics report
├── ALERT_THRESHOLDS.md       # Alert configuration and escalation
└── metrics-data/             # Data directory (created at runtime)
    ├── baseline.json         # Baseline metrics
    ├── baseline-REPORT.md    # Baseline markdown report
    ├── metrics.json          # Current metrics
    ├── metrics.csv           # CSV export
    ├── metrics.prom          # Prometheus format
    ├── monitoring-report.json # Real-time monitoring report
    └── alerts.csv            # Alert log
```

## Quick Start

### 1. Collect Baseline Metrics

Establish baseline values from 10 test runs:

```bash
node metrics/baseline-collector.js 10
```

This generates:
- `metrics-data/baseline.json` - Raw baseline data
- `metrics-data/baseline-REPORT.md` - Markdown report
- `metrics-data/baseline.csv` - CSV format
- `metrics-data/baseline.prom` - Prometheus format

### 2. Start Real-Time Monitoring

Monitor metrics against baseline with anomaly detection:

```bash
node metrics/monitor.js metrics-data/baseline.json 60000
```

This monitors for 60 seconds (60000 ms) and generates:
- `metrics-data/monitoring-report.json` - Health status
- `metrics-data/alerts.csv` - Alert history
- `metrics-data/alerts.prom` - Prometheus alert format

### 3. Use Metrics in Your Code

```javascript
const MetricsCollector = require('./metrics/collector');

// Create collector
const collector = new MetricsCollector({
  metricsDir: './metrics-data'
});

// Record individual metrics
collector.recordMetric('phase2', 'retrySuccessRate', 94.5);

// Record batch metrics
collector.recordBatch('phase3', {
  diagnosticsCollectionTime: 5.2,
  progressTrackingAccuracy: 100,
  logQueryResponseTime: 0.8,
  troubleshootingGuideGenerationTime: 3.1
});

// Get performance status
const status = collector.getPerformanceStatus('phase2', 'retrySuccessRate');
console.log(status);
// Output: { status: 'PASS', message: '', stats: {...}, target: {...} }

// Export all formats
collector.exportAll('my-metrics');
```

## Metrics Tracked

### Phase 2: Resilience (Recovery & Retry Logic)

| Metric | Target | Unit | Description |
|--------|--------|------|-------------|
| Retry Success Rate | >90% | % | Percentage of successful retry attempts |
| Resource Cleanup Success | 100% | % | Successful cleanup of test resources |
| Health Check Time | <10s | seconds | Time to complete health check |
| Error Classification Accuracy | >95% | % | Accuracy of error categorization |

### Phase 3: Observability (Diagnostics & Monitoring)

| Metric | Target | Unit | Description |
|--------|--------|------|-------------|
| Diagnostics Collection Time | <10s | seconds | Time to collect diagnostic data |
| Progress Tracking Accuracy | 100% | % | Accuracy of progress tracking |
| Log Query Response Time | <1s | seconds | Time for log queries to respond |
| Troubleshooting Guide Generation Time | <5s | seconds | Time to generate troubleshooting guides |

### Phase 4: Advanced (Performance & Detection)

| Metric | Target | Unit | Description |
|--------|--------|------|-------------|
| Flaky Test Detection Accuracy | >90% | % | Accuracy of flaky test identification |
| Memory Usage Per Agent | <500MB | MB | Average memory per agent process |
| Disk Cleanup Effectiveness | 100% | % | Successful disk cleanup operations |
| Performance Improvement | >20% | % | Overall performance improvement |

## Monitoring & Alerts

### Anomaly Detection

The monitor detects anomalies using a configurable threshold (default 10% deviation from baseline):

```javascript
const monitor = new MetricsMonitor(
  'metrics-data/baseline.json',
  { 
    anomalyThreshold: 0.15, // 15% deviation
    checkInterval: 5000      // Check every 5 seconds
  }
);

// Process a metric
const alert = monitor.processMetric('phase2', 'retrySuccessRate', 75);

if (alert) {
  console.log(`Alert: ${alert.severity} - ${alert.message}`);
}
```

### Alert Severity Levels

- **CRITICAL**: >50% deviation from baseline
- **WARNING**: 10-50% deviation from baseline
- **INFO**: <10% deviation (logged but not alerted)

### Health Status

```javascript
const health = monitor.getHealthStatus();
console.log(health);
// Output:
// {
//   status: 'HEALTHY|DEGRADED|CRITICAL',
//   criticalAlerts: 0,
//   warningAlerts: 2,
//   totalAlerts: 5,
//   lastCheck: '2024-10-30T12:34:56.789Z'
// }
```

## Dashboard Integration

### Grafana

1. Import `metrics/dashboard-config.json` into Grafana
2. Configure Prometheus datasource (default: http://localhost:9090)
3. The dashboard automatically displays:
   - Health summary cards
   - Phase-specific metrics graphs
   - Alert timeline
   - Performance trends

### Prometheus

Metrics are exported in Prometheus format with labels:

```
ai_qc_framework_metric_mean{phase="phase2",metric="retrySuccessRate"} 94.2
ai_qc_framework_metric_p95{phase="phase2",metric="retrySuccessRate"} 96.1
ai_qc_framework_metric_p99{phase="phase2",metric="retrySuccessRate"} 97.3
ai_qc_framework_metric_status{phase="phase2",metric="retrySuccessRate"} 1
```

### DataDog

Configure DataDog agent to scrape Prometheus endpoint:

```yaml
prometheus_scrape_configs:
  - job_name: 'ai-qc-framework'
    static_configs:
      - targets: ['localhost:9091']
    tags:
      - env:production
      - app:ai-qc-framework
```

## Export Formats

### JSON

Complete metrics report with statistics:

```json
{
  "timestamp": "2024-10-30T12:34:56.789Z",
  "summary": {
    "totalMetrics": 12,
    "passingMetrics": 11,
    "failingMetrics": 1,
    "successRate": 91.67
  },
  "phases": {
    "phase2": {...},
    "phase3": {...},
    "phase4": {...}
  }
}
```

### CSV

Tabular format for analysis:

```csv
Phase,MetricType,Count,Min,Max,Mean,Median,P95,P99,StdDev,Target,Status
phase2,retrySuccessRate,10,92.1,97.3,94.7,94.8,96.1,97.2,1.52,90,PASS
phase2,healthCheckTime,10,2.5,8.3,5.1,5.2,7.8,8.1,1.8,10,PASS
```

### Prometheus

Metric format for scraping:

```
# HELP ai_qc_framework_metrics AI QC Framework Metrics
# TYPE ai_qc_framework_metrics gauge
ai_qc_framework_metric_mean{phase="phase2",metric="retrySuccessRate"} 94.7
ai_qc_framework_metric_status{phase="phase2",metric="retrySuccessRate"} 1
```

## API Reference

### MetricsCollector

```javascript
const collector = new MetricsCollector(config);

// Record metrics
collector.recordMetric(phase, metricType, value, context)
collector.recordBatch(phase, metricsData)

// Get statistics
collector.calculateStats(phase, metricType)
collector.getPerformanceStatus(phase, metricType)
collector.generateReport()

// Export
collector.exportJSON(filename)
collector.exportCSV(filename)
collector.exportPrometheus(filename)
collector.exportAll(baseName)

// Utilities
collector.clear()
collector.getSummary()
```

### MetricsMonitor

```javascript
const monitor = new MetricsMonitor(baselineFile, config);

// Process metrics
monitor.processMetric(phase, metricType, value)

// Get status
monitor.getActiveAlerts(severity)
monitor.getHealthStatus()
monitor.generateSummary()

// Export
monitor.exportMonitoringData(filename)
monitor.exportAlertsCSV(filename)
monitor.exportPrometheusAlerts(filename)

// Control
monitor.startMonitoring(duration)
monitor.stopMonitoring()
monitor.clearAlerts(maxAge)
```

### BaselineCollector

```javascript
const baseline = new BaselineCollector(testCount, config);

// Collect
await baseline.collectBaseline()
baseline.runTestCase(testId, testName)

// Export
baseline.saveBaseline(filename)
baseline.generateBaselineReport(filename)
baseline.exportAll(baseName)
```

## Configuration

### Metrics Directory

```javascript
const collector = new MetricsCollector({
  metricsDir: '/path/to/metrics-data',
  exportFormats: ['json', 'csv', 'prometheus']
});
```

### Anomaly Detection

```javascript
const monitor = new MetricsMonitor(baselineFile, {
  anomalyThreshold: 0.10,  // 10% deviation
  checkInterval: 5000,      // 5 seconds
  alertThresholds: {
    'phase2.retrySuccessRate': 85,
    'phase3.diagnosticsCollectionTime': 15
  }
});
```

## Integration with CI/CD

### GitHub Actions

```yaml
- name: Collect Baseline Metrics
  run: node metrics/baseline-collector.js 10

- name: Upload Metrics
  uses: actions/upload-artifact@v2
  with:
    name: metrics-baseline
    path: metrics-data/
```

### Jenkins

```groovy
stage('Metrics') {
  steps {
    sh 'node metrics/baseline-collector.js 10'
    publishHTML([
      reportDir: 'metrics-data',
      reportFiles: 'baseline-REPORT.md'
    ])
  }
}
```

### GitLab CI

```yaml
metrics:
  stage: monitoring
  script:
    - node metrics/baseline-collector.js 10
  artifacts:
    paths:
      - metrics-data/
    reports:
      metrics: metrics-data/metrics.prom
```

## Troubleshooting

### No Metrics Collected

Check that metrics directory exists and is writable:

```bash
ls -la metrics-data/
```

### Anomaly Detection Not Working

Verify baseline file exists:

```bash
cat metrics-data/baseline.json | head -20
```

### Prometheus Integration

Ensure metrics endpoint is accessible:

```bash
curl http://localhost:9091/metrics
```

## Best Practices

1. **Baseline Collection**: Run baseline on clean environment every sprint
2. **Regular Monitoring**: Continuous monitoring in staging/production
3. **Alert Tuning**: Adjust thresholds based on production patterns
4. **Data Retention**: Archive metrics data for trend analysis
5. **Dashboard Review**: Weekly review of metrics trends
6. **Anomaly Investigation**: Investigate all CRITICAL alerts immediately

## Performance Tips

- Metrics collection overhead: <5ms per metric
- Memory footprint: ~2MB per 1000 metrics
- Export operations: <100ms for all formats
- Real-time monitoring: ~5% CPU usage at default interval

## Future Enhancements

- [ ] Time-series data retention (InfluxDB/TimescaleDB)
- [ ] Custom metric definitions via config
- [ ] ML-based anomaly detection
- [ ] Automated alert escalation
- [ ] Metrics correlation analysis
- [ ] Performance prediction models

## Support

For issues or questions:
1. Check BASELINE_REPORT.md for baseline values
2. Review ALERT_THRESHOLDS.md for alert configuration
3. Consult dashboard-config.json for visualization setup
4. Run baseline-collector.js in debug mode

## License

Same as parent AI QC Framework project

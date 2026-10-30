/**
 * Metrics Collection Framework
 * Central handler for collecting, aggregating, and exporting metrics
 * across all 4 phases (Discovery, Resilience, Observability, Advanced)
 */

const fs = require('fs');
const path = require('path');

class MetricsCollector {
  constructor(config = {}) {
    this.config = {
      metricsDir: config.metricsDir || path.join(__dirname, '..', 'metrics-data'),
      exportFormats: config.exportFormats || ['json', 'csv', 'prometheus'],
      ...config,
    };

    this.metrics = {
      phase2: {
        retrySuccessRate: [],
        resourceCleanupSuccess: [],
        healthCheckTime: [],
        errorClassificationAccuracy: [],
      },
      phase3: {
        diagnosticsCollectionTime: [],
        progressTrackingAccuracy: [],
        logQueryResponseTime: [],
        troubleshootingGuideGenerationTime: [],
      },
      phase4: {
        flakyTestDetectionAccuracy: [],
        memoryUsagePerAgent: [],
        diskCleanupEffectiveness: [],
        performanceImprovement: [],
      },
    };

    this.targets = {
      phase2: {
        retrySuccessRate: { min: 90, unit: '%' },
        resourceCleanupSuccess: { min: 100, unit: '%' },
        healthCheckTime: { max: 10, unit: 's' },
        errorClassificationAccuracy: { min: 95, unit: '%' },
      },
      phase3: {
        diagnosticsCollectionTime: { max: 10, unit: 's' },
        progressTrackingAccuracy: { min: 100, unit: '%' },
        logQueryResponseTime: { max: 1, unit: 's' },
        troubleshootingGuideGenerationTime: { max: 5, unit: 's' },
      },
      phase4: {
        flakyTestDetectionAccuracy: { min: 90, unit: '%' },
        memoryUsagePerAgent: { max: 500, unit: 'MB' },
        diskCleanupEffectiveness: { min: 100, unit: '%' },
        performanceImprovement: { min: 20, unit: '%' },
      },
    };

    this.ensureMetricsDir();
  }

  ensureMetricsDir() {
    if (!fs.existsSync(this.config.metricsDir)) {
      fs.mkdirSync(this.config.metricsDir, { recursive: true });
    }
  }

  /**
   * Record a metric value for a specific phase and metric type
   */
  recordMetric(phase, metricType, value, context = {}) {
    if (!this.metrics[phase] || !(metricType in this.metrics[phase])) {
      throw new Error(`Invalid phase or metric type: ${phase}.${metricType}`);
    }

    const entry = {
      value,
      timestamp: new Date().toISOString(),
      context,
    };

    this.metrics[phase][metricType].push(entry);
    return entry;
  }

  /**
   * Record multiple metrics at once
   */
  recordBatch(phase, metricsData) {
    const recorded = [];
    for (const [metricType, value] of Object.entries(metricsData)) {
      recorded.push(this.recordMetric(phase, metricType, value));
    }
    return recorded;
  }

  /**
   * Calculate statistics for a metric
   */
  calculateStats(phase, metricType) {
    const data = this.metrics[phase][metricType];
    if (data.length === 0) return null;

    const values = data.map(d => d.value);
    values.sort((a, b) => a - b);

    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;

    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const percentile = (p) => {
      const index = (p / 100) * (values.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index % 1;

      if (lower === upper) return values[lower];
      return values[lower] * (1 - weight) + values[upper] * weight;
    };

    return {
      count: values.length,
      min: values[0],
      max: values[values.length - 1],
      mean: parseFloat(mean.toFixed(4)),
      median: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
      stdDev: parseFloat(stdDev.toFixed(4)),
    };
  }

  /**
   * Get performance status against targets
   */
  getPerformanceStatus(phase, metricType) {
    const stats = this.calculateStats(phase, metricType);
    if (!stats) return { status: 'UNKNOWN', message: 'No data collected' };

    const target = this.targets[phase][metricType];
    let status = 'PASS';
    let message = '';

    if (target.min !== undefined) {
      if (stats.mean < target.min) {
        status = 'FAIL';
        message = `Mean ${stats.mean} below target ${target.min} ${target.unit}`;
      }
    }

    if (target.max !== undefined) {
      if (stats.mean > target.max) {
        status = 'FAIL';
        message = `Mean ${stats.mean} exceeds target ${target.max} ${target.unit}`;
      }
    }

    return {
      status,
      message,
      stats,
      target,
    };
  }

  /**
   * Generate comprehensive metrics report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {},
      phases: {},
    };

    let totalTests = 0;
    let passCount = 0;

    for (const [phase, metrics] of Object.entries(this.metrics)) {
      report.phases[phase] = {};

      for (const [metricType, data] of Object.entries(metrics)) {
        const status = this.getPerformanceStatus(phase, metricType);
        report.phases[phase][metricType] = status;

        totalTests++;
        if (status.status === 'PASS') passCount++;
      }
    }

    report.summary = {
      totalMetrics: totalTests,
      passingMetrics: passCount,
      failingMetrics: totalTests - passCount,
      successRate: parseFloat(((passCount / totalTests) * 100).toFixed(2)),
      timestamp: new Date().toISOString(),
    };

    return report;
  }

  /**
   * Export metrics to JSON
   */
  exportJSON(filename = 'metrics.json') {
    const filepath = path.join(this.config.metricsDir, filename);
    const report = this.generateReport();

    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    return filepath;
  }

  /**
   * Export metrics to CSV
   */
  exportCSV(filename = 'metrics.csv') {
    const filepath = path.join(this.config.metricsDir, filename);
    let csv = 'Phase,MetricType,Count,Min,Max,Mean,Median,P95,P99,StdDev,Target,Status\n';

    for (const [phase, metrics] of Object.entries(this.metrics)) {
      for (const [metricType, data] of Object.entries(metrics)) {
        const status = this.getPerformanceStatus(phase, metricType);

        if (status.stats) {
          const stats = status.stats;
          const target = status.target;
          const targetValue = target.min || target.max || 'N/A';

          csv += `${phase},${metricType},${stats.count},${stats.min},${stats.max},${stats.mean},${stats.median},${stats.p95},${stats.p99},${stats.stdDev},${targetValue},${status.status}\n`;
        }
      }
    }

    fs.writeFileSync(filepath, csv);
    return filepath;
  }

  /**
   * Export metrics to Prometheus format
   */
  exportPrometheus(filename = 'metrics.prom') {
    const filepath = path.join(this.config.metricsDir, filename);
    let prom = '# HELP ai_qc_framework_metrics AI QC Framework Metrics\n';
    prom += '# TYPE ai_qc_framework_metrics gauge\n';

    const timestamp = Date.now();

    for (const [phase, metrics] of Object.entries(this.metrics)) {
      for (const [metricType, data] of Object.entries(metrics)) {
        const status = this.getPerformanceStatus(phase, metricType);

        if (status.stats) {
          const stats = status.stats;
          const labels = `phase="${phase}",metric="${metricType}"`;

          prom += `ai_qc_framework_metric_count{${labels}} ${stats.count} ${timestamp}\n`;
          prom += `ai_qc_framework_metric_mean{${labels}} ${stats.mean} ${timestamp}\n`;
          prom += `ai_qc_framework_metric_p95{${labels}} ${stats.p95} ${timestamp}\n`;
          prom += `ai_qc_framework_metric_p99{${labels}} ${stats.p99} ${timestamp}\n`;

          const statusValue = status.status === 'PASS' ? 1 : 0;
          prom += `ai_qc_framework_metric_status{${labels}} ${statusValue} ${timestamp}\n`;
        }
      }
    }

    fs.writeFileSync(filepath, prom);
    return filepath;
  }

  /**
   * Export all formats
   */
  exportAll(baseName = 'metrics') {
    const results = {
      json: this.exportJSON(`${baseName}.json`),
      csv: this.exportCSV(`${baseName}.csv`),
      prometheus: this.exportPrometheus(`${baseName}.prom`),
    };

    return results;
  }

  /**
   * Load metrics from file
   */
  loadMetrics(filepath) {
    try {
      const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      // Reconstruct metrics from report format
      console.log(`Loaded metrics from ${filepath}`);
      return data;
    } catch (err) {
      console.error(`Failed to load metrics: ${err.message}`);
      return null;
    }
  }

  /**
   * Clear all metrics
   */
  clear() {
    for (const phase in this.metrics) {
      for (const metric in this.metrics[phase]) {
        this.metrics[phase][metric] = [];
      }
    }
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    return this.generateReport().summary;
  }
}

module.exports = MetricsCollector;

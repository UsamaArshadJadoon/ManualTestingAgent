/**
 * Real-Time Metrics Monitoring with Anomaly Detection
 * Monitors metrics in real-time and alerts on deviations from baseline
 */

const fs = require('fs');
const path = require('path');
const MetricsCollector = require('./collector');

class MetricsMonitor {
  constructor(baselineFile, config = {}) {
    this.config = {
      anomalyThreshold: config.anomalyThreshold || 0.1, // 10% deviation
      checkInterval: config.checkInterval || 5000, // 5 seconds
      metricsDir: config.metricsDir || path.join(__dirname, '../metrics-data'),
      alertThresholds: config.alertThresholds || {},
      ...config,
    };

    this.collector = new MetricsCollector(config);
    this.baseline = this.loadBaseline(baselineFile);
    this.alerts = [];
    this.isRunning = false;
  }

  /**
   * Load baseline data
   */
  loadBaseline(baselineFile) {
    try {
      const data = fs.readFileSync(baselineFile, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error(`Failed to load baseline: ${err.message}`);
      return null;
    }
  }

  /**
   * Detect anomalies based on baseline
   */
  detectAnomalies(phase, metricType, newValue) {
    if (!this.baseline || !this.baseline.summary) {
      return { isAnomaly: false, reason: 'No baseline data' };
    }

    const phaseData = this.baseline.summary.phases[phase];
    if (!phaseData || !phaseData[metricType]) {
      return { isAnomaly: false, reason: 'No baseline for metric' };
    }

    const metricData = phaseData[metricType];
    if (!metricData.stats) {
      return { isAnomaly: false, reason: 'No stats available' };
    }

    const stats = metricData.stats;
    const baselineMean = stats.mean;
    const baselineStdDev = stats.stdDev;

    // Calculate deviation
    const deviation = Math.abs(newValue - baselineMean) / baselineMean;
    const isAnomaly = deviation > this.config.anomalyThreshold;

    return {
      isAnomaly,
      deviation: (deviation * 100).toFixed(2),
      baselineMean,
      currentValue: newValue,
      stdDev: baselineStdDev,
      zScore: baselineStdDev > 0 ? (newValue - baselineMean) / baselineStdDev : 0,
    };
  }

  /**
   * Create an alert
   */
  createAlert(severity, phase, metricType, data) {
    const alert = {
      timestamp: new Date().toISOString(),
      severity,
      phase,
      metricType,
      message: this.generateAlertMessage(severity, phase, metricType, data),
      data,
    };

    this.alerts.push(alert);
    return alert;
  }

  /**
   * Generate alert message
   */
  generateAlertMessage(severity, phase, metricType, data) {
    const deviationPercent = parseFloat(data.deviation);

    if (deviationPercent > 50) {
      return `CRITICAL: ${metricType} deviated ${data.deviation}% from baseline (${data.baselineMean} -> ${data.currentValue})`;
    } else if (deviationPercent > 25) {
      return `WARNING: ${metricType} deviated ${data.deviation}% from baseline (${data.baselineMean} -> ${data.currentValue})`;
    } else {
      return `INFO: ${metricType} deviated ${data.deviation}% from baseline (${data.baselineMean} -> ${data.currentValue})`;
    }
  }

  /**
   * Process incoming metric
   */
  processMetric(phase, metricType, value) {
    this.collector.recordMetric(phase, metricType, value);

    const anomaly = this.detectAnomalies(phase, metricType, value);

    if (anomaly.isAnomaly) {
      const severity = parseFloat(anomaly.deviation) > 50 ? 'CRITICAL' : 'WARNING';
      const alert = this.createAlert(severity, phase, metricType, anomaly);
      console.log(`\n[${alert.severity}] ${alert.message}`);
      return alert;
    }

    return null;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(severity = null) {
    if (!severity) {
      return this.alerts;
    }
    return this.alerts.filter(a => a.severity === severity);
  }

  /**
   * Clear old alerts
   */
  clearAlerts(maxAge = 3600000) { // 1 hour default
    const cutoff = Date.now() - maxAge;
    this.alerts = this.alerts.filter(a => new Date(a.timestamp).getTime() > cutoff);
  }

  /**
   * Generate health status
   */
  getHealthStatus() {
    const criticalAlerts = this.alerts.filter(a => a.severity === 'CRITICAL');
    const warningAlerts = this.alerts.filter(a => a.severity === 'WARNING');

    let status = 'HEALTHY';
    if (criticalAlerts.length > 0) {
      status = 'CRITICAL';
    } else if (warningAlerts.length > 0) {
      status = 'DEGRADED';
    }

    return {
      status,
      criticalAlerts: criticalAlerts.length,
      warningAlerts: warningAlerts.length,
      totalAlerts: this.alerts.length,
      lastCheck: new Date().toISOString(),
    };
  }

  /**
   * Export monitoring data
   */
  exportMonitoringData(filename = 'monitoring-report.json') {
    const filepath = path.join(this.config.metricsDir, filename);

    const data = {
      timestamp: new Date().toISOString(),
      health: this.getHealthStatus(),
      recentAlerts: this.alerts.slice(-50), // Last 50 alerts
      metricsSnapshot: this.collector.generateReport(),
    };

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    return filepath;
  }

  /**
   * Export alerts as CSV
   */
  exportAlertsCSV(filename = 'alerts.csv') {
    const filepath = path.join(this.config.metricsDir, filename);
    let csv = 'Timestamp,Severity,Phase,MetricType,Deviation(%),BaselineMean,CurrentValue,Message\n';

    for (const alert of this.alerts) {
      const deviation = alert.data.deviation;
      const baselineMean = alert.data.baselineMean;
      const currentValue = alert.data.currentValue;
      const message = alert.message.replace(/"/g, '""'); // Escape quotes

      csv += `"${alert.timestamp}","${alert.severity}","${alert.phase}","${alert.metricType}",${deviation},${baselineMean},${currentValue},"${message}"\n`;
    }

    fs.writeFileSync(filepath, csv);
    return filepath;
  }

  /**
   * Export alerts as Prometheus alerts
   */
  exportPrometheusAlerts(filename = 'alerts.prom') {
    const filepath = path.join(this.config.metricsDir, filename);
    let prom = '# HELP ai_qc_framework_alerts AI QC Framework Alerts\n';
    prom += '# TYPE ai_qc_framework_alerts gauge\n';

    const alertCounts = {
      CRITICAL: 0,
      WARNING: 0,
      INFO: 0,
    };

    for (const alert of this.alerts) {
      alertCounts[alert.severity]++;
    }

    const timestamp = Date.now();
    for (const [severity, count] of Object.entries(alertCounts)) {
      prom += `ai_qc_framework_alerts{severity="${severity}"} ${count} ${timestamp}\n`;
    }

    prom += `ai_qc_framework_health_status{status="${this.getHealthStatus().status}"} 1 ${timestamp}\n`;

    fs.writeFileSync(filepath, prom);
    return filepath;
  }

  /**
   * Generate monitoring summary
   */
  generateSummary() {
    const health = this.getHealthStatus();
    const report = this.collector.generateReport();

    return {
      timestamp: new Date().toISOString(),
      health,
      metricsReport: report.summary,
      alertsSummary: {
        total: this.alerts.length,
        bySeverity: {
          CRITICAL: this.getActiveAlerts('CRITICAL').length,
          WARNING: this.getActiveAlerts('WARNING').length,
          INFO: this.getActiveAlerts('INFO').length,
        },
      },
    };
  }

  /**
   * Start continuous monitoring (simulation)
   */
  startMonitoring(duration = 60000) { // 1 minute default
    this.isRunning = true;
    console.log('\nStarting metrics monitoring...');

    const startTime = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - startTime > duration || !this.isRunning) {
        clearInterval(interval);
        this.isRunning = false;
        console.log('\nMonitoring stopped.');
        return;
      }

      // Simulate metric collection
      const phases = Object.keys(this.collector.metrics);
      const randomPhase = phases[Math.floor(Math.random() * phases.length)];
      const metrics = Object.keys(this.collector.metrics[randomPhase]);
      const randomMetric = metrics[Math.floor(Math.random() * metrics.length)];

      // Generate a random value close to baseline
      let value;
      if (randomMetric.includes('Time')) {
        value = Math.random() * 8 + 1;
      } else if (randomMetric.includes('Memory')) {
        value = Math.random() * 200 + 150;
      } else {
        value = Math.random() * 10 + 85;
      }

      this.processMetric(randomPhase, randomMetric, value);
    }, this.config.checkInterval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.isRunning = false;
  }
}

module.exports = MetricsMonitor;

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const baselineFile = args[0] || path.join(__dirname, '../metrics-data/baseline.json');
  const durationMs = parseInt(args[1]) || 60000;
  const metricsDir = args[2] || path.join(__dirname, '../metrics-data');

  const monitor = new MetricsMonitor(baselineFile, { metricsDir });

  monitor.startMonitoring(durationMs);

  // Export reports after monitoring
  setTimeout(() => {
    console.log('\nGenerating reports...');
    monitor.exportMonitoringData();
    monitor.exportAlertsCSV();
    monitor.exportPrometheusAlerts();

    const summary = monitor.generateSummary();
    console.log('\nMonitoring Summary:');
    console.log(JSON.stringify(summary, null, 2));

    process.exit(0);
  }, durationMs + 1000);
}

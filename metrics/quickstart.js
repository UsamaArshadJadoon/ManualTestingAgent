#!/usr/bin/env node

/**
 * Metrics Collection Quick Start Script
 * Guides users through baseline collection and monitoring setup
 */

const fs = require('fs');
const path = require('path');
const BaselineCollector = require('./baseline-collector');
const MetricsMonitor = require('./monitor');

class MetricsQuickStart {
  constructor() {
    this.metricsDir = path.join(__dirname, '../metrics-data');
    this.baselineFile = path.join(this.metricsDir, 'baseline.json');
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      warning: '\x1b[33m', // Yellow
      error: '\x1b[31m',   // Red
      reset: '\x1b[0m'
    };

    const color = colors[type] || colors.info;
    console.log(`${color}[${type.toUpperCase()}]${colors.reset} ${message}`);
  }

  async runQuickStart() {
    console.log('\n');
    console.log('=====================================');
    console.log('  AI QC Framework - Metrics Setup');
    console.log('=====================================\n');

    this.log('Welcome to the metrics collection quick start!', 'info');
    this.log('This will help you collect baseline metrics and set up monitoring.', 'info');

    // Step 1: Check directories
    this.log('Step 1: Checking directories...', 'info');
    this.ensureMetricsDir();
    this.log('Metrics directory ready at: ' + this.metricsDir, 'success');

    // Step 2: Collect baseline
    this.log('\nStep 2: Collecting baseline metrics from 10 test runs...', 'info');
    this.log('This will take approximately 10-15 seconds.', 'info');

    try {
      await this.collectBaseline();
      this.log('Baseline collection completed!', 'success');
    } catch (err) {
      this.log('Baseline collection failed: ' + err.message, 'error');
      return;
    }

    // Step 3: Verify baseline
    this.log('\nStep 3: Verifying baseline data...', 'info');
    if (!this.verifyBaseline()) {
      this.log('Baseline verification failed', 'error');
      return;
    }
    this.log('Baseline data verified successfully!', 'success');

    // Step 4: Display baseline summary
    this.log('\nStep 4: Baseline Summary', 'info');
    this.displayBaselineSummary();

    // Step 5: Setup instructions
    this.log('\nStep 5: Next Steps', 'info');
    this.displayNextSteps();

    this.log('\nMetrics setup completed successfully!', 'success');
  }

  ensureMetricsDir() {
    if (!fs.existsSync(this.metricsDir)) {
      fs.mkdirSync(this.metricsDir, { recursive: true });
    }
  }

  async collectBaseline() {
    const collector = new BaselineCollector(10, { metricsDir: this.metricsDir });

    try {
      await collector.collectBaseline();
      const exports = collector.exportAll('baseline');

      this.log('Exported JSON: ' + exports.json, 'success');
      this.log('Exported CSV: ' + exports.csv, 'success');
      this.log('Exported Prometheus: ' + exports.prometheus, 'success');
      this.log('Generated Report: ' + exports.report, 'success');

      return true;
    } catch (err) {
      throw err;
    }
  }

  verifyBaseline() {
    try {
      const jsonFile = path.join(this.metricsDir, 'baseline.json');
      const csvFile = path.join(this.metricsDir, 'baseline.csv');
      const reportFile = path.join(this.metricsDir, 'baseline-REPORT.md');

      const hasJson = fs.existsSync(jsonFile);
      const hasCsv = fs.existsSync(csvFile);
      const hasReport = fs.existsSync(reportFile);

      if (!hasJson || !hasCsv || !hasReport) {
        this.log('Missing required files', 'warning');
        return false;
      }

      const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      if (!data.summary) {
        this.log('Invalid baseline data structure', 'warning');
        return false;
      }

      return true;
    } catch (err) {
      this.log('Verification error: ' + err.message, 'error');
      return false;
    }
  }

  displayBaselineSummary() {
    try {
      const jsonFile = path.join(this.metricsDir, 'baseline.json');
      const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      const summary = data.summary.summary;

      console.log('');
      console.log('  Metrics Summary:');
      console.log('  ├─ Total Metrics: ' + summary.totalMetrics);
      console.log('  ├─ Passing Metrics: ' + summary.passingMetrics);
      console.log('  ├─ Failing Metrics: ' + summary.failingMetrics);
      console.log('  └─ Success Rate: ' + summary.successRate + '%');
      console.log('');
    } catch (err) {
      this.log('Could not display summary: ' + err.message, 'warning');
    }
  }

  displayNextSteps() {
    console.log('');
    console.log('  1. View Baseline Report:');
    console.log('     npm run metrics:view-report');
    console.log('');
    console.log('  2. Start Real-Time Monitoring (60 seconds):');
    console.log('     npm run metrics:monitor');
    console.log('');
    console.log('  3. Import Dashboard into Grafana:');
    console.log('     - Open Grafana (http://localhost:3000)');
    console.log('     - Click "+" → "Import Dashboard"');
    console.log('     - Paste contents of metrics/dashboard-config.json');
    console.log('');
    console.log('  4. Configure Prometheus (http://localhost:9090):');
    console.log('     Add scrape config to prometheus.yml:');
    console.log('     scrape_configs:');
    console.log('       - job_name: "ai-qc-framework"');
    console.log('         static_configs:');
    console.log('           - targets: ["localhost:9091"]');
    console.log('');
    console.log('  5. Documentation:');
    console.log('     - metrics/README.md - Full documentation');
    console.log('     - metrics/ALERT_THRESHOLDS.md - Alert configuration');
    console.log('     - metrics/BASELINE_REPORT.md - Baseline analysis');
    console.log('');
    console.log('  6. Useful Commands:');
    console.log('     npm run metrics:baseline    - Collect new baseline (10 runs)');
    console.log('     npm run metrics:monitor     - Monitor for 60 seconds');
    console.log('     npm run metrics:export      - Export current metrics');
    console.log('');
  }
}

// Run quick start
if (require.main === module) {
  const quickStart = new MetricsQuickStart();

  quickStart.runQuickStart()
    .then(() => {
      console.log('\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\nFatal error:', err);
      process.exit(1);
    });
}

module.exports = MetricsQuickStart;

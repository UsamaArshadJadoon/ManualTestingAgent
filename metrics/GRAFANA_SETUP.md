# Grafana Setup Guide for AI QC Framework

## Prerequisites

Before deploying the Grafana dashboard, ensure the following requirements are met:

### Grafana
- **Version:** Grafana 8.0 or higher
- **Access:** Admin permissions or API key with dashboard import rights
- **Port:** 3000 (default) or custom configured port
- **Memory:** Minimum 512MB RAM, 2GB recommended
- **Disk:** 1GB available storage for dashboards and data

### Prometheus
- **Version:** Prometheus 2.20 or higher
- **Data:** Already configured and collecting metrics
- **Retention:** Minimum 7 days (15+ days recommended)
- **Scrape Interval:** 30s or lower
- **Connectivity:** Accessible from Grafana (direct connection required)

### Network
- Firewall rules allowing Grafana ↔ Prometheus communication
- SSL/TLS optional but recommended for production
- No authentication required between Grafana and Prometheus (or credentials configured)

### System Resources
- **CPU:** 1 core minimum (2+ cores recommended)
- **Memory:** 1GB minimum (2GB+ recommended)
- **Disk I/O:** SSD preferred for performance

---

## Installation Steps

### Step 1: Install Grafana

#### Option A: Docker (Recommended for Testing)

```bash
docker run -d \
  -p 3000:3000 \
  -e GF_SECURITY_ADMIN_PASSWORD=admin \
  --name grafana \
  grafana/grafana:latest
```

#### Option B: Local Installation (Windows)

Download from [grafana.com/grafana/download](https://grafana.com/grafana/download) and run installer:

```powershell
# After installation, start the service
Start-Service Grafana
```

#### Option C: Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
      - name: grafana
        image: grafana/grafana:latest
        ports:
        - containerPort: 3000
        env:
        - name: GF_SECURITY_ADMIN_PASSWORD
          value: "admin"
        resources:
          requests:
            cpu: 250m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 2Gi
```

### Step 2: Access Grafana

1. Open browser and navigate to `http://localhost:3000`
2. Login with default credentials:
   - **Username:** admin
   - **Password:** admin (or your configured password)
3. Change password on first login (recommended)

### Step 3: Create API Key for Automation

1. Navigate to **Configuration** → **API Keys**
2. Click **New API Key**
3. Set permissions: `Admin` (for dashboard management)
4. Set expiration: 90 days (or as per security policy)
5. Click **Add API Key**
6. **Save the key** - it won't be displayed again
7. Use this key with the deployment script: `$env:GRAFANA_API_KEY = "your-key"`

### Step 4: Configure Prometheus Data Source

#### Manual Configuration:

1. Navigate to **Configuration** → **Data Sources**
2. Click **Add data source**
3. Select **Prometheus**
4. Configure:
   - **Name:** Prometheus
   - **URL:** `http://prometheus:9090` or your Prometheus server URL
   - **Access:** Proxy (recommended) or Direct
   - **Scrape interval:** 30s (should match Prometheus config)
   - **Query timeout:** 30s
5. Click **Save & Test**
6. You should see: "Data source is working"

#### Automated Configuration:

Use the deployment script to automatically configure the data source:

```powershell
.\scripts\deploy\deploy-grafana.ps1 `
  -GrafanaApiKey "your-api-key" `
  -PrometheusUrl "http://prometheus:9090"
```

### Step 5: Verify Prometheus Connectivity

Test that Grafana can reach Prometheus:

1. In Grafana, open **Configuration** → **Data Sources**
2. Click on **Prometheus** data source
3. Scroll to bottom, click **Save & Test**
4. Expected response: "Data source is working"

If connection fails:
- Check Prometheus URL is correct and accessible
- Verify firewall rules allow Grafana → Prometheus traffic
- Check Prometheus is running: `curl http://prometheus:9090/api/v1/query?query=up`

### Step 6: Import Dashboard

#### Option A: Automated Import

```powershell
.\scripts\deploy\deploy-grafana.ps1 `
  -GrafanaApiKey "your-api-key" `
  -DashboardConfigPath ".\dashboard-config.json" `
  -AlertEmail "alerts@example.com"
```

#### Option B: Manual Import

1. In Grafana, navigate to **Dashboards** → **Import**
2. Upload `dashboard-config.json` or paste JSON content
3. Select **Prometheus** as data source
4. Click **Import**
5. Dashboard will be created with UID: `qc-framework-dashboard`

#### Option C: Create from Template

1. Navigate to **Dashboards** → **New** → **New Dashboard**
2. Click **Add panel**
3. Create panels matching the dashboard structure (see section below)

### Step 7: Configure Alert Notification Channels

#### Email Notifications:

1. Navigate to **Configuration** → **Notification channels**
2. Click **New channel**
3. Configure:
   - **Name:** Email Alerts
   - **Type:** Email
   - **Email address:** Your email (or distribution list)
   - **Send to:** Check "All Alerts"
4. Click **Save**

#### Webhook Notifications (for external systems):

1. Click **New channel**
2. Configure:
   - **Name:** Webhook Alerts
   - **Type:** Webhook
   - **URL:** `https://your-webhook-url`
   - **HTTP Method:** POST
3. Click **Save**

#### Testing Alerts:

1. Click the "Send Test" button
2. Check your email or webhook endpoint
3. Verify notification was received

### Step 8: Test Alerts

Create a test alert:

1. Open any panel on the dashboard
2. Click **Edit** → **Alert** tab
3. Set condition: `up{job="prometheus"} == 0`
4. Set notification channel: Email Alerts
5. Set evaluation interval: 1 minute
6. Click **Save**

To verify:
1. Stop Prometheus temporarily
2. Wait for evaluation interval (1 minute)
3. Check your email for alert notification
4. Restart Prometheus

---

## Dashboard Overview

### Dashboard Structure

The AI QC Framework monitoring dashboard consists of **5 rows** with **18 panels** total:

#### Row 1: Framework Execution Performance (4 panels)

| Panel | Metric | Description | Query |
|-------|--------|-------------|-------|
| Framework Execution Time | avg(qc_framework_execution_seconds) | Average framework execution time | `avg(qc_framework_execution_seconds)` |
| Success Rate | (successes/total)*100 | Percentage of successful test runs | `(sum(qc_tests_success) / sum(qc_tests_total)) * 100` |
| Error Rate | (errors/total)*100 | Percentage of failed test runs | `(sum(qc_tests_error) / sum(qc_tests_total)) * 100` |
| Total Tests Run | sum(qc_tests_total) | Total number of tests executed | `sum(qc_tests_total)` |

#### Row 2: Agent Performance (4 panels)

| Panel | Metric | Description | Query |
|-------|--------|-------------|-------|
| Agents Active | count(qc_agent_up) | Number of active agents | `count(qc_agent_up{state="active"})` |
| Agent CPU Usage | avg(qc_agent_cpu_percent) | Average CPU usage per agent | `avg(qc_agent_cpu_percent)` |
| Agent Memory Usage | avg(qc_agent_memory_mb) | Average memory usage per agent | `avg(qc_agent_memory_mb)` |
| Agent Error Count | sum(qc_agent_errors_total) | Total agent errors | `sum(increase(qc_agent_errors_total[5m]))` |

#### Row 3: Orchestration Metrics (4 panels)

| Panel | Metric | Description | Query |
|-------|--------|-------------|-------|
| Task Queue Depth | max(qc_task_queue_length) | Maximum queue depth | `max(qc_task_queue_length)` |
| Task Processing Time | avg(qc_task_processing_seconds) | Average task duration | `avg(qc_task_processing_seconds)` |
| Orchestrator CPU Usage | avg(qc_orchestrator_cpu_percent) | Orchestrator CPU usage | `avg(qc_orchestrator_cpu_percent)` |
| Orchestrator Memory Usage | avg(qc_orchestrator_memory_mb) | Orchestrator memory usage | `avg(qc_orchestrator_memory_mb)` |

#### Row 4: System Health (4 panels)

| Panel | Metric | Description | Query |
|-------|--------|-------------|-------|
| Disk Space Usage | (used/total)*100 | Disk utilization percentage | `(node_filesystem_avail_bytes{fstype!~"tmpfs\|fuse.lxcfs\|squashfs\|vfat"} / node_filesystem_size_bytes{fstype!~"tmpfs\|fuse.lxcfs\|squashfs\|vfat"}) * 100` |
| Network I/O | rate(node_network_transmit_bytes_total[5m]) | Network transmission rate | `rate(node_network_transmit_bytes_total[5m])` |
| Request Latency | histogram_quantile(0.95, rate(qc_request_duration_seconds_bucket[5m])) | 95th percentile latency | `histogram_quantile(0.95, rate(qc_request_duration_seconds_bucket[5m]))` |
| Cache Hit Rate | (hits/total)*100 | Cache hit percentage | `(sum(increase(qc_cache_hits_total[5m])) / sum(increase(qc_cache_total[5m]))) * 100` |

#### Row 5: Alerts & SLA (2 panels)

| Panel | Metric | Description | Query |
|-------|--------|-------------|-------|
| Active Alerts | count(ALERTS{severity!="none"}) | Currently firing alerts | `count(ALERTS{severity!="none"})` |
| SLA Compliance | avg(qc_sla_compliance_percent) | Percentage meeting SLA targets | `avg(qc_sla_compliance_percent)` |

---

## Customization Guide

### Adding Custom Panels

1. Navigate to dashboard
2. Click **Edit** (pencil icon)
3. Click **Add panel** → **Add an empty panel**
4. Configure panel:
   - **Title:** Panel name
   - **Data source:** Prometheus
   - **Metrics:** Enter PromQL query
   - **Visualization:** Choose type (Graph, Gauge, Stat, Table, etc.)
5. Click **Save**

### Modifying Panel Queries

1. Click on panel title → **Edit**
2. In query editor (marked "A", "B", etc.):
   - Modify PromQL query
   - Click **Run** to test
3. Adjust visualization settings
4. Click **Save dashboard**

### Creating Alert Rules

1. Edit any panel
2. Click **Alert** tab
3. Click **Create Alert**
4. Configure:
   - **Condition:** PromQL expression
   - **Evaluate every:** Frequency (e.g., 1m)
   - **For:** Duration before alerting (e.g., 5m)
   - **Send to:** Select notification channel
5. Click **Save dashboard**

### Dashboard Folders

Organize dashboards by creating folders:

1. Navigate to **Dashboards** → **Manage**
2. Click **New Folder**
3. Name folder (e.g., "AI QC Framework")
4. Move dashboards into folder by editing dashboard

### Dashboard Templating

Create dynamic dashboards with variables:

1. Edit dashboard (pencil icon)
2. Click **Dashboard Settings** (gear icon)
3. Select **Variables**
4. Click **New variable**
5. Configure:
   - **Name:** Variable name
   - **Type:** Query, Custom, etc.
   - **Query:** Data source query
6. Click **Add**
7. Use in panels: `$variable_name`

---

## Troubleshooting

### Dashboard Shows No Data

**Symptoms:** All panels show "No data" or empty graphs

**Cause:** Metrics not being collected or data source misconfigured

**Solutions:**
1. Verify Prometheus is collecting metrics: `http://prometheus:9090/api/v1/query?query=up`
2. Check data source configuration: **Configuration** → **Data Sources** → **Prometheus**
3. Verify metric names in queries match Prometheus exports
4. Check Prometheus scrape targets: **Status** → **Targets** on Prometheus UI

### Can't Connect to Prometheus

**Symptoms:** Red error message "Data source is down" or connection timeout

**Cause:** Network connectivity issue or Prometheus not running

**Solutions:**
1. Verify Prometheus URL: Check in Grafana data source config
2. Test connectivity: `curl http://prometheus:9090/api/v1/query?query=up`
3. Check firewall: Ensure ports 3000 (Grafana) and 9090 (Prometheus) are accessible
4. Verify services running:
   - Grafana: `Get-Service Grafana` or `docker ps | grep grafana`
   - Prometheus: `docker ps | grep prometheus` or `Get-Process prometheus`

### Panels Showing Errors

**Symptoms:** Panel shows "Error executing query" or "Invalid query"

**Cause:** Incorrect PromQL syntax or missing metrics

**Solutions:**
1. Edit panel and check query syntax
2. Test query in Prometheus: `http://prometheus:9090/graph`
3. Verify metric exists: `curl http://prometheus:9090/api/v1/label/__name__/values`
4. Review metrics documentation: See [docs/METRICS.md](../docs/METRICS.md)

### Alerts Not Sending

**Symptoms:** Alerts fire but no notifications received

**Cause:** Notification channel misconfigured or SMTP settings incorrect

**Solutions:**
1. Check notification channel: **Configuration** → **Notification channels**
2. Click "Send Test" to verify channel
3. For email: Verify SMTP settings in **Configuration** → **Settings**
4. Check Grafana logs: `docker logs grafana` or `Get-EventLog -LogName Application`
5. Verify firewall allows SMTP (port 25, 465, or 587)

### Dashboard Slow to Load

**Symptoms:** Dashboard takes 10+ seconds to load

**Cause:** Complex queries or too many panels

**Solutions:**
1. Reduce time range in top-right selector
2. Increase Prometheus query timeout: **Configuration** → **Data Sources** → **Prometheus** → Query timeout (try 60s)
3. Optimize PromQL queries: Use rate limits, aggregation
4. Split dashboard into multiple dashboards by function
5. Increase Grafana resources: Memory, CPU

### Panels Show Gaps in Data

**Symptoms:** Graph shows missing data or flat lines

**Cause:** Incomplete data collection or exporter downtime

**Solutions:**
1. Check Prometheus retention: Set to at least 7 days
2. Verify scrape targets are running: Prometheus UI → **Status** → **Targets**
3. Check scrape interval: Should be 30s or less
4. Review exporter logs for errors

---

## Performance Optimization

### Query Performance

1. **Use aggregation:** `sum()`, `avg()` reduce cardinality
2. **Set time ranges:** Always specify `[5m]`, `[1h]`, etc.
3. **Avoid regex:** Use label matching: `{job="prometheus"}` not `{job=~".*prometheus.*"}`
4. **Use recording rules:** Pre-aggregate common queries in Prometheus

### Dashboard Performance

1. **Reduce panel count:** Aim for 12-18 panels max
2. **Set refresh interval:** 30s minimum (not 5s)
3. **Use single-stat panels:** Faster than graphs for summary data
4. **Cache results:** Use Grafana cache for static queries
5. **Limit time range:** Default to 6-12 hours, not 30 days

### Storage

1. **Set retention:** 15+ days in Prometheus (default 15d)
2. **Use compression:** Prometheus compacts blocks automatically
3. **Monitor disk space:** Alert if usage > 80%
4. **Archive old data:** Export and compress monthly

---

## Monitoring the Dashboard

### Key Metrics to Watch

1. **Framework Success Rate:** Target >95%
2. **Agent CPU Usage:** Should stay <80% average
3. **Task Queue Depth:** Should not exceed 100 items
4. **Error Rate:** Should be <1% for most operations
5. **Disk Usage:** Should remain <80% of total

### Health Checks

Daily:
- [ ] All panels showing data
- [ ] No gaps in graphs (last 24 hours)
- [ ] Error rate below 1%
- [ ] All agents active and healthy

Weekly:
- [ ] Review alert triggers and false positives
- [ ] Check disk space utilization
- [ ] Verify backup completion
- [ ] Analyze performance trends

Monthly:
- [ ] Archive dashboard data
- [ ] Review retention settings
- [ ] Update dashboard if needed
- [ ] Review cost metrics (see COST_ANALYSIS.md)

---

## Security Considerations

### Access Control

1. **Limit API key permissions:** Use "Admin" only if necessary
2. **Rotate keys:** Every 90 days or per security policy
3. **Disable anonymous access:** **Settings** → **Security** → Anonymous auth
4. **Enable HTTPS:** Use proxy with SSL termination

### Data Protection

1. **Encrypt connections:** Enable TLS for Grafana ↔ Prometheus
2. **Secure Prometheus:** Use reverse proxy with authentication
3. **Audit logs:** Enable and monitor access logs
4. **Backup dashboards:** Export JSON regularly

### Compliance

1. **Data retention:** Set per retention policy (7-30 days typical)
2. **Access logging:** Maintain audit trail of configuration changes
3. **Encryption at rest:** Use encrypted storage for Prometheus data
4. **GDPR/HIPAA:** Ensure metrics don't contain PII

---

## Related Documentation

- [COST_ANALYSIS.md](../docs/COST_ANALYSIS.md) - Infrastructure costs and ROI
- [PERFORMANCE_BENEFITS.md](../docs/PERFORMANCE_BENEFITS.md) - Speed and reliability improvements
- [INFRASTRUCTURE_SIZING.md](../docs/INFRASTRUCTURE_SIZING.md) - Resource requirements
- [Grafana Docs](https://grafana.com/docs/) - Official documentation
- [Prometheus Docs](https://prometheus.io/docs/) - Official documentation

---

## Support

For issues or questions:

1. Check troubleshooting section above
2. Review logs: Grafana and Prometheus
3. Consult official documentation
4. Contact framework team: `ai-qc-framework@example.com`

**Last Updated:** 2026-10-30  
**Version:** 1.0  
**Status:** Production Ready

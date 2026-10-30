# Infrastructure Sizing Guide

**QA AZM Digital Agent — Resource Requirements & Scaling**

---

## Minimum Requirements

### Server (CPU & Memory)

| Component | Min CPU | Min RAM | Recommended |
|-----------|---------|---------|-------------|
| Orchestrator | 2 cores | 2 GB | 4 cores / 8 GB |
| Browser (Playwright) | 1 core | 1 GB | 2 cores / 4 GB |
| Node.js | 1 core | 512 MB | 2 cores / 2 GB |
| Total | 4 cores | 3.5 GB | 8 cores / 14 GB |

### Storage

| Purpose | Size | Notes |
|---------|------|-------|
| Application | 500 MB | Source code + node_modules |
| Test runs (per run) | 50-200 MB | Includes screenshots |
| Logs (per month) | 500 MB - 1 GB | Depends on run frequency |
| Backups (3 months) | 5-10 GB | Weekly backups |
| Total | 15-20 GB | Minimum recommendation |

### Network

- **Upload/Download:** 5 Mbps stable
- **Latency:** <100ms to Jira
- **Latency:** <50ms to app server

---

## Scaling Calculations

### Single-User Setup

Resources: 4 CPU, 4 GB RAM, 20 GB storage  
Test runs per day: 5-10  
Sequential execution only

### Team Setup (5-10 engineers)

Resources: 8 CPU, 16 GB RAM, 50 GB storage  
Parallel execution: 2-3 concurrent runs  
Test runs per day: 50-100

### Enterprise Setup (20+ engineers)

Resources: 16 CPU, 32 GB RAM, 200 GB storage  
Parallel execution: 5-10 concurrent runs  
Test runs per day: 200+  
Load balancing across instances

---

## Cloud Provider Recommendations

### AWS

Recommended Instance:
- Development: t3.medium (2 CPU, 4 GB RAM)
- Production: m5.xlarge (4 CPU, 16 GB RAM)
- Enterprise: m5.2xlarge (8 CPU, 32 GB RAM)

Storage:
- EBS: gp3 (100+ GB recommended)
- S3: Archive old runs (lifecycle policy)

Networking:
- Security Groups: Allow 443 (HTTPS)
- NAT Gateway: For external API calls

### Azure

Recommended VM:
- Development: B2s (2 CPU, 4 GB RAM)
- Production: D4s_v3 (4 CPU, 16 GB RAM)
- Enterprise: D8s_v3 (8 CPU, 32 GB RAM)

Storage:
- Managed Disks: Premium for better performance
- Blob Storage: Archive old runs

### Google Cloud

Recommended Machine:
- Development: e2-medium (2 CPU, 4 GB RAM)
- Production: n2-standard-4 (4 CPU, 16 GB RAM)
- Enterprise: n2-standard-8 (8 CPU, 32 GB RAM)

---

## Cost Analysis

### Hourly Costs (Approximate)

| Component | AWS | Azure | GCP |
|-----------|-----|-------|-----|
| t3.medium / B2s / e2-medium | 0.04 | 0.06 | 0.05 |
| m5.xlarge / D4s_v3 / n2-standard-4 | 0.19 | 0.21 | 0.18 |
| m5.2xlarge / D8s_v3 / n2-standard-8 | 0.38 | 0.42 | 0.36 |

### Monthly Estimate (Development)

Instance: 29 USD (t3.medium 730 hours)  
Storage: 10 USD (100 GB)  
Data transfer: 5 USD  
Total: 44 USD/month

### Monthly Estimate (Production)

Instance: 139 USD (m5.xlarge)  
Storage: 30 USD (200 GB)  
Data transfer: 20 USD  
Load balancing: 30 USD  
Total: 219 USD/month

---

## Performance Optimization

### Reduce Resource Usage

1. **Enable headless mode:** -30% CPU usage
2. **Compress screenshots:** -50% storage
3. **Archive old logs:** -80% storage over time
4. **Use SSD storage:** +2x performance
5. **Enable disk caching:** -40% I/O

### Increase Throughput

1. **Parallel execution:** Run 4+ tests simultaneously
2. **Load balancing:** Distribute across instances
3. **Caching:** Store compiled test cases
4. **CDN:** Cache static assets

---

## Monitoring

### Key Metrics

- CPU usage: Keep below 80%
- Memory usage: Keep below 85%
- Disk usage: Keep below 85%
- Test duration: Aim for less than 15 min
- Error rate: Keep below 5%

### Alerts

Set up alerts when:
- CPU greater than 85% for 5 minutes
- Memory greater than 90%
- Disk greater than 90%
- Test fails 3 times consecutively
- Response time greater than 30 seconds

---

**Last Updated:** 2026-10-30
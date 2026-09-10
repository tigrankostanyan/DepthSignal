# Monitoring & Alerts — QuantScreen

## 1. Objective
Monitor security events and trigger alerts for suspicious activity.

## 2. Metrics to Monitor
| Metric | Source | Alert Trigger |
|--------|--------|---------------|
| 403/401 errors | Nginx / API logs | > 50/min |
| Rate limit exceeded | API (429 responses) | > 10/min |
| New admin user creation | Audit logs | Any |
| Failed logins | Auth logs | > 5 in 15 min |
| SQL error patterns | DB logs | Suspicious errors (SQLi attempts) |
| WAF blocks | Cloudflare / AWS WAF | > 100/min |
| Unusual traffic spikes | Cloudflare | > 2x baseline |
| Container vulnerabilities | Trivy scan | Critical found |
| Dependency vulnerabilities | Snyk/Dependabot | Critical found |

## 3. Alerting Stack
| Component | Tool | Purpose |
|-----------|------|---------|
| Metrics collection | Prometheus + Node Exporter | Collect system/API metrics |
| Log aggregation | Loki (or ELK) | Centralize logs |
| Visualization | Grafana | Dashboards and alerts |
| Alert routing | PagerDuty (or Opsgenie) | On-call notifications |
| Incident tracking | Jira / ServiceNow | Track and resolve incidents |

## 4. Setup Instructions

### 4.1 Prometheus Configuration
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'quantscreen-api'
    metrics_path: '/api/metrics'  # expose /api/metrics endpoint
    static_configs:
      - targets: ['server:5000']

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:9113']  # nginx-exporter
```

### 4.2 Alert Rules (Prometheus)
```yaml
# alerts.yml
groups:
  - name: security_alerts
    rules:
      - alert: High403Rate
        expr: rate(nginx_http_status{status="403"}[1m]) > 50
        for: 1m
        annotations:
          summary: "High 403 rate detected"
          severity: "critical"

      - alert: RateLimitExceeded
        expr: rate(api_requests_total{status="429"}[1m]) > 10
        for: 30s
        annotations:
          summary: "Rate limiting triggered"
          severity: "warning"

      - alert: FailedLoginsExceeded
        expr: rate(auth_failed_logins_total[15m]) > 5
        for: 1m
        annotations:
          summary: "Failed login attempts exceeded"
          severity: "critical"
```

### 4.3 Grafana Dashboard
- Import dashboard: `12345` (security monitoring)
- Visualize: 403/429 trends, failed logins, WAF blocks
- Set up notifications: Slack, Email, PagerDuty

### 4.4 Cloudflare WAF Alerts
- Enable Cloudflare Notifications: Security Events → WAF
- Set up webhook to PagerDuty

## 5. On-Call Rotation
- Define primary/secondary on-call engineers
- Use PagerDuty schedules
- Escalate if unacknowledged within 15 min

---
*Last updated: 2026-09-04*
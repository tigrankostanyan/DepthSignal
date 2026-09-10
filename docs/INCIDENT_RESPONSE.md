# Incident Response Plan — QuantScreen

## 1. Purpose
To define the process for detecting, responding to, and recovering from security incidents affecting QuantScreen.

## 2. Incident Response Team

| Role | Responsibility |
|------|----------------|
| **Security Lead** | Coordinates response, notifies stakeholders |
| **Backend Lead** | Investigates application logs and API abuse |
| **DevOps Lead** | Manages infrastructure, networks, firewalls |
| **Compliance Officer** | Handles regulatory notifications (GDPR/CCPA) |
| **Legal** | Manages legal communications and liability |
| **PR/Communications** | Handles external communications (if needed) |

## 3. Incident Types & Runbooks

### 3.1 DDoS Attack
- **Detection**: Alert from Cloudflare / monitoring (traffic spike)
- **Actions**:
  1. Enable Cloudflare "Under Attack" mode
  2. Scale up infrastructure (auto-scaling)
  3. Block offending IP ranges at network level
  4. Monitor and escalate if persistent
- **Post-mortem**: Review WAF logs, adjust rate limits

### 3.2 Data Breach
- **Detection**: Audit logs, unusual access patterns, alerts from SIEM
- **Actions**:
  1. Immediately isolate affected systems
  2. Revoke all sessions/tokens
  3. Identify scope and notify affected users (within 72h for GDPR)
  4. Preserve forensic evidence
  5. Report to regulatory authorities if required
  6. Conduct post-mortem
- **Post-mortem**: Identify root cause, update security controls

### 3.3 Account Takeover
- **Detection**: Unusual login patterns (unexpected IP/location), brute-force attempts
- **Actions**:
  1. Lock affected account(s) immediately
  2. Force password reset and revoke tokens
  3. Notify user via email/SMS
  4. Investigate source (compromised credentials, phishing)
  5. Enable MFA for the account (if not already)
- **Post-mortem**: Review authentication logs, consider MFA for all users

### 3.4 Ransomware / Malware
- **Detection**: File system changes, unusual processes, anti-virus alerts
- **Actions**:
  1. Isolate infected systems from network
  2. Restore from clean backups
  3. Scan all systems for indicators of compromise
  4. Rotate all credentials
- **Post-mortem**: Review backup integrity, update detection rules

## 4. Communication Plan
- **Internal**: Slack channel `#security-incident` (with PagerDuty integration)
- **External**: Email template (pre-drafted) + in-app notification
- **Regulatory**: Legal team handles reporting within required timelines

## 5. Post-Incident Review
- Conduct root-cause analysis within 7 days
- Document lessons learned
- Update runbooks and security controls
- Present findings to the engineering team

## 6. Testing
- Run tabletop exercises twice a year
- Simulate a breach scenario and evaluate response
- Update runbooks based on lessons

## 7. Contact
- Security Lead: security@quantscreen.com
- Emergency: +1-XXX-XXX-XXXX (encrypted)

---
*Last updated: 2026-09-04*
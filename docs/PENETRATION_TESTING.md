# Penetration Testing — QuantScreen

## 1. Schedule

| Type | Frequency | Scope |
|------|-----------|-------|
| External (black-box) | Annually | Public-facing API, web app, infrastructure |
| Internal (gray-box) | Before major releases | Authenticated API, admin panel, billing |
| White-box (source code) | Per major feature | New endpoints, auth flows, payment logic |

## 2. Methodology
- Based on **OWASP ASVS Level 3** standard
- Tests cover:
  - Authentication & session management
  - Authorization (RBAC/object-level)
  - Input validation (SQLi, XSS, SSRF, RCE)
  - Cryptography (weak ciphers, hardcoded keys)
  - Business logic (price manipulation, quota bypass)
  - API security (rate limiting, parameter tampering)
  - Logging & monitoring

## 3. Reporting
- Findings are categorized as Critical, High, Medium, Low
- Each finding includes:
  - Description
  - Affected endpoint/function
  - Proof of concept (if applicable)
  - Recommended fix
- Remediation deadline:
  - Critical/High: 5 business days
  - Medium/Low: next sprint

## 4. Responsible Disclosure
- Security researchers can report issues to security@quantscreen.com
- We commit to:
  - Acknowledging the report within 48 hours
  - Fixing confirmed issues within 30 days
  - Publicly thanking researchers (unless they request anonymity)

---
*Last updated: 2026-09-04*
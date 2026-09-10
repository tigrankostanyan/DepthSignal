# Security Training Program — QuantScreen

## 1. Objective
Ensure all developers understand common security threats and how to write secure code.

## 2. Required Topics

### OWASP Top 10 (2021)
1. Broken Access Control
2. Cryptographic Failures
3. Injection (SQL, NoSQL, OS)
4. Insecure Design
5. Security Misconfiguration
6. Vulnerable and Outdated Components
7. Identification and Authentication Failures
8. Software and Data Integrity Failures
9. Security Logging and Monitoring Failures
10. Server-Side Request Forgery (SSRF)

### Secure Coding Practices
- Input validation (allowlist, not denylist)
- Output encoding (XSS prevention)
- Authentication & session management (JWT, cookies, MFA)
- Secure file handling
- Error handling and logging
- Encryption at rest and in transit

### Cloud Security
- IAM best practices (least privilege)
- Network security (VPC, security groups)
- Secrets management (no hardcoded keys)
- Container security (Docker, Kubernetes)

## 3. Training Schedule

| Audience | Frequency | Format |
|----------|-----------|--------|
| New hires | Within first month | Onboarding module + OWASP Top 10 |
| All devs | Quarterly | 1-hour workshop + CTF |
| All devs | Annual | Full-day security training + assessment |

## 4. Resources
- [OWASP Top 10](https://owasp.org/Top10/)
- [OWASP ASVS](https://owasp.org/ASVS/)
- [Secure Coding Guidelines](https://cheatsheetseries.owasp.org/)
- [SANS Secure Coding](https://www.sans.org/secure-coding)

## 5. Metrics
- % of developers completing training
- Number of findings in SAST/DAST scans (trend)
- Time to remediate critical vulnerabilities

---
*Last updated: 2026-09-04*
# Team Training — QuantScreen

## 1. Objective
Ensure all developers and ops staff are trained in secure coding and security best practices.

## 2. Training Topics
### Core Topics (Mandatory for All Devs)
- OWASP Top 10 (2021)
  - Injection (SQL, NoSQL, OS)
  - Broken Access Control
  - Cryptographic Failures
  - Security Misconfiguration
  - Vulnerable and Outdated Components
  - Identification and Authentication Failures
  - Software and Data Integrity Failures
  - Security Logging and Monitoring Failures
  - Server-Side Request Forgery (SSRF)
- Secure Coding in Node.js/TypeScript
  - Input validation (Zod)
  - Authentication & session management (JWT, cookies)
  - Error handling and logging
  - Avoiding XSS, CSRF, and clickjacking

### Advanced Topics (For Leads)
- Threat modeling
- Security architecture design
- Incident response
- Zero Trust architecture

## 3. Training Schedule
| Audience | Frequency | Format | Duration |
|----------|-----------|--------|----------|
| New hires | Within first month | Onboarding module + OWASP Top 10 | 2 hours |
| All devs | Quarterly | Workshop + hands-on CTF | 2 hours |
| All devs | Annual | Full-day training + assessment | 8 hours |

## 4. Resources
- **OWASP Top 10**: https://owasp.org/Top10/
- **OWASP ASVS**: https://owasp.org/ASVS/
- **Secure Coding Cheat Sheets**: https://cheatsheetseries.owasp.org/
- **SANS Secure Coding**: https://www.sans.org/secure-coding
- **Node.js Security**: https://nodejs.org/en/docs/guides/security/

## 5. Metrics
- % of developers completing training (target: 100%)
- Number of security findings in SAST/DAST scans (trend over time)
- Time to remediate critical vulnerabilities

## 6. Bug Bounty Program (Optional)
- Encourage external researchers to find vulnerabilities
- Provide monetary rewards or recognition
- Set up a responsible disclosure policy (see [PENETRATION_TESTING.md](PENETRATION_TESTING.md))

---
*Last updated: 2026-09-04*
# Penetration Testing Checklist — QuantScreen

## 1. Pre-Testing Preparation
- [ ] Ensure staging environment mirrors production (same config, same security controls)
- [ ] Obtain authorization (written consent from stakeholders)
- [ ] Define scope: which IPs/domains/endpoints are in scope
- [ ] Set up test accounts (admin, trader, free tier)
- [ ] Prepare test data (valid API keys, subscriptions, alerts)

## 2. External (Black-Box) Testing
### 2.1 Reconnaissance
- [ ] DNS enumeration (subdomains, MX, TXT records)
- [ ] Port scanning (nmap -sV -sC -p-)
- [ ] Directory brute-force (dirb, ffuf)
- [ ] Technology fingerprinting (Wappalyzer, whatweb)

### 2.2 API Testing
- [ ] Swagger/OpenAPI endpoint discovery
- [ ] Parameter fuzzing (SQLi, XSS, LFI, RCE)
- [ ] Authentication bypass (JWT manipulation, missing auth)
- [ ] Rate limiting bypass (IP spoofing, header manipulation)
- [ ] Business logic flaws (order manipulation, quota bypass)

### 2.3 Web Application Testing
- [ ] XSS (reflected, stored, DOM-based)
- [ ] CSRF (check if tokens are used)
- [ ] Clickjacking (frame-ancestors, X-Frame-Options)
- [ ] Open redirect (login redirect parameter)
- [ ] Information disclosure (error messages, stack traces)
- [ ] Session fixation (login cookie manipulation)

### 2.4 Infrastructure Testing
- [ ] SSL/TLS check (weak ciphers, protocols)
- [ ] Security headers (HSTS, CSP, X-Content-Type-Options, etc.)
- [ ] CORS misconfiguration (origin reflection)
- [ ] DNS zone transfer (if exposed)
- [ ] Cloud storage misconfiguration (S3 buckets, etc.)

## 3. Internal (Gray-Box) Testing
### 3.1 Authenticated Testing
- [ ] Privilege escalation (normal user → admin)
- [ ] Horizontal privilege escalation (access other users' data)
- [ ] Object-level authorization (modify other users' alerts/walls)
- [ ] API rate limiting after authentication
- [ ] JWT token expiration and revocation

### 3.2 Database & Backend Testing
- [ ] SQL injection in search/filter parameters
- [ ] NoSQL injection (if MongoDB is used)
- [ ] Command injection in file upload/export features
- [ ] SSRF (server-side request forgery) via webhook URL
- [ ] XXE (if XML parsing is used)

## 4. White-Box Testing (Source Code)
- [ ] Review authentication/authorization logic (AuthService, authMiddleware)
- [ ] Check for hardcoded secrets (gitleaks/trufflehog)
- [ ] Review input validation (Zod schemas, allowlist)
- [ ] Inspect cryptographic implementations (scrypt, JWT)
- [ ] Logging & monitoring (audit logs, error handling)

## 5. Reporting
- [ ] Categorize findings: Critical, High, Medium, Low
- [ ] For each finding: description, affected endpoint, PoC (if applicable), recommended fix
- [ ] Provide remediation timeline:
  - Critical/High: 5 business days
  - Medium/Low: next sprint
- [ ] Include evidence (screenshots, logs)

## 6. Post-Testing
- [ ] Validate all fixes
- [ ] Retest critical/high findings
- [ ] Update ASVS checklist with findings
- [ ] Share results with engineering team (lessons learned)
- [ ] Archive pentest report (for compliance)

---
*Use OWASP ASVS Level 3 as the baseline standard.*
*Last updated: 2026-09-04*
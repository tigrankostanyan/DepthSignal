# Security Regression Testing — QuantScreen

## 1. Purpose
Ensure that new code changes do not introduce security vulnerabilities or break existing security controls.

## 2. When to Run
- Before every major release
- After any security patch
- When a new endpoint is added
- After dependency updates (especially security patches)
- After infrastructure changes (firewall, load balancer, WAF)

## 3. Automated Regression Tests (CI/CD)
- **SAST (Semgrep/CodeQL)** – runs on every PR
- **DAST (OWASP ZAP)** – nightly on staging
- **Dependency scanning (Snyk/Dependabot)** – daily
- **Container scanning (Trivy)** – on every Docker build

## 4. Manual Regression Test Cases

### 4.1 Authentication & Session Management
| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Login with valid credentials | Returns access token + refresh token cookie | [ ] |
| Login with invalid credentials | 401 error, record failed attempt (lockout) | [ ] |
| Login with locked account (5 failures) | 429 error, "Account temporarily locked" | [ ] |
| Access protected endpoint without token | 401 error, "Authentication required" | [ ] |
| Access protected endpoint with expired token | 401 error, "Invalid or expired" | [ ] |
| Refresh access token with valid refresh token | New access token + rotated refresh token | [ ] |
| Refresh token after logout | 401 error, "Invalid refresh token" | [ ] |
| Logout (clear cookie) | 200 ok, refresh token cookie cleared | [ ] |

### 4.2 Authorization (RBAC)
| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Trader accesses admin route | 403 error, "Insufficient privileges" | [ ] |
| Trader views own alerts | Only their own alerts returned | [ ] |
| Trader attempts to view other user's alert | 404/403 error (object-level check) | [ ] |

### 4.3 Input Validation (Zod Schemas)
| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Register with password < 12 chars | 400 error, "Password must be at least 12 characters" | [ ] |
| Register with password missing uppercase | 400 error, "must contain uppercase" | [ ] |
| Register with invalid email | 400 error, "Invalid email address" | [ ] |
| SQL injection in search parameter | Should be sanitized (Sequelize) | [ ] |
| XSS payload in alert name | Should be escaped/validated | [ ] |

### 4.4 Security Headers
| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| HSTS header | Present, max-age 31536000 | [ ] |
| X-Content-Type-Options | nosniff | [ ] |
| X-Frame-Options | DENY | [ ] |
| CSP report-only | Present (or enforced) | [ ] |
| Referrer-Policy | strict-origin-when-cross-origin | [ ] |

### 4.5 Rate Limiting
| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Login attempts > 5 in 15 min | 429 error, lockout | [ ] |
| API requests > 100/min | 429 error, Retry-After header | [ ] |
| Alert mutations > 40/min | 429 error | [ ] |

### 4.6 API Security
| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| CORS origin check (non-allowed origin) | 403 error | [ ] |
| HTTPS enforcement | HTTP → 301 redirect | [ ] |
| SSRF protection (webhook URL) | Malicious URL blocked | [ ] |

## 5. Reporting
- All test results must be documented
- Failures must be fixed before release
- Regression test suite must run in staging before production

## 6. Tools
- **Automated:** GitHub Actions (Semgrep, CodeQL, ZAP, Trivy)
- **Manual:** Burp Suite, Postman, curl
- **Scripts:** Custom test scripts (e.g., rate limiting tests)

---
*Last updated: 2026-09-04*
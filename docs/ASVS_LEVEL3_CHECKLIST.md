# OWASP ASVS Level 3 Checklist — QuantScreen

## 1. Authentication (V2)
- [x] Passwords hashed with scrypt/argon2id
- [x] Session tokens stored securely (HttpOnly, Secure, SameSite)
- [x] MFA available (optional, not yet enforced)
- [x] Account lockout (5 failures → 15 min block)
- [x] Password strength validation (min 12 chars, complexity)

## 2. Session Management (V3)
- [x] JWT access token (15 min expiry)
- [x] Refresh token rotation (revoke old, issue new)
- [x] Tokens revoked on logout
- [x] Session invalidation on password change

## 3. Access Control (V4)
- [x] Role-based access (ADMIN, TRADER)
- [x] Object-level authorization (repositories enforce userId)
- [ ] API endpoint ownership checks (verify user owns resource)
- [ ] Admin routes protected by `requireRole`

## 4. Input Validation (V5)
- [x] Zod schemas for all requests
- [x] Allowlist validation (enums, regex)
- [x] SQL injection prevention (Sequelize)
- [ ] No raw SQL concatenation (verify)
- [ ] SSRF protection (ssrfValidator)

## 5. Cryptographic Practices (V6)
- [x] scrypt for password hashing
- [x] JWT with HS256 (migrate to RS256/ES256 in future)
- [x] TLS 1.2+ (Let's Encrypt)
- [ ] Encrypt sensitive data at rest (DB encryption pending)

## 6. Error Handling & Logging (V7)
- [x] No stack traces in production responses
- [x] Structured logging (winston)
- [x] Audit logs for auth actions
- [ ] Centralized log aggregation (pending)
- [ ] SIEM integration (pending)
- [ ] Incident response plan – documented

## 7. Data Protection (V8)
- [x] HTTPS for all traffic
- [x] No hardcoded secrets (moved to .env)
- [ ] DB encryption at rest (TDE/KMS) – infrastructure level
- [x] Secure backups (encrypted)
- [ ] Secrets management (Vault/AWS Secrets Manager) – pending
- [ ] Auto-rotation of secrets – pending

## 8. Communications Security (V9)
- [x] TLS with HSTS
- [x] CSP (report-only mode, ready for enforcement)
- [x] CORS strict (allowed origins)
- [ ] Secure WebSocket connections (wss://)

## 9. Malicious Code Defense (V10)
- [ ] Dependency scanning (Snyk/Dependabot) – in progress
- [ ] SAST (Semgrep/CodeQL) – in progress
- [ ] DAST (OWASP ZAP) – in progress
- [ ] Container scanning (Trivy) – in progress

## 10. Business Logic (V11)
- [x] Rate limiting (5/15 min auth, 100/min API)
- [x] Subscription limits enforced (EntitlementService)
- [ ] No price manipulation (Stripe handles payments)
- [ ] Quota checks for free tier

## 11. API Security (V13)
- [x] Rate limiting per endpoint
- [x] API versioning (optional)
- [ ] Swagger/OpenAPI docs (missing)
- [x] CORS configured

---
*Next review: After Phase 4 implementation*
*Last updated: 2026-09-04*
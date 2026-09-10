# Security Checklist — QuantScreen

## ✅ Completed (code-level)

- [x] Password hashing (scrypt + salt)
- [x] Session tokens (crypto.randomBytes, JWT-style)
- [x] Rate limiting (auth, API, alert mutations)
- [x] Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- [x] Error handler (no stack traces in production)
- [x] SQL injection protection (Sequelize ORM)
- [x] Input validation (Zod schemas)
- [x] CORS (origin restriction)
- [x] SSRF protection (ssrfValidator)
- [x] Audit logging (user actions)

## 🚧 In Progress

- [ ] HSTS (Strict-Transport-Security) — added, but requires HTTPS to be active
- [ ] CSP (Content-Security-Policy) — added baseline
- [ ] Rate limiting tweaked (auth: 5 per 15 min)

## ⏳ Quick Setup Instructions

### 1. Clone and prepare
```bash
cd infrastructure
cp .env.production .env
# Edit .env — fill in all secrets
```

### 2. Obtain SSL certificate
```bash
chmod +x init-ssl.sh
./init-ssl.sh quantscreen.com your@email.com
```

### 3. Start everything
```bash
docker-compose up -d
```

### 4. Run security audit
```bash
chmod +x ../scripts/security-audit.sh
../scripts/security-audit.sh
```

### 5. Verify
- Visit https://quantscreen.com
- Check SSL Labs: https://www.ssllabs.com/ssltest/analyze.html?d=quantscreen.com
- Check Security Headers: https://securityheaders.com/?q=quantscreen.com

---

## 🔴 Infrastructure / Environment (YOU must set up)

- [ ] **HTTPS & TLS**
  - Obtain certificate (Let's Encrypt via Certbot, or Cloudflare)
  - Configure Nginx/Apache/Cloudflare to terminate TLS
  - Set up auto-renewal (certbot renew --cron)
  - Redirect HTTP → HTTPS (301)
  - Test with SSL Labs: target A+

- [ ] **Dependency scanning**
  - Run `npm audit` in both `/server` and `/web`
  - Run `npx yarn audit` if using Yarn
  - Fix critical/high vulnerabilities
  - Enable Dependabot or Renovate on GitHub

- [ ] **Secrets scanning**
  - Run `gitleaks detect --source .` or `trufflehog filesystem .`
  - Remove any hardcoded keys/passwords found
  - Move all secrets to environment variables / secret manager

- [ ] **Environment variables**
  - Ensure all keys are loaded from `.env` (never committed)
  - Use separate `.env.production` for production
  - Rotate any exposed secrets

- [ ] **Logging & monitoring**
  - Logs are written to `logs/` with daily rotation (30-day retention)
  - Health check endpoint: `/api/health`
  - Add alerts for failed login attempts (optional)

- [ ] **DDoS / abuse protection**
  - Use Cloudflare or similar WAF
  - Enable rate limiting on Nginx (`limit_req`)

## 📋 Suggested Nginx config snippet

```nginx
server {
    listen 80;
    server_name quantscreen.com www.quantscreen.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name quantscreen.com www.quantscreen.com;

    ssl_certificate /etc/letsencrypt/live/quantscreen.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/quantscreen.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # HSTS (already set in app, but also set here)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Security headers (fallback if app fails)
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## ✅ Final Verification

- [ ] SSL Labs test: A+
- [ ] SecurityHeaders.com: all green
- [ ] npm audit: no critical/high vulnerabilities
- [ ] No hardcoded secrets in code
- [ ] Rate limiting returns 429 on excess

---
*Last updated: 2026-09-04*
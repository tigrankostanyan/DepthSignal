# Secrets Management — QuantScreen

## 1. Current Status
- **Secrets location:** `.env` file (environment variables)
- **Rotation:** Manual (done during deployment)
- **Audit:** Not tracked

## 2. Recommended Solution: HashiCorp Vault (or AWS Secrets Manager)

### 2.1 Vault Integration Steps
1. **Deploy Vault** (Docker/Helm)
2. **Configure authentication** (Kubernetes auth or token-based)
3. **Store secrets** in Vault (e.g., `kv-v2/backend/db`, `kv-v2/backend/redis`)
4. **Retrieve secrets** at application startup
5. **Enable auto-rotation** for dynamic secrets (e.g., database credentials)

### 2.2 Secrets in Vault
| Secret | Path | Dynamic? |
|--------|------|----------|
| MySQL password | `kv-v2/backend/mysql` | Yes (via database secrets engine) |
| Redis password | `kv-v2/backend/redis` | Yes |
| JWT secret | `kv-v2/backend/jwt` | No (manual rotation) |
| Stripe keys | `kv-v2/backend/stripe` | No |
| Google client ID/secret | `kv-v2/backend/google` | No |
| API keys (Finnhub, Polygon) | `kv-v2/backend/apis` | No |

### 2.3 Auto-Rotation Implementation
```python
# Example: AWS Secrets Manager auto-rotation
- Create rotation Lambda
- Configure rotation schedule (e.g., every 30 days)
- Update application to fetch new secret on restart
```

## 3. Secrets Inventory
| Secret | Location | Rotated? | Rotation Frequency |
|--------|----------|----------|---------------------|
| MYSQL_PASSWORD | .env / Vault | ❌ | Manual |
| JWT_SECRET | .env / Vault | ❌ | Manual |
| STRIPE_SECRET_KEY | .env / Vault | ❌ | Manual |
| GOOGLE_CLIENT_ID | .env / Vault | ❌ | Manual |
| FINNHUB_API_KEY | .env / Vault | ❌ | Manual |

## 4. Implementation Plan
### 4.1 Phase 1: Vault Setup
- [ ] Deploy Vault (dev/staging/prod)
- [ ] Configure authentication (Kubernetes service account)
- [ ] Create policies for application (read-only access to specific paths)

### 4.2 Phase 2: Application Integration
- [ ] Update application to read from Vault instead of .env
- [ ] Fallback to .env if Vault is unavailable (for local dev)
- [ ] Test secret retrieval

### 4.3 Phase 3: Auto-Rotation
- [ ] Enable database secrets engine (dynamic credentials)
- [ ] Set up rotation policies for non-dynamic secrets (Lambda/cron)
- [ ] Implement rotation with zero downtime (blue-green)

## 5. Audit & Monitoring
- [ ] Enable audit logging in Vault (who accessed which secret)
- [ ] Set up alerts for failed secret retrieval
- [ ] Integrate with SIEM (e.g., Datadog)

## 6. Emergency Procedure
- **Secret compromise:** Immediately revoke secret in Vault, regenerate new secret, rotate applications.
- **Vault outage:** Use backup `.env` file (encrypted) as fallback.

---
*Last updated: 2026-09-04*
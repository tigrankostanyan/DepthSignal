# Backup & Recovery Testing — QuantScreen

## 1. Purpose
Ensure that backups are valid and can be restored quickly in case of data loss or corruption.

## 2. Backup Strategy
| Component | Backup Frequency | Retention | Location |
|-----------|------------------|-----------|----------|
| MySQL (production) | Daily (full) + continuous binlog | 30 days | S3 / encrypted |
| Redis | Daily (RDB) | 7 days | S3 |
| User uploads (if any) | Daily | 30 days | S3 |
| Application logs | Daily | 30 days | S3 |

## 3. Recovery Testing Schedule
- **Frequency:** Quarterly (or after major schema changes)
- **Duration:** 2 hours (full restore)
- **Environment:** Staging (separate infrastructure)

## 4. Test Procedure
### 4.1 Preparation
1. Provision a clean staging environment (new MySQL instance)
2. Download the latest backup from S3
3. Decrypt the backup (if encrypted)
4. Allocate enough disk space

### 4.2 Execution
1. Restore MySQL backup:
   ```bash
   mysql -u root -p production_db < backup.sql
   ```
2. Apply binlog (if available) for point-in-time recovery:
   ```bash
   mysqlbinlog binlog.000001 | mysql -u root -p production_db
   ```
3. Restore Redis:
   ```bash
   redis-cli --rdb dump.rdb
   ```
4. Verify data integrity:
   - Check user accounts exist
   - Run a few sample queries
   - Confirm recent data is present

### 4.3 Validation
- [ ] All tables are restored
- [ ] Foreign keys are intact
- [ ] No data corruption errors
- [ ] Application can connect and query data
- [ ] User sessions work after restore

### 4.4 Cleanup
- Destroy the staging environment after testing
- Log the test results

## 5. Time Targets
| Step | Target Time |
|------|-------------|
| Restore MySQL | < 30 min |
| Restore Redis | < 5 min |
| Verify data | < 15 min |
| **Total** | **< 1 hour** |

## 6. Monitoring
- Set up alerts for failed backups
- Monitor backup size trends

---
*Last updated: 2026-09-04*
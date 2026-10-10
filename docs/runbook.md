# IDMS Operational Runbook

**System:** Integrated Distribution Management System (IDMS)  
**Deployment:** Saharsa FMCG Super Distributor  
**Version:** Release Candidate 1.0.0 (Target: 15 Nov 2026)  

---

## 1. System Architecture & Service Overview

* **Frontend & Backend API:** Next.js 14 App Router (Node.js runtime, Standalone container compatible)
* **Database:** PostgreSQL 16.4 Native Cluster (`D:\pgsql\data`, port 5432) / Docker Compose
* **ORM & Migrations:** Prisma 5.x
* **Hardware Integrations:** Web Bluetooth ESC/POS Thermal Printers (58mm/80mm), USB Thermal Receipt Printers

---

## 2. Daily Start / Stop Procedures

### Starting Services (Local Host / Server)
```powershell
# 1. Start PostgreSQL Cluster (if not running as a Windows Service)
$env:PATH = "$env:APPDATA\npm;D:\pgsql\bin;" + [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
& "D:\pgsql\bin\postgres.exe" -D "D:\pgsql\data"

# 2. Start Application in Development Mode
pnpm dev

# OR Start Application with Local HTTPS for Mobile Phone Testing (LAN)
pnpm dev:lan

# OR Run Full Production Container via Docker Compose
docker compose --profile app up -d
```

### Stopping Services
```powershell
# Stop Node.js server: Ctrl + C in the shell
# Stop PostgreSQL:
& "D:\pgsql\bin\pg_ctl.exe" -D "D:\pgsql\data" stop -m fast

# Stop Docker Compose:
docker compose --profile app down
```

---

## 3. Database Maintenance & Backup Drill

### Creating Backups
Automated backup scripts produce a timestamped `.sql` dump and an accompanying SHA256 integrity hash:
```powershell
# Run backup script
pnpm db:backup
# Output located at: ./backups/idms_backup_YYYYMMDD_HHMMSS.sql
# Hash located at:   ./backups/idms_backup_YYYYMMDD_HHMMSS.sql.sha256
```

### Restoring Backups
```powershell
# Restore latest or specific backup:
powershell -ExecutionPolicy Bypass -File scripts/restore.ps1 -BackupFile "./backups/idms_backup_20261010_090925.sql"
```

### Automated Backup & Restore Verification Drill
Before any software update or month-end close, run the automated validation harness:
```powershell
pnpm db:validate-backup
```
*Dumps live database, validates SHA256 checksum, restores into an isolated clean test database (`idms_restore_test`), and verifies 100% row-count match across all 29 database tables.*

---

## 4. Tally ERP & CA Monthly Procedures

1. **Party Synchronization:**
   * Export Debtors from Tally as CSV and upload at `http://localhost:3000/admin/parties/import`.
2. **Sales & Receipt Vouchers to Tally:**
   * Open `http://localhost:3000/admin/reports?tab=tally`.
   * Select date range and click **Download TallyPrime XML** or **Download RFC 4180 CSV**.
   * Open TallyPrime > Import Data > Vouchers > Select downloaded XML file.
3. **GSTR-1 Monthly CA Worksheets:**
   * Open `http://localhost:3000/admin/reports?tab=gstr1`.
   * Export **Table 4A (B2B)**, **Table 7 (B2CS)**, and **Table 12 (HSN Summary)** CSVs for monthly GST portal filing.

---

## 5. Troubleshooting & Common Issues

| Issue / Symptom | Root Cause | Solution / Fix |
|---|---|---|
| **Port 3000 in use** | An existing Next.js node instance is still running. | Run `Get-NetTCPConnection -LocalPort 3000` to find PID, then `Stop-Process -Id <PID> -Force`. |
| **PostgreSQL connection refused (Port 5432)** | Postgres service stopped. | Run `& "D:\pgsql\bin\pg_isready.exe" -p 5432` to check. Start via `postgres.exe -D "D:\pgsql\data"`. |
| **"Forbidden: Access Denied" (403)** | Current browser session has a non-admin role (Shop/Van/Delivery) while accessing `/admin/*`. | Click [http://localhost:3000/logout](http://localhost:3000/logout) to clear session, then log in with Owner phone `9876543210`. |
| **Bluetooth Printer not connecting on phone** | Chrome requires secure origin (HTTPS or localhost) for Web Bluetooth. | Use `pnpm dev:lan` for HTTPS on LAN IP, or install root CA on Android test device. |
| **Van bill draft not syncing** | Device still in offline airplane mode. | Turn on cellular/Wi-Fi. The Van PWA automatically detects reconnect and syncs queued IndexedDB drafts with idempotency keys. |

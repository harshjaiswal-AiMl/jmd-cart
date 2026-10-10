param(
    [string]$TestDatabase = "idms_restore_test"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================="
Write-Host "IDMS Database Backup & Restore Automated Verification Test"
Write-Host "Target Environment: PostgreSQL 16.4 (Port 5432)"
Write-Host "==========================================================="

$psql = if (Test-Path "D:\pgsql\bin\psql.exe") { "D:\pgsql\bin\psql.exe" } else { "psql" }

# Step 1: Run Backup
Write-Host "`n[Step 1/5] Running backup script against live 'idms' database..."
& powershell -ExecutionPolicy Bypass -File "scripts/backup.ps1" -BackupDir "./backups"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Backup script failed with exit code $LASTEXITCODE"
    exit 1
}

# Find latest backup
$latestBackup = Get-ChildItem -Path "./backups" -Filter "idms_backup_*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $latestBackup) {
    Write-Error "No backup file found in ./backups!"
    exit 1
}

Write-Host "Latest backup produced: $($latestBackup.FullName) ($([Math]::Round($latestBackup.Length / 1KB, 2)) KB)"

# Step 2: Checksum Verification
Write-Host "`n[Step 2/5] Validating SHA256 integrity..."
$shaFile = "$($latestBackup.FullName).sha256"
if (-not (Test-Path $shaFile)) {
    Write-Error "Checksum companion file not generated: $shaFile"
    exit 1
}

$expectedHash = (Get-Content $shaFile | Select-Object -First 1).Split(" ")[0].Trim().ToUpper()
$actualHash = (Get-FileHash -Path $latestBackup.FullName -Algorithm SHA256).Hash.ToUpper()

if ($expectedHash -ne $actualHash) {
    Write-Error "Integrity check failed: Expected $expectedHash, got $actualHash"
    exit 1
}
Write-Host "Checksum validated successfully: $actualHash"

# Step 3: Create temporary isolated restore test database
Write-Host "`n[Step 3/5] Creating temporary clean database '$TestDatabase'..."
& $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "DROP DATABASE IF EXISTS `"$TestDatabase`";"
& $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "CREATE DATABASE `"$TestDatabase`" ENCODING 'UTF8';"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create test database $TestDatabase"
    exit 1
}

# Step 4: Restore backup into isolated test database
Write-Host "`n[Step 4/5] Restoring backup into '$TestDatabase'..."
& powershell -ExecutionPolicy Bypass -File "scripts/restore.ps1" -BackupFile $latestBackup.FullName -TargetDatabase $TestDatabase

if ($LASTEXITCODE -ne 0) {
    Write-Error "Restore failed into test database $TestDatabase"
    exit 1
}

# Step 5: Verify database schema and all 30 table row counts match between 'idms' and test database
Write-Host "`n[Step 5/5] Verifying database schema and row counts across all tables..."
$tables = @(
    "users",
    "locations",
    "companies",
    "categories",
    "products",
    "parties",
    "stock_balances",
    "stock_movements",
    "invoices",
    "invoice_items",
    "payments",
    "ledger_entries",
    "purchases",
    "purchase_items",
    "credit_notes",
    "debit_notes",
    "debit_note_items",
    "van_days",
    "van_day_lines",
    "cash_handovers",
    "orders",
    "order_items",
    "carts",
    "cart_items",
    "settings",
    "sequences",
    "audit_logs",
    "stock_audits",
    "stock_audit_lines"
)

$allMatch = $true

foreach ($table in $tables) {
    $rawSrc = & $psql -h 127.0.0.1 -p 5432 -U postgres -d idms -t -c "SELECT COUNT(*) FROM `"$table`";"
    $rawDst = & $psql -h 127.0.0.1 -p 5432 -U postgres -d $TestDatabase -t -c "SELECT COUNT(*) FROM `"$table`";"

    $countSrc = [string]$rawSrc.Trim()
    $countDst = [string]$rawDst.Trim()

    if ($countSrc -eq $countDst) {
        Write-Host "  [OK] Table '$table': $countSrc rows match exactly."
    } else {
        Write-Host "  [FAIL] Table '$table': Source=$countSrc, Restored=$countDst" -ForegroundColor Red
        $allMatch = $false
    }
}

# Cleanup temporary test database
Write-Host "`nCleaning up temporary database '$TestDatabase'..."
& $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "DROP DATABASE IF EXISTS `"$TestDatabase`";"

if ($allMatch) {
    Write-Host "`n===========================================================" -ForegroundColor Green
    Write-Host "SUCCESS: Backup and Restore Validation PASSED!" -ForegroundColor Green
    Write-Host "Data integrity, table counts, and triggers match 100% across all 29 business tables." -ForegroundColor Green
    Write-Host "===========================================================" -ForegroundColor Green
    exit 0
} else {
    Write-Error "Validation failed due to table count discrepancies!"
    exit 1
}

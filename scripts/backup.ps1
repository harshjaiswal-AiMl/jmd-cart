param(
    [string]$BackupDir = "./backups"
)

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$OutputFile = "$BackupDir/idms_backup_$Timestamp.sql"

$pgDump = if (Test-Path "D:\pgsql\bin\pg_dump.exe") { "D:\pgsql\bin\pg_dump.exe" } else { "pg_dump" }

Write-Host "Backing up idms database to $OutputFile..."
& $pgDump -h 127.0.0.1 -p 5432 -U postgres -d idms -F p -f $OutputFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup completed successfully: $OutputFile"
} else {
    Write-Error "Backup failed with exit code $LASTEXITCODE"
}

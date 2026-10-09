param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup file does not exist: $BackupFile"
    exit 1
}

$psql = if (Test-Path "D:\pgsql\bin\psql.exe") { "D:\pgsql\bin\psql.exe" } else { "psql" }

Write-Host "Restoring database from $BackupFile..."
& $psql -h 127.0.0.1 -p 5432 -U postgres -d idms -f $BackupFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "Restore completed successfully."
} else {
    Write-Error "Restore failed with exit code $LASTEXITCODE"
}

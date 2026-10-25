param(
    [string]$BackupDir = "./backups"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$OutputFile = "$BackupDir/idms_backup_$Timestamp.sql"
$ShaFile = "$OutputFile.sha256"

$pgDump = if (Test-Path "D:\pgsql\bin\pg_dump.exe") { "D:\pgsql\bin\pg_dump.exe" } else { "pg_dump" }

Write-Host "Creating backup of 'idms' database to $OutputFile..."
& $pgDump -h 127.0.0.1 -p 5432 -U postgres -d idms -F p -f $OutputFile

if ($LASTEXITCODE -eq 0 -and (Test-Path $OutputFile)) {
    $fileSize = (Get-Item $OutputFile).Length
    $hash = (Get-FileHash -Path $OutputFile -Algorithm SHA256).Hash
    "$hash  idms_backup_$Timestamp.sql" | Out-File -FilePath $ShaFile -Encoding utf8

    Write-Host "Backup completed successfully!"
    Write-Host "  File: $OutputFile ($([Math]::Round($fileSize / 1KB, 2)) KB)"
    Write-Host "  SHA256: $hash"
    exit 0
} else {
    Write-Error "Backup failed with exit code $LASTEXITCODE"
    exit 1
}

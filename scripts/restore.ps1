param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,

    [string]$TargetDatabase = "idms"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup file does not exist: $BackupFile"
    exit 1
}

# Verify SHA256 checksum if .sha256 companion file exists
$shaFile = "$BackupFile.sha256"
if (Test-Path $shaFile) {
    Write-Host "Verifying SHA256 checksum from $shaFile..."
    $expectedHash = (Get-Content $shaFile | Select-Object -First 1).Split(" ")[0].Trim().ToUpper()
    $actualHash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash.ToUpper()

    if ($expectedHash -ne $actualHash) {
        Write-Error "Checksum mismatch! Expected: $expectedHash, Actual: $actualHash"
        exit 2
    }
    Write-Host "Checksum verification passed: $actualHash"
}

$psql = if (Test-Path "D:\pgsql\bin\psql.exe") { "D:\pgsql\bin\psql.exe" } else { "psql" }

Write-Host "Restoring database '$TargetDatabase' from $BackupFile..."
& $psql -h 127.0.0.1 -p 5432 -U postgres -d $TargetDatabase -f $BackupFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "Restore completed successfully into '$TargetDatabase'."
    exit 0
} else {
    Write-Error "Restore failed with exit code $LASTEXITCODE"
    exit 1
}

#!/usr/bin/env pwsh
# JMD Cart - GCP One-Command Rollback Script
# Usage: pwsh scripts/rollback-gcp.ps1 [-ToRevision <rev>] [-Region <region>] [-ServiceName <service>]

Param(
    [string]$ToRevision = "",
    [string]$Region = "asia-south1",
    [string]$ServiceName = "jmd-cart"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$PROJECT = (gcloud config get-value project 2>$null).Trim()
if (-not $PROJECT) { Write-Error "No GCP project set."; exit 1 }

Write-Host "=== Rolling back $ServiceName in $PROJECT ($Region) ===" -ForegroundColor Yellow

if (-not $ToRevision) {
    Write-Host "No revision specified. Looking for previously active revision..." -ForegroundColor Cyan
    $revisions = (gcloud run revisions list --service=$ServiceName --region=$Region --limit=5 --format="json" | ConvertFrom-Json)
    # Find the current active revision and pick the one immediately following it
    $currentActive = ""
    $previousRevision = ""
    for ($i = 0; $i -lt $revisions.Count; $i++) {
        $status = $revisions[$i].status
        $revName = $revisions[$i].metadata.name
        if ($status.conditions | Where-Object { $_.type -eq "Active" -and $_.status -eq "True" }) {
            $currentActive = $revName
            if ($i + 1 -lt $revisions.Count) {
                $previousRevision = $revisions[$i + 1].metadata.name
            }
            break
        }
    }
    if (-not $previousRevision) {
        Write-Error "Could not automatically determine previous revision. Please specify -ToRevision <revision-name>"
        exit 1
    }
    $ToRevision = $previousRevision
}

Write-Host "Routing 100% traffic to revision: $ToRevision" -ForegroundColor Yellow
gcloud run services update-traffic $ServiceName --region=$Region --to-revisions="$ToRevision=100" --project=$PROJECT --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to update traffic to $ToRevision."
    exit 1
}

Write-Host "Traffic successfully pinned 100% to $ToRevision." -ForegroundColor Green
Write-Host "Running smoke tests..." -ForegroundColor Cyan
pnpm smoke
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Smoke tests failed or gave warnings! Please verify manually."
} else {
    Write-Host "Rollback and verification COMPLETE!" -ForegroundColor Green
}

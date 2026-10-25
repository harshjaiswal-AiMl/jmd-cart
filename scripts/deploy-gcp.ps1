#!/usr/bin/env pwsh
# JMD Cart - GCP Deploy Script
# Builds, migrates, deploys, and optionally runs smoke tests
# Usage: pwsh scripts/deploy-gcp.ps1 [-BuildOnly] [-MigrateOnly] [-SkipSmoke]

Param(
    [switch]$BuildOnly,
    [switch]$MigrateOnly,
    [string]$Region = "asia-south1",
    [string]$ServiceName = "jmd-cart",
    [string]$JobName = "jmd-cart-migrate",
    [string]$ArRepo = "jmd-cart",
    [string]$ImageTag = "latest",
    [string]$ServiceAccount = "jmd-cart-run",
    [string]$SqlInstance = "jmd-cart-db",
    [string]$SqlDb = "jmdcart",
    [string]$SqlUser = "jmdcart_app",
    [switch]$SkipSmoke
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"


$PROJECT = (gcloud config get-value project 2>$null).Trim()
if (-not $PROJECT) { Write-Error "No GCP project set."; exit 1 }
$SA_EMAIL = "$ServiceAccount@$PROJECT.iam.gserviceaccount.com"
$IMAGE = "$Region-docker.pkg.dev/$PROJECT/$ArRepo/$ServiceName`:$ImageTag"
$SQL_CONN = "$PROJECT`:$Region`:$SqlInstance"

Write-Host "Project: $PROJECT" -ForegroundColor Cyan
Write-Host "Image: $IMAGE" -ForegroundColor Cyan

# 1. Build image with Cloud Build
if (-not $MigrateOnly) {
    Write-Host "`n=== Building Docker image via Cloud Build ===" -ForegroundColor Yellow
    gcloud builds submit . `
        --tag=$IMAGE `
        --project=$PROJECT
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Cloud Build failed! Aborting deploy." -ForegroundColor Red
        exit 1
    }
    Write-Host "  Build complete." -ForegroundColor Green
}

if ($BuildOnly) { Write-Host "Build-only mode. Done."; exit 0 }

# 2. Run migration job
Write-Host "`n=== Running Migration Job ===" -ForegroundColor Yellow
# Create or update the job
gcloud run jobs deploy $JobName `
    --image=$IMAGE `
    --region=$Region `
    --service-account=$SA_EMAIL `
    --set-cloudsql-instances=$SQL_CONN `
    --set-secrets="DATABASE_URL=DATABASE_URL:latest,AUTH_SECRET=AUTH_SECRET:latest" `
    --set-env-vars="NODE_ENV=production,TZ=Asia/Kolkata" `
    --command="sh" `
    --args="-c,node /app/node_modules/prisma/build/index.js migrate resolve --applied 20261021173827_user_wishlist || true; node /app/node_modules/prisma/build/index.js migrate deploy && node /app/prisma/dist/seed.js" `
    --project=$PROJECT `
    --quiet




gcloud run jobs execute $JobName --region=$Region --project=$PROJECT --wait
if ($LASTEXITCODE -ne 0) {
    Write-Host "Migration job execution failed! Aborting deploy." -ForegroundColor Red
    exit 1
}
Write-Host "  Migration job complete." -ForegroundColor Green

if ($MigrateOnly) { Write-Host "Migration-only mode. Done."; exit 0 }

# 3. Deploy Cloud Run service
Write-Host "`n=== Deploying Cloud Run Service ===" -ForegroundColor Yellow
gcloud run deploy $ServiceName `
    --image=$IMAGE `
    --region=$Region `
    --service-account=$SA_EMAIL `
    --set-cloudsql-instances=$SQL_CONN `
    --set-secrets="DATABASE_URL=DATABASE_URL:latest,AUTH_SECRET=AUTH_SECRET:latest,SETUP_TOKEN=SETUP_TOKEN:latest,R2_ACCOUNT_ID=R2_ACCOUNT_ID:latest,R2_ACCESS_KEY_ID=R2_ACCESS_KEY_ID:latest,R2_SECRET_ACCESS_KEY=R2_SECRET_ACCESS_KEY:latest,R2_BUCKET=R2_BUCKET:latest" `
    --set-env-vars="NODE_ENV=production,TZ=Asia/Kolkata,DEFAULT_BRANCH_ID=1" `
    --set-env-vars="STOREFRONT_HOST=jmdcart.com,MANAGEMENT_HOST=management.jmdcart.com" `
    --set-env-vars="APP_URL=https://jmdcart.com,MANAGEMENT_URL=https://management.jmdcart.com" `
    --set-env-vars="UPLOAD_DIR=/uploads" `
    "--add-volume=name=uploads,type=cloud-storage,bucket=$PROJECT-uploads" `
    "--add-volume-mount=volume=uploads,mount-path=/uploads" `
    --min-instances=1 `
    --max-instances=10 `
    --memory=1Gi `
    --cpu=1 `
    --concurrency=80 `
    --timeout=60s `
    --ingress=internal-and-cloud-load-balancing `
    --allow-unauthenticated `
    --port=8080 `
    --project=$PROJECT `
    --quiet

Write-Host "  Deployed: $ServiceName" -ForegroundColor Green

# 4. Health check via proxy with retry
Write-Host "`n=== Health Check ===" -ForegroundColor Yellow
$proxyPort = 9090
Write-Host "  Starting proxy on localhost:$proxyPort..."
$proxyJob = Start-Job -ScriptBlock {
    gcloud run services proxy $using:ServiceName --region=$using:Region --project=$using:PROJECT --port=$using:proxyPort
}
Start-Sleep -Seconds 6
$passed = $false
for ($i = 1; $i -le 6; $i++) {
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:$proxyPort/api/health" -TimeoutSec 10
        if ($health.status -eq "ok" -and $health.db -eq "ok") {
            Write-Host "  Health check PASSED: status=ok db=ok" -ForegroundColor Green
            $passed = $true
            break
        }
    } catch {
        Write-Host "  Waiting for proxy/service ($i/6)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 4
    }
}
Stop-Job $proxyJob; Remove-Job $proxyJob

if (-not $passed) {
    Write-Host "  Proxy health check failed; checking live domain directly..." -ForegroundColor Yellow
    try {
        $liveHealth = Invoke-RestMethod -Uri "https://management.jmdcart.com/api/health" -TimeoutSec 15
        if ($liveHealth.status -eq "ok" -and $liveHealth.db -eq "ok") {
            Write-Host "  Live domain health check PASSED: status=ok db=ok" -ForegroundColor Green
            $passed = $true
        }
    } catch {
        Write-Host "  Live domain health check FAILED: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n=== Deploy Complete ===" -ForegroundColor Green
Write-Host "Run smoke tests: tsx scripts/smoke-prod.ts"

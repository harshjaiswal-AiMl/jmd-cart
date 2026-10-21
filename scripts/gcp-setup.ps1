#!/usr/bin/env pwsh
# GCP Infrastructure Setup for JMD Cart
# Run: pwsh scripts/gcp-setup.ps1
# Prerequisites: gcloud auth login, gcloud config set project <id>
# This script is idempotent - safe to re-run.

Param(
    [string]$Region = "asia-south1",
    [string]$SqlInstance = "jmd-cart-db",
    [string]$BucketName = "",  # will be set to PROJECT_ID-uploads
    [string]$DbName = "jmdcart",
    [string]$DbUser = "jmdcart_app",
    [string]$ArRepo = "jmd-cart",
    [string]$ServiceName = "jmd-cart",
    [string]$ServiceAccount = "jmd-cart-run",
    [string]$BudgetAmount = "5000",  # INR
    [switch]$SkipExpensiveResources  # Skip Cloud SQL + LB creation for testing
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"


# Get project
$PROJECT = (gcloud config get-value project 2>$null).Trim()
if (-not $PROJECT) {
    Write-Error "No GCP project set. Run: gcloud config set project <PROJECT_ID>"
    exit 1
}
Write-Host "Project: $PROJECT" -ForegroundColor Cyan
if (-not $BucketName) { $BucketName = "$PROJECT-uploads" }

# 1. Enable APIs
Write-Host "`n=== Enabling APIs ===" -ForegroundColor Yellow
$apis = @(
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "sqladmin.googleapis.com",
    "secretmanager.googleapis.com",
    "compute.googleapis.com",
    "storage.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com"
)
foreach ($api in $apis) {
    Write-Host "  Enabling $api..."
    gcloud services enable $api --project=$PROJECT --quiet 2>$null
}
Write-Host "APIs enabled." -ForegroundColor Green

# 2. Service Account
Write-Host "`n=== Service Account ===" -ForegroundColor Yellow
$SA_EMAIL = "$ServiceAccount@$PROJECT.iam.gserviceaccount.com"
$null = gcloud iam service-accounts describe $SA_EMAIL --project=$PROJECT 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Service account already exists: $SA_EMAIL"
} else {
    gcloud iam service-accounts create $ServiceAccount `
        --display-name="JMD Cart Cloud Run SA" `
        --project=$PROJECT
    Write-Host "  Created: $SA_EMAIL" -ForegroundColor Green
}

# 3. Artifact Registry
Write-Host "`n=== Artifact Registry ===" -ForegroundColor Yellow
$null = gcloud artifacts repositories describe $ArRepo --location=$Region --project=$PROJECT 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  AR repo already exists."
} else {
    gcloud artifacts repositories create $ArRepo `
        --repository-format=docker `
        --location=$Region `
        --description="JMD Cart Docker images" `
        --project=$PROJECT
    Write-Host "  Created AR repo: $ArRepo" -ForegroundColor Green
}

# 4. Cloud Storage Bucket
Write-Host "`n=== Cloud Storage Bucket ===" -ForegroundColor Yellow
$bucketUri = "gs://$BucketName"
$null = gcloud storage buckets describe $bucketUri --project=$PROJECT 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Bucket already exists: $bucketUri"
} else {
    gcloud storage buckets create $bucketUri `
        --location=$Region `
        --project=$PROJECT `
        --uniform-bucket-level-access
    Write-Host "  Created bucket: $bucketUri" -ForegroundColor Green
}
# Ensure public access prevention & versioning
gcloud storage buckets update $bucketUri --public-access-prevention --project=$PROJECT 2>$null
gcloud storage buckets update $bucketUri --versioning --project=$PROJECT 2>$null
Write-Host "  Bucket configured (public-access-prevention=enforced, versioning=on)" -ForegroundColor Green

# Grant SA access to bucket
gcloud storage buckets add-iam-policy-binding $bucketUri `
    --member="serviceAccount:$SA_EMAIL" `
    --role="roles/storage.objectAdmin" `
    --project=$PROJECT 2>$null | Out-Null
Write-Host "  Granted storage.objectAdmin to $SA_EMAIL" -ForegroundColor Green

if (-not $SkipExpensiveResources) {
    # 5. Cloud SQL
    Write-Host "`n=== Cloud SQL (this takes 5-10 minutes) ===" -ForegroundColor Yellow
    $null = gcloud sql instances describe $SqlInstance --project=$PROJECT 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Cloud SQL instance already exists: $SqlInstance"
    } else {
        gcloud sql instances create $SqlInstance `
            --database-version=POSTGRES_16 `
            --tier=db-g1-small `
            --edition=enterprise `
            --region=$Region `
            --storage-type=SSD `
            --storage-size=10GB `
            --storage-auto-increase `
            --backup `
            --backup-start-time=02:00 `
            --enable-point-in-time-recovery `
            --deletion-protection `
            --require-ssl `
            --assign-ip `
            --project=$PROJECT
        Write-Host "  Created Cloud SQL instance: $SqlInstance" -ForegroundColor Green

    }

    # Create database
    $null = gcloud sql databases describe $DbName --instance=$SqlInstance --project=$PROJECT 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Database '$DbName' already exists."
    } else {
        gcloud sql databases create $DbName --instance=$SqlInstance --project=$PROJECT
        Write-Host "  Created database: $DbName" -ForegroundColor Green
    }

    # Grant Cloud SQL Client to SA
    gcloud projects add-iam-policy-binding $PROJECT `
        --member="serviceAccount:$SA_EMAIL" `
        --role="roles/cloudsql.client" 2>$null | Out-Null
    Write-Host "  Granted cloudsql.client to $SA_EMAIL" -ForegroundColor Green
}

# 6. Secret Manager & Credentials
Write-Host "`n=== Secret Manager & Credentials ===" -ForegroundColor Yellow

function Get-Or-Create-Secret {
    param([string]$Name)
    $null = gcloud secrets describe $Name --project=$PROJECT 2>&1
    if ($LASTEXITCODE -ne 0) {
        gcloud secrets create $Name --project=$PROJECT --replication-policy=automatic | Out-Null
        Write-Host "  Created secret container: $Name" -ForegroundColor Green
    }
    gcloud secrets add-iam-policy-binding $Name `
        --member="serviceAccount:$SA_EMAIL" `
        --role="roles/secretmanager.secretAccessor" `
        --project=$PROJECT 2>$null | Out-Null
}

function Has-Secret-Version {
    param([string]$Name)
    $versions = (gcloud secrets versions list $Name --project=$PROJECT --filter="state=ENABLED" --format="value(name)" 2>$null)
    return (-not [string]::IsNullOrWhiteSpace($versions) -and $LASTEXITCODE -eq 0)
}

function Add-Secret-Value {
    param([string]$Name, [string]$Value)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $tmpFile = [System.IO.Path]::GetTempFileName()
    try {

        [System.IO.File]::WriteAllBytes($tmpFile, $utf8NoBom.GetBytes($Value))
        gcloud secrets versions add $Name --data-file=$tmpFile --project=$PROJECT | Out-Null
        Write-Host "  Added version to secret: $Name" -ForegroundColor Green
    } finally {


        if (Test-Path $tmpFile) { Remove-Item $tmpFile -Force }
    }
}

function Get-Secret-Value {
    param([string]$Name)
    try {
        return (gcloud secrets versions access latest --secret=$Name --project=$PROJECT 2>$null).Trim()
    } catch {
        return ""
    }
}

# Create secret containers
$secrets = @("AUTH_SECRET", "SETUP_TOKEN", "DB_PASSWORD", "DATABASE_URL")
foreach ($s in $secrets) {
    Get-Or-Create-Secret $s
}

# 1. AUTH_SECRET
if (-not (Has-Secret-Version "AUTH_SECRET")) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $authSecret = [Convert]::ToBase64String($bytes)
    Add-Secret-Value "AUTH_SECRET" $authSecret
} else {
    Write-Host "  AUTH_SECRET already has a version."
}

# 2. SETUP_TOKEN
$setupToken = ""
if (-not (Has-Secret-Version "SETUP_TOKEN")) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $setupToken = -join ($bytes | ForEach-Object { "{0:x2}" -f $_ })
    Add-Secret-Value "SETUP_TOKEN" $setupToken
} else {
    Write-Host "  SETUP_TOKEN already has a version."
    $setupToken = Get-Secret-Value "SETUP_TOKEN"
}

# Save SETUP_TOKEN to .env.deploy if not present
$envDeployPath = Join-Path $PSScriptRoot "..\.env.deploy"
if (-not (Test-Path $envDeployPath)) {
    "SETUP_TOKEN=$setupToken" | Out-File -FilePath $envDeployPath -Encoding utf8
    Write-Host "  Saved SETUP_TOKEN to .env.deploy (git-ignored)." -ForegroundColor Green
} else {
    $currentContent = Get-Content $envDeployPath -Raw
    if ($currentContent -notmatch "SETUP_TOKEN=") {
        Add-Content -Path $envDeployPath -Value "SETUP_TOKEN=$setupToken"
        Write-Host "  Appended SETUP_TOKEN to .env.deploy." -ForegroundColor Green
    }
}

# 3. DB_PASSWORD & Database User
$dbPass = ""
if (-not (Has-Secret-Version "DB_PASSWORD")) {
    $bytes = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $dbPass = -join ($bytes | ForEach-Object { "{0:x2}" -f $_ })
    Add-Secret-Value "DB_PASSWORD" $dbPass
} else {
    Write-Host "  DB_PASSWORD already has a version."
    $dbPass = Get-Secret-Value "DB_PASSWORD"
}

# Ensure Cloud SQL user exists with DB_PASSWORD
if (-not $SkipExpensiveResources) {
    $null = gcloud sql users describe $DbUser --instance=$SqlInstance --project=$PROJECT 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Cloud SQL user '$DbUser' already exists."
    } else {
        gcloud sql users create $DbUser --instance=$SqlInstance --password=$dbPass --project=$PROJECT
        Write-Host "  Created Cloud SQL user: $DbUser" -ForegroundColor Green
    }
}

# 4. DATABASE_URL
if (-not (Has-Secret-Version "DATABASE_URL")) {
    $dbUrl = "postgresql://${DbUser}:${dbPass}@localhost/${DbName}?host=/cloudsql/${PROJECT}:${Region}:${SqlInstance}&connection_limit=5&schema=public"
    Add-Secret-Value "DATABASE_URL" $dbUrl
} else {
    Write-Host "  DATABASE_URL already has a version."
}

Write-Host "  Secret Manager configured and versions verified." -ForegroundColor Green


Write-Host "`n=== Setup Complete ===" -ForegroundColor Green
Write-Host "Project: $PROJECT"
Write-Host "Region: $Region"
Write-Host "Bucket: $bucketUri"
Write-Host "Service Account: $SA_EMAIL"
Write-Host "Cloud SQL: $SqlInstance (database: $DbName, user: $DbUser)"
Write-Host "`nNext steps:"
Write-Host "1. Build image: pwsh scripts/deploy-gcp.ps1 -BuildOnly"
Write-Host "2. Run migration job: pwsh scripts/deploy-gcp.ps1 -MigrateOnly"
Write-Host "3. Deploy Cloud Run: pwsh scripts/deploy-gcp.ps1"


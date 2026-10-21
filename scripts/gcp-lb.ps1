#!/usr/bin/env pwsh
# GCP Global Load Balancer Setup for JMD Cart
# Creates: static IP, serverless NEG, backend service, URL map,
# Google-managed cert, HTTPS proxy, HTTP->HTTPS redirect, forwarding rules
# Re-runnable (idempotent).

Param(
    [string]$Region = "asia-south1",
    [string]$ServiceName = "jmd-cart",
    [string]$IpName = "jmd-cart-ip",
    [string]$NegName = "jmd-cart-neg",
    [string]$BackendName = "jmd-cart-backend",
    [string]$UrlMapName = "jmd-cart-urlmap",
    [string]$CertName = "jmd-cart-cert",
    [string]$HttpsProxyName = "jmd-cart-https-proxy",
    [string]$HttpProxyName = "jmd-cart-http-proxy",
    [string]$RedirectMapName = "jmd-cart-redirect",
    [string]$FwdHttpsName = "jmd-cart-https-fwd",
    [string]$FwdHttpName = "jmd-cart-http-fwd"
)

$PROJECT = (gcloud config get-value project 2>$null).Trim()
if (-not $PROJECT) { Write-Error "No GCP project set."; exit 1 }
Write-Host "Project: $PROJECT | Region: $Region" -ForegroundColor Cyan

# 1. Reserve global static IP
Write-Host "`n=== Static IP ===" -ForegroundColor Yellow
$null = gcloud compute addresses describe $IpName --global --project=$PROJECT 2>&1
if ($LASTEXITCODE -eq 0) {
    $ip = (gcloud compute addresses describe $IpName --global --project=$PROJECT --format="value(address)" 2>$null).Trim()
    Write-Host "  IP already exists: $ip"
} else {
    gcloud compute addresses create $IpName --global --ip-version=IPV4 --project=$PROJECT
    $ip = (gcloud compute addresses describe $IpName --global --project=$PROJECT --format="value(address)" 2>$null).Trim()
    Write-Host "  Reserved IP: $ip" -ForegroundColor Green
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "DNS RECORDS TO ADD IN SQUARESPACE:" -ForegroundColor Cyan
Write-Host "  Type  Name        Value" -ForegroundColor Cyan
Write-Host "  A     @           $ip" -ForegroundColor Green
Write-Host "  A     management  $ip" -ForegroundColor Green
Write-Host "  A     www         $ip" -ForegroundColor Green
Write-Host "FIRST DELETE: old Squarespace A records (198.185.159.x, 198.49.23.x)," -ForegroundColor Yellow
Write-Host "HTTPS record, and CNAME www->ext-sq.squarespace.com" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 2. Serverless NEG
Write-Host "`n=== Serverless NEG ===" -ForegroundColor Yellow
$null = gcloud compute network-endpoint-groups describe $NegName --region=$Region --project=$PROJECT 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  NEG already exists."
} else {
    gcloud compute network-endpoint-groups create $NegName `
        --region=$Region `
        --network-endpoint-type=serverless `
        --cloud-run-service=$ServiceName `
        --project=$PROJECT
    Write-Host "  Created serverless NEG." -ForegroundColor Green
}

# 3. Backend service
Write-Host "`n=== Backend Service ===" -ForegroundColor Yellow
$null = gcloud compute backend-services describe $BackendName --global --project=$PROJECT 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Backend service already exists."
} else {
    gcloud compute backend-services create $BackendName `
        --global `
        --load-balancing-scheme=EXTERNAL_MANAGED `
        --project=$PROJECT
    gcloud compute backend-services add-backend $BackendName `
        --global `
        --network-endpoint-group=$NegName `
        --network-endpoint-group-region=$Region `
        --project=$PROJECT
    Write-Host "  Created backend service." -ForegroundColor Green
}

# 4. URL map
Write-Host "`n=== URL Map ===" -ForegroundColor Yellow
$null = gcloud compute url-maps describe $UrlMapName --global --project=$PROJECT 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  URL map already exists."
} else {
    gcloud compute url-maps create $UrlMapName `
        --default-service=$BackendName `
        --global `
        --project=$PROJECT
    Write-Host "  Created URL map." -ForegroundColor Green
}

# 5. Google-managed certificate
Write-Host "`n=== Managed Certificate ===" -ForegroundColor Yellow
$null = gcloud compute ssl-certificates describe $CertName --global --project=$PROJECT 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Certificate already exists."
} else {
    gcloud compute ssl-certificates create $CertName `
        --domains="jmdcart.com,management.jmdcart.com,www.jmdcart.com" `
        --global `
        --project=$PROJECT
    Write-Host "  Created managed certificate (provisioning takes a few hours after DNS propagates)." -ForegroundColor Green
}

# 6. HTTPS proxy + forwarding rule
Write-Host "`n=== HTTPS Proxy + Forwarding Rule ===" -ForegroundColor Yellow
$null = gcloud compute target-https-proxies describe $HttpsProxyName --global --project=$PROJECT 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  HTTPS proxy already exists."
} else {
    gcloud compute target-https-proxies create $HttpsProxyName `
        --url-map=$UrlMapName `
        --ssl-certificates=$CertName `
        --global `
        --project=$PROJECT
    Write-Host "  Created HTTPS proxy." -ForegroundColor Green
}

$null = gcloud compute forwarding-rules describe $FwdHttpsName --global --project=$PROJECT 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  HTTPS forwarding rule already exists."
} else {
    gcloud compute forwarding-rules create $FwdHttpsName `
        --global `
        --load-balancing-scheme=EXTERNAL_MANAGED `
        --address=$IpName `
        --target-https-proxy=$HttpsProxyName `
        --ports=443 `
        --project=$PROJECT
    Write-Host "  Created HTTPS forwarding rule." -ForegroundColor Green
}

# 7. HTTP->HTTPS redirect
Write-Host "`n=== HTTP -> HTTPS Redirect ===" -ForegroundColor Yellow
$null = gcloud compute url-maps describe $RedirectMapName --global --project=$PROJECT 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Redirect URL map already exists."
} else {
    $redirectYaml = @"
name: $RedirectMapName
defaultUrlRedirect:
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
  httpsRedirect: true
"@
    $tempFile = [System.IO.Path]::GetTempFileName()
    try {
        Set-Content -Path $tempFile -Value $redirectYaml -Encoding utf8
        gcloud compute url-maps import $RedirectMapName --global --project=$PROJECT --source $tempFile --quiet
    } finally {
        Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
    }
    Write-Host "  Created HTTP->HTTPS redirect map." -ForegroundColor Green
}

$null = gcloud compute target-http-proxies describe $HttpProxyName --global --project=$PROJECT 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  HTTP proxy already exists."
} else {
    gcloud compute target-http-proxies create $HttpProxyName `
        --url-map=$RedirectMapName `
        --global `
        --project=$PROJECT
    Write-Host "  Created HTTP proxy (for redirect)." -ForegroundColor Green
}

$null = gcloud compute forwarding-rules describe $FwdHttpName --global --project=$PROJECT 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  HTTP forwarding rule already exists."
} else {
    gcloud compute forwarding-rules create $FwdHttpName `
        --global `
        --load-balancing-scheme=EXTERNAL_MANAGED `
        --address=$IpName `
        --target-http-proxy=$HttpProxyName `
        --ports=80 `
        --project=$PROJECT
    Write-Host "  Created HTTP forwarding rule." -ForegroundColor Green
}

Write-Host "`n=== Load Balancer Setup Complete ===" -ForegroundColor Green
Write-Host "Static IP: $ip"
Write-Host "Certificate: $CertName (may take hours to become ACTIVE after DNS points here)"
Write-Host "`nCheck cert status:"
Write-Host "  gcloud compute ssl-certificates describe $CertName --global --format=json"

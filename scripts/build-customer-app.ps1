# Build Customer App Script for JMD Cart (com.jmdcart.shop)
# Usage: powershell -ExecutionPolicy Bypass -File scripts/build-customer-app.ps1

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  JMD Cart Mobile App Local Build Pipeline (Android Release)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"
$rootDir = Get-Location

# 1. Verify Theme and Design Tokens Drift
Write-Host "`n[1/5] Verifying Design Tokens & RN Theme..." -ForegroundColor Yellow
npx tsx scripts/generate-rn-theme.ts
pnpm vitest run tests/unit/theme-drift.test.ts

# 2. Verify Parity Checklist & i18n
Write-Host "`n[2/5] Running Parity & Bilingual i18n Guard Tests..." -ForegroundColor Yellow
pnpm vitest run tests/unit/parity.test.ts
pnpm vitest run tests/unit/i18n.test.ts

# 3. Running Backend API Contract Tests
Write-Host "`n[3/5] Verifying /api/store/v1 Mobile API Contracts..." -ForegroundColor Yellow
pnpm vitest run tests/integration/store-v1-api.test.ts

# 4. Building Native Android APK and AAB
Write-Host "`n[4/5] Compiling Native Android Release APK & AAB..." -ForegroundColor Yellow
Set-Location "$rootDir/apps/customer-mobile/android"
.\gradlew.bat assembleRelease bundleRelease

# 5. Output Verification & Summary
Set-Location $rootDir
$apkPath = "$rootDir/apps/customer-mobile/android/app/build/outputs/apk/release/app-release.apk"
$aabPath = "$rootDir/apps/customer-mobile/android/app/build/outputs/bundle/release/app-release.aab"

if (Test-Path $apkPath) {
    $apkSize = (Get-Item $apkPath).Length / 1MB
    Write-Host "`n[SUCCESS] Release APK built at:" -ForegroundColor Green
    Write-Host "  $apkPath ($([math]::Round($apkSize, 2)) MB)" -ForegroundColor White
}

if (Test-Path $aabPath) {
    $aabSize = (Get-Item $aabPath).Length / 1MB
    Write-Host "[SUCCESS] Release AAB (Play Store) built at:" -ForegroundColor Green
    Write-Host "  $aabPath ($([math]::Round($aabSize, 2)) MB)" -ForegroundColor White
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  Customer Mobile App Build Complete!" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

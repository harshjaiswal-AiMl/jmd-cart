Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipPath = "C:\Users\admin\.gemini\antigravity\brain\1211f38c-27f4-46eb-9ef3-5be03bd6bf6d\.user_uploaded\media_1792583659236_a2a1263b.zip"
$outDir = "d:\JMD CART\temp_design"

if (Test-Path $outDir) {
    Remove-Item -Recurse -Force $outDir
}
New-Item -ItemType Directory -Path $outDir | Out-Null

Write-Host "Extracting design zip..."
[System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $outDir)

Get-ChildItem -Path $outDir -Recurse | Select-Object FullName

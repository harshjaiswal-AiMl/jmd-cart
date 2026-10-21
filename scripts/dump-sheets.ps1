Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipPath = "C:\Users\admin\.gemini\antigravity\brain\1211f38c-27f4-46eb-9ef3-5be03bd6bf6d\.user_uploaded\media_1792569258771_d3895b0e.xlsx"
$outDir = "d:\JMD CART\temp_xlsx"

if (Test-Path $outDir) {
    Remove-Item -Recurse -Force $outDir
}
New-Item -ItemType Directory -Path $outDir | Out-Null

Write-Host "Extracting xlsx..."
[System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $outDir)

$wbXml = [xml](Get-Content "$outDir\xl\workbook.xml" -Raw)
$sheets = @()
foreach ($s in $wbXml.workbook.sheets.sheet) {
    $sheets += [PSCustomObject]@{
        Name = $s.name
        SheetId = $s.sheetId
        RelId = $s.id
    }
}

Write-Host "Found $($sheets.Count) sheets:"
$sheets | Format-Table -AutoSize

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = "C:\Users\admin\.gemini\antigravity\brain\1211f38c-27f4-46eb-9ef3-5be03bd6bf6d\.user_uploaded\media_1792569258771_d3895b0e.xlsx"
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
$zip.Entries | Select-Object FullName
$zip.Dispose()

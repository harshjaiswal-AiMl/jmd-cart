$pass = (gcloud secrets versions access latest --secret="DB_PASSWORD" --project="jmd-cart").Trim()
if ($pass) {
    Write-Host "DB_PASSWORD retrieved successfully, length: $($pass.Length)"
} else {
    Write-Host "Failed to retrieve DB_PASSWORD"
}

# PowerShell script to add env vars to Vercel without hardcoding secrets
$ErrorActionPreference = "Continue"

$keys = @(
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
    "HUGGINGFACE_API_KEY",
    "COHERE_API_KEY",
    "CEREBRAS_API_KEY",
    "POLLINATIONS_ENABLED",
    "LIBRETTS_ENABLED"
)

$envVars = @()
foreach ($key in $keys) {
    $value = [Environment]::GetEnvironmentVariable($key)
    if ($value) {
        $envVars += @{ Key = $key; Value = $value }
    } else {
        Write-Host "Skipping $key because it is not set in the current environment" -ForegroundColor Yellow
    }
}

$environments = @("production", "preview", "development")

foreach ($targetEnv in $environments) {
    Write-Host "`n=== Environment: $targetEnv ===" -ForegroundColor Cyan
    foreach ($var in $envVars) {
        $key = $var.Key
        $value = $var.Value

        $tempFile = [System.IO.Path]::GetTempFileName()
        if ($targetEnv -eq "preview") {
            @($value, "", "n") | Out-File -FilePath $tempFile -Encoding UTF8
        } else {
            @($value, "n") | Out-File -FilePath $tempFile -Encoding UTF8
        }

        try {
            $output = Get-Content $tempFile | vercel env add $key $targetEnv 2>&1
            if ($output -match "Added|already exists") {
                Write-Host "$key added to $targetEnv" -ForegroundColor Green
            } else {
                Write-Host "$key result: $output" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "$key failed: $_" -ForegroundColor Red
        } finally {
            Remove-Item $tempFile -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "`nDone!" -ForegroundColor Green

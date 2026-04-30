# PowerShell script to add env vars to Vercel
$ErrorActionPreference = "Continue"

$envVars = @(
    @{ Key = "CLOUDFLARE_ACCOUNT_ID"; Value = "ec262170b16c9dfa861c6622844657c7" },
    @{ Key = "CLOUDFLARE_API_TOKEN"; Value = "cfat_p3iab6LrauegNvqLNPW4vujMrE9JQz0mzn6wK2VZ33b61785" },
    @{ Key = "HUGGINGFACE_API_KEY"; Value = "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" },
    @{ Key = "COHERE_API_KEY"; Value = "bnX37aY0yPhjWiZckvtoR3QLGNmHNvMNWFRFtvX3" },
    @{ Key = "CEREBRAS_API_KEY"; Value = "csk-pxcjmnpmvc3ymwj82rx3hddtm33543c69j4e2h6ct8hrhekp" },
    @{ Key = "POLLINATIONS_ENABLED"; Value = "true" },
    @{ Key = "LIBRETTS_ENABLED"; Value = "true" }
)

$environments = @("production", "preview", "development")

foreach ($env in $environments) {
    Write-Host "`n=== Environment: $env ===" -ForegroundColor Cyan
    foreach ($var in $envVars) {
        $key = $var.Key
        $value = $var.Value

        # Create temp input file with responses
        $tempFile = [System.IO.Path]::GetTempFileName()
        if ($env -eq "preview") {
            # For preview: value, enter (all branches), n (not sensitive)
            @($value, "", "n") | Out-File -FilePath $tempFile -Encoding UTF8
        } else {
            # For production/development: value, n (not sensitive)
            @($value, "n") | Out-File -FilePath $tempFile -Encoding UTF8
        }

        try {
            $output = Get-Content $tempFile | vercel env add $key $env 2>&1
            if ($output -match "Added|already exists") {
                Write-Host "✅ $key added to $env" -ForegroundColor Green
            } else {
                Write-Host "⚠️ $key result: $output" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "❌ $key failed: $_" -ForegroundColor Red
        } finally {
            Remove-Item $tempFile -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "`nDone!" -ForegroundColor Green

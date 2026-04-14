# Upload all env vars to Vercel
$ErrorActionPreference = "Continue"
Set-Location (Join-Path $PSScriptRoot "..")

$content = Get-Content ".env.local" -Raw
$lines = $content -split "`r?`n"
$envs = @("production", "preview", "development")
$success = 0
$failed = 0

foreach ($line in $lines) {
    $trimmed = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed)) { continue }
    if ($trimmed.StartsWith("#")) { continue }
    
    $eqIndex = $trimmed.IndexOf("=")
    if ($eqIndex -lt 0) { continue }
    
    $name = $trimmed.Substring(0, $eqIndex).Trim()
    $value = $trimmed.Substring($eqIndex + 1).Trim()
    
    # Remove quotes
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or 
        ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    
    Write-Host "Adding $name..." -NoNewline
    
    foreach ($env in $envs) {
        try {
            $psi = New-Object System.Diagnostics.ProcessStartInfo
            $psi.FileName = "cmd.exe"
            $psi.Arguments = "/c echo $value | npx vercel env add $name $env --force --yes"
            $psi.RedirectStandardOutput = $true
            $psi.RedirectStandardError = $true
            $psi.UseShellExecute = $false
            $psi.CreateNoWindow = $true
            
            $proc = [System.Diagnostics.Process]::Start($psi)
            $proc.WaitForExit(60000)
            
            if ($proc.ExitCode -eq 0) {
                Write-Host " $env✓" -NoNewline -ForegroundColor Green
                $success++
            } else {
                Write-Host " $env✗" -NoNewline -ForegroundColor Red
                $failed++
            }
        } catch {
            Write-Host " $env✗" -NoNewline -ForegroundColor Red
            $failed++
        }
    }
    Write-Host ""
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Done! Success: $success, Failed: $failed" -ForegroundColor Cyan

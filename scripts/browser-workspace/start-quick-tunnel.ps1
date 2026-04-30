param(
  [string]$ViewerUrl = "https://localhost:3001"
)

Write-Host "Starting Cloudflare Quick Tunnel for $ViewerUrl"
Write-Host "This mode is for testing only. The URL will be random and temporary."
Write-Host ""
Write-Host "Command:"
Write-Host "cloudflared tunnel --url $ViewerUrl --no-tls-verify"
Write-Host ""

cloudflared tunnel --url $ViewerUrl --no-tls-verify

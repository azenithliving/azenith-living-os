# Deployment Helper for Gemini Proxy
# This script helps deploy the proxy to Vercel and update GitHub Secrets

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  GEMINI PROXY DEPLOYMENT HELPER                        ║" -ForegroundColor Cyan
Write-Host "║  Bypass Egypt IP Restrictions                          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if Vercel CLI is installed
try {
    $vercelVersion = vercel --version 2>$null
    Write-Host "✅ Vercel CLI found: $vercelVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Vercel CLI not found. Install with: npm i -g vercel" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Deployment Steps:" -ForegroundColor Yellow
Write-Host "=====================" -ForegroundColor Yellow
Write-Host ""

# Step 1: Deploy to Vercel
Write-Host "1️⃣  Deploying to Vercel..." -ForegroundColor Cyan
Write-Host "    Run this command manually:" -ForegroundColor White
Write-Host "    vercel --prod" -ForegroundColor Green
Write-Host ""

# Step 2: Show GitHub Secrets instructions
Write-Host "2️⃣  Update GitHub Secrets:" -ForegroundColor Cyan
Write-Host "    Go to: https://github.com/azenithliving/azenith-living-os/settings/secrets/actions" -ForegroundColor White
Write-Host ""
Write-Host "    Add these secrets:" -ForegroundColor Yellow
Write-Host "    -------------------" -ForegroundColor Yellow

# Load keys from .env.local
$envContent = Get-Content ".env.local" -Raw
$geminiKeysMatch = [regex]::Match($envContent, 'GOOGLE_AI_KEYS="([^"]+)"')
if ($geminiKeysMatch.Success) {
    $geminiKeys = $geminiKeysMatch.Groups[1].Value
    Write-Host "    GOOGLE_AI_KEYS = $geminiKeys" -ForegroundColor Green
}

$pexelsMatch = [regex]::Match($envContent, 'PEXELS_KEYS="([^"]+)"')
if ($pexelsMatch.Success) {
    $pexelsKeys = $pexelsMatch.Groups[1].Value
    Write-Host "    PEXELS_KEYS = $pexelsKeys" -ForegroundColor Green
}

Write-Host ""
Write-Host "3️⃣  Test the Proxy:" -ForegroundColor Cyan
Write-Host "    After deployment, test with:" -ForegroundColor White
Write-Host "    curl https://YOUR_VERCEL_URL/api/proxy/gemini" -ForegroundColor Green
Write-Host ""

Write-Host "✨ Done! The proxy will bypass Egypt IP restrictions." -ForegroundColor Green

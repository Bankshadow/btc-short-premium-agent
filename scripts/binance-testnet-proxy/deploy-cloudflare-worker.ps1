# Deploy Binance testnet proxy to Cloudflare Workers (FREE - no credit card for workers.dev)
# Usage: powershell -ExecutionPolicy Bypass -File deploy-cloudflare-worker.ps1
#
# First time only:
#   npx wrangler login

$ErrorActionPreference = "Stop"
$Dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WorkerDir = Join-Path $Dir "cloudflare-worker"
Push-Location $WorkerDir

Write-Host ""
Write-Host "=== Cloudflare Worker - Binance Testnet Proxy (FREE) ===" -ForegroundColor Cyan
Write-Host ""

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
npx wrangler whoami 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Opening Cloudflare login ..." -ForegroundColor Yellow
    npx wrangler login 2>&1 | Out-Host
}
$ErrorActionPreference = $prevEap

if (-not $env:BINANCE_PROXY_SECRET) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $env:BINANCE_PROXY_SECRET = [Convert]::ToBase64String($bytes) -replace '[+/=]', ''
    if ($env:BINANCE_PROXY_SECRET.Length -gt 40) {
        $env:BINANCE_PROXY_SECRET = $env:BINANCE_PROXY_SECRET.Substring(0, 40)
    }
    Write-Host ""
    Write-Host "Generated BINANCE_PROXY_SECRET (save for Vercel):" -ForegroundColor Yellow
    Write-Host ('  ' + $env:BINANCE_PROXY_SECRET)
    Write-Host ""
    $env:BINANCE_PROXY_SECRET | npx wrangler secret put BINANCE_PROXY_SECRET 2>&1 | Out-Host
} else {
    $env:BINANCE_PROXY_SECRET | npx wrangler secret put BINANCE_PROXY_SECRET 2>&1 | Out-Host
}

Write-Host "Deploying worker ..." -ForegroundColor Green
$ErrorActionPreference = "Continue"
$deployOut = npx wrangler deploy 2>&1
$deployExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap
$deployOut | Out-Host

if ($deployExit -ne 0) {
    Write-Host "Deploy failed (exit $deployExit)." -ForegroundColor Red
    Pop-Location
    exit $deployExit
}

$proxyUrl = ($deployOut | Select-String -Pattern "https://[a-zA-Z0-9.-]+\.workers\.dev" | Select-Object -First 1).Matches.Value
if (-not $proxyUrl) {
    $proxyUrl = "https://btc-binance-testnet-proxy.<your-account>.workers.dev"
}

Write-Host ""
Write-Host "=== Deploy complete ===" -ForegroundColor Green
Write-Host "Proxy URL:  $proxyUrl"
Write-Host "Health:     $proxyUrl/health"
Write-Host ""
Write-Host "Set on Vercel (Production):" -ForegroundColor Cyan
Write-Host "  BINANCE_TESTNET_PROXY_URL=$proxyUrl"
Write-Host ('  BINANCE_PROXY_SECRET=' + $env:BINANCE_PROXY_SECRET)
Write-Host ""

# Save for Vercel push script
$outFile = Join-Path $Dir ".cloudflare-proxy.env"
@(
    "BINANCE_TESTNET_PROXY_URL=$proxyUrl"
    "BINANCE_PROXY_SECRET=$($env:BINANCE_PROXY_SECRET)"
) | Set-Content -Path $outFile -Encoding utf8

Pop-Location

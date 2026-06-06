# Deploy Binance testnet proxy to Railway
# Requires: railway CLI + railway login
# Usage: powershell -ExecutionPolicy Bypass -File deploy-railway.ps1

$ErrorActionPreference = "Stop"
$Dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $Dir

$railway = Get-Command railway -ErrorAction SilentlyContinue
if (-not $railway) {
    Write-Host "Installing Railway CLI …" -ForegroundColor Cyan
    npm install -g @railway/cli 2>&1 | Out-Host
    $railway = Get-Command railway -ErrorAction SilentlyContinue
    if (-not $railway) {
        Write-Host "Railway CLI install failed. Try: npm i -g @railway/cli" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "=== Railway Binance Testnet Proxy ===" -ForegroundColor Cyan
Write-Host ""

railway whoami 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Opening railway login …" -ForegroundColor Yellow
    railway login
}

if (-not (Test-Path ".railway")) {
    Write-Host "Initializing Railway project …" -ForegroundColor Green
    railway init --name btc-binance-testnet-proxy 2>&1 | Out-Host
}

if (-not $env:BINANCE_PROXY_SECRET) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $env:BINANCE_PROXY_SECRET = [Convert]::ToBase64String($bytes) -replace '[+/=]', ''
    if ($env:BINANCE_PROXY_SECRET.Length -gt 40) {
        $env:BINANCE_PROXY_SECRET = $env:BINANCE_PROXY_SECRET.Substring(0, 40)
    }
    Write-Host ""
    Write-Host "Generated BINANCE_PROXY_SECRET (save for Vercel):" -ForegroundColor Yellow
    Write-Host "  $env:BINANCE_PROXY_SECRET"
    Write-Host ""
}

Write-Host "Setting Railway variables …" -ForegroundColor Green
railway variables set "BINANCE_UPSTREAM_URL=https://demo-fapi.binance.com" 2>&1 | Out-Host
railway variables set "BINANCE_PROXY_SECRET=$($env:BINANCE_PROXY_SECRET)" 2>&1 | Out-Host

Write-Host "Deploying …" -ForegroundColor Green
railway up --detach 2>&1 | Out-Host

Write-Host ""
Write-Host "Generating public domain …" -ForegroundColor Green
railway domain 2>&1 | Out-Host

Write-Host ""
Write-Host "=== Next steps ===" -ForegroundColor Cyan
Write-Host "1. Railway Dashboard → Service → Settings → Region → pick Asia (Singapore/Tokyo)"
Write-Host "2. Copy public URL from: railway domain"
Write-Host "3. Set on Vercel:"
Write-Host "     BINANCE_TESTNET_PROXY_URL=https://<your-railway-domain>"
Write-Host "     BINANCE_PROXY_SECRET=$($env:BINANCE_PROXY_SECRET)"
Write-Host ""

Pop-Location

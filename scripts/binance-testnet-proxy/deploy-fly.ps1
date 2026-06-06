# Deploy Binance testnet proxy to Fly.io (Singapore)
# Requires: flyctl + fly auth login
# Usage: powershell -ExecutionPolicy Bypass -File deploy-fly.ps1

$ErrorActionPreference = "Stop"
$Dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $Dir

function Get-Fly {
    $fly = Get-Command fly -ErrorAction SilentlyContinue
    if ($fly) { return "fly" }
    $localFly = Join-Path $Dir ".tools\flyctl.exe"
    if (Test-Path $localFly) { return $localFly }
    $userFly = Join-Path $env:USERPROFILE ".fly\bin\fly.exe"
    if (Test-Path $userFly) { return $userFly }
    return $null
}

$flyCmd = Get-Fly
if (-not $flyCmd) {
    Write-Host "Downloading flyctl to .tools/ …" -ForegroundColor Cyan
    $tools = Join-Path $Dir ".tools"
    New-Item -ItemType Directory -Force -Path $tools | Out-Null
    $zip = Join-Path $tools "flyctl.zip"
    Invoke-WebRequest -Uri "https://github.com/superfly/flyctl/releases/latest/download/flyctl_Windows_x86_64.zip" -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $tools -Force
    $flyCmd = Get-Fly
    if (-not $flyCmd) {
        Write-Host "flyctl install failed. Install manually: https://fly.io/docs/hands-on/install-flyctl/" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "=== Fly.io Binance Testnet Proxy ===" -ForegroundColor Cyan
Write-Host "Region: sin (Singapore)"
Write-Host ""

& $flyCmd auth whoami 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Run: fly auth login" -ForegroundColor Yellow
    & $flyCmd auth login
}

$appName = "btc-binance-testnet-proxy"
$apps = & $flyCmd apps list 2>&1
if ($apps -notmatch $appName) {
    Write-Host "Creating app $appName …" -ForegroundColor Green
    & $flyCmd apps create $appName --org personal 2>&1 | Out-Host
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

Write-Host "Setting Fly secret …" -ForegroundColor Green
& $flyCmd secrets set "BINANCE_PROXY_SECRET=$($env:BINANCE_PROXY_SECRET)" --app $appName 2>&1 | Out-Host

Write-Host "Deploying …" -ForegroundColor Green
& $flyCmd deploy --app $appName --ha=false 2>&1 | Out-Host

$status = & $flyCmd status --app $appName 2>&1
$hostname = ($status | Select-String -Pattern "Hostname\s*=\s*(\S+)" | ForEach-Object { $_.Matches[0].Groups[1].Value })
if (-not $hostname) {
    $hostname = "$appName.fly.dev"
}

$proxyUrl = "https://$hostname"
Write-Host ""
Write-Host "=== Deploy complete ===" -ForegroundColor Green
Write-Host "Proxy URL:  $proxyUrl"
Write-Host "Health:     $proxyUrl/health"
Write-Host ""
Write-Host "Set on Vercel:" -ForegroundColor Cyan
Write-Host "  BINANCE_TESTNET_PROXY_URL=$proxyUrl"
Write-Host "  BINANCE_PROXY_SECRET=$($env:BINANCE_PROXY_SECRET)"
Write-Host ""

Pop-Location

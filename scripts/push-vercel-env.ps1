# Push .env.local values to Vercel production env (requires: npm i -g vercel && vercel login)
# Usage: powershell -ExecutionPolicy Bypass -File scripts/push-vercel-env.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$EnvFile = Join-Path $Root ".env.local"

if (-not (Test-Path $EnvFile)) {
    Write-Host "Missing .env.local — run scripts/setup-testnet.ps1 first" -ForegroundColor Red
    exit 1
}

$vars = @{}
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $k = $Matches[1]
        $v = $Matches[2].Trim().Trim('"')
        if (-not [string]::IsNullOrWhiteSpace($v) -and $v -notmatch '^#') {
            $vars[$k] = $v
        }
    }
}

$pushKeys = @(
    "CRON_SECRET",
    "BYBIT_API_KEY",
    "BYBIT_API_SECRET",
    "BYBIT_TESTNET",
    "LIVE_EXECUTION_ENABLED",
    "LIVE_REQUIRE_DOUBLE_CONFIRM",
    "LIVE_MAX_NOTIONAL_USD",
    "LIVE_ALLOWED_SYMBOLS",
    "BINANCE_TESTNET_ENABLED",
    "BINANCE_LIVE_ENABLED",
    "BINANCE_API_KEY",
    "BINANCE_API_SECRET",
    "BINANCE_FUTURES_TESTNET_BASE_URL",
    "BINANCE_TESTNET_PROXY_URL",
    "BINANCE_PROXY_SECRET",
    "BINANCE_ALLOWED_SYMBOLS",
    "BINANCE_TESTNET_MAX_NOTIONAL_USD",
    "BINANCE_TESTNET_MAX_TRADES_PER_DAY",
    "BINANCE_TESTNET_MAX_OPEN_POSITIONS",
    "BINANCE_REQUIRE_DOUBLE_CONFIRM",
    "BINANCE_TESTNET_AUTOEXECUTE_ENABLED"
)

Write-Host ""
Write-Host "=== Push env to Vercel (production) ===" -ForegroundColor Cyan
Write-Host "Project: btc-short-premium-agent"
Write-Host ""

$vercel = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercel) {
    Write-Host "Vercel CLI not found. Install: npm i -g vercel" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or set manually in Vercel Dashboard → Settings → Environment Variables:" -ForegroundColor Yellow
    foreach ($key in $pushKeys) {
        if ($vars.ContainsKey($key)) {
            $display = if ($key -match "SECRET|KEY") { "****" } else { $vars[$key] }
            Write-Host "  $key = $display"
        }
    }
    Write-Host ""
    Write-Host "Then redeploy: vercel --prod  OR  git push (if connected)"
    exit 0
}

Push-Location $Root
foreach ($key in $pushKeys) {
    if (-not $vars.ContainsKey($key)) {
        Write-Host "Skip $key (not in .env.local)" -ForegroundColor DarkGray
        continue
    }
    Write-Host "Setting $key …" -ForegroundColor Green
    $val = $vars[$key]
    # vercel env add: pipe value to stdin for non-interactive
    $val | vercel env add $key production --force 2>&1 | Out-Host
}
Pop-Location

Write-Host ""
Write-Host "Done. Redeploy for env to apply:" -ForegroundColor Green
Write-Host "  vercel --prod"
Write-Host "  or push to main if Git integration is on"
Write-Host ""

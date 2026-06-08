# Sets GitHub Actions secret CRON_SECRET from .env.local (same value as Vercel).
# Prerequisite: gh auth login (one time)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $repoRoot ".env.local"

if (-not (Test-Path $envFile)) {
  Write-Error ".env.local not found at $envFile"
}

$line = Get-Content $envFile | Where-Object { $_ -match '^CRON_SECRET=' } | Select-Object -First 1
if (-not $line) {
  Write-Error "CRON_SECRET not found in .env.local"
}

$secret = ($line -replace '^CRON_SECRET=', '').Trim()
if ($secret -match '^(PASTE_|replace-with|your-random)' -or $secret.Length -lt 32) {
  Write-Error "CRON_SECRET in .env.local looks like a placeholder - set a real value first."
}

$gh = $null
if (Get-Command gh -ErrorAction SilentlyContinue) {
  $gh = "gh"
} elseif (Test-Path "$env:ProgramFiles\GitHub CLI\gh.exe") {
  $gh = "$env:ProgramFiles\GitHub CLI\gh.exe"
} else {
  Write-Error "GitHub CLI (gh) not found. Install from https://cli.github.com/ or set CRON_SECRET manually in GitHub -> Settings -> Secrets -> Actions."
}

& $gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Not logged in to GitHub. Run: gh auth login" -ForegroundColor Yellow
  exit 1
}

$secret | & $gh secret set CRON_SECRET -R Bankshadow/btc-short-premium-agent
Write-Host "CRON_SECRET set on GitHub repo Bankshadow/btc-short-premium-agent" -ForegroundColor Green

& $gh workflow run "Production automation cron" -R Bankshadow/btc-short-premium-agent
Write-Host "Triggered test workflow run." -ForegroundColor Green

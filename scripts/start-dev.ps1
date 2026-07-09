param(
  [switch]$NoBridge,
  [switch]$NoWaCalls
)

$root = Split-Path -Parent $PSScriptRoot
$bridgePath = Join-Path $root "whatsmeow-bridge"
$bridgeExe = Join-Path $bridgePath "whatsmeow-bridge.exe"
$wacallsPath = Join-Path $root "wacalls"
$wacallsExe = Join-Path $wacallsPath "wacalls-server.exe"
$wacallsDb = Join-Path $wacallsPath "wacalls.db"

$nodeServer = $null
$bridgeJob = $null
$wacallsJob = $null

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Vendaora 360 - Dev Environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start whatsmeow bridge (Go sidecar)
if (-not $NoBridge -and (Test-Path $bridgeExe)) {
  Write-Host "[1/3] Starting whatsmeow bridge (port 4000)..." -ForegroundColor Yellow
  $env:WHATSMEOW_DB_PATH = "file:$bridgePath\whatsmeow.db?_pragma=foreign_keys(1)"
  $env:WHATSMEOW_WEBHOOK_URL = "http://localhost:3333/api/integrations/whatsmeow/incoming?tenantId=seed-tenant"
  if (-not $env:WHATSMEOW_BRIDGE_SECRET) {
    $env:WHATSMEOW_BRIDGE_SECRET = "vendora-local-bridge-secret"
  }
  $env:PORT = "4000"
  $bridgeJob = Start-Process -FilePath $bridgeExe -WorkingDirectory $bridgePath -NoNewWindow -RedirectStandardOutput "$root\whatsmeow-bridge\bridge-local.out.log" -RedirectStandardError "$root\whatsmeow-bridge\bridge-local.err.log" -PassThru
  Write-Host "  Bridge PID: $($bridgeJob.Id)" -ForegroundColor Green
  Start-Sleep -Seconds 2
} else {
  Write-Host "[1/3] Skipping whatsmeow bridge" -ForegroundColor Yellow
}

# Start WaCalls (Go sidecar)
if (-not $NoWaCalls -and (Test-Path $wacallsExe)) {
  Write-Host "[2/3] Starting WaCalls (port 8081)..." -ForegroundColor Yellow
  $env:WACALLS_URL = "http://localhost:8081"
  $env:WACALLS_PORT = "8081"
  $env:WACALLS_DB_PATH = $wacallsDb
  $wacallsJob = Start-Process -FilePath $wacallsExe -ArgumentList "-addr", ":8081", "-db", $wacallsDb -WorkingDirectory $wacallsPath -NoNewWindow -RedirectStandardOutput "$root\wacalls\wacalls-local.out.log" -RedirectStandardError "$root\wacalls\wacalls-local.err.log" -PassThru
  Write-Host "  WaCalls PID: $($wacallsJob.Id)" -ForegroundColor Green
  Start-Sleep -Seconds 2
} else {
  Write-Host "[2/3] Skipping WaCalls" -ForegroundColor Yellow
}

# Start Node server
Write-Host "[3/3] Starting Node server (port 3333)..." -ForegroundColor Yellow
Push-Location $root
npm run dev
Pop-Location

# Cleanup on exit
if ($wacallsJob -and -not $wacallsJob.HasExited) {
  Write-Host "Stopping WaCalls..." -ForegroundColor Yellow
  Stop-Process -Id $wacallsJob.Id -Force
}

if ($bridgeJob -and -not $bridgeJob.HasExited) {
  Write-Host "Stopping bridge..." -ForegroundColor Yellow
  Stop-Process -Id $bridgeJob.Id -Force
}

Write-Host "Dev environment stopped." -ForegroundColor Cyan

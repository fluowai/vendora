param(
  [switch]$NoBridge
)

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$bridgePath = Join-Path $root "whatsmeow-bridge"
$bridgeExe = Join-Path $bridgePath "whatsmeow-bridge.exe"

$nodeServer = $null
$bridgeJob = $null

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Vendaora 360 - Dev Environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start whatsmeow bridge (Go sidecar)
if (-not $NoBridge -and (Test-Path $bridgeExe)) {
  Write-Host "[1/2] Starting whatsmeow bridge (port 4000)..." -ForegroundColor Yellow
  $env:WHATSMEOW_DB_PATH = "file:$bridgePath\whatsmeow.db?_pragma=foreign_keys(1)"
  $env:WHATSMEOW_WEBHOOK_URL = "http://localhost:3333/api/integrations/whatsmeow/incoming?tenantId=seed-tenant"
  $env:PORT = "4000"
  $bridgeJob = Start-Process -FilePath $bridgeExe -WorkingDirectory $bridgePath -NoNewWindow -RedirectStandardOutput "$root\server.log" -RedirectStandardError "$root\server.err" -PassThru
  Write-Host "  Bridge PID: $($bridgeJob.Id)" -ForegroundColor Green
  Start-Sleep -Seconds 2
} else {
  Write-Host "[1/2] Skipping whatsmeow bridge" -ForegroundColor Yellow
}

# Start Node server
Write-Host "[2/2] Starting Node server (port 3333)..." -ForegroundColor Yellow
Push-Location $root
npm run dev
Pop-Location

# Cleanup on exit
if ($bridgeJob -and -not $bridgeJob.HasExited) {
  Write-Host "Stopping bridge..." -ForegroundColor Yellow
  Stop-Process -Id $bridgeJob.Id -Force
}

Write-Host "Dev environment stopped." -ForegroundColor Cyan

param(
    [string]$WacallsDir = (Join-Path (Get-Item $PSScriptRoot).Parent.FullName "wacalls"),
    [switch]$BuildOnly
)

$ErrorActionPreference = "Stop"

$WacallsRepo = "https://github.com/JotaDev66/WaCalls.git"

Write-Host "[setup-wacalls] Setting up WaCalls sidecar..." -ForegroundColor Cyan

# Clone if not exists
if (-not (Test-Path $WacallsDir)) {
    Write-Host "[setup-wacalls] Cloning WaCalls from $WacallsRepo" -ForegroundColor Yellow
    git clone $WacallsRepo $WacallsDir
} else {
    Write-Host "[setup-wacalls] WaCalls directory already exists, pulling latest..." -ForegroundColor Yellow
    Push-Location $WacallsDir
    git pull
    Pop-Location
}

# Build
Push-Location $WacallsDir
Write-Host "[setup-wacalls] Building WaCalls server..." -ForegroundColor Yellow
go build -ldflags="-s -w" -o wacalls-server.exe ./cmd/server
if ($LASTEXITCODE -ne 0) {
    Write-Host "[setup-wacalls] Build failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host "[setup-wacalls] WaCalls server built at: $WacallsDir\wacalls-server.exe" -ForegroundColor Green
Write-Host "[setup-wacalls]" -ForegroundColor Green
Write-Host "[setup-wacalls]  AUTO-HOSTING: O 'npm run dev' agora gerencia o WaCalls automaticamente." -ForegroundColor Yellow
Write-Host "[setup-wacalls]  Na proxima vez que rodar 'npm run dev', ele iniciara o WaCalls sozinho." -ForegroundColor Yellow
Write-Host "[setup-wacalls]  Para iniciar manualmente: npm run wacalls:start" -ForegroundColor Yellow
Write-Host "[setup-wacalls]  Ou: cd wacalls && .\wacalls-server.exe -addr :8081 -db wacalls.db" -ForegroundColor Yellow

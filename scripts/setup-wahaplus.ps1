param(
    [string]$WahaplusImage = "devlikeapro/waha-plus",
    [string]$WahaplusPort = "3000",
    [switch]$BuildOnly
)

$ErrorActionPreference = "Stop"

Write-Host "[setup-wahaplus] Setting up WAHA+ (WhatsApp HTTP API Plus)..." -ForegroundColor Cyan

# Check Docker
$dockerVersion = docker --version 2>$null
if (-not $dockerVersion) {
    Write-Host "[setup-wahaplus] Docker not found! Please install Docker first." -ForegroundColor Red
    Write-Host "[setup-wahaplus] Download: https://docs.docker.com/get-docker/" -ForegroundColor Yellow
    exit 1
}

Write-Host "[setup-wahaplus] Docker detected: $dockerVersion" -ForegroundColor Green

# Check if waha-voip repo exists (for local build)
$WahaplusDir = Join-Path (Get-Item $PSScriptRoot).Parent.FullName "wahaplus"
$RepoUrl = "https://github.com/JotaDev66/waha-voip.git"

if ($BuildOnly -or (-not (Test-Path $WahaplusDir))) {
    if (-not (Test-Path $WahaplusDir)) {
        Write-Host "[setup-wahaplus] Cloning waha-voip from $RepoUrl" -ForegroundColor Yellow
        git clone $RepoUrl $WahaplusDir
    } else {
        Write-Host "[setup-wahaplus] waha-voip directory already exists, pulling latest..." -ForegroundColor Yellow
        Push-Location $WahaplusDir
        git pull
        Pop-Location
    }
}

# Pull Docker image
Write-Host "[setup-wahaplus] Pulling WAHA+ Docker image..." -ForegroundColor Yellow
Write-Host "[setup-wahaplus] NOTE: You need a license key for waha-plus." -ForegroundColor Magenta
Write-Host "[setup-wahaplus] Set WAHAPLUS_LICENSE in .env or use the free version: devlikeapro/waha" -ForegroundColor Magenta

docker pull $WahaplusImage 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[setup-wahaplus] Failed to pull $WahaplusImage, trying free version..." -ForegroundColor Yellow
    docker pull devlikeapro/waha 2>$null
    if ($LASTEXITCODE -eq 0) {
        $WahaplusImage = "devlikeapro/waha"
        Write-Host "[setup-wahaplus] Using free version: devlikeapro/waha" -ForegroundColor Green
    } else {
        Write-Host "[setup-wahaplus] Could not pull any WAHA image. Check your network and Docker login." -ForegroundColor Red
        exit 1
    }
}

Write-Host "[setup-wahaplus] WAHA+ Docker image ready: $WahaplusImage" -ForegroundColor Green
Write-Host "[setup-wahaplus]" -ForegroundColor Green
Write-Host "[setup-wahaplus] Run manually with:" -ForegroundColor Yellow
Write-Host "[setup-wahaplus]   docker run -d --name vendora-wahaplus -p $WahaplusPort`:3000 $WahaplusImage" -ForegroundColor White
Write-Host "[setup-wahaplus]" -ForegroundColor Green
Write-Host "[setup-wahaplus] Or configure .env with:" -ForegroundColor Yellow
Write-Host "[setup-wahaplus]   WAHAPLUS_URL=http://localhost:$WahaplusPort" -ForegroundColor White
Write-Host "[setup-wahaplus]   WAHAPLUS_PORT=$WahaplusPort" -ForegroundColor White
Write-Host "[setup-wahaplus]   WAHAPLUS_IMAGE=$WahaplusImage" -ForegroundColor White
Write-Host "[setup-wahaplus]" -ForegroundColor Green
Write-Host "[setup-wahaplus] Then start the app: npm run dev" -ForegroundColor Yellow

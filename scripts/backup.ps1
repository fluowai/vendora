param(
  [string]$OutputDir = "./backups",
  [string]$DbUrl = $env:DATABASE_URL,
  [int]$RetentionDays = 30
)

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $projectRoot $OutputDir

if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Write-Host "[Backup] Iniciando backup do Vendaora 360..." -ForegroundColor Cyan

if ($DbUrl -like "file:*") {
  # ---- SQLite ----
  $dbPath = $DbUrl -replace "^file:", ""
  if (-not [System.IO.Path]::IsPathRooted($dbPath)) {
    $dbPath = Join-Path $projectRoot $dbPath
  }
  if (Test-Path $dbPath) {
    $dest = Join-Path $outputDir "vendaora_sqlite_$timestamp.db"
    Copy-Item $dbPath $dest
    Write-Host "[Backup] SQLite salvo em: $dest" -ForegroundColor Green

    $destZip = Join-Path $outputDir "vendaora_sqlite_$timestamp.zip"
    Compress-Archive -Path $dbPath -DestinationPath $destZip -CompressionLevel Optimal
    Write-Host "[Backup] SQLite compactado em: $destZip" -ForegroundColor Green
  } else {
    Write-Host "[Backup] ERRO: Banco SQLite não encontrado em $dbPath" -ForegroundColor Red
  }
} elseif ($DbUrl -like "postgresql://*" -or $DbUrl -like "postgres://*") {
  # ---- PostgreSQL ----
  $outputFile = Join-Path $outputDir "vendaora_pgsql_$timestamp.sql"
  $env:PGPASSWORD = ""
  $connString = $DbUrl
  if ($env:PGPASSWORD) { $env:PGPASSWORD = $env:PGPASSWORD }

  $dumpCmd = "pg_dump `"$connString`" --no-owner --no-acl -f `"$outputFile`""
  Write-Host "[Backup] Executando pg_dump..." -ForegroundColor Yellow
  Invoke-Expression $dumpCmd

  if ($LASTEXITCODE -eq 0) {
    Write-Host "[Backup] PostgreSQL dump salvo em: $outputFile" -ForegroundColor Green

    $gzipped = "$outputFile.gz"
    if (Get-Command gzip -ErrorAction SilentlyContinue) {
      gzip -f $outputFile
      Write-Host "[Backup] Compactado: $gzipped" -ForegroundColor Green
    }
  } else {
    Write-Host "[Backup] ERRO: pg_dump falhou (código $LASTEXITCODE)" -ForegroundColor Red
    Write-Host "[Backup] Verifique se o PostgreSQL Client Tools está instalado." -ForegroundColor Yellow
  }
} else {
  Write-Host "[Backup] ERRO: DATABASE_URL não reconhecida: $DbUrl" -ForegroundColor Red
  exit 1
}

# Limpeza de backups antigos
$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem $outputDir -Filter "vendaora_*" | Where-Object {
  $_.CreationTime -lt $cutoff
} | ForEach-Object {
  Remove-Item $_.FullName -Force
  Write-Host "[Backup] Removido backup antigo: $($_.Name)" -ForegroundColor DarkYellow
}

Write-Host "[Backup] Concluído!" -ForegroundColor Cyan

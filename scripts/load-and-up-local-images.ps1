$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$frontendTar = Join-Path $root 'docker-images/vitashelf-frontend-local.tar'
$backendTar = Join-Path $root 'docker-images/vitashelf-backend-local.tar'
$composeFile = Join-Path $root 'docker-compose.local-images.yml'

if (-not (Test-Path $frontendTar)) {
  throw "Missing frontend image tar: $frontendTar"
}

if (-not (Test-Path $backendTar)) {
  throw "Missing backend image tar: $backendTar"
}

if (-not (Test-Path $composeFile)) {
  throw "Missing compose file: $composeFile"
}

if (-not $env:JWT_SECRET -or $env:JWT_SECRET.Length -lt 32) {
  $env:JWT_SECRET = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
  Write-Host 'JWT_SECRET was missing/too short; generated a temporary 48-char secret for this run.'
}

Write-Host 'Loading frontend image tar...'
docker load -i $frontendTar | Out-Host

Write-Host 'Loading backend image tar...'
docker load -i $backendTar | Out-Host

Write-Host 'Starting containers...'
docker compose -f $composeFile up -d --remove-orphans | Out-Host

Write-Host ''
Write-Host 'Container status:'
docker compose -f $composeFile ps | Out-Host

Write-Host ''
Write-Host 'Done. Frontend: http://localhost  Backend health: http://localhost:4000/health'

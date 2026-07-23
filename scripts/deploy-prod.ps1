# Production deploy helper (Windows)
param(
    [switch]$Down,
    [switch]$Seed
)

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$EnvFile = Join-Path $Root ".env.prod"
if (-not (Test-Path $EnvFile)) {
    Copy-Item (Join-Path $Root ".env.prod.example") $EnvFile
    Write-Host "Created .env.prod from example. Edit secrets, then re-run." -ForegroundColor Yellow
    exit 1
}

if ($Down) {
    docker compose -f docker-compose.prod.yml --env-file .env.prod down
    exit $LASTEXITCODE
}

if ($Seed) {
    $env:RUN_SEED = "1"
}

Write-Host "Building and starting production stack..." -ForegroundColor Cyan
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Waiting for health..." -ForegroundColor Cyan
$ok = $false
for ($i = 0; $i -lt 40; $i++) {
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1/api/health/" -TimeoutSec 3
        if ($r.status -eq "ok") {
            $ok = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 3
    }
    Start-Sleep -Seconds 3
}

if ($ok) {
    Write-Host "CRM is up: http://127.0.0.1/" -ForegroundColor Green
    Write-Host "Health:  http://127.0.0.1/api/health/" -ForegroundColor Green
} else {
    Write-Host "Stack started but health check timed out. Check logs:" -ForegroundColor Yellow
    Write-Host "  docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=80"
}

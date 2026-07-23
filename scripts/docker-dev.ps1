# Start Postgres + Redis, then run Django locally against them (recommended dev flow on Windows).
# For full production stack (nginx + frontend + backend), see DEPLOY.md / scripts/deploy-prod.ps1
param(
    [switch]$FullStack
)

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "Starting Postgres + Redis..." -ForegroundColor Cyan
docker compose up -d postgres redis

if ($FullStack) {
    Write-Host "Building and starting backend + Celery..." -ForegroundColor Cyan
    docker compose --profile app up -d --build
    Write-Host ""
    Write-Host "Seed demo data (first time):" -ForegroundColor Yellow
    Write-Host "  docker compose --profile app exec backend python manage.py seed"
    Write-Host ""
    Write-Host "API: http://127.0.0.1:8000/api/health/" -ForegroundColor Green
    Write-Host "Production (UI+API+nginx): see DEPLOY.md" -ForegroundColor Cyan
    exit 0
}

Write-Host ""
Write-Host "Postgres + Redis are up. Run backend locally:" -ForegroundColor Green
Write-Host @"

  cd CRM_Backend
  `$env:USE_POSTGRES='1'
  `$env:POSTGRES_HOST='127.0.0.1'
  `$env:REDIS_URL='redis://127.0.0.1:6379/0'
  `$env:CELERY_ALWAYS_EAGER='0'
  python manage.py migrate
  python manage.py seed
  python manage.py runserver 8000

"@

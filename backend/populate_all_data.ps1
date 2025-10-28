# PowerShell script to populate all data to Supabase
# Run this script to populate no parking zones, incident prone areas, and all other data

Write-Host "🚀 Las Piñas Traffic Management - Supabase Data Population" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if virtual environment exists
if (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "✅ Activating virtual environment..." -ForegroundColor Green
    & "venv\Scripts\Activate.ps1"
} else {
    Write-Host "⚠️  Virtual environment not found. Using global Python..." -ForegroundColor Yellow
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ Error: .env file not found!" -ForegroundColor Red
    Write-Host "   Please create a .env file with your DATABASE_URL" -ForegroundColor Yellow
    Write-Host "   Example: DATABASE_URL=postgresql://user:pass@db.xxx.supabase.co:5432/postgres" -ForegroundColor Yellow
    exit 1
}

Write-Host "📋 Step 1: Verifying database connection..." -ForegroundColor Cyan
python verify_supabase_data.py

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Database connection failed! Check your .env file." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📊 Step 2: Populating all data..." -ForegroundColor Cyan
python populate_supabase.py

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Data population failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔍 Step 3: Verifying populated data..." -ForegroundColor Cyan
python verify_supabase_data.py

Write-Host ""
Write-Host "✅ Data population completed!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan

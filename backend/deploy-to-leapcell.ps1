# PowerShell script to deploy to Leapcell
Write-Host "🚀 Deploying Traffic Management Backend to Leapcell..." -ForegroundColor Green

# Check if Node.js is installed (for leapcell CLI)
$nodeExists = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeExists) {
    Write-Host "❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Check if leapcell CLI is installed
$leapcellExists = Get-Command leapcell -ErrorAction SilentlyContinue
if (-not $leapcellExists) {
    Write-Host "❌ Leapcell CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "npm install -g @leapcell/cli" -ForegroundColor Yellow
    exit 1
}

# Login to Leapcell (if not already logged in)
Write-Host "🔐 Please login to Leapcell..." -ForegroundColor Blue
leapcell login

# Create PostgreSQL database
Write-Host "🗄️ Creating PostgreSQL database..." -ForegroundColor Blue
leapcell service create postgres --name leapcell_db --version 15

# Get database connection details
Write-Host "📝 Getting database connection details..." -ForegroundColor Blue
$dbInfo = leapcell service info leapcell_db --format json | ConvertFrom-Json
$dbUrl = $dbInfo.connection_url
Write-Host "📝 Database URL: $dbUrl" -ForegroundColor Green

# Update .env file with database URL (create if doesn't exist)
if (-not (Test-Path .env)) {
    if (Test-Path .env.example) {
        Copy-Item .env.example .env
        Write-Host "📝 Created .env file from .env.example" -ForegroundColor Green
    } else {
        New-Item .env -ItemType File
        Write-Host "📝 Created new .env file" -ForegroundColor Green
    }
}

# Replace database URL in .env
(Get-Content .env) -replace 'DATABASE_URL=.*', "DATABASE_URL=$dbUrl" | Set-Content .env
Write-Host "🔧 Updated .env file with database connection" -ForegroundColor Green

# Deploy the service
Write-Host "🚀 Deploying to Leapcell..." -ForegroundColor Blue
Write-Host "📋 Using corrected start command: python -m uvicorn app.main:app --host 0.0.0.0 --port 8000" -ForegroundColor Cyan
leapcell deploy --config leapcell-config.yaml

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "📋 Your backend will be available at: https://your-service-name.leapcell.dev" -ForegroundColor Cyan
Write-Host "🔗 Update your frontend env.example with the new backend URL" -ForegroundColor Cyan

# Show service info
Write-Host "📊 Service information:" -ForegroundColor Blue
leapcell service info

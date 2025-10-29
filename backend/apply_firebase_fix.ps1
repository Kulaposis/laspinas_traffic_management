# Apply Firebase UID constraint fix to remote database
# This script connects to the Leapcell PostgreSQL database and applies the fix

Write-Host "Applying Firebase UID constraint fix..." -ForegroundColor Cyan

# Load environment variables
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*?)\s*=\s*(.*?)\s*$') {
            $name = $matches[1]
            $value = $matches[2]
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$DATABASE_URL = $env:DATABASE_URL

if (-not $DATABASE_URL) {
    Write-Host "ERROR: DATABASE_URL not found in environment" -ForegroundColor Red
    exit 1
}

Write-Host "Database URL: $($DATABASE_URL.Substring(0, 30))..." -ForegroundColor Gray

# Apply the SQL fix
Write-Host "Applying SQL migration..." -ForegroundColor Yellow
psql $DATABASE_URL -f fix_firebase_uid_constraint.sql

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Firebase UID constraint fix applied successfully!" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to apply fix. Error code: $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Restart the backend server" -ForegroundColor White
Write-Host "2. Test Firebase login again" -ForegroundColor White

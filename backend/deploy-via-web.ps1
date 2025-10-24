# Manual deployment instructions for Leapcell
Write-Host "🚀 Manual Deployment to Leapcell (Web Interface)" -ForegroundColor Green
Write-Host ""
Write-Host "Since CLI is not available via npm, use the web interface:" -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 Step-by-Step Instructions:" -ForegroundColor Cyan
Write-Host "1. Go to https://leapcell.io" -ForegroundColor White
Write-Host "2. Sign up/Login with GitHub" -ForegroundColor White
Write-Host "3. Click 'Get Started With GitHub'" -ForegroundColor White
Write-Host "4. Connect your GitHub repository: https://github.com/Kulaposis/laspinas_traffic_management" -ForegroundColor White
Write-Host "5. Select the backend directory as root" -ForegroundColor White
Write-Host "6. Configure build settings:" -ForegroundColor White
Write-Host "   - Runtime: Python 3.11" -ForegroundColor White
Write-Host "   - Framework: FastAPI" -ForegroundColor White
Write-Host "   - Build Command: bash build.sh" -ForegroundColor White
Write-Host "   - Start Command: python app.py" -ForegroundColor White
Write-Host "7. Add environment variables from .env.example" -ForegroundColor White
Write-Host "8. Deploy!" -ForegroundColor White
Write-Host ""
Write-Host "📁 Your repository is ready with all configuration files!" -ForegroundColor Green
Write-Host "📄 Check LEAPCELL_DEPLOYMENT.md for detailed instructions" -ForegroundColor Cyan

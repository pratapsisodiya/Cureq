# PowerShell Start Script for CureQ

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  🚀 Starting CureQ Platform (Frontend + Backend)" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📦 Launching Backend Server on port 5000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location backend; npm run dev"

Write-Host "🖥️ Launching Frontend Application on port 3001..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location frontend; npm run dev"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host "  🎉 Success! Both servers launched in new windows." -ForegroundColor Green
Write-Host "  - Backend: http://localhost:5000" -ForegroundColor Green
Write-Host "  - Frontend: http://localhost:3001" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green

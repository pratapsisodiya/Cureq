@echo off
title CureQ Launcher
echo ===================================================
echo   🚀 Starting CureQ Platform (Frontend + Backend)
echo ===================================================
echo.

echo 📦 Launching Backend Server on port 5000...
start "CureQ Backend Server" cmd /k "cd backend && npm run dev"

echo 🖥️ Launching Frontend Application on port 3001...
start "CureQ Frontend Client" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo   🎉 Success! Both servers launched in new windows.
echo   - Backend: http://localhost:5000
echo   - Frontend: http://localhost:3001
echo ===================================================
pause

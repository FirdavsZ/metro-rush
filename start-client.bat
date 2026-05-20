@echo off
title Metro Rush - Frontend
cd /d "%~dp0client"
echo Starting Metro Rush frontend...
echo App will open on http://localhost:5173
echo.
npm run dev
pause

@echo off
title Metro Rush - Backend Server
cd /d "%~dp0server"
echo Starting Metro Rush backend...
echo Server will run on http://localhost:5000
echo.
npm run dev
pause

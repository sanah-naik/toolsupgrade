@echo off
REM ============================================
REM  Run Upgrade Server as Administrator
REM ============================================

echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║     Upgrade Server - Administrator Launcher               ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

REM Check if already running as admin
net session >nul 2>&1
if %errorLevel% == 0 (
    echo ✓ Running as Administrator
    echo.
    echo Starting upgrade server...
    echo.
    node server.mjs
    pause
) else (
    echo ✗ NOT running as Administrator
    echo.
    echo Requesting administrator privileges...
    echo Please click "Yes" on the UAC prompt
    echo.
    
    REM Request admin privileges and restart
    powershell -Command "Start-Process cmd -ArgumentList '/c cd /d %CD% && node server.mjs && pause' -Verb RunAs"
)
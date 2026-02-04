@echo off
REM Development server starter for Windows
REM Automatically installs dependencies and starts live reload server

echo ========================================
echo   Discgolf Dev Server - Live Reload
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python from https://www.python.org/
    pause
    exit /b 1
)

REM Install/upgrade dependencies
echo Installing dependencies...
python -m pip install --upgrade pip >nul 2>&1
python -m pip install -r requirements-dev.txt

echo.
echo Starting development server...
echo If you see port 8080 instead of 3000, something is wrong!
echo Expected: http://localhost:3000
echo.

REM Start the dev server
echo Running: python dev-server.py
python dev-server.py

pause

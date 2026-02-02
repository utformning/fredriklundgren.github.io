@echo off
REM Simple server without live reload
REM Just starts a basic HTTP server on port 8080

echo ========================================
echo   Discgolf Simple Server (Port 8080)
echo ========================================
echo.
echo Starting server...
echo Open in browser: http://localhost:8080
echo.
echo Press Ctrl+C to stop the server
echo.

python -m http.server 8080

pause

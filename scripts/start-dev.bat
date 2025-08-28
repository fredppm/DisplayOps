@echo off
echo Starting Office TV Management System - Development Mode
echo.

echo Installing dependencies...
echo.

echo [1/3] Installing host-agent dependencies...
cd host-agent
call npm install
if %errorlevel% neq 0 (
    echo Error installing host-agent dependencies
    pause
    exit /b 1
)

echo [2/3] Installing web-controller dependencies...
cd ..\web-controller
call npm install
if %errorlevel% neq 0 (
    echo Error installing web-controller dependencies
    pause
    exit /b 1
)

echo [3/3] Starting development servers...
echo.

echo Starting web controller (NextJS)...
start "Web Controller" cmd /k "cd /d %~dp0..\web-controller && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting host agent (Electron)...
start "Host Agent" cmd /k "cd /d %~dp0..\host-agent && npm run dev"

echo.
echo Both services are starting...
echo Web Controller: http://localhost:3000
echo Host Agent API: http://localhost:8080
echo.
echo Press any key to exit...
pause >nul

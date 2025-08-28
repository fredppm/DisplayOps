@echo off
echo.
echo ========================================
echo  Phase 2 Browser Automation Test
echo ========================================
echo.

echo Starting Phase 2 comprehensive testing...
echo.

cd /d "%~dp0"

REM Check if node is available
node --version > nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js to run the tests
    pause
    exit /b 1
)

REM Run the Phase 2 test script
echo Running Phase 2 feature tests...
node test-phase2-features.js

echo.
echo Phase 2 testing completed!
echo.
pause

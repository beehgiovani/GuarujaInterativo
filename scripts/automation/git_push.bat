@echo off
echo ==========================================
echo      GuaruGeo - Git Push Automation
echo ==========================================
echo.

:: Check status first
echo [1/4] Checking Status...
git status
echo.

:: Ask for commit message
set /p commit_msg="Enter commit message: "

if "%commit_msg%"=="" (
    echo.
    echo Error: Commit message cannot be empty.
    echo.
    pause
    exit /b
)

echo.
echo [2/4] Adding files...
git add .

echo.
echo [3/4] Committing...
git commit -m "%commit_msg%"

echo.
echo [4/4] Pushing to GitHub...
git push

echo.
if %ERRORLEVEL% EQU 0 (
    echo ==========================================
    echo      SUCCESS! Changes pushed to GitHub
    echo ==========================================
) else (
    echo ==========================================
    echo      ERROR: Push failed
    echo ==========================================
)

pause

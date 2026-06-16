@echo off
setlocal enabledelayedexpansion
title YOLOVision Studio
cd /d "%~dp0"

echo ==========================================
echo    YOLOVision Studio
echo ==========================================
echo.

:: Find a working Python with uvicorn
set "PYTHON="

:: 1. Try system python first
where python >nul 2>&1
if %errorlevel% equ 0 (
    for /f "delims=" %%p in ('where python') do (
        "%%p" -c "import uvicorn" >nul 2>&1
        if !errorlevel! equ 0 (
            set "PYTHON=%%p"
            goto :found_python
        )
    )
)

:: 2. Try common install paths
for %%d in (
    "C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python312"
    "C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311"
    "C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python313"
    "C:\Python312" "C:\Python311" "C:\Python313"
) do (
    if exist "%%~d\python.exe" (
        "%%~d\python.exe" -c "import uvicorn" >nul 2>&1
        if !errorlevel! equ 0 (
            set "PYTHON=%%~d\python.exe"
            goto :found_python
        )
    )
)

:: 3. Try embedded python_runtime
if exist "python_runtime\python.exe" (
    echo [*] No Python with uvicorn found in system.
    echo [*] Trying embedded Python...
    "python_runtime\python.exe" -c "import uvicorn" >nul 2>&1
    if !errorlevel! neq 0 (
        echo [*] Installing dependencies into embedded Python...
        "python_runtime\python.exe" -m pip install -r backend\requirements.txt -q
        "python_runtime\python.exe" -c "import uvicorn" >nul 2>&1
        if !errorlevel! neq 0 (
            echo [ERROR] Failed to install dependencies.
            echo Please install Python 3.11+ from https://python.org
            pause
            exit /b 1
        )
    )
    set "PYTHON=python_runtime\python.exe"
    goto :found_python
)

echo [ERROR] Python not found. Please install Python 3.11+.
echo Download: https://www.python.org/downloads/
echo Make sure to check "Add Python to PATH" during install.
pause
exit /b 1

:found_python
echo [*] Python: %PYTHON%

:: Check Node.js (needed for frontend)
where npx >nul 2>&1
if %errorlevel% neq 0 (
    where npx.cmd >nul 2>&1
    if %errorlevel% neq 0 (
        echo [WARNING] Node.js/npx not found. Frontend will fail.
        echo Install Node.js from https://nodejs.org
    )
)

echo [*] Starting YOLOVision Studio...
echo.
"%PYTHON%" launcher.py
exit

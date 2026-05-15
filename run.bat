@echo off
REM ============================================================
REM GITPUSH — Local run script for Windows
REM Usage: Double-click run.bat  OR  run it from CMD
REM ============================================================

where python >nul 2>&1
IF ERRORLEVEL 1 (
    echo ERROR: Python not found. Install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

IF NOT EXIST .env (
    echo No .env found — copying from .env.example
    copy .env.example .env
    echo.
    echo   Open .env and set your GITHUB_TOKEN before continuing.
    echo   Then double-click run.bat again.
    echo.
    pause
    exit /b 0
)

IF NOT EXIST venv (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo Installing dependencies...
pip install -q -r requirements.txt

echo.
echo   GITPUSH starting at http://localhost:5000
echo   Press Ctrl+C to stop
echo.
python app.py
pause

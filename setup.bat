@echo off
REM ============================================================
REM  Recommended installer (uses .venv virtual environment)
REM  Keeps this project's deps isolated from your system Python.
REM ============================================================
setlocal

echo === Checking Python ===
where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python is not on PATH. Install Python 3.10+ first:
    echo         https://www.python.org/downloads/
    exit /b 1
)
python --version

echo.
echo === Creating virtual environment in .venv ===
if exist .venv (
    echo [SKIP] .venv already exists.
) else (
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Failed to create .venv
        exit /b 1
    )
)

echo.
echo === Activating virtual environment ===
call .venv\Scripts\activate.bat

echo.
echo === Upgrading pip ===
python -m pip install --upgrade pip

echo.
echo === Installing dependencies (~700 MB; 5-10 min) ===
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Install failed.
    exit /b 1
)

echo.
echo ============================================================
echo  Setup complete. To run the app:
echo      .venv\Scripts\activate.bat
echo      python app.py
echo.
echo  Browser opens automatically at http://127.0.0.1:8000
echo ============================================================
endlocal

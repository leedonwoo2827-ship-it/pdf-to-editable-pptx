@echo off
REM ============================================================
REM  Start the app. Browser opens automatically.
REM
REM  Expects .venv to be set up (run setup.bat once first).
REM  Logic:
REM    1) If .venv exists AND has all deps   -> use .venv\python.exe
REM    2) Else if system python has all deps -> use system python
REM    3) Else                               -> tell user to run setup.bat
REM
REM  This avoids the trap where a stale .venv (e.g. created by an
REM  unsupported Python version) hijacks the launch.
REM ============================================================
setlocal EnableDelayedExpansion

set "PYTHON_CMD="

REM ---- 1) Try .venv if present ----
if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe -c "import uvicorn, fastapi, fitz, easyocr, simple_lama_inpainting" >nul 2>nul
    if not errorlevel 1 (
        set "PYTHON_CMD=.venv\Scripts\python.exe"
        echo Using virtual environment in .venv
    ) else (
        echo [WARN] .venv exists but is missing required packages.
        echo        Falling back to system Python. ^(Delete .venv and re-run setup.bat to clear this.^)
    )
)

REM ---- 2) Try system python ----
if "!PYTHON_CMD!"=="" (
    where python >nul 2>nul
    if errorlevel 1 (
        echo.
        echo [ERROR] Python is not on PATH.
        echo         Install Python 3.10-3.12 and run setup.bat first.
        echo         See docs\install.md for the full guide.
        pause
        exit /b 1
    )
    python -c "import uvicorn, fastapi, fitz, easyocr, simple_lama_inpainting" >nul 2>nul
    if not errorlevel 1 (
        set "PYTHON_CMD=python"
        echo Using system Python
    )
)

REM ---- 3) Nothing works -> point at setup.bat / install.bat ----
if "!PYTHON_CMD!"=="" (
    echo.
    echo [ERROR] Required dependencies are not installed.
    echo         Run setup.bat ^(recommended^) or install.bat ^(advanced^) first.
    echo         See docs\install.md for the difference.
    pause
    exit /b 1
)

echo.
!PYTHON_CMD! --version
echo Starting server at http://127.0.0.1:8000
echo Press Ctrl+C to stop.
echo.
!PYTHON_CMD! app.py

if errorlevel 1 (
    echo.
    echo Server stopped with an error.
    pause
)
endlocal

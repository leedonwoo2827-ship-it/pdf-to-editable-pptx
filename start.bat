@echo off
REM ============================================================
REM  Start the app. Browser opens automatically.
REM
REM  Logic:
REM    1) If .venv exists AND has all deps   -> use .venv\python.exe
REM    2) Else if system python has all deps -> use system python
REM    3) Else                               -> run install.bat first
REM
REM  This avoids the trap where a stale .venv (e.g. created by an
REM  unsupported Python version) hijacks the launch.
REM ============================================================
setlocal EnableDelayedExpansion

set "PYTHON_CMD="

REM ---- 1) Try .venv if present ----
if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe -c "import uvicorn, fastapi, fitz, rapidocr_onnxruntime, simple_lama_inpainting" >nul 2>nul
    if not errorlevel 1 (
        set "PYTHON_CMD=.venv\Scripts\python.exe"
        echo Using virtual environment in .venv
    ) else (
        echo [WARN] .venv exists but is missing required packages.
        echo        Falling back to system Python. ^(Delete .venv to clear this warning.^)
    )
)

REM ---- 2) Try system python ----
if "!PYTHON_CMD!"=="" (
    where python >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] Python is not on PATH.
        echo Install Python 3.10-3.12 first: https://www.python.org/downloads/
        pause
        exit /b 1
    )
    python -c "import uvicorn, fastapi, fitz, rapidocr_onnxruntime, simple_lama_inpainting" >nul 2>nul
    if not errorlevel 1 (
        set "PYTHON_CMD=python"
        echo Using system Python
    )
)

REM ---- 3) If nothing works, install ----
if "!PYTHON_CMD!"=="" (
    echo.
    echo [INFO] Required dependencies are not installed yet.
    echo        Running install.bat ...
    echo.
    call install.bat
    if errorlevel 1 (
        echo.
        echo [ERROR] Install failed. See messages above.
        pause
        exit /b 1
    )
    set "PYTHON_CMD=python"
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

@echo off
REM ============================================================
REM  Start the app. Browser opens automatically.
REM
REM  - If .venv exists (from setup.bat), it is activated first.
REM  - If dependencies are missing, install.bat is invoked
REM    automatically before launching.
REM ============================================================
setlocal

if exist .venv\Scripts\activate.bat (
    echo Activating .venv ...
    call .venv\Scripts\activate.bat
)

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python is not on PATH.
    echo Install Python 3.10+ first: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo Using Python:
python --version

REM Check that the core dep is importable in the active Python.
python -c "import uvicorn, fastapi, fitz, rapidocr_onnxruntime, simple_lama_inpainting" >nul 2>nul
if errorlevel 1 (
    echo.
    echo [INFO] Required dependencies are not installed in this Python.
    echo        Running install.bat now...
    echo.
    call install.bat
    if errorlevel 1 (
        echo [ERROR] Auto-install failed. See messages above.
        pause
        exit /b 1
    )
)

echo.
echo Starting server at http://127.0.0.1:8000
echo Press Ctrl+C to stop.
echo.
python app.py

if errorlevel 1 (
    echo.
    echo Server stopped with an error.
    pause
)
endlocal

@echo off
REM ============================================================
REM  Simple installer (no virtual environment)
REM  Installs all deps into the current Python.
REM  For an isolated install with .venv, use setup.bat instead.
REM ============================================================
setlocal

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python is not on PATH. Install Python 3.10-3.12 first:
    echo         https://www.python.org/downloads/
    exit /b 1
)

echo Using Python:
python --version

REM rapidocr_onnxruntime currently has no wheels for Python 3.13+.
REM Refuse to install on unsupported versions instead of failing
REM cryptically halfway through.
python -c "import sys; raise SystemExit(0 if (3,10) <= sys.version_info < (3,13) else 1)" >nul 2>nul
if errorlevel 1 (
    echo.
    echo [ERROR] This project requires Python 3.10, 3.11, or 3.12.
    echo         The active 'python' is something else.
    echo         Install a supported version and ensure it is first on PATH.
    echo         https://www.python.org/downloads/
    exit /b 1
)

echo.
echo Installing dependencies (~700 MB total: torch CPU + ONNX OCR + ...)
echo This may take 5-10 minutes on a fresh machine.
echo.
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo [ERROR] Install failed. See messages above.
    exit /b 1
)

echo.
echo ============================================================
echo  Done. Run the app with:
echo      start.bat        (recommended)
echo   or  python app.py
echo.
echo  Browser opens automatically at http://127.0.0.1:8000
echo ============================================================
endlocal

@echo off
REM ============================================================
REM  Advanced installer — installs into the CURRENT (system) Python.
REM
REM  Use this ONLY if you already have a compatible PyTorch on your
REM  system Python and want to avoid re-downloading ~200 MB into a
REM  fresh venv. For most users, setup.bat (which creates .venv) is
REM  the right choice.
REM
REM  Tradeoff:
REM    setup.bat   — isolated .venv, predictable, ~700 MB download
REM    install.bat — shares system Python with other projects;
REM                  reuses any deps already there;
REM                  small chance of breaking other projects if
REM                  versions conflict.
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

REM Several deps in the conversion pipeline (easyocr's transitive deps,
REM simple_lama_inpainting + torch combos) only have wheels for Python
REM 3.10-3.12 right now. Refuse to install on unsupported versions
REM instead of failing cryptically halfway through.
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
echo ============================================================
echo  WARNING: install.bat installs into your SYSTEM Python.
echo.
echo  Recommended use: you already have a compatible PyTorch
echo  installed and want to reuse it instead of downloading
echo  another ~200 MB into a fresh .venv.
echo.
echo  For a clean isolated install, use setup.bat instead.
echo  Press Ctrl+C now to abort, or wait 5 seconds to continue.
echo ============================================================
timeout /t 5 /nobreak >nul

REM Probe what's already there so the user can see what install.bat
REM is actually skipping.
echo.
echo === Existing packages on this Python ===
python -c "import torch; print('  torch     :', torch.__version__)" 2>nul || echo   torch     : not installed (will download ~200 MB)
python -c "import easyocr; print('  easyocr   : present')" 2>nul || echo   easyocr   : not installed (will download)
python -c "import simple_lama_inpainting; print('  simple_lama_inpainting: present')" 2>nul || echo   simple_lama_inpainting: not installed

echo.
echo === Installing dependencies ===
echo Anything already installed will be skipped by pip.
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

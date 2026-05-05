@echo off
REM ============================================================
REM  Start the app. Browser opens automatically.
REM
REM  - If you used setup.bat, this auto-activates the .venv.
REM  - If you used install.bat, this just runs python app.py.
REM ============================================================
setlocal

if exist .venv\Scripts\activate.bat (
    echo Activating .venv ...
    call .venv\Scripts\activate.bat
)

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python is not on PATH. Run install.bat or setup.bat first.
    pause
    exit /b 1
)

echo.
echo Starting server at http://127.0.0.1:8000
echo Press Ctrl+C to stop.
echo.
python app.py

REM Keep the window open if python.exe exited with an error.
if errorlevel 1 (
    echo.
    echo Server stopped with an error.
    pause
)
endlocal

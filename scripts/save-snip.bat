@echo off
REM ============================================================
REM  save-snip.bat
REM  Thin wrapper so cmd users can call save-snip without typing
REM  the powershell -File ... incantation every time.
REM
REM  Usage:
REM    scripts\save-snip usage-01-home
REM    scripts\save-snip usage-04-progress "%USERPROFILE%\Pictures\Screenshots\Screenshot.png"
REM
REM  See scripts\save-snip.ps1 for full help.
REM ============================================================
setlocal

if "%~1"=="" (
    echo.
    echo Usage: save-snip ^<name^> [optional_source_png]
    echo.
    echo Examples:
    echo   save-snip usage-01-home
    echo       Saves the current clipboard image to docs\images\usage-01-home.png
    echo       Take screenshot first with Win+Shift+S so the image is in clipboard.
    echo.
    echo   save-snip usage-04-progress "C:\Users\me\Pictures\foo.png"
    echo       Copies the given PNG file to docs\images\usage-04-progress.png
    echo.
    echo See docs\images\README.md for the full list of expected filenames.
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0save-snip.ps1" -Name "%~1" %2

endlocal

@echo off
REM ===  Double-click on Windows to start the K-Pop Stage  ===
REM The webcam only works over http://localhost, not from a file:// path.
REM This tries Python first, then Node's npx serve as a fallback.

cd /d "%~dp0"
set PORT=8000

echo Starting K-Pop Stage on http://localhost:%PORT%
echo (Leave this window open during the party. Close it to stop.)
echo.

REM Open the browser shortly after the server starts.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:%PORT%/"

where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)

where npx >nul 2>nul
if %errorlevel%==0 (
  npx --yes serve -l %PORT%
  goto :eof
)

echo.
echo Could not find Python or Node.
echo Please install Python from https://www.python.org/downloads/ ^(check "Add to PATH"^),
echo then double-click this file again.
pause

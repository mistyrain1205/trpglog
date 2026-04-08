@echo off
setlocal
cd /d "%~dp0"

echo [Cocofolia Log Editor - Starter]
echo ---------------------------------
echo サーバーを起動しています...
echo.

:: 1. Try Python (Commonly installed)
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo Python http.server を使用して起動します (http://localhost:8000)
    start "" "http://localhost:8000"
    python -m http.server 8000
    goto end
)

:: 2. Try npx (If Node.js is installed)
where npx >nul 2>nul
if %errorlevel% equ 0 (
    echo npx serve を使用して起動します (http://localhost:3000)
    start "" "http://localhost:3000"
    npx -y serve .
    goto end
)

:: 3. Fallback to double-click (Some features like localStorage might work, but some browsers block file://)
echo サーバーの起動に必要な環境 (Python または Node.js) が見つかりませんでした。
echo 直接ブラウザでファイルを開きます (一部の機能が制限される可能性があります)。
pause
start index.html

:end
pause

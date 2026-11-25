@echo off
cd /d "%~dp0\.."
echo Iniciando Antigravity Remote Control v2 Daemon...
npm run daemon:start
pause

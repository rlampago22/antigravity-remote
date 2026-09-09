@echo off
title Desativar Inicializacao Automatica
echo Removendo inicializacao automatica...

del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\AntigravityRemote.lnk" 2>nul

echo [CONCLUIDO] A inicializacao automatica foi desativada.
echo.
pause

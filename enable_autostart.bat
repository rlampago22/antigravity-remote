@echo off
title Ativar Inicializacao Automatica
cd /d "%~dp0"

echo Configurando para iniciar automaticamente com o Windows...

powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s = $ws.CreateShortcut(\"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\AntigravityRemote.lnk\"); " ^
  "$s.TargetPath = 'wscript.exe'; " ^
  "$s.Arguments = '\"%~dp0run_silent.vbs\"'; " ^
  "$s.WorkingDirectory = '%~dp0'; " ^
  "$s.Save();"

if %errorlevel% equ 0 (
    echo.
    echo [SUCESSO] O Antigravity Remote agora iniciara automaticamente sempre que o notebook ligar!
    echo Ele roda em segundo plano de forma invisivel.
) else (
    echo [ERRO] Nao foi possivel configurar o atalho de inicializacao.
)
echo.
pause

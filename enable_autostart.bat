@echo off
title Ativar Inicializacao Automatica
cd /d "%~dp0"

echo Configurando inicializacao automatica com o Windows...

powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s = $ws.CreateShortcut(\"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\AntigravityRemote.lnk\"); " ^
  "$s.TargetPath = 'wscript.exe'; " ^
  "$s.Arguments = '\"%~dp0run_silent.vbs\"'; " ^
  "$s.WorkingDirectory = '%~dp0'; " ^
  "$s.Save();"

echo Configurando atalho integrado do Antigravity na Area de Trabalho...
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s = $ws.CreateShortcut(\"$env:USERPROFILE\Desktop\Antigravity.lnk\"); " ^
  "$s.TargetPath = 'wscript.exe'; " ^
  "$s.Arguments = '\"%~dp0launch_antigravity.vbs\"'; " ^
  "$s.WorkingDirectory = '%~dp0'; " ^
  "$s.IconLocation = \"$env:LOCALAPPDATA\Programs\Antigravity\Antigravity.exe,0\"; " ^
  "$s.Description = 'Google Antigravity (com Remote ativado)'; " ^
  "$s.Save();"

echo.
echo [SUCESSO] Configuracao concluida com sucesso!
echo 1. O Guardiao inicia com o Windows e garante o bot sempre ativo.
echo 2. O atalho do Desktop abre o Antigravity e o Bot juntos.
echo.
pause

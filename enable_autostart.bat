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
  "$s.IconLocation = 'C:\Users\Querol\AppData\Local\Programs\antigravity\Antigravity.exe,0'; " ^
  "$s.Description = 'Google Antigravity (com Remote ativado)'; " ^
  "$s.Save();"

echo.
echo [SUCESSO] Configuracao concluida!
echo 1. O bot inicia automaticamente no boot do Windows.
echo 2. O Guardiao vigia o Antigravity e garante que o bot nunca caia.
echo 3. Ao clicar no Antigravity no Desktop, ambos abrem juntos.
echo.
pause

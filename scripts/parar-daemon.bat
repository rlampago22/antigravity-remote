@echo off
schtasks /end /tn "AntigravityRemoteV2" 2>nul
powershell -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'apps\\daemon\\dist\\index\.js' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo Antigravity Remote v2 Daemon parado.
pause

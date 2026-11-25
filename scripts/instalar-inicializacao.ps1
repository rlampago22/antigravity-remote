$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$vbsPath = Join-Path $scriptDir "iniciar-oculto.vbs"

# Remove legacy Startup shortcut to avoid duplicate instances
$legacyShortcut = Join-Path ([Environment]::GetFolderPath("Startup")) "AntigravityRemoteV2.lnk"
if (Test-Path $legacyShortcut) {
  Remove-Item $legacyShortcut -Force
}

$taskName = "AntigravityRemoteV2"
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`"" -WorkingDirectory $rootDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 3650) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host "Tarefa agendada '$taskName' instalada e iniciada com sucesso." -ForegroundColor Green

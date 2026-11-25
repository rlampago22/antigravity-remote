$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$daemonEntry = Join-Path $rootDir "apps\daemon\dist\index.js"

if (-not (Test-Path $daemonEntry)) {
  throw "Daemon ainda nao compilado em $daemonEntry. Rode 'npm run build:daemon' primeiro."
}

# Remove legacy Windows startup shortcut / scheduled task to avoid duplicate daemons without ANTIGRAVITY_LS_ADDRESS
$legacyShortcut = Join-Path ([Environment]::GetFolderPath("Startup")) "AntigravityRemoteV2.lnk"
if (Test-Path $legacyShortcut) { Remove-Item $legacyShortcut -Force }
try { Unregister-ScheduledTask -TaskName "AntigravityRemoteV2" -Confirm:$false -ErrorAction SilentlyContinue } catch {}

# Stop any standalone daemon process
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'apps\\daemon\\dist\\index\.js' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

$nodeExe = (Get-Command node).Source
$sidecarDir = Join-Path $env:USERPROFILE ".gemini\config\sidecars\antigravity-remote"
New-Item -ItemType Directory -Path $sidecarDir -Force | Out-Null

$sidecarJson = [ordered]@{
  display_name   = "Antigravity Remote Control v2"
  description    = "Ponte outbound entre o Google Antigravity local e o PWA Remote Control."
  command        = $nodeExe
  args           = @($daemonEntry)
  restart_policy = "always"
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $sidecarDir "sidecar.json"), ($sidecarJson | ConvertTo-Json -Depth 4), $utf8NoBom)

# Enable sidecar in ~/.gemini/config/config.json preserving all existing settings
$configPath = Join-Path $env:USERPROFILE ".gemini\config\config.json"
if (Test-Path $configPath) {
  $cfg = Get-Content $configPath -Raw | ConvertFrom-Json
} else {
  $cfg = [pscustomobject]@{}
}

if (-not $cfg.PSObject.Properties['sidecars']) {
  $cfg | Add-Member -NotePropertyName 'sidecars' -NotePropertyValue ([pscustomobject]@{})
}

$projectId = if ($env:ANTIGRAVITY_PROJECT_ID) { $env:ANTIGRAVITY_PROJECT_ID } else { "73a37a41-9bea-4f35-b181-2f350cc88775" }
$entry = [pscustomobject]@{
  enabled       = $true
  projectId     = $projectId
  schemaVersion = 1
}

if ($cfg.sidecars.PSObject.Properties['antigravity-remote']) {
  $cfg.sidecars.'antigravity-remote' = $entry
} else {
  $cfg.sidecars | Add-Member -NotePropertyName 'antigravity-remote' -NotePropertyValue $entry
}

[System.IO.File]::WriteAllText($configPath, ($cfg | ConvertTo-Json -Depth 12), $utf8NoBom)
Write-Host "Sidecar oficial 'antigravity-remote' instalado e habilitado (UTF-8 sem BOM) em $sidecarDir" -ForegroundColor Green

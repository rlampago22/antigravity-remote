Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = scriptDir

' 1. Inicia o Guardiao e o Bot do Telegram em segundo plano invisivelmente
WshShell.Run "pythonw guardian.py", 0, False

' 2. Abre o aplicativo Google Antigravity dinamicamente
antigravityExe = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\Antigravity\Antigravity.exe")
If fso.FileExists(antigravityExe) Then
    WshShell.Run """" & antigravityExe & """", 1, False
Else
    WshShell.Run "Antigravity.exe", 1, False
End If

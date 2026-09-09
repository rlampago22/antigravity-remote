Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = scriptDir

' Inicia o Guardiao (que vigia se o Antigravity esta aberto e mantem o bot sempre de pe)
WshShell.Run "pythonw guardian.py", 0, False

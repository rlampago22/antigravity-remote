Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
rootDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
WshShell.CurrentDirectory = rootDir
WshShell.Run "cmd.exe /c node apps\daemon\dist\index.js >> daemon.log 2>&1", 0, False

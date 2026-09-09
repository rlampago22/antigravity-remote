Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\Querol\.gemini\antigravity\scratch\antigravity-telegram-bridge"
WshShell.Run "pythonw bot.py", 0, False

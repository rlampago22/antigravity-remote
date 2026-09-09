Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\Querol\.gemini\antigravity\scratch\antigravity-telegram-bridge"

' 1. Inicia o Guardiao e o Bot do Telegram em segundo plano invisivelmente
WshShell.Run "pythonw guardian.py", 0, False
WshShell.Run "pythonw bot.py", 0, False

' 2. Abre o aplicativo Google Antigravity
WshShell.Run """C:\Users\Querol\AppData\Local\Programs\Antigravity\Antigravity.exe""", 1, False

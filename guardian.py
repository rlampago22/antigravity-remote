import os
import socket
import subprocess
import sys
import time
from pathlib import Path

# Garante que o diretório atual seja a pasta do script
SCRIPT_DIR = Path(__file__).parent.resolve()
os.chdir(SCRIPT_DIR)

LOG_FILE = SCRIPT_DIR / "guardian.log"

def log(msg: str):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    formatted = f"[{timestamp}] {msg}"
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(formatted + "\n")
    except Exception:
        pass

def is_bot_running() -> bool:
    """Verifica se o bot está rodando testando se a porta de trava local 52189 está ocupada."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.settimeout(0.5)
        result = s.connect_ex(("127.0.0.1", 52189))
        s.close()
        return result == 0
    except Exception:
        return False

def is_antigravity_running() -> bool:
    """Verifica se o Antigravity.exe ou language_server está em execução."""
    try:
        # tasklist rápido pelo Windows
        output = subprocess.check_output(
            'tasklist /FI "IMAGENAME eq Antigravity.exe" /NH',
            shell=True,
            text=True,
            errors="replace"
        )
        return "Antigravity.exe" in output
    except Exception:
        return False

def start_bot():
    """Inicia o bot silenciosamente em segundo plano com pythonw."""
    log("Disparando inicialização do Antigravity Remote Bot...")
    try:
        # Tenta pythonw primeiro para não abrir janela
        cmd = ["pythonw", "bot.py"]
        subprocess.Popen(
            cmd,
            cwd=str(SCRIPT_DIR),
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )
        log("Bot disparado com sucesso via pythonw.")
    except Exception as e:
        log(f"Falha ao iniciar pythonw, tentando python: {e}")
        try:
            subprocess.Popen(
                ["python", "bot.py"],
                cwd=str(SCRIPT_DIR),
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            )
        except Exception as e2:
            log(f"Erro fatal iniciando bot: {e2}")

def main():
    log("=== GUARDIÃO DO ANTIGRAVITY INICIADO ===")
    
    while True:
        try:
            antigravity_active = is_antigravity_running()
            bot_active = is_bot_running()

            if antigravity_active and not bot_active:
                log("Antigravity detectado ABERTO, mas o bot não está rodando. Ligando o bot agora...")
                start_bot()
                time.sleep(4)

        except Exception as e:
            log(f"Erro no loop do guardião: {e}")

        time.sleep(5)

if __name__ == "__main__":
    main()

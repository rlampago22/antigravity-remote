import os
import socket
import subprocess
import sys
import time
from pathlib import Path

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
    """Verifica se o bot.py está em execução testando o socket de controle (porta 52189)."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex(("127.0.0.1", 52189)) == 0
    except Exception:
        return False

def is_antigravity_running() -> bool:
    """Verifica se o Antigravity.exe está em execução via tasklist nativo."""
    try:
        res = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq Antigravity.exe", "/NH"],
            capture_output=True,
            text=True,
            errors="replace"
        )
        return "antigravity.exe" in res.stdout.lower()
    except Exception as e:
        log(f"Erro checando Antigravity: {e}")
        return False

def get_pythonw() -> str:
    exe = Path(sys.executable).with_name("pythonw.exe")
    if exe.exists():
        return str(exe)
    return sys.executable

def start_bot():
    """Inicia o bot silenciosamente em segundo plano."""
    log("Disparando inicialização do Antigravity Remote Bot...")
    pythonw_cmd = get_pythonw()
    try:
        cmd = [pythonw_cmd, "bot.py"]
        subprocess.Popen(
            cmd,
            cwd=str(SCRIPT_DIR),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )
        log(f"Bot disparado com sucesso via: {pythonw_cmd}")
    except Exception as e:
        log(f"Erro fatal iniciando bot: {e}")

def main():
    log("=== GUARDIÃO DO ANTIGRAVITY INICIADO ===")
    last_antigravity_state = None
    last_bot_state = None

    while True:
        try:
            antigravity_active = is_antigravity_running()
            bot_active = is_bot_running()

            if antigravity_active != last_antigravity_state:
                status_str = "ABERTO" if antigravity_active else "FECHADO"
                log(f"Estado do Antigravity alterado: {status_str}")
                last_antigravity_state = antigravity_active

            if bot_active != last_bot_state:
                status_str = "RODANDO" if bot_active else "PARADO"
                log(f"Estado do Bot alterado: {status_str}")
                last_bot_state = bot_active

            if antigravity_active and not bot_active:
                log("Antigravity detectado ABERTO, mas o bot não está rodando. Ligando o bot agora...")
                start_bot()
                time.sleep(3)
                if is_bot_running():
                    last_bot_state = True
                    log("Bot confirmado rodando e escutando na porta 52189!")

        except Exception as e:
            log(f"Erro no loop do guardião: {e}")

        time.sleep(5)

if __name__ == "__main__":
    main()

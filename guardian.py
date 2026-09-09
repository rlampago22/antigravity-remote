import os
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
    """Verifica se o bot.py está em execução usando wmic."""
    try:
        cmd = 'wmic process where "name like \'python%\'" get commandline'
        out = subprocess.check_output(cmd, shell=True, text=True, errors="replace")
        for line in out.splitlines():
            line_clean = line.strip().lower()
            if "bot.py" in line_clean and "guardian.py" not in line_clean:
                return True
        return False
    except Exception as e:
        log(f"Erro checando bot: {e}")
        return False

def is_antigravity_running() -> bool:
    """Verifica se o Antigravity.exe está em execução."""
    try:
        cmd = 'wmic process where "name=\'Antigravity.exe\'" get processid'
        out = subprocess.check_output(cmd, shell=True, text=True, errors="replace")
        for line in out.splitlines():
            if line.strip().isdigit():
                return True
        return False
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
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )
        log(f"Bot disparado com sucesso via: {pythonw_cmd}")
    except Exception as e:
        log(f"Erro fatal iniciando bot: {e}")

def main():
    log("=== GUARDIÃO DO ANTIGRAVITY INICIADO ===")
    
    while True:
        try:
            antigravity_active = is_antigravity_running()
            bot_active = is_bot_running()

            if antigravity_active and not bot_active:
                log("Antigravity detectado ABERTO, mas o bot não está rodando. Ligando o bot agora...")
                start_bot()
                time.sleep(5)

        except Exception as e:
            log(f"Erro no loop do guardião: {e}")

        time.sleep(5)

if __name__ == "__main__":
    main()

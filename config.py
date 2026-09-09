import os
from pathlib import Path
from dotenv import load_dotenv

# Carrega arquivo .env se existir na pasta do projeto
load_dotenv(Path(__file__).parent / ".env")

# Configurações do Telegram
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()

# ID do usuário do Telegram autorizado (apenas este usuário pode interagir com o bot)
# Se não estiver definido (0 ou vazio), o primeiro usuário a mandar /start receberá orientações.
_allowed_user = os.getenv("ALLOWED_USER_ID", "").strip()
ALLOWED_USER_ID = int(_allowed_user) if _allowed_user.isdigit() else None

# Caminhos do Antigravity
DEFAULT_ANTIGRAVITY_DIR = Path.home() / ".gemini" / "antigravity"
ANTIGRAVITY_DIR = Path(os.getenv("ANTIGRAVITY_DIR", str(DEFAULT_ANTIGRAVITY_DIR)))

BRAIN_DIR = ANTIGRAVITY_DIR / "brain"
CONVERSATIONS_DIR = ANTIGRAVITY_DIR / "conversations"

# Caminho do executável agentapi.bat
DEFAULT_AGENTAPI = ANTIGRAVITY_DIR / "bin" / "agentapi.bat"
AGENTAPI_PATH = Path(os.getenv("AGENTAPI_PATH", str(DEFAULT_AGENTAPI)))

# Modo padrão de visualização: "compact" (apenas ações e respostas finais) ou "verbose" (inclui pensamentos do agente)
DEFAULT_MODE = os.getenv("LOG_MODE", "compact").lower()
if DEFAULT_MODE not in ("compact", "verbose"):
    DEFAULT_MODE = "compact"

# Modelo padrão para novas conversas ("flash", "pro", "flash_lite")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "flash").lower()

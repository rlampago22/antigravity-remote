#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "==================================================="
echo "     ANTIGRAVITY TELEGRAM REMOTE BRIDGE"
echo "==================================================="
echo ""

if [ ! -f ".env" ]; then
    echo "[AVISO] Arquivo .env não encontrado!"
    echo "Copiando de .env.example..."
    cp .env.example .env
    echo "Por favor edite o arquivo .env e adicione seu TELEGRAM_BOT_TOKEN."
    exit 1
fi

python3 -m pip install -r requirements.txt --quiet
python3 bot.py

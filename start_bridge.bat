@echo off
title Antigravity Telegram Bridge
cd /d "%~dp0"

echo ===================================================
echo     ANTIGRAVITY TELEGRAM REMOTE BRIDGE
echo ===================================================
echo.

REM Verifica se o arquivo .env existe
if not exist ".env" (
    echo [AVISO] O arquivo .env nao foi encontrado!
    echo Copiando de .env.example...
    copy .env.example .env
    echo.
    echo Por favor, abra o arquivo .env e cole o seu TELEGRAM_BOT_TOKEN gerado no @BotFather.
    echo.
    pause
    notepad .env
    exit /b
)

echo Iniciando o bot...
python bot.py

pause

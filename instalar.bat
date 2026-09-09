@echo off
title Instalador - Antigravity Remote
cd /d "%~dp0"

echo ========================================================
echo        INSTALADOR - ANTIGRAVITY REMOTE BOT
echo ========================================================
echo.

REM 1. Verifica Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python nao foi encontrado no seu computador!
    echo Por favor, instale o Python 3.10 ou superior pelo site python.org
    echo e marque a opcao "Add Python to PATH" durante a instalacao.
    echo.
    pause
    exit /b
)

echo [OK] Python detectado com sucesso.
echo.

REM 2. Instala dependencias
echo Instalando dependencias necessarias (python-telegram-bot, etc)...
python -m pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo [AVISO] Tentando instalar pacotes no modo usuario...
    python -m pip install --user -r requirements.txt
)
echo [OK] Dependencias instaladas.
echo.

REM 3. Configura .env
if not exist ".env" (
    echo [CONFIGURACAO] Criando seu arquivo .env...
    copy .env.example .env >nul
    echo.
    echo -------------------------------------------------------------
    echo  PASSO NECESSARIO:
    echo  1. Abra o Telegram e busque por @BotFather.
    echo  2. Envie /newbot e pegue o Token do seu novo bot.
    echo  3. Cole o seu token no arquivo de texto que vai se abrir agora!
    echo  4. Salve o arquivo (Ctrl+S) e feche o bloco de notas.
    echo -------------------------------------------------------------
    echo.
    pause
    notepad .env
)

REM 4. Configura inicializacao automatica e atalho
echo.
echo Deseja ativar a inicializacao automatica e o atalho integrado no Desktop? (S/N)
set /p opt="Opcao [S]: "
if /i "%opt%" neq "n" (
    call "%~dp0enable_autostart.bat"
)

REM 5. Iniciar imediatamente
echo.
echo Deseja iniciar o Antigravity Remote agora em segundo plano? (S/N)
set /p runopt="Opcao [S]: "
if /i "%runopt%" neq "n" (
    start wscript.exe "%~dp0run_silent.vbs"
    echo.
    echo ========================================================
    echo  [SUCESSO] O Bot e o Guardiao estao rodando!
    echo  Agora abra o Telegram no seu celular, mande /start
    echo  para o seu bot e aproveite o controle remoto!
    echo ========================================================
)

echo.
pause

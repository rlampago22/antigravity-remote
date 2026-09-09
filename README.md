# 🚀 Antigravity Remote (Controle pelo Telegram)

<p align="center">
  <b>Controle, inspecione e acompanhe o Google Antigravity diretamente pelo seu celular via Telegram.</b><br>
  <i>Como o Remote do ChatGPT, mas construído para os agentes do Google Antigravity no seu computador.</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-blue.svg" alt="Python 3.10+">
  <img src="https://img.shields.io/badge/Licen%C3%A7a-MIT-green.svg" alt="Licença MIT">
  <img src="https://img.shields.io/badge/Plataforma-Windows%20|%20macOS%20|%20Linux-lightgrey.svg" alt="Plataformas">
  <img src="https://img.shields.io/badge/Telegram-Bot%20API-blue.svg" alt="Telegram Bot API">
</p>

---

## 🌟 O que você consegue fazer?

- 📱 **Controle total no celular:** Envie instruções, peça correções de código e acompanhe o trabalho de qualquer lugar pelo Telegram.
- 🗂️ **Seus chats com os nomes reais:** Lista suas conversas com os mesmos títulos que aparecem na barra lateral do Antigravity.
- 🤫 **Zero poluição de mensagens:** Funciona igual ao Remote do ChatGPT — tarefas que estiverem rodando em segundo plano não ficam inundando seu chat com mensagens se você não pedir.
- 📡 **Logs ao vivo sob demanda:** Ao entrar em qualquer chat, toque em **"Acompanhar Logs ao Vivo"** para ver comandos de terminal, arquivos sendo criados/editados e o raciocínio do agente em tempo real.
- 🔄 **Inicialização automática no Windows:** Liga sozinho em segundo plano quando o computador liga, sem abrir janelas de terminal na sua tela.
- 🔒 **Segurança estrita:** Travado exclusivamente para o seu ID do Telegram. Qualquer outra pessoa que tentar mandar mensagem é bloqueada.
- ⚡ **Rápido de iniciar:** Já vem com scripts de 1 clique (`start_bridge.bat` e `enable_autostart.bat`).

---

## 🏗️ Como Funciona a Arquitetura

```text
 [ Seu Smartphone ]
  (Aplicativo do Telegram)
          ▲  │
          │  │ 1. Você envia uma instrução / seleciona um chat
          │  ▼
  [ Bridge Service ] (Roda no seu PC em segundo plano via Python)
          │  │
          │  ├─► Dispara as tarefas no Antigravity (`agentapi.bat` / `agentapi`)
          │  │
          └◄─┴─ Lê o histórico (`transcript.jsonl`) sob demanda
               (Execução de comandos, ferramentas, arquivos e respostas)
```

---

## ⚡ Como Começar (Passo a Passo em 3 Minutos)

### 1. Criar o Bot no Telegram
1. No seu celular ou PC, abra o Telegram e busque por **[@BotFather](https://t.me/BotFather)** (o bot oficial com selo de verificação azul).
2. Envie o comando:
   ```
   /newbot
   ```
3. Escolha um nome (ex: `Meu Antigravity`) e um username único terminando em `bot` (ex: `meu_antigravity_bot`).
4. O BotFather fornecerá um **Token de Acesso HTTP** (ex: `123456789:AAH...`). Guarde esse token!

### 2. Baixar e Configurar o Projeto
Abra o terminal no computador e clone este repositório:
```bash
git clone https://github.com/rlampago22/antigravity-remote.git
cd antigravity-remote
```

Crie o arquivo de configuração `.env` a partir do modelo:
```powershell
# No Windows:
copy .env.example .env

# No Linux ou macOS:
cp .env.example .env
```

Abra o arquivo `.env` e cole o seu token do bot:
```ini
TELEGRAM_BOT_TOKEN=seu_token_do_bot_aqui
ALLOWED_USER_ID=
LOG_MODE=compact
DEFAULT_MODEL=flash
```

### 3. Executar

- **No Windows:** Dê um duplo clique no arquivo [`start_bridge.bat`](start_bridge.bat) ou execute:
  ```powershell
  python bot.py
  ```
- **No Linux ou macOS:**
  ```bash
  chmod +x start_bridge.sh
  ./start_bridge.sh
  ```

### 4. Abrir no Celular
1. Abra a conversa com seu novo bot no Telegram e envie:
   ```
   /start
   ```
2. O bot se vinculará automaticamente ao seu usuário e exibirá o painel das suas conversas!

---

## 🔄 Como Ativar a Inicialização Automática com o Windows

Para não precisar lembrar de abrir o bot toda vez que ligar o computador:
- Dê um duplo clique em [`enable_autostart.bat`](enable_autostart.bat).
- Pronto! O bot passará a iniciar sozinho e invisível em segundo plano sempre que o Windows ligar.
- Para desativar quando quiser: dê um duplo clique em [`disable_autostart.bat`](disable_autostart.bat).

---

## 📱 Comandos no Telegram

| Comando | O que faz |
|---|---|
| `/list` | Mostra todas as suas conversas do Antigravity com botões de 1 clique para abrir. |
| `/run <sua tarefa>` | Cria uma nova conversa do zero no computador e começa a executar. |
| *(Texto normal)* | Com um chat aberto, qualquer mensagem digitada é enviada direto para o agente no PC. |
| `/help` | Exibe as instruções e resumo dos comandos. |

---

## 🔒 Segurança

- O bot se comunica exclusivamente pelas conexões de saída (*long-polling*) do Telegram. **Você não precisa abrir portas no roteador nem configurar IP público.**
- O parâmetro `ALLOWED_USER_ID` garante que **apenas você** consiga interagir com seu computador. Mensagens de terceiros são rejeitadas.

---

## 🤝 Como Contribuir

Quer ajudar a melhorar o projeto?
1. Faça um Fork do repositório.
2. Crie uma branch para sua funcionalidade (`git checkout -b feature/nova-funcao`).
3. Faça commit das alterações (`git commit -m 'Adiciona nova funcao'`).
4. Envie para a sua branch (`git push origin feature/nova-funcao`).
5. Abra um Pull Request!

---

## 📄 Licença

Este projeto é disponibilizado sob a licença [MIT](LICENSE).

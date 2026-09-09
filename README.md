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
- 🛡️ **Guardião Inteligente:** Vigia se o Antigravity está aberto e liga o bot sozinho, além de manter o serviço sempre de pé.
- 🔄 **Inicialização automática no Windows:** Liga sozinho em segundo plano quando o computador liga, sem abrir janelas pretas de terminal na tela.
- 🔒 **Segurança estrita:** Travado exclusivamente para o seu ID do Telegram. Qualquer outra pessoa que tentar mandar mensagem é bloqueada.

---

## ⚡ Instalação Rápida em 1 Minuto (Para Qualquer Computador)

Qualquer pessoa que use o **Google Antigravity** pode rodar este projeto em seu próprio computador seguindo estes passos simples:

### Passo 1: Obter um Token no Telegram
1. No celular ou PC, abra o Telegram e busque por **[@BotFather](https://t.me/BotFather)** (bot oficial com selo azul).
2. Envie o comando `/newbot`.
3. Escolha um nome (ex: `Meu Antigravity`) e um username único terminado em `bot` (ex: `meu_antigravity_bot`).
4. O BotFather fornecerá um **Token de Acesso HTTP**. Guarde esse token!

### Passo 2: Baixar o Repositório
No computador:
```bash
git clone https://github.com/rlampago22/antigravity-remote.git
cd antigravity-remote
```
*(Ou baixe o arquivo ZIP pelo botão verde **Code -> Download ZIP** no GitHub e extraia numa pasta de sua preferência).*

### Passo 3: Executar o Instalador Automático
- **No Windows:**
  Dê um duplo clique no arquivo [`instalar.bat`](instalar.bat).
  - Ele verificará o Python.
  - Instalará as dependências automaticamente.
  - Abrirá o bloco de notas para você colar o seu token do `@BotFather`.
  - Criará o atalho integrado na Área de Trabalho e a inicialização automática!

- **No Linux ou macOS:**
  ```bash
  chmod +x start_bridge.sh
  ./start_bridge.sh
  ```

### Passo 4: Conectar no Celular
Abra o seu bot no Telegram e envie:
```
/start
```
Pronto! O bot já se vinculará à sua conta e listará todas as conversas do seu Antigravity.

---

## 🏗️ Como Funciona a Arquitetura

```text
 [ Seu Smartphone ]
  (Aplicativo do Telegram)
          ▲  │
          │  │ 1. Você envia uma instrução / seleciona um chat
          │  ▼
  [ Bridge Service + Guardião ] (Roda no seu PC em segundo plano via Python)
          │  │
          │  ├─► Dispara as tarefas no Antigravity (`agentapi.bat` / `agentapi`)
          │  │
          └◄─┴─ Lê o histórico (`transcript.jsonl`) sob demanda
               (Execução de comandos, ferramentas, arquivos e respostas)
```

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

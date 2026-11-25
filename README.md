# Antigravity Remote Control v2 (Web PWA + Cloud Relay)

Controle, acompanhe e dispare tarefas para agentes do **Google Antigravity** no seu notebook direto do celular (Android PWA) — no modelo de *control plane* remoto do Claude Code Remote Control e Codex Remote, **sem VPN e sem abrir portas no roteador**.

> A versão v1 baseada em Telegram permanece preservada na branch `v1-telegram`.

## Arquitetura

- **`apps/web`** — Next.js App Router + PWA instalável (Vercel) + **Better Auth** + **Drizzle ORM** (**Neon Postgres**) + Web Push (VAPID) + áudio híbrido (Web Speech API / Gemini API opcional).
- **`apps/daemon`** — Daemon local em Node.js/TypeScript rodando no notebook. Faz apenas conexões *outbound* HTTPS, sincroniza conversas reais do Antigravity (`annotations/*.pbtxt` + `transcript.jsonl`), executa `agentapi.bat`, lê `git diff`, arquivos (com allowlist de workspaces) e artefatos.
- **`packages/protocol`** — Contratos Zod compartilhados e parser determinístico de `transcript.jsonl`.

## Recursos da v2

- Pareamento seguro do notebook por **código de 6 caracteres / QR Code** (token escopado armazenado com hash SHA-256).
- Lista de conversas reais do Antigravity sincronizadas com status (`Executando`, `Aguardando você`, `Concluído`) e histórico persistido para leitura mesmo com o PC desligado.
- Criação de novas tarefas escolhendo **workspace/pasta**, **modelo** (`flash`, `pro`, `flash_lite`), anexos e entrada por voz.
- Visualização ao vivo de raciocínio (*thoughts*), chamadas de ferramentas, saída de comandos, **Git Diff**, navegador de arquivos *read-only* e **Artefatos** (Markdown e imagens).
- Notificações **Web Push** nativas no Android PWA quando uma tarefa termina ou pede atenção.

## Setup rápido

1. **Instale as dependências:**
   ```bash
   npm install
   ```
2. **Configure as variáveis de ambiente** (copie `.env.example` para `.env.local` ou use `vercel env pull .env.local`):
   - `DATABASE_URL` (Neon Postgres)
   - `BETTER_AUTH_SECRET` e `BETTER_AUTH_URL`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` (opcional para Web Push)
   - `GEMINI_API_KEY` (opcional — chave gratuita do Google AI Studio para transcrição de áudio; sem ela, o app usa o ditado nativo do navegador)
3. **Aplique o schema no Neon Postgres:**
   ```bash
   npm run db:push
   ```
4. **Build e pareamento no notebook:**
   ```bash
   npm run build
   REMOTE_SERVER_URL=https://seu-app.vercel.app npm run daemon:pair
   ```
5. **Inicie o daemon (ou configure auto-start silencioso no Windows):**
   ```bash
   npm run daemon:start
   # Auto-start Windows:
   powershell -ExecutionPolicy Bypass -File .\scripts\instalar-inicializacao.ps1
   ```

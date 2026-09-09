# 🚀 Antigravity Remote (Telegram Companion)

<p align="center">
  <b>Control, inspect, and monitor Google Antigravity directly from your phone via Telegram.</b><br>
  <i>Just like ChatGPT Remote, but built for Google Antigravity agents on your desktop.</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-blue.svg" alt="Python 3.10+">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License MIT">
  <img src="https://img.shields.io/badge/Platform-Windows%20|%20macOS%20|%20Linux-lightgrey.svg" alt="Platforms">
  <img src="https://img.shields.io/badge/Telegram-Bot%20API-blue.svg" alt="Telegram Bot API">
</p>

---

## 🌟 Features

- 📱 **Full Mobile Control:** Send instructions, prompt agents, and start new tasks from anywhere using your smartphone.
- 🗂️ **Exact Chat Sync:** Lists your conversations with the exact official titles from your Antigravity sidebar (`annotations/*.pbtxt`).
- 🤫 **Zero Background Spam:** Operates just like ChatGPT Remote — no message flooding from running background tasks unless you explicitly open that chat.
- 📡 **On-Demand Live Logs:** Tap **"Acompanhar Logs ao Vivo"** inside any active task to watch terminal commands, file edits, and agent actions stream in real-time.
- 💬 **Interactive Chat Switcher:** Easily switch between active sessions with single-tap inline buttons.
- 🔒 **Ironclad Security:** Whitelists only your specific Telegram User ID. Unauthorized messages are instantly blocked.
- 🚀 **1-Click Startup:** Bundled with `start_bridge.bat` (Windows) and `start_bridge.sh` (Linux/macOS).

---

## 🏗️ Architecture

```text
 [ Your Smartphone ]
  (Telegram App)
          ▲  │
          │  │ 1. Send instruction / Click chat
          │  ▼
  [ Antigravity Bridge Service ] (Python daemon running on your PC)
          │  │
          │  ├─► Dispatches to Antigravity CLI (`agentapi.bat` / `agentapi`)
          │  │
          └◄─┴─ Tails `transcript.jsonl` on-demand
               (Tool executions, terminal stdout, file edits & replies)
```

---

## ⚡ Quickstart (2 Minutes)

### 1. Create a Telegram Bot
1. Open Telegram and search for **[@BotFather](https://t.me/BotFather)** (the official verified bot).
2. Send `/newbot`.
3. Choose a name (e.g. `My Antigravity`) and a unique username ending in `bot` (e.g. `my_antigravity_bot`).
4. Copy the **HTTP API Token** provided by BotFather.

### 2. Configure the Bridge
Clone this repository and create your `.env` file:
```bash
git clone https://github.com/rlampago22/antigravity-remote.git
cd antigravity-remote
cp .env.example .env
```
*(On Windows PowerShell, use `copy .env.example .env`)*

Edit `.env` with your token:
```ini
TELEGRAM_BOT_TOKEN=your_token_from_botfather_here
ALLOWED_USER_ID=
LOG_MODE=compact
DEFAULT_MODEL=flash
```

### 3. Run
- **Windows:** Double-click [`start_bridge.bat`](start_bridge.bat) or run:
  ```powershell
  python bot.py
  ```
- **macOS / Linux:**
  ```bash
  chmod +x start_bridge.sh
  ./start_bridge.sh
  ```

### 4. Connect on Mobile
1. Open your bot on Telegram and send `/start`.
2. The bot will automatically lock to your user ID and present your Antigravity chats!

---

## 📱 Telegram Commands

| Command | Description |
|---|---|
| `/list` | Displays your active & past Antigravity chats with 1-tap buttons to open them. |
| `/run <prompt>` | Spawns a brand-new conversation in Antigravity and starts working immediately. |
| *(Any plain text)* | When a chat is open, simply type any text to send that prompt directly to the agent. |
| `/help` | Shows instructions and guide. |

---

## 🔒 Security

- Your bot communicates strictly through Telegram's outgoing long-polling. **No open ports, no port forwarding, and no router configuration required.**
- The `ALLOWED_USER_ID` ensures that **only you** can interact with or view data from your machine.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check the [issues page](https://github.com/rlampago22/antigravity-remote/issues).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

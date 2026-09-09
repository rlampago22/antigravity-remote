import asyncio
import html
import logging
import os
import sys
from pathlib import Path
from typing import Optional, Dict

from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    constants
)
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters
)

from config import (
    TELEGRAM_BOT_TOKEN,
    ALLOWED_USER_ID,
    DEFAULT_MODE,
    DEFAULT_MODEL,
    ANTIGRAVITY_DIR
)
from antigravity_client import AntigravityClient
from log_monitor import ConversationLogMonitor, BridgeEvent

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger("antigravity_bridge.bot")

class AntigravityTelegramBridge:
    def __init__(self):
        self.client = AntigravityClient()
        self.allowed_user_id: Optional[int] = ALLOWED_USER_ID
        self.active_conversation_id: Optional[str] = None
        self.active_monitor: Optional[ConversationLogMonitor] = None
        self.active_chat_id: Optional[int] = None
        self.mode: str = DEFAULT_MODE
        self.streaming_enabled: bool = False  # Só faz streaming se o usuário pedir explicitamente!
        self.app: Optional[Application] = None
        self.is_busy: bool = False

    def check_auth(self, update: Update) -> bool:
        user = update.effective_user
        if not user:
            return False

        if self.allowed_user_id is None:
            self.allowed_user_id = user.id
            logger.info(f"ALLOWED_USER_ID configurado para {user.id} ({user.first_name})")
            return True

        return user.id == self.allowed_user_id

    async def unauthorized_reply(self, update: Update):
        user = update.effective_user
        user_id = user.id if user else "desconhecido"
        msg = (
            f"⛔ <b>Acesso Não Autorizado</b>\n\n"
            f"Este bot controla um computador localmente.\n"
            f"Seu ID do Telegram é: <code>{user_id}</code>\n\n"
            f"Adicione no arquivo <code>.env</code>:\n"
            f"<code>ALLOWED_USER_ID={user_id}</code>"
        )
        if update.effective_message:
            await update.effective_message.reply_text(msg, parse_mode=constants.ParseMode.HTML)

    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not self.check_auth(update):
            return await self.unauthorized_reply(update)

        self.active_chat_id = update.effective_chat.id
        # Não ativa streaming automático de nenhuma conversa ao iniciar
        await self.show_chat_list(update.effective_chat.id)

    async def cmd_list(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not self.check_auth(update):
            return await self.unauthorized_reply(update)

        self.active_chat_id = update.effective_chat.id
        await self.show_chat_list(update.effective_chat.id)

    async def show_chat_list(self, chat_id: int, message_to_edit=None):
        """Exibe a lista de conversas exatamente como na barra lateral do Antigravity."""
        conversations = self.client.list_recent_conversations(limit=10)
        if not conversations:
            text = "Nenhuma conversa encontrada no Antigravity."
            if message_to_edit:
                return await message_to_edit.edit_text(text)
            return await self.app.bot.send_message(chat_id=chat_id, text=text)

        text_lines = [
            "📋 <b>Conversas no Antigravity:</b>\n",
            "<i>Toque em um chat para abrir, ver o andamento ou enviar instruções:</i>\n"
        ]

        keyboard = []
        for i, c in enumerate(conversations, 1):
            is_selected = (c["id"] == self.active_conversation_id)
            status_icon = "⏳" if c["is_running"] else "💬"
            active_marker = " 👈 (aberto)" if is_selected else ""

            text_lines.append(f"{status_icon} <b>{i}. {html.escape(c['title'])}</b>{active_marker}")

            btn_label = f"💬 {c['title'][:28]}"
            if c["is_running"]:
                btn_label = f"⏳ {c['title'][:26]}"

            keyboard.append([InlineKeyboardButton(btn_label, callback_data=f"open_chat:{c['id']}")])

        keyboard.append([
            InlineKeyboardButton("➕ Nova Tarefa", callback_data="btn_new"),
            InlineKeyboardButton("🔄 Atualizar Lista", callback_data="refresh_list")
        ])

        full_text = "\n".join(text_lines)
        reply_markup = InlineKeyboardMarkup(keyboard)

        if message_to_edit:
            try:
                await message_to_edit.edit_text(full_text, reply_markup=reply_markup, parse_mode=constants.ParseMode.HTML)
            except Exception:
                await self.app.bot.send_message(chat_id=chat_id, text=full_text, reply_markup=reply_markup, parse_mode=constants.ParseMode.HTML)
        else:
            await self.app.bot.send_message(chat_id=chat_id, text=full_text, reply_markup=reply_markup, parse_mode=constants.ParseMode.HTML)

    async def open_conversation_view(self, chat_id: int, conv_id: str, message_to_edit=None):
        """Abre a visão detalhada de um chat específico (estilo Remote do ChatGPT)."""
        self.active_conversation_id = conv_id
        summary = self.client.get_conversation_summary(conv_id)

        title = summary["title"]
        status_str = "⏳ <b>Em execução no computador...</b>" if summary["is_running"] else "🟢 <b>Concluído / Pronto para comandos</b>"
        stream_status = "🟢 Transmitindo logs ao vivo" if self.streaming_enabled else "⚪ Logs ao vivo pausados"

        text = (
            f"📂 <b>CHAT: {html.escape(title)}</b>\n\n"
            f"⚡ <b>Status:</b> {status_str}\n"
            f"📡 <b>Transmissão:</b> {stream_status}\n"
            f"📅 <b>Última Atividade:</b> {summary['date_str']} ({summary['total_steps']} passos)\n\n"
            f"📥 <b>Último Pedido:</b>\n<i>\"{html.escape(summary['last_user_prompt'])}\"</i>\n\n"
            f"🛠️ <b>Última Ação:</b>\n<code>{html.escape(summary['last_tool_action'])}</code>\n\n"
            f"🤖 <b>Última Resposta:</b>\n{html.escape(summary['last_agent_response'])}\n\n"
            f"✍️ <i>Para enviar uma instrução a este chat, basta digitar e enviar qualquer mensagem abaixo!</i>"
        )

        buttons = []
        if self.streaming_enabled:
            buttons.append([InlineKeyboardButton("⏹️ Parar Logs ao Vivo", callback_data=f"toggle_stream:{conv_id}")])
        else:
            buttons.append([InlineKeyboardButton("🟢 Acompanhar Logs ao Vivo", callback_data=f"toggle_stream:{conv_id}")])

        buttons.append([
            InlineKeyboardButton("🔄 Atualizar Status", callback_data=f"open_chat:{conv_id}"),
            InlineKeyboardButton("⬅️ Voltar à Lista", callback_data="refresh_list")
        ])

        reply_markup = InlineKeyboardMarkup(buttons)

        if message_to_edit:
            try:
                await message_to_edit.edit_text(text, reply_markup=reply_markup, parse_mode=constants.ParseMode.HTML)
            except Exception:
                await self.app.bot.send_message(chat_id=chat_id, text=text, reply_markup=reply_markup, parse_mode=constants.ParseMode.HTML)
        else:
            await self.app.bot.send_message(chat_id=chat_id, text=text, reply_markup=reply_markup, parse_mode=constants.ParseMode.HTML)

    async def handle_callback_query(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()

        if not self.check_auth(update):
            return

        data = query.data

        if data.startswith("open_chat:"):
            conv_id = data.split("open_chat:", 1)[1]
            # Se mudou de conversa, para o monitor da anterior
            if self.active_monitor and self.active_conversation_id != conv_id:
                await self.active_monitor.stop()
                self.active_monitor = None
                self.streaming_enabled = False

            await self.open_conversation_view(update.effective_chat.id, conv_id, message_to_edit=query.message)

        elif data.startswith("toggle_stream:"):
            conv_id = data.split("toggle_stream:", 1)[1]
            self.streaming_enabled = not self.streaming_enabled

            if self.streaming_enabled:
                self._start_monitor_for_conversation(conv_id)
                await query.message.reply_text(
                    f"🟢 <b>Acompanhamento de logs ativado para:</b>\n<b>{html.escape(self.client.get_official_title(conv_id) or conv_id)}</b>\n"
                    f"Você receberá ações concretas e respostas deste chat.",
                    parse_mode=constants.ParseMode.HTML
                )
            else:
                if self.active_monitor:
                    await self.active_monitor.stop()
                    self.active_monitor = None
                await query.message.reply_text("⏹️ <b>Logs ao vivo pausados.</b>")

            await self.open_conversation_view(update.effective_chat.id, conv_id, message_to_edit=query.message)

        elif data == "refresh_list":
            # Ao voltar para a lista, desliga o streaming de logs para não poluir
            if self.active_monitor:
                await self.active_monitor.stop()
                self.active_monitor = None
            self.streaming_enabled = False
            await self.show_chat_list(update.effective_chat.id, message_to_edit=query.message)

        elif data == "btn_new":
            await query.message.reply_text(
                "➕ Para iniciar uma nova conversa no Antigravity, envie o comando:\n"
                "<code>/run &lt;sua instrução&gt;</code>\n\n"
                "Exemplo:\n"
                "<code>/run Criar um script de automação em Python</code>",
                parse_mode=constants.ParseMode.HTML
            )

    async def handle_text_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not self.check_auth(update):
            return await self.unauthorized_reply(update)

        user_text = update.effective_message.text.strip()
        if not user_text:
            return

        self.active_chat_id = update.effective_chat.id

        if not self.active_conversation_id:
            await update.effective_message.reply_text(
                "ℹ️ Você não selecionou nenhum chat ainda.\nUse <code>/list</code> para abrir uma conversa existente ou <code>/run &lt;tarefa&gt;</code> para criar uma nova.",
                parse_mode=constants.ParseMode.HTML
            )
            return

        title = self.client.get_official_title(self.active_conversation_id) or self.active_conversation_id

        status_msg = await update.effective_message.reply_text(
            f"📤 <i>Enviando mensagem para</i> <b>{html.escape(title)}</b>...",
            parse_mode=constants.ParseMode.HTML
        )

        # Garante que o monitor está ativo para receber a resposta dessa mensagem
        if not self.active_monitor:
            self._start_monitor_for_conversation(self.active_conversation_id)

        success, err = await self.client.send_message(self.active_conversation_id, user_text)
        if not success:
            await status_msg.edit_text(
                f"❌ <b>Erro ao enviar para o Antigravity:</b>\n<code>{html.escape(str(err))}</code>",
                parse_mode=constants.ParseMode.HTML
            )
        else:
            await status_msg.edit_text(
                f"✅ <b>Instrução enviada com sucesso!</b>\n<i>O Antigravity está processando no computador...</i>",
                parse_mode=constants.ParseMode.HTML
            )

    async def cmd_run(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not self.check_auth(update):
            return await self.unauthorized_reply(update)

        self.active_chat_id = update.effective_chat.id
        prompt = " ".join(context.args).strip() if context.args else ""
        if not prompt:
            await update.effective_message.reply_text(
                "⚠️ Informe o que deseja executar.\nExemplo: <code>/run Criar um script hello.py</code>",
                parse_mode=constants.ParseMode.HTML
            )
            return

        status_msg = await update.effective_message.reply_text(
            f"⏳ <b>Criando nova conversa no Antigravity...</b>\n\n<i>Prompt: {html.escape(prompt)}</i>",
            parse_mode=constants.ParseMode.HTML
        )

        success, conv_id, err = await self.client.new_conversation(prompt)
        if not success or not conv_id:
            await status_msg.edit_text(
                f"❌ <b>Falha ao criar conversa:</b>\n<code>{html.escape(str(err))}</code>",
                parse_mode=constants.ParseMode.HTML
            )
            return

        self.active_conversation_id = conv_id
        self.streaming_enabled = True
        self._start_monitor_for_conversation(conv_id)

        title = self.client.get_official_title(conv_id) or "Nova Conversa"
        await status_msg.edit_text(
            f"🚀 <b>Conversa iniciada!</b>\n\n"
            f"📂 <b>Chat:</b> {html.escape(title)}\n"
            f"Acompanhando em tempo real...",
            parse_mode=constants.ParseMode.HTML
        )

    def _start_monitor_for_conversation(self, conversation_id: str):
        if self.active_monitor:
            asyncio.create_task(self.active_monitor.stop())

        self.active_monitor = ConversationLogMonitor(
            conversation_id=conversation_id,
            on_event=self._on_bridge_event,
            mode=self.mode
        )
        self.active_monitor.start(from_beginning=False)

    async def _on_bridge_event(self, event: BridgeEvent):
        if not self.active_chat_id or not self.app:
            return

        msg_text = f"<b>{html.escape(event.title)}</b>\n\n{event.details}"

        try:
            if len(msg_text) > 4000:
                chunks = [msg_text[i:i+3900] for i in range(0, len(msg_text), 3900)]
                for chunk in chunks:
                    await self.app.bot.send_message(
                        chat_id=self.active_chat_id,
                        text=chunk,
                        parse_mode=constants.ParseMode.HTML
                    )
            else:
                try:
                    await self.app.bot.send_message(
                        chat_id=self.active_chat_id,
                        text=msg_text,
                        parse_mode=constants.ParseMode.HTML
                    )
                except Exception:
                    plain_text = f"{event.title}\n\n{event.details}"
                    await self.app.bot.send_message(
                        chat_id=self.active_chat_id,
                        text=plain_text
                    )
        except Exception as e:
            logger.error(f"Falha ao enviar mensagem para Telegram: {e}")

    def run(self):
        if not TELEGRAM_BOT_TOKEN:
            print("TELEGRAM_BOT_TOKEN não configurado!")
            return

        self.app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

        self.app.add_handler(CommandHandler("start", self.cmd_start))
        self.app.add_handler(CommandHandler("help", self.cmd_start))
        self.app.add_handler(CommandHandler("list", self.cmd_list))
        self.app.add_handler(CommandHandler("run", self.cmd_run))
        self.app.add_handler(CommandHandler("new", self.cmd_run))
        self.app.add_handler(CallbackQueryHandler(self.handle_callback_query))
        self.app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_text_message))

        self.app.run_polling()

if __name__ == "__main__":
    bridge = AntigravityTelegramBridge()
    bridge.run()

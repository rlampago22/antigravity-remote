import asyncio
import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Callable, Awaitable, Dict, Any, List

from config import BRAIN_DIR

logger = logging.getLogger("antigravity_bridge.monitor")

@dataclass
class BridgeEvent:
    event_type: str  # "thinking", "tool_call", "response", "done", "error"
    title: str
    details: str
    raw_step: Dict[str, Any]

class ConversationLogMonitor:
    def __init__(
        self,
        conversation_id: str,
        on_event: Callable[[BridgeEvent], Awaitable[None]],
        mode: str = "compact",
        brain_dir: Path = BRAIN_DIR
    ):
        self.conversation_id = conversation_id
        self.on_event = on_event
        self.mode = mode  # "compact" ou "verbose"
        self.brain_dir = brain_dir
        self.log_file = brain_dir / conversation_id / ".system_generated" / "logs" / "transcript.jsonl"
        self._running = False
        self._muted = False
        self._task: Optional[asyncio.Task] = None
        self._last_line_read = 0

    @property
    def is_muted(self) -> bool:
        return self._muted

    def set_muted(self, muted: bool):
        self._muted = muted

    def start(self, from_beginning: bool = False):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._watch_loop(from_beginning))
        logger.info(f"Monitor iniciado para conversa {self.conversation_id}")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info(f"Monitor parado para conversa {self.conversation_id}")

    async def _watch_loop(self, from_beginning: bool):
        wait_seconds = 0
        while self._running and not self.log_file.exists():
            await asyncio.sleep(1)
            wait_seconds += 1
            if wait_seconds > 60:
                logger.warning(f"Arquivo de log não encontrado: {self.log_file}")
                return

        if not from_beginning and self.log_file.exists():
            try:
                with open(self.log_file, "r", encoding="utf-8", errors="replace") as f:
                    lines = f.readlines()
                    self._last_line_read = len(lines)
            except Exception as e:
                logger.error(f"Erro ao contar linhas iniciais: {e}")
                self._last_line_read = 0

        while self._running:
            try:
                if self.log_file.exists():
                    await self._read_new_lines()
            except Exception as e:
                logger.error(f"Erro no loop de leitura do log: {e}")

            await asyncio.sleep(1.5)

    async def _read_new_lines(self):
        try:
            with open(self.log_file, "r", encoding="utf-8", errors="replace") as f:
                all_lines = f.readlines()

            if len(all_lines) > self._last_line_read:
                new_lines = all_lines[self._last_line_read:]
                self._last_line_read = len(all_lines)

                for line in new_lines:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        step_data = json.loads(line)
                        await self._process_step(step_data)
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            logger.error(f"Erro lendo arquivo {self.log_file}: {e}")

    async def _process_step(self, step: Dict[str, Any]):
        if self._muted:
            return

        step_type = step.get("type", "")
        status = step.get("status", "")

        # 1. Raciocínio (thinking) - apenas no modo verbose
        thinking = step.get("thinking", "")
        if thinking and self.mode == "verbose":
            clean_thinking = thinking.strip()
            if len(clean_thinking) > 350:
                clean_thinking = clean_thinking[:340] + "..."
            event = BridgeEvent(
                event_type="thinking",
                title="🧠 Raciocinando...",
                details=clean_thinking,
                raw_step=step
            )
            await self._safe_emit(event)

        # 2. Chamadas de ferramentas (tool_calls)
        tool_calls = step.get("tool_calls", [])
        for tool in tool_calls:
            name = tool.get("name", "")
            args = tool.get("args", {})

            # No modo compacto, NÃO notifica leituras de arquivos (view_file) para não inundar o chat
            if self.mode == "compact" and name in ("view_file", "find_by_name", "grep_search"):
                continue

            title, details = self._format_tool_call(name, args)
            event = BridgeEvent(
                event_type="tool_call",
                title=title,
                details=details,
                raw_step=step
            )
            await self._safe_emit(event)

        # 3. Resposta de texto do agente para o usuário
        if step_type == "PLANNER_RESPONSE" and "content" in step:
            content = step.get("content", "").strip()
            if content:
                event = BridgeEvent(
                    event_type="response",
                    title="💬 Resposta do Antigravity",
                    details=content,
                    raw_step=step
                )
                await self._safe_emit(event)

                if not tool_calls and status == "DONE":
                    done_event = BridgeEvent(
                        event_type="done",
                        title="✅ Tarefa Concluída",
                        details="O agente terminou de responder e aguarda novas instruções.",
                        raw_step=step
                    )
                    await self._safe_emit(done_event)

    def _format_tool_call(self, name: str, args: Dict[str, Any]) -> Tuple[str, str]:
        if name == "run_command":
            cmd = args.get("CommandLine", "") or args.get("command", "")
            if len(cmd) > 200:
                cmd = cmd[:190] + "..."
            return "⚡ Executando comando", f"<code>{cmd}</code>"

        if name in ("write_to_file", "replace_file_content"):
            target = args.get("TargetFile", "") or args.get("path", "")
            basename = os.path.basename(target) if target else "arquivo"
            action = "Criando" if name == "write_to_file" else "Editando"
            desc = args.get("Description", "")
            details = f"<b>{basename}</b>"
            if desc:
                clean_desc = desc.replace('"', '').strip()
                details += f"\n<i>{clean_desc}</i>"
            return f"📝 {action} arquivo", details

        if name == "view_file":
            target = args.get("AbsolutePath", "") or args.get("path", "")
            basename = os.path.basename(target) if target else "arquivo"
            return "👀 Analisando arquivo", f"<code>{basename}</code>"

        if name in ("grep_search", "find_by_name"):
            query = args.get("Query", "") or args.get("Pattern", "")
            return "🔍 Pesquisando no projeto", f"<code>{query}</code>"

        if name == "read_url_content":
            url = args.get("Url", "")
            return "🌐 Acessando página web", f"{url}"

        if name == "invoke_subagent":
            role = args.get("Role", "Subagente")
            return "🤖 Acionando subagente", f"Papel: {role}"

        return f"🛠️ Executando {name}", json.dumps(args, ensure_ascii=False)[:150]

    async def _safe_emit(self, event: BridgeEvent):
        try:
            await self.on_event(event)
        except Exception as e:
            logger.error(f"Erro no callback de evento: {e}")

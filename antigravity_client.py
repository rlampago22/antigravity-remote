import asyncio
import json
import logging
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Tuple, Any

from config import AGENTAPI_PATH, ANTIGRAVITY_DIR, BRAIN_DIR, DEFAULT_MODEL

logger = logging.getLogger("antigravity_bridge.client")

ANNOTATIONS_DIR = ANTIGRAVITY_DIR / "annotations"
CUSTOM_TITLES_FILE = Path(__file__).parent / "custom_titles.json"

class AntigravityClient:
    def __init__(self, agentapi_path: Path = AGENTAPI_PATH, brain_dir: Path = BRAIN_DIR):
        self.agentapi_path = agentapi_path
        self.brain_dir = brain_dir
        self.annotations_dir = ANNOTATIONS_DIR
        self.custom_titles: Dict[str, str] = self._load_custom_titles()

        if not self.agentapi_path.exists():
            logger.warning(f"Executável agentapi não encontrado no caminho: {self.agentapi_path}")

    def _load_custom_titles(self) -> Dict[str, str]:
        if CUSTOM_TITLES_FILE.exists():
            try:
                with open(CUSTOM_TITLES_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def set_custom_title(self, conversation_id: str, title: str):
        self.custom_titles[conversation_id] = title.strip()
        try:
            with open(CUSTOM_TITLES_FILE, "w", encoding="utf-8") as f:
                json.dump(self.custom_titles, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Erro salvando título personalizado: {e}")

    def get_official_title(self, conversation_id: str) -> Optional[str]:
        """Obtém o título oficial exatamente como exibido na barra lateral do Antigravity."""
        # 1. Título customizado pelo usuário (se houver)
        if conversation_id in self.custom_titles:
            return self.custom_titles[conversation_id]

        # 2. Arquivo oficial .pbtxt de anotações do Antigravity
        ann_file = self.annotations_dir / f"{conversation_id}.pbtxt"
        if ann_file.exists():
            try:
                content = ann_file.read_text(encoding="utf-8", errors="replace")
                m = re.search(r'title:\s*"([^"]+)"', content)
                if m:
                    return m.group(1).strip()
            except Exception as e:
                logger.error(f"Erro lendo anotação {ann_file}: {e}")

        # 3. Fallback: extração do primeiro prompt no transcript
        transcript_file = self.brain_dir / conversation_id / ".system_generated" / "logs" / "transcript.jsonl"
        if transcript_file.exists():
            return self._extract_fallback_title(transcript_file)

        return None

    def list_recent_conversations(self, limit: int = 15) -> List[Dict[str, Any]]:
        """
        Lista as conversas exatamente como aparecem no Antigravity,
        usando os títulos oficiais do annotations/*.pbtxt e ordenação de visualização.
        """
        conversations = []
        now = time.time()

        # Coleta todas as conversas anotadas no Antigravity
        if self.annotations_dir.exists():
            for ann_file in self.annotations_dir.glob("*.pbtxt"):
                conv_id = ann_file.stem
                try:
                    content = ann_file.read_text(encoding="utf-8", errors="replace")
                    m_title = re.search(r'title:\s*"([^"]+)"', content)
                    title = m_title.group(1).strip() if m_title else None
                    if not title:
                        continue

                    m_time = re.search(r'seconds:\s*(\d+)', content)
                    last_view_ts = int(m_time.group(1)) if m_time else 0

                    transcript_file = self.brain_dir / conv_id / ".system_generated" / "logs" / "transcript.jsonl"
                    mtime = transcript_file.stat().st_mtime if transcript_file.exists() else last_view_ts

                    # Considera executando se o transcript foi modificado nos últimos 3 minutos
                    is_running = (now - mtime) < 180

                    conversations.append({
                        "id": conv_id,
                        "title": title,
                        "sort_key": max(last_view_ts, int(mtime)),
                        "mtime": mtime,
                        "is_running": is_running,
                        "date_str": datetime.fromtimestamp(mtime).strftime("%d/%m %H:%M")
                    })
                except Exception as e:
                    logger.error(f"Erro processando conversa {conv_id}: {e}")

        # Ordena pelo timestamp decrescente (exatamente igual à barra lateral)
        conversations.sort(key=lambda c: c["sort_key"], reverse=True)
        return conversations[:limit]

    def get_conversation_summary(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        """Lê o transcript de uma conversa e monta um resumo detalhado para inspeção."""
        transcript_file = self.brain_dir / conversation_id / ".system_generated" / "logs" / "transcript.jsonl"
        title = self.get_official_title(conversation_id) or f"Chat {conversation_id[:8]}"

        if not transcript_file.exists():
            return {
                "id": conversation_id,
                "title": title,
                "is_running": False,
                "date_str": "Sem data",
                "total_steps": 0,
                "last_user_prompt": "Nenhuma interação gravada",
                "last_agent_response": "Sem mensagens",
                "last_tool_action": "Nenhuma ação"
            }

        mtime = transcript_file.stat().st_mtime
        is_running = (time.time() - mtime) < 180

        last_user_prompt = ""
        last_agent_response = ""
        last_tool_action = ""
        total_steps = 0

        try:
            with open(transcript_file, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
                total_steps = len(lines)

                for line in reversed(lines):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        step = json.loads(line)
                        stype = step.get("type", "")

                        if not last_agent_response and stype == "PLANNER_RESPONSE" and step.get("content"):
                            resp = step.get("content", "").strip()
                            if resp:
                                last_agent_response = resp[:400] + ("..." if len(resp) > 400 else "")

                        if not last_tool_action and step.get("tool_calls"):
                            tools = step.get("tool_calls", [])
                            if tools:
                                t = tools[0]
                                tname = t.get("name", "")
                                targs = t.get("args", {})
                                if tname == "run_command":
                                    last_tool_action = f"Terminal: {targs.get('CommandLine', '')[:80]}"
                                elif tname in ("write_to_file", "replace_file_content"):
                                    path = os.path.basename(targs.get("TargetFile", ""))
                                    last_tool_action = f"Arquivo: {path}"
                                elif tname == "view_file":
                                    path = os.path.basename(targs.get("AbsolutePath", ""))
                                    last_tool_action = f"Lendo: {path}"
                                else:
                                    last_tool_action = f"Ferramenta: {tname}"

                        if not last_user_prompt and stype == "USER_INPUT":
                            raw = step.get("content", "")
                            req = re.search(r"<USER_REQUEST>(.*?)</USER_REQUEST>", raw, re.DOTALL)
                            clean = req.group(1).strip() if req else raw.split("<ADDITIONAL_METADATA>")[0].strip()
                            clean = " ".join(clean.split())
                            last_user_prompt = clean[:250] + ("..." if len(clean) > 250 else "")

                        if last_user_prompt and last_agent_response and last_tool_action:
                            break
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            logger.error(f"Erro gerando resumo da conversa {conversation_id}: {e}")

        return {
            "id": conversation_id,
            "title": title,
            "is_running": is_running,
            "mtime": mtime,
            "date_str": datetime.fromtimestamp(mtime).strftime("%d/%m %H:%M"),
            "total_steps": total_steps,
            "last_user_prompt": last_user_prompt or "Nenhum prompt encontrado",
            "last_agent_response": last_agent_response or "(Aguardando resposta do agente)",
            "last_tool_action": last_tool_action or "Nenhuma ação recente",
        }

    async def new_conversation(
        self, prompt: str, model: Optional[str] = None, title: Optional[str] = None
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        model = model or DEFAULT_MODEL
        cmd = [str(self.agentapi_path), "new-conversation", f"--model={model}"]
        if title:
            cmd.append(f"--title={title}")
        cmd.append(prompt)

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()

            if proc.returncode != 0:
                err_msg = stderr.decode(errors="replace").strip() or stdout.decode(errors="replace").strip()
                logger.error(f"Erro ao criar nova conversa: {err_msg}")
                return False, None, err_msg

            output = stdout.decode(errors="replace").strip()
            try:
                data = json.loads(output)
                conv_id = data.get("response", {}).get("newConversation", {}).get("conversationId")
                if conv_id:
                    return True, conv_id, None
            except json.JSONDecodeError:
                pass

            match = re.search(r'"conversationId":\s*"([^"]+)"', output)
            if match:
                return True, match.group(1), None

            return False, None, f"Resposta inesperada do agentapi: {output[:200]}"

        except Exception as e:
            logger.exception("Exceção ao invocar new_conversation")
            return False, None, str(e)

    async def send_message(self, conversation_id: str, content: str) -> Tuple[bool, Optional[str]]:
        cmd = [str(self.agentapi_path), "send-message", conversation_id, content]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()

            if proc.returncode != 0:
                err_msg = stderr.decode(errors="replace").strip() or stdout.decode(errors="replace").strip()
                logger.error(f"Erro ao enviar mensagem: {err_msg}")
                return False, err_msg

            return True, None

        except Exception as e:
            logger.exception("Exceção ao invocar send_message")
            return False, str(e)

    def _extract_fallback_title(self, transcript_file: Path) -> Optional[str]:
        try:
            with open(transcript_file, "r", encoding="utf-8", errors="replace") as f:
                first_line = f.readline()
                if not first_line:
                    return None
                data = json.loads(first_line)
                raw = data.get("content", "")
                m = re.search(r"<USER_REQUEST>(.*?)</USER_REQUEST>", raw, re.DOTALL)
                clean = m.group(1).strip() if m else raw.split("<ADDITIONAL_METADATA>")[0].strip()
                clean = " ".join(clean.split())
                return clean[:45] + ("..." if len(clean) > 45 else "")
        except Exception:
            return None

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  Brain,
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileText,
  Folder,
  GitBranch,
  Loader2,
  Paperclip,
  RefreshCw,
  Send,
  Sparkles,
  Terminal,
  Wrench,
  X,
} from 'lucide-react';
import { runRemoteCommand, uploadAttachment } from '@/lib/remote-client';
import { VoiceInputButton } from '@/components/voice-input';

interface ToolCallItem {
  name: string;
  args: Record<string, unknown>;
  summary?: string;
}

interface ConvEvent {
  id: string;
  stepIndex: number;
  kind: 'user' | 'assistant' | 'tool_result' | 'system';
  source: string;
  model: string | null;
  content: string;
  thinking: string | null;
  toolCalls: ToolCallItem[];
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  machineId: string;
  machineName: string;
  machineOnline: boolean;
  externalId: string;
  title: string;
  workspacePath: string | null;
  branchName: string | null;
  model: string | null;
  status: 'idle' | 'running' | 'needs_attention' | 'error';
  gitSummary: { dirtyCount: number; files: Array<{ path: string; status: string }> } | null;
}

type TabKey = 'chat' | 'diff' | 'files' | 'artifacts';

function DiffViewer({ diff }: { diff: string }) {
  if (!diff.trim()) {
    return <p className="py-8 text-center text-xs text-slate-400">Nenhuma alteração pendente.</p>;
  }
  return (
    <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0b0f17] p-3 font-mono text-[11px] leading-relaxed">
      {diff.split('\n').map((line, i) => {
        let cls = 'text-slate-300';
        if (line.startsWith('+') && !line.startsWith('+++')) cls = 'bg-emerald-500/10 text-emerald-300';
        else if (line.startsWith('-') && !line.startsWith('---')) cls = 'bg-rose-500/10 text-rose-300';
        else if (line.startsWith('@@') || line.startsWith('diff --git')) cls = 'text-sky-400 font-semibold';
        return (
          <div key={i} className={`px-1 ${cls}`}>
            {line || ' '}
          </div>
        );
      })}
    </pre>
  );
}

function CollapsibleBlock({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-1.5 rounded-xl border border-slate-800/90 bg-[#0b0f17]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-300"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        )}
        {icon}
        <span className="truncate font-medium">{label}</span>
      </button>
      {open && (
        <div className="border-t border-slate-800/80 px-3 py-2.5 text-xs text-slate-300">
          {children}
        </div>
      )}
    </div>
  );
}

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const convId = params.id;

  const [tab, setTab] = useState<TabKey>('chat');
  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [events, setEvents] = useState<ConvEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Composer state
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Array<{ id: string; filename: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [composerErr, setComposerErr] = useState<string | null>(null);

  // Secondary tabs state
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<{
    branch: string | null;
    files: Array<{ path: string; status: string }>;
    diff: string;
  } | null>(null);
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | undefined>(undefined);

  const [currentDir, setCurrentDir] = useState('');
  const [fileEntries, setFileEntries] = useState<
    Array<{ name: string; relativePath: string; type: 'dir' | 'file'; size?: number }>
  >([]);
  const [openFile, setOpenFile] = useState<{ path: string; content: string; truncated: boolean } | null>(
    null
  );

  const [artifacts, setArtifacts] = useState<
    Array<{ name: string; relativePath: string; kind: 'markdown' | 'image' | 'text'; updatedAt: string }>
  >([]);
  const [openArtifact, setOpenArtifact] = useState<{
    relativePath: string;
    kind: 'markdown' | 'image' | 'text';
    content: string;
    mimeType: string;
  } | null>(null);

  const lastStepRef = useRef<number>(-1);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const fetchIncremental = useCallback(
    async (reset = false) => {
      const qs = !reset && lastStepRef.current >= 0 ? `?afterStep=${lastStepRef.current}` : '';
      const res = await fetch(`/api/conversations/${encodeURIComponent(convId)}${qs}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = (await res.json()) as {
        conversation: ConversationDetail;
        events: ConvEvent[];
      };
      setConv(data.conversation);
      if (reset) {
        setEvents(data.events);
      } else if (data.events.length > 0) {
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => e.stepIndex));
          const merged = [...prev, ...data.events.filter((e) => !seen.has(e.stepIndex))];
          merged.sort((a, b) => a.stepIndex - b.stepIndex);
          return merged;
        });
      }
      if (data.events.length > 0) {
        const maxStep = Math.max(...data.events.map((e) => e.stepIndex));
        lastStepRef.current = Math.max(lastStepRef.current, maxStep);
      }
      setLoading(false);
    },
    [convId]
  );

  useEffect(() => {
    lastStepRef.current = -1;
    fetchIncremental(true);
  }, [fetchIncremental]);

  useEffect(() => {
    const interval = conv?.status === 'running' ? 2200 : 5000;
    const t = setInterval(() => {
      if (!document.hidden && tab === 'chat') fetchIncremental(false);
    }, interval);
    return () => clearInterval(t);
  }, [conv?.status, tab, fetchIncremental]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!conv || !input.trim()) return;
    setSending(true);
    setComposerErr(null);

    try {
      await runRemoteCommand({
        machineId: conv.machineId,
        conversationExternalId: conv.externalId,
        type: 'send_message',
        payload: {
          conversationId: conv.externalId,
          content: input.trim(),
          attachmentIds: attachments.map((a) => a.id),
        },
      });
      setInput('');
      setAttachments([]);
      setTimeout(() => fetchIncremental(false), 1200);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 400);
    } catch (err) {
      setComposerErr(err instanceof Error ? err.message : 'Falha ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  }

  async function onAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !conv) return;
    setUploading(true);
    setComposerErr(null);
    try {
      const up = await uploadAttachment(conv.machineId, file);
      setAttachments((prev) => [...prev, { id: up.id, filename: up.filename }]);
    } catch (err) {
      setComposerErr(err instanceof Error ? err.message : 'Erro no anexo.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function loadDiff(relativeFile?: string) {
    if (!conv?.workspacePath) {
      setTabError('Esta conversa não possui workspace associado.');
      return;
    }
    setTabLoading(true);
    setTabError(null);
    setSelectedDiffFile(relativeFile);
    try {
      const res = await runRemoteCommand<{
        branch: string | null;
        files: Array<{ path: string; status: string }>;
        diff: string;
      }>({
        machineId: conv.machineId,
        conversationExternalId: conv.externalId,
        type: 'git_diff',
        payload: { workspacePath: conv.workspacePath, relativeFile },
      });
      setDiffData(res);
    } catch (err) {
      setTabError(err instanceof Error ? err.message : 'Erro ao buscar git diff.');
    } finally {
      setTabLoading(false);
    }
  }

  async function loadDir(relativeDir = '') {
    if (!conv?.workspacePath) {
      setTabError('Esta conversa não possui workspace associado.');
      return;
    }
    setTabLoading(true);
    setTabError(null);
    setOpenFile(null);
    try {
      const res = await runRemoteCommand<{
        relativeDir: string;
        entries: Array<{ name: string; relativePath: string; type: 'dir' | 'file'; size?: number }>;
      }>({
        machineId: conv.machineId,
        type: 'list_files',
        payload: { workspacePath: conv.workspacePath, relativeDir },
      });
      setCurrentDir(res.relativeDir || '');
      setFileEntries(res.entries || []);
    } catch (err) {
      setTabError(err instanceof Error ? err.message : 'Erro ao listar arquivos.');
    } finally {
      setTabLoading(false);
    }
  }

  async function loadFile(relativePath: string) {
    if (!conv?.workspacePath) return;
    setTabLoading(true);
    setTabError(null);
    try {
      const res = await runRemoteCommand<{ path: string; content: string; truncated: boolean }>({
        machineId: conv.machineId,
        type: 'read_file',
        payload: { workspacePath: conv.workspacePath, relativePath },
      });
      setOpenFile(res);
    } catch (err) {
      setTabError(err instanceof Error ? err.message : 'Erro ao abrir arquivo.');
    } finally {
      setTabLoading(false);
    }
  }

  async function loadArtifacts() {
    if (!conv) return;
    setTabLoading(true);
    setTabError(null);
    setOpenArtifact(null);
    try {
      const res = await runRemoteCommand<{
        artifacts: Array<{
          name: string;
          relativePath: string;
          kind: 'markdown' | 'image' | 'text';
          updatedAt: string;
        }>;
      }>({
        machineId: conv.machineId,
        conversationExternalId: conv.externalId,
        type: 'list_artifacts',
        payload: { conversationId: conv.externalId },
      });
      setArtifacts(res.artifacts || []);
    } catch (err) {
      setTabError(err instanceof Error ? err.message : 'Erro ao listar artefatos.');
    } finally {
      setTabLoading(false);
    }
  }

  async function readArtifact(relativePath: string) {
    if (!conv) return;
    setTabLoading(true);
    setTabError(null);
    try {
      const res = await runRemoteCommand<{
        relativePath: string;
        kind: 'markdown' | 'image' | 'text';
        content: string;
        mimeType: string;
      }>({
        machineId: conv.machineId,
        conversationExternalId: conv.externalId,
        type: 'read_artifact',
        payload: { conversationId: conv.externalId, relativePath },
      });
      setOpenArtifact(res);
    } catch (err) {
      setTabError(err instanceof Error ? err.message : 'Erro ao ler artefato.');
    } finally {
      setTabLoading(false);
    }
  }

  function switchTab(next: TabKey) {
    setTab(next);
    setTabError(null);
    if (next === 'diff' && !diffData) loadDiff();
    if (next === 'files' && fileEntries.length === 0) loadDir('');
    if (next === 'artifacts' && artifacts.length === 0) loadArtifacts();
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col bg-[#090b10]">
      <header className="shrink-0 border-b border-slate-800/80 bg-[#090b10]/95 px-3 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-[#11151e] text-slate-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-white">
              {conv?.title || 'Carregando...'}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    conv?.status === 'running'
                      ? 'bg-sky-400 animate-pulse'
                      : conv?.status === 'needs_attention'
                        ? 'bg-amber-400'
                        : conv?.machineOnline
                          ? 'bg-emerald-400'
                          : 'bg-slate-600'
                  }`}
                />
                {conv?.status === 'running'
                  ? 'Executando'
                  : conv?.status === 'needs_attention'
                    ? 'Aguardando resposta'
                    : conv?.machineOnline
                      ? conv.machineName
                      : 'Notebook offline'}
              </span>
              {conv?.branchName && (
                <span className="inline-flex items-center gap-0.5 text-slate-500">
                  <GitBranch className="h-3 w-3" />
                  {conv.branchName}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => fetchIncremental(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-[#11151e] text-slate-300"
            title="Recarregar conversa"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <nav className="mt-2.5 grid grid-cols-4 gap-1 rounded-xl border border-slate-800/80 bg-[#11151e] p-1 text-xs">
          {(
            [
              ['chat', 'Chat', Terminal],
              ['diff', 'Git Diff', GitBranch],
              ['files', 'Arquivos', FileCode2],
              ['artifacts', 'Artefatos', Sparkles],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium transition ${
                tab === key
                  ? 'bg-sky-500/15 text-sky-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto px-3.5 py-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
          </div>
        ) : tab === 'chat' ? (
          <div className="space-y-3 pb-4">
            {events.map((ev) => {
              if (ev.kind === 'user') {
                return (
                  <div key={ev.id} className="flex justify-end">
                    <div className="max-w-[88%] rounded-2xl rounded-br-sm border border-sky-500/30 bg-sky-500/15 px-3.5 py-2.5 text-sm text-slate-100 whitespace-pre-wrap">
                      {ev.content}
                    </div>
                  </div>
                );
              }

              if (ev.kind === 'tool_result') {
                return (
                  <CollapsibleBlock
                    key={ev.id}
                    icon={<Terminal className="h-3.5 w-3.5 text-slate-400" />}
                    label={`Saída da ferramenta (step #${ev.stepIndex})`}
                  >
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-slate-300">
                      {ev.content}
                    </pre>
                  </CollapsibleBlock>
                );
              }

              return (
                <div
                  key={ev.id}
                  className="rounded-2xl border border-slate-800/80 bg-[#11151e] p-3.5"
                >
                  {ev.thinking && (
                    <CollapsibleBlock
                      icon={<Brain className="h-3.5 w-3.5 text-violet-400" />}
                      label="Raciocínio do agente"
                    >
                      <p className="whitespace-pre-wrap text-slate-400">{ev.thinking}</p>
                    </CollapsibleBlock>
                  )}

                  {ev.toolCalls.length > 0 && (
                    <div className="my-1.5 space-y-1">
                      {ev.toolCalls.map((tc, idx) => (
                        <CollapsibleBlock
                          key={idx}
                          icon={<Wrench className="h-3.5 w-3.5 text-sky-400" />}
                          label={tc.summary || tc.name}
                        >
                          <pre className="overflow-x-auto font-mono text-[11px] text-slate-400">
                            {JSON.stringify(tc.args, null, 2)}
                          </pre>
                        </CollapsibleBlock>
                      ))}
                    </div>
                  )}

                  {ev.content && (
                    <div className="prose-remote mt-1.5 text-slate-100">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{ev.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        ) : tab === 'diff' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {diffData?.branch ? `Branch: ${diffData.branch}` : 'Git status'}
              </p>
              <button
                onClick={() => loadDiff(selectedDiffFile)}
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#11151e] px-2.5 py-1.5 text-xs text-slate-300"
              >
                <RefreshCw className="h-3 w-3" />
                Atualizar
              </button>
            </div>
            {tabLoading && <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-sky-400" />}
            {tabError && <p className="text-xs text-rose-300">{tabError}</p>}
            {!tabLoading && diffData && (
              <>
                {diffData.files.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => loadDiff(undefined)}
                      className={`rounded-lg px-2.5 py-1 text-xs ${
                        !selectedDiffFile
                          ? 'bg-sky-500/20 text-sky-300'
                          : 'bg-[#11151e] text-slate-400'
                      }`}
                    >
                      Todos ({diffData.files.length})
                    </button>
                    {diffData.files.map((f) => (
                      <button
                        key={f.path}
                        onClick={() => loadDiff(f.path)}
                        className={`rounded-lg px-2.5 py-1 text-xs ${
                          selectedDiffFile === f.path
                            ? 'bg-sky-500/20 text-sky-300'
                            : 'bg-[#11151e] text-slate-300'
                        }`}
                      >
                        <span className="mr-1 font-mono text-amber-300">{f.status}</span>
                        {f.path}
                      </button>
                    ))}
                  </div>
                )}
                <DiffViewer diff={diffData.diff} />
              </>
            )}
          </div>
        ) : tab === 'files' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="truncate font-mono text-xs text-slate-400">
                /{currentDir || ''}
              </p>
              {currentDir && (
                <button
                  onClick={() => {
                    const parent = currentDir.split('/').slice(0, -1).join('/');
                    loadDir(parent);
                  }}
                  className="rounded-lg border border-slate-800 bg-[#11151e] px-2.5 py-1 text-xs text-slate-300"
                >
                  Subir pasta
                </button>
              )}
            </div>
            {tabLoading && <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-sky-400" />}
            {tabError && <p className="text-xs text-rose-300">{tabError}</p>}
            {!tabLoading && openFile ? (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-xs text-sky-300">{openFile.path}</span>
                  <button
                    onClick={() => setOpenFile(null)}
                    className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-200"
                  >
                    Voltar
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0b0f17] p-3 font-mono text-[11px] text-slate-200">
                  {openFile.content}
                </pre>
              </div>
            ) : (
              !tabLoading && (
                <div className="divide-y divide-slate-800/70 rounded-2xl border border-slate-800/80 bg-[#11151e]">
                  {fileEntries.map((entry) => (
                    <button
                      key={entry.relativePath}
                      onClick={() =>
                        entry.type === 'dir'
                          ? loadDir(entry.relativePath)
                          : loadFile(entry.relativePath)
                      }
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs text-slate-200 hover:bg-slate-800/40"
                    >
                      {entry.type === 'dir' ? (
                        <Folder className="h-4 w-4 text-sky-400" />
                      ) : (
                        <FileText className="h-4 w-4 text-slate-400" />
                      )}
                      <span className="flex-1 truncate">{entry.name}</span>
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">Artefatos gerados na conversa</p>
              <button
                onClick={loadArtifacts}
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#11151e] px-2.5 py-1 text-xs text-slate-300"
              >
                <RefreshCw className="h-3 w-3" />
                Atualizar
              </button>
            </div>
            {tabLoading && <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-sky-400" />}
            {tabError && <p className="text-xs text-rose-300">{tabError}</p>}
            {!tabLoading && openArtifact ? (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-xs text-sky-300">
                    {openArtifact.relativePath}
                  </span>
                  <button
                    onClick={() => setOpenArtifact(null)}
                    className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-200"
                  >
                    Voltar
                  </button>
                </div>
                {openArtifact.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:${openArtifact.mimeType};base64,${openArtifact.content}`}
                    alt={openArtifact.relativePath}
                    className="w-full rounded-xl border border-slate-800"
                  />
                ) : openArtifact.kind === 'markdown' ? (
                  <div className="prose-remote rounded-2xl border border-slate-800 bg-[#11151e] p-4">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {openArtifact.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0b0f17] p-3 font-mono text-[11px] text-slate-200">
                    {openArtifact.content}
                  </pre>
                )}
              </div>
            ) : (
              !tabLoading && (
                <div className="divide-y divide-slate-800/70 rounded-2xl border border-slate-800/80 bg-[#11151e]">
                  {artifacts.length === 0 ? (
                    <p className="p-6 text-center text-xs text-slate-400">
                      Nenhum artefato encontrado nesta conversa.
                    </p>
                  ) : (
                    artifacts.map((art) => (
                      <button
                        key={art.relativePath}
                        onClick={() => readArtifact(art.relativePath)}
                        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-xs text-slate-200 hover:bg-slate-800/40"
                      >
                        <Sparkles className="h-4 w-4 text-sky-400" />
                        <span className="flex-1 truncate">{art.relativePath}</span>
                      </button>
                    ))
                  )}
                </div>
              )
            )}
          </div>
        )}
      </main>

      {tab === 'chat' && (
        <footer className="shrink-0 border-t border-slate-800/80 bg-[#090b10] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map((att) => (
                <span
                  key={att.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-200"
                >
                  {att.filename}
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((a) => a.id !== att.id))
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {composerErr && (
            <p className="mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300">
              {composerErr}
            </p>
          )}

          <form onSubmit={handleSend} className="flex items-end gap-2">
            <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
              <input type="file" className="hidden" onChange={onAttach} />
            </label>

            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                conv?.machineOnline
                  ? 'Enviar instrução para o agente...'
                  : 'Notebook offline (aguardando conexão)...'
              }
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-slate-800 bg-[#11151e] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-500"
            />

            <VoiceInputButton
              onTranscript={(txt) => setInput((prev) => (prev ? `${prev} ${txt}` : txt))}
              disabled={sending}
            />

            <button
              type="submit"
              disabled={sending || !conv?.machineOnline || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-slate-950 transition hover:bg-sky-400 disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </footer>
      )}
    </div>
  );
}

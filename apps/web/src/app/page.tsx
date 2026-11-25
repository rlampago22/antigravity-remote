'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  FolderGit2,
  GitBranch,
  Laptop,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  Terminal,
} from 'lucide-react';
import { NewTaskSheet, type MachineSummary } from '@/components/new-task-sheet';

interface ConversationItem {
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
  lastUserPrompt: string | null;
  lastAgentPreview: string | null;
  gitSummary: { dirtyCount: number; branch?: string | null } | null;
  updatedAt: string;
}

function formatRelative(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'agora';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function basename(p: string | null): string | null {
  if (!p) return null;
  return p.split(/[\\/]/).filter(Boolean).pop() || p;
}

export default function HomePage() {
  const [machines, setMachines] = useState<MachineSummary[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [mRes, cRes] = await Promise.all([
        fetch('/api/machines', { cache: 'no-store' }),
        fetch('/api/conversations', { cache: 'no-store' }),
      ]);
      if (mRes.ok) {
        const d = (await mRes.json()) as { machines: MachineSummary[] };
        setMachines(d.machines);
      }
      if (cRes.ok) {
        const d = (await cRes.json()) as { conversations: ConversationItem[] };
        setConversations(d.conversations);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      if (!document.hidden) loadData();
    }, 4500);
    return () => clearInterval(timer);
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (selectedMachine !== 'all' && c.machineId !== selectedMachine) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        (c.workspacePath || '').toLowerCase().includes(q) ||
        (c.lastAgentPreview || '').toLowerCase().includes(q)
      );
    });
  }, [conversations, selectedMachine, query]);

  const onlineCount = machines.filter((m) => m.online).length;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col pb-24">
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-[#090b10]/90 px-4 py-3.5 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Antigravity Remote</h1>
              <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    onlineCount > 0 ? 'bg-emerald-400' : 'bg-slate-600'
                  }`}
                />
                {machines.length === 0
                  ? 'Nenhum notebook pareado'
                  : onlineCount > 0
                    ? `${onlineCount} notebook online`
                    : 'Notebooks offline (modo leitura)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => loadData()}
              aria-label="Atualizar"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-[#11151e] text-slate-300 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <Link
              href="/pair"
              aria-label="Parear notebook"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-[#11151e] text-slate-300 hover:text-white"
            >
              <QrCode className="h-4 w-4" />
            </Link>
            <Link
              href="/settings"
              aria-label="Configurações"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-[#11151e] text-slate-300 hover:text-white"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar conversas ou projetos..."
              className="w-full rounded-xl border border-slate-800 bg-[#11151e] py-2 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 outline-none focus:border-sky-500"
            />
          </div>

          {machines.length > 1 && (
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              className="rounded-xl border border-slate-800 bg-[#11151e] px-2.5 py-2 text-xs text-slate-200 outline-none"
            >
              <option value="all">Todas</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
            <p className="mt-2 text-xs">Sincronizando sessões...</p>
          </div>
        ) : machines.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-800/80 bg-[#11151e] p-6 text-center">
            <Laptop className="mx-auto h-10 w-10 text-sky-400" />
            <h2 className="mt-3 text-base font-semibold text-white">Conecte seu notebook</h2>
            <p className="mt-1.5 text-xs text-slate-400">
              Inicie o daemon no seu computador com{' '}
              <code className="rounded bg-slate-900 px-1.5 py-0.5 text-sky-300">
                npm run daemon:pair
              </code>{' '}
              e aprove o código aqui.
            </p>
            <Link
              href="/pair"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
            >
              <QrCode className="h-4 w-4" />
              Parear máquina
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            Nenhuma conversa sincronizada ainda. Crie uma nova tarefa ou aguarde o daemon sincronizar.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((conv) => {
              const wsName = basename(conv.workspacePath);
              return (
                <Link
                  key={conv.id}
                  href={`/conversations/${conv.id}`}
                  className="block rounded-2xl border border-slate-800/80 bg-[#11151e] p-4 transition active:scale-[0.99] hover:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {conv.status === 'running' && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400 animate-pulse" />
                        )}
                        {conv.status === 'needs_attention' && (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        )}
                        {conv.status === 'idle' && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500/70" />
                        )}
                        <h2 className="truncate text-sm font-semibold text-white">
                          {conv.title}
                        </h2>
                      </div>

                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                        {conv.lastAgentPreview || conv.lastUserPrompt || 'Sem mensagens ainda'}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-500">
                      {formatRelative(conv.updatedAt)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {wsName && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-[#090b10] px-2 py-0.5 text-slate-300">
                        <FolderGit2 className="h-3 w-3 text-slate-500" />
                        {wsName}
                      </span>
                    )}
                    {conv.branchName && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-[#090b10] px-2 py-0.5 text-slate-400">
                        <GitBranch className="h-3 w-3 text-sky-400" />
                        {conv.branchName}
                      </span>
                    )}
                    {conv.gitSummary && conv.gitSummary.dirtyCount > 0 && (
                      <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-medium text-amber-300">
                        {conv.gitSummary.dirtyCount} alterados
                      </span>
                    )}
                    {conv.status === 'running' && (
                      <span className="rounded-md bg-sky-500/15 px-2 py-0.5 font-medium text-sky-300">
                        Executando
                      </span>
                    )}
                    {conv.status === 'needs_attention' && (
                      <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-medium text-amber-300">
                        Aguardando você
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {machines.length > 0 && (
        <button
          onClick={() => setNewTaskOpen(true)}
          className="fixed bottom-6 right-5 z-30 flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Nova tarefa
        </button>
      )}

      <NewTaskSheet
        machines={machines}
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        onCreated={() => {
          setTimeout(loadData, 1200);
        }}
      />
    </div>
  );
}

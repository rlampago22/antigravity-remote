'use client';

import { useState } from 'react';
import { Loader2, Paperclip, Send, X } from 'lucide-react';
import { MODEL_OPTIONS } from '@antigravity-remote/protocol';
import { runRemoteCommand, uploadAttachment } from '@/lib/remote-client';
import { VoiceInputButton } from './voice-input';

export interface MachineSummary {
  id: string;
  name: string;
  hostname: string;
  online: boolean;
  workspaces: Array<{ name: string; path: string; gitBranch?: string | null }>;
}

export function NewTaskSheet({
  machines,
  open,
  onClose,
  onCreated,
}: {
  machines: MachineSummary[];
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const defaultMachine = machines.find((m) => m.online) || machines[0];
  const [machineId, setMachineId] = useState(defaultMachine?.id || '');
  const activeMachine = machines.find((m) => m.id === machineId) || defaultMachine;

  const [workspacePath, setWorkspacePath] = useState(
    activeMachine?.workspaces[0]?.path || ''
  );
  const [model, setModel] = useState<string>('flash');
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<Array<{ id: string; filename: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeMachine) return;
    setUploading(true);
    setError(null);
    try {
      const up = await uploadAttachment(activeMachine.id, file);
      setAttachments((prev) => [...prev, { id: up.id, filename: up.filename }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no upload.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeMachine || !prompt.trim()) return;
    setSending(true);
    setError(null);

    try {
      await runRemoteCommand({
        machineId: activeMachine.id,
        type: 'new_conversation',
        payload: {
          prompt: prompt.trim(),
          model,
          title: title.trim() || undefined,
          workspacePath: workspacePath || undefined,
          attachmentIds: attachments.map((a) => a.id),
        },
      });
      setPrompt('');
      setTitle('');
      setAttachments([]);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao iniciar tarefa.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs sm:items-center">
      <div className="w-full max-w-lg rounded-t-3xl border border-slate-800 bg-[#11151e] p-5 pb-7 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Nova tarefa no Antigravity</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!activeMachine ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Pareie um notebook primeiro para criar tarefas.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {machines.length > 1 && (
              <div>
                <label className="mb-1 block text-xs text-slate-400">Máquina</label>
                <select
                  value={activeMachine.id}
                  onChange={(e) => {
                    setMachineId(e.target.value);
                    const next = machines.find((m) => m.id === e.target.value);
                    setWorkspacePath(next?.workspaces[0]?.path || '');
                  }}
                  className="w-full rounded-xl border border-slate-800 bg-[#090b10] px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
                >
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.online ? '(Online)' : '(Offline)'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Projeto / Pasta</label>
                <select
                  value={workspacePath}
                  onChange={(e) => setWorkspacePath(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-[#090b10] px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
                >
                  <option value="">Padrão do Antigravity</option>
                  {activeMachine.workspaces.map((w) => (
                    <option key={w.path} value={w.path}>
                      {w.name} {w.gitBranch ? `(${w.gitBranch})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">Modelo</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-[#090b10] px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
                >
                  {MODEL_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Título (opcional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Corrigir login no mobile"
                className="w-full rounded-xl border border-slate-800 bg-[#090b10] px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Instrução para o agente</label>
              <textarea
                rows={4}
                required
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Descreva o que o Antigravity deve fazer no seu notebook..."
                className="w-full resize-none rounded-xl border border-slate-800 bg-[#090b10] p-3 text-sm text-white outline-none focus:border-sky-500"
              />
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((att) => (
                  <span
                    key={att.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs text-sky-200"
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

            {error && (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <label className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-white">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                  <input type="file" className="hidden" onChange={onFileChange} />
                </label>
                <VoiceInputButton
                  onTranscript={(txt) => setPrompt((prev) => (prev ? `${prev} ${txt}` : txt))}
                  disabled={sending}
                />
              </div>

              <button
                type="submit"
                disabled={sending || !activeMachine.online || !prompt.trim()}
                className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {activeMachine.online ? 'Iniciar tarefa' : 'Notebook offline'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

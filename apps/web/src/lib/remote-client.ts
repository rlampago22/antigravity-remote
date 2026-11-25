import type { CommandType } from '@antigravity-remote/protocol';

export async function enqueueCommand(params: {
  machineId: string;
  conversationExternalId?: string | null;
  type: CommandType;
  payload?: Record<string, unknown>;
}): Promise<{ id: string; status: string }> {
  const res = await fetch('/api/commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      machineId: params.machineId,
      conversationExternalId: params.conversationExternalId ?? null,
      type: params.type,
      payload: params.payload ?? {},
    }),
  });
  const data = (await res.json()) as { id?: string; status?: string; error?: string };
  if (!res.ok || !data.id) {
    throw new Error(data.error || 'Não foi possível enviar o comando.');
  }
  return { id: data.id, status: data.status || 'pending' };
}

export async function runRemoteCommand<T = unknown>(
  params: {
    machineId: string;
    conversationExternalId?: string | null;
    type: CommandType;
    payload?: Record<string, unknown>;
  },
  timeoutMs = 25_000
): Promise<T> {
  const { id } = await enqueueCommand(params);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 900));
    const res = await fetch(`/api/commands/${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!res.ok) continue;
    const data = (await res.json()) as {
      status: 'pending' | 'running' | 'completed' | 'failed';
      result?: T;
      error?: string | null;
    };
    if (data.status === 'completed') return data.result as T;
    if (data.status === 'failed') {
      throw new Error(data.error || 'O daemon retornou erro ao executar o comando.');
    }
  }

  throw new Error('Tempo esgotado aguardando o notebook responder. Verifique se o daemon está online.');
}

export async function uploadAttachment(machineId: string, file: File) {
  const form = new FormData();
  form.append('machineId', machineId);
  form.append('file', file);
  const res = await fetch('/api/attachments', { method: 'POST', body: form });
  const data = (await res.json()) as {
    id?: string;
    filename?: string;
    mimeType?: string;
    sizeBytes?: number;
    error?: string;
  };
  if (!res.ok || !data.id) {
    throw new Error(data.error || 'Falha no envio do anexo.');
  }
  return {
    id: data.id,
    filename: data.filename || file.name,
    mimeType: data.mimeType || file.type,
    sizeBytes: data.sizeBytes || file.size,
  };
}

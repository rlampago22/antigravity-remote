import type {
  CompleteCommandRequest,
  DaemonHeartbeat,
  DaemonSyncPayload,
  PairingInitRequest,
} from '@antigravity-remote/protocol';

export interface PolledCommand {
  id: string;
  conversationExternalId: string | null;
  type:
    | 'new_conversation'
    | 'send_message'
    | 'list_files'
    | 'read_file'
    | 'git_diff'
    | 'list_artifacts'
    | 'read_artifact'
    | 'refresh_sync';
  payload: Record<string, unknown>;
}

export class RemoteRelayClient {
  constructor(
    private readonly serverUrl: string,
    private readonly machineToken?: string
  ) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.machineToken) {
      h.Authorization = `Bearer ${this.machineToken}`;
    }
    return h;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetch(`${this.serverUrl}${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init.headers as Record<string, string> | undefined) },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} em ${path}: ${body.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  async initPairing(body: PairingInitRequest): Promise<{
    code: string;
    pollSecret: string;
    expiresAt: string;
    pairUrl: string;
  }> {
    return this.request('/api/pairing/init', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async pollPairing(code: string, pollSecret: string): Promise<{
    status: 'pending' | 'approved' | 'expired';
    machineId?: string;
    machineToken?: string;
    machineName?: string;
  }> {
    const qs = new URLSearchParams({ code, secret: pollSecret }).toString();
    return this.request(`/api/pairing/poll?${qs}`, { method: 'GET' });
  }

  async sendHeartbeat(body: DaemonHeartbeat): Promise<{ ok: boolean }> {
    return this.request('/api/daemon/heartbeat', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async syncConversations(body: DaemonSyncPayload): Promise<{ ok: boolean; synced: number }> {
    return this.request('/api/daemon/sync', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async pollCommands(): Promise<{ commands: PolledCommand[] }> {
    return this.request('/api/daemon/commands/poll', { method: 'POST', body: '{}' });
  }

  async completeCommand(commandId: string, body: CompleteCommandRequest): Promise<{ ok: boolean }> {
    return this.request(`/api/daemon/commands/${encodeURIComponent(commandId)}/complete`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async downloadAttachment(attachmentId: string): Promise<{
    filename: string;
    mimeType: string;
    dataBase64: string;
  }> {
    return this.request(`/api/daemon/attachments/${encodeURIComponent(attachmentId)}`, {
      method: 'GET',
    });
  }
}

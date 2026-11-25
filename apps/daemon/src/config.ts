import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface DaemonConfig {
  serverUrl: string;
  machineId?: string;
  machineToken?: string;
  machineName: string;
  antigravityDir: string;
  agentApiPath: string;
  workspaces: string[];
  syncIntervalMs: number;
  pollIntervalMs: number;
  maxConversations: number;
}

export const CONFIG_DIR = path.join(os.homedir(), '.antigravity-remote');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'daemon-config.json');
export const UPLOADS_DIR = path.join(CONFIG_DIR, 'uploads');

function defaultAntigravityDir(): string {
  return path.join(os.homedir(), '.gemini', 'antigravity');
}

function defaultAgentApiPath(antigravityDir: string): string {
  const binName = process.platform === 'win32' ? 'agentapi.bat' : 'agentapi';
  return path.join(antigravityDir, 'bin', binName);
}

export function loadConfig(): DaemonConfig {
  let fileData: Partial<DaemonConfig> = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      fileData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) as Partial<DaemonConfig>;
    } catch {
      fileData = {};
    }
  }

  const antigravityDir =
    process.env.ANTIGRAVITY_DIR || fileData.antigravityDir || defaultAntigravityDir();

  const envWorkspaces = process.env.REMOTE_WORKSPACES
    ? process.env.REMOTE_WORKSPACES.split(';')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  return {
    serverUrl: (
      process.env.REMOTE_SERVER_URL ||
      fileData.serverUrl ||
      'http://localhost:3000'
    ).replace(/\/+$/, ''),
    machineId: process.env.REMOTE_MACHINE_ID || fileData.machineId,
    machineToken: process.env.REMOTE_MACHINE_TOKEN || fileData.machineToken,
    machineName: process.env.REMOTE_MACHINE_NAME || fileData.machineName || os.hostname(),
    antigravityDir,
    agentApiPath:
      process.env.AGENTAPI_PATH || fileData.agentApiPath || defaultAgentApiPath(antigravityDir),
    workspaces: envWorkspaces ?? fileData.workspaces ?? [],
    syncIntervalMs: Number(process.env.SYNC_INTERVAL_MS || fileData.syncIntervalMs || 4000),
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || fileData.pollIntervalMs || 2000),
    maxConversations: Number(process.env.MAX_CONVERSATIONS || fileData.maxConversations || 25),
  };
}

export function saveConfig(config: DaemonConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

export function ensureUploadsDir(): string {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  return UPLOADS_DIR;
}

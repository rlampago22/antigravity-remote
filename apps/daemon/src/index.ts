import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import qrcode from 'qrcode-terminal';
import type { WorkspaceInfo } from '@antigravity-remote/protocol';
import { AntigravityLocalAdapter } from './antigravity.js';
import { RemoteRelayClient, type PolledCommand } from './client.js';
import {
  CONFIG_FILE,
  ensureUploadsDir,
  loadConfig,
  saveConfig,
  type DaemonConfig,
} from './config.js';
import {
  getGitDiff,
  inspectWorkspace,
  listWorkspaceFiles,
  readWorkspaceFile,
} from './workspace.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveWorkspaces(
  config: DaemonConfig,
  adapter: AntigravityLocalAdapter
): Promise<{ paths: string[]; infos: WorkspaceInfo[] }> {
  const discovered = await adapter.discoverRecentWorkspaces(15);
  const combined = new Set<string>([...config.workspaces, ...discovered]);
  if (combined.size === 0) {
    combined.add(process.cwd());
  }

  const infos: WorkspaceInfo[] = [];
  const validPaths: string[] = [];
  for (const p of combined) {
    const info = await inspectWorkspace(p);
    if (info) {
      validPaths.push(info.path);
      infos.push(info);
    }
  }
  return { paths: validPaths, infos };
}

async function runPairingFlow(config: DaemonConfig, adapter: AntigravityLocalAdapter): Promise<DaemonConfig> {
  const { infos, paths } = await resolveWorkspaces(config, adapter);
  const client = new RemoteRelayClient(config.serverUrl);

  console.log(`\n[Pareamento] Conectando em ${config.serverUrl}...`);
  const init = await client.initPairing({
    machineName: config.machineName,
    hostname: os.hostname(),
    os: `${os.platform()} ${os.release()}`,
    workspaces: infos,
  });

  console.log('\n=======================================================');
  console.log('  PAREAMENTO ANTIGRAVITY REMOTE CONTROL v2');
  console.log('=======================================================');
  console.log(`  Código:  ${init.code}`);
  console.log(`  Link:    ${init.pairUrl}`);
  console.log('=======================================================\n');
  qrcode.generate(init.pairUrl, { small: true });
  console.log('\nAbra o link acima ou escaneie o QR Code no celular (já logado) para aprovar...');

  const expiresMs = new Date(init.expiresAt).getTime();
  while (Date.now() < expiresMs) {
    await sleep(2500);
    const res = await client.pollPairing(init.code, init.pollSecret);
    if (res.status === 'approved' && res.machineId && res.machineToken) {
      const updated: DaemonConfig = {
        ...config,
        machineId: res.machineId,
        machineToken: res.machineToken,
        machineName: res.machineName || config.machineName,
        workspaces: config.workspaces.length > 0 ? config.workspaces : paths,
      };
      saveConfig(updated);
      console.log(`\n[Pareamento] Máquina "${updated.machineName}" pareada com sucesso!`);
      console.log(`[Pareamento] Configuração salva em: ${CONFIG_FILE}\n`);
      return updated;
    }
    if (res.status === 'expired') {
      throw new Error('Código de pareamento expirado. Rode novamente para gerar outro.');
    }
  }

  throw new Error('Tempo limite de pareamento atingido.');
}

async function downloadAttachmentsToDisk(
  client: RemoteRelayClient,
  attachmentIds: unknown
): Promise<string[]> {
  if (!Array.isArray(attachmentIds) || attachmentIds.length === 0) return [];
  const uploadsDir = ensureUploadsDir();
  const savedPaths: string[] = [];

  for (const id of attachmentIds) {
    if (typeof id !== 'string' || !id) continue;
    const file = await client.downloadAttachment(id);
    const safeName = `${Date.now()}-${file.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const fullPath = path.join(uploadsDir, safeName);
    fs.writeFileSync(fullPath, Buffer.from(file.dataBase64, 'base64'));
    savedPaths.push(fullPath);
  }
  return savedPaths;
}

async function executeCommand(
  cmd: PolledCommand,
  client: RemoteRelayClient,
  adapter: AntigravityLocalAdapter,
  allowedWorkspaces: string[]
): Promise<unknown> {
  const p = cmd.payload || {};

  switch (cmd.type) {
    case 'new_conversation': {
      const attachmentPaths = await downloadAttachmentsToDisk(client, p.attachmentIds);
      const res = await adapter.newConversation({
        prompt: String(p.prompt || ''),
        model: p.model ? String(p.model) : undefined,
        title: p.title ? String(p.title) : undefined,
        workspacePath: p.workspacePath ? String(p.workspacePath) : undefined,
        attachmentPaths,
      });
      adapter.resetSyncWatermark(res.conversationId);
      return res;
    }

    case 'send_message': {
      const conversationId = cmd.conversationExternalId || String(p.conversationId || '');
      if (!conversationId) throw new Error('conversationId ausente.');
      const attachmentPaths = await downloadAttachmentsToDisk(client, p.attachmentIds);
      return adapter.sendMessage({
        conversationId,
        content: String(p.content || ''),
        attachmentPaths,
      });
    }

    case 'list_files': {
      const workspacePath = String(p.workspacePath || '');
      const relativeDir = p.relativeDir ? String(p.relativeDir) : '';
      return listWorkspaceFiles(workspacePath, allowedWorkspaces, relativeDir);
    }

    case 'read_file': {
      const workspacePath = String(p.workspacePath || '');
      const relativePath = String(p.relativePath || '');
      return readWorkspaceFile(workspacePath, allowedWorkspaces, relativePath);
    }

    case 'git_diff': {
      const workspacePath = String(p.workspacePath || '');
      const relativeFile = p.relativeFile ? String(p.relativeFile) : undefined;
      return getGitDiff(workspacePath, allowedWorkspaces, relativeFile);
    }

    case 'list_artifacts': {
      const conversationId = cmd.conversationExternalId || String(p.conversationId || '');
      if (!conversationId) throw new Error('conversationId ausente.');
      return { artifacts: adapter.listArtifacts(conversationId) };
    }

    case 'read_artifact': {
      const conversationId = cmd.conversationExternalId || String(p.conversationId || '');
      const relativePath = String(p.relativePath || '');
      if (!conversationId || !relativePath) throw new Error('Parâmetros do artefato ausentes.');
      return adapter.readArtifact(conversationId, relativePath);
    }

    case 'refresh_sync': {
      adapter.resetSyncWatermark(cmd.conversationExternalId || undefined);
      return { refreshed: true };
    }

    default:
      throw new Error(`Comando não suportado: ${String(cmd.type)}`);
  }
}

async function syncSnapshotInChunks(
  client: RemoteRelayClient,
  adapter: AntigravityLocalAdapter,
  snapshot: Awaited<ReturnType<AntigravityLocalAdapter['collectSyncSnapshot']>>
): Promise<void> {
  const MAX_CHUNK_BYTES = 450_000;
  const MAX_EVENTS_PER_CHUNK = 25;

  const metaOnlyBatch: typeof snapshot = [];
  let metaBatchBytes = 0;

  const flushMetaBatch = async () => {
    if (metaOnlyBatch.length === 0) return;
    await client.syncConversations({ conversations: metaOnlyBatch });
    adapter.markSynced(metaOnlyBatch);
    metaOnlyBatch.length = 0;
    metaBatchBytes = 0;
  };

  for (const item of snapshot) {
    if (item.events.length === 0) {
      const size = Buffer.byteLength(JSON.stringify(item), 'utf8');
      if (metaOnlyBatch.length >= 10 || metaBatchBytes + size > MAX_CHUNK_BYTES) {
        await flushMetaBatch();
      }
      metaOnlyBatch.push(item);
      metaBatchBytes += size;
      continue;
    }

    await flushMetaBatch();

    // Send events in bounded chunks to stay well under Vercel's 4.5MB payload limit
    let cursor = 0;
    while (cursor < item.events.length) {
      const chunkEvents: typeof item.events = [];
      let chunkBytes = 2000;
      while (cursor < item.events.length && chunkEvents.length < MAX_EVENTS_PER_CHUNK) {
        const ev = item.events[cursor];
        const evBytes = Buffer.byteLength(JSON.stringify(ev), 'utf8');
        if (chunkEvents.length > 0 && chunkBytes + evBytes > MAX_CHUNK_BYTES) {
          break;
        }
        chunkEvents.push(ev);
        chunkBytes += evBytes;
        cursor++;
      }

      const partialItem = {
        ...item,
        lastStepIndex: Math.max(...chunkEvents.map((e) => e.stepIndex)),
        events: chunkEvents,
      };
      await client.syncConversations({ conversations: [partialItem] });
      adapter.markSynced([partialItem]);
    }
  }

  await flushMetaBatch();
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const serverArg = process.argv.find((a) => a.startsWith('--server='));
  let config = loadConfig();
  if (serverArg) {
    config.serverUrl = serverArg.slice('--server='.length).replace(/\/+$/, '');
  }

  const adapter = new AntigravityLocalAdapter(config.antigravityDir, config.agentApiPath);

  if (args.has('--pair') || !config.machineToken) {
    config = await runPairingFlow(config, adapter);
    if (args.has('--pair-only')) return;
  }

  const client = new RemoteRelayClient(config.serverUrl, config.machineToken);
  console.log(
    `[Daemon] Online como "${config.machineName}" → ${config.serverUrl} (agentapi: ${config.agentApiPath})`
  );

  let allowedWorkspaces: string[] = [];
  let lastHeartbeat = 0;
  let lastSync = 0;
  let firstSync = true;

  while (true) {
    try {
      const now = Date.now();

      // 1. Heartbeat every 20s
      if (now - lastHeartbeat >= 20_000) {
        const ws = await resolveWorkspaces(config, adapter);
        allowedWorkspaces = ws.paths;
        await client.sendHeartbeat({
          name: config.machineName,
          hostname: os.hostname(),
          os: `${os.platform()} ${os.release()}`,
          daemonVersion: '2.0.0',
          workspaces: ws.infos,
        });
        lastHeartbeat = now;
      }

      // 2. Poll pending remote commands
      const { commands } = await client.pollCommands();
      for (const cmd of commands) {
        console.log(`[Comando] Executando ${cmd.type} (${cmd.id})`);
        try {
          const result = await executeCommand(cmd, client, adapter, allowedWorkspaces);
          await client.completeCommand(cmd.id, { status: 'completed', result });
          // Trigger an immediate sync after task mutations
          if (cmd.type === 'new_conversation' || cmd.type === 'send_message' || cmd.type === 'refresh_sync') {
            lastSync = 0;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[Comando] Falha em ${cmd.type}: ${message}`);
          await client.completeCommand(cmd.id, { status: 'failed', error: message });
        }
      }

      // 3. Incremental conversation sync (chunked to stay well under 4.5MB Vercel limit)
      if (now - lastSync >= config.syncIntervalMs) {
        const snapshot = await adapter.collectSyncSnapshot(config.maxConversations, firstSync);
        if (snapshot.length > 0) {
          await syncSnapshotInChunks(client, adapter, snapshot);
        }
        firstSync = false;
        lastSync = Date.now();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Daemon] Erro no ciclo: ${msg}`);
      await sleep(3000);
    }

    await sleep(config.pollIntervalMs);
  }
}

main().catch((err) => {
  console.error('[Daemon] Erro fatal:', err);
  process.exit(1);
});

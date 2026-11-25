import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  parseAnnotationPbtxt,
  parseTranscriptJsonl,
  type ConversationSyncItem,
} from '@antigravity-remote/protocol';
import { fileUriToLocalPath, getGitSummary } from './workspace.js';

const execFileAsync = promisify(execFile);

export interface ConversationMetaCache {
  workspacePath: string | null;
  branchName: string | null;
  parentConversationId: string;
  projectId: string;
  fetchedAt: number;
}

export interface ArtifactEntry {
  name: string;
  relativePath: string;
  size: number;
  updatedAt: string;
  kind: 'markdown' | 'image' | 'text';
}

export class AntigravityLocalAdapter {
  private readonly annotationsDir: string;
  private readonly brainDir: string;
  private readonly metaCache = new Map<string, ConversationMetaCache>();
  private readonly lastSyncedStep = new Map<string, number>();

  constructor(
    private readonly antigravityDir: string,
    private readonly agentApiPath: string
  ) {
    this.annotationsDir = path.join(antigravityDir, 'annotations');
    this.brainDir = path.join(antigravityDir, 'brain');
  }

  private async runAgentApi(
    args: string[],
    cwd?: string
  ): Promise<{ stdout: string; stderr: string }> {
    const isWin = process.platform === 'win32';
    const opts = {
      cwd: cwd && fs.existsSync(cwd) ? cwd : undefined,
      timeout: 30_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    };

    if (isWin && this.agentApiPath.toLowerCase().endsWith('.bat')) {
      return execFileAsync('cmd.exe', ['/c', this.agentApiPath, ...args], opts);
    }
    return execFileAsync(this.agentApiPath, args, opts);
  }

  async getConversationMetadata(conversationId: string): Promise<ConversationMetaCache> {
    const cached = this.metaCache.get(conversationId);
    if (cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) {
      return cached;
    }

    const fallback: ConversationMetaCache = {
      workspacePath: null,
      branchName: null,
      parentConversationId: '',
      projectId: '',
      fetchedAt: Date.now(),
    };

    if (!fs.existsSync(this.agentApiPath)) {
      this.metaCache.set(conversationId, fallback);
      return fallback;
    }

    try {
      const { stdout } = await this.runAgentApi(['get-conversation-metadata', conversationId]);
      const data = JSON.parse(stdout) as {
        response?: {
          conversationMetadata?: {
            metadata?: {
              workspaces?: Array<{
                workspaceFolderAbsoluteUri?: string;
                branchName?: string;
              }>;
              workspaceUris?: string[];
              parentConversationId?: string;
              projectId?: string;
            };
          };
        };
      };

      const meta = data.response?.conversationMetadata?.metadata;
      const uri =
        meta?.workspaces?.[0]?.workspaceFolderAbsoluteUri || meta?.workspaceUris?.[0] || '';
      const result: ConversationMetaCache = {
        workspacePath: fileUriToLocalPath(uri),
        branchName: meta?.workspaces?.[0]?.branchName || null,
        parentConversationId: meta?.parentConversationId || '',
        projectId: meta?.projectId || '',
        fetchedAt: Date.now(),
      };
      this.metaCache.set(conversationId, result);
      return result;
    } catch {
      this.metaCache.set(conversationId, fallback);
      return fallback;
    }
  }

  async discoverRecentWorkspaces(limit = 15): Promise<string[]> {
    const found = new Set<string>();
    const ids = this.listCandidateIds(limit);
    for (const id of ids) {
      const meta = await this.getConversationMetadata(id);
      if (meta.workspacePath && fs.existsSync(meta.workspacePath)) {
        found.add(meta.workspacePath);
      }
    }
    return Array.from(found);
  }

  private listCandidateIds(limit: number): string[] {
    const entries: Array<{ id: string; sortTs: number }> = [];
    const seen = new Set<string>();

    if (fs.existsSync(this.annotationsDir)) {
      for (const file of fs.readdirSync(this.annotationsDir)) {
        if (!file.endsWith('.pbtxt')) continue;
        const id = file.slice(0, -6);
        seen.add(id);
        const transcriptFile = path.join(this.brainDir, id, '.system_generated', 'logs', 'transcript.jsonl');
        let sortTs = 0;
        if (fs.existsSync(transcriptFile)) {
          sortTs = fs.statSync(transcriptFile).mtimeMs;
        } else {
          sortTs = fs.statSync(path.join(this.annotationsDir, file)).mtimeMs;
        }
        entries.push({ id, sortTs });
      }
    }

    if (fs.existsSync(this.brainDir)) {
      for (const dir of fs.readdirSync(this.brainDir)) {
        if (seen.has(dir)) continue;
        const transcriptFile = path.join(this.brainDir, dir, '.system_generated', 'logs', 'transcript.jsonl');
        if (!fs.existsSync(transcriptFile)) continue;
        entries.push({ id: dir, sortTs: fs.statSync(transcriptFile).mtimeMs });
      }
    }

    entries.sort((a, b) => b.sortTs - a.sortTs);
    return entries.slice(0, limit).map((e) => e.id);
  }

  resetSyncWatermark(conversationId?: string): void {
    if (conversationId) {
      this.lastSyncedStep.delete(conversationId);
    } else {
      this.lastSyncedStep.clear();
    }
  }

  async collectSyncSnapshot(limit: number, forceFull = false): Promise<ConversationSyncItem[]> {
    const candidateIds = this.listCandidateIds(limit + 10);
    const items: ConversationSyncItem[] = [];

    for (const id of candidateIds) {
      if (items.length >= limit) break;

      const meta = await this.getConversationMetadata(id);
      // Skip child/subagent conversations
      if (meta.parentConversationId) continue;

      const annFile = path.join(this.annotationsDir, `${id}.pbtxt`);
      const parsedAnn = fs.existsSync(annFile)
        ? parseAnnotationPbtxt(fs.readFileSync(annFile, 'utf8'))
        : { title: null, lastUserViewTs: 0 };

      const transcriptFile = path.join(
        this.brainDir,
        id,
        '.system_generated',
        'logs',
        'transcript.jsonl'
      );

      if (!fs.existsSync(transcriptFile) && !parsedAnn.title) continue;

      const stat = fs.existsSync(transcriptFile) ? fs.statSync(transcriptFile) : null;
      const mtimeMs = stat ? stat.mtimeMs : parsedAnn.lastUserViewTs * 1000 || Date.now();
      const afterStep = forceFull ? -1 : (this.lastSyncedStep.get(id) ?? -1);

      const parsed = stat
        ? parseTranscriptJsonl(fs.readFileSync(transcriptFile, 'utf8'), mtimeMs, afterStep)
        : {
            status: 'idle' as const,
            lastStepIndex: -1,
            model: null,
            lastUserPrompt: null,
            lastAgentPreview: null,
            fallbackTitle: null,
            events: [],
          };

      const title = parsedAnn.title || parsed.fallbackTitle || `Conversa ${id.slice(0, 8)}`;
      const gitSummary = meta.workspacePath ? await getGitSummary(meta.workspacePath) : null;

      items.push({
        externalId: id,
        title,
        workspacePath: meta.workspacePath,
        branchName: gitSummary?.branch || meta.branchName,
        model: parsed.model,
        status: parsed.status,
        lastStepIndex: parsed.lastStepIndex,
        lastUserPrompt: parsed.lastUserPrompt,
        lastAgentPreview: parsed.lastAgentPreview,
        gitSummary,
        updatedAt: new Date(mtimeMs).toISOString(),
        events: parsed.events,
      });
    }

    return items;
  }

  markSynced(items: ConversationSyncItem[]): void {
    for (const item of items) {
      if (item.lastStepIndex >= 0) {
        this.lastSyncedStep.set(item.externalId, item.lastStepIndex);
      }
    }
  }

  async newConversation(params: {
    prompt: string;
    model?: string;
    title?: string;
    workspacePath?: string;
    attachmentPaths?: string[];
  }): Promise<{ conversationId: string }> {
    let fullPrompt = params.prompt.trim();

    if (params.workspacePath) {
      fullPrompt = `[Workspace selecionado pelo Controle Remoto: ${params.workspacePath}]\n\n${fullPrompt}`;
    }
    if (params.attachmentPaths && params.attachmentPaths.length > 0) {
      const list = params.attachmentPaths.map((p) => `- ${p}`).join('\n');
      fullPrompt += `\n\n[Anexos enviados pelo celular — leia os arquivos abaixo se relevante:\n${list}]`;
    }

    const args = ['new-conversation'];
    if (params.model) args.push(`--model=${params.model}`);
    if (params.title) args.push(`--title=${params.title}`);
    args.push(fullPrompt);

    const { stdout } = await this.runAgentApi(args, params.workspacePath);
    try {
      const parsed = JSON.parse(stdout) as {
        response?: { newConversation?: { conversationId?: string } };
      };
      const convId = parsed.response?.newConversation?.conversationId;
      if (convId) return { conversationId: convId };
    } catch {
      // Fallback regex
    }
    const match = stdout.match(/"conversationId"\s*:\s*"([^"]+)"/);
    if (match?.[1]) return { conversationId: match[1] };

    throw new Error(`Resposta inesperada do agentapi: ${stdout.slice(0, 240)}`);
  }

  async sendMessage(params: {
    conversationId: string;
    content: string;
    attachmentPaths?: string[];
  }): Promise<{ ok: true }> {
    let fullContent = params.content.trim();
    if (params.attachmentPaths && params.attachmentPaths.length > 0) {
      const list = params.attachmentPaths.map((p) => `- ${p}`).join('\n');
      fullContent += `\n\n[Anexos enviados pelo celular — leia os arquivos abaixo:\n${list}]`;
    }
    await this.runAgentApi(['send-message', params.conversationId, fullContent]);
    return { ok: true };
  }

  listArtifacts(conversationId: string): ArtifactEntry[] {
    const convDir = path.join(this.brainDir, conversationId);
    if (!fs.existsSync(convDir)) return [];

    const results: ArtifactEntry[] = [];
    const walk = (dir: string, relPrefix: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'scratch' || entry.name === 'browser_sandbox') {
          continue;
        }
        const full = path.join(dir, entry.name);
        const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(full, rel);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          const st = fs.statSync(full);
          let kind: ArtifactEntry['kind'] | null = null;
          if (ext === '.md') kind = 'markdown';
          else if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) kind = 'image';
          else if (['.txt', '.json', '.yaml', '.yml', '.log'].includes(ext)) kind = 'text';
          if (kind) {
            results.push({
              name: entry.name,
              relativePath: rel,
              size: st.size,
              updatedAt: st.mtime.toISOString(),
              kind,
            });
          }
        }
      }
    };

    walk(convDir, '');
    results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return results.slice(0, 60);
  }

  readArtifact(
    conversationId: string,
    relativePath: string
  ): { relativePath: string; kind: 'markdown' | 'image' | 'text'; content: string; mimeType: string } {
    const convDir = path.resolve(this.brainDir, conversationId);
    const full = path.resolve(convDir, relativePath);
    if (!full.startsWith(convDir + path.sep) && full !== convDir) {
      throw new Error('Acesso negado ao artefato.');
    }
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      throw new Error('Artefato não encontrado.');
    }
    const ext = path.extname(full).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
      const mimeMap: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
      };
      const buf = fs.readFileSync(full);
      return {
        relativePath,
        kind: 'image',
        mimeType: mimeMap[ext] || 'image/png',
        content: buf.toString('base64'),
      };
    }

    const text = fs.readFileSync(full, 'utf8').slice(0, 200_000);
    return {
      relativePath,
      kind: ext === '.md' ? 'markdown' : 'text',
      mimeType: ext === '.md' ? 'text/markdown' : 'text/plain',
      content: text,
    };
  }
}

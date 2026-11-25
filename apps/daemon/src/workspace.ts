import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { GitSummary, WorkspaceInfo } from '@antigravity-remote/protocol';

const execFileAsync = promisify(execFile);

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.turbo',
  '__pycache__',
  '.venv',
  'venv',
]);

const SENSITIVE_FILENAMES = new Set(['.env', '.env.local', '.env.production', '.env.development']);

export function normalizePath(p: string): string {
  return path.resolve(p);
}

export function fileUriToLocalPath(uri: string): string | null {
  if (!uri) return null;
  if (!uri.startsWith('file://')) return normalizePath(uri);
  try {
    const parsed = new URL(uri);
    let pathname = decodeURIComponent(parsed.pathname);
    // On Windows, file:///c:/foo -> /c:/foo -> c:\foo
    if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(pathname)) {
      pathname = pathname.slice(1);
    }
    return path.normalize(pathname);
  } catch {
    return null;
  }
}

export function assertPathInsideWorkspaces(
  targetPath: string,
  allowedWorkspaces: string[]
): string {
  const resolvedTarget = path.resolve(targetPath);
  const targetLower = process.platform === 'win32' ? resolvedTarget.toLowerCase() : resolvedTarget;

  for (const ws of allowedWorkspaces) {
    const resolvedWs = path.resolve(ws);
    const wsLower = process.platform === 'win32' ? resolvedWs.toLowerCase() : resolvedWs;
    const prefix = wsLower.endsWith(path.sep) ? wsLower : `${wsLower}${path.sep}`;
    if (targetLower === wsLower || targetLower.startsWith(prefix)) {
      return resolvedTarget;
    }
  }
  throw new Error('Acesso negado: caminho fora dos workspaces autorizados.');
}

async function runGit(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      timeout: 8000,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    });
    return stdout;
  } catch {
    return null;
  }
}

export async function inspectWorkspace(workspacePath: string): Promise<WorkspaceInfo | null> {
  const resolved = normalizePath(workspacePath);
  if (!fs.existsSync(resolved)) return null;
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) return null;

  const branchOut = await runGit(resolved, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const isGitRepo = branchOut !== null;

  return {
    name: path.basename(resolved) || resolved,
    path: resolved,
    isGitRepo,
    gitBranch: branchOut ? branchOut.trim() : null,
  };
}

export async function getGitSummary(workspacePath: string): Promise<GitSummary | null> {
  if (!workspacePath || !fs.existsSync(workspacePath)) return null;
  const out = await runGit(workspacePath, ['status', '--porcelain=v1', '-b']);
  if (out === null) return null;

  const lines = out.split(/\r?\n/).filter(Boolean);
  let branch: string | null = null;
  const files: GitSummary['files'] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      const rest = line.slice(3);
      branch = rest.split('...')[0]?.trim() || null;
      continue;
    }
    const statusCode = line.slice(0, 2);
    const filePath = line.slice(3).trim();
    if (!filePath) continue;
    const staged = statusCode[0] !== ' ' && statusCode[0] !== '?';
    files.push({
      path: filePath,
      status: statusCode.trim() || 'M',
      staged,
    });
  }

  return {
    branch,
    dirtyCount: files.length,
    files: files.slice(0, 80),
  };
}

export async function getGitDiff(
  workspacePath: string,
  allowedWorkspaces: string[],
  relativeFile?: string
): Promise<{ branch: string | null; diff: string; files: GitSummary['files'] }> {
  const safeWs = assertPathInsideWorkspaces(workspacePath, allowedWorkspaces);
  const summary = await getGitSummary(safeWs);

  const argsBase = relativeFile ? ['--', relativeFile] : [];
  const [unstaged, staged] = await Promise.all([
    runGit(safeWs, ['diff', ...argsBase]),
    runGit(safeWs, ['diff', '--cached', ...argsBase]),
  ]);

  let combined = '';
  if (staged?.trim()) combined += `# Staged changes\n${staged.trim()}\n\n`;
  if (unstaged?.trim()) combined += `# Unstaged changes\n${unstaged.trim()}\n`;

  if (!combined && relativeFile) {
    // Possibly untracked file
    const fullPath = assertPathInsideWorkspaces(path.join(safeWs, relativeFile), allowedWorkspaces);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const content = fs.readFileSync(fullPath, 'utf8').slice(0, 60000);
      combined = `# New untracked file: ${relativeFile}\n${content}`;
    }
  }

  return {
    branch: summary?.branch ?? null,
    files: summary?.files ?? [],
    diff: combined.slice(0, 120000),
  };
}

export interface FileEntry {
  name: string;
  relativePath: string;
  type: 'dir' | 'file';
  size?: number;
}

export function listWorkspaceFiles(
  workspacePath: string,
  allowedWorkspaces: string[],
  relativeDir: string = ''
): { workspacePath: string; relativeDir: string; entries: FileEntry[] } {
  const safeWs = assertPathInsideWorkspaces(workspacePath, allowedWorkspaces);
  const targetDir = assertPathInsideWorkspaces(
    path.join(safeWs, relativeDir || '.'),
    allowedWorkspaces
  );

  const items = fs.readdirSync(targetDir, { withFileTypes: true });
  const entries: FileEntry[] = [];

  for (const item of items) {
    if (item.isDirectory() && IGNORED_DIRS.has(item.name)) continue;
    const rel = path.posix.join(relativeDir.replace(/\\/g, '/'), item.name).replace(/^\.\//, '');
    if (item.isDirectory()) {
      entries.push({ name: item.name, relativePath: rel, type: 'dir' });
    } else if (item.isFile()) {
      const st = fs.statSync(path.join(targetDir, item.name));
      entries.push({ name: item.name, relativePath: rel, type: 'file', size: st.size });
    }
  }

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { workspacePath: safeWs, relativeDir, entries: entries.slice(0, 250) };
}

export function readWorkspaceFile(
  workspacePath: string,
  allowedWorkspaces: string[],
  relativePath: string
): { path: string; content: string; truncated: boolean; size: number } {
  const safeWs = assertPathInsideWorkspaces(workspacePath, allowedWorkspaces);
  const fullPath = assertPathInsideWorkspaces(path.join(safeWs, relativePath), allowedWorkspaces);
  const baseName = path.basename(fullPath).toLowerCase();
  if (SENSITIVE_FILENAMES.has(baseName)) {
    throw new Error('Leitura de arquivos .env bloqueada por segurança.');
  }

  const stat = fs.statSync(fullPath);
  if (!stat.isFile()) throw new Error('O caminho informado não é um arquivo.');

  const MAX_BYTES = 180_000;
  const buf = fs.readFileSync(fullPath);
  // Check for binary NUL byte in first 4KB
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  if (sample.includes(0)) {
    throw new Error('Arquivo binário não suportado para visualização de texto.');
  }

  const truncated = buf.length > MAX_BYTES;
  const content = buf.subarray(0, MAX_BYTES).toString('utf8');
  return { path: relativePath, content, truncated, size: stat.size };
}

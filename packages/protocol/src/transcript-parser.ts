import type {
  ConversationStatus,
  NormalizedEvent,
  ToolCallItem,
} from './schemas.js';

export interface RawTranscriptLine {
  step_index?: number;
  source?: string;
  type?: string;
  status?: string;
  created_at?: string;
  content?: string;
  thinking?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  tool_calls?: Array<{
    name?: string;
    args?: Record<string, unknown>;
  }>;
}

export interface ParsedAnnotation {
  title: string | null;
  lastUserViewTs: number;
}

const MAX_CONTENT_LEN = 24000;
const MAX_TOOL_OUTPUT_LEN = 6000;
const MAX_THINKING_LEN = 8000;

export function parseAnnotationPbtxt(content: string): ParsedAnnotation {
  const titleMatch = content.match(/title:\s*"((?:[^"\\]|\\.)*)"/);
  let title: string | null = null;
  if (titleMatch?.[1]) {
    try {
      title = JSON.parse(`"${titleMatch[1]}"`);
    } catch {
      title = titleMatch[1].trim();
    }
  }
  const tsMatch = content.match(/seconds:\s*(\d+)/);
  const lastUserViewTs = tsMatch?.[1] ? Number.parseInt(tsMatch[1], 10) : 0;
  return { title, lastUserViewTs };
}

export function extractCleanUserPrompt(rawContent: string): string {
  const reqMatch = rawContent.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
  let text = reqMatch ? reqMatch[1] : rawContent;
  text = text.split('<ADDITIONAL_METADATA>')[0] ?? text;
  text = text.split('<USER_SETTINGS_CHANGE>')[0] ?? text;
  return text.trim();
}

function safeUnquote(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

function summarizeToolCall(name: string, args: Record<string, unknown>): string {
  if (name === 'run_command') {
    const summary = args.toolSummary || args.CommandLine;
    return summary ? `Terminal: ${String(summary).slice(0, 120)}` : 'Terminal command';
  }
  if (name === 'read_file') {
    return `Ler: ${String(args.Path ?? '').split(/[\\/]/).pop() || args.Path || ''}`;
  }
  if (name === 'write_file') {
    return `Criar: ${String(args.Path ?? '').split(/[\\/]/).pop() || args.Path || ''}`;
  }
  if (name === 'edit_file') {
    return `Editar: ${String(args.Path ?? '').split(/[\\/]/).pop() || args.Path || ''}`;
  }
  if (name === 'search_web') {
    return `Busca web: ${String(args.query ?? '').slice(0, 100)}`;
  }
  if (name === 'ask_question') {
    return 'Aguardando resposta do usuário';
  }
  return name;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}\n\n… [truncado: ${text.length - maxLen} chars omitidos]`;
}

export function normalizeTranscriptLine(raw: RawTranscriptLine): NormalizedEvent | null {
  const stepIndex = typeof raw.step_index === 'number' ? raw.step_index : -1;
  if (stepIndex < 0) return null;

  const createdAt = raw.created_at || new Date().toISOString();
  const source = raw.source || 'MODEL';
  const type = raw.type || 'GENERIC';

  if (type === 'USER_INPUT') {
    const clean = extractCleanUserPrompt(raw.content || '');
    if (!clean) return null;
    return {
      stepIndex,
      kind: 'user',
      source,
      model: null,
      content: truncate(clean, MAX_CONTENT_LEN),
      thinking: null,
      toolCalls: [],
      inputTokens: null,
      outputTokens: null,
      createdAt,
    };
  }

  if (type === 'PLANNER_RESPONSE') {
    const toolCalls: ToolCallItem[] = Array.isArray(raw.tool_calls)
      ? raw.tool_calls
          .filter((tc): tc is { name: string; args?: Record<string, unknown> } =>
            Boolean(tc && tc.name)
          )
          .map((tc) => {
            const parsedArgs: Record<string, unknown> = {};
            if (tc.args && typeof tc.args === 'object') {
              for (const [k, v] of Object.entries(tc.args)) {
                parsedArgs[k] = safeUnquote(v);
              }
            }
            return {
              name: tc.name,
              args: parsedArgs,
              summary: summarizeToolCall(tc.name, parsedArgs),
            };
          })
      : [];

    const content = raw.content ? truncate(raw.content.trim(), MAX_CONTENT_LEN) : '';
    const thinking = raw.thinking ? truncate(raw.thinking.trim(), MAX_THINKING_LEN) : null;

    if (!content && !thinking && toolCalls.length === 0) return null;

    return {
      stepIndex,
      kind: 'assistant',
      source,
      model: raw.model ?? null,
      content,
      thinking,
      toolCalls,
      inputTokens: typeof raw.input_tokens === 'number' ? raw.input_tokens : null,
      outputTokens: typeof raw.output_tokens === 'number' ? raw.output_tokens : null,
      createdAt,
    };
  }

  // GENERIC = tool execution result
  const rawContent = (raw.content || '').trim();
  if (!rawContent) return null;

  // Strip repetitive Created At / Completed At headers if present
  const cleanedToolOutput = rawContent
    .replace(/^(Created At:.*\nCompleted At:.*\n?)+/g, '')
    .trim();

  if (!cleanedToolOutput || cleanedToolOutput === 'OK') return null;

  return {
    stepIndex,
    kind: 'tool_result',
    source,
    model: null,
    content: truncate(cleanedToolOutput, MAX_TOOL_OUTPUT_LEN),
    thinking: null,
    toolCalls: [],
    inputTokens: null,
    outputTokens: null,
    createdAt,
  };
}

export function detectConversationStatus(
  rawLines: RawTranscriptLine[],
  fileMtimeMs: number,
  nowMs: number = Date.now()
): ConversationStatus {
  if (rawLines.length === 0) return 'idle';
  const last = rawLines[rawLines.length - 1];
  const ageMs = Math.max(0, nowMs - fileMtimeMs);
  const RECENT_WINDOW_MS = 4 * 60 * 1000;

  if (last.status && last.status !== 'DONE') {
    return 'running';
  }

  if (last.type === 'PLANNER_RESPONSE') {
    const calls = last.tool_calls ?? [];
    const needsFeedback = calls.some((tc) => {
      if (tc.name === 'ask_question') return true;
      if (tc.name === 'write_file' || tc.name === 'edit_file') {
        const meta = safeUnquote(tc.args?.ArtifactMetadata);
        if (meta && typeof meta === 'object' && (meta as Record<string, unknown>).RequestFeedback === true) {
          return true;
        }
      }
      return false;
    });
    if (needsFeedback) return 'needs_attention';
    if (calls.length > 0 && ageMs < RECENT_WINDOW_MS) return 'running';
    return 'idle';
  }

  if (last.type === 'USER_INPUT' || last.type === 'GENERIC') {
    return ageMs < RECENT_WINDOW_MS ? 'running' : 'idle';
  }

  return 'idle';
}

export function parseTranscriptJsonl(
  jsonlContent: string,
  fileMtimeMs: number,
  afterStepIndex: number = -1
): {
  status: ConversationStatus;
  lastStepIndex: number;
  model: string | null;
  lastUserPrompt: string | null;
  lastAgentPreview: string | null;
  fallbackTitle: string | null;
  events: NormalizedEvent[];
} {
  const rawLines: RawTranscriptLine[] = [];
  for (const line of jsonlContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      rawLines.push(JSON.parse(trimmed) as RawTranscriptLine);
    } catch {
      // Ignore partial line while Antigravity is actively flushing JSONL
    }
  }

  const status = detectConversationStatus(rawLines, fileMtimeMs);
  let lastStepIndex = -1;
  let model: string | null = null;
  let lastUserPrompt: string | null = null;
  let lastAgentPreview: string | null = null;
  let fallbackTitle: string | null = null;
  const events: NormalizedEvent[] = [];

  for (const raw of rawLines) {
    if (typeof raw.step_index === 'number' && raw.step_index > lastStepIndex) {
      lastStepIndex = raw.step_index;
    }
    if (raw.model) model = raw.model;

    if (raw.type === 'USER_INPUT' && raw.content) {
      const clean = extractCleanUserPrompt(raw.content);
      if (clean) {
        if (!fallbackTitle) fallbackTitle = clean.replace(/\s+/g, ' ').slice(0, 60);
        lastUserPrompt = clean.replace(/\s+/g, ' ').slice(0, 220);
      }
    }

    if (raw.type === 'PLANNER_RESPONSE' && raw.content?.trim()) {
      lastAgentPreview = raw.content.trim().replace(/\s+/g, ' ').slice(0, 260);
    }

    if (typeof raw.step_index === 'number' && raw.step_index > afterStepIndex) {
      const normalized = normalizeTranscriptLine(raw);
      if (normalized) events.push(normalized);
    }
  }

  return {
    status,
    lastStepIndex,
    model,
    lastUserPrompt,
    lastAgentPreview,
    fallbackTitle,
    events,
  };
}

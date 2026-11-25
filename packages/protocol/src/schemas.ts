import { z } from 'zod';

export const ConversationStatusSchema = z.enum([
  'idle',
  'running',
  'needs_attention',
  'error',
]);
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;

export const WorkspaceInfoSchema = z.object({
  name: z.string(),
  path: z.string(),
  isGitRepo: z.boolean().default(false),
  gitBranch: z.string().nullable().optional(),
});
export type WorkspaceInfo = z.infer<typeof WorkspaceInfoSchema>;

export const GitFileChangeSchema = z.object({
  path: z.string(),
  status: z.string(), // M, A, D, ??, R
  staged: z.boolean().default(false),
});
export type GitFileChange = z.infer<typeof GitFileChangeSchema>;

export const GitSummarySchema = z.object({
  branch: z.string().nullable().optional(),
  dirtyCount: z.number().int().nonnegative().default(0),
  files: z.array(GitFileChangeSchema).default([]),
});
export type GitSummary = z.infer<typeof GitSummarySchema>;

export const ToolCallItemSchema = z.object({
  name: z.string(),
  args: z.record(z.unknown()).default({}),
  summary: z.string().optional(),
});
export type ToolCallItem = z.infer<typeof ToolCallItemSchema>;

export const NormalizedEventKindSchema = z.enum([
  'user',
  'assistant',
  'tool_result',
  'system',
]);
export type NormalizedEventKind = z.infer<typeof NormalizedEventKindSchema>;

export const NormalizedEventSchema = z.object({
  stepIndex: z.number().int().nonnegative(),
  kind: NormalizedEventKindSchema,
  source: z.string().default('MODEL'),
  model: z.string().nullable().optional(),
  content: z.string().default(''),
  thinking: z.string().nullable().optional(),
  toolCalls: z.array(ToolCallItemSchema).default([]),
  inputTokens: z.number().int().nullable().optional(),
  outputTokens: z.number().int().nullable().optional(),
  createdAt: z.string(),
});
export type NormalizedEvent = z.infer<typeof NormalizedEventSchema>;

export const ConversationSyncItemSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1),
  workspacePath: z.string().nullable().optional(),
  branchName: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  status: ConversationStatusSchema,
  lastStepIndex: z.number().int().default(-1),
  lastUserPrompt: z.string().nullable().optional(),
  lastAgentPreview: z.string().nullable().optional(),
  gitSummary: GitSummarySchema.nullable().optional(),
  updatedAt: z.string(),
  events: z.array(NormalizedEventSchema).default([]),
});
export type ConversationSyncItem = z.infer<typeof ConversationSyncItemSchema>;

export const DaemonHeartbeatSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  hostname: z.string().min(1).max(120),
  os: z.string().min(1).max(80),
  daemonVersion: z.string().default('2.0.0'),
  workspaces: z.array(WorkspaceInfoSchema).default([]),
});
export type DaemonHeartbeat = z.infer<typeof DaemonHeartbeatSchema>;

export const DaemonSyncPayloadSchema = z.object({
  conversations: z.array(ConversationSyncItemSchema).max(50),
});
export type DaemonSyncPayload = z.infer<typeof DaemonSyncPayloadSchema>;

export const CommandTypeSchema = z.enum([
  'new_conversation',
  'send_message',
  'list_files',
  'read_file',
  'git_diff',
  'list_artifacts',
  'read_artifact',
  'refresh_sync',
]);
export type CommandType = z.infer<typeof CommandTypeSchema>;

export const CommandStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
]);
export type CommandStatus = z.infer<typeof CommandStatusSchema>;

export const CreateCommandRequestSchema = z.object({
  machineId: z.string().min(1),
  conversationExternalId: z.string().nullable().optional(),
  type: CommandTypeSchema,
  payload: z.record(z.unknown()).default({}),
});
export type CreateCommandRequest = z.infer<typeof CreateCommandRequestSchema>;

export const PairingInitRequestSchema = z.object({
  machineName: z.string().min(1).max(120),
  hostname: z.string().min(1).max(120),
  os: z.string().min(1).max(80),
  workspaces: z.array(WorkspaceInfoSchema).default([]),
});
export type PairingInitRequest = z.infer<typeof PairingInitRequestSchema>;

export const PairingApproveRequestSchema = z.object({
  code: z.string().trim().min(4).max(16),
  machineName: z.string().trim().min(1).max(120).optional(),
});
export type PairingApproveRequest = z.infer<typeof PairingApproveRequestSchema>;

export const CompleteCommandRequestSchema = z.object({
  status: z.enum(['completed', 'failed']),
  result: z.unknown().optional(),
  error: z.string().nullable().optional(),
});
export type CompleteCommandRequest = z.infer<typeof CompleteCommandRequestSchema>;

export const MODEL_OPTIONS = [
  { id: 'flash', label: 'Flash (Rápido)' },
  { id: 'pro', label: 'Pro (Mais capaz)' },
  { id: 'flash_lite', label: 'Flash Lite (Leve)' },
] as const;

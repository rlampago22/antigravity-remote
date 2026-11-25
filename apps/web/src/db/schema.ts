import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { GitSummary, ToolCallItem, WorkspaceInfo } from '@antigravity-remote/protocol';

// ============================================================
// Better Auth Core Tables (matching Better Auth native pg columns)
// ============================================================

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_id_idx').on(t.userId)]
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('account_user_id_idx').on(t.userId)]
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)]
);

// ============================================================
// Antigravity Remote Control Tables
// ============================================================

export const machines = pgTable(
  'machines',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    hostname: text('hostname').notNull(),
    os: text('os').notNull(),
    daemonVersion: text('daemon_version').notNull().default('2.0.0'),
    tokenHash: text('token_hash').notNull().unique(),
    workspaces: jsonb('workspaces').$type<WorkspaceInfo[]>().notNull().default([]),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('machines_user_idx').on(t.userId)]
);

export const pairingCodes = pgTable('pairing_codes', {
  code: text('code').primaryKey(),
  pollSecretHash: text('poll_secret_hash').notNull(),
  machineName: text('machine_name').notNull(),
  hostname: text('hostname').notNull(),
  os: text('os').notNull(),
  workspaces: jsonb('workspaces').$type<WorkspaceInfo[]>().notNull().default([]),
  approvedByUserId: text('approved_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  issuedMachineId: text('issued_machine_id'),
  issuedTokenOnce: text('issued_token_once'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const conversations = pgTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    machineId: text('machine_id')
      .notNull()
      .references(() => machines.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    externalId: text('external_id').notNull(),
    title: text('title').notNull(),
    workspacePath: text('workspace_path'),
    branchName: text('branch_name'),
    model: text('model'),
    status: text('status').notNull().default('idle'),
    lastStepIndex: integer('last_step_index').notNull().default(-1),
    lastUserPrompt: text('last_user_prompt'),
    lastAgentPreview: text('last_agent_preview'),
    gitSummary: jsonb('git_summary').$type<GitSummary | null>(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('conversations_machine_ext_uidx').on(t.machineId, t.externalId),
    index('conversations_user_updated_idx').on(t.userId, t.updatedAt),
  ]
);

export const conversationEvents = pgTable(
  'conversation_events',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    stepIndex: integer('step_index').notNull(),
    kind: text('kind').notNull(), // user | assistant | tool_result | system
    source: text('source').notNull().default('MODEL'),
    model: text('model'),
    content: text('content').notNull().default(''),
    thinking: text('thinking'),
    toolCalls: jsonb('tool_calls').$type<ToolCallItem[]>().notNull().default([]),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('events_conv_step_uidx').on(t.conversationId, t.stepIndex),
    index('events_conv_idx').on(t.conversationId),
  ]
);

export const commands = pgTable(
  'commands',
  {
    id: text('id').primaryKey(),
    machineId: text('machine_id')
      .notNull()
      .references(() => machines.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    conversationExternalId: text('conversation_external_id'),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    status: text('status').notNull().default('pending'), // pending | running | completed | failed
    result: jsonb('result').$type<unknown>(),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [index('commands_machine_status_idx').on(t.machineId, t.status, t.createdAt)]
);

export const attachments = pgTable(
  'attachments',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    machineId: text('machine_id')
      .notNull()
      .references(() => machines.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    dataBase64: text('data_base64').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('attachments_expires_idx').on(t.expiresAt)]
);

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    authKey: text('auth_key').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('push_subs_user_idx').on(t.userId)]
);

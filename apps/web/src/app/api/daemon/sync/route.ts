import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { DaemonSyncPayloadSchema } from '@antigravity-remote/protocol';
import { conversationEvents, conversations, getDb, machines } from '@/db';
import { authenticateDaemon, generateId } from '@/lib/machine-auth';
import { sendPushToUser } from '@/lib/push';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const machine = await authenticateDaemon(request);
  if (!machine) {
    return NextResponse.json({ error: 'Token de máquina inválido.' }, { status: 401 });
  }

  try {
    const body = DaemonSyncPayloadSchema.parse(await request.json());
    const db = getDb();

    await db
      .update(machines)
      .set({ lastSeenAt: new Date() })
      .where(eq(machines.id, machine.id));

    let synced = 0;

    for (const item of body.conversations) {
      const [existing] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.machineId, machine.id),
            eq(conversations.externalId, item.externalId)
          )
        )
        .limit(1);

      const previousStatus = existing?.status;
      const conversationId = existing?.id || generateId();

      if (existing) {
        await db
          .update(conversations)
          .set({
            title: item.title,
            workspacePath: item.workspacePath ?? existing.workspacePath,
            branchName: item.branchName ?? existing.branchName,
            model: item.model ?? existing.model,
            status: item.status,
            lastStepIndex: Math.max(existing.lastStepIndex, item.lastStepIndex),
            lastUserPrompt: item.lastUserPrompt ?? existing.lastUserPrompt,
            lastAgentPreview: item.lastAgentPreview ?? existing.lastAgentPreview,
            gitSummary: item.gitSummary ?? existing.gitSummary,
            updatedAt: new Date(item.updatedAt),
          })
          .where(eq(conversations.id, conversationId));
      } else {
        await db.insert(conversations).values({
          id: conversationId,
          machineId: machine.id,
          userId: machine.userId,
          externalId: item.externalId,
          title: item.title,
          workspacePath: item.workspacePath ?? null,
          branchName: item.branchName ?? null,
          model: item.model ?? null,
          status: item.status,
          lastStepIndex: item.lastStepIndex,
          lastUserPrompt: item.lastUserPrompt ?? null,
          lastAgentPreview: item.lastAgentPreview ?? null,
          gitSummary: item.gitSummary ?? null,
          updatedAt: new Date(item.updatedAt),
        });
      }

      if (item.events.length > 0) {
        const rows = item.events.map((ev) => ({
          id: generateId(),
          conversationId,
          stepIndex: ev.stepIndex,
          kind: ev.kind,
          source: ev.source,
          model: ev.model ?? null,
          content: ev.content,
          thinking: ev.thinking ?? null,
          toolCalls: ev.toolCalls,
          inputTokens: ev.inputTokens ?? null,
          outputTokens: ev.outputTokens ?? null,
          createdAt: new Date(ev.createdAt),
        }));

        await db
          .insert(conversationEvents)
          .values(rows)
          .onConflictDoNothing({
            target: [conversationEvents.conversationId, conversationEvents.stepIndex],
          });
      }

      // Send Web Push notification on meaningful transitions
      if (previousStatus === 'running' && item.status === 'idle') {
        await sendPushToUser(machine.userId, {
          title: `Concluído: ${item.title}`,
          body: item.lastAgentPreview || 'O agente finalizou o turno no seu notebook.',
          url: `/conversations/${conversationId}`,
          tag: `conv-${conversationId}`,
        });
      } else if (previousStatus !== 'needs_attention' && item.status === 'needs_attention') {
        await sendPushToUser(machine.userId, {
          title: `Atenção necessária: ${item.title}`,
          body: 'O Antigravity está aguardando sua resposta ou aprovação.',
          url: `/conversations/${conversationId}`,
          tag: `conv-${conversationId}`,
        });
      }

      synced++;
    }

    return NextResponse.json({ ok: true, synced });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro no sync.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

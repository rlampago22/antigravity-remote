import { NextResponse } from 'next/server';
import { and, asc, eq, gt } from 'drizzle-orm';
import { conversationEvents, conversations, getDb, machines } from '@/db';
import { getServerSession } from '@/lib/auth';
import { isMachineOnline } from '@/lib/machine-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const afterStepRaw = searchParams.get('afterStep');
  const afterStep = afterStepRaw !== null ? Number.parseInt(afterStepRaw, 10) : -1;

  const db = getDb();
  const [row] = await db
    .select({
      conversation: conversations,
      machine: machines,
    })
    .from(conversations)
    .innerJoin(machines, eq(conversations.machineId, machines.id))
    .where(and(eq(conversations.id, id), eq(conversations.userId, session.user.id)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 });
  }

  const eventsQuery =
    Number.isFinite(afterStep) && afterStep >= 0
      ? and(
          eq(conversationEvents.conversationId, id),
          gt(conversationEvents.stepIndex, afterStep)
        )
      : eq(conversationEvents.conversationId, id);

  const events = await db
    .select()
    .from(conversationEvents)
    .where(eventsQuery)
    .orderBy(asc(conversationEvents.stepIndex));

  const { conversation: c, machine: m } = row;
  return NextResponse.json({
    conversation: {
      id: c.id,
      machineId: c.machineId,
      machineName: m.name,
      machineOnline: isMachineOnline(m.lastSeenAt),
      machineWorkspaces: m.workspaces,
      externalId: c.externalId,
      title: c.title,
      workspacePath: c.workspacePath,
      branchName: c.branchName,
      model: c.model,
      status: c.status,
      lastStepIndex: c.lastStepIndex,
      gitSummary: c.gitSummary,
      updatedAt: c.updatedAt.toISOString(),
    },
    events: events.map((ev) => ({
      id: ev.id,
      stepIndex: ev.stepIndex,
      kind: ev.kind,
      source: ev.source,
      model: ev.model,
      content: ev.content,
      thinking: ev.thinking,
      toolCalls: ev.toolCalls,
      inputTokens: ev.inputTokens,
      outputTokens: ev.outputTokens,
      createdAt: ev.createdAt.toISOString(),
    })),
  });
}

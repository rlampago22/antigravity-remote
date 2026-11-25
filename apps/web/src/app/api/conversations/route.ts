import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { conversations, getDb, machines } from '@/db';
import { getServerSession } from '@/lib/auth';
import { isMachineOnline } from '@/lib/machine-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const machineId = searchParams.get('machineId');

  const db = getDb();
  const whereClause = machineId
    ? and(eq(conversations.userId, session.user.id), eq(conversations.machineId, machineId))
    : eq(conversations.userId, session.user.id);

  const rows = await db
    .select({
      conversation: conversations,
      machineName: machines.name,
      machineLastSeen: machines.lastSeenAt,
    })
    .from(conversations)
    .innerJoin(machines, eq(conversations.machineId, machines.id))
    .where(whereClause)
    .orderBy(desc(conversations.updatedAt))
    .limit(60);

  return NextResponse.json({
    conversations: rows.map(({ conversation: c, machineName, machineLastSeen }) => ({
      id: c.id,
      machineId: c.machineId,
      machineName,
      machineOnline: isMachineOnline(machineLastSeen),
      externalId: c.externalId,
      title: c.title,
      workspacePath: c.workspacePath,
      branchName: c.branchName,
      model: c.model,
      status: c.status,
      lastStepIndex: c.lastStepIndex,
      lastUserPrompt: c.lastUserPrompt,
      lastAgentPreview: c.lastAgentPreview,
      gitSummary: c.gitSummary,
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}

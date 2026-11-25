import { NextResponse } from 'next/server';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { commands, getDb, machines } from '@/db';
import { authenticateDaemon } from '@/lib/machine-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const machine = await authenticateDaemon(request);
  if (!machine) {
    return NextResponse.json({ error: 'Token de máquina inválido.' }, { status: 401 });
  }

  const db = getDb();
  await db.update(machines).set({ lastSeenAt: new Date() }).where(eq(machines.id, machine.id));

  const pending = await db
    .select()
    .from(commands)
    .where(and(eq(commands.machineId, machine.id), eq(commands.status, 'pending')))
    .orderBy(asc(commands.createdAt))
    .limit(10);

  if (pending.length > 0) {
    await db
      .update(commands)
      .set({ status: 'running' })
      .where(
        inArray(
          commands.id,
          pending.map((c) => c.id)
        )
      );
  }

  return NextResponse.json({
    commands: pending.map((c) => ({
      id: c.id,
      conversationExternalId: c.conversationExternalId,
      type: c.type,
      payload: c.payload,
    })),
  });
}

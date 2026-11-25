import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { CreateCommandRequestSchema } from '@antigravity-remote/protocol';
import { commands, getDb, machines } from '@/db';
import { getServerSession } from '@/lib/auth';
import { generateId } from '@/lib/machine-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const body = CreateCommandRequestSchema.parse(await request.json());
    const db = getDb();

    const [machine] = await db
      .select()
      .from(machines)
      .where(
        and(
          eq(machines.id, body.machineId),
          eq(machines.userId, session.user.id),
          isNull(machines.revokedAt)
        )
      )
      .limit(1);

    if (!machine) {
      return NextResponse.json({ error: 'Máquina não encontrada.' }, { status: 404 });
    }

    const commandId = generateId();
    await db.insert(commands).values({
      id: commandId,
      machineId: machine.id,
      userId: session.user.id,
      conversationExternalId: body.conversationExternalId ?? null,
      type: body.type,
      payload: body.payload,
      status: 'pending',
    });

    return NextResponse.json({ id: commandId, status: 'pending' }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Comando inválido.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

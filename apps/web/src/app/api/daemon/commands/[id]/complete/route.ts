import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { CompleteCommandRequestSchema } from '@antigravity-remote/protocol';
import { commands, getDb } from '@/db';
import { authenticateDaemon } from '@/lib/machine-auth';
import { sendPushToUser } from '@/lib/push';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const machine = await authenticateDaemon(request);
  if (!machine) {
    return NextResponse.json({ error: 'Token de máquina inválido.' }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const body = CompleteCommandRequestSchema.parse(await request.json());
    const db = getDb();

    const [cmd] = await db
      .select()
      .from(commands)
      .where(and(eq(commands.id, id), eq(commands.machineId, machine.id)))
      .limit(1);

    if (!cmd) {
      return NextResponse.json({ error: 'Comando não encontrado.' }, { status: 404 });
    }

    await db
      .update(commands)
      .set({
        status: body.status,
        result: body.result ?? null,
        error: body.error ?? null,
        completedAt: new Date(),
      })
      .where(eq(commands.id, id));

    if (body.status === 'failed' && (cmd.type === 'new_conversation' || cmd.type === 'send_message')) {
      await sendPushToUser(machine.userId, {
        title: 'Falha ao enviar tarefa',
        body: body.error || 'O daemon não conseguiu executar a instrução no Antigravity.',
        url: '/',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payload inválido.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

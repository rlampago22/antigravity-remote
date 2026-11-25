import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { DaemonHeartbeatSchema } from '@antigravity-remote/protocol';
import { getDb, machines } from '@/db';
import { authenticateDaemon } from '@/lib/machine-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const machine = await authenticateDaemon(request);
  if (!machine) {
    return NextResponse.json({ error: 'Token de máquina inválido.' }, { status: 401 });
  }

  try {
    const body = DaemonHeartbeatSchema.parse(await request.json());
    const db = getDb();

    await db
      .update(machines)
      .set({
        hostname: body.hostname,
        os: body.os,
        daemonVersion: body.daemonVersion,
        workspaces: body.workspaces,
        lastSeenAt: new Date(),
      })
      .where(eq(machines.id, machine.id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payload inválido.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

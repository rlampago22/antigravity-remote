import { NextResponse } from 'next/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb, machines } from '@/db';
import { getServerSession } from '@/lib/auth';
import { isMachineOnline } from '@/lib/machine-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(machines)
    .where(and(eq(machines.userId, session.user.id), isNull(machines.revokedAt)))
    .orderBy(desc(machines.lastSeenAt));

  return NextResponse.json({
    machines: rows.map((m) => ({
      id: m.id,
      name: m.name,
      hostname: m.hostname,
      os: m.os,
      daemonVersion: m.daemonVersion,
      workspaces: m.workspaces,
      lastSeenAt: m.lastSeenAt.toISOString(),
      online: isMachineOnline(m.lastSeenAt),
    })),
  });
}

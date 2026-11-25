import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb, machines } from '@/db';
import { getServerSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { id } = await context.params;
  const db = getDb();

  await db
    .update(machines)
    .set({ revokedAt: new Date() })
    .where(and(eq(machines.id, id), eq(machines.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}

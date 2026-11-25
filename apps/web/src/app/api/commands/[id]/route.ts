import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { commands, getDb } from '@/db';
import { getServerSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { id } = await context.params;
  const db = getDb();

  const [cmd] = await db
    .select()
    .from(commands)
    .where(and(eq(commands.id, id), eq(commands.userId, session.user.id)))
    .limit(1);

  if (!cmd) {
    return NextResponse.json({ error: 'Comando não encontrado.' }, { status: 404 });
  }

  return NextResponse.json({
    id: cmd.id,
    type: cmd.type,
    status: cmd.status,
    result: cmd.result,
    error: cmd.error,
    createdAt: cmd.createdAt.toISOString(),
    completedAt: cmd.completedAt?.toISOString() ?? null,
  });
}

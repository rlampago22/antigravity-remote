import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { attachments, getDb } from '@/db';
import { authenticateDaemon } from '@/lib/machine-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const machine = await authenticateDaemon(request);
  if (!machine) {
    return NextResponse.json({ error: 'Token de máquina inválido.' }, { status: 401 });
  }

  const { id } = await context.params;
  const db = getDb();
  const [file] = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.machineId, machine.id)))
    .limit(1);

  if (!file) {
    return NextResponse.json({ error: 'Anexo não encontrado.' }, { status: 404 });
  }

  return NextResponse.json({
    id: file.id,
    filename: file.filename,
    mimeType: file.mimeType,
    dataBase64: file.dataBase64,
  });
}

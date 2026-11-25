import { NextResponse } from 'next/server';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { attachments, getDb, machines } from '@/db';
import { getServerSession } from '@/lib/auth';
import { generateId } from '@/lib/machine-auth';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const machineId = String(form.get('machineId') || '');
    const file = form.get('file');

    if (!machineId || !(file instanceof File)) {
      return NextResponse.json({ error: 'machineId e file são obrigatórios.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Arquivo excede o limite de 4 MB.' }, { status: 413 });
    }

    const db = getDb();
    const [machine] = await db
      .select()
      .from(machines)
      .where(
        and(
          eq(machines.id, machineId),
          eq(machines.userId, session.user.id),
          isNull(machines.revokedAt)
        )
      )
      .limit(1);

    if (!machine) {
      return NextResponse.json({ error: 'Máquina não encontrada.' }, { status: 404 });
    }

    // Cleanup expired attachments
    await db.delete(attachments).where(lt(attachments.expiresAt, new Date()));

    const buf = Buffer.from(await file.arrayBuffer());
    const id = generateId();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(attachments).values({
      id,
      userId: session.user.id,
      machineId: machine.id,
      filename: file.name || 'anexo.bin',
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: buf.length,
      dataBase64: buf.toString('base64'),
      expiresAt,
    });

    return NextResponse.json({
      id,
      filename: file.name || 'anexo.bin',
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: buf.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha no upload.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

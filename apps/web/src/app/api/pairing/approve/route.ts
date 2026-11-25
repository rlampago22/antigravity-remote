import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { PairingApproveRequestSchema } from '@antigravity-remote/protocol';
import { getDb, machines, pairingCodes } from '@/db';
import { getServerSession } from '@/lib/auth';
import { generateId, generateOpaqueToken, sha256 } from '@/lib/machine-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const body = PairingApproveRequestSchema.parse(await request.json());
    const normalizedCode = body.code.toUpperCase();
    const db = getDb();

    const [row] = await db
      .select()
      .from(pairingCodes)
      .where(eq(pairingCodes.code, normalizedCode))
      .limit(1);

    if (!row || row.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Código inválido ou expirado.' }, { status: 404 });
    }
    if (row.approvedByUserId) {
      return NextResponse.json({ error: 'Este código já foi aprovado.' }, { status: 409 });
    }

    const machineId = generateId();
    const machineToken = generateOpaqueToken('agym');
    const finalName = body.machineName || row.machineName;

    await db.insert(machines).values({
      id: machineId,
      userId: session.user.id,
      name: finalName,
      hostname: row.hostname,
      os: row.os,
      tokenHash: sha256(machineToken),
      workspaces: row.workspaces,
      lastSeenAt: new Date(),
    });

    await db
      .update(pairingCodes)
      .set({
        approvedByUserId: session.user.id,
        issuedMachineId: machineId,
        issuedTokenOnce: machineToken,
        machineName: finalName,
      })
      .where(eq(pairingCodes.code, normalizedCode));

    return NextResponse.json({
      ok: true,
      machine: {
        id: machineId,
        name: finalName,
        hostname: row.hostname,
        os: row.os,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao aprovar pareamento.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

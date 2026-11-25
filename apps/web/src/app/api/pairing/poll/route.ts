import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, pairingCodes } from '@/db';
import { sha256 } from '@/lib/machine-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') || '').trim().toUpperCase();
  const secret = (searchParams.get('secret') || '').trim();

  if (!code || !secret) {
    return NextResponse.json({ error: 'Parâmetros ausentes.' }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db.select().from(pairingCodes).where(eq(pairingCodes.code, code)).limit(1);

  if (!row || row.pollSecretHash !== sha256(secret)) {
    return NextResponse.json({ status: 'expired' });
  }

  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(pairingCodes).where(eq(pairingCodes.code, code));
    return NextResponse.json({ status: 'expired' });
  }

  if (row.approvedByUserId && row.issuedMachineId && row.issuedTokenOnce) {
    const token = row.issuedTokenOnce;
    const machineId = row.issuedMachineId;
    const machineName = row.machineName;
    // One-time delivery: immediately delete pairing row
    await db.delete(pairingCodes).where(eq(pairingCodes.code, code));

    return NextResponse.json({
      status: 'approved',
      machineId,
      machineToken: token,
      machineName,
    });
  }

  return NextResponse.json({ status: 'pending' });
}

import { NextResponse } from 'next/server';
import { lt } from 'drizzle-orm';
import { PairingInitRequestSchema } from '@antigravity-remote/protocol';
import { getDb, pairingCodes } from '@/db';
import { generateOpaqueToken, generatePairingCode, sha256 } from '@/lib/machine-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = PairingInitRequestSchema.parse(await request.json());
    const db = getDb();

    // Opportunistic cleanup of expired pairing codes
    await db.delete(pairingCodes).where(lt(pairingCodes.expiresAt, new Date()));

    const code = generatePairingCode();
    const pollSecret = generateOpaqueToken('poll');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.insert(pairingCodes).values({
      code,
      pollSecretHash: sha256(pollSecret),
      machineName: body.machineName,
      hostname: body.hostname,
      os: body.os,
      workspaces: body.workspaces,
      expiresAt,
    });

    const origin = new URL(request.url).origin;
    const baseUrl = (process.env.BETTER_AUTH_URL || origin).replace(/\/+$/, '');

    return NextResponse.json({
      code,
      pollSecret,
      expiresAt: expiresAt.toISOString(),
      pairUrl: `${baseUrl}/pair?code=${encodeURIComponent(code)}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Requisição inválida.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

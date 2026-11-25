import crypto from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb, machines } from '@/db';

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function generateOpaqueToken(prefix = 'agyr'): string {
  return `${prefix}_${crypto.randomBytes(32).toString('base64url')}`;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function generatePairingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    part += alphabet[bytes[i] % alphabet.length];
  }
  return `AGY-${part}`;
}

export async function authenticateDaemon(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;

  const tokenHash = sha256(match[1].trim());
  const db = getDb();
  const [machine] = await db
    .select()
    .from(machines)
    .where(and(eq(machines.tokenHash, tokenHash), isNull(machines.revokedAt)))
    .limit(1);

  return machine ?? null;
}

export function isMachineOnline(lastSeenAt: Date | string): boolean {
  const ts = typeof lastSeenAt === 'string' ? new Date(lastSeenAt).getTime() : lastSeenAt.getTime();
  return Date.now() - ts < 75_000;
}

import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, pushSubscriptions } from '@/db';
import { getServerSession } from '@/lib/auth';
import { generateId } from '@/lib/machine-auth';

export const dynamic = 'force-dynamic';

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function GET() {
  return NextResponse.json({
    enabled: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const body = SubscribeSchema.parse(await request.json());
    const db = getDb();

    await db
      .insert(pushSubscriptions)
      .values({
        id: generateId(),
        userId: session.user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        authKey: body.keys.auth,
        userAgent: request.headers.get('user-agent') || null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId: session.user.id,
          p256dh: body.keys.p256dh,
          authKey: body.keys.auth,
          userAgent: request.headers.get('user-agent') || null,
        },
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Subscription inválida.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (!body.endpoint) {
    return NextResponse.json({ error: 'endpoint ausente.' }, { status: 400 });
  }
  const db = getDb();
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, session.user.id),
        eq(pushSubscriptions.endpoint, body.endpoint)
      )
    );
  return NextResponse.json({ ok: true });
}

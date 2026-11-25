import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { headers } from 'next/headers';
import { Pool } from 'pg';

function createAuth() {
  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    socialProviders.github = {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    };
  }
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }

  return betterAuth({
    database: new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    }),
    secret: process.env.BETTER_AUTH_SECRET || 'dev-insecure-secret-change-in-production-32chars',
    baseURL: process.env.BETTER_AUTH_URL || undefined,
    trustedOrigins: ['https://*.vercel.app', 'http://localhost:3000'],
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
    },
    socialProviders,
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    plugins: [nextCookies()],
  });
}

type AuthInstance = ReturnType<typeof createAuth>;
let _auth: AuthInstance | null = null;

export function getAuth(): AuthInstance {
  if (!_auth) {
    _auth = createAuth();
  }
  return _auth;
}

export async function getServerSession() {
  const auth = getAuth();
  return auth.api.getSession({ headers: await headers() });
}

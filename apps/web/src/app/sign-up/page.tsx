'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Terminal } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextUrl = params.get('next') || '/';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: authErr } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: nextUrl,
    });
    if (authErr) {
      setError(authErr.message || 'Não foi possível criar a conta.');
      setLoading(false);
      return;
    }
    router.push(nextUrl);
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800/80 bg-[#11151e] p-6 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Criar conta</h1>
            <p className="text-xs text-slate-400">Vincule seus notebooks ao Antigravity Remote</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">Nome</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              className="w-full rounded-xl border border-slate-800 bg-[#090b10] px-3.5 py-2.5 text-sm text-white outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">E-mail</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              className="w-full rounded-xl border border-slate-800 bg-[#090b10] px-3.5 py-2.5 text-sm text-white outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Senha (mín. 8 caracteres)
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-800 bg-[#090b10] px-3.5 py-2.5 text-sm text-white outline-none focus:border-sky-500"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar conta e entrar
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          Já tem conta?{' '}
          <Link href="/sign-in" className="font-medium text-sky-400 hover:text-sky-300">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}

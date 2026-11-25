'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Laptop, Loader2 } from 'lucide-react';

function PairForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState((params.get('code') || '').toUpperCase());
  const [machineName, setMachineName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvedMachine, setApprovedMachine] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/pairing/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          machineName: machineName.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        machine?: { name: string };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Código inválido.');
      setApprovedMachine(data.machine?.name || 'Notebook');
      setTimeout(() => router.push('/'), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao parear.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-[#11151e] text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-base font-semibold text-white">Parear notebook</h1>
      </header>

      <div className="rounded-2xl border border-slate-800/80 bg-[#11151e] p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
            <Laptop className="h-5 w-5" />
          </div>
          <div className="text-xs text-slate-400">
            Rode <code className="rounded bg-slate-900 px-1.5 py-0.5 text-sky-300">npm run daemon:pair</code>{' '}
            no computador e digite o código exibido (ou escaneie o QR Code).
          </div>
        </div>

        {approvedMachine ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <p className="text-sm font-medium text-white">
              {approvedMachine} conectado com sucesso!
            </p>
            <p className="text-xs text-slate-400">Redirecionando para suas conversas...</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Código de pareamento
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="AGY-XXXXXX"
                className="w-full rounded-xl border border-slate-800 bg-[#090b10] px-3.5 py-3 text-center font-mono text-lg tracking-widest text-white uppercase outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Apelido da máquina (opcional)
              </label>
              <input
                type="text"
                value={machineName}
                onChange={(e) => setMachineName(e.target.value)}
                placeholder="Ex: Notebook Casa"
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Aprovar conexão
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function PairPage() {
  return (
    <Suspense>
      <PairForm />
    </Suspense>
  );
}

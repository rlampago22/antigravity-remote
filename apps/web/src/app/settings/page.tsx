'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bell,
  BellOff,
  Laptop,
  LogOut,
  Mic,
  Plus,
  Trash2,
} from 'lucide-react';
import { authClient } from '@/lib/auth-client';

interface MachineRow {
  id: string;
  name: string;
  hostname: string;
  os: string;
  online: boolean;
  lastSeenAt: string;
  workspaces: Array<{ name: string; path: string; gitBranch?: string | null }>;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export default function SettingsPage() {
  const router = useRouter();
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [pushServerEnabled, setPushServerEnabled] = useState(false);
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [geminiEnabled, setGeminiEnabled] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadAll() {
    const [mRes, pRes, aRes] = await Promise.all([
      fetch('/api/machines', { cache: 'no-store' }),
      fetch('/api/push/subscribe', { cache: 'no-store' }),
      fetch('/api/audio/transcribe', { cache: 'no-store' }),
    ]);
    if (mRes.ok) {
      const d = (await mRes.json()) as { machines: MachineRow[] };
      setMachines(d.machines);
    }
    if (pRes.ok) {
      const d = (await pRes.json()) as { enabled: boolean; publicKey: string | null };
      setPushServerEnabled(d.enabled);
      setVapidKey(d.publicKey);
    }
    if (aRes.ok) {
      const d = (await aRes.json()) as { geminiEnabled: boolean };
      setGeminiEnabled(d.geminiEnabled);
    }

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setPushSubscribed(Boolean(sub));
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function togglePush() {
    setMsg(null);
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setMsg('Este navegador não suporta Web Push.');
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();

    if (existing) {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: existing.endpoint }),
      });
      await existing.unsubscribe();
      setPushSubscribed(false);
      setMsg('Notificações desativadas neste dispositivo.');
      return;
    }

    if (!vapidKey) {
      setMsg('Chaves VAPID não configuradas no servidor.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setMsg('Permissão de notificação negada no navegador.');
      return;
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const json = sub.toJSON();
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
      }),
    });
    if (res.ok) {
      setPushSubscribed(true);
      setMsg('Notificações ativadas! Você será avisado quando tarefas terminarem.');
    }
  }

  async function revokeMachine(id: string) {
    await fetch(`/api/machines/${encodeURIComponent(id)}`, { method: 'DELETE' });
    loadAll();
  }

  async function signOut() {
    await authClient.signOut();
    router.push('/sign-in');
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 py-6 pb-16">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-[#11151e] text-slate-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-base font-semibold text-white">Configurações & Máquinas</h1>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-[#11151e] px-3 py-2 text-xs text-slate-300 hover:border-rose-500/40 hover:text-rose-300"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </header>

      {msg && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-xs text-sky-200">
          {msg}
        </div>
      )}

      <section className="rounded-2xl border border-slate-800/80 bg-[#11151e] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Notificações Push (Android PWA)</h2>
          <button
            onClick={togglePush}
            disabled={!pushServerEnabled}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
              pushSubscribed
                ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
            } disabled:opacity-40`}
          >
            {pushSubscribed ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
            {pushSubscribed ? 'Desativar' : 'Ativar Push'}
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Receba alerta no celular quando uma tarefa do Antigravity terminar ou precisar de atenção.
          {!pushServerEnabled && ' (Configure VAPID keys no servidor para habilitar.)'}
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800/80 bg-[#11151e] p-4">
        <div className="flex items-center gap-2.5">
          <Mic className="h-4 w-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-white">Entrada por Voz</h2>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Modo ativo:{' '}
          <span className="font-medium text-slate-200">
            {geminiEnabled
              ? 'Gravação + Gemini API (alta precisão para termos técnicos)'
              : 'Ditado nativo do navegador (Web Speech API — gratuito)'}
          </span>
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800/80 bg-[#11151e] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Notebooks Pareados</h2>
          <Link
            href="/pair"
            className="flex items-center gap-1 rounded-xl bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/25"
          >
            <Plus className="h-3.5 w-3.5" />
            Parear novo
          </Link>
        </div>

        {machines.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">
            Nenhuma máquina conectada ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {machines.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-slate-800 bg-[#090b10] p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Laptop className="h-4 w-4 text-slate-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{m.name}</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            m.online
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              m.online ? 'bg-emerald-400' : 'bg-slate-500'
                            }`}
                          />
                          {m.online ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {m.hostname} · {m.os}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => revokeMachine(m.id)}
                    title="Revogar acesso da máquina"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {m.workspaces.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {m.workspaces.slice(0, 6).map((w) => (
                      <span
                        key={w.path}
                        className="rounded-md border border-slate-800 bg-slate-900/80 px-2 py-0.5 text-[11px] text-slate-300"
                      >
                        {w.name}
                        {w.gitBranch ? ` (${w.gitBranch})` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

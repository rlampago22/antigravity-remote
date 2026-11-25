'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function VoiceInputButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [geminiEnabled, setGeminiEnabled] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    fetch('/api/audio/transcribe')
      .then((r) => r.json())
      .then((d: { geminiEnabled?: boolean }) => setGeminiEnabled(Boolean(d.geminiEnabled)))
      .catch(() => setGeminiEnabled(false));
  }, []);

  async function startGeminiRecording() {
    setError(null);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];

    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: mimeType });
      if (blob.size < 500) return;

      setTranscribing(true);
      try {
        const form = new FormData();
        form.append('audio', new File([blob], 'voice.webm', { type: mimeType }));
        const res = await fetch('/api/audio/transcribe', { method: 'POST', body: form });
        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok) throw new Error(data.error || 'Erro ao transcrever áudio.');
        if (data.text) onTranscript(data.text);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha na transcrição.');
      } finally {
        setTranscribing(false);
      }
    };

    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }

  function startWebSpeech() {
    setError(null);
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Ctor) {
      setError('Navegador sem suporte a ditado nativo. Configure GEMINI_API_KEY para gravar áudio.');
      return;
    }

    const rec = new Ctor();
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.continuous = false;

    rec.onresult = (ev) => {
      const parts: string[] = [];
      for (let i = 0; i < ev.results.length; i++) {
        const t = ev.results[i]?.[0]?.transcript;
        if (t) parts.push(t);
      }
      const joined = parts.join(' ').trim();
      if (joined) onTranscript(joined);
    };
    rec.onerror = (ev) => {
      setError(`Erro no microfone: ${ev.error}`);
      setRecording(false);
    };
    rec.onend = () => setRecording(false);

    speechRef.current = rec;
    rec.start();
    setRecording(true);
  }

  async function toggle() {
    if (disabled || transcribing) return;

    if (recording) {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (speechRef.current) {
        speechRef.current.stop();
      }
      setRecording(false);
      return;
    }

    try {
      if (geminiEnabled) {
        await startGeminiRecording();
      } else {
        startWebSpeech();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Permissão de microfone negada.');
      setRecording(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || transcribing}
        title={
          geminiEnabled
            ? 'Gravar áudio (transcrição Gemini API)'
            : 'Ditar mensagem (voz nativa do navegador)'
        }
        className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
          recording
            ? 'border-rose-500/60 bg-rose-500/20 text-rose-300 animate-pulse'
            : 'border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-700 hover:text-white'
        } disabled:opacity-40`}
      >
        {transcribing ? (
          <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
        ) : recording ? (
          <Square className="h-4 w-4 fill-current" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>
      {error && (
        <div className="absolute bottom-12 right-0 z-30 w-64 rounded-lg border border-rose-500/40 bg-slate-950 p-2 text-xs text-rose-300 shadow-xl">
          {error}
        </div>
      )}
    </div>
  );
}

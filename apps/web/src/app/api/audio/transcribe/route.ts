import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    geminiEnabled: Boolean(process.env.GEMINI_API_KEY),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'GEMINI_API_KEY não configurada no servidor. Use o ditado nativo do navegador ou adicione uma chave gratuita do Google AI Studio.',
        fallback: 'web-speech',
      },
      { status: 501 }
    );
  }

  try {
    const form = await request.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'Arquivo de áudio ausente.' }, { status: 400 });
    }
    if (audio.size > 6 * 1024 * 1024) {
      return NextResponse.json({ error: 'Áudio excede 6 MB.' }, { status: 413 });
    }

    const base64 = Buffer.from(await audio.arrayBuffer()).toString('base64');
    const mimeType = audio.type || 'audio/webm';
    const model = process.env.GEMINI_STT_MODEL || 'gemini-2.5-flash';

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Transcreva exatamente o áudio em português do Brasil, preservando nomes de arquivos, comandos de terminal, símbolos e termos técnicos de programação em inglês quando falados. Retorne apenas o texto transcrito, sem comentários extras.',
                },
                {
                  inlineData: {
                    mimeType,
                    data: base64,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `Erro da Gemini API (${res.status}): ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro na transcrição.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

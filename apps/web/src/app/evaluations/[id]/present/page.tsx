'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, Evaluation } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { ShareQr } from '@/components/ShareQr';

export default function PresentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const shareUrl = useMemo(() => {
    if (!evaluation || typeof window === 'undefined') return '';
    return `${window.location.origin}/s/${evaluation.code}`;
  }, [evaluation]);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    try {
      const data = await api.getEvaluation(token, id);
      setEvaluation(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke hente');
    }
  }, [id, router]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (!evaluation && !error) {
    return (
      <main className="present-shell">
        <p className="muted">Henter…</p>
      </main>
    );
  }

  if (!evaluation) {
    return (
      <main className="present-shell">
        <div className="error">{error}</div>
        <Link href={`/evaluations/${id}`}>Tilbage</Link>
      </main>
    );
  }

  const count = evaluation._count?.responses ?? 0;

  return (
    <main className="present-shell">
      <div className="present-top">
        <div>
          <div className="present-kicker">Eval Platform</div>
          <h1>{evaluation.title}</h1>
          <p>{evaluation.classLabel}</p>
        </div>
        <Link href={`/evaluations/${id}`} className="btn ghost">
          Luk skærm
        </Link>
      </div>

      <div className="present-stage">
        {shareUrl ? (
          <ShareQr url={shareUrl} code={evaluation.code} size={420} />
        ) : null}

        <div className="present-code">{evaluation.code}</div>

        <button
          type="button"
          className={`present-link ${copied ? 'copied' : ''}`}
          onClick={copyLink}
          title="Klik for at kopiere"
        >
          {copied ? 'Kopieret' : shareUrl}
        </button>

        <div className="present-counter" aria-live="polite">
          <span className="present-counter-number">{count}</span>
          <span className="present-counter-label">
            {count === 1 ? 'svar' : 'svar'}
          </span>
        </div>
      </div>
    </main>
  );
}

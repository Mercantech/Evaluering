'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, Template } from '@/lib/api';
import { getToken } from '@/lib/auth';

function questionCount(template: Template) {
  return (template.structure || []).reduce(
    (sum, section) => sum + (section.questions?.length || 0),
    0,
  );
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  function load(token: string) {
    return api
      .listTemplates(token)
      .then(setTemplates)
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : 'Kunne ikke hente skabeloner',
        );
      });
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    load(token).finally(() => setLoading(false));
  }, [router]);

  async function remove(id: string, name: string) {
    const token = getToken();
    if (!token) return;
    if (!window.confirm(`Slet skabelonen “${name}”?`)) return;
    setError('');
    setMessage('');
    try {
      await api.deleteTemplate(token, id);
      setMessage('Skabelon slettet');
      await load(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke slette');
    }
  }

  return (
    <main className="shell">
      <div className="topbar">
        <Link href="/dashboard" className="brand">
          Eval <span>Platform</span>
        </Link>
        <div className="row">
          <Link href="/templates/new" className="btn secondary">
            Ny skabelon
          </Link>
          <Link href="/dashboard" className="btn ghost">
            Oversigt
          </Link>
        </div>
      </div>

      <section className="stack">
        <div>
          <h1>Skabeloner</h1>
          <p>
            Genbrug Midtvejs, Slutevaluering m.m. Kopiér til et hold og tilpas
            spørgsmålene dér.
          </p>
        </div>

        {error ? <div className="error">{error}</div> : null}
        {message ? <div className="success">{message}</div> : null}
        {loading ? <p className="muted">Henter…</p> : null}

        {!loading && templates.length === 0 ? (
          <div className="panel">
            <p>Ingen skabeloner endnu.</p>
            <Link href="/templates/new" className="btn">
              Opret skabelon
            </Link>
          </div>
        ) : null}

        <div className="list">
          {templates.map((template) => (
            <div key={template.id} className="list-item template-list-item">
              <div className="template-list-body">
                <strong>{template.name}</strong>
                <div className="template-list-meta muted">
                  {(template.structure || []).length} sektioner ·{' '}
                  {questionCount(template)} spørgsmål
                </div>
                {template.description ? (
                  <p className="template-list-desc">{template.description}</p>
                ) : null}
              </div>
              <div className="template-list-actions">
                <Link
                  href={`/evaluations/new?templateId=${template.id}`}
                  className="btn"
                >
                  Brug
                </Link>
                <Link
                  href={`/templates/${template.id}`}
                  className="btn secondary"
                >
                  Rediger
                </Link>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => remove(template.id, template.name)}
                >
                  Slet
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

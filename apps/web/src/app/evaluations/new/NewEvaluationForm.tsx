'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, Template } from '@/lib/api';
import { getToken } from '@/lib/auth';

export default function NewEvaluationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetTemplateId = searchParams.get('templateId') || '';

  const [title, setTitle] = useState('');
  const [classLabel, setClassLabel] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [templateId, setTemplateId] = useState(presetTemplateId);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    api
      .listTemplates(token)
      .then((list) => {
        setTemplates(list);
        if (presetTemplateId) {
          setTemplateId(presetTemplateId);
          const selected = list.find((t) => t.id === presetTemplateId);
          if (selected) {
            setTitle((current) => current || selected.name);
          }
        }
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : 'Kunne ikke hente skabeloner',
        );
      })
      .finally(() => setLoadingTemplates(false));
  }, [router, presetTemplateId]);

  function selectTemplate(id: string) {
    setTemplateId(id);
    const selected = templates.find((t) => t.id === id);
    if (selected && (!title.trim() || templates.some((t) => t.name === title))) {
      setTitle(selected.name);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const evaluation = await api.createEvaluation(token, {
        title,
        classLabel,
        templateId: templateId || undefined,
        code: customCode.trim() || undefined,
      });
      router.push(`/evaluations/${evaluation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke oprette');
    } finally {
      setLoading(false);
    }
  }

  function questionCount(template: Template) {
    return (template.structure || []).reduce(
      (sum, section) => sum + (section.questions?.length || 0),
      0,
    );
  }

  return (
    <main className="shell">
      <div className="topbar">
        <Link href="/dashboard" className="brand">
          Eval <span>Platform</span>
        </Link>
        <Link href="/dashboard" className="btn ghost">
          Tilbage
        </Link>
      </div>

      <section className="stack" style={{ maxWidth: 720 }}>
        <div>
          <h1>Ny evaluering</h1>
          <p>
            Vælg eventuelt en skabelon (fx Midtvejs eller Slut), tilpas titel og
            klasse – og redigér bagefter til holdet.
          </p>
        </div>

        <form className="panel stack" onSubmit={onSubmit}>
          <div className="stack">
            <label>Skabelon</label>
            {loadingTemplates ? (
              <p className="muted">Henter skabeloner…</p>
            ) : (
              <div className="template-picker">
                <button
                  type="button"
                  className={`template-option ${!templateId ? 'selected' : ''}`}
                  onClick={() => setTemplateId('')}
                >
                  <strong>Tom evaluering</strong>
                  <span className="muted">Start fra bunden</span>
                </button>
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={`template-option ${
                      templateId === template.id ? 'selected' : ''
                    }`}
                    onClick={() => selectTemplate(template.id)}
                  >
                    <strong>{template.name}</strong>
                    <span className="muted">
                      {template.description ||
                        `${questionCount(template)} spørgsmål · ${(template.structure || []).length} sektioner`}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="muted" style={{ marginBottom: 0 }}>
              Eller administrér skabeloner under{' '}
              <Link href="/templates">Skabeloner</Link>.
            </p>
          </div>

          <div className="field">
            <label htmlFor="title">Titel</label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Fx Midtvejs – Hold A"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="classLabel">Klasse-label</label>
            <input
              id="classLabel"
              value={classLabel}
              onChange={(e) => setClassLabel(e.target.value)}
              placeholder="Fx 3.A"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="customCode">Egen kode (valgfri)</label>
            <input
              id="customCode"
              value={customCode}
              onChange={(e) =>
                setCustomCode(
                  e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/gi, ''),
                )
              }
              placeholder="Fx GF2MID – ellers genereres en"
              autoComplete="off"
              maxLength={12}
              spellCheck={false}
            />
            <span className="muted" style={{ fontSize: '0.88rem' }}>
              4–12 tegn. Uden I, O, 0 og 1 (for at undgå forveksling).
            </span>
          </div>
          {error ? <div className="error">{error}</div> : null}
          <button className="btn" type="submit" disabled={loading}>
            {loading
              ? 'Opretter…'
              : templateId
                ? 'Opret fra skabelon'
                : 'Opret'}
          </button>
        </form>
      </section>
    </main>
  );
}

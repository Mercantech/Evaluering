'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { StructureEditor } from '@/components/StructureEditor';
import {
  DraftSection,
  draftsToSectionInputs,
  mapStructureToDraft,
} from '@/lib/draftQuestions';

export default function EditTemplatePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState<DraftSection[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    api
      .getTemplate(token, id)
      .then((template) => {
        setName(template.name);
        setDescription(template.description || '');
        setSections(mapStructureToDraft(template.structure));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Kunne ikke hente');
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.updateTemplate(token, id, {
        name,
        description: description.trim() || undefined,
        sections: draftsToSectionInputs(sections),
      });
      setMessage('Skabelon gemt');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke gemme');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const token = getToken();
    if (!token) return;
    if (!window.confirm(`Slet skabelonen “${name}”?`)) return;
    try {
      await api.deleteTemplate(token, id);
      router.push('/templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke slette');
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <p className="muted">Henter skabelon…</p>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="topbar">
        <Link href="/dashboard" className="brand">
          Eval <span>Platform</span>
        </Link>
        <div className="row">
          <Link href={`/evaluations/new?templateId=${id}`} className="btn">
            Brug til nyt hold
          </Link>
          <Link href="/templates" className="btn ghost">
            Skabeloner
          </Link>
        </div>
      </div>

      <section className="stack">
        <div>
          <h1>{name || 'Skabelon'}</h1>
          <p>Redigér skabelonen. Ændringer gælder næste gang den kopieres.</p>
        </div>

        {error ? <div className="error">{error}</div> : null}
        {message ? <div className="success">{message}</div> : null}

        <form className="stack" onSubmit={onSubmit}>
          <div className="panel stack">
            <div className="field">
              <label htmlFor="name">Navn</label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="description">Beskrivelse</label>
              <input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <StructureEditor sections={sections} onChange={setSections} />

          <div className="row">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Gemmer…' : 'Gem skabelon'}
            </button>
            <button
              className="btn danger"
              type="button"
              onClick={remove}
              disabled={saving}
            >
              Slet
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

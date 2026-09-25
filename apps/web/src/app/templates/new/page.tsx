'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { StructureEditor } from '@/components/StructureEditor';
import {
  DraftSection,
  draftsToSectionInputs,
  mapStructureToDraft,
} from '@/lib/draftQuestions';

export default function NewTemplatePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState<DraftSection[]>(() =>
    mapStructureToDraft([]),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const template = await api.createTemplate(token, {
        name,
        description: description.trim() || undefined,
        sections: draftsToSectionInputs(sections),
      });
      router.push(`/templates/${template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke oprette');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shell">
      <div className="topbar">
        <Link href="/dashboard" className="brand">
          MAGS <span>Evaluering</span>
        </Link>
        <Link href="/templates" className="btn ghost">
          Tilbage
        </Link>
      </div>

      <section className="stack">
        <div>
          <h1>Ny skabelon</h1>
          <p>Byg en genbrugelig struktur, fx Midtvejs eller Slutevaluering.</p>
        </div>

        {error ? <div className="error">{error}</div> : null}

        <form className="stack" onSubmit={onSubmit}>
          <div className="panel stack">
            <div className="field">
              <label htmlFor="name">Navn</label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Fx Midtvejs evaluering"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="description">Beskrivelse</label>
              <input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Valgfri kort tekst"
              />
            </div>
          </div>

          <StructureEditor sections={sections} onChange={setSections} />

          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Gemmer…' : 'Gem skabelon'}
          </button>
        </form>
      </section>
    </main>
  );
}

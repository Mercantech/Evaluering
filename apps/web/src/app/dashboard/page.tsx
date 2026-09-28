'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, Evaluation, Teacher } from '@/lib/api';
import { clearToken, getToken } from '@/lib/auth';

function statusLabel(status: string) {
  if (status === 'OPEN') return 'Åben';
  if (status === 'CLOSED') return 'Lukket';
  return 'Kladde';
}

function statusClass(status: string) {
  if (status === 'OPEN') return 'badge open';
  if (status === 'CLOSED') return 'badge closed';
  return 'badge draft';
}

export default function DashboardPage() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [items, setItems] = useState<Evaluation[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    Promise.all([api.me(token), api.listEvaluations(token)])
      .then(([me, list]) => {
        setTeacher(me);
        setItems(list);
      })
      .catch((err) => {
        clearToken();
        setError(err instanceof Error ? err.message : 'Kunne ikke hente data');
        router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  function logout() {
    clearToken();
    router.push('/login');
  }

  return (
    <main className="shell">
      <div className="topbar">
        <Link href="/dashboard" className="brand">
          Eval <span>Platform</span>
        </Link>
        <div className="row">
          {teacher ? <span className="muted">{teacher.name}</span> : null}
          <button className="btn ghost" type="button" onClick={logout}>
            Log ud
          </button>
          <Link href="/templates" className="btn secondary">
            Skabeloner
          </Link>
          <Link href="/evaluations/new" className="btn">
            Ny evaluering
          </Link>
        </div>
      </div>

      <section className="stack">
        <div>
          <h1>Dine evalueringer</h1>
          <p>Opret, del og se anonyme svar fra dine klasser.</p>
        </div>

        {error ? <div className="error">{error}</div> : null}
        {loading ? <p className="muted">Henter…</p> : null}

        {!loading && items.length === 0 ? (
          <div className="panel">
            <p>Ingen evalueringer endnu. Opret den første for en klasse.</p>
            <Link href="/evaluations/new" className="btn">
              Opret evaluering
            </Link>
          </div>
        ) : null}

        <div className="list">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/evaluations/${item.id}`}
              className="list-item"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div>
                <strong>{item.title}</strong>
                <div className="muted">
                  Klasse: {item.classLabel} · Kode: {item.code} ·{' '}
                  {item._count?.responses ?? 0} svar
                </div>
              </div>
              <span className={statusClass(item.status)}>
                {statusLabel(item.status)}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    inputRef.current?.focus();
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length < 4) {
      setError('Indtast den kode, du har fået af din underviser');
      inputRef.current?.focus();
      return;
    }
    router.push(`/s/${cleaned}`);
  }

  return (
    <main className={`join-page ${ready ? 'is-ready' : ''}`}>
      <div className="join-atmosphere" aria-hidden="true">
        <span className="join-orb join-orb-a" />
        <span className="join-orb join-orb-b" />
        <span className="join-grid" />
      </div>

      <section className="join-stage">
        <p className="join-brand">
          MAGS <span>Evaluering</span>
        </p>
        <h1 className="join-title">Din feedback tæller</h1>
        <p className="join-lead">
          Skriv koden fra undervisningen – dit svar er anonymt.
        </p>

        <form className="join-form" onSubmit={onSubmit}>
          <label className="join-label" htmlFor="code">
            Evalueringskode
          </label>
          <input
            ref={inputRef}
            id="code"
            className="join-code-input"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
              setError('');
            }}
            placeholder="AB12CD"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={12}
            inputMode="text"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'code-error' : undefined}
          />
          {error ? (
            <p id="code-error" className="join-error" role="alert">
              {error}
            </p>
          ) : (
            <p className="join-hint">Typisk 6 tegn – store bogstaver og tal</p>
          )}
          <button className="join-submit" type="submit">
            Åbn evaluering
          </button>
        </form>
      </section>
    </main>
  );
}

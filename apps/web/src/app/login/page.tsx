'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { setToken } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('underviser@mags.local');
  const [password, setPassword] = useState('changeme123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api.login(email, password);
      setToken(result.accessToken);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login mislykkedes');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <div className="topbar">
        <Link href="/" className="brand">
          MAGS <span>Evaluering</span>
        </Link>
      </div>
      <section className="hero-join">
        <div>
          <h1>Underviser-login</h1>
          <p>Midlertidig login indtil underviser-auth kobles på.</p>
        </div>
        <form className="panel stack" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Adgangskode</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {error ? <div className="error">{error}</div> : null}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Logger ind…' : 'Log ind'}
          </button>
        </form>
      </section>
    </main>
  );
}

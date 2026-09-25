'use client';

import { Suspense } from 'react';
import NewEvaluationForm from './NewEvaluationForm';

export default function NewEvaluationPage() {
  return (
    <Suspense
      fallback={
        <main className="shell">
          <p className="muted">Henter…</p>
        </main>
      }
    >
      <NewEvaluationForm />
    </Suspense>
  );
}

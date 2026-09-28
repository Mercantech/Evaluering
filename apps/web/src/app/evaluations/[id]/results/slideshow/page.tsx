'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, Evaluation, SummaryResult } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { labelForScaleValue } from '@/lib/scale';

type Slide =
  | {
      kind: 'title';
      title: string;
      classLabel: string;
      totalResponses: number;
    }
  | {
      kind: 'pulse';
      overall: number;
      agreePct: number;
      disagreePct: number;
      totalResponses: number;
    }
  | {
      kind: 'highlights';
      mode: 'top' | 'bottom';
      items: Array<{ text: string; section: string; average: number }>;
    }
  | {
      kind: 'scale';
      section: string;
      questionText: string;
      rowText: string;
      average: number;
      answerCount: number;
      distribution: Record<string, number>;
      scaleMin: number;
      scaleMax: number;
      scaleLabels?: string[];
    }
  | {
      kind: 'quotes';
      section: string;
      questionText: string;
      texts: string[];
    }
  | {
      kind: 'end';
      title: string;
      totalResponses: number;
    };

function averageTone(average: number) {
  if (average >= 3.4) return 'is-high';
  if (average >= 2.5) return 'is-mid';
  return 'is-low';
}

function pctOf(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

function buildSlides(
  summary: SummaryResult,
  evaluation: Evaluation | null,
): Slide[] {
  const sectionByQuestion = new Map<string, string>();
  for (const section of evaluation?.sections || []) {
    for (const q of section.questions || []) {
      sectionByQuestion.set(q.id, section.title);
    }
  }

  const slides: Slide[] = [
    {
      kind: 'title',
      title: summary.title,
      classLabel: summary.classLabel,
      totalResponses: summary.totalResponses,
    },
  ];

  const scaleItems: Array<{
    text: string;
    section: string;
    average: number;
    questionText: string;
    questionId: string;
    distribution: Record<string, number>;
    answerCount: number;
    scaleMin: number;
    scaleMax: number;
    scaleLabels?: string[];
  }> = [];

  for (const q of summary.questions) {
    if (q.type !== 'SCALE') continue;
    const rows =
      q.rows && q.rows.length > 0
        ? q.rows
        : [
            {
              index: 0,
              text: q.text,
              average: q.average ?? null,
              answerCount: q.answerCount,
              distribution: q.distribution || {},
            },
          ];
    for (const row of rows) {
      if (row.average === null || row.average === undefined) continue;
      scaleItems.push({
        text: row.text,
        section: sectionByQuestion.get(q.questionId) || 'Skala',
        average: row.average,
        questionText: q.text,
        questionId: q.questionId,
        distribution: row.distribution || {},
        answerCount: row.answerCount,
        scaleMin: q.scaleMin ?? 1,
        scaleMax: q.scaleMax ?? 4,
        scaleLabels: q.scaleLabels,
      });
    }
  }

  if (scaleItems.length > 0) {
    let agree = 0;
    let disagree = 0;
    let total = 0;
    for (const item of scaleItems) {
      for (const [value, count] of Object.entries(item.distribution)) {
        const n = Number(value);
        total += count;
        if (n >= 3) agree += count;
        if (n <= 2) disagree += count;
      }
    }
    const overall =
      scaleItems.reduce((sum, i) => sum + i.average, 0) / scaleItems.length;
    slides.push({
      kind: 'pulse',
      overall,
      agreePct: pctOf(agree, total),
      disagreePct: pctOf(disagree, total),
      totalResponses: summary.totalResponses,
    });

    const sorted = [...scaleItems].sort((a, b) => b.average - a.average);
    slides.push({
      kind: 'highlights',
      mode: 'top',
      items: sorted.slice(0, 3).map((i) => ({
        text: i.text,
        section: i.section,
        average: i.average,
      })),
    });
    slides.push({
      kind: 'highlights',
      mode: 'bottom',
      items: [...sorted]
        .reverse()
        .slice(0, 3)
        .map((i) => ({
          text: i.text,
          section: i.section,
          average: i.average,
        })),
    });

    for (const item of scaleItems) {
      slides.push({
        kind: 'scale',
        section: item.section,
        questionText: item.questionText,
        rowText: item.text,
        average: item.average,
        answerCount: item.answerCount,
        distribution: item.distribution,
        scaleMin: item.scaleMin,
        scaleMax: item.scaleMax,
        scaleLabels: item.scaleLabels,
      });
    }
  }

  for (const q of summary.questions) {
    if (q.type !== 'TEXT' || !(q.texts || []).length) continue;
    slides.push({
      kind: 'quotes',
      section: sectionByQuestion.get(q.questionId) || 'Tekst',
      questionText: q.text,
      texts: (q.texts || []).slice(0, 5),
    });
  }

  slides.push({
    kind: 'end',
    title: summary.title,
    totalResponses: summary.totalResponses,
  });

  return slides;
}

export default function ResultsSlideshowPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    Promise.all([api.summary(token, id), api.getEvaluation(token, id)])
      .then(([summaryData, evaluationData]) => {
        setSummary(summaryData);
        setEvaluation(evaluationData);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : 'Kunne ikke hente resultater',
        );
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  const slides = useMemo(() => {
    if (!summary || summary.totalResponses === 0) return [];
    return buildSlides(summary, evaluation);
  }, [summary, evaluation]);

  const go = useCallback(
    (next: number) => {
      if (slides.length === 0) return;
      setIndex((i) => Math.max(0, Math.min(slides.length - 1, next)));
    },
    [slides.length],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        go(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        go(slides.length - 1);
      } else if (e.key === 'Escape') {
        router.push(`/evaluations/${id}/results`);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, slides.length, router, id]);

  if (loading) {
    return (
      <main className="slideshow-shell">
        <p className="muted">Henter slideshow…</p>
      </main>
    );
  }

  if (error || !summary) {
    return (
      <main className="slideshow-shell">
        <div className="error">{error || 'Ingen data'}</div>
        <Link href={`/evaluations/${id}/results`} className="btn ghost">
          Tilbage
        </Link>
      </main>
    );
  }

  if (slides.length === 0) {
    return (
      <main className="slideshow-shell">
        <div className="slideshow-slide">
          <p className="slideshow-kicker">Eval Platform</p>
          <h1>Ingen svar endnu</h1>
          <p>Når der er besvarelser, kan du afspille dem som slideshow.</p>
          <Link href={`/evaluations/${id}/results`} className="btn">
            Tilbage til resultater
          </Link>
        </div>
      </main>
    );
  }

  const slide = slides[index];
  const progress = ((index + 1) / slides.length) * 100;

  return (
    <main className="slideshow-shell">
      <div className="slideshow-chrome">
        <div className="slideshow-chrome-left">
          <span className="slideshow-brand">
            Eval <span>Platform</span>
          </span>
          <span className="muted">
            {index + 1} / {slides.length}
          </span>
        </div>
        <div className="slideshow-chrome-right">
          <button
            type="button"
            className="btn ghost"
            onClick={() => go(index - 1)}
            disabled={index === 0}
          >
            Forrige
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => go(index + 1)}
            disabled={index >= slides.length - 1}
          >
            Næste
          </button>
          <Link href={`/evaluations/${id}/results`} className="btn secondary">
            Luk
          </Link>
        </div>
      </div>

      <div className="slideshow-progress" aria-hidden="true">
        <div className="slideshow-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div
        className="slideshow-stage"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (x < rect.width * 0.35) go(index - 1);
          else go(index + 1);
        }}
      >
        <div key={`${slide.kind}-${index}`} className="slideshow-slide">
          {slide.kind === 'title' ? (
            <>
              <p className="slideshow-kicker">Resultater</p>
              <h1 className="slideshow-title">{slide.title}</h1>
              <p className="slideshow-lead">{slide.classLabel}</p>
              <div className="slideshow-big-stat">
                <span className="slideshow-big-number">
                  {slide.totalResponses}
                </span>
                <span className="slideshow-big-label">anonyme svar</span>
              </div>
            </>
          ) : null}

          {slide.kind === 'pulse' ? (
            <>
              <p className="slideshow-kicker">Samlet billede</p>
              <h1 className="slideshow-title">Hvordan går det?</h1>
              <div className="slideshow-pulse-grid">
                <div className="slideshow-pulse-card">
                  <span className="slideshow-big-number">
                    {slide.overall.toFixed(2)}
                  </span>
                  <span className="slideshow-big-label">samlet gns. (1–4)</span>
                </div>
                <div className="slideshow-pulse-card is-high">
                  <span className="slideshow-big-number">{slide.agreePct}%</span>
                  <span className="slideshow-big-label">enig / meget enig</span>
                </div>
                <div className="slideshow-pulse-card is-low">
                  <span className="slideshow-big-number">
                    {slide.disagreePct}%
                  </span>
                  <span className="slideshow-big-label">
                    uenig / meget uenig
                  </span>
                </div>
              </div>
            </>
          ) : null}

          {slide.kind === 'highlights' ? (
            <>
              <p className="slideshow-kicker">
                {slide.mode === 'top' ? 'Stærkest' : 'Fokusområder'}
              </p>
              <h1 className="slideshow-title">
                {slide.mode === 'top' ? 'Højest bedømt' : 'Lavest bedømt'}
              </h1>
              <ol className="slideshow-rank">
                {slide.items.map((item, i) => (
                  <li key={`${item.text}-${i}`}>
                    <span className="slideshow-rank-num">{i + 1}</span>
                    <div>
                      <strong>{item.text}</strong>
                      <span className="muted">{item.section}</span>
                    </div>
                    <span className={`results-avg ${averageTone(item.average)}`}>
                      {item.average.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          ) : null}

          {slide.kind === 'scale' ? (
            <>
              <p className="slideshow-kicker">{slide.section}</p>
              <h1 className="slideshow-scale-title">{slide.rowText}</h1>
              <p className="slideshow-lead">{slide.questionText}</p>
              <div className="slideshow-avg-row">
                <span className={`results-avg ${averageTone(slide.average)}`}>
                  Gns. {slide.average.toFixed(2)}
                </span>
                <span className="muted">{slide.answerCount} svar</span>
              </div>
              <div className="slideshow-bars">
                {Object.entries(slide.distribution).map(([value, count]) => {
                  const total = Math.max(
                    1,
                    Object.values(slide.distribution).reduce((a, b) => a + b, 0),
                  );
                  const pct = pctOf(count, total);
                  const label = labelForScaleValue(
                    Number(value),
                    slide.scaleMin,
                    slide.scaleLabels,
                  );
                  return (
                    <div className="slideshow-bar" key={value}>
                      <div className="slideshow-bar-meta">
                        <strong>{value}</strong>
                        {label ? <span className="muted">{label}</span> : null}
                      </div>
                      <div className="slideshow-bar-track">
                        <div
                          className="slideshow-bar-fill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="slideshow-bar-count">
                        <strong>{count}</strong>
                        <span className="muted">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {slide.kind === 'quotes' ? (
            <>
              <p className="slideshow-kicker">{slide.section}</p>
              <h1 className="slideshow-scale-title">{slide.questionText}</h1>
              <div className="slideshow-quotes">
                {slide.texts.map((text, i) => (
                  <blockquote key={i}>{text}</blockquote>
                ))}
              </div>
            </>
          ) : null}

          {slide.kind === 'end' ? (
            <>
              <p className="slideshow-kicker">Tak</p>
              <h1 className="slideshow-title">Det var overblikket</h1>
              <p className="slideshow-lead">
                {slide.totalResponses} svar på “{slide.title}”
              </p>
              <p className="muted">Tryk Esc eller Luk for at gå tilbage</p>
            </>
          ) : null}
        </div>
      </div>

      <p className="slideshow-hint muted">
        Piletaster · mellemrum · klik venstre/højre · Esc
      </p>
    </main>
  );
}

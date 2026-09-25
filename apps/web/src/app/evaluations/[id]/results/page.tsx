'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  api,
  AiInsightResult,
  Evaluation,
  QuestionType,
  ResponseRow,
  SummaryResult,
} from '@/lib/api';
import { getToken } from '@/lib/auth';
import { formatScaleAnswer, labelForScaleValue } from '@/lib/scale';
import { questionTypeLabel } from '@/lib/questionTypes';
import { AiMarkdown } from '@/components/AiMarkdown';
import { DivergingScaleChart } from '@/components/DivergingScaleChart';

type View = 'insight' | 'scales' | 'quotes' | 'detail' | 'individual' | 'ai';

type ScaleRowInsight = {
  key: string;
  questionId: string;
  questionText: string;
  rowText: string;
  sectionTitle: string;
  average: number;
  answerCount: number;
  distribution: Record<string, number>;
  scaleMin: number;
  scaleMax: number;
  scaleLabels?: string[];
};

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

function averageTone(average: number | null | undefined) {
  if (average === null || average === undefined) return '';
  if (average >= 3.4) return 'is-high';
  if (average >= 2.5) return 'is-mid';
  return 'is-low';
}

function pctOf(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

function DistributionBars({
  distribution,
  scaleMin,
  scaleLabels,
}: {
  distribution: Record<string, number>;
  scaleMin: number;
  scaleLabels?: string[];
}) {
  const total = Math.max(
    1,
    Object.values(distribution).reduce((a, b) => a + b, 0),
  );
  return (
    <div className="results-bars">
      {Object.entries(distribution).map(([value, count]) => {
        const pct = pctOf(count, total);
        const label = labelForScaleValue(Number(value), scaleMin, scaleLabels);
        return (
          <div className="results-bar" key={value}>
            <div className="results-bar-label">
              <strong>{value}</strong>
              {label ? <span className="muted">{label}</span> : null}
            </div>
            <div className="results-bar-track">
              <div className="results-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="results-bar-count">
              <strong>{count}</strong>
              <span className="muted">{pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [view, setView] = useState<View>('insight');
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [scaleSort, setScaleSort] = useState<'high' | 'low'>('high');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [aiTexts, setAiTexts] = useState<AiInsightResult | null>(null);
  const [aiReport, setAiReport] = useState<AiInsightResult | null>(null);
  const [aiLoading, setAiLoading] = useState<'texts' | 'report' | null>(null);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    Promise.all([
      api.summary(token, id),
      api.responses(token, id),
      api.getEvaluation(token, id),
    ])
      .then(([summaryData, responseData, evaluationData]) => {
        setSummary(summaryData);
        setResponses(responseData);
        setEvaluation(evaluationData);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : 'Kunne ikke hente resultater',
        );
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    if (!loading) {
      const frame = window.requestAnimationFrame(() => setReady(true));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [loading]);

  const sectionByQuestion = useMemo(() => {
    const map = new Map<string, string>();
    for (const section of evaluation?.sections || []) {
      for (const q of section.questions || []) {
        map.set(q.id, section.title);
      }
    }
    return map;
  }, [evaluation]);

  const scaleRows = useMemo(() => {
    if (!summary) return [] as ScaleRowInsight[];
    const rows: ScaleRowInsight[] = [];
    for (const q of summary.questions) {
      if (q.type !== 'SCALE') continue;
      const source =
        q.rows && q.rows.length > 0
          ? q.rows
          : [
              {
                index: 0,
                text: q.text,
                answerCount: q.answerCount,
                average: q.average ?? null,
                distribution: q.distribution || {},
              },
            ];
      for (const row of source) {
        if (row.average === null || row.average === undefined) continue;
        rows.push({
          key: `${q.questionId}-${row.index}`,
          questionId: q.questionId,
          questionText: q.text,
          rowText: row.text,
          sectionTitle: sectionByQuestion.get(q.questionId) || 'Spørgsmål',
          average: row.average,
          answerCount: row.answerCount,
          distribution: row.distribution || {},
          scaleMin: q.scaleMin ?? 1,
          scaleMax: q.scaleMax ?? 4,
          scaleLabels: q.scaleLabels,
        });
      }
    }
    return rows;
  }, [summary, sectionByQuestion]);

  const insights = useMemo(() => {
    if (!scaleRows.length) {
      return {
        overall: null as number | null,
        agreePct: 0,
        disagreePct: 0,
        top: [] as ScaleRowInsight[],
        bottom: [] as ScaleRowInsight[],
      };
    }
    const overall =
      scaleRows.reduce((sum, r) => sum + r.average, 0) / scaleRows.length;
    let agree = 0;
    let disagree = 0;
    let total = 0;
    for (const row of scaleRows) {
      for (const [value, count] of Object.entries(row.distribution)) {
        const n = Number(value);
        total += count;
        if (n >= 3) agree += count;
        if (n <= 2) disagree += count;
      }
    }
    const sorted = [...scaleRows].sort((a, b) => b.average - a.average);
    return {
      overall,
      agreePct: pctOf(agree, total),
      disagreePct: pctOf(disagree, total),
      top: sorted.slice(0, 3),
      bottom: [...sorted].reverse().slice(0, 3),
    };
  }, [scaleRows]);

  const sortedScaleRows = useMemo(() => {
    const list = [...scaleRows];
    list.sort((a, b) =>
      scaleSort === 'high' ? b.average - a.average : a.average - b.average,
    );
    return list;
  }, [scaleRows, scaleSort]);

  const textQuestions = useMemo(
    () =>
      (summary?.questions || []).filter(
        (q) => q.type === 'TEXT' && (q.texts || []).length > 0,
      ),
    [summary],
  );

  async function runAi(kind: 'texts' | 'report') {
    const token = getToken();
    if (!token) return;
    setAiLoading(kind);
    setAiError('');
    try {
      if (kind === 'texts') {
        const result = await api.aiTextsRecap(token, id);
        setAiTexts(result);
      } else {
        const result = await api.aiFullReport(token, id);
        setAiReport(result);
      }
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'AI-analysen fejlede',
      );
    } finally {
      setAiLoading(null);
    }
  }

  if (loading) {
    return (
      <main className="status-shell">
        <section className="status-page status-page-full">
          <div className="status-card status-loading">
            <p className="join-brand status-brand">
              MAGS <span>Evaluering</span>
            </p>
            <div className="status-pulse" aria-hidden="true" />
            <p className="muted" style={{ margin: 0 }}>
              Henter resultater…
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (error && !summary) {
    return (
      <main className="status-shell">
        <section className="status-page status-page-full">
          <div className="status-card status-missing">
            <p className="join-brand status-brand">
              MAGS <span>Evaluering</span>
            </p>
            <p className="status-kicker">Noget gik galt</p>
            <h1 className="status-title">Kunne ikke hente resultater</h1>
            <p className="status-lead">{error}</p>
            <Link href={`/evaluations/${id}`} className="btn secondary">
              Tilbage til evaluering
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const hasData = Boolean(summary && summary.totalResponses > 0);
  const pulsePct =
    insights.overall !== null
      ? ((insights.overall - 1) / 3) * 100
      : 0;

  return (
    <main className={`results-page ${ready ? 'is-ready' : ''}`}>
      <div className="results-atmosphere" aria-hidden="true">
        <span className="join-orb join-orb-a" />
        <span className="join-orb join-orb-b" />
      </div>

      <div className="shell results-shell">
        <div className="topbar">
          <Link href="/dashboard" className="brand">
            MAGS <span>Evaluering</span>
          </Link>
          <div className="row">
            <Link href={`/evaluations/${id}`} className="btn ghost">
              Tilbage
            </Link>
            <Link
              href={`/evaluations/${id}/results/slideshow`}
              className="btn"
            >
              Slideshow
            </Link>
            <Link href={`/evaluations/${id}/present`} className="btn secondary">
              Vis på skærm
            </Link>
          </div>
        </div>

        <header className="results-hero">
          <p className="status-kicker">Resultater</p>
          <div className="results-hero-top">
            <div>
              <h1 className="results-title">
                {summary?.title || 'Evaluering'}
              </h1>
              <p className="results-lead">
                {summary?.classLabel || 'Hold'} · anonyme svar fra holdet
              </p>
            </div>
            {summary ? (
              <span className={statusClass(summary.status)}>
                {statusLabel(summary.status)}
              </span>
            ) : null}
          </div>

          <div className="results-stats results-stats-4">
            <div className="results-stat">
              <span className="results-stat-value">
                {summary?.totalResponses ?? 0}
              </span>
              <span className="results-stat-label">svar</span>
            </div>
            <div className="results-stat">
              <span className="results-stat-value">
                {insights.overall !== null
                  ? insights.overall.toFixed(2)
                  : '–'}
              </span>
              <span className="results-stat-label">samlet gns.</span>
            </div>
            <div className="results-stat">
              <span className="results-stat-value">{insights.agreePct}%</span>
              <span className="results-stat-label">enig / meget enig</span>
            </div>
            <div className="results-stat">
              <span className="results-stat-value">
                {insights.disagreePct}%
              </span>
              <span className="results-stat-label">uenig / meget uenig</span>
            </div>
          </div>

          {hasData && insights.overall !== null ? (
            <div className="results-pulse">
              <div className="results-pulse-labels">
                <span>Meget uenig</span>
                <span>Meget enig</span>
              </div>
              <div className="results-pulse-track">
                <div
                  className="results-pulse-fill"
                  style={{ width: `${Math.max(4, Math.min(100, pulsePct))}%` }}
                />
                <span
                  className="results-pulse-marker"
                  style={{ left: `${Math.max(2, Math.min(98, pulsePct))}%` }}
                />
              </div>
            </div>
          ) : null}
        </header>

        {hasData ? (
          <div className="results-tabs results-tabs-wrap" role="tablist">
            {(
              [
                ['insight', 'Indblik'],
                ['scales', 'Rangering'],
                ['quotes', 'Citater'],
                ['ai', 'AI'],
                ['detail', 'Detaljer'],
                ['individual', 'Enkelte'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                className={`results-tab ${view === key ? 'active' : ''}`}
                onClick={() => setView(key)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {error ? <div className="error">{error}</div> : null}

        {!hasData ? (
          <div className="results-empty">
            <h2>Ingen svar endnu</h2>
            <p>
              Når eleverne har besvaret, får du indblik, rangering og citater
              her.
            </p>
            <Link href={`/evaluations/${id}/present`} className="btn">
              Åbn delingsskærm
            </Link>
          </div>
        ) : null}

        {hasData && view === 'insight' ? (
          <div className="results-insight-grid">
            <section className="results-card results-insight-main">
              <p className="results-q-index">Hurtigt indblik</p>
              <h2 className="results-q-title">Hvad siger tallene?</h2>
              <p className="results-lead" style={{ marginBottom: '1.25rem' }}>
                {insights.agreePct}% af skalasvar ligger på enig/meget enig.
                Samlet gennemsnit er{' '}
                <strong>
                  {insights.overall !== null
                    ? insights.overall.toFixed(2)
                    : '–'}
                </strong>{' '}
                på en skala fra 1–4.
              </p>
              <div className="results-split">
                <div className="results-split-col is-high">
                  <span className="results-split-pct">{insights.agreePct}%</span>
                  <span>positivt (3–4)</span>
                </div>
                <div className="results-split-col is-low">
                  <span className="results-split-pct">
                    {insights.disagreePct}%
                  </span>
                  <span>kritisk (1–2)</span>
                </div>
              </div>
            </section>

            <section className="results-card">
              <p className="results-q-index">Stærkest</p>
              <h2 className="results-q-title">Højest bedømt</h2>
              <div className="results-rank-mini">
                {insights.top.map((row, i) => (
                  <button
                    type="button"
                    className="results-rank-mini-item"
                    key={row.key}
                    onClick={() => {
                      setView('scales');
                      setScaleSort('high');
                      setExpandedRow(row.key);
                    }}
                  >
                    <span className="results-rank-num">{i + 1}</span>
                    <span className="results-rank-text">
                      <strong>{row.rowText}</strong>
                      <span className="muted">{row.sectionTitle}</span>
                    </span>
                    <span className={`results-avg ${averageTone(row.average)}`}>
                      {row.average.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="results-card">
              <p className="results-q-index">Fokus</p>
              <h2 className="results-q-title">Lavest bedømt</h2>
              <div className="results-rank-mini">
                {insights.bottom.map((row, i) => (
                  <button
                    type="button"
                    className="results-rank-mini-item"
                    key={row.key}
                    onClick={() => {
                      setView('scales');
                      setScaleSort('low');
                      setExpandedRow(row.key);
                    }}
                  >
                    <span className="results-rank-num">{i + 1}</span>
                    <span className="results-rank-text">
                      <strong>{row.rowText}</strong>
                      <span className="muted">{row.sectionTitle}</span>
                    </span>
                    <span className={`results-avg ${averageTone(row.average)}`}>
                      {row.average.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {textQuestions[0] ? (
              <section className="results-card results-insight-quote">
                <p className="results-q-index">Citater</p>
                <h2 className="results-q-title">{textQuestions[0].text}</h2>
                <div className="results-quotes">
                  {(textQuestions[0].texts || []).slice(0, 4).map((text, i) => (
                    <blockquote className="results-quote" key={i}>
                      {text}
                    </blockquote>
                  ))}
                </div>
                {(textQuestions[0].texts || []).length > 4 ? (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setView('quotes')}
                  >
                    Se alle citater
                  </button>
                ) : null}
              </section>
            ) : null}
          </div>
        ) : null}

        {hasData && view === 'scales' ? (
          <div className="results-list">
            <div className="results-toolbar">
              <p className="muted" style={{ margin: 0 }}>
                {sortedScaleRows.length} skalapunkter sorteret efter gennemsnit
              </p>
              <div className="results-sort">
                <button
                  type="button"
                  className={`results-sort-btn ${scaleSort === 'high' ? 'active' : ''}`}
                  onClick={() => setScaleSort('high')}
                >
                  Højest først
                </button>
                <button
                  type="button"
                  className={`results-sort-btn ${scaleSort === 'low' ? 'active' : ''}`}
                  onClick={() => setScaleSort('low')}
                >
                  Lavest først
                </button>
              </div>
            </div>

            {sortedScaleRows.map((row, index) => {
              const span = Math.max(1, row.scaleMax - row.scaleMin);
              const fill = ((row.average - row.scaleMin) / span) * 100;
              const open = expandedRow === row.key;
              return (
                <article
                  className={`results-card results-rank-card ${open ? 'is-open' : ''}`}
                  key={row.key}
                >
                  <button
                    type="button"
                    className="results-rank-toggle"
                    onClick={() =>
                      setExpandedRow(open ? null : row.key)
                    }
                  >
                    <span className="results-rank-num">{index + 1}</span>
                    <span className="results-rank-body">
                      <span className="muted results-rank-section">
                        {row.sectionTitle}
                      </span>
                      <strong className="results-rank-title">
                        {row.rowText}
                      </strong>
                      <span className="muted">{row.questionText}</span>
                      <div className="results-score-meter">
                        <div
                          className="results-score-fill"
                          style={{ width: `${fill}%` }}
                        />
                      </div>
                    </span>
                    <span className={`results-avg ${averageTone(row.average)}`}>
                      {row.average.toFixed(2)}
                    </span>
                  </button>
                  {open ? (
                    <div className="results-rank-detail">
                      <DistributionBars
                        distribution={row.distribution}
                        scaleMin={row.scaleMin}
                        scaleLabels={row.scaleLabels}
                      />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}

        {hasData && view === 'quotes' ? (
          <div className="results-list">
            {textQuestions.length === 0 ? (
              <div className="results-empty">
                <h2>Ingen tekstsvar</h2>
                <p>Der er endnu ingen frie tekstsvar at vise.</p>
              </div>
            ) : (
              textQuestions.map((q) => (
                <section className="results-card" key={q.questionId}>
                  <div className="results-card-head">
                    <span className="results-q-index">
                      {sectionByQuestion.get(q.questionId) || 'Tekst'}
                    </span>
                    <span className="results-type">
                      {(q.texts || []).length} citater
                    </span>
                  </div>
                  <h2 className="results-q-title">{q.text}</h2>
                  <div className="results-quote-grid">
                    {(q.texts || []).map((text, i) => (
                      <blockquote
                        className="results-quote"
                        key={`${q.questionId}-${i}`}
                      >
                        {text}
                      </blockquote>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        ) : null}

        {hasData && view === 'ai' ? (
          <div className="results-list">
            <section className="results-card results-ai-hero">
              <p className="results-q-index">OpenAI</p>
              <h2 className="results-q-title">AI-indsigt i evalueringen</h2>
              <p className="results-lead">
                Få en hurtig recap af de skriftlige svar, eller en samlet
                rapport baseret på skalaer, valg og tekst.
              </p>
              <div className="results-ai-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={aiLoading !== null}
                  onClick={() => runAi('texts')}
                >
                  {aiLoading === 'texts'
                    ? 'Analyserer tekst…'
                    : 'Recap af skriftlige svar'}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={aiLoading !== null}
                  onClick={() => runAi('report')}
                >
                  {aiLoading === 'report'
                    ? 'Skriver rapport…'
                    : 'Fuld AI-rapport'}
                </button>
              </div>
              {aiError ? <div className="error">{aiError}</div> : null}
            </section>

            {aiTexts ? (
              <article className="results-card results-ai-output">
                <div className="results-card-head">
                  <span className="results-q-index">Tekst-recap</span>
                  <span className="muted">
                    {new Date(aiTexts.generatedAt).toLocaleString('da-DK')}
                  </span>
                </div>
                <h2 className="results-q-title">
                  Tendenser i de skriftlige svar
                </h2>
                <div className="results-ai-content">
                  <AiMarkdown content={aiTexts.content} />
                </div>
              </article>
            ) : null}

            {aiReport ? (
              <article className="results-card results-ai-output">
                <div className="results-card-head">
                  <span className="results-q-index">Fuld rapport</span>
                  <span className="muted">
                    {new Date(aiReport.generatedAt).toLocaleString('da-DK')}
                  </span>
                </div>
                <h2 className="results-q-title">
                  AI-rapport for {aiReport.title}
                </h2>
                <div className="results-ai-content">
                  <AiMarkdown content={aiReport.content} />
                </div>
              </article>
            ) : null}
          </div>
        ) : null}

        {hasData && view === 'detail' && summary ? (
          <div className="results-list">
            {summary.questions.map((q, qIndex) => (
              <article className="results-card" key={q.questionId}>
                <div className="results-card-head">
                  <span className="results-q-index">
                    {sectionByQuestion.get(q.questionId) ||
                      `Spørgsmål ${qIndex + 1}`}
                  </span>
                  <span className="results-type">
                    {questionTypeLabel(q.type as QuestionType)}
                  </span>
                </div>
                <h2 className="results-q-title">{q.text}</h2>
                <p className="results-q-meta">
                  {q.answerCount}{' '}
                  {q.type === 'TEXT' ? 'tekstsvar' : 'besvarelser'}
                </p>

                {q.type === 'SCALE' ? (
                  <DivergingScaleChart
                    scaleMin={q.scaleMin ?? 1}
                    scaleMax={q.scaleMax ?? 4}
                    scaleLabels={q.scaleLabels}
                    rows={(q.rows && q.rows.length > 0
                      ? q.rows
                      : [
                          {
                            index: 0,
                            text: q.text,
                            answerCount: q.answerCount,
                            average: q.average ?? null,
                            distribution: q.distribution || {},
                          },
                        ]
                    ).map((row) => ({
                      key: `${q.questionId}-${row.index}`,
                      text:
                        q.rows && q.rows.length > 1 ? row.text : 'Fordeling',
                      distribution: row.distribution || {},
                      average: row.average,
                      answerCount: row.answerCount,
                    }))}
                  />
                ) : null}

                {q.type === 'TEXT' ? (
                  <div className="results-quotes">
                    {(q.texts || []).map((text, i) => (
                      <blockquote
                        className="results-quote"
                        key={`${q.questionId}-${i}`}
                      >
                        {text}
                      </blockquote>
                    ))}
                  </div>
                ) : null}

                {q.type !== 'SCALE' && q.type !== 'TEXT' ? (
                  <div className="results-bars">
                    {(q.options || []).map((opt) => {
                      const total = Math.max(
                        1,
                        (q.options || []).reduce((a, o) => a + o.count, 0),
                      );
                      const pct = pctOf(opt.count, total);
                      return (
                        <div className="results-bar" key={opt.index}>
                          <div className="results-bar-label">
                            <strong>{opt.label}</strong>
                          </div>
                          <div className="results-bar-track">
                            <div
                              className="results-bar-fill"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="results-bar-count">
                            <strong>{opt.count}</strong>
                            <span className="muted">{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        {hasData && view === 'individual' ? (
          <div className="results-list">
            {responses.map((response, index) => (
              <article
                className="results-card results-individual"
                key={response.id}
              >
                <div className="results-card-head">
                  <span className="results-q-index">
                    Svar #{responses.length - index}
                  </span>
                  <span className="muted">
                    {new Date(response.submittedAt).toLocaleString('da-DK')}
                  </span>
                </div>
                <div className="results-answers">
                  {response.answers
                    .slice()
                    .sort((a, b) => {
                      if (a.question.order !== b.question.order) {
                        return a.question.order - b.question.order;
                      }
                      return (
                        (a.matrixItemIndex ?? 0) - (b.matrixItemIndex ?? 0)
                      );
                    })
                    .map((answer) => {
                      const rowText =
                        answer.matrixItemIndex !== null &&
                        answer.matrixItemIndex !== undefined &&
                        answer.question.matrixItems?.[answer.matrixItemIndex]
                          ? answer.question.matrixItems[answer.matrixItemIndex]
                          : null;
                      const options =
                        answer.question.type === 'YES_NO'
                          ? ['Ja', 'Nej']
                          : answer.question.choiceOptions || [];
                      const choiceText = (answer.choiceIndexes || [])
                        .map((i) => options[i])
                        .filter(Boolean)
                        .join(', ');
                      const value =
                        answer.question.type === 'SCALE'
                          ? formatScaleAnswer(
                              answer.scaleValue,
                              answer.question.scaleMin,
                              answer.question.scaleLabels,
                            )
                          : answer.question.type === 'TEXT'
                            ? answer.textValue || '–'
                            : choiceText || '–';
                      return (
                        <div className="results-answer" key={answer.id}>
                          <div className="results-answer-q">
                            {answer.question.text}
                            {rowText ? (
                              <span className="results-answer-row">
                                {' '}
                                — {rowText}
                              </span>
                            ) : null}
                          </div>
                          <div className="results-answer-a">{value}</div>
                        </div>
                      );
                    })}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}

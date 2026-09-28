'use client';

import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, PublicEvaluation, Question } from '@/lib/api';
import { labelForScaleValue, scaleValues } from '@/lib/scale';

type ScaleAnswers = Record<string, number | undefined>;

export default function StudentSurveyPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code || '').toUpperCase();

  const [evaluation, setEvaluation] = useState<PublicEvaluation | null>(null);
  const [closedInfo, setClosedInfo] = useState<{
    title: string;
    classLabel: string;
    code: string;
    status: string;
  } | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [scaleAnswers, setScaleAnswers] = useState<
    Record<string, ScaleAnswers>
  >({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [choiceAnswers, setChoiceAnswers] = useState<Record<string, number[]>>(
    {},
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const sections = useMemo(() => {
    if (!evaluation) return [];
    if (evaluation.sections && evaluation.sections.length > 0) {
      return evaluation.sections;
    }
    return [
      {
        id: 'default',
        title: 'Spørgsmål',
        order: 0,
        questions: evaluation.questions || [],
      },
    ];
  }, [evaluation]);

  const currentSection = sections[sectionIndex];
  const isLast = sectionIndex >= sections.length - 1;

  useEffect(() => {
    api
      .publicByCode(code)
      .then((data) => {
        if (!data.open) {
          setClosedInfo({
            title: data.title,
            classLabel: data.classLabel,
            code: data.code,
            status: data.status,
          });
          return;
        }
        setEvaluation(data);
        const scales: Record<string, ScaleAnswers> = {};
        const texts: Record<string, string> = {};
        const choices: Record<string, number[]> = {};
        const questions = [
          ...(data.sections?.flatMap((s) => s.questions) || []),
          ...(data.questions || []),
        ];
        const seen = new Set<string>();
        for (const q of questions) {
          if (seen.has(q.id)) continue;
          seen.add(q.id);
          if (q.type === 'SCALE') scales[q.id] = {};
          else if (q.type === 'TEXT') texts[q.id] = '';
          else choices[q.id] = [];
        }
        setScaleAnswers(scales);
        setTextAnswers(texts);
        setChoiceAnswers(choices);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : 'Kunne ikke hente evaluering',
        );
      })
      .finally(() => setLoading(false));
  }, [code]);

  function toggleMulti(questionId: string, index: number) {
    setChoiceAnswers((prev) => {
      const current = prev[questionId] || [];
      return {
        ...prev,
        [questionId]: current.includes(index)
          ? current.filter((i) => i !== index)
          : [...current, index],
      };
    });
  }

  function validateSection(questions: Question[]) {
    for (const q of questions) {
      if (!q.required) continue;
      if (q.type === 'TEXT') {
        if (!(textAnswers[q.id] || '').trim()) {
          throw new Error(`Udfyld: ${q.text}`);
        }
      } else if (q.type === 'SCALE') {
        const items =
          q.matrixItems && q.matrixItems.length > 0 ? q.matrixItems : [q.text];
        for (let i = 0; i < items.length; i++) {
          const value = scaleAnswers[q.id]?.[String(i)];
          if (value === undefined || value === null) {
            throw new Error(`Udfyld: ${items[i]}`);
          }
        }
      } else if ((choiceAnswers[q.id] || []).length === 0) {
        throw new Error(`Vælg: ${q.text}`);
      }
    }
  }

  function goNext() {
    if (!currentSection) return;
    setError('');
    try {
      validateSection(currentSection.questions);
      setSectionIndex((i) => Math.min(i + 1, sections.length - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Udfyld sektionen');
    }
  }

  function goBack() {
    setError('');
    setSectionIndex((i) => Math.max(i - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!evaluation || !currentSection) return;
    setSubmitting(true);
    setError('');
    try {
      validateSection(currentSection.questions);

      const allQuestions = sections.flatMap((s) => s.questions);
      const payload: Array<{
        questionId: string;
        scaleValue?: number;
        textValue?: string;
        matrixItemIndex?: number;
        choiceIndexes?: number[];
      }> = [];

      for (const q of allQuestions) {
        if (q.type === 'TEXT') {
          payload.push({
            questionId: q.id,
            textValue: textAnswers[q.id] || '',
          });
          continue;
        }
        if (q.type === 'SCALE') {
          const items =
            q.matrixItems && q.matrixItems.length > 0
              ? q.matrixItems
              : [q.text];
          for (let i = 0; i < items.length; i++) {
            const value = scaleAnswers[q.id]?.[String(i)];
            if (value !== undefined && value !== null) {
              payload.push({
                questionId: q.id,
                matrixItemIndex: i,
                scaleValue: value,
              });
            }
          }
          continue;
        }
        payload.push({
          questionId: q.id,
          choiceIndexes: choiceAnswers[q.id] || [],
        });
      }

      await api.submitResponse(code, payload);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke sende svar');
    } finally {
      setSubmitting(false);
    }
  }

  const showStatus = Boolean(
    loading || closedInfo || done || (error && !evaluation && !closedInfo),
  );

  return (
    <main className={showStatus ? 'status-shell' : 'shell'}>
      {!showStatus ? (
        <div className="topbar">
          <Link href="/" className="brand">
            Eval <span>Platform</span>
          </Link>
        </div>
      ) : null}

      {loading ? (
        <section className="status-page status-page-full">
          <div className="status-card status-loading">
            <p className="join-brand status-brand">
              Eval <span>Platform</span>
            </p>
            <div className="status-pulse" aria-hidden="true" />
            <p className="muted" style={{ margin: 0 }}>
              Henter evaluering…
            </p>
          </div>
        </section>
      ) : null}

      {!loading && closedInfo ? (
        <section className="status-page status-page-full">
          <div
            className={`status-card ${
              closedInfo.status === 'DRAFT' ? 'status-wait' : 'status-closed'
            }`}
          >
            <p className="join-brand status-brand">
              Eval <span>Platform</span>
            </p>
            <p className="status-kicker">
              {closedInfo.status === 'DRAFT' ? 'Ikke åben endnu' : 'Lukket'}
            </p>
            <h1 className="status-title">
              {closedInfo.status === 'DRAFT'
                ? 'Vent lidt – evalueringen er ikke åbnet'
                : 'Tak – der er lukket for svar'}
            </h1>
            <p className="status-lead">
              {closedInfo.status === 'DRAFT'
                ? 'Din underviser har oprettet evalueringen, men ikke åbnet for besvarelse endnu. Prøv igen om et øjeblik.'
                : 'Din underviser har lukket for nye svar. Du behøver ikke gøre mere.'}
            </p>
            <div className="status-meta">
              <div>
                <span className="status-meta-label">Evaluering</span>
                <strong>{closedInfo.title}</strong>
              </div>
              <div>
                <span className="status-meta-label">Hold</span>
                <strong>{closedInfo.classLabel}</strong>
              </div>
              <div>
                <span className="status-meta-label">Kode</span>
                <strong className="status-code">{closedInfo.code}</strong>
              </div>
            </div>
            <Link href="/" className="btn secondary">
              Tilbage til forsiden
            </Link>
          </div>
        </section>
      ) : null}

      {!loading && error && !evaluation && !closedInfo ? (
        <section className="status-page status-page-full">
          <div className="status-card status-missing">
            <p className="join-brand status-brand">
              Eval <span>Platform</span>
            </p>
            <p className="status-kicker">Ukendt kode</p>
            <h1 className="status-title">Vi finder ikke den evaluering</h1>
            <p className="status-lead">
              Koden <strong className="status-code">{code}</strong> matcher
              ingen evaluering. Tjek om du har skrevet den rigtigt, eller spørg
              din underviser.
            </p>
            <Link href="/" className="btn">
              Prøv en anden kode
            </Link>
          </div>
        </section>
      ) : null}

      {done ? (
        <section className="status-page status-page-full">
          <div className="status-card status-done">
            <p className="join-brand status-brand">
              Eval <span>Platform</span>
            </p>
            <p className="status-kicker">Sendt</p>
            <h1 className="status-title">Tak for dit svar</h1>
            <p className="status-lead">
              Dit svar er sendt anonymt. Du kan lukke siden.
            </p>
            <Link href="/" className="btn secondary">
              Til forsiden
            </Link>
          </div>
        </section>
      ) : null}

      {evaluation && currentSection && !done && !loading ? (
        <section className="stack" style={{ maxWidth: 920, margin: '0 auto' }}>
          <div>
            <h1>{evaluation.title}</h1>
            <p>
              Klasse: {evaluation.classLabel} · Kode: {evaluation.code}
            </p>
          </div>

          <div className="section-progress">
            <span>
              Sektion {sectionIndex + 1} af {sections.length}
            </span>
            <div className="section-progress-track">
              <div
                className="section-progress-fill"
                style={{
                  width: `${((sectionIndex + 1) / sections.length) * 100}%`,
                }}
              />
            </div>
          </div>

          <form className="panel stack" onSubmit={onSubmit}>
            <h2 className="section-title">{currentSection.title}</h2>

            {currentSection.questions.map((q, index) => {
              const min = q.scaleMin ?? 1;
              const max = q.scaleMax ?? 5;
              const values = scaleValues(min, max);
              const hasLabels = (q.scaleLabels || []).some((l) => l?.trim());
              const rows =
                q.matrixItems && q.matrixItems.length > 0
                  ? q.matrixItems
                  : [q.text];
              const options = q.choiceOptions || [];

              return (
                <div className="question-card" key={q.id}>
                  <strong>
                    {index + 1}. {q.text}
                    {q.required ? ' *' : ''}
                  </strong>

                  {q.type === 'SCALE' ? (
                    <div className="matrix-scroll">
                      <div
                        className="matrix-table"
                        style={{
                          gridTemplateColumns: `minmax(160px, 1.4fr) repeat(${values.length}, minmax(72px, 1fr))`,
                        }}
                      >
                        <div className="matrix-corner" />
                        {values.map((value) => (
                          <div className="matrix-col-header" key={`h-${value}`}>
                            {hasLabels
                              ? labelForScaleValue(value, min, q.scaleLabels) ||
                                value
                              : value}
                          </div>
                        ))}
                        {rows.map((rowText, rowIndex) => (
                          <Fragment key={rowIndex}>
                            <div className="matrix-row-label">{rowText}</div>
                            {values.map((value) => (
                              <label
                                className="matrix-cell"
                                key={`${rowIndex}-${value}`}
                              >
                                <input
                                  type="radio"
                                  name={`${q.id}-${rowIndex}`}
                                  checked={
                                    scaleAnswers[q.id]?.[String(rowIndex)] ===
                                    value
                                  }
                                  onChange={() =>
                                    setScaleAnswers((prev) => ({
                                      ...prev,
                                      [q.id]: {
                                        ...prev[q.id],
                                        [String(rowIndex)]: value,
                                      },
                                    }))
                                  }
                                />
                              </label>
                            ))}
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {q.type === 'TEXT' ? (
                    <div className="field">
                      <textarea
                        value={textAnswers[q.id] || ''}
                        onChange={(e) =>
                          setTextAnswers((prev) => ({
                            ...prev,
                            [q.id]: e.target.value,
                          }))
                        }
                        placeholder="Skriv dit svar…"
                      />
                    </div>
                  ) : null}

                  {q.type === 'SINGLE_CHOICE' || q.type === 'YES_NO' ? (
                    <div className="choice-list">
                      {options.map((option, optIndex) => (
                        <label className="choice-option" key={optIndex}>
                          <input
                            type="radio"
                            name={q.id}
                            checked={
                              (choiceAnswers[q.id] || [])[0] === optIndex
                            }
                            onChange={() =>
                              setChoiceAnswers((prev) => ({
                                ...prev,
                                [q.id]: [optIndex],
                              }))
                            }
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}

                  {q.type === 'MULTI_CHOICE' ? (
                    <div className="choice-list">
                      {options.map((option, optIndex) => (
                        <label className="choice-option" key={optIndex}>
                          <input
                            type="checkbox"
                            checked={(choiceAnswers[q.id] || []).includes(
                              optIndex,
                            )}
                            onChange={() => toggleMulti(q.id, optIndex)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {error ? <div className="error">{error}</div> : null}

            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button
                className="btn ghost"
                type="button"
                onClick={goBack}
                disabled={sectionIndex === 0 || submitting}
              >
                Tilbage
              </button>
              {isLast ? (
                <button className="btn" type="submit" disabled={submitting}>
                  {submitting ? 'Sender…' : 'Send svar'}
                </button>
              ) : (
                <button className="btn" type="button" onClick={goNext}>
                  Næste
                </button>
              )}
            </div>
          </form>
        </section>
      ) : null}
    </main>
  );
}

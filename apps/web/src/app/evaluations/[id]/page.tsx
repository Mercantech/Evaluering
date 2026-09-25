'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  api,
  Evaluation,
  EvaluationStatus,
  QuestionType,
  SectionInput,
} from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  DEFAULT_LIKERT_4,
  DEFAULT_LIKERT_5,
  resizeScaleLabels,
  scaleValues,
} from '@/lib/scale';
import { questionTypeLabel } from '@/lib/questionTypes';
import { ShareQr } from '@/components/ShareQr';
import {
  createDraftQuestion,
  DraftQuestion,
  DraftSection,
  mapApiQuestionToDraft,
  toQuestionInput,
} from '@/lib/draftQuestions';

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

function updateSectionQuestions(
  sections: DraftSection[],
  sectionKey: string,
  updater: (questions: DraftQuestion[]) => DraftQuestion[],
): DraftSection[] {
  return sections.map((section) =>
    section.key === sectionKey
      ? { ...section, questions: updater(section.questions) }
      : section,
  );
}

export default function EvaluationBuilderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [title, setTitle] = useState('');
  const [classLabel, setClassLabel] = useState('');
  const [sections, setSections] = useState<DraftSection[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [responseCount, setResponseCount] = useState(0);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  const shareUrl = useMemo(() => {
    if (!evaluation || typeof window === 'undefined') return '';
    return `${window.location.origin}/s/${evaluation.code}`;
  }, [evaluation]);

  function applyEvaluation(data: Evaluation) {
    setEvaluation(data);
    setTitle(data.title);
    setClassLabel(data.classLabel);
    setResponseCount(data._count?.responses ?? 0);
    if (data.sections && data.sections.length > 0) {
      setSections(
        data.sections.map((section, sIndex) => ({
          key: section.id,
          title: section.title,
          questions: (section.questions || []).map(mapApiQuestionToDraft),
        })),
      );
    } else {
      setSections([
        {
          key: `section-${Date.now()}`,
          title: 'Sektion 1',
          questions: (data.questions || []).map(mapApiQuestionToDraft),
        },
      ]);
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    api
      .getEvaluation(token, id)
      .then(applyEvaluation)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Kunne ikke hente');
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    const token = getToken();
    if (!token || loading) return;
    const timer = window.setInterval(() => {
      api
        .getEvaluation(token, id)
        .then((data) => {
          setResponseCount(data._count?.responses ?? 0);
          setEvaluation((prev) =>
            prev
              ? { ...prev, status: data.status, _count: data._count }
              : data,
          );
        })
        .catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [id, loading]);

  function addSection() {
    setSections((prev) => [
      ...prev,
      {
        key: `section-${Date.now()}`,
        title: `Sektion ${prev.length + 1}`,
        questions: [],
      },
    ]);
  }

  function removeSection(sectionKey: string) {
    setSections((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((s) => s.key !== sectionKey);
    });
  }

  function updateSectionTitle(sectionKey: string, titleValue: string) {
    setSections((prev) =>
      prev.map((s) => (s.key === sectionKey ? { ...s, title: titleValue } : s)),
    );
  }

  function addQuestion(sectionKey: string, type: QuestionType) {
    setSections((prev) =>
      updateSectionQuestions(prev, sectionKey, (questions) => [
        ...questions,
        createDraftQuestion(type),
      ]),
    );
  }

  function removeQuestion(sectionKey: string, questionKey: string) {
    setSections((prev) =>
      updateSectionQuestions(prev, sectionKey, (questions) =>
        questions.filter((q) => q.key !== questionKey),
      ),
    );
  }

  function updateQuestion(
    sectionKey: string,
    questionKey: string,
    patch: Partial<DraftQuestion>,
  ) {
    setSections((prev) =>
      updateSectionQuestions(prev, sectionKey, (questions) =>
        questions.map((q) => (q.key === questionKey ? { ...q, ...patch } : q)),
      ),
    );
  }

  function updateScaleRange(
    sectionKey: string,
    questionKey: string,
    patch: { scaleMin?: number; scaleMax?: number },
  ) {
    setSections((prev) =>
      updateSectionQuestions(prev, sectionKey, (questions) =>
        questions.map((q) => {
          if (q.key !== questionKey) return q;
          const min = patch.scaleMin ?? q.scaleMin ?? 1;
          const max = patch.scaleMax ?? q.scaleMax ?? 5;
          if (min >= max) return q;
          return {
            ...q,
            scaleMin: min,
            scaleMax: max,
            scaleLabels: resizeScaleLabels(q.scaleLabels, min, max),
          };
        }),
      ),
    );
  }

  function applyLikertPreset(
    sectionKey: string,
    questionKey: string,
    steps: 4 | 5,
  ) {
    const labels = steps === 4 ? [...DEFAULT_LIKERT_4] : [...DEFAULT_LIKERT_5];
    updateQuestion(sectionKey, questionKey, {
      scaleMin: 1,
      scaleMax: steps,
      scaleLabels: labels,
    });
  }

  function updateScaleLabel(
    sectionKey: string,
    questionKey: string,
    index: number,
    value: string,
  ) {
    setSections((prev) =>
      updateSectionQuestions(prev, sectionKey, (questions) =>
        questions.map((q) => {
          if (q.key !== questionKey) return q;
          const labels = resizeScaleLabels(
            q.scaleLabels,
            q.scaleMin ?? 1,
            q.scaleMax ?? 5,
          );
          labels[index] = value;
          return { ...q, scaleLabels: labels };
        }),
      ),
    );
  }

  function addMatrixItem(sectionKey: string, questionKey: string) {
    setSections((prev) =>
      updateSectionQuestions(prev, sectionKey, (questions) =>
        questions.map((q) =>
          q.key === questionKey
            ? { ...q, matrixItems: [...(q.matrixItems || []), ''] }
            : q,
        ),
      ),
    );
  }

  function updateMatrixItem(
    sectionKey: string,
    questionKey: string,
    index: number,
    value: string,
  ) {
    setSections((prev) =>
      updateSectionQuestions(prev, sectionKey, (questions) =>
        questions.map((q) => {
          if (q.key !== questionKey) return q;
          const items = [...(q.matrixItems || [''])];
          items[index] = value;
          return { ...q, matrixItems: items };
        }),
      ),
    );
  }

  function removeMatrixItem(
    sectionKey: string,
    questionKey: string,
    index: number,
  ) {
    setSections((prev) =>
      updateSectionQuestions(prev, sectionKey, (questions) =>
        questions.map((q) => {
          if (q.key !== questionKey) return q;
          const items = [...(q.matrixItems || [])];
          if (items.length <= 1) return q;
          items.splice(index, 1);
          return { ...q, matrixItems: items };
        }),
      ),
    );
  }

  function addChoiceOption(sectionKey: string, questionKey: string) {
    setSections((prev) =>
      updateSectionQuestions(prev, sectionKey, (questions) =>
        questions.map((q) =>
          q.key === questionKey
            ? { ...q, choiceOptions: [...(q.choiceOptions || []), ''] }
            : q,
        ),
      ),
    );
  }

  function updateChoiceOption(
    sectionKey: string,
    questionKey: string,
    index: number,
    value: string,
  ) {
    setSections((prev) =>
      updateSectionQuestions(prev, sectionKey, (questions) =>
        questions.map((q) => {
          if (q.key !== questionKey) return q;
          const options = [...(q.choiceOptions || [])];
          options[index] = value;
          return { ...q, choiceOptions: options };
        }),
      ),
    );
  }

  function removeChoiceOption(
    sectionKey: string,
    questionKey: string,
    index: number,
  ) {
    setSections((prev) =>
      updateSectionQuestions(prev, sectionKey, (questions) =>
        questions.map((q) => {
          if (q.key !== questionKey) return q;
          const options = [...(q.choiceOptions || [])];
          if (options.length <= 2) return q;
          options.splice(index, 1);
          return { ...q, choiceOptions: options };
        }),
      ),
    );
  }

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await api.updateEvaluation(token, id, {
        title,
        classLabel,
      });
      setEvaluation((prev) => (prev ? { ...prev, ...updated } : updated));
      setMessage('Detaljer gemt');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke gemme');
    } finally {
      setSaving(false);
    }
  }

  async function saveStructure() {
    const token = getToken();
    if (!token) return;
    if (sections.some((s) => !s.title.trim())) {
      setError('Alle sektioner skal have et navn');
      return;
    }
    const allQuestions = sections.flatMap((s) => s.questions);
    if (allQuestions.length === 0) {
      setError('Tilføj mindst ét spørgsmål');
      return;
    }
    if (allQuestions.some((q) => !q.text.trim())) {
      setError('Alle spørgsmål skal have en overskrift');
      return;
    }
    if (
      allQuestions.some(
        (q) =>
          q.type === 'SCALE' &&
          !(q.matrixItems || []).some((item) => item.trim()),
      )
    ) {
      setError('Hvert skalaspørgsmål skal have mindst én række');
      return;
    }
    if (
      allQuestions.some(
        (q) =>
          (q.type === 'SINGLE_CHOICE' || q.type === 'MULTI_CHOICE') &&
          (q.choiceOptions || []).map((o) => o.trim()).filter(Boolean).length <
            2,
      )
    ) {
      setError('Valgspørgsmål skal have mindst to svarmuligheder');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload: SectionInput[] = sections.map((section, sIndex) => ({
        title: section.title.trim(),
        order: sIndex,
        questions: section.questions.map(toQuestionInput),
      }));
      const updated = await api.upsertStructure(token, id, payload);
      applyEvaluation(updated);
      setMessage('Sektioner og spørgsmål gemt');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke gemme');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: EvaluationStatus) {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await api.updateStatus(token, id, status);
      setEvaluation(updated);
      setMessage(
        status === 'OPEN'
          ? 'Evalueringen er åben for besvarelse'
          : status === 'CLOSED'
            ? 'Evalueringen er lukket'
            : 'Status opdateret',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke ændre status');
    } finally {
      setSaving(false);
    }
  }

  async function removeEvaluation() {
    if (!confirm('Slet denne evaluering permanent?')) return;
    const token = getToken();
    if (!token) return;
    try {
      await api.deleteEvaluation(token, id);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke slette');
    }
  }

  async function saveAsTemplate(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setSavingTemplate(true);
    setError('');
    setMessage('');
    try {
      const template = await api.createTemplateFromEvaluation(token, id, {
        name: templateName.trim() || evaluation?.title || 'Skabelon',
        description: templateDescription.trim() || undefined,
      });
      setMessage(`Gemt som skabelon: ${template.name}`);
      setTemplateName('');
      setTemplateDescription('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Kunne ikke gemme som skabelon',
      );
    } finally {
      setSavingTemplate(false);
    }
  }

  async function copyShare() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (loading) {
    return (
      <main className="shell">
        <p className="muted">Henter evaluering…</p>
      </main>
    );
  }

  if (!evaluation) {
    return (
      <main className="shell">
        <div className="error">{error || 'Evaluering ikke fundet'}</div>
        <Link href="/dashboard">Tilbage</Link>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="topbar">
        <Link href="/dashboard" className="brand">
          MAGS <span>Evaluering</span>
        </Link>
        <div className="row">
          <Link href={`/evaluations/${id}/present`} className="btn">
            Vis på skærm
          </Link>
          <Link href={`/evaluations/${id}/results`} className="btn secondary">
            Se resultater
          </Link>
          <Link href="/dashboard" className="btn ghost">
            Oversigt
          </Link>
        </div>
      </div>

      <section className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1>{evaluation.title}</h1>
            <p>Klasse: {evaluation.classLabel}</p>
          </div>
          <span className={statusClass(evaluation.status)}>
            {statusLabel(evaluation.status)}
          </span>
        </div>

        {error ? <div className="error">{error}</div> : null}
        {message ? <div className="success">{message}</div> : null}

        <div className="panel share-panel">
          <div className="share-layout">
            {shareUrl ? (
              <ShareQr url={shareUrl} code={evaluation.code} size={260} />
            ) : null}
            <div className="share-main">
              <div className="code-box">{evaluation.code}</div>
              <button
                type="button"
                className={`share-link ${copied ? 'copied' : ''}`}
                onClick={copyShare}
                title="Klik for at kopiere"
              >
                {copied ? 'Kopieret' : shareUrl || '…'}
              </button>
              <div className="share-counter" aria-live="polite">
                <span className="share-counter-number">{responseCount}</span>
                <span className="share-counter-label">svar</span>
              </div>
              <div className="row">
                <Link href={`/evaluations/${id}/present`} className="btn">
                  Vis på skærm
                </Link>
                {evaluation.status !== 'OPEN' ? (
                  <button
                    className="btn secondary"
                    type="button"
                    disabled={saving}
                    onClick={() => setStatus('OPEN')}
                  >
                    Åbn
                  </button>
                ) : (
                  <button
                    className="btn ghost"
                    type="button"
                    disabled={saving}
                    onClick={() => setStatus('CLOSED')}
                  >
                    Luk
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <form className="panel stack" onSubmit={saveMeta}>
          <h2>Detaljer</h2>
          <div className="field">
            <label htmlFor="title">Titel</label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="classLabel">Klasse-label</label>
            <input
              id="classLabel"
              value={classLabel}
              onChange={(e) => setClassLabel(e.target.value)}
              required
            />
          </div>
          <button className="btn secondary" type="submit" disabled={saving}>
            Gem detaljer
          </button>
        </form>

        <form className="panel stack" onSubmit={saveAsTemplate}>
          <h2>Gem som skabelon</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Gem den nuværende struktur (som den er gemt i databasen) til
            genbrug på andre hold.
          </p>
          <div className="field">
            <label htmlFor="templateName">Skabelonnavn</label>
            <input
              id="templateName"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={evaluation.title}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="templateDescription">Beskrivelse</label>
            <input
              id="templateDescription"
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="Valgfri"
            />
          </div>
          <button
            className="btn secondary"
            type="submit"
            disabled={savingTemplate}
          >
            {savingTemplate ? 'Gemmer…' : 'Gem som skabelon'}
          </button>
        </form>

        <div className="stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2>Sektioner</h2>
            <button className="btn ghost" type="button" onClick={addSection}>
              + Sektion
            </button>
          </div>

          {sections.map((section, sectionIndex) => (
            <div className="panel stack section-card" key={section.key}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Sektionsnavn</label>
                  <input
                    value={section.title}
                    onChange={(e) =>
                      updateSectionTitle(section.key, e.target.value)
                    }
                    placeholder="Fx Struktur"
                  />
                </div>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={sections.length <= 1}
                  onClick={() => removeSection(section.key)}
                >
                  Fjern sektion
                </button>
              </div>

              <div className="row">
                {(
                  [
                    'SCALE',
                    'TEXT',
                    'SINGLE_CHOICE',
                    'MULTI_CHOICE',
                    'YES_NO',
                  ] as QuestionType[]
                ).map((type) => (
                  <button
                    key={type}
                    className="btn ghost"
                    type="button"
                    onClick={() => addQuestion(section.key, type)}
                  >
                    + {questionTypeLabel(type)}
                  </button>
                ))}
              </div>

              {section.questions.length === 0 ? (
                <p className="muted">Ingen spørgsmål i denne sektion endnu.</p>
              ) : null}

              {section.questions.map((q, index) => (
                <div className="question-card" key={q.key}>
                  <div
                    className="row"
                    style={{ justifyContent: 'space-between' }}
                  >
                    <strong>
                      {sectionIndex + 1}.{index + 1} {questionTypeLabel(q.type)}
                    </strong>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => removeQuestion(section.key, q.key)}
                    >
                      Fjern
                    </button>
                  </div>

                  <div className="field">
                    <label>
                      {q.type === 'SCALE' ? 'Overskrift' : 'Spørgsmålstekst'}
                    </label>
                    <input
                      value={q.text}
                      onChange={(e) =>
                        updateQuestion(section.key, q.key, {
                          text: e.target.value,
                        })
                      }
                      placeholder={
                        q.type === 'SCALE'
                          ? 'Fx Jeg oplevede at…'
                          : 'Skriv spørgsmålet'
                      }
                    />
                  </div>

                  {q.type === 'SCALE' ? (
                    <div className="stack">
                      <label>Rækker / udsagn</label>
                      {(q.matrixItems || ['']).map((item, rowIndex) => (
                        <div
                          className="matrix-row-edit"
                          key={`${q.key}-row-${rowIndex}`}
                        >
                          <input
                            value={item}
                            onChange={(e) =>
                              updateMatrixItem(
                                section.key,
                                q.key,
                                rowIndex,
                                e.target.value,
                              )
                            }
                            placeholder={`Udsagn ${rowIndex + 1}`}
                          />
                          <button
                            className="btn ghost"
                            type="button"
                            disabled={(q.matrixItems || []).length <= 1}
                            onClick={() =>
                              removeMatrixItem(section.key, q.key, rowIndex)
                            }
                          >
                            Fjern
                          </button>
                        </div>
                      ))}
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => addMatrixItem(section.key, q.key)}
                      >
                        + Række
                      </button>
                      <div className="row">
                        <div className="field">
                          <label>Min</label>
                          <input
                            type="number"
                            value={q.scaleMin ?? 1}
                            onChange={(e) =>
                              updateScaleRange(section.key, q.key, {
                                scaleMin: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="field">
                          <label>Max</label>
                          <input
                            type="number"
                            value={q.scaleMax ?? 4}
                            onChange={(e) =>
                              updateScaleRange(section.key, q.key, {
                                scaleMax: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <button
                          className="btn ghost"
                          type="button"
                          onClick={() =>
                            applyLikertPreset(section.key, q.key, 4)
                          }
                        >
                          Enig/uenig (4)
                        </button>
                        <button
                          className="btn ghost"
                          type="button"
                          onClick={() =>
                            applyLikertPreset(section.key, q.key, 5)
                          }
                        >
                          Enig/uenig (5)
                        </button>
                      </div>
                      <div className="scale-label-grid">
                        {scaleValues(q.scaleMin ?? 1, q.scaleMax ?? 4).map(
                          (value, i) => (
                            <div
                              className="field"
                              key={`${q.key}-label-${value}`}
                            >
                              <label>{value}</label>
                              <input
                                value={q.scaleLabels?.[i] ?? ''}
                                onChange={(e) =>
                                  updateScaleLabel(
                                    section.key,
                                    q.key,
                                    i,
                                    e.target.value,
                                  )
                                }
                                placeholder={`Label for ${value}`}
                              />
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  ) : null}

                  {q.type === 'SINGLE_CHOICE' || q.type === 'MULTI_CHOICE' ? (
                    <div className="stack">
                      <label>Svarmuligheder</label>
                      {(q.choiceOptions || ['', '']).map((option, optIndex) => (
                        <div
                          className="matrix-row-edit"
                          key={`${q.key}-opt-${optIndex}`}
                        >
                          <input
                            value={option}
                            onChange={(e) =>
                              updateChoiceOption(
                                section.key,
                                q.key,
                                optIndex,
                                e.target.value,
                              )
                            }
                            placeholder={`Mulighed ${optIndex + 1}`}
                          />
                          <button
                            className="btn ghost"
                            type="button"
                            disabled={(q.choiceOptions || []).length <= 2}
                            onClick={() =>
                              removeChoiceOption(section.key, q.key, optIndex)
                            }
                          >
                            Fjern
                          </button>
                        </div>
                      ))}
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => addChoiceOption(section.key, q.key)}
                      >
                        + Mulighed
                      </button>
                    </div>
                  ) : null}

                  {q.type === 'YES_NO' ? (
                    <p className="muted" style={{ margin: 0 }}>
                      Fast valg: Ja / Nej
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ))}

          <button
            className="btn"
            type="button"
            disabled={saving}
            onClick={saveStructure}
          >
            Gem sektioner
          </button>
        </div>

        <div className="panel">
          <button
            className="btn danger"
            type="button"
            onClick={removeEvaluation}
          >
            Slet evaluering
          </button>
        </div>
      </section>
    </main>
  );
}

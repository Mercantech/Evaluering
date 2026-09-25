'use client';

import {
  DEFAULT_LIKERT_4,
  DEFAULT_LIKERT_5,
  resizeScaleLabels,
  scaleValues,
} from '@/lib/scale';
import { questionTypeLabel } from '@/lib/questionTypes';
import { QuestionType } from '@/lib/api';
import {
  createDraftQuestion,
  DraftQuestion,
  DraftSection,
} from '@/lib/draftQuestions';

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

type Props = {
  sections: DraftSection[];
  onChange: (sections: DraftSection[]) => void;
};

export function StructureEditor({ sections, onChange }: Props) {
  function addSection() {
    onChange([
      ...sections,
      {
        key: `section-${Date.now()}`,
        title: `Sektion ${sections.length + 1}`,
        questions: [],
      },
    ]);
  }

  function removeSection(sectionKey: string) {
    if (sections.length <= 1) return;
    onChange(sections.filter((s) => s.key !== sectionKey));
  }

  function updateSectionTitle(sectionKey: string, titleValue: string) {
    onChange(
      sections.map((s) =>
        s.key === sectionKey ? { ...s, title: titleValue } : s,
      ),
    );
  }

  function addQuestion(sectionKey: string, type: QuestionType) {
    onChange(
      updateSectionQuestions(sections, sectionKey, (questions) => [
        ...questions,
        createDraftQuestion(type),
      ]),
    );
  }

  function removeQuestion(sectionKey: string, questionKey: string) {
    onChange(
      updateSectionQuestions(sections, sectionKey, (questions) =>
        questions.filter((q) => q.key !== questionKey),
      ),
    );
  }

  function updateQuestion(
    sectionKey: string,
    questionKey: string,
    patch: Partial<DraftQuestion>,
  ) {
    onChange(
      updateSectionQuestions(sections, sectionKey, (questions) =>
        questions.map((q) => (q.key === questionKey ? { ...q, ...patch } : q)),
      ),
    );
  }

  function updateScaleRange(
    sectionKey: string,
    questionKey: string,
    patch: { scaleMin?: number; scaleMax?: number },
  ) {
    onChange(
      updateSectionQuestions(sections, sectionKey, (questions) =>
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
    onChange(
      updateSectionQuestions(sections, sectionKey, (questions) =>
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
    onChange(
      updateSectionQuestions(sections, sectionKey, (questions) =>
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
    onChange(
      updateSectionQuestions(sections, sectionKey, (questions) =>
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
    onChange(
      updateSectionQuestions(sections, sectionKey, (questions) =>
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
    onChange(
      updateSectionQuestions(sections, sectionKey, (questions) =>
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
    onChange(
      updateSectionQuestions(sections, sectionKey, (questions) =>
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
    onChange(
      updateSectionQuestions(sections, sectionKey, (questions) =>
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

  return (
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
              <div className="row" style={{ justifyContent: 'space-between' }}>
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
                    updateQuestion(section.key, q.key, { text: e.target.value })
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
                      onClick={() => applyLikertPreset(section.key, q.key, 4)}
                    >
                      Enig/uenig (4)
                    </button>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => applyLikertPreset(section.key, q.key, 5)}
                    >
                      Enig/uenig (5)
                    </button>
                  </div>
                  <div className="scale-label-grid">
                    {scaleValues(q.scaleMin ?? 1, q.scaleMax ?? 4).map(
                      (value, i) => (
                        <div className="field" key={`${q.key}-label-${value}`}>
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
    </div>
  );
}

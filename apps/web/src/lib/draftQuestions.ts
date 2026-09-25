import { Question, QuestionInput, QuestionType, SectionInput } from '@/lib/api';
import {
  DEFAULT_LIKERT_4,
  resizeScaleLabels,
} from '@/lib/scale';

export type DraftQuestion = QuestionInput & { key: string };

export type DraftSection = {
  key: string;
  title: string;
  questions: DraftQuestion[];
};

export function mapApiQuestionToDraft(q: Question, index: number): DraftQuestion {
  return {
    key: q.id,
    type: q.type,
    text: q.text,
    scaleMin: q.scaleMin ?? 1,
    scaleMax: q.scaleMax ?? 5,
    scaleLabels: resizeScaleLabels(
      q.scaleLabels,
      q.scaleMin ?? 1,
      q.scaleMax ?? 5,
    ),
    matrixItems:
      q.type === 'SCALE'
        ? q.matrixItems && q.matrixItems.length > 0
          ? [...q.matrixItems]
          : ['']
        : undefined,
    choiceOptions:
      q.type === 'SINGLE_CHOICE' || q.type === 'MULTI_CHOICE'
        ? q.choiceOptions && q.choiceOptions.length > 0
          ? [...q.choiceOptions]
          : ['', '']
        : q.type === 'YES_NO'
          ? ['Ja', 'Nej']
          : undefined,
    order: q.order ?? index,
    required: q.required,
  };
}

export function createDraftQuestion(type: QuestionType): DraftQuestion {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    text: '',
    scaleMin: 1,
    scaleMax: type === 'SCALE' ? 4 : 5,
    scaleLabels: type === 'SCALE' ? [...DEFAULT_LIKERT_4] : undefined,
    matrixItems: type === 'SCALE' ? [''] : undefined,
    choiceOptions:
      type === 'YES_NO'
        ? ['Ja', 'Nej']
        : type === 'SINGLE_CHOICE' || type === 'MULTI_CHOICE'
          ? ['', '']
          : undefined,
    order: 0,
    required: true,
  };
}

export function toQuestionInput(q: DraftQuestion, index: number): QuestionInput {
  return {
    type: q.type,
    text: q.text.trim(),
    scaleMin: q.type === 'SCALE' ? q.scaleMin ?? 1 : undefined,
    scaleMax: q.type === 'SCALE' ? q.scaleMax ?? 5 : undefined,
    scaleLabels:
      q.type === 'SCALE'
        ? (() => {
            const labels = resizeScaleLabels(
              q.scaleLabels,
              q.scaleMin ?? 1,
              q.scaleMax ?? 5,
            );
            return labels.some((l) => l.trim()) ? labels : [];
          })()
        : undefined,
    matrixItems:
      q.type === 'SCALE'
        ? (q.matrixItems || []).map((item) => item.trim()).filter(Boolean)
        : undefined,
    choiceOptions:
      q.type === 'YES_NO'
        ? ['Ja', 'Nej']
        : q.type === 'SINGLE_CHOICE' || q.type === 'MULTI_CHOICE'
          ? (q.choiceOptions || []).map((o) => o.trim()).filter(Boolean)
          : undefined,
    order: index,
    required: q.required ?? true,
  };
}

export function mapStructureToDraft(
  sections: SectionInput[] | undefined | null,
): DraftSection[] {
  const list = sections && sections.length > 0 ? sections : [];
  if (list.length === 0) {
    return [
      {
        key: `section-${Date.now()}`,
        title: 'Sektion 1',
        questions: [],
      },
    ];
  }
  return list.map((section, sIndex) => ({
    key: `section-${sIndex}-${Date.now()}`,
    title: section.title || `Sektion ${sIndex + 1}`,
    questions: (section.questions || []).map((q, qIndex) => ({
      key: `q-${sIndex}-${qIndex}-${Date.now()}`,
      type: q.type,
      text: q.text || '',
      scaleMin: q.scaleMin ?? 1,
      scaleMax: q.scaleMax ?? (q.type === 'SCALE' ? 4 : 5),
      scaleLabels:
        q.type === 'SCALE'
          ? resizeScaleLabels(
              q.scaleLabels,
              q.scaleMin ?? 1,
              q.scaleMax ?? 4,
            )
          : undefined,
      matrixItems:
        q.type === 'SCALE'
          ? q.matrixItems && q.matrixItems.length > 0
            ? [...q.matrixItems]
            : ['']
          : undefined,
      choiceOptions:
        q.type === 'SINGLE_CHOICE' || q.type === 'MULTI_CHOICE'
          ? q.choiceOptions && q.choiceOptions.length > 0
            ? [...q.choiceOptions]
            : ['', '']
          : q.type === 'YES_NO'
            ? ['Ja', 'Nej']
            : undefined,
      order: q.order ?? qIndex,
      required: q.required ?? true,
    })),
  }));
}

export function draftsToSectionInputs(sections: DraftSection[]): SectionInput[] {
  return sections.map((section, sIndex) => ({
    title: section.title.trim() || `Sektion ${sIndex + 1}`,
    order: sIndex,
    questions: section.questions.map((q, qIndex) => toQuestionInput(q, qIndex)),
  }));
}

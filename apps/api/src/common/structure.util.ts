import { QuestionType } from '@prisma/client';
import { QuestionInputDto } from '../evaluations/dto/upsert-questions.dto';
import { normalizeShowWhen, ShowWhen } from './visibility';
import { Prisma } from '@prisma/client';

export type StructureSection = {
  title: string;
  order?: number;
  stableKey?: string;
  showWhen?: ShowWhen | Record<string, unknown> | null;
  questions: QuestionInputDto[];
};

function ensureKey(prefix: string, provided: string | undefined, index: number) {
  const trimmed = provided?.trim();
  if (trimmed) return trimmed;
  return `${prefix}-${index}-${Date.now().toString(36)}`;
}

export function mapQuestionData(
  evaluationId: string,
  q: QuestionInputDto,
  index: number,
) {
  const isScale = q.type === QuestionType.SCALE;
  const isChoice =
    q.type === QuestionType.SINGLE_CHOICE ||
    q.type === QuestionType.MULTI_CHOICE;
  const isYesNo = q.type === QuestionType.YES_NO;
  const min = q.scaleMin ?? 1;
  const max = q.scaleMax ?? 5;
  const trimmedLabels = (q.scaleLabels ?? []).map((label) => label.trim());
  const hasLabels = isScale && trimmedLabels.some(Boolean);
  const matrixItems = isScale
    ? (q.matrixItems ?? []).map((item) => item.trim()).filter(Boolean)
    : [];
  const choiceOptions = isYesNo
    ? ['Ja', 'Nej']
    : isChoice
      ? (q.choiceOptions ?? []).map((o) => o.trim()).filter(Boolean)
      : [];
  const showWhen = normalizeShowWhen(q.showWhen ?? null);

  return {
    evaluationId,
    type: q.type,
    text: q.text,
    scaleMin: isScale ? min : null,
    scaleMax: isScale ? max : null,
    scaleLabels: hasLabels ? trimmedLabels : [],
    matrixItems,
    choiceOptions,
    order: q.order ?? index,
    required: q.required ?? true,
    stableKey: ensureKey('q', q.stableKey, index),
    showWhen: (showWhen as Prisma.InputJsonValue | null) ?? undefined,
  };
}

export function questionToInput(q: {
  type: QuestionType;
  text: string;
  scaleMin: number | null;
  scaleMax: number | null;
  scaleLabels: string[];
  matrixItems: string[];
  choiceOptions: string[];
  order: number;
  required: boolean;
  stableKey?: string;
  showWhen?: unknown;
}): QuestionInputDto {
  return {
    type: q.type,
    text: q.text,
    scaleMin: q.scaleMin ?? undefined,
    scaleMax: q.scaleMax ?? undefined,
    scaleLabels: q.scaleLabels ?? [],
    matrixItems: q.matrixItems ?? [],
    choiceOptions: q.choiceOptions ?? [],
    order: q.order,
    required: q.required,
    stableKey: q.stableKey,
    showWhen: (normalizeShowWhen(q.showWhen) as Record<string, unknown> | null) ?? null,
  };
}

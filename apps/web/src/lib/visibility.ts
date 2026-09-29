export type VisibilityOp =
  | 'choiceEquals'
  | 'choiceIn'
  | 'choiceIncludesAny'
  | 'choiceIncludesAll'
  | 'scaleEq'
  | 'scaleLt'
  | 'scaleLte'
  | 'scaleGt'
  | 'scaleGte'
  | 'scaleAnyRowLt'
  | 'scaleAnyRowLte'
  | 'scaleAnyRowGt'
  | 'scaleAnyRowGte'
  | 'answered'
  | 'empty';

export type VisibilityCondition = {
  sourceKey: string;
  op: VisibilityOp;
  choiceIndexes?: number[];
  scaleValue?: number;
  matrixItemIndex?: number;
};

export type ShowWhen =
  | VisibilityCondition
  | { anyOf: VisibilityCondition[] };

export type AnswerSnapshot = {
  choiceIndexes?: number[];
  scaleValue?: number | null;
  scaleByRow?: Record<number, number>;
  textValue?: string | null;
};

function asConditionList(showWhen: ShowWhen | null | undefined): VisibilityCondition[] {
  if (!showWhen) return [];
  if ('anyOf' in showWhen && Array.isArray(showWhen.anyOf)) {
    return showWhen.anyOf;
  }
  return [showWhen as VisibilityCondition];
}

function hasAnswer(answer: AnswerSnapshot | undefined): boolean {
  if (!answer) return false;
  if (answer.choiceIndexes && answer.choiceIndexes.length > 0) return true;
  if (answer.scaleValue !== null && answer.scaleValue !== undefined) return true;
  if (answer.scaleByRow && Object.keys(answer.scaleByRow).length > 0) return true;
  if (answer.textValue && answer.textValue.trim()) return true;
  return false;
}

function compareScale(op: VisibilityOp, left: number, right: number): boolean {
  switch (op) {
    case 'scaleEq':
      return left === right;
    case 'scaleLt':
    case 'scaleAnyRowLt':
      return left < right;
    case 'scaleLte':
    case 'scaleAnyRowLte':
      return left <= right;
    case 'scaleGt':
    case 'scaleAnyRowGt':
      return left > right;
    case 'scaleGte':
    case 'scaleAnyRowGte':
      return left >= right;
    default:
      return false;
  }
}

export function evaluateCondition(
  condition: VisibilityCondition,
  answersByKey: Map<string, AnswerSnapshot>,
): boolean {
  const answer = answersByKey.get(condition.sourceKey);
  const op = condition.op;

  if (op === 'answered') return hasAnswer(answer);
  if (op === 'empty') return !hasAnswer(answer);
  if (!answer) return false;

  if (
    op === 'choiceEquals' ||
    op === 'choiceIn' ||
    op === 'choiceIncludesAny' ||
    op === 'choiceIncludesAll'
  ) {
    const selected = answer.choiceIndexes ?? [];
    const wanted = condition.choiceIndexes ?? [];
    if (wanted.length === 0) return false;
    if (op === 'choiceEquals') {
      return selected.length === 1 && selected[0] === wanted[0];
    }
    if (op === 'choiceIn') {
      return selected.some((i) => wanted.includes(i));
    }
    if (op === 'choiceIncludesAny') {
      return wanted.some((i) => selected.includes(i));
    }
    return wanted.every((i) => selected.includes(i));
  }

  const threshold = condition.scaleValue;
  if (threshold === undefined || threshold === null) return false;

  if (
    op === 'scaleAnyRowLt' ||
    op === 'scaleAnyRowLte' ||
    op === 'scaleAnyRowGt' ||
    op === 'scaleAnyRowGte'
  ) {
    const rows = answer.scaleByRow ?? {};
    const values = Object.values(rows);
    if (values.length === 0 && answer.scaleValue != null) {
      values.push(answer.scaleValue);
    }
    return values.some((v) => compareScale(op, v, threshold));
  }

  if (
    op === 'scaleEq' ||
    op === 'scaleLt' ||
    op === 'scaleLte' ||
    op === 'scaleGt' ||
    op === 'scaleGte'
  ) {
    let value: number | undefined;
    if (
      condition.matrixItemIndex !== undefined &&
      condition.matrixItemIndex !== null
    ) {
      value = answer.scaleByRow?.[condition.matrixItemIndex];
    } else if (answer.scaleValue != null) {
      value = answer.scaleValue;
    } else if (answer.scaleByRow) {
      const vals = Object.values(answer.scaleByRow);
      if (vals.length === 1) value = vals[0];
    }
    if (value === undefined) return false;
    return compareScale(op, value, threshold);
  }

  return false;
}

export function isVisible(
  showWhen: ShowWhen | null | undefined,
  answersByKey: Map<string, AnswerSnapshot>,
): boolean {
  const conditions = asConditionList(showWhen);
  if (conditions.length === 0) return true;
  return conditions.some((c) => evaluateCondition(c, answersByKey));
}

export function normalizeShowWhen(raw: unknown): ShowWhen | null {
  if (!raw || typeof raw !== 'object') return null;
  if ('anyOf' in (raw as object)) {
    const anyOf = (raw as { anyOf: unknown }).anyOf;
    if (!Array.isArray(anyOf) || anyOf.length === 0) return null;
    const cleaned = anyOf.filter(isValidCondition) as VisibilityCondition[];
    if (cleaned.length === 0) return null;
    if (cleaned.length === 1) return cleaned[0];
    return { anyOf: cleaned };
  }
  if (isValidCondition(raw)) return raw as VisibilityCondition;
  return null;
}

function isValidCondition(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const c = raw as VisibilityCondition;
  return typeof c.sourceKey === 'string' && c.sourceKey.length > 0 && typeof c.op === 'string';
}

export function conditionsFromShowWhen(
  showWhen: ShowWhen | null | undefined,
): VisibilityCondition[] {
  return asConditionList(showWhen);
}

export function showWhenFromConditions(
  conditions: VisibilityCondition[],
): ShowWhen | null {
  if (conditions.length === 0) return null;
  if (conditions.length === 1) return conditions[0];
  return { anyOf: conditions };
}

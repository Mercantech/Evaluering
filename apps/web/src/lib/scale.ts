/** Defaults matching a Forms-style 4-point Likert (enig/uenig). */
export const DEFAULT_LIKERT_4 = [
  'Meget uenig',
  'Uenig',
  'Enig',
  'Meget enig',
] as const;

export const DEFAULT_LIKERT_5 = [
  'Meget uenig',
  'Uenig',
  'Hverken enig eller uenig',
  'Enig',
  'Meget enig',
] as const;

export function scaleValues(min: number, max: number): number[] {
  const values: number[] = [];
  for (let i = min; i <= max; i++) values.push(i);
  return values;
}

export function resizeScaleLabels(
  labels: string[] | undefined,
  min: number,
  max: number,
): string[] {
  const count = max - min + 1;
  const next = Array.from({ length: count }, (_, i) => labels?.[i]?.trim() ?? '');
  return next;
}

export function labelForScaleValue(
  value: number,
  min: number,
  labels: string[] | null | undefined,
): string | null {
  if (!labels || labels.length === 0) return null;
  const idx = value - min;
  const label = labels[idx];
  return label?.trim() ? label.trim() : null;
}

export function formatScaleAnswer(
  value: number | null | undefined,
  min: number | null | undefined,
  labels: string[] | null | undefined,
): string {
  if (value === null || value === undefined) return '–';
  const label = labelForScaleValue(value, min ?? 1, labels);
  return label ? `${value} · ${label}` : String(value);
}

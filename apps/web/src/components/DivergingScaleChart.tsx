'use client';

import { labelForScaleValue } from '@/lib/scale';

export type DivergingRow = {
  key: string;
  text: string;
  distribution: Record<string, number>;
  average?: number | null;
  answerCount?: number;
};

/** Forms-lignende: uenig (varm) → enig (blå). */
const SEGMENT_COLORS = [
  '#c45a28',
  '#e8a06a',
  '#8fb4d4',
  '#3d6f9c',
  '#2a5478',
];

function pct(count: number, total: number) {
  if (total <= 0) return 0;
  return (count / total) * 100;
}

function colorForIndex(index: number, count: number) {
  if (count <= 1) return SEGMENT_COLORS[0];
  if (count === 2) return SEGMENT_COLORS[index === 0 ? 1 : 3];
  if (count === 3) return SEGMENT_COLORS[index === 0 ? 0 : index === 1 ? 2 : 3];
  if (count === 4) return SEGMENT_COLORS[index] ?? SEGMENT_COLORS[3];
  const t = index / (count - 1);
  const mapped = Math.round(t * (SEGMENT_COLORS.length - 1));
  return SEGMENT_COLORS[mapped] ?? SEGMENT_COLORS[3];
}

export function DivergingScaleChart({
  rows,
  scaleMin,
  scaleMax,
  scaleLabels,
}: {
  rows: DivergingRow[];
  scaleMin: number;
  scaleMax: number;
  scaleLabels?: string[];
}) {
  const values: number[] = [];
  for (let v = scaleMin; v <= scaleMax; v += 1) values.push(v);

  const mid = (scaleMin + scaleMax) / 2;
  // Venstre (flex-end): laveste værdi yderst, tættest på midten nærmest aksen
  const leftValues = values.filter((v) => v < mid);
  // Højre (flex-start): tættest på midten først
  const rightValues = values.filter((v) => v > mid);
  const midValue = values.find((v) => v === mid);

  return (
    <div className="diverging">
      <div className="diverging-legend" aria-label="Skala">
        {values.map((value, index) => {
          const label =
            labelForScaleValue(value, scaleMin, scaleLabels) || String(value);
          return (
            <span className="diverging-legend-item" key={value}>
              <span
                className="diverging-legend-dot"
                style={{ background: colorForIndex(index, values.length) }}
              />
              {label}
            </span>
          );
        })}
      </div>

      <div className="diverging-chart">
        {rows.map((row) => {
          const total = Object.values(row.distribution).reduce(
            (a, b) => a + b,
            0,
          );
          const midCount =
            midValue !== undefined
              ? row.distribution[String(midValue)] || 0
              : 0;
          const midPct = pct(midCount, total);

          return (
            <div className="diverging-row" key={row.key}>
              <div className="diverging-label">
                <span>{row.text}</span>
                {row.average !== null && row.average !== undefined ? (
                  <span className="diverging-label-meta muted">
                    Gns. {row.average.toFixed(2)}
                    {row.answerCount !== undefined
                      ? ` · ${row.answerCount} svar`
                      : ''}
                  </span>
                ) : null}
              </div>

              <div className="diverging-track">
                <div className="diverging-half diverging-half-left">
                  {leftValues.map((value) => {
                    const count = row.distribution[String(value)] || 0;
                    const width = pct(count, total);
                    if (width <= 0) return null;
                    return (
                      <div
                        key={value}
                        className="diverging-seg"
                        style={{
                          width: `${width}%`,
                          background: colorForIndex(
                            values.indexOf(value),
                            values.length,
                          ),
                        }}
                        title={`${labelForScaleValue(value, scaleMin, scaleLabels) || value}: ${count} (${Math.round(width)}%)`}
                      />
                    );
                  })}
                  {midPct > 0 ? (
                    <div
                      className="diverging-seg"
                      style={{
                        width: `${midPct / 2}%`,
                        background: colorForIndex(
                          values.indexOf(midValue!),
                          values.length,
                        ),
                      }}
                      title={`${labelForScaleValue(midValue!, scaleMin, scaleLabels) || midValue}: ${midCount}`}
                    />
                  ) : null}
                </div>

                <div className="diverging-axis" aria-hidden="true" />

                <div className="diverging-half diverging-half-right">
                  {midPct > 0 ? (
                    <div
                      className="diverging-seg"
                      style={{
                        width: `${midPct / 2}%`,
                        background: colorForIndex(
                          values.indexOf(midValue!),
                          values.length,
                        ),
                      }}
                    />
                  ) : null}
                  {rightValues.map((value) => {
                    const count = row.distribution[String(value)] || 0;
                    const width = pct(count, total);
                    if (width <= 0) return null;
                    return (
                      <div
                        key={value}
                        className="diverging-seg"
                        style={{
                          width: `${width}%`,
                          background: colorForIndex(
                            values.indexOf(value),
                            values.length,
                          ),
                        }}
                        title={`${labelForScaleValue(value, scaleMin, scaleLabels) || value}: ${count} (${Math.round(width)}%)`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        <div className="diverging-axis-labels" aria-hidden="true">
          <span className="diverging-axis-spacer" />
          <div className="diverging-axis-scale">
            <span>100%</span>
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

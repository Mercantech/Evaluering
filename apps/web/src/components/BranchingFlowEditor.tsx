'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Handle,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  Connection,
  Edge,
  Node,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { DraftQuestion, DraftSection } from '@/lib/draftQuestions';
import { questionTypeLabel } from '@/lib/questionTypes';
import {
  conditionsFromShowWhen,
  showWhenFromConditions,
  VisibilityCondition,
  VisibilityOp,
} from '@/lib/visibility';

type Props = {
  sections: DraftSection[];
  onChange: (sections: DraftSection[]) => void;
};

type FlowNodeData = {
  kind: 'section' | 'question';
  label: string;
  sublabel?: string;
  stableKey: string;
};

function SectionNode({ data }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <div className="flow-node flow-node-section">
      <Handle type="target" position={Position.Left} id="in" />
      <strong>{d.label}</strong>
      <span className="muted">Sektion</span>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

function QuestionNode({ data }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <div className="flow-node flow-node-question">
      <Handle type="target" position={Position.Left} id="in" />
      <strong>{d.label}</strong>
      {d.sublabel ? <span className="muted">{d.sublabel}</span> : null}
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

const nodeTypes = {
  section: SectionNode,
  question: QuestionNode,
};

function edgeId(cond: VisibilityCondition, targetKey: string, targetKind: string) {
  return `${cond.sourceKey}:${cond.op}:${(cond.choiceIndexes || []).join('-')}:${cond.scaleValue ?? ''}:${cond.matrixItemIndex ?? ''}->${targetKind}:${targetKey}`;
}

function buildGraph(sections: DraftSection[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let y = 0;

  sections.forEach((section, sIndex) => {
    const sectionX = 40;
    nodes.push({
      id: `section:${section.key}`,
      type: 'section',
      position: { x: sectionX, y },
      data: {
        kind: 'section',
        label: section.title || `Sektion ${sIndex + 1}`,
        stableKey: section.key,
      },
    });

    for (const cond of conditionsFromShowWhen(section.showWhen)) {
      edges.push({
        id: edgeId(cond, section.key, 'section'),
        source: `question:${cond.sourceKey}`,
        target: `section:${section.key}`,
        sourceHandle: 'out',
        targetHandle: 'in',
        label: labelForCondition(cond, sections),
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { condition: cond, targetKind: 'section', targetKey: section.key },
      });
    }

    section.questions.forEach((q, qIndex) => {
      const qY = y + 90 + qIndex * 90;
      nodes.push({
        id: `question:${q.key}`,
        type: 'question',
        position: { x: 360, y: qY },
        data: {
          kind: 'question',
          label: q.text.trim() || `Spørgsmål ${qIndex + 1}`,
          sublabel: questionTypeLabel(q.type),
          stableKey: q.key,
        },
      });

      for (const cond of conditionsFromShowWhen(q.showWhen)) {
        edges.push({
          id: edgeId(cond, q.key, 'question'),
          source: `question:${cond.sourceKey}`,
          target: `question:${q.key}`,
          sourceHandle: 'out',
          targetHandle: 'in',
          label: labelForCondition(cond, sections),
          markerEnd: { type: MarkerType.ArrowClosed },
          data: { condition: cond, targetKind: 'question', targetKey: q.key },
        });
      }
    });

    y += Math.max(180, 90 + section.questions.length * 90 + 40);
  });

  return { nodes, edges };
}

function labelForCondition(cond: VisibilityCondition, sections: DraftSection[]): string {
  const source = sections
    .flatMap((s) => s.questions)
    .find((q) => q.key === cond.sourceKey);

  if (cond.op === 'answered') return 'besvaret';
  if (cond.op === 'empty') return 'tom';

  if (
    cond.op === 'choiceEquals' ||
    cond.op === 'choiceIn' ||
    cond.op === 'choiceIncludesAny' ||
    cond.op === 'choiceIncludesAll'
  ) {
    const idx = cond.choiceIndexes?.[0];
    const label =
      idx !== undefined
        ? source?.choiceOptions?.[idx] ||
          (source?.type === 'YES_NO' ? ['Ja', 'Nej'][idx] : `#${idx}`)
        : '?';
    if (cond.op === 'choiceIncludesAll') return `alle: ${label}`;
    if (cond.op === 'choiceIncludesAny') return `inkl. ${label}`;
    return `= ${label}`;
  }

  const opMap: Record<string, string> = {
    scaleEq: '=',
    scaleLt: '<',
    scaleLte: '≤',
    scaleGt: '>',
    scaleGte: '≥',
    scaleAnyRowLt: 'nogen <',
    scaleAnyRowLte: 'nogen ≤',
    scaleAnyRowGt: 'nogen >',
    scaleAnyRowGte: 'nogen ≥',
  };
  return `${opMap[cond.op] || cond.op} ${cond.scaleValue ?? ''}`;
}

function defaultConditionForSource(source: DraftQuestion): VisibilityCondition {
  if (
    source.type === 'YES_NO' ||
    source.type === 'SINGLE_CHOICE' ||
    source.type === 'MULTI_CHOICE'
  ) {
    return {
      sourceKey: source.key,
      op: source.type === 'MULTI_CHOICE' ? 'choiceIncludesAny' : 'choiceEquals',
      choiceIndexes: [0],
    };
  }
  if (source.type === 'SCALE') {
    return {
      sourceKey: source.key,
      op: 'scaleAnyRowLt',
      scaleValue: 3,
    };
  }
  return { sourceKey: source.key, op: 'answered' };
}

function applyConditionToTarget(
  sections: DraftSection[],
  targetKind: 'section' | 'question',
  targetKey: string,
  condition: VisibilityCondition,
  mode: 'add' | 'remove',
): DraftSection[] {
  return sections.map((section) => {
    if (targetKind === 'section' && section.key === targetKey) {
      const current = conditionsFromShowWhen(section.showWhen);
      const next =
        mode === 'add'
          ? [...current.filter((c) => edgeId(c, targetKey, 'section') !== edgeId(condition, targetKey, 'section')), condition]
          : current.filter(
              (c) => edgeId(c, targetKey, 'section') !== edgeId(condition, targetKey, 'section'),
            );
      return { ...section, showWhen: showWhenFromConditions(next) };
    }
    if (targetKind === 'question') {
      return {
        ...section,
        questions: section.questions.map((q) => {
          if (q.key !== targetKey) return q;
          const current = conditionsFromShowWhen(q.showWhen);
          const next =
            mode === 'add'
              ? [
                  ...current.filter(
                    (c) =>
                      edgeId(c, targetKey, 'question') !==
                      edgeId(condition, targetKey, 'question'),
                  ),
                  condition,
                ]
              : current.filter(
                  (c) =>
                    edgeId(c, targetKey, 'question') !==
                    edgeId(condition, targetKey, 'question'),
                );
          return { ...q, showWhen: showWhenFromConditions(next) };
        }),
      };
    }
    return section;
  });
}

function orderIndex(sections: DraftSection[], key: string, kind: 'section' | 'question'): number {
  let seq = 0;
  for (const section of sections) {
    if (kind === 'section' && section.key === key) return seq;
    seq += 1;
    for (const q of section.questions) {
      if (kind === 'question' && q.key === key) return seq;
      seq += 1;
    }
  }
  return -1;
}

export function BranchingFlowEditor({ sections, onChange }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const graph = useMemo(() => buildGraph(sections), [sections]);
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [warning, setWarning] = useState('');

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph, setNodes, setEdges]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    // ReactFlow needs a resize tick after layout change
    window.setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [fullscreen]);

  const allQuestions = useMemo(
    () => sections.flatMap((s) => s.questions),
    [sections],
  );

  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
  const selectedCond = selectedEdge?.data?.condition as VisibilityCondition | undefined;
  const selectedSource = allQuestions.find((q) => q.key === selectedCond?.sourceKey);

  const onConnect = useCallback(
    (connection: Connection) => {
      setWarning('');
      if (!connection.source || !connection.target) return;
      if (!connection.source.startsWith('question:')) {
        setWarning('Træk fra et spørgsmål (kilde) til et mål');
        return;
      }
      const sourceKey = connection.source.replace('question:', '');
      const source = allQuestions.find((q) => q.key === sourceKey);
      if (!source) return;

      let targetKind: 'section' | 'question';
      let targetKey: string;
      if (connection.target.startsWith('section:')) {
        targetKind = 'section';
        targetKey = connection.target.replace('section:', '');
      } else if (connection.target.startsWith('question:')) {
        targetKind = 'question';
        targetKey = connection.target.replace('question:', '');
      } else {
        return;
      }

      if (sourceKey === targetKey) {
        setWarning('Et spørgsmål kan ikke afhænge af sig selv');
        return;
      }

      const sourceOrder = orderIndex(sections, sourceKey, 'question');
      const targetOrder = orderIndex(sections, targetKey, targetKind);
      if (sourceOrder < 0 || targetOrder < 0 || sourceOrder >= targetOrder) {
        setWarning('Kilden skal ligge før målet i evalueringens rækkefølge');
        return;
      }

      const condition = defaultConditionForSource(source);
      onChange(applyConditionToTarget(sections, targetKind, targetKey, condition, 'add'));
      setEdges((eds) => addEdge(connection, eds));
    },
    [allQuestions, onChange, sections, setEdges],
  );

  function removeSelectedEdge() {
    if (!selectedEdge || !selectedCond) return;
    const targetKind = selectedEdge.data?.targetKind as 'section' | 'question';
    const targetKey = selectedEdge.data?.targetKey as string;
    onChange(
      applyConditionToTarget(sections, targetKind, targetKey, selectedCond, 'remove'),
    );
    setSelectedEdgeId(null);
  }

  function updateSelectedCondition(patch: Partial<VisibilityCondition>) {
    if (!selectedEdge || !selectedCond) return;
    const targetKind = selectedEdge.data?.targetKind as 'section' | 'question';
    const targetKey = selectedEdge.data?.targetKey as string;
    const without = applyConditionToTarget(
      sections,
      targetKind,
      targetKey,
      selectedCond,
      'remove',
    );
    const nextCond = { ...selectedCond, ...patch };
    onChange(applyConditionToTarget(without, targetKind, targetKey, nextCond, 'add'));
  }

  return (
    <div className={`branching-editor${fullscreen ? ' is-fullscreen' : ''}`}>
      <div className="branching-toolbar">
        <p className="muted branching-help">
          Træk en kant fra et spørgsmål til en sektion eller et senere spørgsmål
          for at vise målet, når betingelsen er opfyldt. Elementer uden kant er
          altid synlige.
        </p>
        <button
          type="button"
          className="btn ghost"
          onClick={() => setFullscreen((v) => !v)}
          aria-pressed={fullscreen}
        >
          {fullscreen ? 'Luk fuld skærm' : 'Fuld skærm'}
        </button>
      </div>
      {warning ? <div className="error">{warning}</div> : null}

      <div className="branching-layout">
        <div className="branching-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onEdgeClick={(_, edge) => setSelectedEdgeId(edge.id)}
            onPaneClick={() => setSelectedEdgeId(null)}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
            onEdgesDelete={(deleted) => {
              for (const edge of deleted) {
                const cond = edge.data?.condition as VisibilityCondition | undefined;
                const targetKind = edge.data?.targetKind as 'section' | 'question' | undefined;
                const targetKey = edge.data?.targetKey as string | undefined;
                if (cond && targetKind && targetKey) {
                  onChange(
                    applyConditionToTarget(sections, targetKind, targetKey, cond, 'remove'),
                  );
                }
              }
            }}
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        <aside className="branching-sidebar panel">
          <h3>Betingelse</h3>
          {!selectedCond || !selectedSource ? (
            <p className="muted">Vælg en kant for at redigere betingelsen.</p>
          ) : (
            <div className="stack">
              <p>
                <strong>Kilde:</strong> {selectedSource.text || selectedSource.key}
              </p>
              {(selectedSource.type === 'YES_NO' ||
                selectedSource.type === 'SINGLE_CHOICE' ||
                selectedSource.type === 'MULTI_CHOICE') && (
                <>
                  <div className="field">
                    <label>Operator</label>
                    <select
                      value={selectedCond.op}
                      onChange={(e) =>
                        updateSelectedCondition({
                          op: e.target.value as VisibilityOp,
                        })
                      }
                    >
                      {selectedSource.type === 'MULTI_CHOICE' ? (
                        <>
                          <option value="choiceIncludesAny">Inkluderer mindst én</option>
                          <option value="choiceIncludesAll">Inkluderer alle</option>
                          <option value="choiceIn">Én af</option>
                        </>
                      ) : (
                        <>
                          <option value="choiceEquals">Er lig med</option>
                          <option value="choiceIn">Én af</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="field">
                    <label>Svar</label>
                    <select
                      value={selectedCond.choiceIndexes?.[0] ?? 0}
                      onChange={(e) =>
                        updateSelectedCondition({
                          choiceIndexes: [Number(e.target.value)],
                        })
                      }
                    >
                      {(selectedSource.choiceOptions || ['Ja', 'Nej']).map(
                        (opt, i) => (
                          <option key={i} value={i}>
                            {opt || `Mulighed ${i + 1}`}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </>
              )}

              {selectedSource.type === 'SCALE' && (
                <>
                  <div className="field">
                    <label>Operator</label>
                    <select
                      value={selectedCond.op}
                      onChange={(e) =>
                        updateSelectedCondition({
                          op: e.target.value as VisibilityOp,
                        })
                      }
                    >
                      <option value="scaleAnyRowLt">Nogen række &lt;</option>
                      <option value="scaleAnyRowLte">Nogen række ≤</option>
                      <option value="scaleAnyRowGt">Nogen række &gt;</option>
                      <option value="scaleAnyRowGte">Nogen række ≥</option>
                      <option value="scaleLt">&lt;</option>
                      <option value="scaleLte">≤</option>
                      <option value="scaleEq">=</option>
                      <option value="scaleGt">&gt;</option>
                      <option value="scaleGte">≥</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Værdi</label>
                    <input
                      type="number"
                      value={selectedCond.scaleValue ?? 3}
                      onChange={(e) =>
                        updateSelectedCondition({
                          scaleValue: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  {(selectedSource.matrixItems || []).length > 1 ? (
                    <div className="field">
                      <label>Matrix-række (valgfri)</label>
                      <select
                        value={
                          selectedCond.matrixItemIndex === undefined
                            ? ''
                            : String(selectedCond.matrixItemIndex)
                        }
                        onChange={(e) =>
                          updateSelectedCondition({
                            matrixItemIndex:
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                      >
                        <option value="">Alle / nogen (any row)</option>
                        {(selectedSource.matrixItems || []).map((item, i) => (
                          <option key={i} value={i}>
                            {item || `Række ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </>
              )}

              {selectedSource.type === 'TEXT' && (
                <div className="field">
                  <label>Operator</label>
                  <select
                    value={selectedCond.op}
                    onChange={(e) =>
                      updateSelectedCondition({
                        op: e.target.value as VisibilityOp,
                      })
                    }
                  >
                    <option value="answered">Er besvaret</option>
                    <option value="empty">Er tom</option>
                  </select>
                </div>
              )}

              <button
                type="button"
                className="btn danger"
                onClick={removeSelectedEdge}
              >
                Fjern forgrening
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

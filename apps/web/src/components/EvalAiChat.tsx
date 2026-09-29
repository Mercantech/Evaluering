'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  api,
  AiBuilderChatResult,
  SectionInput,
} from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  DraftSection,
  draftsToSectionInputs,
  mapStructureToDraft,
} from '@/lib/draftQuestions';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposal?: { sections: SectionInput[] } | null;
  applied?: boolean;
};

type Props = {
  evaluationId: string;
  sections: DraftSection[];
  onApplyProposal: (sections: DraftSection[]) => void;
};

function newId() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function countQuestions(sections: SectionInput[]) {
  return sections.reduce((n, s) => n + (s.questions?.length || 0), 0);
}

export function EvalAiChat({
  evaluationId,
  sections,
  onApplyProposal,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hej — jeg kan hjælpe dig med at bygge evalueringen. Fortæl hvad du vil spørge om, eller bed mig lave en struktur. Når jeg foreslår ændringer, kan du trykke Anvend.',
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  async function sendMessage(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    const token = getToken();
    if (!token) {
      setError('Du er ikke logget ind');
      return;
    }

    const userMsg: ChatMessage = {
      id: newId(),
      role: 'user',
      content: text,
    };
    const nextHistory = [...messages, userMsg].filter(
      (m) => m.id !== 'welcome',
    );
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    setError('');

    try {
      const result: AiBuilderChatResult = await api.aiBuilderChat(
        token,
        evaluationId,
        {
          messages: nextHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          currentStructure: draftsToSectionInputs(sections),
        },
      );
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: result.reply,
          proposal: result.proposal,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI-chat fejlede');
    } finally {
      setSending(false);
    }
  }

  function applyProposal(messageId: string, proposal: { sections: SectionInput[] }) {
    onApplyProposal(mapStructureToDraft(proposal.sections));
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, applied: true } : m,
      ),
    );
  }

  return (
    <aside className="eval-ai-chat panel stack">
      <div className="eval-ai-chat-header">
        <h2>AI-assistent</h2>
        <p className="muted" style={{ margin: 0 }}>
          Chat om indhold og forgrening. Anvend opdaterer kladden — husk at
          gemme bagefter.
        </p>
      </div>

      <div className="eval-ai-chat-messages" role="log" aria-live="polite">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`eval-ai-bubble ${m.role === 'user' ? 'user' : 'assistant'}`}
          >
            <div className="eval-ai-bubble-text">{m.content}</div>
            {m.role === 'assistant' && m.proposal?.sections?.length ? (
              <div className="eval-ai-proposal">
                <span className="muted">
                  Forslag: {m.proposal.sections.length} sektion
                  {m.proposal.sections.length === 1 ? '' : 'er'},{' '}
                  {countQuestions(m.proposal.sections)} spørgsmål
                </span>
                {m.applied ? (
                  <span className="eval-ai-applied">Anvendt</span>
                ) : (
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => applyProposal(m.id, m.proposal!)}
                  >
                    Anvend
                  </button>
                )}
              </div>
            ) : null}
          </div>
        ))}
        {sending ? (
          <div className="eval-ai-bubble assistant muted">Tænker…</div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? <div className="error">{error}</div> : null}

      <form className="eval-ai-chat-form" onSubmit={sendMessage}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Fx: Lav en evaluering om undervisningen med skala og et frit tekstfelt…"
          rows={3}
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void sendMessage();
            }
          }}
        />
        <button
          className="btn"
          type="submit"
          disabled={sending || !input.trim()}
        >
          {sending ? 'Sender…' : 'Send'}
        </button>
      </form>
    </aside>
  );
}

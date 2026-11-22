import React, { useEffect, useId, useRef, useState } from 'react';
import { MessageCircleQuestion, RefreshCw, Send } from 'lucide-react';
import type { RetrievalCard } from '../../types';
import { AIService } from '../../services/aiService';
import { TUTOR_PROMPTS, askAboutCard, wrongAnswerPrompt, type TutorTurn } from '../../services/cardTutor';
import { MathRenderer } from '../common/MathRenderer';
import { Button } from '../ui/primitives';

const CHIPS: { label: string; prompt: string }[] = [
  { label: 'Explain it simpler', prompt: TUTOR_PROMPTS.simpler },
  { label: 'Give an example', prompt: TUTOR_PROMPTS.example },
  { label: 'Why this answer?', prompt: TUTOR_PROMPTS.why },
  { label: 'Help me remember', prompt: TUTOR_PROMPTS.memory },
];

/** Ask the AI about the card on screen: ready-made questions or your own, as a short chat. */
export const CardTutor: React.FC<{ card: RetrievalCard; wrongPick?: string | null }> = ({ card, wrongPick }) => {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<TutorTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const endRef = useRef<HTMLDivElement>(null);
  const needsSignIn = AIService.needsSignIn();

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [turns, pending]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || pending) return;
    setPending(text);
    setError(null);
    setDraft('');
    try {
      const answer = await askAboutCard(card, turns, text);
      setTurns(prev => [...prev, { question: text, answer }]);
    } catch {
      setError("Couldn't get an answer. Check your connection and try again.");
      setDraft(text);
    } finally {
      setPending(null);
    }
  };

  if (!open) {
    return (
      <Button size="sm" variant="ghost" icon={MessageCircleQuestion} onClick={() => setOpen(true)} className="-ml-2">
        Ask about this card
      </Button>
    );
  }

  const chips = wrongPick ? [{ label: 'Why was my pick wrong?', prompt: wrongAnswerPrompt(wrongPick) }, ...CHIPS] : CHIPS;

  return (
    <section aria-label="Ask about this card" className="space-y-3 rounded-2xl border border-line bg-canvas p-4 animate-fadeIn">
      <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
        <MessageCircleQuestion className="h-4 w-4 text-brand-text" aria-hidden="true" />
        Ask about this card
      </p>

      {needsSignIn ? (
        <p className="text-[13px] text-ink-muted">Sign in (free) to ask the AI, or add your own Gemini key in Settings → AI.</p>
      ) : (
        <>
          {turns.length > 0 && (
            <ol className="space-y-3" aria-live="polite">
              {turns.map((turn, i) => (
                <li key={i} className="space-y-1.5">
                  <p className="text-[13px] font-medium text-ink-muted">{turn.question}</p>
                  <div className="whitespace-pre-line rounded-xl bg-surface-hover px-3.5 py-2.5 text-[14px] leading-relaxed text-ink">
                    <MathRenderer text={turn.answer} />
                  </div>
                </li>
              ))}
            </ol>
          )}
          {pending && (
            <p className="flex items-center gap-2 text-[13px] text-ink-subtle" role="status">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Thinking about "{pending.length > 60 ? `${pending.slice(0, 60)}…` : pending}"
            </p>
          )}
          {error && (
            <p role="alert" className="text-[13px] text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {chips.map(chip => (
              <button
                key={chip.label}
                type="button"
                disabled={!!pending}
                onClick={() => void ask(chip.prompt)}
                className="rounded-full border border-line-strong px-3 py-1 text-xs font-medium text-ink-muted transition-colors hover:border-brand/60 hover:text-ink disabled:opacity-50 cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={e => {
              e.preventDefault();
              void ask(draft);
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              Your question about this card
            </label>
            <input
              id={inputId}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Or ask your own question"
              maxLength={500}
              autoComplete="off"
              className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
            />
            <Button type="submit" variant="secondary" icon={Send} disabled={!draft.trim() || !!pending} aria-label="Ask">
              <span className="hidden sm:inline">Ask</span>
            </Button>
          </form>
        </>
      )}
      <div ref={endRef} />
    </section>
  );
};

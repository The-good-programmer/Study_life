import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Lightbulb, Split } from 'lucide-react';
import type { LeechAnalysis, LeechRootCause, MnemonicRewiringOption, RetrievalCard } from '../../types';
import { FSRSService } from '../../services/fsrsService';
import { StorageService } from '../../services/storageService';
import { estimateReward, grantReward } from '../../services/economy/rewardService';
import { lifeSimService } from '../../services/lifeSimService';
import { AIService } from '../../services/aiService';
import { soundEngine } from '../../services/soundEngine';
import { fillCloze, hasCloze } from '../../utils/cloze';
import { cn } from '../../utils/cn';
import { MathRenderer } from '../common/MathRenderer';
import { Badge, Button, Tokens } from '../ui/primitives';

interface LeechHunterLabProps {
  onBack: () => void;
  onCardCured?: () => void;
}

const ROOT_CAUSES: Record<LeechRootCause, string> = {
  interference: 'Mixed up with a similar card',
  'abstract-disconnect': 'Too abstract to picture',
  'overloaded-card': 'Too much on one card',
  'arbitrary-ordering': 'An order with nothing to hang it on',
};

/** Ids for the cards a hard card is split into. */
const splitIdStamp = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const payFor = (method: 'mnemonic' | 'split') => {
  const { xp, tokens } = estimateReward({ kind: 'leech-cure', method });
  return { xp, tokens: Math.round(tokens * lifeSimService.getActiveMultiplier()) };
};

/** Hard cards: the ones you keep forgetting, with a hook or a split to fix each. */
export const LeechHunterLab: React.FC<LeechHunterLabProps> = ({ onBack, onCardCured }) => {
  const [allCards, setAllCards] = useState<RetrievalCard[]>(() => StorageService.getAllCards());
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<LeechAnalysis | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const leeches = FSRSService.findLeeches(allCards);
  const selectedCard = leeches.find(c => c.id === selectedCardId) || leeches[0] || null;
  const isAnalyzing = !!selectedCard && analysis?.cardId !== selectedCard.id && failedFor !== selectedCard.id;

  useEffect(() => {
    if (!selectedCard) return;
    let isMounted = true;
    AIService.diagnoseAndRewireLeech(selectedCard)
      .then(res => {
        if (isMounted) setAnalysis(res);
      })
      .catch(err => {
        console.error('Hard-card diagnosis failed:', err);
        if (isMounted) setFailedFor(selectedCard.id);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedCard]);

  const finishCure = (message: string) => {
    setAllCards(StorageService.getAllCards());
    soundEngine.playCompletionChime();
    setNotice(message);
    setSelectedCardId(null);
    onCardCured?.();
  };

  const handleApplyHook = (option: MnemonicRewiringOption) => {
    if (!selectedCard) return;
    StorageService.saveCard(FSRSService.rewireCard(selectedCard, `${option.strategyTitle}: ${option.mnemonicText}`));
    const grant = grantReward({ kind: 'leech-cure', method: 'mnemonic' }, { label: 'Fixed a hard card' });
    finishCure(`Hook added. You will see the card again soon, with the hook as its hint.${grant.xp ? ` +${grant.xp} XP.` : ''}`);
  };

  const handleSplit = (option: MnemonicRewiringOption) => {
    if (!selectedCard || !option.atomicCards?.length) return;
    const stamp = splitIdStamp();
    const newCards: RetrievalCard[] = option.atomicCards.map((atomic, index) => {
      const text = atomic.clozeTemplate || atomic.question;
      const isCloze = hasCloze(text);
      return {
        id: `atomic-${stamp}-${index}`,
        conceptId: selectedCard.conceptId,
        cardType: isCloze ? 'cloze' : 'standard',
        question: isCloze ? text : atomic.question,
        answer: atomic.answer,
        clozeTemplate: isCloze ? text : undefined,
        stability: 1,
        difficulty: 5,
        reps: 0,
        lapses: 0,
      };
    });
    // The new cards take the hard card's place in its deck.
    StorageService.replaceCard(selectedCard.id, newCards);
    const grant = grantReward({ kind: 'leech-cure', method: 'split' }, { label: 'Split a hard card' });
    finishCure(`Split into ${newCards.length} simpler cards, now in the same deck.${grant.xp ? ` +${grant.xp} XP.` : ''}`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-fadeIn">
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} className="-ml-2">
        Insights
      </Button>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">Hard cards</h1>
          <p className="mt-1 max-w-2xl text-[15px] text-ink-muted">
            Cards you keep forgetting. Give each one a memory hook, or split it into simpler cards.
          </p>
        </div>
        {leeches.length > 0 && <Badge tone="danger">{leeches.length} to fix</Badge>}
      </header>

      {notice && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-success-soft px-4 py-3 text-[13px] text-success animate-fadeIn" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      {leeches.length === 0 ? (
        <section className="rounded-3xl border border-line bg-surface px-6 py-14 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-success-soft text-success">
            <Check className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-ink">No hard cards right now</h2>
          <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-ink-subtle">
            A card lands here after you forget it three times, or when it stays difficult over several reviews.
          </p>
          <Button className="mt-5" icon={ArrowLeft} onClick={onBack}>
            Back to Insights
          </Button>
        </section>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[320px_1fr]">
          <ul className="space-y-1.5 lg:sticky lg:top-20" aria-label="Hard cards">
            {leeches.map(card => {
              const isSelected = card.id === selectedCard?.id;
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedCardId(card.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      'w-full rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer',
                      isSelected ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-line-strong hover:bg-surface-hover',
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-medium text-danger">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      Forgotten {card.lapses} {card.lapses === 1 ? 'time' : 'times'}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-[13px] font-medium leading-snug text-ink">
                      <MathRenderer text={fillCloze(card.question)} />
                    </span>
                    <span className="mt-1 block truncate text-xs text-ink-subtle">{card.answer}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selectedCard && (
            <section className="space-y-5 rounded-3xl border border-line bg-surface p-5 sm:p-6">
              <div>
                <p className="text-xs text-ink-subtle">
                  Reviewed {selectedCard.reps} {selectedCard.reps === 1 ? 'time' : 'times'} · difficulty {selectedCard.difficulty.toFixed(1)} of 10
                </p>
                <h2 className="mt-1.5 text-lg font-medium leading-relaxed text-ink">
                  <MathRenderer text={fillCloze(selectedCard.question)} />
                </h2>
                <p className="mt-3 rounded-xl bg-success-soft px-3.5 py-2.5 text-[13px] text-ink">
                  <span className="font-medium text-success">Answer: </span>
                  <MathRenderer text={selectedCard.answer} />
                </p>
              </div>

              {isAnalyzing ? (
                <div className="space-y-2" aria-busy="true" aria-label="Looking for a fix">
                  <div className="h-20 animate-pulse rounded-2xl bg-surface-hover" />
                  <div className="h-28 animate-pulse rounded-2xl bg-surface-hover" />
                </div>
              ) : failedFor === selectedCard.id ? (
                <p className="rounded-2xl bg-danger-soft px-4 py-3 text-[13px] text-danger" role="alert">
                  Could not work out a fix just now. Check your connection or AI key in Settings, then pick the card again.
                </p>
              ) : analysis ? (
                <div className="space-y-5 animate-fadeIn">
                  <div className="rounded-2xl border border-gold/30 bg-gold-soft px-4 py-3.5">
                    <p className="text-xs font-medium text-gold">Why it keeps slipping · {ROOT_CAUSES[analysis.rootCause] ?? analysis.rootCause}</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{analysis.diagnosisTitle}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{analysis.diagnosticExplanation}</p>
                  </div>

                  <div>
                    <h3 className="text-[15px] font-semibold text-ink">Ways to fix it</h3>
                    <div className="mt-3 space-y-3">
                      {analysis.rewiringOptions.map(option => (
                        <RemedyCard
                          key={option.id}
                          option={option}
                          onApply={() => (option.strategy === 'atomic-split' ? handleSplit(option) : handleApplyHook(option))}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          )}
        </div>
      )}
    </div>
  );
};

const RemedyCard: React.FC<{ option: MnemonicRewiringOption; onApply: () => void }> = ({ option, onApply }) => {
  const isSplit = option.strategy === 'atomic-split' && !!option.atomicCards?.length;
  const [pay] = useState(() => payFor(isSplit ? 'split' : 'mnemonic'));
  return (
    <article className="rounded-2xl border border-line bg-canvas p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            {isSplit ? <Split className="h-4 w-4 text-brand-text" aria-hidden="true" /> : <Lightbulb className="h-4 w-4 text-gold" aria-hidden="true" />}
            {option.strategyTitle}
          </p>
          {option.badge && <p className="mt-0.5 text-xs text-ink-subtle">{option.badge}</p>}
        </div>
        <div className="flex items-center gap-2">
          {(pay.tokens > 0 || pay.xp > 0) && (
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
              {pay.tokens > 0 && <Tokens amount={pay.tokens} signed />}
              {pay.xp > 0 && <span className="tabular-nums">+{pay.xp} XP</span>}
            </span>
          )}
          <Button size="sm" variant="primary" icon={isSplit ? Split : Check} onClick={onApply}>
            {isSplit ? `Split into ${option.atomicCards!.length} cards` : 'Use this hook'}
          </Button>
        </div>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-ink">{option.mnemonicText}</p>
      {option.visualImagery && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-subtle">Picture it: {option.visualImagery}</p>}

      {isSplit && (
        <ul className="mt-3 space-y-1.5">
          {option.atomicCards!.map((atomic, index) => (
            <li key={index} className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px]">
              <span className="text-ink">{fillCloze(atomic.clozeTemplate || atomic.question)}</span>
              <span className="mt-0.5 block text-xs text-ink-subtle">Answer: {atomic.answer}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
};

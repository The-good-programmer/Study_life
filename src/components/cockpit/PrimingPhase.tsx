import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Brain, GitFork, Lightbulb, PenTool, Zap } from 'lucide-react';
import type { ConceptCheckpoint } from '../../types';
import { grantReward, estimateReward } from '../../services/economy/rewardService';
import { soundEngine } from '../../services/soundEngine';
import { shouldIgnoreShortcut } from '../../utils/keyboard';
import { cn } from '../../utils/cn';
import { MathRenderer } from '../common/MathRenderer';
import { ScienceExplainerModal } from '../common/ScienceExplainerModal';
import { DualCodingWhiteboard } from '../canvas/DualCodingWhiteboard';
import { Button } from '../ui/primitives';
import { ConceptGraph } from './ConceptGraph';

interface PrimingPhaseProps {
  concept: ConceptCheckpoint;
  onComplete: () => void;
  onInspectSource?: (pageNumber?: number, snippet?: string) => void;
  diagnosticMissed?: boolean;
  isCasualMode?: boolean;
}

const VISUAL_MODES = [
  { id: 'map', label: 'Concept map', icon: GitFork },
  { id: 'sketch', label: 'Sketch', icon: PenTool },
] as const;

/** Step 2 of the guided session: the big picture before any testing. */
export const PrimingPhase: React.FC<PrimingPhaseProps> = ({
  concept,
  onComplete,
  onInspectSource,
  diagnosticMissed,
  isCasualMode = false,
}) => {
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [visualMode, setVisualMode] = useState<(typeof VISUAL_MODES)[number]['id']>('map');
  const [showScienceModal, setShowScienceModal] = useState(false);
  const [xp] = useState(() => estimateReward({ kind: 'priming' }).xp);
  const finishedRef = useRef(false);

  const handleFinish = useCallback(() => {
    // A quick double press must not pay twice or skip a step.
    if (finishedRef.current) return;
    finishedRef.current = true;
    grantReward({ kind: 'priming' }, { label: 'Overview' });
    soundEngine.playSocraticChallengeChime();
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || shouldIgnoreShortcut(e)) return;
      e.preventDefault();
      handleFinish();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFinish]);

  const selectedDefinition = concept.keyTerms.find(t => t.term === selectedTerm)?.definition;

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fadeIn">
      {diagnosticMissed && (
        <div className="flex items-start gap-3 rounded-2xl border border-due/30 bg-due-soft px-4 py-3">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-due" aria-hidden="true" />
          <p className="text-[13px] leading-relaxed text-ink-muted">
            <span className="font-medium text-ink">You missed this one in the warm-up.</span> Read the big idea closely. It is what
            the next steps test.
          </p>
        </div>
      )}

      {/* The big idea */}
      <section className="relative overflow-hidden rounded-3xl border border-line-strong bg-surface p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_240px_at_0%_0%,var(--brand-soft),transparent_70%)]"
          aria-hidden="true"
        />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-text">
              <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
              The big idea
            </p>
            <div className="-mr-2 flex items-center gap-0.5">
              {concept.sourceAnchor && onInspectSource && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={BookOpen}
                  onClick={() => onInspectSource(concept.sourceAnchor?.pageNumber, concept.sourceAnchor?.snippet)}
                >
                  Source, p. {concept.sourceAnchor.pageNumber}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                icon={Brain}
                onClick={() => {
                  soundEngine.playCompanionBubble();
                  setShowScienceModal(true);
                }}
              >
                Why this works
              </Button>
            </div>
          </div>
          <p className="mt-3 text-[19px] font-medium leading-relaxed text-ink sm:text-[22px]">
            <MathRenderer text={concept.mentalModel} />
          </p>
        </div>
      </section>

      {/* Key points */}
      {concept.coreTakeaways.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h3 className="text-[15px] font-semibold text-ink">Key points</h3>
          <ol className="mt-3 space-y-3">
            {concept.coreTakeaways.map((takeaway, index) => (
              <li key={index} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-hover text-xs font-semibold tabular-nums text-ink-muted">
                  {index + 1}
                </span>
                <span className="text-[15px] leading-relaxed text-ink-muted">
                  <MathRenderer text={takeaway} />
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Key terms */}
      {concept.keyTerms.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="text-[15px] font-semibold text-ink">Key terms</h3>
            <span className="text-xs text-ink-subtle">Select a term to see what it means</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {concept.keyTerms.map(({ term }) => {
              const isSelected = selectedTerm === term;
              return (
                <button
                  key={term}
                  type="button"
                  onClick={() => setSelectedTerm(isSelected ? null : term)}
                  aria-pressed={isSelected}
                  className={cn(
                    'inline-flex h-8 items-center rounded-lg border px-3 text-[13px] font-medium transition-colors cursor-pointer',
                    isSelected ? 'border-brand bg-brand-soft text-brand-text' : 'border-line-strong text-ink-muted hover:bg-surface-hover hover:text-ink',
                  )}
                >
                  <MathRenderer text={term} />
                </button>
              );
            })}
          </div>
          {selectedTerm && (
            <div className="mt-3 rounded-xl bg-surface-hover px-4 py-3 animate-fadeIn" aria-live="polite">
              <p className="text-sm font-semibold text-ink">
                <MathRenderer text={selectedTerm} />
              </p>
              {selectedDefinition && (
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                  <MathRenderer text={selectedDefinition} />
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Map or sketch */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-ink">See how it fits together</h3>
          <div role="tablist" aria-label="View" className="inline-flex rounded-xl border border-line bg-canvas p-1">
            {VISUAL_MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={visualMode === id}
                onClick={() => setVisualMode(id)}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors cursor-pointer',
                  visualMode === id ? 'bg-surface-hover text-ink shadow-sm' : 'text-ink-subtle hover:text-ink',
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
        {visualMode === 'map' ? <ConceptGraph concept={concept} /> : <DualCodingWhiteboard concept={concept} />}
      </section>

      {/* Next step */}
      <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-center text-xs text-ink-subtle sm:text-left">
          {xp > 0 ? `Earns ${xp} XP. ` : ''}
          <span className="hidden sm:inline">
            Press <kbd className="rounded border border-line bg-surface-hover px-1 font-mono text-[11px]">Enter</kbd> to continue.
          </span>
        </p>
        <Button variant="primary" size="lg" trailingIcon={ArrowRight} onClick={handleFinish}>
          {isCasualMode ? 'Start the flashcards' : 'Next: explain it'}
        </Button>
      </div>

      <ScienceExplainerModal isOpen={showScienceModal} onClose={() => setShowScienceModal(false)} initialTopic="priming" />
    </div>
  );
};

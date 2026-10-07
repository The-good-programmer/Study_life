import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, ArrowRight, Building2, Check, GraduationCap, Repeat, Sparkles, X } from 'lucide-react';
import { soundEngine } from '../../services/soundEngine';
import { cn } from '../../utils/cn';
import { Dialog, DialogFooter, DialogPanel } from '../common/Dialog';
import { BrandMark, Button, CoinIcon, IconButton } from '../ui/primitives';

interface CognitiveTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartQuickSession?: () => void;
}

interface TourStep {
  title: string;
  body: string;
  points: string[];
  visual: React.ReactNode;
}

const Flow: React.FC<{ items: { label: string; icon?: LucideIcon; coin?: boolean }[] }> = ({ items }) => (
  <ol className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2">
    {items.map((item, index) => {
      const Icon = item.icon;
      return (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-line-strong bg-surface-solid px-3 text-[13px] font-medium text-ink">
            {item.coin ? <CoinIcon className="h-4 w-4" /> : Icon && <Icon className="h-4 w-4 text-ink-subtle" aria-hidden="true" />}
            {item.label}
          </span>
          {index < items.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-ink-subtle" aria-hidden="true" />}
        </li>
      );
    })}
  </ol>
);

const STEPS: TourStep[] = [
  {
    title: 'Study anything. Get paid for it.',
    body: 'Studify is a small world that runs on learning. Studying earns tokens, and tokens pay for your life on campus.',
    points: [
      'Reviews earn XP. Sessions, exams and games earn tokens too.',
      'Pay depends on real work, and daily limits keep it fair.',
      'Spend tokens on rent, food and your room.',
    ],
    visual: <Flow items={[{ label: 'Study', icon: GraduationCap }, { label: 'Earn tokens', coin: true }, { label: 'Live on campus', icon: Building2 }]} />,
  },
  {
    title: 'AI builds your decks',
    body: 'Type a topic, paste your notes or upload a PDF. Studify turns it into a deck for your level in about a minute.',
    points: [
      'Cards come with an overview, key terms and an explanation prompt.',
      'Cards made from a PDF link back to the page they came from.',
      'Prefer to start now? Pick a ready-made starter deck.',
    ],
    visual: <Flow items={[{ label: 'Notes or PDF', icon: Sparkles }, { label: 'Your deck', icon: GraduationCap }]} />,
  },
  {
    title: 'A guided session for each concept',
    body: 'Each concept goes through five short steps, so you understand it before you memorise it.',
    points: [
      'Warm-up and Overview: guess first, then see the big picture.',
      'Explain: put it in your own words and get follow-up questions.',
      'Recall and Rest: flashcards from memory, then a short break.',
    ],
    visual: (
      <ol className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2">
        {['Warm-up', 'Overview', 'Explain', 'Recall', 'Rest'].map((label, index, all) => (
          <li key={label} className="flex items-center gap-1">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface-solid px-2.5 text-xs font-medium text-ink">
              <span className="tabular-nums text-ink-subtle">{index + 1}</span>
              {label}
            </span>
            {index < all.length - 1 && <ArrowRight className="h-3 w-3 text-ink-subtle" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    ),
  },
  {
    title: 'Reviews come back at the right time',
    body: 'Studify schedules every card on its own, bringing it back shortly before you would forget it. A few minutes a day keeps it all fresh.',
    points: [
      'Today shows what is due and what it pays.',
      'Rate honestly: Again, Hard, Good or Easy. Pay is the same for each rating.',
      'Insights shows your memory, streak and earnings.',
    ],
    visual: <Flow items={[{ label: 'Learn', icon: GraduationCap }, { label: 'Review when due', icon: Repeat }, { label: 'Remember', icon: Check }]} />,
  },
];

/** The welcome tour for new students: what Studify is and how a day works. */
export const CognitiveTourModal: React.FC<CognitiveTourModalProps> = ({ isOpen, onClose, onStartQuickSession }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  const goTo = (index: number) => {
    soundEngine.playContextShiftSound();
    setCurrentStep(Math.max(0, Math.min(STEPS.length - 1, index)));
  };

  const handleFinish = () => {
    soundEngine.playSuccess();
    onClose();
    onStartQuickSession?.();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId="tour-title" className="max-w-xl">
      <DialogPanel>
        <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandMark size={28} />
            <span className="text-[13px] font-medium text-ink-muted">Welcome to Studify</span>
          </div>
          <IconButton icon={X} label="Close the tour" onClick={onClose} className="-mr-2" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4 sm:px-6">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-canvas px-4 py-8">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(420px_180px_at_50%_0%,var(--brand-soft),transparent_75%)]"
              aria-hidden="true"
            />
            <div className="relative" key={currentStep}>
              <div className="animate-fadeIn">{step.visual}</div>
            </div>
          </div>

          <div className="mt-6 animate-fadeIn" key={`text-${currentStep}`}>
            <p className="text-xs font-medium tabular-nums text-brand-text">
              {currentStep + 1} of {STEPS.length}
            </p>
            <h2 id="tour-title" className="mt-1 text-xl font-semibold leading-snug text-ink">
              {step.title}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{step.body}</p>
            <ul className="mt-4 space-y-2">
              {step.points.map(point => (
                <li key={point} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-muted">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="justify-between">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Tour steps">
            {STEPS.map((s, index) => (
              <button
                key={s.title}
                type="button"
                role="tab"
                aria-selected={index === currentStep}
                aria-label={`Step ${index + 1}: ${s.title}`}
                onClick={() => goTo(index)}
                className={cn(
                  'h-1.5 rounded-full transition-[width,background-color] cursor-pointer',
                  index === currentStep ? 'w-6 bg-brand' : 'w-1.5 bg-line-strong hover:bg-ink-subtle',
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {currentStep > 0 ? (
              <Button variant="ghost" icon={ArrowLeft} onClick={() => goTo(currentStep - 1)}>
                Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={onClose}>
                Skip
              </Button>
            )}
            {isLast ? (
              <Button variant="primary" trailingIcon={ArrowRight} onClick={handleFinish} data-autofocus>
                {onStartQuickSession ? 'Pick a starter deck' : 'Get started'}
              </Button>
            ) : (
              <Button variant="primary" trailingIcon={ArrowRight} onClick={() => goTo(currentStep + 1)} data-autofocus>
                Next
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};

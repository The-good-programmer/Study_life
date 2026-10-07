import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Brain, Check, GitFork, Layers, Lightbulb, MessageSquare, Volume2, X, Zap } from 'lucide-react';
import { soundEngine } from '../../services/soundEngine';
import { cn } from '../../utils/cn';
import { Button, IconButton } from '../ui/primitives';
import { Dialog, DialogFooter, DialogPanel } from './Dialog';

export type ScienceTopicId = 'retrieval' | 'fsrs' | 'feynman' | 'interleaving' | 'priming' | 'audio';

interface ScienceTopic {
  id: ScienceTopicId;
  tab: string;
  title: string;
  icon: LucideIcon;
  lead: string;
  lessEffective: { label: string; text: string };
  studify: { label: string; text: string };
  points: string[];
  tip: string;
  sources: string;
}

/* Plain-language summaries of the research. Kept modest on purpose: no claims beyond what the studies show. */
const TOPICS: ScienceTopic[] = [
  {
    id: 'retrieval',
    tab: 'Recall',
    title: 'Recalling beats re-reading',
    icon: Zap,
    lead: 'Pulling an answer out of memory strengthens it much more than reading it again. Re-reading feels productive because the page looks familiar, but recognising something is not the same as being able to recall it.',
    lessEffective: {
      label: 'Re-reading and highlighting',
      text: 'The page feels familiar, so it seems learned, yet it does little to help you recall it on a test.',
    },
    studify: {
      label: 'Recall first, then check',
      text: 'Every card asks you to produce the answer before you see it. That effort is what makes it stick.',
    },
    points: [
      'Give yourself a few seconds to try before you reveal the answer.',
      'A failed attempt still helps: you remember the right answer better after trying.',
      'In classroom and lab studies, practice testing beats re-reading for long-term retention.',
    ],
    tip: 'Say or think your answer before you reveal the card.',
    sources: 'Roediger & Karpicke (2006), Psychological Science; Dunlosky et al. (2013), Psychological Science in the Public Interest',
  },
  {
    id: 'fsrs',
    tab: 'Spacing',
    title: 'Reviews at the right time',
    icon: Brain,
    lead: 'Spreading reviews out works better than cramming. Studify uses FSRS, a modern scheduler that estimates how likely you are to remember each card and brings it back shortly before you would forget it.',
    lessEffective: {
      label: 'Cramming or fixed timetables',
      text: 'Reviewing everything at once, or on the same schedule for every card, wastes time on what you know and lets the rest slip.',
    },
    studify: {
      label: 'A schedule for each card',
      text: 'Each card keeps its own memory strength and difficulty, updated every time you rate it.',
    },
    points: [
      'Cards you find easy come back less often. Hard ones come back sooner.',
      'Pressing Again is not a failure. It tells the scheduler to bring the card back soon.',
      'In public benchmarks FSRS predicts forgetting more accurately than the older SM-2 method, so the same recall takes fewer reviews.',
    ],
    tip: 'Rate honestly: Hard if you hesitated, Easy only if it came instantly.',
    sources: 'Cepeda et al. (2006), Psychological Bulletin; Ye et al., FSRS (open-spaced-repetition)',
  },
  {
    id: 'feynman',
    tab: 'Explaining',
    title: 'Explaining shows what you really know',
    icon: MessageSquare,
    lead: 'Putting an idea into your own words exposes gaps that recognising a definition hides. A quick sketch gives you a second, visual way to remember it.',
    lessEffective: {
      label: 'Repeating the textbook wording',
      text: 'Memorised phrases can sound right while the idea behind them is missing, so new questions catch you out.',
    },
    studify: {
      label: 'Explain, then answer follow-ups',
      text: 'You explain in plain words and follow-up questions look for the step you skipped. The sketch board lets you draw it too.',
    },
    points: [
      'If you use a technical word, explain it as well.',
      'A good comparison makes an abstract idea easier to recall.',
      'Where your explanation gets vague is exactly what to study next.',
    ],
    tip: 'Explain it as if to a friend who is new to the topic.',
    sources: 'Chi et al. (1994), Cognitive Science; Paivio (1971), Imagery and Verbal Processes',
  },
  {
    id: 'interleaving',
    tab: 'Mixing',
    title: 'Mixing topics prepares you for exams',
    icon: GitFork,
    lead: 'Practising one topic at a time feels smooth, but exams mix topics. Mixed practice makes you work out which idea applies, which is the skill an exam tests.',
    lessEffective: {
      label: 'One topic at a time',
      text: 'Many questions of the same kind in a row let you run on autopilot without learning when to use which method.',
    },
    studify: {
      label: 'Mixed practice',
      text: 'Mix decks, and mixing during recall, bring in cards from other concepts so you have to choose the right idea first.',
    },
    points: [
      'Mixing feels harder at the time. That extra effort is part of why it works.',
      'It helps most with topics that are easy to confuse with each other.',
      'Practice scores may dip a little while scores on later tests go up.',
    ],
    tip: 'Keep mixing on during recall to stay exam-ready.',
    sources: 'Rohrer & Taylor (2007), Instructional Science; Bjork & Bjork (2011), desirable difficulties',
  },
  {
    id: 'priming',
    tab: 'Overview',
    title: 'See the big picture first',
    icon: Layers,
    lead: 'Working memory holds only a few new things at once. A short overview of the main idea and key terms gives new details somewhere to fit.',
    lessEffective: {
      label: 'Diving straight into details',
      text: 'Many unfamiliar terms at once overload working memory, so less of it is stored.',
    },
    studify: {
      label: 'Overview, then practice',
      text: 'Each concept starts with the big idea, the key points and terms, and a map of how they connect.',
    },
    points: [
      'A minute on the overview makes the explanation and the flashcards easier.',
      'Knowing the key terms first means fewer surprises later.',
      'The concept map shows how the parts relate before you memorise them.',
    ],
    tip: 'Read the big idea and the key terms before you start the flashcards.',
    sources: 'Sweller (1988), Cognitive Science; Ausubel (1960), Journal of Educational Psychology',
  },
  {
    id: 'audio',
    tab: 'Focus sound',
    title: 'Background sound for focus',
    icon: Volume2,
    lead: 'Steady background sound can mask sudden noises and nearby speech that pull your attention away. It is a comfort tool, not a memory booster: evidence for tone-based "brainwave" effects is mixed.',
    lessEffective: {
      label: 'Lyrics or nearby conversation',
      text: 'Speech, including song lyrics, competes for the verbal memory you use while reading (the irrelevant speech effect).',
    },
    studify: {
      label: 'Steady noise or a constant tone',
      text: 'Masks sudden sounds without adding words to process. Use whichever you find least distracting, or silence if that works for you.',
    },
    points: [
      'Lyrics and nearby speech are the most disruptive background sounds for reading and recall.',
      'Brown, pink or rain noise can mask distracting conversation in a noisy room.',
      'Claims that 40 Hz tones or binaural beats improve memory are not well established. Use them only if you like how they feel.',
    ],
    tip: 'In a noisy place, try brown noise or rain at a low volume. In a quiet room, silence is fine.',
    sources: 'Banbury et al. (2001), Human Factors; Sörqvist (2010), Memory & Cognition',
  },
];

interface ScienceExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: ScienceTopicId;
}

export const ScienceExplainerModal: React.FC<ScienceExplainerModalProps> = ({ isOpen, onClose, initialTopic = 'retrieval' }) => {
  const [selectedTopicId, setSelectedTopicId] = useState<ScienceTopicId>(initialTopic);

  if (!isOpen) return null;

  const topic = TOPICS.find(t => t.id === selectedTopicId) || TOPICS[0];
  const TopicIcon = topic.icon;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId="science-explainer-title" className="max-w-3xl">
      <DialogPanel className="h-[min(720px,92dvh)]">
        <div className="shrink-0 border-b border-line px-5 pt-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 id="science-explainer-title" className="text-[17px] font-semibold text-ink">
                Why this works
              </h2>
              <p className="mt-1 text-[13px] text-ink-subtle">The research behind each part of Studify, in plain words.</p>
            </div>
            <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2 -mt-1.5" />
          </div>
          <div role="tablist" aria-label="Topics" className="-mb-px mt-4 flex gap-5 overflow-x-auto no-scrollbar">
            {TOPICS.map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === topic.id}
                onClick={() => {
                  soundEngine.playCompanionBubble();
                  setSelectedTopicId(t.id);
                }}
                className={cn(
                  'shrink-0 border-b-2 pb-2.5 text-[13px] font-medium transition-colors cursor-pointer',
                  t.id === topic.id ? 'border-ink text-ink' : 'border-transparent text-ink-subtle hover:text-ink',
                )}
              >
                {t.tab}
              </button>
            ))}
          </div>
        </div>

        <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
              <TopicIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="pt-1.5 text-xl font-semibold leading-snug text-ink">{topic.title}</h3>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">{topic.lead}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-medium text-ink-subtle">Less effective</p>
              <p className="mt-1 text-sm font-semibold text-ink">{topic.lessEffective.label}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{topic.lessEffective.text}</p>
            </div>
            <div className="rounded-2xl border border-success/30 bg-success-soft p-4">
              <p className="text-xs font-medium text-success">What Studify does</p>
              <p className="mt-1 text-sm font-semibold text-ink">{topic.studify.label}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{topic.studify.text}</p>
            </div>
          </div>

          <ul className="mt-6 space-y-2.5">
            {topic.points.map(point => (
              <li key={point} className="flex gap-2.5 text-[15px] leading-relaxed text-ink-muted">
                <Check className="mt-1 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>

          <p className="mt-6 flex items-start gap-2.5 rounded-2xl bg-gold-soft px-4 py-3 text-[13px] leading-relaxed text-ink">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
            <span>
              <span className="font-semibold">Try this: </span>
              {topic.tip}
            </span>
          </p>

          <p className="mt-6 text-xs leading-relaxed text-ink-subtle">Sources: {topic.sources}</p>
        </div>

        <DialogFooter className="justify-end">
          <Button variant="primary" onClick={onClose}>
            Got it
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};

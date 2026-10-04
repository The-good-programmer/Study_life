import React, { useState } from 'react';
import { 
  X, 
  Brain, 
  Zap, 
  Layers, 
  GitFork, 
  MessageSquare, 
  Sparkles, 
  CheckCircle2, 
  ExternalLink,
  BookOpen,
  Volume2
} from 'lucide-react';
import { soundEngine } from '../../services/soundEngine';
import { Dialog } from './Dialog';

export type ScienceTopicId = 'retrieval' | 'fsrs' | 'feynman' | 'interleaving' | 'priming' | 'audio';

interface ScienceTopic {
  id: ScienceTopicId;
  title: string;
  badge: string;
  icon: React.ElementType;
  color: string;
  lead: string;
  paperCitation: string;
  comparison: {
    flawed: {
      label: string;
      description: string;
    };
    science: {
      label: string;
      description: string;
    };
  };
  keyTakeaways: string[];
  protocolTip: string;
}

const TOPICS: ScienceTopic[] = [
  {
    id: 'retrieval',
    title: 'Active Retrieval Practice',
    badge: 'Evidence-Based Recall',
    icon: Zap,
    color: 'from-amber-500 to-orange-500',
    lead: 'Pulling an answer out of your memory directly strengthens synaptic pathways. Re-reading creates an illusion of competence.',
    paperCitation: 'Roediger & Karpicke (2006), "Test-Enhanced Learning in the Classroom", Psychological Science',
    comparison: {
      flawed: {
        label: 'Passive Re-reading & Highlighting',
        description: 'Brain recognizes familiar shapes on the page, tricking you into feeling prepared while neurons remain passive.'
      },
      science: {
        label: 'Active Cold Recall (Lotti)',
        description: 'Reconstructing the memory from scratch without looking triggers long-term potentiation and structural dendrite growth.'
      }
    },
    keyTakeaways: [
      'Struggling to remember for 5-10 seconds before flipping the card is where real learning happens.',
      'Even unsuccessful retrieval attempts prime the brain to encode the correct answer when revealed.',
      'Active recall cuts total hours needed to ace an exam by more than half compared to notes re-reading.'
    ],
    protocolTip: 'Always formulate your answer internally or out loud BEFORE clicking Reveal.'
  },
  {
    id: 'fsrs',
    title: 'FSRS Modern Spaced Repetition',
    badge: 'Free Spaced Repetition Scheduler',
    icon: Brain,
    color: 'from-indigo-500 to-cyan-500',
    lead: 'Legacy SM-2 algorithms from 1987 treat memory as simple intervals. FSRS models retrievability and memory stability independently with empirical precision.',
    paperCitation: 'Ye et al. (2022-2024), "Free Spaced Repetition Scheduler (FSRS-4.5) Research & Validation"',
    comparison: {
      flawed: {
        label: 'Fixed Interval Schedules (SM-2)',
        description: 'Exponential multiplier multiplies blindly, leading to review pileups or premature forgetting.'
      },
      science: {
        label: 'FSRS State Space Model',
        description: 'Tracks Stability (days until 90% recall probability) and Difficulty (0-10 intrinsic concept resistance).'
      }
    },
    keyTakeaways: [
      'Reviews are scheduled at the moment of optimal forgetting — right before the memory decays below target retrievability.',
      'Rating "Again" does not ruin your progress; it recalibrates stability to guarantee mastery.',
      'Achieves 90%+ long-term retention with 30-40% fewer total lifetime reviews than Anki SM-2.'
    ],
    protocolTip: 'Be strictly honest with your ratings: use "Hard" if you hesitated, and "Easy" only for effortless recall.'
  },
  {
    id: 'feynman',
    title: 'The Feynman Technique & Dual Coding',
    badge: 'Elaborative Rehearsal',
    icon: MessageSquare,
    color: 'from-purple-500 to-pink-500',
    lead: 'If you cannot explain a concept in simple, jargon-free words to a child, you have memorized nomenclature without genuine understanding.',
    paperCitation: 'Paivio (1971), "Dual Coding Theory"; Craik & Lockhart (1972), "Levels of Processing Framework"',
    comparison: {
      flawed: {
        label: 'Jargon Parroting',
        description: 'Regurgitating textbook definitions word-for-word creates fragile memory schemas that shatter under novel exam questions.'
      },
      science: {
        label: 'Socratic Defense + Whiteboard',
        description: 'Simultaneously engaging verbal processing (audio voice / simple text) and non-verbal spatial processing (whiteboard / diagrams) yields two distinct memory traces.'
      }
    },
    keyTakeaways: [
      'Explaining forces your brain to identify precise blind spots (jargon masks lack of comprehension).',
      'Using visual analogies links abstract formulas to concrete sensory experiences.',
      'Preparing to teach someone else activates higher-order metacognition and diagnostic clarity.'
    ],
    protocolTip: 'Use analogies! Instead of "Mitochondria produces ATP", explain it like a miniature power station combusting glucose fuel.'
  },
  {
    id: 'interleaving',
    title: 'Interleaving & Desirable Difficulties',
    badge: 'Pattern Discrimination',
    icon: GitFork,
    color: 'from-emerald-500 to-teal-500',
    lead: 'Mixing different topics together feels harder and messier in the moment, but dramatically accelerates pattern recognition and transfer to real exams.',
    paperCitation: 'Bjork & Bjork (1994), "A New Theory of Desirable Difficulties"; Rohrer & Taylor (2007)',
    comparison: {
      flawed: {
        label: 'Blocked Practice (AAAA, BBBB)',
        description: 'Doing 20 cards of the same topic creates a rhythmic autopilot where you never learn when to apply which formula.'
      },
      science: {
        label: 'Interleaved Practice (Lotti)',
        description: 'Lotti injects cards from earlier concepts, forcing your brain to first diagnose *which* tool is needed before solving.'
      }
    },
    keyTakeaways: [
      'Real exam questions do not arrive in textbook chapter order; interleaving trains real test conditions.',
      'The initial sensation of difficulty ("Wait, which chapter was this?") is the biological signal of deep neuroplasticity.',
      'Prevents cognitive exhaustion by alternating mental gears between disparate concept modalities.'
    ],
    protocolTip: 'Leave In-Flight Interleaving toggled ON to keep your recall agile and exam-proof.'
  },
  {
    id: 'priming',
    title: 'Cognitive Load & Schema Priming',
    badge: 'Pre-Encoding Framework',
    icon: Layers,
    color: 'from-blue-500 to-indigo-600',
    lead: 'Working memory can only hold 4-7 chunks of new information. Priming terminology and relations builds a scaffold before deep reading.',
    paperCitation: 'Sweller (1988), "Cognitive Load Theory"; Meyer & Schvaneveldt (1971), "Facilitation in Recognizing Pairs of Words"',
    comparison: {
      flawed: {
        label: 'Cold Deep Reading',
        description: 'Jumping straight into 20 dense pages overwhelms working memory with unfamiliar terms, causing attention drift.'
      },
      science: {
        label: 'Concept Priming & Graphing',
        description: 'Previewing core vocabulary and node connections activates semantic networks, so new text anchors instantly into long-term schemas.'
      }
    },
    keyTakeaways: [
      '2 minutes of priming reduces cognitive friction during subsequent retrieval and explanation phases.',
      'Visual knowledge graphs map the architecture of ideas before details fill the rooms.',
      'Creates anticipatory curiosity, significantly boosting dopamine release during answer validation.'
    ],
    protocolTip: 'Spend 60 seconds reviewing the key terms and knowledge graph before launching straight into flashcards.'
  },
  {
    id: 'audio',
    title: '40Hz Gamma & Focus Soundscapes',
    badge: 'Acoustic Focus Masking',
    icon: Volume2,
    color: 'from-cyan-500 to-blue-500',
    lead: 'Steady acoustic textures and auditory beat frequencies provide consistent acoustic masking, minimizing auditory distractibility.',
    paperCitation: 'Herrmann (2001), "Human EEG Responses to 1-100 Hz Flutter Stimuli"; Sörqvist et al. (2012)',
    comparison: {
      flawed: {
        label: 'Silence or Pop Songs with Lyrics',
        description: 'Silence leaves room for task-unrelated thoughts; lyrics hijack the phonological loop needed for reading.'
      },
      science: {
        label: '40Hz Gamma Beat + Brown Noise',
        description: 'Auditory beat frequencies provide steady acoustic texture; brown noise blankets sudden ambient acoustic spikes.'
      }
    },
    keyTakeaways: [
      'Use headphones for true binaural stereo channel separation (Left: 200Hz, Right: 240Hz = 40Hz beat).',
      'Auditory beat soundscapes provide predictable acoustic rhythms without linguistic distraction.',
      'Brown and pink noise utilize stochastic acoustic smoothing to blanket distracting environmental sounds.'
    ],
    protocolTip: 'Turn on 40Hz Gamma Binaural Beats in the top audio bar whenever you enter a high-stakes focus session.'
  }
];

interface ScienceExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: ScienceTopicId;
}

export const ScienceExplainerModal: React.FC<ScienceExplainerModalProps> = ({
  isOpen,
  onClose,
  initialTopic = 'retrieval'
}) => {
  const [selectedTopicId, setSelectedTopicId] = useState<ScienceTopicId>(initialTopic);

  if (!isOpen) return null;

  const currentTopic = TOPICS.find(t => t.id === selectedTopicId) || TOPICS[0];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      titleId="science-explainer-title"
      className="max-w-4xl"
    >
      <div 
        className="relative w-full bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          boxShadow: '0 25px 60px -15px rgba(99, 102, 241, 0.25)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-slate-950/60 backdrop-blur-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 flex items-center justify-center shadow-md">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Brain className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="science-explainer-title" className="text-lg font-bold text-white font-display">The Cognitive Science of Lotti</h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Empirical Foundations
                </span>
              </div>
              <p className="text-xs text-slate-400">Why each element of your study cockpit is engineered to maximize retention.</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => {
              soundEngine.playAxolotlBubble();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
            aria-label="Close science explainer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Topic Selector Bar */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-white/[0.06] bg-slate-900/50 overflow-x-auto no-scrollbar">
          {TOPICS.map((topic) => {
            const Icon = topic.icon;
            const isSelected = topic.id === selectedTopicId;
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => {
                  soundEngine.playAxolotlBubble();
                  setSelectedTopicId(topic.id);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/50 scale-105'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-white/[0.05]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{topic.title}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {/* Hero Banner for Selected Topic */}
          <div className="relative p-5 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900/80 to-purple-950/40 border border-indigo-500/30 overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  {currentTopic.badge}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-indigo-400" />
                  Peer-Reviewed Foundation
                </span>
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white font-display mb-2">
              {currentTopic.title}
            </h3>
            <p className="text-sm sm:text-base text-indigo-200/90 leading-relaxed">
              {currentTopic.lead}
            </p>
            <div className="mt-3 pt-3 border-t border-white/[0.08] flex items-center gap-2 text-[11px] text-slate-400 italic">
              <ExternalLink className="w-3 h-3 shrink-0 text-indigo-400" />
              <span>{currentTopic.paperCitation}</span>
            </div>
          </div>

          {/* Flawed vs. Science Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/20 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Standard Intuition ({currentTopic.comparison.flawed.label})</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {currentTopic.comparison.flawed.description}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>The Lotti Method ({currentTopic.comparison.science.label})</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {currentTopic.comparison.science.description}
              </p>
            </div>
          </div>

          {/* Key Empirical Takeaways */}
          <div className="p-4 rounded-2xl bg-slate-800/40 border border-white/[0.06] space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Evidence-Based Rules for Your Study Session</span>
            </h4>
            <div className="space-y-2">
              {currentTopic.keyTakeaways.map((takeaway, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>{takeaway}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Practical Protocol Tip */}
          <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-center justify-between gap-3 text-xs text-indigo-200">
            <div className="flex items-center gap-2">
              <span className="font-bold text-indigo-300">Pro-Tip for Today:</span>
              <span>{currentTopic.protocolTip}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.08] bg-slate-950/70 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Engineered around cognitive neuroscience principles.
          </span>
          <button
            type="button"
            onClick={() => {
              soundEngine.playSuccess();
              onClose();
            }}
            className="btn-tactile btn-tactile-primary px-5 py-2 text-xs font-bold cursor-pointer"
          >
            Got It, Let's Study!
          </button>
        </div>
      </div>
    </Dialog>
  );
};

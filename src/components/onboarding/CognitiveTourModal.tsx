import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  X, 
  ArrowRight, 
  ArrowLeft, 
  Brain, 
  Sparkles, 
  MessageSquare, 
  Layers, 
  Coffee, 
  CheckCircle2 
} from 'lucide-react';
import { soundEngine } from '../../services/soundEngine';

interface CognitiveTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartQuickSession?: () => void;
}

interface TourStep {
  phase: string;
  scienceTitle: string;
  citations: string;
  badge: string;
  badgeColor: string;
  lottieQuote: string;
  description: string;
  highlights: string[];
  icon: React.ElementType;
}

const TOUR_STEPS: TourStep[] = [
  {
    phase: "Phase 1",
    scienceTitle: "Priming & Dual-Coding Architecture",
    citations: "Sweller (Cognitive Load Theory) • Paivio (Dual Coding)",
    badge: "Active Priming",
    badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    lottieQuote: "Never read cold text! We prime your working memory with concept graphs and core anchors first so new facts click into place effortlessly.",
    description: "Before diving into complex paragraphs, AXON synthesizes an intuitive mental graph, 3 high-yield takeaways, and interactive terminology chips to drastically reduce cognitive load.",
    highlights: [
      "Visual concept relationship graph",
      "Key terminology chips with instant definitions",
      "Immediate working memory pre-activation"
    ],
    icon: Brain
  },
  {
    phase: "Phase 2",
    scienceTitle: "Socratic Feynman Oral Defense",
    citations: "Dunlosky et al. (2013) • Richard Feynman",
    badge: "Elaborative Interrogation",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    lottieQuote: "If you can't explain it simply to an aquatic salamander, you don't own it yet! No jargon crutches allowed—let's test your real understanding.",
    description: "Forces active generation. You explain the concept in your own voice or text. Lottie acts as your Socratic Examiner, evaluating causality, catching logical gaps, and pushing for simplicity.",
    highlights: [
      "Live Socratic examiner AI (Lottie)",
      "Speech-to-text oral defense with real-time feedback",
      "Nuance and misconception detection"
    ],
    icon: MessageSquare
  },
  {
    phase: "Phase 3",
    scienceTitle: "Active Retrieval & FSRS Spaced Schedule",
    citations: "Roediger & Karpicke (Testing Effect) • SuperMemo FSRS",
    badge: "Memory Stabilization",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    lottieQuote: "Re-reading notes gives a counterfeit feeling of knowing. Real learning is the struggle to pull memories out of the void. And yes, you can do it with a Nintendo Switch Joy-Con!",
    description: "Interactive flashcards force active memory retrieval. Four-tier effort ratings feed directly into the modern Free Spaced Repetition Scheduler (FSRS) algorithm to defy the Ebbinghaus forgetting curve.",
    highlights: [
      "FSRS spaced repetition with leech auto-detection",
      "Bluetooth Gamepad support (8BitDo, Joy-Cons, Xbox)",
      "Image Occlusion Studio for anatomical/technical diagrams"
    ],
    icon: Layers
  },
  {
    phase: "Phase 4",
    scienceTitle: "Neuroscience Micro-Rest & Ultradian Reset",
    citations: "Kleitman (Ultradian Rhythms) • Huberman / Stanford Neuroscience",
    badge: "Memory Consolidation",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    lottieQuote: "Your brain doesn't store memories while you're grinding—it locks them in during offline rest! 3 minutes of box breathing triggers 10x hippocampal replay.",
    description: "Long-term potentiation requires neural recovery. AXON orchestrates a guided 3-minute rest with an animated 4-4-4-4 Box Breathing visualizer, 20-20-20 eye strain relaxation, and 40Hz soundscape resets.",
    highlights: [
      "Dynamic 4-4-4-4 Box Breathing visualizer",
      "Hippocampal memory consolidation protocol",
      "Synthesized 40Hz Gamma wave cortical entrainment"
    ],
    icon: Coffee
  }
];

export const CognitiveTourModal: React.FC<CognitiveTourModalProps> = ({
  isOpen,
  onClose,
  onStartQuickSession
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      try {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 }
        });
        soundEngine.playSuccess();
      } catch {
        // Fallback
      }
      onClose();
      if (onStartQuickSession) onStartQuickSession();
    } else {
      soundEngine.playContextShiftSound();
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    soundEngine.playContextShiftSound();
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="max-w-2xl w-full rounded-3xl bg-[#0b0f19] border border-white/[0.12] shadow-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
        
        {/* Ambient Glows */}
        <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-pink-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-48 h-48 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-xl overflow-hidden p-0.5 bg-gradient-to-tr from-pink-500 to-cyan-400">
              <img src="/lottie.png" alt="Lottie" className="w-full h-full object-cover rounded-[10px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-white font-display">AXON Architecture</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                  Step {currentStep + 1} of 4
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Science-Backed Automated Study Pilot</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicators */}
        <div className="grid grid-cols-4 gap-2 relative z-10">
          {TOUR_STEPS.map((s, idx) => (
            <button
              key={s.phase}
              onClick={() => setCurrentStep(idx)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                idx === currentStep
                  ? 'bg-gradient-to-r from-pink-500 to-cyan-400 shadow-sm shadow-cyan-400/50'
                  : idx < currentStep
                  ? 'bg-cyan-500/40'
                  : 'bg-white/[0.1]'
              }`}
              title={s.scienceTitle}
            />
          ))}
        </div>

        {/* Main Content Stage */}
        <div className="space-y-4 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${step.badgeColor}`}>
                {step.phase}: {step.badge}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight font-display mt-1.5">
                {step.scienceTitle}
              </h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400 sm:text-right max-w-xs">
              {step.citations}
            </span>
          </div>

          {/* Lottie Dialogue Card */}
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-gradient-to-r from-pink-500/10 via-purple-500/5 to-cyan-500/10 border border-pink-500/25">
            <div className="relative w-12 h-12 rounded-2xl overflow-hidden p-0.5 bg-gradient-to-tr from-pink-500 to-cyan-400 shrink-0 shadow-md">
              <img src="/lottie.png" alt="Lottie" className="w-full h-full object-cover rounded-[14px]" />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-pink-300 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-pink-400" />
                <span>Lottie's Neuro Insight</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                "{step.lottieQuote}"
              </p>
            </div>
          </div>

          {/* Detailed Mechanics & Highlights */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/[0.08] space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              {step.description}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-white/[0.06]">
              {step.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.08] relative z-10">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="px-4 py-2.5 rounded-xl border border-white/[0.1] text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 hover:from-pink-400 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-pink-500/25 flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
            >
              <span>{isLast ? "Launch AXON Session" : "Next Phase"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

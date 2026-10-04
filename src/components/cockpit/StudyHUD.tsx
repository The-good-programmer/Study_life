import React, { useState, useMemo } from 'react';
import { 
  Flame, 
  Gamepad2, 
  Keyboard, 
  X,
  Zap
} from 'lucide-react';
import type { FSRSRating } from '../../types';

interface StudyHUDProps {
  currentIndex: number;
  totalCards: number;
  lastRating: FSRSRating | null;
  combo: number;
  isAnswerRevealed: boolean;
  gamepadConnected: boolean;
  gamepadName?: string | null;
  onOpenShortcuts?: () => void;
}

export const StudyHUD: React.FC<StudyHUDProps> = ({
  currentIndex,
  totalCards,
  lastRating,
  combo,
  isAnswerRevealed,
  gamepadConnected,
  gamepadName,
  onOpenShortcuts,
}) => {
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Dynamic status derived based on retrieval progress
  const pedagogicalStatus = useMemo(() => {
    if (combo >= 4) {
      return `⚡ ${combo}x streak — synaptic recall in high-speed flow state!`;
    } else if (combo === 3) {
      return "🔥 3 consecutive successful retrievals — strong memory traces forming.";
    } else if (lastRating === 'again') {
      return "Effortful error recovery triggers deeper memory consolidation.";
    } else if (lastRating === 'hard') {
      return "Desirable difficulty engaged — neural pathways reinforced.";
    } else if (lastRating === 'easy') {
      return "Rapid retrieval — FSRS interval will expand substantially.";
    } else if (isAnswerRevealed) {
      return "Rate your retrieval effort honestly to calibrate FSRS spacing.";
    } else {
      return "Retrieve from memory before revealing the answer.";
    }
  }, [combo, lastRating, isAnswerRevealed]);

  return (
    <>
      {/* Top Cockpit Mini-HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-indigo-950/40 to-slate-900/90 border border-white/[0.08] backdrop-blur-xl shadow-lg">
        
        {/* Left: Pedagogical Status & Combo Counter */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            {combo >= 2 ? (
              <Flame className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
            ) : (
              <Zap className="w-4 h-4 text-indigo-400" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold">
              <span className="text-indigo-300 font-display uppercase tracking-wider font-mono">Cognitive Cockpit</span>
              {combo >= 2 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[11px] flex items-center gap-0.5">
                  <Flame className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  {combo}x Flow
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 truncate font-medium max-w-md">
              {pedagogicalStatus}
            </p>
          </div>
        </div>

        {/* Right: Quick Controls (Hardware / Controller & Card Index) */}
        <div className="flex items-center gap-2 shrink-0">
          {gamepadConnected ? (
            <button 
              type="button"
              onClick={() => onOpenShortcuts ? onOpenShortcuts() : setShowShortcutsModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-sm transition-all cursor-pointer"
              title={`Connected Gamepad: ${gamepadName || 'Controller'}. Click to view mappings.`}
            >
              <Gamepad2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="hidden sm:inline text-[11px] font-mono">Controller</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenShortcuts ? onOpenShortcuts() : setShowShortcutsModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
              title="Keyboard & Controller Shortcuts"
            >
              <Keyboard className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline text-[11px]">Shortcuts [?]</span>
            </button>
          )}

          {/* Card index counter */}
          <div className="px-2.5 py-1 rounded-xl bg-slate-950/80 border border-white/[0.06] text-[11px] font-mono text-slate-300">
            <span className="font-bold text-white">{currentIndex + 1}</span>
            <span className="text-slate-500">/{totalCards}</span>
          </div>
        </div>

      </div>

      {/* Keyboard & Controller Quick Cheat Sheet Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="max-w-md w-full rounded-3xl bg-[#0b0f19] border border-white/[0.12] shadow-2xl p-6 space-y-5 text-left relative">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-bold text-white font-display">Ergonomic Hotkeys</span>
              </div>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="p-1.5 rounded-xl hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <div className="font-bold text-slate-300 uppercase text-[11px] tracking-wider font-mono">
                  Keyboard Controls
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span>Reveal Answer</span>
                    <kbd className="px-2 py-0.5 rounded bg-white/[0.08] border border-white/[0.1] font-mono text-white text-[11px]">Space</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span>Socratic Hint</span>
                    <kbd className="px-2 py-0.5 rounded bg-white/[0.08] border border-white/[0.1] font-mono text-white text-[11px]">H</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-rose-950/20 border border-rose-500/20 text-rose-200">
                    <span>Rate Again</span>
                    <kbd className="px-2 py-0.5 rounded bg-rose-900/60 border border-rose-500/40 font-mono text-white text-[11px]">1</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-amber-950/20 border border-amber-500/20 text-amber-200">
                    <span>Rate Hard</span>
                    <kbd className="px-2 py-0.5 rounded bg-amber-900/60 border border-amber-500/40 font-mono text-white text-[11px]">2</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-blue-950/20 border border-blue-500/20 text-blue-200">
                    <span>Rate Good</span>
                    <kbd className="px-2 py-0.5 rounded bg-blue-900/60 border border-blue-500/40 font-mono text-white text-[11px]">3</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-200">
                    <span>Rate Easy</span>
                    <kbd className="px-2 py-0.5 rounded bg-emerald-900/60 border border-emerald-500/40 font-mono text-white text-[11px]">4</kbd>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                <div className="font-bold text-slate-300 uppercase text-[11px] tracking-wider font-mono flex items-center gap-1.5">
                  <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Bluetooth Controller (Joy-Con / 8BitDo / Xbox)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Turn on your controller and press any button. Lotti pairs automatically.
                  Use Button A/B to flip, D-Pad/face buttons to rate effortlessly!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowShortcutsModal(false)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

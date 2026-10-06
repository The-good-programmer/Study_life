import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  Flame, 
  Clock, 
  Award, 
  Layers, 
  Sparkles
} from 'lucide-react';
import type { StudySession, UserStats } from '../../types';
import { soundEngine } from '../../services/soundEngine';
import { UserAvatarBadge } from '../character/UserAvatarBadge';

interface SynapticFlexModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: StudySession;
  stats: UserStats;
}

export const SynapticFlexModal: React.FC<SynapticFlexModalProps> = ({
  isOpen,
  onClose,
  session,
  stats
}) => {
  const [copied, setCopied] = useState(false);
  const minutes = Math.max(1, Math.round(session.elapsedSeconds / 60));
  const totalCards = session.concepts.reduce((acc, c) => acc + c.retrievalCards.length, 0);

  if (!isOpen) return null;

  const flexText = `🧠 Just conquered a ${minutes}m study session on Studify!
📚 Topic: "${session.title}"
⚡ Cleared: ${session.concepts.length} Concept Nodes • ${totalCards} FSRS Active Recall Reps
🔥 Streak: ${stats.currentStreak} Days
✨ "Synapses wire when they fire. Zero passive reading."`;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(flexText);
      setCopied(true);
      soundEngine.playSuccess();
      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#38bdf8', '#f43f5e', '#a855f7']
      });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="max-w-md w-full rounded-3xl bg-[#090d16] border border-white/[0.12] shadow-2xl p-6 sm:p-7 space-y-6 relative overflow-hidden">
        
        {/* Ambient Glows */}
        <div className="absolute -top-12 -left-12 w-44 h-44 rounded-full bg-pink-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-44 h-44 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] relative z-10">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-pink-400" />
            <span className="text-sm font-extrabold text-white font-display">Share Synaptic Flex Card</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* The Viral Flex Trophy Card Preview */}
        <div className="relative rounded-3xl p-5 bg-gradient-to-b from-slate-900 to-[#070a12] border border-pink-500/30 shadow-2xl space-y-4 text-center z-10">
          
          {/* Card Top Brand */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm text-white tracking-tight font-display">Lotti</span>
              <span className="text-[8px] font-mono uppercase px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Spaced Recall
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono text-amber-400 font-bold">
              <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{stats.currentStreak}d Streak</span>
            </div>
          </div>

          {/* Character Hero Avatar */}
          <div className="relative w-24 h-24 mx-auto group">
            <div className="absolute -inset-2.5 rounded-full bg-gradient-to-tr from-indigo-500/40 via-purple-500/30 to-cyan-400/40 blur-lg animate-pulse" />
            <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-950 border border-indigo-500/40 shadow-xl flex items-center justify-center p-0.5">
              <UserAvatarBadge size="lg" />
            </div>
            <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-slate-950 border border-indigo-500/40 text-[11px] font-bold text-indigo-300 flex items-center gap-1 shadow-md">
              <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
              <span>Mastery</span>
            </div>
          </div>

          {/* Session Title & Badge */}
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              {session.category} • Certified Cognitive Cycle
            </span>
            <h3 className="text-lg font-black text-white tracking-tight font-display">
              "{session.title}"
            </h3>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.08]">
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-[11px] text-slate-400 font-mono">Focus</div>
              <div className="text-base font-black text-white font-mono flex items-center justify-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-indigo-400" />
                <span>{minutes}m</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-[11px] text-slate-400 font-mono">Nodes</div>
              <div className="text-base font-black text-white font-mono flex items-center justify-center gap-1 mt-0.5">
                <Award className="w-3 h-3 text-purple-400" />
                <span>{session.concepts.length}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-[11px] text-slate-400 font-mono">FSRS Reps</div>
              <div className="text-base font-black text-white font-mono flex items-center justify-center gap-1 mt-0.5">
                <Layers className="w-3 h-3 text-cyan-400" />
                <span>{totalCards}</span>
              </div>
            </div>
          </div>

          {/* Tagline */}
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-200 font-medium">
            ✨ Cognitive Creed: "Synapses wire when they fire. Zero passive reading."
          </div>

        </div>

        {/* Action Buttons */}
        <div className="space-y-2 relative z-10">
          <button
            onClick={handleCopyText}
            className={`w-full py-3 px-4 rounded-2xl font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              copied
                ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                : 'bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 hover:from-pink-400 hover:to-cyan-400 text-white shadow-pink-500/25 hover:scale-[1.02]'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Copied to Clipboard! Ready to Flex</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Synaptic Flex for Discord / X / Insta</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-400 text-center">
            Paste directly into group chats, Discord study servers, or your story to inspire friends!
          </p>
        </div>

      </div>
    </div>
  );
};

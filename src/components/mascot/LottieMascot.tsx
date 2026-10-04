import React, { useState, Suspense, lazy } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Zap, Brain, MessageSquare, Box } from 'lucide-react';
import { soundEngine } from '../../services/soundEngine';
import { ExpressiveAxolotl } from './ExpressiveAxolotl';

const Axolotl3DCanvas = lazy(() => import('./Axolotl3DCanvas').then(m => ({ default: m.Axolotl3DCanvas })));

export interface LottieMascotProps {
  variant?: 'avatar' | 'badge' | 'compact' | 'hero' | 'card' | 'breathing';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  speech?: string;
  showSpeechBubble?: boolean;
  className?: string;
  onMascotClick?: () => void;
  onExploreTour?: () => void;
  onOpenSanctuary?: () => void;
  show3DToggle?: boolean;
}

const LOTTIE_TIPS = [
  "Ready for a quick 3-minute study streak? You've got this! 🌟",
  "Keep your streak blazing! Every rep makes you sharper! 🔥",
  "Don't worry about mistakes—that's literally how learning happens! ✨",
  "Just 5 quick questions today to lock in your progress! 🚀",
  "High five! Let's crush today's daily quest together! 🐾",
  "Small daily habits beat weekend cramming every single time! 💫",
  "You're doing amazing today! Let's earn some coins! 🪙"
];

export const LottieMascot: React.FC<LottieMascotProps> = ({
  variant = 'compact',
  size = 'md',
  speech,
  showSpeechBubble = true,
  className = '',
  onMascotClick,
  onExploreTour,
  onOpenSanctuary,
  show3DToggle = true,
}) => {
  const [tipIndex, setTipIndex] = useState(0);
  const [isWobbling, setIsWobbling] = useState(false);
  const [isLive3D, setIsLive3D] = useState(false);

  const currentSpeech = speech || LOTTIE_TIPS[tipIndex];

  const handleInteract = () => {
    setIsWobbling(true);
    setTimeout(() => setIsWobbling(false), 600);

    // Rotate tip
    setTipIndex((prev) => (prev + 1) % LOTTIE_TIPS.length);

    try {
      soundEngine.playAxolotlChirp();
      soundEngine.playAxolotlBubble();
    } catch {
      // Audio context might be restricted
    }

    if (variant === 'hero' || variant === 'card') {
      try {
        confetti({
          particleCount: 20,
          spread: 45,
          origin: { y: 0.8 },
          colors: ['#38bdf8', '#f43f5e', '#a855f7'],
        });
      } catch {
        // Confetti fallback
      }
    }

    if (onMascotClick) onMascotClick();
  };

  // Dimensions
  const sizeMap = {
    xs: 'w-7 h-7',
    sm: 'w-9 h-9',
    md: 'w-14 h-14',
    lg: 'w-24 h-24 sm:w-28 sm:h-28',
    xl: 'w-36 h-36 sm:w-44 sm:h-44',
  };

  // Just an avatar icon/badge for navbar or sidebar
  if (variant === 'avatar' || variant === 'badge') {
    return (
      <div 
        onClick={() => {
          if (onOpenSanctuary) {
            onOpenSanctuary();
          } else {
            handleInteract();
          }
        }}
        className={`relative group cursor-pointer inline-flex items-center justify-center shrink-0 ${className}`}
        title="Lottie — Click to visit 3D Sanctuary!"
      >
        <div className={`relative ${sizeMap[size]} rounded-2xl overflow-hidden p-0.5 bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 shadow-md shadow-pink-500/20 group-hover:scale-105 transition-all duration-300 flex items-center justify-center`}>
          <ExpressiveAxolotl 
            size={size === 'xl' || size === 'lg' ? 'md' : 'xs'} 
            mood={isWobbling ? 'cheering' : 'happy'} 
          />
        </div>
        {/* Pulsing online beacon */}
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 ring-2 ring-slate-950 shadow-sm shadow-cyan-400/80 animate-pulse" />
      </div>
    );
  }

  // Hero interactive banner with speech bubble
  if (variant === 'hero') {
    return (
      <div className={`relative flex flex-col md:flex-row items-center gap-4 sm:gap-6 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-slate-900/95 via-indigo-950/40 to-slate-900/95 border border-pink-500/20 shadow-2xl backdrop-blur-xl ${className}`}>
        {/* Ambient neon backdrop glows */}
        <div className="absolute -top-6 -left-6 w-32 h-32 rounded-full bg-pink-500/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-cyan-500/10 blur-2xl pointer-events-none" />

        {/* Mascot Avatar with Interactive Pulsing Rings (Supports Live 3D or 2D) */}
        <div className="relative group shrink-0 select-none flex flex-col items-center gap-2">
          <div 
            onClick={() => {
              if (onOpenSanctuary) {
                onOpenSanctuary();
              } else {
                handleInteract();
              }
            }}
            className="relative cursor-pointer"
            title="Click Lottie to open 3D Axolotl Sanctuary!"
          >
            <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-tr from-pink-500/40 via-purple-500/30 to-cyan-400/40 blur-sm group-hover:blur-md transition-all animate-pulse" />
            <div className={`relative ${sizeMap[size]} rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-950 p-1 border border-pink-500/30 shadow-xl group-hover:scale-105 transition-all duration-300 flex items-center justify-center`}>
              {isLive3D ? (
                <Suspense fallback={
                  <div className="w-full h-full flex items-center justify-center bg-slate-950">
                    <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                }>
                  <Axolotl3DCanvas 
                    interactive={true} 
                    enableOrbit={false} 
                    autoRotate={true}
                    className="w-full h-full rounded-xl sm:rounded-2xl" 
                  />
                </Suspense>
              ) : (
                <ExpressiveAxolotl 
                  size={size === 'xl' ? 'xl' : size === 'lg' ? 'lg' : 'md'} 
                  mood={isWobbling ? 'celebrating' : 'cheering'} 
                />
              )}
            </div>
            <div className="absolute -bottom-2 -right-1 px-2 py-0.5 rounded-full bg-slate-950/90 border border-pink-500/40 text-[11px] font-bold text-pink-300 flex items-center gap-1 shadow-lg">
              <Sparkles className="w-2.5 h-2.5 text-pink-400" />
              <span>{isLive3D ? '3D' : 'Lottie'}</span>
            </div>
          </div>

          {/* Quick Action Button directly under avatar: Open 3D Sanctuary */}
          {onOpenSanctuary && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSanctuary();
              }}
              className="px-3 py-1 rounded-full text-[11px] font-black bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 hover:from-pink-400 hover:to-cyan-400 text-white flex items-center gap-1.5 shadow-md shadow-pink-500/30 hover:scale-105 transition-all cursor-pointer animate-pulse"
              title="Open full 3D Axolotl Sanctuary page"
            >
              <Sparkles className="w-3 h-3 text-white" />
              <span>3D Sanctuary 🐾</span>
            </button>
          )}

          {/* Quick 2D / 3D Mode Switcher on hero card */}
          {show3DToggle && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsLive3D(prev => !prev);
                try {
                  soundEngine.playAxolotlBubble();
                } catch {
                  // catch
                }
              }}
              className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-slate-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer shadow-sm"
              title="Toggle preview between 2D illustration and 3D living Axolotl"
            >
              <Box className="w-2.5 h-2.5 text-pink-400" />
              <span>{isLive3D ? '2D View' : 'Live 3D'}</span>
            </button>
          )}
        </div>

        {/* Dynamic Speech Bubble */}
        {showSpeechBubble && (
          <div className="flex-1 space-y-2 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-pink-500/15 text-pink-300 border border-pink-500/30 flex items-center gap-1.5">
                <Brain className="w-3 h-3 text-pink-400" />
                <span>Neuro Co-Pilot</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 text-cyan-400" />
                <span>Neurogenesis Active</span>
              </span>

              {onOpenSanctuary && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpenSanctuary(); }}
                  className="px-3 py-1 rounded-full text-[11px] font-bold bg-gradient-to-r from-pink-500/30 via-purple-500/30 to-cyan-500/30 hover:from-pink-500/50 hover:to-cyan-500/50 text-pink-100 border border-pink-400/50 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm group hover:scale-105"
                  title="Open dedicated full-page 3D Axolotl Sanctuary with feeding, care & customization"
                >
                  <Sparkles className="w-3 h-3 text-cyan-300 group-hover:rotate-12 transition-transform" />
                  <span>3D Sanctuary 🐾</span>
                </button>
              )}

              {onExploreTour && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onExploreTour(); }}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30 text-pink-200 border border-pink-500/40 flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                  title="Interactive 4-Phase Cognitive Architecture Tour"
                >
                  <Sparkles className="w-2.5 h-2.5 text-pink-400" />
                  <span>How Lotti Works (Tour)</span>
                </button>
              )}
            </div>

            <div 
              onClick={handleInteract}
              className="relative p-3.5 sm:p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] hover:border-pink-500/30 transition-all cursor-pointer group"
            >
              <p className="text-xs sm:text-sm font-medium text-slate-200 leading-relaxed">
                "{currentSpeech}"
              </p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.06] text-[11px] text-slate-400">
                <span className="text-slate-400 group-hover:text-pink-300 transition-colors flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  Click Lottie to cycle science tips
                </span>
                <span className="font-mono text-pink-400/80">Tip #{tipIndex + 1}/{LOTTIE_TIPS.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Breathing / Micro-rest mode
  if (variant === 'breathing') {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
        <div className="relative group">
          <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-pink-500/30 via-purple-500/20 to-cyan-400/30 blur-md animate-pulse" />
          <div className={`relative ${sizeMap[size]} rounded-3xl overflow-hidden bg-slate-950 p-2 border border-cyan-500/30 shadow-2xl flex items-center justify-center`}>
            <ExpressiveAxolotl 
              size={size === 'xl' ? 'xl' : size === 'lg' ? 'lg' : 'md'} 
              mood="sleeping" 
            />
          </div>
        </div>
        <div className="px-3 py-1 rounded-full bg-slate-900/90 border border-cyan-500/30 text-[11px] font-semibold text-cyan-300 shadow-md">
          Lottie is resting your hippocampus 🌊
        </div>
      </div>
    );
  }

  // Standard compact card
  return (
    <div 
      onClick={handleInteract}
      className={`flex items-center gap-3 p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-850 border border-white/[0.08] hover:border-pink-500/30 transition-all cursor-pointer group select-none ${className}`}
    >
      <div className={`relative ${sizeMap[size]} rounded-xl overflow-hidden bg-slate-950 shrink-0 border border-pink-500/30 flex items-center justify-center p-1`}>
        <ExpressiveAxolotl 
          size={size === 'xs' || size === 'sm' ? 'xs' : 'sm'} 
          mood={isWobbling ? 'celebrating' : 'happy'} 
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-white group-hover:text-pink-300 transition-colors">Lottie</span>
          <span className="text-[11px] font-mono text-cyan-400 px-1.5 py-0.2 rounded-full bg-cyan-500/10 border border-cyan-500/20">Co-Pilot</span>
        </div>
        <p className="text-[11px] text-slate-400 truncate mt-0.5">
          {currentSpeech}
        </p>
      </div>
    </div>
  );
};

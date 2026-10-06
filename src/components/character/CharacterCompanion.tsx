import React, { useState, useEffect, Suspense, lazy } from 'react';
import confetti from 'canvas-confetti';
import { Sliders, ArrowRight, Sparkles } from 'lucide-react';
import { soundEngine } from '../../services/soundEngine';
import { characterService } from '../../services/characterService';
import { type CharacterCustomization } from '../../types/character';
import { UserAvatarBadge } from './UserAvatarBadge';

// The customizer pulls in three.js; load it only when the user opens it.
const CharacterCustomizerModal = lazy(() =>
  import('./CharacterCustomizerModal').then(m => ({ default: m.CharacterCustomizerModal }))
);

export interface CharacterCompanionProps {
  variant?: 'avatar' | 'badge' | 'compact' | 'hero' | 'card' | 'breathing';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  speech?: string;
  showSpeechBubble?: boolean;
  className?: string;
  onMascotClick?: () => void;
  onExploreTour?: () => void;
  onOpenSanctuary?: () => void;
  onOpenCustomizer?: () => void;
}

const STUDY_TIPS = [
  "Ready for a quick 3-minute study streak? You've got this! 🌟",
  "Consistency is key! Every active recall rep builds long-term neural connections! 🔥",
  "Mistakes during recall are where learning actually happens! Keep going! ✨",
  "Just 5 quick questions today to lock in your spaced retention! 🚀",
  "High five! Let's conquer today's study goals together! 🎯",
  "Distributed practice beats last-minute cramming every single time! 💫",
  "Great momentum today! Let's earn more campus coins! 🪙",
];

export const CharacterCompanion: React.FC<CharacterCompanionProps> = ({
  variant = 'compact',
  size = 'md',
  speech,
  showSpeechBubble = true,
  className = '',
  onMascotClick,
  onExploreTour,
  onOpenSanctuary,
  onOpenCustomizer,
}) => {
  const [character, setCharacter] = useState<CharacterCustomization>(() => characterService.getCharacter());
  const [tipIndex, setTipIndex] = useState(0);
  const [isWobbling, setIsWobbling] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const unsub = characterService.subscribe((c) => setCharacter(c));
    return unsub;
  }, []);

  const currentSpeech = speech || STUDY_TIPS[tipIndex];

  const handleInteract = () => {
    setIsWobbling(true);
    setTimeout(() => setIsWobbling(false), 500);

    setTipIndex((prev) => (prev + 1) % STUDY_TIPS.length);

    try {
      soundEngine.playSuccess();
    } catch {}

    if (variant === 'hero' || variant === 'card') {
      try {
        confetti({
          particleCount: 20,
          spread: 45,
          origin: { y: 0.8 },
          colors: ['#38bdf8', '#6366f1', '#a855f7'],
        });
      } catch {}
    }

    if (onMascotClick) onMascotClick();
  };

  const handleOpenStudio = () => {
    if (onOpenCustomizer) {
      onOpenCustomizer();
    } else {
      setIsModalOpen(true);
    }
  };

  // Avatar / Badge simple view
  if (variant === 'avatar' || variant === 'badge') {
    return (
      <>
        <div
          onClick={() => {
            if (onOpenSanctuary) {
              onOpenSanctuary();
            } else {
              handleOpenStudio();
            }
          }}
          className={`relative group cursor-pointer inline-flex items-center justify-center shrink-0 ${className}`}
          title={`${character.name} — Customize your 3D Student Avatar`}
        >
          <UserAvatarBadge size={size} customization={character} />
        </div>

        {isModalOpen && (
          <Suspense fallback={null}>
            <CharacterCustomizerModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
            />
          </Suspense>
        )}
      </>
    );
  }

  // Hero format (e.g. Daily Mission banner or home header)
  if (variant === 'hero') {
    return (
      <>
        <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/60 via-slate-900/90 to-purple-950/50 border border-indigo-500/30 p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6 shadow-2xl ${className}`}>
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-900 border border-indigo-500/40 p-1 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <UserAvatarBadge size="lg" customization={character} onClick={handleOpenStudio} />
            </div>
            <button
              type="button"
              onClick={handleOpenStudio}
              className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-indigo-600 text-white shadow-md hover:bg-indigo-500 transition-all cursor-pointer"
              title="Customize 3D Character"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold font-mono">
                Level {character.level} {character.studyTitle}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                🪙 {character.coins} Coins
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white font-display">
              {character.name || 'Student Avatar'}
            </h3>

            <p className="text-sm text-slate-300 max-w-xl font-medium leading-relaxed">
              "{currentSpeech}"
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
              <button
                type="button"
                onClick={handleOpenStudio}
                className="px-4 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Customize 3D Character</span>
              </button>

              {onOpenSanctuary && (
                <button
                  type="button"
                  onClick={onOpenSanctuary}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>Visit 3D Sanctuary</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}

              {onExploreTour && (
                <button
                  type="button"
                  onClick={onExploreTour}
                  className="px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                  <span>Cognitive Tour</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {isModalOpen && (
          <Suspense fallback={null}>
            <CharacterCustomizerModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
            />
          </Suspense>
        )}
      </>
    );
  }

  // Default Compact / Card view
  return (
    <>
      <div className={`relative flex items-center gap-3.5 ${className}`}>
        <div
          onClick={handleInteract}
          className={`shrink-0 cursor-pointer transition-transform duration-300 ${isWobbling ? 'scale-110' : 'hover:scale-105'}`}
        >
          <UserAvatarBadge size={size} customization={character} />
        </div>

        {showSpeechBubble && (
          <div className="relative flex-1 bg-slate-900/90 border border-slate-700/60 rounded-2xl p-3 shadow-lg max-w-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1">
                <span>{character.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                  Lv.{character.level}
                </span>
              </span>
              <button
                type="button"
                onClick={handleOpenStudio}
                className="text-[11px] text-slate-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
                title="Customize Character"
              >
                <Sliders className="w-3 h-3" />
                <span>Edit</span>
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-snug">
              {currentSpeech}
            </p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <Suspense fallback={null}>
          <CharacterCustomizerModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
};

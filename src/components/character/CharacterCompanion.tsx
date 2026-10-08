import React, { useState, useEffect, Suspense, lazy } from 'react';
import confetti from 'canvas-confetti';
import { Sliders } from 'lucide-react';
import { soundEngine } from '../../services/soundEngine';
import { characterService } from '../../services/characterService';
import { type CharacterCustomization } from '../../types/character';
import { UserAvatarBadge } from './UserAvatarBadge';

// The customizer pulls in three.js; load it only when the user opens it.
const CharacterCustomizerModal = lazy(() =>
  import('./CharacterCustomizerModal').then(m => ({ default: m.CharacterCustomizerModal }))
);

export interface CharacterCompanionProps {
  variant?: 'avatar' | 'badge' | 'compact' | 'card' | 'breathing';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  speech?: string;
  showSpeechBubble?: boolean;
  className?: string;
  onMascotClick?: () => void;
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

    if (variant === 'card') {
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
          <div className="relative min-w-0 flex-1 rounded-2xl border border-line bg-surface px-3.5 py-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-ink">
                <span className="truncate">{character.name}</span>
                <span className="shrink-0 tabular-nums text-ink-subtle">Level {character.level}</span>
              </span>
              <button
                type="button"
                onClick={handleOpenStudio}
                className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-subtle transition-colors hover:text-ink cursor-pointer"
                title="Change your avatar"
              >
                <Sliders className="h-3 w-3" aria-hidden="true" />
                Edit
              </button>
            </div>
            <p className="text-[13px] leading-snug text-ink-muted">{currentSpeech}</p>
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

import React, { useState, useEffect } from 'react';

export type AxolotlMood = 'happy' | 'cheering' | 'thinking' | 'sleeping' | 'celebrating' | 'curious' | 'zen';

interface ExpressiveAxolotlProps {
  mood?: AxolotlMood;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animated?: boolean;
  accessory?: 'none' | 'crown' | 'cap' | 'headphones' | 'glasses';
  onClick?: () => void;
}

export const ExpressiveAxolotl: React.FC<ExpressiveAxolotlProps> = ({
  mood = 'happy',
  size = 'md',
  className = '',
  animated = true,
  accessory = 'none',
  onClick,
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [isWiggle, setIsWiggle] = useState(false);

  // Natural spontaneous eye-blinking loop
  useEffect(() => {
    if (mood === 'sleeping') return;
    const scheduleNextBlink = () => {
      const delay = 2500 + Math.random() * 3000;
      return setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleNextBlink();
        }, 160);
      }, delay);
    };

    const timer = scheduleNextBlink();
    return () => clearTimeout(timer);
  }, [mood]);

  const sizeDimensions = {
    xs: { w: 32, h: 32 },
    sm: { w: 44, h: 44 },
    md: { w: 72, h: 72 },
    lg: { w: 120, h: 120 },
    xl: { w: 180, h: 180 },
  };

  const { w, h } = sizeDimensions[size];

  const handleClick = () => {
    setIsWiggle(true);
    setTimeout(() => setIsWiggle(false), 500);
    if (onClick) onClick();
  };

  // Determine eye expression
  const renderEyes = () => {
    if (mood === 'sleeping') {
      return (
        <g stroke="#be185d" strokeWidth="2.5" strokeLinecap="round" fill="none">
          <path d="M 33 46 Q 38 50 43 46" />
          <path d="M 57 46 Q 62 50 67 46" />
        </g>
      );
    }

    if (mood === 'cheering' || mood === 'celebrating') {
      return (
        <g stroke="#be185d" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M 32 46 Q 38 40 44 46" />
          <path d="M 56 46 Q 62 40 68 46" />
          {/* Sparkle star in right eye */}
          <polygon points="62,37 63,39 65,40 63,41 62,43 61,41 59,40 61,39" fill="#fef08a" stroke="none" />
        </g>
      );
    }

    if (isBlinking) {
      return (
        <g stroke="#831843" strokeWidth="2.5" strokeLinecap="round">
          <line x1="33" y1="46" x2="43" y2="46" />
          <line x1="57" y1="46" x2="67" y2="46" />
        </g>
      );
    }

    // Default open bright kawaii eyes
    return (
      <g>
        {/* Left Eye */}
        <circle cx="38" cy="46" r="5.5" fill="#1e1b4b" />
        <circle cx="36" cy="44" r="2.2" fill="#ffffff" />
        <circle cx="40" cy="48" r="1.1" fill="#ffffff" />

        {/* Right Eye */}
        <circle cx="62" cy="46" r="5.5" fill="#1e1b4b" />
        <circle cx="60" cy="44" r="2.2" fill="#ffffff" />
        <circle cx="64" cy="48" r="1.1" fill="#ffffff" />
      </g>
    );
  };

  // Determine mouth expression
  const renderMouth = () => {
    if (mood === 'cheering' || mood === 'celebrating') {
      return (
        <g>
          <path d="M 46 53 Q 50 61 54 53 Z" fill="#e11d48" stroke="#be185d" strokeWidth="1.5" />
          <path d="M 47 55 Q 50 59 53 55" fill="#fda4af" />
        </g>
      );
    }
    if (mood === 'thinking') {
      return (
        <path d="M 46 54 Q 50 52 54 55" stroke="#9d174d" strokeWidth="2" strokeLinecap="round" fill="none" />
      );
    }
    if (mood === 'sleeping') {
      return (
        <ellipse cx="50" cy="54" rx="2" ry="1.5" fill="#9d174d" />
      );
    }
    // Kawaii smile :3
    return (
      <path 
        d="M 45 52 Q 47.5 56 50 53 Q 52.5 56 55 52" 
        stroke="#9d174d" 
        strokeWidth="2" 
        strokeLinecap="round" 
        fill="none" 
      />
    );
  };

  const animationClass = animated
    ? (mood === 'cheering' || mood === 'celebrating'
        ? 'animate-bounce'
        : mood === 'thinking'
        ? 'animate-pulse'
        : isWiggle
        ? 'scale-110 rotate-6 transition-transform duration-200'
        : 'hover:scale-105 transition-transform duration-300')
    : '';

  return (
    <div 
      onClick={handleClick}
      style={{ width: `${w}px`, height: `${h}px` }}
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      title="Lottie — Your Study Coach 🐾"
    >
      <svg 
        viewBox="0 0 100 100" 
        className={`w-full h-full drop-shadow-md overflow-visible ${animationClass}`}
      >
        <defs>
          <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fbcfe8" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
          <linearGradient id="gillGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
          <linearGradient id="bellyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fdf2f8" />
            <stop offset="100%" stopColor="#fce7f3" />
          </linearGradient>
        </defs>

        {/* Ambient Bubbles */}
        {(mood === 'cheering' || mood === 'celebrating') && (
          <g fill="#38bdf8" opacity="0.6">
            <circle cx="16" cy="22" r="3" />
            <circle cx="84" cy="18" r="3.5" />
            <circle cx="80" cy="34" r="2" />
          </g>
        )}

        {/* Left External Gills (3 frills) */}
        <g className={animated ? 'origin-[30px_48px] animate-pulse' : ''}>
          <path d="M 30 40 C 14 34, 10 44, 26 46" fill="url(#gillGrad)" />
          <path d="M 28 47 C 10 46, 8 57, 26 55" fill="url(#gillGrad)" />
          <path d="M 29 55 C 14 58, 12 68, 28 62" fill="url(#gillGrad)" />
        </g>

        {/* Right External Gills (3 frills) */}
        <g className={animated ? 'origin-[70px_48px] animate-pulse' : ''}>
          <path d="M 70 40 C 86 34, 90 44, 74 46" fill="url(#gillGrad)" />
          <path d="M 72 47 C 90 46, 92 57, 74 55" fill="url(#gillGrad)" />
          <path d="M 71 55 C 86 58, 88 68, 72 62" fill="url(#gillGrad)" />
        </g>

        {/* Swimming Ribbon Tail (Behind body) */}
        <path d="M 44 76 Q 50 94 40 98 Q 56 94 56 76 Z" fill="#f43f5e" opacity="0.85" />

        {/* Axolotl Plump Head & Body */}
        <ellipse cx="50" cy="52" rx="26" ry="24" fill="url(#bodyGrad)" stroke="#f43f5e" strokeWidth="1.2" />

        {/* Soft Pearly Belly */}
        <ellipse cx="50" cy="59" rx="15" ry="12" fill="url(#bellyGrad)" />

        {/* Rosy Cheeks */}
        <ellipse cx="32" cy="51" rx="4.5" ry="3" fill="#fda4af" opacity="0.85" />
        <ellipse cx="68" cy="51" rx="4.5" ry="3" fill="#fda4af" opacity="0.85" />

        {/* Eyes & Mouth */}
        {renderEyes()}
        {renderMouth()}

        {/* Cute Front Paws */}
        <ellipse cx="40" cy="69" rx="3.5" ry="4" fill="#fbcfe8" stroke="#f43f5e" strokeWidth="0.8" />
        <ellipse cx="60" cy="69" rx="3.5" ry="4" fill="#fbcfe8" stroke="#f43f5e" strokeWidth="0.8" />

        {/* Optional Accessory: Graduation Cap / Crown */}
        {(accessory === 'crown' || mood === 'celebrating') && (
          <g transform="translate(36, 17)">
            <polygon points="0,15 3.5,6 7,12 10.5,3 14,12 17.5,6 21,15" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
            <circle cx="3.5" cy="6" r="1.2" fill="#ef4444" />
            <circle cx="10.5" cy="3" r="1.2" fill="#3b82f6" />
            <circle cx="17.5" cy="6" r="1.2" fill="#10b981" />
          </g>
        )}

        {accessory === 'cap' && (
          <g transform="translate(34, 18)">
            <polygon points="12,0 24,6 12,12 0,6" fill="#1e1b4b" />
            <rect x="6" y="8" width="12" height="4" fill="#312e81" rx="1" />
            <line x1="20" y1="7" x2="23" y2="15" stroke="#facc15" strokeWidth="1.5" />
            <circle cx="23" cy="15" r="1.5" fill="#facc15" />
          </g>
        )}
      </svg>

      {/* Floating Zzz for sleeping */}
      {mood === 'sleeping' && (
        <div className="absolute -top-1 -right-1 text-xs font-mono font-bold text-pink-300 animate-pulse pointer-events-none">
          Zzz...
        </div>
      )}
    </div>
  );
};

export default ExpressiveAxolotl;

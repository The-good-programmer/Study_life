import React, { useState, useEffect } from 'react';
import type { CharacterCustomization } from '../../types/character';
import { characterService } from '../../services/characterService';

export interface UserAvatarBadgeProps {
  customization?: CharacterCustomization;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
  showBorder?: boolean;
}

export const UserAvatarBadge: React.FC<UserAvatarBadgeProps> = ({
  customization,
  size = 'md',
  className = '',
  onClick,
  showBorder = true,
}) => {
  const [character, setCharacter] = useState<CharacterCustomization>(() => customization || characterService.getCharacter());

  useEffect(() => {
    if (customization) {
      setCharacter(customization);
      return;
    }
    const unsub = characterService.subscribe((c) => setCharacter(c));
    return unsub;
  }, [customization]);

  const sizeDimensions = {
    xs: { w: 32, h: 32, viewBox: '0 0 100 100' },
    sm: { w: 44, h: 44, viewBox: '0 0 100 100' },
    md: { w: 64, h: 64, viewBox: '0 0 100 100' },
    lg: { w: 96, h: 96, viewBox: '0 0 100 100' },
    xl: { w: 140, h: 140, viewBox: '0 0 100 100' },
  };

  const { w, h, viewBox } = sizeDimensions[size];

  const skin = character.skinTone || '#fcd0ba';
  const hair = character.hairColor || '#382212';
  const topColor = character.topColor || '#4f46e5';
  const eyeColor = character.eyeColor || '#2563eb';
  const glasses = character.eyewear;
  const headwear = character.headwear;
  const headwearColor = character.headwearColor || '#4f46e5';

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center shrink-0 ${
        onClick ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform' : ''
      } ${className}`}
      title={`${character.name || 'Student Avatar'} (Click to customize)`}
      style={{ width: w, height: h }}
    >
      <svg
        viewBox={viewBox}
        className={`w-full h-full rounded-2xl ${
          showBorder ? 'border border-indigo-500/30 shadow-md shadow-indigo-950/40 bg-gradient-to-b from-[#131b34] to-[#090d1a]' : ''
        }`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Soft Ambient Background Glow */}
        <circle cx="50" cy="50" r="46" fill="url(#avatarGlow)" opacity="0.25" />

        <defs>
          <radialGradient id="avatarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#090d1a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Shoulders & Top Clothing */}
        <path
          d="M 22 98 C 22 76, 32 70, 50 70 C 68 70, 78 76, 78 98 Z"
          fill={topColor}
        />
        {/* Collar / neckline */}
        <path
          d="M 42 70 Q 50 78 58 70 Z"
          fill={skin}
        />

        {/* Neck */}
        <rect x="44" y="58" width="12" height="14" rx="3" fill={skin} />

        {/* Head Base */}
        <rect x="30" y="24" width="40" height="42" rx="18" fill={skin} />

        {/* Ears */}
        <circle cx="28" cy="46" r="5" fill={skin} />
        <circle cx="72" cy="46" r="5" fill={skin} />

        {/* Cheeks blush (Only on female) */}
        {character.gender === 'female' && (
          <>
            <ellipse cx="36" cy="50" rx="4" ry="2.5" fill="#f472b6" opacity="0.45" />
            <ellipse cx="64" cy="50" rx="4" ry="2.5" fill="#f472b6" opacity="0.45" />
          </>
        )}

        {/* Eyes */}
        <circle cx="39" cy="43" r="4.5" fill="#ffffff" />
        <circle cx="39" cy="43" r="3" fill={eyeColor} />
        <circle cx="39" cy="43" r="1.6" fill="#09090b" />
        <circle cx="40.5" cy="41.5" r="1" fill="#ffffff" />

        <circle cx="61" cy="43" r="4.5" fill="#ffffff" />
        <circle cx="61" cy="43" r="3" fill={eyeColor} />
        <circle cx="61" cy="43" r="1.6" fill="#09090b" />
        <circle cx="62.5" cy="41.5" r="1" fill="#ffffff" />

        {/* Eyebrows */}
        <path d={character.gender === 'male' ? "M 33 37 L 44 37" : "M 34 36 Q 39 34 44 36"} stroke={hair} strokeWidth={character.gender === 'male' ? "2.5" : "1.8"} strokeLinecap="round" />
        <path d={character.gender === 'male' ? "M 56 37 L 67 37" : "M 56 36 Q 61 34 66 36"} stroke={hair} strokeWidth={character.gender === 'male' ? "2.5" : "1.8"} strokeLinecap="round" />

        {/* Nose */}
        <path d="M 49 42 L 51 47 L 48 48" stroke="#000000" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.25" />

        {/* Gentle mouth */}
        <path d="M 45 54 Q 50 57 55 54" stroke={character.gender === 'female' ? "#be185d" : "#7c2d12"} strokeWidth="1.8" strokeLinecap="round" opacity={character.gender === 'male' ? "0.6" : "0.85"} />

        {/* Facial hair (stubble / goatee / beard) */}
        {character.facialHair === 'stubble' && (
          <path d="M 36 50 Q 50 63 64 50 Q 50 66 36 50 Z" fill={hair} opacity="0.2" />
        )}
        {(character.facialHair === 'goatee' || character.facialHair === 'beard') && (
          <path d="M 42 51 Q 50 52 58 51 Q 50 66 42 51 Z" fill={hair} opacity="0.85" />
        )}

        {/* Hair Styles */}
        {character.hairStyle === 'curly-afro' && (
          <g fill={hair}>
            <circle cx="50" cy="22" r="18" />
            <circle cx="32" cy="28" r="14" />
            <circle cx="68" cy="28" r="14" />
            <circle cx="24" cy="40" r="10" />
            <circle cx="76" cy="40" r="10" />
          </g>
        )}

        {character.hairStyle === 'bob-cut' && (
          <g fill={hair}>
            <path d="M 28 32 C 28 16, 72 16, 72 32 C 76 44, 76 56, 74 58 C 72 60, 68 50, 68 38 C 60 26, 40 26, 32 38 C 32 50, 28 60, 26 58 C 24 56, 24 44, 28 32 Z" />
          </g>
        )}

        {character.hairStyle === 'long-wavy' && (
          <g fill={hair}>
            <path d="M 28 30 C 28 14, 72 14, 72 30 C 76 46, 78 72, 74 74 C 70 76, 68 62, 68 40 C 60 28, 40 28, 32 40 C 32 62, 30 76, 26 74 C 22 72, 24 46, 28 30 Z" />
          </g>
        )}

        {character.hairStyle === 'ponytail' && (
          <g fill={hair}>
            <path d="M 30 32 C 30 18, 70 18, 70 32 C 70 38, 30 38, 30 32 Z" />
            <ellipse cx="68" cy="22" rx="7" ry="14" transform="rotate(30 68 22)" />
            <circle cx="64" cy="26" r="3" fill="#ec4899" />
          </g>
        )}

        {character.hairStyle === 'spiky' && (
          <g fill={hair}>
            <path d="M 30 32 C 30 20, 70 20, 70 32 Z" />
            <polygon points="50,10 44,26 56,26" />
            <polygon points="38,14 34,28 46,26" />
            <polygon points="62,14 54,26 66,28" />
          </g>
        )}

        {character.hairStyle === 'side-part' && (
          <g fill={hair}>
            <path d="M 28 32 C 28 18, 72 18, 72 32 C 72 36, 54 28, 30 34 Z" />
          </g>
        )}

        {(character.hairStyle === 'short-fade' || character.hairStyle === 'buzz') && (
          <g fill={hair}>
            <path d="M 29 32 C 29 18, 71 18, 71 32 C 71 34, 29 34, 29 32 Z" />
          </g>
        )}

        {/* Glasses / Eyewear */}
        {glasses && glasses !== 'none' && (
          <g stroke={character.eyewearColor || '#1e293b'} strokeWidth="2.2" fill="none">
            {glasses === 'round' ? (
              <>
                <circle cx="39" cy="43" r="7" />
                <circle cx="61" cy="43" r="7" />
                <line x1="46" y1="43" x2="54" y2="43" />
              </>
            ) : glasses === 'sunglasses' ? (
              <>
                <rect x="32" y="36" width="15" height="14" rx="3" fill="#09090b" stroke="#1e293b" />
                <rect x="53" y="36" width="15" height="14" rx="3" fill="#09090b" stroke="#1e293b" />
                <line x1="47" y1="42" x2="53" y2="42" stroke="#1e293b" strokeWidth="2.5" />
              </>
            ) : (
              <>
                <rect x="32" y="37" width="14" height="12" rx="2" />
                <rect x="54" y="37" width="14" height="12" rx="2" />
                <line x1="46" y1="43" x2="54" y2="43" />
              </>
            )}
          </g>
        )}

        {/* Headwear & Gear */}
        {headwear === 'headphones' && (
          <g fill={headwearColor}>
            {/* Band */}
            <path d="M 24 44 C 24 16, 76 16, 76 44" stroke={headwearColor} strokeWidth="4" fill="none" />
            {/* Earcups */}
            <rect x="20" y="36" width="7" height="16" rx="3.5" />
            <rect x="73" y="36" width="7" height="16" rx="3.5" />
            <circle cx="23.5" cy="44" r="2" fill="#38bdf8" />
            <circle cx="76.5" cy="44" r="2" fill="#38bdf8" />
          </g>
        )}

        {headwear === 'mortarboard' && (
          <g fill={headwearColor}>
            <polygon points="50,12 80,22 50,30 20,22" />
            <circle cx="50" cy="21" r="2.5" fill="#fbbf24" />
            <line x1="50" y1="21" x2="68" y2="34" stroke="#fbbf24" strokeWidth="1.8" />
          </g>
        )}

        {headwear === 'cap' && (
          <g fill={headwearColor}>
            <path d="M 28 32 C 28 18, 72 18, 72 32 Z" />
            <path d="M 28 32 Q 50 28 78 34" stroke={headwearColor} strokeWidth="4" fill="none" />
          </g>
        )}

        {headwear === 'beanie' && (
          <g fill={headwearColor}>
            <path d="M 28 30 C 28 14, 72 14, 72 30 Z" />
            <rect x="26" y="28" width="48" height="6" rx="3" />
          </g>
        )}

        {headwear === 'halo' && (
          <ellipse cx="50" cy="14" rx="22" ry="5" stroke="#fef08a" strokeWidth="3" fill="none" opacity="0.9" />
        )}

        {headwear === 'crown' && (
          <polygon points="34,22 38,12 44,20 50,10 56,20 62,12 66,22" fill="#fbbf24" />
        )}
      </svg>
    </div>
  );
};

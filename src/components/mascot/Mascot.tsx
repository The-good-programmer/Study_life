import React from 'react';
import { cn } from '../../utils/cn';

export type MascotMood = 'happy' | 'cheer' | 'wave' | 'sleepy';

const BODY = '#f7a8c8';
const BODY_SHADE = '#ee8fb6';
const GILLS = '#e86f9f';
const BELLY = '#fcd3e3';
const INK = '#2a1f2d';

/** One feathery gill frond: a stalk with soft round tips. */
const Gill: React.FC<{ x: number; y: number; angle: number }> = ({ x, y, angle }) => (
  <g transform={`translate(${x} ${y}) rotate(${angle})`}>
    <rect x={-2.5} y={-20} width={5} height={20} rx={2.5} fill={GILLS} />
    <circle cx={0} cy={-21} r={5} fill={GILLS} />
    <circle cx={-4} cy={-13} r={3.2} fill={GILLS} />
    <circle cx={4} cy={-11} r={3.2} fill={GILLS} />
  </g>
);

/**
 * Axo, Studify's axolotl: cheers at the end of a session and keeps empty screens company. Drawn here
 * (no image to download), the same in both themes, and decorative only (aria-hidden), so whatever it
 * stands beside must say what it means in words.
 */
export const Mascot: React.FC<{ mood?: MascotMood; className?: string; bob?: boolean }> = ({
  mood = 'happy',
  className,
  bob = true,
}) => {
  const armsUp = mood === 'cheer';
  const sleepy = mood === 'sleepy';
  return (
    <svg
      viewBox="0 0 140 120"
      className={cn('overflow-visible', bob && 'animate-mascot-bob', className)}
      aria-hidden="true"
      focusable="false"
    >
      {/* Shadow */}
      <ellipse cx={70} cy={114} rx={34} ry={4} fill="currentColor" opacity={0.12} />

      {/* Tail */}
      <path d="M96 92 C 118 90, 128 74, 124 62 C 120 76, 108 82, 92 82 Z" fill={BODY_SHADE} />

      {/* Body */}
      <ellipse cx={70} cy={88} rx={30} ry={22} fill={BODY} />
      <ellipse cx={70} cy={93} rx={18} ry={13} fill={BELLY} />

      {/* Arms resting at the sides (raised arms are drawn over the head, below) */}
      <path d="M46 88 C 40 94, 40 100, 44 104" stroke={BODY_SHADE} strokeWidth={8} strokeLinecap="round" fill="none" opacity={armsUp ? 0 : 1} />
      {mood !== 'wave' && (
        <path d="M94 88 C 100 94, 100 100, 96 104" stroke={BODY_SHADE} strokeWidth={8} strokeLinecap="round" fill="none" opacity={armsUp ? 0 : 1} />
      )}

      {/* Gills, behind the head */}
      <Gill x={34} y={44} angle={-62} />
      <Gill x={32} y={54} angle={-90} />
      <Gill x={36} y={64} angle={-118} />
      <Gill x={106} y={44} angle={62} />
      <Gill x={108} y={54} angle={90} />
      <Gill x={104} y={64} angle={118} />

      {/* Head */}
      <ellipse cx={70} cy={52} rx={38} ry={30} fill={BODY} />
      <ellipse cx={70} cy={40} rx={22} ry={9} fill="#ffffff" opacity={0.22} />

      {/* Raised arms, in front of the gills */}
      {armsUp && (
        <>
          <path d="M46 86 C 30 84, 18 74, 13 60" stroke={BODY_SHADE} strokeWidth={8} strokeLinecap="round" fill="none" />
          <path d="M94 86 C 110 84, 122 74, 127 60" stroke={BODY_SHADE} strokeWidth={8} strokeLinecap="round" fill="none" />
        </>
      )}
      {mood === 'wave' && (
        <path
          d="M94 86 C 110 84, 122 74, 127 60"
          stroke={BODY_SHADE}
          strokeWidth={8}
          strokeLinecap="round"
          fill="none"
          className="origin-[94px_86px] animate-mascot-wave"
        />
      )}

      {/* Cheeks */}
      <ellipse cx={46} cy={62} rx={6} ry={3.5} fill={GILLS} opacity={0.45} />
      <ellipse cx={94} cy={62} rx={6} ry={3.5} fill={GILLS} opacity={0.45} />

      {/* Eyes */}
      {sleepy ? (
        <>
          <path d="M48 54 Q 54 58, 60 54" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
          <path d="M80 54 Q 86 58, 92 54" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx={54} cy={53} r={5.5} fill={INK} />
          <circle cx={86} cy={53} r={5.5} fill={INK} />
          <circle cx={56} cy={51} r={1.8} fill="#ffffff" />
          <circle cx={88} cy={51} r={1.8} fill="#ffffff" />
        </>
      )}

      {/* Mouth */}
      {armsUp ? (
        <path d="M60 64 Q 70 76, 80 64 Z" fill={INK} />
      ) : (
        <path d="M62 65 Q 70 71, 78 65" stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      )}

      {/* Sleepy "z" */}
      {sleepy && (
        <text x={108} y={30} fontSize={14} fontWeight={700} fill="currentColor" opacity={0.5}>
          z
        </text>
      )}
    </svg>
  );
};

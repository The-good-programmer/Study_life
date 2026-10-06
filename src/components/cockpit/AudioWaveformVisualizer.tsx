import React, { useEffect, useState } from 'react';

interface AudioWaveformVisualizerProps {
  isActive: boolean;
  mode: 'candidate' | 'examiner';
  barCount?: number;
  className?: string;
}

export const AudioWaveformVisualizer: React.FC<AudioWaveformVisualizerProps> = ({
  isActive,
  mode,
  barCount = 18,
  className = '',
}) => {
  const [heights, setHeights] = useState<number[]>(() => Array(barCount).fill(15));

  useEffect(() => {
    if (!isActive) {
      setHeights(Array(barCount).fill(12));
      return;
    }

    const interval = setInterval(() => {
      setHeights(
        Array.from({ length: barCount }, (_, i) => {
          // Create rhythmic, wavy fluctuation centered around the middle bars
          const centerDist = Math.abs(i - barCount / 2) / (barCount / 2);
          const baseHeight = 20 + Math.random() * 65 * (1 - centerDist * 0.4);
          return Math.round(baseHeight);
        })
      );
    }, 90);

    return () => clearInterval(interval);
  }, [isActive, barCount]);

  const barColor =
    mode === 'candidate'
      ? 'bg-gradient-to-t from-emerald-500 to-teal-300 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
      : 'bg-gradient-to-t from-violet-600 to-indigo-300 shadow-[0_0_8px_rgba(139,92,246,0.5)]';

  return (
    <div className={`flex items-center justify-center gap-1 h-10 px-3 py-1 rounded-full bg-slate-900/60 border border-slate-700/60 backdrop-blur-sm ${className}`}>
      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mr-2 flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full ${
            isActive
              ? mode === 'candidate'
                ? 'bg-emerald-400 animate-ping'
                : 'bg-violet-400 animate-pulse'
              : 'bg-slate-600'
          }`}
        />
        {mode === 'candidate' ? 'MIC AUDIO' : 'EXAMINER VOICE'}
      </span>
      <div className="flex items-center gap-0.5 h-7">
        {heights.map((h, idx) => (
          <div
            key={idx}
            className={`w-1 rounded-full transition-all duration-100 ease-out ${barColor}`}
            style={{
              height: `${isActive ? h : 12}%`,
              opacity: isActive ? 0.35 + (h / 100) * 0.65 : 0.3,
            }}
          />
        ))}
      </div>
    </div>
  );
};

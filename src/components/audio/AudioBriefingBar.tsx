import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  X, 
  Headphones
} from 'lucide-react';
import type { StudySession } from '../../types';
import { speechService } from '../../services/speechService';

interface AudioBriefingBarProps {
  session: StudySession;
  initialConceptIndex?: number;
  onClose?: () => void;
}

export const AudioBriefingBar: React.FC<AudioBriefingBarProps> = ({
  session,
  initialConceptIndex = 0,
  onClose,
}) => {
  const [conceptIndex, setConceptIndex] = useState(initialConceptIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState(false);

  const concepts = session.concepts;
  const currentConcept = concepts[conceptIndex] || concepts[0];

  useEffect(() => {
    const unsub = speechService.subscribe((isSpeaking) => {
      setIsPlaying(isSpeaking);
    });
    return () => {
      unsub();
      speechService.stop();
    };
  }, []);

  const buildConceptSpeechText = (conceptIdx: number): string => {
    const c = concepts[conceptIdx];
    if (!c) return '';
    const parts = [
      `Concept ${c.order}: ${c.title}.`,
      `Core Mental Model: ${c.mentalModel}.`,
      `Key Takeaways: ${c.coreTakeaways.join('. ')}.`,
      `Key Definitions: ${c.keyTerms.map(k => `${k.term}, defined as ${k.definition}`).join('. ')}.`
    ];
    return parts.join(' ');
  };

  const handlePlayCurrent = (idx: number = conceptIndex) => {
    const text = buildConceptSpeechText(idx);
    speechService.setRate(speed);
    speechService.speak(text, () => {
      // Auto-advance to next concept when done!
      if (idx < concepts.length - 1) {
        setConceptIndex(idx + 1);
        handlePlayCurrent(idx + 1);
      } else {
        setIsPlaying(false);
      }
    });
    setIsPlaying(true);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      speechService.stop();
      setIsPlaying(false);
    } else {
      handlePlayCurrent(conceptIndex);
    }
  };

  const handleNextConcept = () => {
    if (conceptIndex < concepts.length - 1) {
      const nextIdx = conceptIndex + 1;
      setConceptIndex(nextIdx);
      if (isPlaying) {
        handlePlayCurrent(nextIdx);
      }
    }
  };

  const handlePrevConcept = () => {
    if (conceptIndex > 0) {
      const prevIdx = conceptIndex - 1;
      setConceptIndex(prevIdx);
      if (isPlaying) {
        handlePlayCurrent(prevIdx);
      }
    }
  };

  const handleCycleSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 0.75];
    const nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setSpeed(nextSpeed);
    speechService.setRate(nextSpeed);
    if (isPlaying) {
      // Restart current track with new speed
      handlePlayCurrent(conceptIndex);
    }
  };

  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      handlePlayCurrent(conceptIndex);
    } else {
      setIsMuted(true);
      speechService.stop();
      setIsPlaying(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 animate-slide-up">
      <div className="p-3.5 sm:px-5 rounded-2xl bg-slate-950/90 border border-indigo-500/30 backdrop-blur-xl shadow-2xl shadow-indigo-950/40 text-slate-100 flex items-center justify-between gap-3">
        {/* Left: Indicator & Track Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-600/30">
            <Headphones className="w-4 h-4" />
            {isPlaying && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider font-mono">
                Audio Overview • {conceptIndex + 1}/{concepts.length}
              </span>
              {isPlaying && (
                <div className="flex items-end gap-0.5 h-3 w-3.5">
                  <span className="w-0.5 bg-indigo-400 rounded-full animate-eq-1" />
                  <span className="w-0.5 bg-indigo-300 rounded-full animate-eq-2" />
                  <span className="w-0.5 bg-indigo-400 rounded-full animate-eq-3" />
                  <span className="w-0.5 bg-purple-300 rounded-full animate-eq-4" />
                </div>
              )}
            </div>

            <h4 className="text-xs font-bold text-white truncate font-display">
              {currentConcept?.title || session.title}
            </h4>
          </div>
        </div>

        {/* Center: Playback Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handlePrevConcept}
            disabled={conceptIndex === 0}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Previous Concept"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={handleTogglePlay}
            className="p-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-md shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title={isPlaying ? 'Pause Audio Overview' : 'Play Audio Overview'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 fill-white ml-0.5" />
            )}
          </button>

          <button
            onClick={handleNextConcept}
            disabled={conceptIndex === concepts.length - 1}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Next Concept"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Speed, Mute & Close */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleCycleSpeed}
            className="px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-[11px] font-mono font-bold text-indigo-300 transition-colors cursor-pointer"
            title="Toggle playback speed"
          >
            {speed}x
          </button>

          <button
            onClick={handleToggleMute}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {onClose && (
            <button
              onClick={() => {
                speechService.stop();
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white transition-colors ml-1 cursor-pointer"
              title="Close Audio Overview"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

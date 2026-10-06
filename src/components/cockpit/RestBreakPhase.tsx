import React, { useState, useEffect, useCallback } from 'react';
import { Coffee, ArrowRight, Eye, Droplets, Activity, Play, Pause } from 'lucide-react';
import { soundEngine } from '../../services/soundEngine';
import { StorageService } from '../../services/storageService';
import { lifeSimService } from '../../services/lifeSimService';
import { CharacterCompanion } from '../character/CharacterCompanion';

interface RestBreakPhaseProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const RestBreakPhase: React.FC<RestBreakPhaseProps> = ({ onComplete, onSkip }) => {
  const [secondsRemaining, setSecondsRemaining] = useState(180); // 3 minutes
  const [isActive, setIsActive] = useState(true);
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold (Full)' | 'Exhale' | 'Hold (Empty)'>('Inhale');
  const [breathCount, setBreathCount] = useState(4);

  const handleFinish = useCallback(() => {
    StorageService.addXP(30);
    lifeSimService.awardStudyWage('Micro-Rest Memory Replay', 15);
    onComplete();
  }, [onComplete]);

  // 180s countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining(prev => prev - 1);
      }, 1000);
    } else if (secondsRemaining === 0) {
      soundEngine.playCompletionChime();
      handleFinish();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, secondsRemaining, handleFinish]);

  // Box breathing 16s cycle (4-4-4-4)
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setBreathCount(prev => {
        if (prev > 1) return prev - 1;
        // switch phase
        setBreathPhase(curr => {
          if (curr === 'Inhale') return 'Hold (Full)';
          if (curr === 'Hold (Full)') return 'Exhale';
          if (curr === 'Exhale') return 'Hold (Empty)';
          return 'Inhale';
        });
        return 4;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-center animate-fadeIn py-2">
      
      {/* Header Banner */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/25 backdrop-blur-md">
        <div className="flex items-center gap-3 text-xs sm:text-sm text-emerald-300">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Coffee className="w-4 h-4" />
          </div>
          <div className="text-left">
            <div className="font-bold text-white font-display">Phase 4: Neuroscience Micro-Rest</div>
            <div className="text-[11px] text-emerald-300/80">
              Hippocampal sharp-wave ripples replay and consolidate memory during offline micro-rest.
            </div>
          </div>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0 font-mono">
          +15 🪙 Wage
        </span>
      </div>

      {/* Main Visualizer Stage */}
      <div className="p-8 sm:p-12 rounded-3xl glass-panel relative overflow-hidden flex flex-col items-center justify-center space-y-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Timer Display */}
        <div className="flex items-center gap-3">
          <div className="text-4xl sm:text-6xl font-mono font-black text-white tracking-wider">
            {timeFormatted}
          </div>
          <button
            onClick={() => setIsActive(!isActive)}
            className="p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-white/[0.1] hover:border-emerald-400/50 transition-colors shadow-lg"
            title={isActive ? 'Pause' : 'Resume'}
          >
            {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
        </div>

        {/* Multi-Ring Fluid Box Breathing Visualizer */}
        <div className="relative w-52 h-52 flex items-center justify-center my-4">
          {/* Outermost ambient aura ring */}
          <div
            className={`absolute inset-0 rounded-full border border-emerald-500/30 transition-transform duration-1000 ease-in-out ${
              breathPhase === 'Inhale'
                ? 'scale-125 bg-emerald-500/15'
                : breathPhase === 'Hold (Full)'
                ? 'scale-125 bg-emerald-500/20 ring-4 ring-emerald-500/20'
                : breathPhase === 'Exhale'
                ? 'scale-90 bg-emerald-500/5'
                : 'scale-90 bg-transparent'
            }`}
          />

          {/* Secondary inner ring */}
          <div
            className={`absolute inset-4 rounded-full border-2 border-emerald-400/50 transition-transform duration-1000 ease-in-out ${
              breathPhase === 'Inhale' || breathPhase === 'Hold (Full)'
                ? 'scale-110 bg-emerald-500/10'
                : 'scale-95 bg-transparent'
            }`}
          />
          
          {/* Inner core status orb */}
          <div className="z-10 flex flex-col items-center select-none">
            <Activity className="w-7 h-7 text-emerald-400 mb-1 animate-pulse" />
            <span className="text-lg font-bold text-white tracking-wide font-display">
              {breathPhase}
            </span>
            <span className="text-sm font-mono text-emerald-300 font-bold mt-1">
              {breathCount}s
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-400 max-w-md leading-relaxed font-sans">
          Follow the 4-4-4-4 Box Breathing cycle to trigger parasympathetic vagal stimulation and clear adenosine saturation in your prefrontal cortex.
        </p>

        {/* 20-20-20 & Ergonomic Health Checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left pt-5 border-t border-white/[0.08] text-xs text-slate-300">
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-white/[0.06]">
            <Eye className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Look at an object 20 feet away to relax ciliary eye muscles.</span>
          </div>
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-white/[0.06]">
            <Droplets className="w-5 h-5 text-cyan-400 shrink-0" />
            <span>Take a sip of water to optimize neurotransmitter electrolyte conduction.</span>
          </div>
        </div>

      </div>

      {/* 3D Character Rest Companion */}
      <div className="flex items-center justify-center">
        <CharacterCompanion 
          variant="card" 
          size="sm" 
          speech="Micro-rest is where your brain replays today's study memories at 10x speed. Relax your gaze and breathe." 
          className="max-w-md w-full !bg-emerald-950/20 !border-emerald-500/25"
        />
      </div>

      {/* Control Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <button
          onClick={onSkip}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors font-medium"
        >
          Skip Rest Break
        </button>

        <button
          onClick={handleFinish}
          className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2 group transition-all hover:scale-[1.02]"
        >
          <span>I am Refreshed — Continue Study Pilot</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

    </div>
  );
};

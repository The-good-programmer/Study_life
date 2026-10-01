import React, { useState, useEffect, useCallback } from 'react';
import { Coffee, ArrowRight, Eye, Droplets, Activity, Play, Pause } from 'lucide-react';
import { soundEngine } from '../../services/soundEngine';
import { StorageService } from '../../services/storageService';

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
    StorageService.addXP(30); // +30 XP for neuroscience rest break
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
    <div className="max-w-2xl mx-auto space-y-6 text-center animate-fadeIn">
      
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-900/50">
        <div className="flex items-center gap-2.5 text-xs sm:text-sm text-emerald-300">
          <Coffee className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Phase 4: Neuroscience Micro-Rest</strong> — The hippocampus consolidates during offline rest.
          </span>
        </div>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-emerald-900/60 text-emerald-200 border border-emerald-700/50">
          Consolidation Phase
        </span>
      </div>

      {/* Main Visualizer Card */}
      <div className="p-8 sm:p-12 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/20 border border-emerald-500/20 shadow-2xl flex flex-col items-center justify-center space-y-6">
        
        {/* Timer Display */}
        <div className="flex items-center gap-3">
          <div className="text-4xl sm:text-5xl font-mono font-bold text-white tracking-wider">
            {timeFormatted}
          </div>
          <button
            onClick={() => setIsActive(!isActive)}
            className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title={isActive ? 'Pause' : 'Resume'}
          >
            {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
        </div>

        {/* Box Breathing Visualizer */}
        <div className="relative w-48 h-48 flex items-center justify-center my-4">
          {/* Outer glowing pulsing circle */}
          <div
            className={`absolute inset-0 rounded-full border-2 border-emerald-500/40 transition-transform duration-1000 ease-in-out ${
              breathPhase === 'Inhale'
                ? 'scale-110 bg-emerald-500/10'
                : breathPhase === 'Hold (Full)'
                ? 'scale-110 bg-emerald-500/20'
                : breathPhase === 'Exhale'
                ? 'scale-85 bg-emerald-500/5'
                : 'scale-85 bg-transparent'
            }`}
          />
          
          {/* Inner focus sphere */}
          <div className="z-10 flex flex-col items-center">
            <Activity className="w-6 h-6 text-emerald-400 mb-1 animate-pulse" />
            <span className="text-base font-bold text-white tracking-wide">
              {breathPhase}
            </span>
            <span className="text-xs font-mono text-emerald-300 mt-0.5">
              {breathCount}s
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-400 max-w-sm">
          Follow the 4-4-4-4 Box Breathing pattern to trigger the parasympathetic nervous system and reset working memory.
        </p>

        {/* 20-20-20 & Health Checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left pt-4 border-t border-slate-800 text-xs text-slate-300">
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Look at an object 20 feet away to relax ciliary eye muscles.</span>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <Droplets className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Drink a sip of water to maintain neural conduction.</span>
          </div>
        </div>

      </div>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <button
          onClick={onSkip}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          Skip Rest Break
        </button>

        <button
          onClick={handleFinish}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 group transition-all"
        >
          <span>I am Refreshed — Continue Study</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

    </div>
  );
};

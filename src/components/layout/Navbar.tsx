import React, { useState } from 'react';
import { Brain, Flame, Clock, Layers, Volume2, VolumeX, Settings, Sparkles } from 'lucide-react';
import { soundEngine } from '../../services/soundEngine';
import type { SoundType } from '../../services/soundEngine';
import type { UserStats } from '../../types';

interface NavbarProps {
  stats: UserStats;
  onOpenSettings: () => void;
  onOpenDashboard?: () => void;
  onLogoClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ stats, onOpenSettings, onOpenDashboard, onLogoClick }) => {
  const [currentSound, setCurrentSound] = useState<SoundType>(soundEngine.getCurrentSound());
  const [soundMenuOpen, setSoundMenuOpen] = useState(false);
  const [volume, setVolume] = useState(soundEngine.getVolume());

  const handleSoundChange = (type: SoundType) => {
    soundEngine.play(type);
    setCurrentSound(type);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    soundEngine.setVolume(val);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div 
          onClick={onLogoClick}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white tracking-tight">Studify</span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Pilot
              </span>
            </div>
            <p className="text-xs text-slate-400">Zero-Friction Science Study</p>
          </div>
        </div>

        {/* Live Metrics & Quick Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          
          {/* Streak */}
          <div 
            title="Current Daily Study Streak"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-400 text-xs font-medium"
          >
            <Flame className="w-4 h-4 fill-amber-400 text-amber-500 animate-pulse" />
            <span>{stats.currentStreak}d Streak</span>
          </div>

          {/* Total Minutes */}
          <div 
            title="Total Study Minutes"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium"
          >
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>{stats.totalStudyMinutes}m</span>
          </div>

          {/* Cards Due / Dashboard Button */}
          {onOpenDashboard && (
            <button
              onClick={onOpenDashboard}
              title="Spaced Repetition Queue"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-emerald-400 text-xs font-medium transition-colors"
            >
              <Layers className="w-4 h-4" />
              <span>{stats.cardsDueCount} Due</span>
            </button>
          )}

          {/* Audio Engine Dropdown */}
          <div className="relative">
            <button
              onClick={() => setSoundMenuOpen(!soundMenuOpen)}
              className={`p-2 rounded-lg border transition-all ${
                currentSound !== 'off'
                  ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-md shadow-indigo-500/10'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Focus Soundscapes (40Hz Gamma, Brown Noise, Rain)"
            >
              {currentSound !== 'off' ? <Volume2 className="w-4 h-4 text-indigo-400" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {soundMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 p-3 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl z-50 text-xs text-slate-200">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    Neuro-Focus Audio
                  </span>
                  <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                    Web Audio
                  </span>
                </div>

                <div className="space-y-1.5 mb-3">
                  {[
                    { id: 'off', label: 'Mute / Silent' },
                    { id: 'binaural-40hz', label: '🧠 40Hz Gamma Binaural', desc: 'Working memory & focus' },
                    { id: 'brown-noise', label: '🌊 Brown Noise', desc: 'Masks external voices' },
                    { id: 'rain', label: '🌧️ Gentle Rain', desc: 'Calming alpha state' },
                    { id: 'ambient-drone', label: '🎵 Deep Drone Pad', desc: 'Deep meditative flow' },
                  ].map(sound => (
                    <button
                      key={sound.id}
                      onClick={() => handleSoundChange(sound.id as SoundType)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg flex flex-col transition-all ${
                        currentSound === sound.id
                          ? 'bg-indigo-600 text-white font-medium'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <span>{sound.label}</span>
                      {sound.desc && (
                        <span className={`text-[10px] ${currentSound === sound.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                          {sound.desc}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {currentSound !== 'off' && (
                  <div className="pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between mb-1 text-[11px] text-slate-400">
                      <span>Volume</span>
                      <span>{Math.round(volume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Settings & API Key"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};

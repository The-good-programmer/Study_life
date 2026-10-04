import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  Heart, 
  RotateCw, 
  Camera, 
  Volume2, 
  VolumeX, 
  Wind, 
  BookOpen, 
  Check, 
  Flame, 
  Download, 
  Edit3, 
  Smile, 
  Play
} from 'lucide-react';
import { 
  axolotlService, 
  SKIN_PALETTES, 
  ACCESSORIES_META, 
  ENVIRONMENTS_META, 
  TREATS_META, 
  NEURO_AXOLOTL_LORE,
  type AxolotlSkinId, 
  type AxolotlAccessoryId, 
  type AxolotlEnvironmentId,
  type AxolotlTreatType,
  type AxolotlState 
} from '../../services/axolotlService';
import { soundEngine } from '../../services/soundEngine';
import { StorageService } from '../../services/storageService';
import { Axolotl3DCanvas } from './Axolotl3DCanvas';
import type { StudySession } from '../../types';
import confetti from 'canvas-confetti';

interface AxolotlSanctuaryProps {
  onBack: () => void;
  onStartSession?: (session: StudySession) => void;
}

export const AxolotlSanctuary: React.FC<AxolotlSanctuaryProps> = ({
  onBack,
  onStartSession,
}) => {
  const [state, setState] = useState<AxolotlState>(axolotlService.getState());
  const [activeTab, setActiveTab] = useState<'care' | 'customize' | 'zen' | 'lore'>('care');
  const [customSubTab, setCustomSubTab] = useState<'skin' | 'accessory' | 'environment'>('skin');
  const [autoRotate, setAutoRotate] = useState(false);
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');
  const [breathSeconds, setBreathSeconds] = useState(4);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(state.name);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Subscribe to live state updates
  useEffect(() => {
    const unsub = axolotlService.subscribe((newState) => {
      setState(newState);
      setNameInput(newState.name);
    });
    return unsub;
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Breathing Guide Timer (4s Inhale, 4s Hold, 4s Exhale)
  useEffect(() => {
    if (!breathingActive) return;

    let secondsLeft = 4;
    let currentStep: 'Inhale' | 'Hold' | 'Exhale' = 'Inhale';
    setBreathPhase('Inhale');
    setBreathSeconds(4);

    const timer = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        if (currentStep === 'Inhale') {
          currentStep = 'Hold';
          secondsLeft = 4;
        } else if (currentStep === 'Hold') {
          currentStep = 'Exhale';
          secondsLeft = 4;
        } else {
          currentStep = 'Inhale';
          secondsLeft = 4;
        }
        setBreathPhase(currentStep);
      }
      setBreathSeconds(secondsLeft);
    }, 1000);

    return () => clearInterval(timer);
  }, [breathingActive]);

  // Handle Feeding
  const handleFeed = (treatType: AxolotlTreatType) => {
    // Dispatch 3D treat drop into the WebGL scene
    window.dispatchEvent(new CustomEvent('axolotl-feed', { detail: treatType }));
    const res = axolotlService.feed(treatType);

    showToast(`Fed ${TREATS_META[treatType].name}! +${res.xp} XP & +${TREATS_META[treatType].happinessGain} Happiness 🌟`);

    if (res.leveledUp) {
      try {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#38bdf8', '#f43f5e', '#a855f7'],
        });
      } catch {
        // fallback
      }
      showToast(`🎉 Friendship Leveled Up to Level ${state.friendshipLevel + 1}! New items unlocked!`);
    }
  };

  // Handle Petting
  const handlePet = () => {
    const res = axolotlService.pet();
    showToast(`Pet ${state.name}! Gained +5 Friendship XP ✨`);
    if (res.leveledUp) {
      showToast(`🎉 Friendship Leveled Up to Level ${state.friendshipLevel + 1}!`);
    }
  };

  // Handle Trick
  const handleTrick = () => {
    window.dispatchEvent(new CustomEvent('axolotl-trick'));
    const res = axolotlService.doTrick();
    showToast(`🎪 ${state.name} performed a ${res.trickName}!`);
  };

  // Handle Snapshot
  const handleTakeSnapshot = () => {
    window.dispatchEvent(
      new CustomEvent('axolotl-snapshot', {
        detail: {
          callback: (url: string) => {
            setSnapshotUrl(url);
            showToast('📸 3D Portrait Captured! Ready to download.');
          },
        },
      })
    );
  };

  const handleDownloadSnapshot = () => {
    if (!snapshotUrl) return;
    const a = document.createElement('a');
    a.href = snapshotUrl;
    a.download = `${state.name.toLowerCase()}-3d-avatar.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSaveName = () => {
    if (nameInput.trim()) {
      axolotlService.updateName(nameInput.trim());
      setIsEditingName(false);
      showToast(`Renamed to "${nameInput.trim()}"!`);
    }
  };

  // Audio Ambience
  const currentSound = soundEngine.getCurrentSound();
  const isAudioActive = currentSound !== 'off';

  const toggleAquaticAudio = () => {
    if (isAudioActive) {
      soundEngine.play('off');
    } else {
      soundEngine.play('ambient-drone');
    }
  };

  // Find a deck to study if user clicks study
  const handleStartStudy = () => {
    const sessions = StorageService.getSessions();
    if (sessions.length > 0 && onStartSession) {
      onStartSession(sessions[0]);
    } else {
      onBack();
    }
  };

  const currentPalette = SKIN_PALETTES[state.skin];
  const currentEnv = ENVIRONMENTS_META[state.environment];

  const requiredFriendshipXP = state.friendshipLevel * 50;
  const friendshipPercent = Math.min(100, Math.round((state.friendshipXP / requiredFriendshipXP) * 100));

  return (
    <div className="flex flex-col min-h-[calc(100vh-5rem)] w-full max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn pb-12">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-pink-500/40 text-pink-200 text-xs sm:text-sm font-semibold shadow-2xl backdrop-blur-xl flex items-center gap-2.5 animate-bounce">
          <Sparkles className="w-4 h-4 text-pink-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Snapshot Modal */}
      {snapshotUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/[0.1] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-center">
            <h3 className="text-lg font-black text-white font-display flex items-center justify-center gap-2">
              <Camera className="w-5 h-5 text-pink-400" />
              <span>3D Axolotl Portrait</span>
            </h3>
            <div className="w-64 h-64 mx-auto rounded-2xl overflow-hidden bg-slate-950 border border-pink-500/30 p-1 shadow-inner flex items-center justify-center">
              <img src={snapshotUrl} alt="3D Axolotl Portrait" className="w-full h-full object-contain rounded-xl" />
            </div>
            <p className="text-xs text-slate-400">
              High-resolution render of {state.name} with your chosen skin & accessories.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadSnapshot}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download PNG</span>
              </button>
              <button
                onClick={() => setSnapshotUrl(null)}
                className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-slate-300 text-xs font-semibold cursor-pointer transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-white/[0.08] backdrop-blur-xl shadow-xl">
        
        {/* Left: Back button & Mascot Status */}
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm"
            title="Return to Main Studio"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    maxLength={20}
                    className="px-2.5 py-1 text-sm font-bold bg-slate-950 border border-pink-500 rounded-lg text-white focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    className="p-1 rounded-md bg-pink-500 text-white text-xs hover:bg-pink-600"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight">
                    {state.name}'s <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-400">3D Sanctuary</span>
                  </h1>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="text-slate-400 hover:text-pink-300 transition-colors p-1"
                    title="Rename Axolotl"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                3D Living Creature
              </span>
            </div>

            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Biome: <strong className="text-slate-200">{currentEnv.name}</strong></span>
              <span>•</span>
              <span>Skin: <strong className="text-pink-300">{currentPalette.name}</strong></span>
            </p>
          </div>
        </div>

        {/* Right: Friendship & Care Meters + Quick Tools */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          
          {/* Friendship Meter */}
          <div className="px-3 py-1.5 rounded-2xl bg-slate-950/70 border border-white/[0.08] flex items-center gap-2.5 text-xs">
            <div className="w-7 h-7 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400 font-bold text-xs">
              <Heart className="w-4 h-4 fill-pink-400 text-pink-400" />
            </div>
            <div>
              <div className="flex items-center justify-between text-[11px] gap-2">
                <span className="font-bold text-white">Friendship Lvl {state.friendshipLevel}</span>
                <span className="text-slate-400 font-mono text-[10px]">{state.friendshipXP}/{requiredFriendshipXP} XP</span>
              </div>
              <div className="w-24 sm:w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                <div 
                  className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${friendshipPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Tool: 3D Snapshot */}
          <button
            onClick={handleTakeSnapshot}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 text-xs font-semibold cursor-pointer transition-all shadow-sm"
            title="Take a high-res 3D portrait screenshot"
          >
            <Camera className="w-4 h-4 text-pink-400" />
            <span className="hidden sm:inline">Snapshot</span>
          </button>

          {/* Quick Tool: Ambient Sound Toggle */}
          <button
            onClick={toggleAquaticAudio}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-xs font-semibold cursor-pointer transition-all shadow-sm ${
              isAudioActive 
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200' 
                : 'bg-white/[0.06] hover:bg-white/[0.1] border-white/[0.08] text-slate-300'
            }`}
            title="Toggle aquatic hydro-ambient focus soundscape"
          >
            {isAudioActive ? <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            <span className="hidden sm:inline">{isAudioActive ? 'Soundscape' : 'Mute'}</span>
          </button>

          {/* Quick Tool: Study with Axolotl */}
          <button
            onClick={handleStartStudy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 cursor-pointer transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Study with {state.name}</span>
          </button>
        </div>
      </div>

      {/* 2. Main 3D Stage & Interactive Habitat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        
        {/* Center / Left 3D Viewport Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          
          <div className="relative w-full h-[380px] sm:h-[460px] md:h-[520px] rounded-3xl overflow-hidden bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 border border-white/[0.1] shadow-2xl">
            
            {/* 3D WebGL Canvas Component */}
            <Axolotl3DCanvas
              skin={state.skin}
              accessory={state.accessory}
              environment={state.environment}
              mood={state.mood}
              interactive={true}
              enableOrbit={true}
              autoRotate={autoRotate}
              breathingGuide={breathingActive}
              className="w-full h-full"
              onPet={handlePet}
            />

            {/* Top-Left Habitat Mood Indicator */}
            <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-none">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-950/80 border border-white/[0.1] text-pink-300 backdrop-blur-md shadow-lg flex items-center gap-1.5">
                <Smile className="w-3.5 h-3.5 text-pink-400" />
                <span className="capitalize">{state.name} is {state.mood}</span>
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-950/80 border border-white/[0.1] text-cyan-300 backdrop-blur-md shadow-lg flex items-center gap-1">
                <Flame className="w-3 h-3 text-cyan-400" />
                <span>Happy: {state.happiness}%</span>
              </span>
            </div>

            {/* Top-Right Floating Controls (Auto-Rotate, Trick) */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAutoRotate(prev => !prev)}
                className={`p-2.5 rounded-2xl border text-xs font-semibold backdrop-blur-md transition-all cursor-pointer shadow-lg ${
                  autoRotate 
                    ? 'bg-pink-500/25 border-pink-500/40 text-pink-200' 
                    : 'bg-slate-950/80 hover:bg-slate-900/90 border-white/[0.1] text-slate-300'
                }`}
                title="Toggle 360° Continuous Orbit Rotation"
              >
                <RotateCw className={`w-4 h-4 ${autoRotate ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleTrick}
                className="px-3 py-2 rounded-2xl bg-gradient-to-r from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30 border border-pink-500/30 text-pink-300 text-xs font-bold backdrop-blur-md transition-all cursor-pointer shadow-lg flex items-center gap-1.5"
                title="Command Lottie to do a barrel roll & fin wave"
              >
                <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                <span>Do a Trick!</span>
              </button>
            </div>

            {/* Bottom Floating Interaction Dock */}
            <div className="absolute bottom-4 inset-x-4 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-950/85 border border-white/[0.1] backdrop-blur-xl shadow-2xl">
              
              {/* Pet Action */}
              <button
                type="button"
                onClick={handlePet}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/30 text-pink-200 text-xs font-bold transition-all cursor-pointer"
              >
                <Heart className="w-3.5 h-3.5 fill-pink-400 text-pink-400" />
                <span>Pet {state.name}</span>
              </button>

              {/* Feeding Treats Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                {(Object.keys(TREATS_META) as AxolotlTreatType[]).map((type) => {
                  const treat = TREATS_META[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleFeed(type)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs text-slate-200 hover:text-white transition-all cursor-pointer whitespace-nowrap"
                      title={`${treat.name}: ${treat.description} (+${treat.xpReward} XP)`}
                    >
                      <span className="text-sm">{treat.emoji}</span>
                      <span className="hidden sm:inline font-medium text-[11px]">{treat.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>

              {/* Zen Breathing Mode Toggle */}
              <button
                type="button"
                onClick={() => setBreathingActive(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  breathingActive 
                    ? 'bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 shadow-md' 
                    : 'bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300'
                }`}
              >
                <Wind className="w-3.5 h-3.5 text-cyan-400" />
                <span>{breathingActive ? 'Zen Active' : 'Zen Breath'}</span>
              </button>
            </div>

            {/* Breathing Guide HUD Overlay */}
            {breathingActive && (
              <div className="absolute top-16 inset-x-0 flex flex-col items-center justify-center pointer-events-none space-y-1">
                <div className="px-5 py-2 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-200 text-sm font-black uppercase tracking-widest backdrop-blur-md shadow-2xl flex items-center gap-2">
                  <Wind className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span>{breathPhase} ({breathSeconds}s)</span>
                </div>
                <p className="text-[11px] text-cyan-300 font-semibold bg-slate-950/60 px-3 py-0.5 rounded-full">
                  Breathe in rhythm with {state.name}'s floating body
                </p>
              </div>
            )}
          </div>

          {/* Quick Biology Nugget Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-indigo-500/10 border border-pink-500/20 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🧠</span>
              <p className="text-slate-300 text-[11px] sm:text-xs">
                <strong className="text-pink-300 font-semibold">Did you know?</strong> Axolotls can regenerate full sections of their brain without any scars. Every active recall rep you perform physically rewires your dendrites!
              </p>
            </div>
            <button
              onClick={() => setActiveTab('lore')}
              className="text-pink-400 hover:text-pink-300 font-bold shrink-0 text-[11px] underline cursor-pointer"
            >
              Learn More →
            </button>
          </div>
        </div>

        {/* Right Tabbed Control Center Column (4 cols) */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          
          {/* Tabs Selector */}
          <div className="grid grid-cols-4 p-1 rounded-2xl bg-slate-900/90 border border-white/[0.08] shadow-inner text-xs font-bold text-center">
            <button
              onClick={() => setActiveTab('care')}
              className={`py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'care'
                  ? 'bg-pink-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Care
            </button>
            <button
              onClick={() => setActiveTab('customize')}
              className={`py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'customize'
                  ? 'bg-pink-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Outfits
            </button>
            <button
              onClick={() => setActiveTab('zen')}
              className={`py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'zen'
                  ? 'bg-pink-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Zen
            </button>
            <button
              onClick={() => setActiveTab('lore')}
              className={`py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'lore'
                  ? 'bg-pink-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Lore
            </button>
          </div>

          {/* TAB 1: CARE & FEEDING */}
          {activeTab === 'care' && (
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-white/[0.08] backdrop-blur-xl shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
                <span>Nourish & Bond</span>
                <span className="text-[10px] text-pink-300 font-mono">Level {state.friendshipLevel}</span>
              </h3>

              {/* Status Meters */}
              <div className="space-y-3 p-3 rounded-2xl bg-slate-950/60 border border-white/[0.06]">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400" />
                      <span>Happiness</span>
                    </span>
                    <span className="text-pink-300 font-mono">{state.happiness}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-pink-500 to-rose-400 transition-all duration-300" style={{ width: `${state.happiness}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span>Hunger / Satiation</span>
                    </span>
                    <span className="text-amber-300 font-mono">{state.hunger}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-300" style={{ width: `${state.hunger}%` }} />
                  </div>
                </div>
              </div>

              {/* Treats Selection List */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Available Treats</span>
                <div className="space-y-2">
                  {(Object.keys(TREATS_META) as AxolotlTreatType[]).map((type) => {
                    const treat = TREATS_META[type];
                    return (
                      <div
                        key={type}
                        onClick={() => handleFeed(type)}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-pink-500/40 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl p-1.5 rounded-xl bg-slate-950/80 group-hover:scale-110 transition-transform">
                            {treat.emoji}
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-white group-hover:text-pink-300 transition-colors">
                              {treat.name}
                            </h4>
                            <p className="text-[10px] text-slate-400">{treat.description}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-mono">
                            +{treat.xpReward} XP
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Stats */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06] text-center text-xs">
                <div className="p-2 rounded-xl bg-slate-950/40">
                  <span className="block text-slate-400 text-[10px]">Total Pets</span>
                  <strong className="text-white text-sm font-mono">{state.totalPets}</strong>
                </div>
                <div className="p-2 rounded-xl bg-slate-950/40">
                  <span className="block text-slate-400 text-[10px]">Treats Fed</span>
                  <strong className="text-white text-sm font-mono">{state.totalTreatsFed}</strong>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOMIZE & OUTFITS */}
          {activeTab === 'customize' && (
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-white/[0.08] backdrop-blur-xl shadow-xl space-y-4">
              {/* Subtabs: Skin, Accessory, Environment */}
              <div className="flex p-1 rounded-xl bg-slate-950/60 text-xs font-semibold">
                <button
                  onClick={() => setCustomSubTab('skin')}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    customSubTab === 'skin' ? 'bg-pink-500 text-white' : 'text-slate-400'
                  }`}
                >
                  Skins
                </button>
                <button
                  onClick={() => setCustomSubTab('accessory')}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    customSubTab === 'accessory' ? 'bg-pink-500 text-white' : 'text-slate-400'
                  }`}
                >
                  Items
                </button>
                <button
                  onClick={() => setCustomSubTab('environment')}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    customSubTab === 'environment' ? 'bg-pink-500 text-white' : 'text-slate-400'
                  }`}
                >
                  Biomes
                </button>
              </div>

              {/* Subtab Content: SKINS */}
              {customSubTab === 'skin' && (
                <div className="space-y-2.5">
                  {(Object.keys(SKIN_PALETTES) as AxolotlSkinId[]).map((skinId) => {
                    const pal = SKIN_PALETTES[skinId];
                    const isSelected = state.skin === skinId;
                    const isUnlocked = state.unlockedSkins.includes(skinId);

                    return (
                      <div
                        key={skinId}
                        onClick={() => {
                          if (isUnlocked) axolotlService.setSkin(skinId);
                        }}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-pink-500/20 border-pink-500 shadow-md shadow-pink-500/10'
                            : isUnlocked
                            ? 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08]'
                            : 'bg-slate-950/40 border-white/[0.04] opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-7 h-7 rounded-xl border-2 border-white/20 shadow-md shrink-0"
                            style={{ backgroundColor: pal.bodyColor }}
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-white">{pal.name}</h4>
                              {isSelected && <Check className="w-3.5 h-3.5 text-pink-400" />}
                            </div>
                            <p className="text-[10px] text-slate-400">{pal.subtitle}</p>
                          </div>
                        </div>

                        {!isUnlocked && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                            Lvl 3
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Subtab Content: ACCESSORIES */}
              {customSubTab === 'accessory' && (
                <div className="space-y-2.5">
                  {(Object.keys(ACCESSORIES_META) as AxolotlAccessoryId[]).map((accId) => {
                    const acc = ACCESSORIES_META[accId];
                    const isSelected = state.accessory === accId;
                    const isUnlocked = state.unlockedAccessories.includes(accId);

                    return (
                      <div
                        key={accId}
                        onClick={() => {
                          if (isUnlocked) axolotlService.setAccessory(accId);
                        }}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-pink-500/20 border-pink-500 shadow-md shadow-pink-500/10'
                            : isUnlocked
                            ? 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08]'
                            : 'bg-slate-950/40 border-white/[0.04] opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl p-1 rounded-xl bg-slate-950/60">{acc.icon}</span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-white">{acc.name}</h4>
                              {isSelected && <Check className="w-3.5 h-3.5 text-pink-400" />}
                            </div>
                            <p className="text-[10px] text-slate-400">{acc.description}</p>
                          </div>
                        </div>

                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          acc.rarity === 'Legendary' ? 'bg-amber-500/20 text-amber-300' :
                          acc.rarity === 'Epic' ? 'bg-purple-500/20 text-purple-300' :
                          acc.rarity === 'Rare' ? 'bg-cyan-500/20 text-cyan-300' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {acc.rarity}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Subtab Content: ENVIRONMENTS */}
              {customSubTab === 'environment' && (
                <div className="space-y-2.5">
                  {(Object.keys(ENVIRONMENTS_META) as AxolotlEnvironmentId[]).map((envId) => {
                    const eMeta = ENVIRONMENTS_META[envId];
                    const isSelected = state.environment === envId;

                    return (
                      <div
                        key={envId}
                        onClick={() => axolotlService.setEnvironment(envId)}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-pink-500/20 border-pink-500 shadow-md shadow-pink-500/10'
                            : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl p-1 rounded-xl bg-slate-950/60">{eMeta.icon}</span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-white">{eMeta.name}</h4>
                              {isSelected && <Check className="w-3.5 h-3.5 text-pink-400" />}
                            </div>
                            <p className="text-[10px] text-slate-400">{eMeta.subtitle}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ZEN MINDFULNESS */}
          {activeTab === 'zen' && (
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-white/[0.08] backdrop-blur-xl shadow-xl space-y-4 text-center">
              <div className="w-14 h-14 mx-auto rounded-3xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Wind className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-white font-display">Parasympathetic Reset</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Synchronize your breathing with {state.name} to lower pre-exam cortisol and stimulate deep cortical flow.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-cyan-500/30 space-y-2">
                <div className="text-2xl font-black text-cyan-300 font-display">
                  {breathingActive ? `${breathPhase} (${breathSeconds}s)` : 'Ready'}
                </div>
                <p className="text-[11px] text-slate-400">
                  4s Inhale • 4s Hold • 4s Exhale Box Breathing
                </p>
              </div>

              <button
                type="button"
                onClick={() => setBreathingActive(prev => !prev)}
                className={`w-full py-3 rounded-2xl font-bold text-xs shadow-lg transition-all cursor-pointer ${
                  breathingActive
                    ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30'
                    : 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-cyan-500/20'
                }`}
              >
                {breathingActive ? 'Stop Session' : 'Begin 4-7-8 Breathing Guide'}
              </button>
            </div>
          )}

          {/* TAB 4: NEUROBIOLOGY LORE */}
          {activeTab === 'lore' && (
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-white/[0.08] backdrop-blur-xl shadow-xl space-y-3 max-h-[480px] overflow-y-auto">
              <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-pink-400" />
                <span>The Neurobiology of {state.name}</span>
              </h3>

              <div className="space-y-3">
                {NEURO_AXOLOTL_LORE.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1.5">
                    <h4 className="text-xs font-bold text-pink-300">{item.title}</h4>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{item.text}</p>
                    <div className="p-2 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-[10px] text-indigo-300 flex items-start gap-1.5">
                      <Sparkles className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                      <span>{item.studyTieIn}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AxolotlSanctuary;

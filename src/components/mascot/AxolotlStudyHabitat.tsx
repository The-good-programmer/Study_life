import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Heart, 
  Wind, 
  BookOpen, 
  Edit3, 
  Smile, 
  Play, 
  Layers, 
  Zap, 
  Plus, 
  Search, 
  Maximize2, 
  Minimize2, 
  X, 
  Check, 
  TrendingUp, 
  Headphones, 
  Shuffle, 
  Award, 
  Utensils, 
  Sun, 
  CloudSun, 
  Moon 
} from 'lucide-react';
import { 
  axolotlService, 
  SKIN_PALETTES, 
  ACCESSORIES_META, 
  ENVIRONMENTS_META, 
  TREATS_META, 
  type AxolotlSkinId, 
  type AxolotlAccessoryId, 
  type AxolotlEnvironmentId,
  type AxolotlTreatType,
  type AxolotlState 
} from '../../services/axolotlService';
import { StorageService } from '../../services/storageService';
import { ExpressiveAxolotl } from './ExpressiveAxolotl';
import { CampusCafeteriaModal } from '../lifesim/CampusCafeteriaModal';
import { DailyLedgerWidget } from '../lifesim/DailyLedgerWidget';
import { lifeSimService, CAFETERIA_MENU, LIFESTYLE_TIERS } from '../../services/lifeSimService';
import { type DailyLedger, type LifestyleTier } from '../../types/lifeSim';
import type { StudySession } from '../../types';
import confetti from 'canvas-confetti';

export interface AxolotlStudyHabitatProps {
  onStartSession: (session: StudySession) => void;
  onOpenDeckStation: (session: StudySession) => void;
  onStartMatch: (session: StudySession) => void;
  onStartAudioBriefing?: (session: StudySession) => void;
  onOpenExam?: () => void;
  onOpenInterleaving?: () => void;
  onOpenDeckStudio: () => void;
  onOpenStarterCatalog: () => void;
  onOpenDashboard: () => void;
}

export const AxolotlStudyHabitat: React.FC<AxolotlStudyHabitatProps> = ({
  onStartSession,
  onOpenDeckStation,
  onStartMatch,
  onStartAudioBriefing,
  onOpenExam,
  onOpenInterleaving,
  onOpenDeckStudio,
  onOpenStarterCatalog,
  onOpenDashboard,
}) => {
  const [state, setState] = useState<AxolotlState>(axolotlService.getState());
  const [isZenMode, setIsZenMode] = useState(false);
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');
  const [breathSeconds, setBreathSeconds] = useState(4);
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [wardrobeTab, setWardrobeTab] = useState<'skin' | 'accessory' | 'biome'>('skin');
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(state.name);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCafeteriaOpen, setIsCafeteriaOpen] = useState(false);
  const [dailyLedger, setDailyLedger] = useState<DailyLedger>(lifeSimService.getDailyLedger());
  const [lifestyleTier, setLifestyleTier] = useState<LifestyleTier>(lifeSimService.getLifestyleTier());

  // Subscribe to live state updates
  useEffect(() => {
    const unsub = axolotlService.subscribe((newState) => {
      setState(newState);
      setNameInput(newState.name);
    });
    const unsubLife = lifeSimService.subscribe(() => {
      setDailyLedger(lifeSimService.getDailyLedger());
      setLifestyleTier(lifeSimService.getLifestyleTier());
    });
    return () => {
      unsub();
      unsubLife();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Saved decks & due cards from StorageService
  const savedSessions = StorageService.getSessions();
  const dueCards = StorageService.getDueCards();
  const stats = StorageService.getStats();

  // Filtered decks for drawer
  const filteredDecks = useMemo(() => {
    if (!librarySearch.trim()) return savedSessions;
    const q = librarySearch.toLowerCase();
    return savedSessions.filter(s => s.title.toLowerCase().includes(q));
  }, [savedSessions, librarySearch]);

  // Breathing Guide Timer (4s Inhale, 4s Hold, 4s Exhale)
  useEffect(() => {
    if (!breathingActive) return;

    let secondsLeft = 4;
    let currentStep: 'Inhale' | 'Hold' | 'Exhale' = 'Inhale';

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
    const currentCount = state.treatInventory?.[treatType] || 0;
    if (currentCount <= 0) {
      showToast(`Out of ${TREATS_META[treatType].name}! Review cards to earn more 🦐`);
      return;
    }

    // Dispatch 3D treat drop into the WebGL scene
    window.dispatchEvent(new CustomEvent('axolotl-feed', { detail: treatType }));
    const res = axolotlService.feed(treatType);

    showToast(`Fed ${TREATS_META[treatType].name}! +${res.xp} Friendship XP & +${TREATS_META[treatType].happinessGain} Happiness 🌟`);

    if (res.leveledUp) {
      try {
        confetti({
          particleCount: 50,
          spread: 70,
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

  // Launch Quick Study for due cards or default deck
  const handleLaunchQuickStudy = () => {
    if (savedSessions.length === 0) {
      onOpenStarterCatalog();
      return;
    }

    if (dueCards.length > 0) {
      const targetDeck = savedSessions.find(s => 
        s.concepts.some(cp => (cp.retrievalCards || []).some(rc => dueCards.some(dc => dc.id === rc.id)))
      ) || savedSessions[0];
      onStartSession(targetDeck);
    } else {
      onStartSession(savedSessions[0]);
    }
  };

  const requiredXP = state.friendshipLevel * 50;
  const xpPercent = Math.min(100, Math.round((state.friendshipXP / requiredXP) * 100));
  const totalTreatCount = Object.values(state.treatInventory || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="relative w-full space-y-4 animate-fadeIn">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-pink-500/40 text-pink-200 text-xs sm:text-sm font-semibold shadow-2xl backdrop-blur-xl animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Main Living 2D Student Sanctuary & Habitat Stage */}
      <div className={`relative w-full rounded-3xl overflow-hidden border border-white/[0.1] shadow-2xl transition-all duration-700 ${
        isZenMode ? 'h-[85vh] sm:h-[90vh]' : 'h-[540px] sm:h-[620px] lg:h-[680px]'
      } ${
        new Date().getHours() >= 6 && new Date().getHours() < 12
          ? 'bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950'
          : new Date().getHours() >= 12 && new Date().getHours() < 18
            ? 'bg-gradient-to-b from-sky-950/40 via-slate-900 to-slate-950'
            : 'bg-gradient-to-b from-indigo-950/50 via-slate-950 to-slate-950'
      }`}>
        
        {/* Ambient Glows & Atmosphere Grid */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-cyan-500/10 blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px]" />
        </div>

        {/* --- TOP HUD BAR --- */}
        <div className={`absolute top-3 sm:top-4 inset-x-3 sm:inset-x-5 flex items-center justify-between pointer-events-none transition-opacity duration-300 z-20 ${
          isZenMode ? 'opacity-0 hover:opacity-100 pointer-events-auto' : 'opacity-100'
        }`}>
          {/* Pet Status & Progression Card */}
          <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 pr-3 sm:pr-4 rounded-2xl bg-slate-950/85 hover:bg-slate-950/95 border border-white/[0.1] backdrop-blur-xl shadow-xl transition-all">
            <div 
              onClick={handlePet}
              className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-xl overflow-hidden p-0.5 bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 cursor-pointer shadow-md shadow-pink-500/20 hover:scale-105 transition-transform"
              title="Click to pet Lottie!"
            >
              <img src="/lottie.png" alt={state.name} className="w-full h-full object-cover rounded-[10px]" />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                {isEditingName ? (
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onBlur={() => {
                      axolotlService.updateName(nameInput);
                      setIsEditingName(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        axolotlService.updateName(nameInput);
                        setIsEditingName(false);
                      }
                    }}
                    autoFocus
                    className="w-24 px-1.5 py-0.5 rounded bg-slate-800 text-white text-xs font-bold border border-pink-500/40 outline-none"
                  />
                ) : (
                  <span 
                    onClick={() => setIsEditingName(true)}
                    className="font-extrabold text-xs sm:text-sm text-white font-display cursor-pointer hover:text-pink-300 flex items-center gap-1"
                    title="Click to rename your companion"
                  >
                    {state.name}
                    <Edit3 className="w-2.5 h-2.5 text-slate-400" />
                  </span>
                )}
                <span className="px-1.5 py-0.2 rounded-full text-[11px] font-black uppercase tracking-wider bg-pink-500/20 text-pink-300 border border-pink-500/30">
                  Lvl {state.friendshipLevel}
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.2 rounded-full text-[11px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 font-mono">
                  {state.evolutionStage}
                </span>
              </div>

              {/* Friendship XP Progress Bar */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-20 sm:w-28 h-1.5 bg-slate-800/90 rounded-full overflow-hidden border border-white/[0.05]">
                  <div 
                    className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 transition-all duration-300"
                    style={{ width: `${xpPercent}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {state.friendshipXP}/{requiredXP}
                </span>
              </div>
            </div>
          </div>

          {/* Right Top Controls: Cafeteria, Currency, Zen Mode, Wardrobe */}
          <div className="pointer-events-auto flex items-center gap-2">
            {/* Campus Cafeteria Button */}
            <button
              type="button"
              onClick={() => setIsCafeteriaOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-purple-500/20 hover:from-amber-500/30 hover:to-pink-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold backdrop-blur-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5 hover:scale-105"
              title="Open Campus Cafeteria — Buy Meals with Study Wages"
            >
              <Utensils className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Cafeteria</span>
              <span className="text-xs">🍳</span>
            </button>

            {/* Coins Badge */}
            <div 
              title="Axon Study Coins — Earned by reviewing cards & studying"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-slate-950/85 border border-white/[0.1] text-amber-300 text-xs font-bold backdrop-blur-xl shadow-lg"
            >
              <span className="text-amber-400">🪙</span>
              <span>{state.axonCoins || 0}</span>
            </div>

            {/* Treat Pouch Badge */}
            <div 
              title="Treats in Pouch — Feed Lottie to boost happiness and friendship level"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-slate-950/85 border border-white/[0.1] text-pink-300 text-xs font-bold backdrop-blur-xl shadow-lg"
            >
              <span>🦐</span>
              <span>{totalTreatCount} Treats</span>
            </div>

            {/* Wardrobe & Biomes Trigger */}
            <button
              type="button"
              onClick={() => setIsWardrobeOpen(true)}
              className="p-2 sm:px-3 sm:py-1.5 rounded-2xl bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-cyan-500/20 hover:from-pink-500/30 hover:to-cyan-500/30 border border-pink-500/40 text-pink-200 text-xs font-bold backdrop-blur-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5 hover:scale-105"
              title="Customize Skins, Outfits & Biomes"
            >
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span className="hidden sm:inline">Style</span>
            </button>

            {/* 1-Click Zen Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsZenMode(prev => !prev)}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-2xl border text-xs font-bold backdrop-blur-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                isZenMode 
                  ? 'bg-cyan-500/30 border-cyan-400/50 text-cyan-200' 
                  : 'bg-slate-950/85 hover:bg-slate-900 border-white/[0.1] text-slate-300 hover:text-white'
              }`}
              title={isZenMode ? "Exit Zen Mode (Show Study HUD)" : "Zen Aquarium Mode (Hide HUD for pure immersion)"}
            >
              {isZenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{isZenMode ? "Exit Zen" : "Zen Mode"}</span>
            </button>
          </div>
        </div>

        {/* --- 2D LIVING SANCTUARY & STUDY DESK (Center Stage) --- */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none px-4 pt-10 pb-28">
          
          {/* Time of Day & Lifestyle Atmosphere Badge */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/75 border border-white/[0.08] backdrop-blur-md text-[11px] font-semibold text-slate-300 mb-3 shadow-lg">
            {new Date().getHours() >= 6 && new Date().getHours() < 12 ? (
              <span className="flex items-center gap-1 text-amber-300"><Sun className="w-3.5 h-3.5" /> Morning Shift</span>
            ) : new Date().getHours() >= 12 && new Date().getHours() < 18 ? (
              <span className="flex items-center gap-1 text-sky-300"><CloudSun className="w-3.5 h-3.5" /> Campus Afternoon</span>
            ) : (
              <span className="flex items-center gap-1 text-purple-300"><Moon className="w-3.5 h-3.5" /> Night Focus</span>
            )}
            <span className="text-slate-600">•</span>
            <span className="text-indigo-300 font-bold">{LIFESTYLE_TIERS[lifestyleTier].title}</span>
            <span className="text-slate-600">•</span>
            <span className={`font-mono font-bold ${dailyLedger.netBalance >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              Net: {dailyLedger.netBalance >= 0 ? `+${dailyLedger.netBalance}` : dailyLedger.netBalance} 🪙
            </span>
          </div>

          {/* The Living Companion Stage */}
          <div 
            className="relative pointer-events-auto cursor-pointer group flex flex-col items-center" 
            onClick={handlePet}
            title={`Pet ${state.name}!`}
          >
            {/* Breathing Guide Focus Halo */}
            {breathingActive && (
              <div className={`absolute -inset-10 rounded-full border-2 border-cyan-400/60 transition-all duration-1000 ${
                breathPhase === 'Inhale' 
                  ? 'scale-125 bg-cyan-500/10' 
                  : breathPhase === 'Hold' 
                    ? 'scale-110 bg-cyan-500/20' 
                    : 'scale-90 bg-transparent'
              }`} />
            )}

            {/* Ambient Companion Aura */}
            <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-pink-500/20 via-purple-500/20 to-cyan-400/20 blur-xl group-hover:blur-2xl transition-all" />

            {/* 2D Expressive Mascot */}
            <div className="relative z-10 transform group-hover:scale-105 transition-transform duration-300">
              <ExpressiveAxolotl
                size="xl"
                mood={state.mood as any}
                accessory={state.accessory === 'none' ? 'none' : (state.accessory as any)}
                animated={true}
              />
            </div>

            {/* Interactive Speech & Pet Tag */}
            <div className="mt-2 px-3 py-1 rounded-full bg-slate-950/85 border border-pink-500/30 text-[11px] font-bold text-pink-200 flex items-center gap-1.5 shadow-lg group-hover:border-pink-500/60 transition-all">
              <Heart className="w-3 h-3 text-pink-400 fill-pink-400 animate-pulse" />
              <span>Pet {state.name} (+5 XP)</span>
            </div>
          </div>

          {/* The Cozy Student Desk / Biome Surface */}
          <div className="w-full max-w-lg mt-3 p-3 rounded-2xl bg-slate-950/80 border border-white/[0.1] backdrop-blur-xl shadow-xl flex items-center justify-between gap-3 pointer-events-auto">
            
            {/* Left: Meal / Fuel Tray */}
            {(() => {
              const todayMeal = CAFETERIA_MENU.find(m => m.id === (dailyLedger.breakfastId || dailyLedger.lunchId)) || dailyLedger.expenses[0];
              return (
                <div 
                  onClick={() => setIsCafeteriaOpen(true)}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all cursor-pointer flex-1 min-w-0"
                  title="Click to visit Cafeteria & order meals"
                >
                  <span className="text-2xl p-1 rounded-lg bg-white/[0.05] shrink-0">
                    {todayMeal ? todayMeal.emoji : '🥪'}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-slate-400 leading-tight">Daily Sustenance</span>
                    <span className="text-xs font-extrabold text-white truncate">
                      {todayMeal ? todayMeal.name : 'Choose Today’s Fuel'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Right: Lifestyle Decor & Perks */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 shrink-0">
              {lifestyleTier === 'scholar' ? (
                <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-200" title="Dean's List Penthouse: +10% Study Wage">
                  <span className="animate-spin">📻</span>
                  <span className="hidden sm:inline">Vinyl Station</span>
                </span>
              ) : lifestyleTier === 'cozy' ? (
                <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200" title="Cozy Scholar: Warm lighting & plants">
                  <span>🪴</span>
                  <span className="hidden sm:inline">Succulent & Mug</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/60 border border-white/[0.06] text-slate-400" title="Frugal Student: Humble beginnings">
                  <span>📚</span>
                  <span className="hidden sm:inline">Study Desk</span>
                </span>
              )}

              <button
                type="button"
                onClick={() => setIsCafeteriaOpen(true)}
                className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs cursor-pointer transition-colors"
                title="Open Cafeteria"
              >
                🍳
              </button>
            </div>
          </div>
        </div>

        {/* --- BOTTOM CARE & STUDY DOCKS (Collapsible via Zen Mode) --- */}
        {!isZenMode && (
          <div className="absolute bottom-3 inset-x-3 sm:inset-x-5 flex flex-col md:flex-row items-end justify-between gap-3 pointer-events-none">
            
            {/* Left Dock: Feeding & Pet Care Bar */}
            <div className="pointer-events-auto w-full md:w-auto flex flex-col gap-2 p-2.5 sm:p-3 rounded-3xl bg-slate-950/90 border border-white/[0.12] backdrop-blur-2xl shadow-2xl">
              <div className="flex items-center justify-between gap-2 px-1 text-[11px] font-bold text-slate-300">
                <span className="flex items-center gap-1 text-pink-300">
                  <Smile className="w-3.5 h-3.5 text-pink-400" />
                  <span>Feed & Care</span>
                </span>
                <span className="text-[11px] text-cyan-300/80">Energy: {state.energy || 85}%</span>
              </div>

              {/* Treat Dispenser */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {(['shrimp', 'berry', 'bean', 'pearl'] as AxolotlTreatType[]).map((tId) => {
                  const meta = TREATS_META[tId];
                  const count = state.treatInventory?.[tId] || 0;
                  return (
                    <button
                      key={tId}
                      type="button"
                      onClick={() => handleFeed(tId)}
                      className={`relative flex flex-col items-center p-2 rounded-2xl border transition-all cursor-pointer group ${
                        count > 0 
                          ? 'bg-white/[0.04] hover:bg-white/[0.1] border-white/[0.08] hover:border-pink-500/40' 
                          : 'bg-white/[0.01] border-white/[0.04] opacity-50'
                      }`}
                      title={`Feed ${meta.name} (+${meta.xpReward} XP, +${meta.happinessGain} Happiness)`}
                    >
                      <span className="text-xl sm:text-2xl group-hover:scale-125 transition-transform">
                        {meta.emoji}
                      </span>
                      <span className="text-[11px] font-bold text-white mt-1">{meta.name}</span>
                      <span className={`text-[11px] font-mono font-bold px-1.5 rounded-full mt-0.5 ${
                        count > 0 ? 'bg-pink-500/20 text-pink-300' : 'bg-slate-800 text-slate-500'
                      }`}>
                        x{count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Quick Actions Row */}
              <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={handlePet}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/30 text-pink-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400" />
                  <span>Pet (+5 XP)</span>
                </button>

                <button
                  type="button"
                  onClick={handleTrick}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Acrobatic Trick</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBreathingActive(prev => {
                      const next = !prev;
                      if (next) {
                        setBreathPhase('Inhale');
                        setBreathSeconds(4);
                      }
                      return next;
                    });
                  }}
                  className={`py-1.5 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    breathingActive
                      ? 'bg-cyan-500/25 border-cyan-400/50 text-cyan-200 animate-pulse'
                      : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-slate-300'
                  }`}
                  title="4-4-4 Box Breathing with Lottie"
                >
                  <Wind className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{breathingActive ? `${breathPhase} ${breathSeconds}s` : 'Breathe'}</span>
                </button>
              </div>
            </div>

            {/* Right Dock: Quick Study & Deck Syllabus Hub */}
            <div className="pointer-events-auto w-full md:w-80 lg:w-96 flex flex-col gap-2.5 p-3 rounded-3xl bg-slate-950/90 border border-white/[0.12] backdrop-blur-2xl shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white font-display flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span>Study Cockpit</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {stats.conceptsMastered || 0} Concepts Cleared
                </span>
              </div>

              {/* Primary Quick Study CTA Button */}
              <button
                type="button"
                onClick={handleLaunchQuickStudy}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-black text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-between transition-all hover:scale-[1.02] cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 fill-white text-white group-hover:scale-110 transition-transform" />
                  <span>
                    {dueCards.length > 0 ? `Review ${dueCards.length} Due Cards` : 'Start Focus Session'}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/20 text-white font-mono">
                  {dueCards.length > 0 ? 'FSRS DUE' : 'STUDY'}
                </span>
              </button>

              {/* Quick Launch Actions Row */}
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsLibraryOpen(true)}
                  className="py-2 px-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                  title="Browse Saved Decks"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Decks ({savedSessions.length})</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenDeckStudio}
                  className="py-2 px-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                  title="Create New Deck or Import PDF"
                >
                  <Plus className="w-3.5 h-3.5 text-pink-400" />
                  <span>New Deck</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (savedSessions.length > 0) onStartMatch(savedSessions[0]);
                    else onOpenStarterCatalog();
                  }}
                  className="py-2 px-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                  title="Speed Match 60s Game"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Match</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenDashboard}
                  className="py-2 px-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                  title="View FSRS Memory Analytics"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Analytics</span>
                </button>
              </div>

              {/* Secondary Feature Row (Audio Briefing, Interleaving, Exam) */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-white/[0.06]">
                {onStartAudioBriefing && savedSessions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onStartAudioBriefing(savedSessions[0])}
                    className="flex-1 py-1 px-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Headphones className="w-3 h-3" />
                    <span>Audio Brief</span>
                  </button>
                )}

                {onOpenInterleaving && (
                  <button
                    type="button"
                    onClick={onOpenInterleaving}
                    className="flex-1 py-1 px-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Mix Decks</span>
                  </button>
                )}

                {onOpenExam && (
                  <button
                    type="button"
                    onClick={onOpenExam}
                    className="flex-1 py-1 px-2 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Award className="w-3 h-3" />
                    <span>Mock Exam</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Daily Student Ledger & Budget Tracker */}
      <div className="w-full">
        <DailyLedgerWidget 
          onOpenCafeteria={() => setIsCafeteriaOpen(true)}
        />
      </div>

      {/* --- SLIDE-OVER WARDROBE & BIOMES MODAL --- */}
      {isWardrobeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative max-w-2xl w-full max-h-[85vh] bg-slate-900 border border-white/[0.1] rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col space-y-4 overflow-hidden">
            
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-pink-400" />
                <h3 className="text-base font-bold text-white font-display">Lottie's Wardrobe & Habitats</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWardrobeOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
              <button
                type="button"
                onClick={() => setWardrobeTab('skin')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  wardrobeTab === 'skin' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                Skin Varieties (6)
              </button>
              <button
                type="button"
                onClick={() => setWardrobeTab('accessory')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  wardrobeTab === 'accessory' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                Accessories (7)
              </button>
              <button
                type="button"
                onClick={() => setWardrobeTab('biome')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  wardrobeTab === 'biome' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                Aquatic Biomes (4)
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {wardrobeTab === 'skin' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Object.keys(SKIN_PALETTES) as AxolotlSkinId[]).map((sId) => {
                    const pal = SKIN_PALETTES[sId];
                    const isSelected = state.skin === sId;
                    const isUnlocked = state.unlockedSkins.includes(sId);
                    return (
                      <div
                        key={sId}
                        onClick={() => {
                          if (isUnlocked) axolotlService.setSkin(sId);
                          else showToast(`Reach Friendship Level ${sId === 'midnight' ? '2' : '3'} to unlock!`);
                        }}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-pink-500/20 border-pink-500/50 shadow-md shadow-pink-500/10'
                            : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08]'
                        } ${!isUnlocked ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl border border-white/20 shadow-inner flex items-center justify-center font-bold text-sm"
                            style={{ backgroundColor: pal.bodyColor, color: pal.eyeColor }}
                          >
                            🐾
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>{pal.name}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-pink-400" />}
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-1">{pal.subtitle}</p>
                          </div>
                        </div>
                        {!isUnlocked && (
                          <span className="text-[11px] font-bold text-amber-300 uppercase px-2 py-0.5 rounded bg-amber-500/20">
                            Locked
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {wardrobeTab === 'accessory' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Object.keys(ACCESSORIES_META) as AxolotlAccessoryId[]).map((accId) => {
                    const acc = ACCESSORIES_META[accId];
                    const isSelected = state.accessory === accId;
                    const isUnlocked = state.unlockedAccessories.includes(accId);
                    return (
                      <div
                        key={accId}
                        onClick={() => {
                          if (isUnlocked) axolotlService.setAccessory(accId);
                          else showToast(`Reach Friendship Level ${acc.requiredLevel} to unlock ${acc.name}!`);
                        }}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-pink-500/20 border-pink-500/50 shadow-md shadow-pink-500/10'
                            : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08]'
                        } ${!isUnlocked ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-950 border border-white/[0.1] flex items-center justify-center text-xl">
                            {acc.icon}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>{acc.name}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-pink-400" />}
                            </div>
                            <p className="text-[11px] text-slate-400">{acc.description}</p>
                          </div>
                        </div>
                        {!isUnlocked && (
                          <span className="text-[11px] font-bold text-amber-300 uppercase px-2 py-0.5 rounded bg-amber-500/20">
                            Lvl {acc.requiredLevel}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {wardrobeTab === 'biome' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Object.keys(ENVIRONMENTS_META) as AxolotlEnvironmentId[]).map((envId) => {
                    const env = ENVIRONMENTS_META[envId];
                    const isSelected = state.environment === envId;
                    return (
                      <div
                        key={envId}
                        onClick={() => axolotlService.setEnvironment(envId)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                            : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-950 border border-white/[0.1] flex items-center justify-center text-xl">
                            {env.icon}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>{env.name}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                            </div>
                            <p className="text-[11px] text-slate-400">{env.subtitle}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-white/[0.08] flex justify-end">
              <button
                type="button"
                onClick={() => setIsWardrobeOpen(false)}
                className="py-2 px-5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-pink-600/25"
              >
                Apply & Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SLIDE-OVER DECK SYLLABUS DRAWER --- */}
      {isLibraryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md h-full bg-slate-900 border-l border-white/[0.1] p-5 shadow-2xl flex flex-col space-y-4">
            
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white font-display">Study Deck Library</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLibraryOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search your decks..."
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-xs outline-none focus:border-indigo-500/50"
              />
            </div>

            {/* Deck List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredDecks.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No decks found. Create one or explore starter packs!
                </div>
              ) : (
                filteredDecks.map((deck) => {
                  const deckDueCount = deck.concepts.flatMap(cp => cp.retrievalCards || []).filter(rc => dueCards.some(dc => dc.id === rc.id)).length;
                  const totalDeckCards = deck.concepts.reduce((acc, c) => acc + (c.retrievalCards?.length || 0), 0);
                  return (
                    <div
                      key={deck.id}
                      className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] space-y-2.5 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-white line-clamp-1">{deck.title}</h4>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {totalDeckCards} cards • {deck.category || 'Active Recall'}
                          </span>
                        </div>
                        {deckDueCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                            {deckDueCount} due
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsLibraryOpen(false);
                            onStartSession(deck);
                          }}
                          className="flex-1 py-1.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>Study Now</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsLibraryOpen(false);
                            onOpenDeckStation(deck);
                          }}
                          className="py-1.5 px-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 hover:text-white text-[11px] font-semibold cursor-pointer"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-white/[0.08] flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsLibraryOpen(false);
                  onOpenDeckStudio();
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-pink-600/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Deck</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsLibraryOpen(false);
                  onOpenStarterCatalog();
                }}
                className="py-2 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-slate-300 hover:text-white font-bold text-xs cursor-pointer"
              >
                Explore Catalog
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campus Cafeteria & Bodega Modal */}
      <CampusCafeteriaModal
        isOpen={isCafeteriaOpen}
        onClose={() => setIsCafeteriaOpen(false)}
        onMealPurchased={(meal) => {
          showToast(`🍽️ Enjoy your ${meal.name}! ${meal.buffDescription}`);
        }}
      />
    </div>
  );
};

export default AxolotlStudyHabitat;

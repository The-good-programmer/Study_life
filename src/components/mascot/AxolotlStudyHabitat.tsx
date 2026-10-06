import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import confetti from 'canvas-confetti';
import { 
  Sparkles, 
  Wind, 
  BookOpen, 
  Layers, 
  Plus, 
  Check, 
  Utensils, 
  X, 
  Award, 
  Shuffle, 
  Flame, 
  Headphones, 
  Home, 
  ShoppingBag, 
  CheckCheck, 
  Volume2, 
  VolumeX, 
  CloudRain, 
  Radio 
} from 'lucide-react';
import { characterService } from '../../services/characterService';
import { StorageService } from '../../services/storageService';
import { soundEngine, type SoundType } from '../../services/soundEngine';
import { 
  lifeSimService, 
  CAFETERIA_MENU, 
  HOUSING_CATALOG, 
  STUDENT_GEAR_CATALOG 
} from '../../services/lifeSimService';
const HomeDesign3D = lazy(() => import('../lifesim/HomeDesign3D'));

const HomeDesign3DSkeleton = () => (
  <div className="relative w-full h-full min-h-[500px] flex-1 overflow-hidden bg-[#0a1128] shadow-2xl flex flex-col items-center justify-center p-8 select-none">
    {/* Blueprint Grid Background Pattern */}
    <div
      className="absolute inset-0 opacity-20 pointer-events-none"
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(56, 189, 248, 0.25) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(56, 189, 248, 0.25) 1px, transparent 1px)
        `,
        backgroundSize: '32px 32px',
      }}
    />

    {/* Ambient Glowing Radial Center */}
    <div className="absolute w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

    {/* Blueprint Wireframe Cube Animation */}
    <div className="relative z-10 flex flex-col items-center space-y-5 text-center">
      <div className="relative w-20 h-20 flex items-center justify-center">
        <div className="absolute inset-0 rounded-2xl border-2 border-cyan-400/40 rotate-6 animate-pulse" />
        <div className="absolute inset-0 rounded-2xl border-2 border-amber-400/30 -rotate-6 animate-pulse [animation-delay:300ms]" />
        <div className="w-14 h-14 rounded-xl bg-slate-900/90 border border-cyan-400/60 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Layers className="w-7 h-7 text-cyan-300 animate-spin [animation-duration:8s]" />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-sm font-black tracking-widest text-cyan-200 uppercase font-display flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>Architectural 3D Engine</span>
        </div>
        <p className="text-xs text-slate-400 font-mono">
          Loading Three.js PBR shaders &amp; contact shadows...
        </p>
      </div>

      {/* Progress Line */}
      <div className="w-48 h-1 rounded-full bg-cyan-950 overflow-hidden border border-cyan-500/30">
        <div className="w-full h-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
      </div>
    </div>
  </div>
);
import { 
  type MealItem, 
  type HousingTier 
} from '../../types/lifeSim';
import type { StudySession } from '../../types';

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
  onToggleMobileSidebar?: () => void;
  onNavigateHome?: () => void;
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
  onToggleMobileSidebar,
  onNavigateHome,
}) => {
  // Wallet & Student Identity
  const [walletCoins, setWalletCoins] = useState<number>(lifeSimService.getWalletBalance());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Audio Soundscape state
  const [currentSound, setCurrentSound] = useState<SoundType>(soundEngine.getCurrentSound());
  const [soundVolume, setSoundVolume] = useState<number>(soundEngine.getVolume());

  // Active Overlay Drawer: null | 'cafe' | 'study' | 'housing' | 'gear' | 'audio' | 'breathe'
  const [activeDrawer, setActiveDrawer] = useState<'cafe' | 'study' | 'housing' | 'gear' | 'audio' | 'breathe' | null>(null);
  const [cafeTab, setCafeTab] = useState<'all' | 'breakfast' | 'lunch' | 'dinner' | 'drink'>('all');

  // Box Breathing Timer (4-4-4)
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');
  const [breathSeconds, setBreathSeconds] = useState(4);

  // Subscribe to live updates
  useEffect(() => {
    const unsubLife = lifeSimService.subscribe(() => {
      setWalletCoins(lifeSimService.getWalletBalance());
    });
    const unsubChar = characterService.subscribe((char) => {
      setWalletCoins(char.coins || 0);
    });
    const unsubSound = soundEngine.subscribe((sound, vol) => {
      setCurrentSound(sound);
      setSoundVolume(vol);
    });
    return () => {
      unsubLife();
      unsubChar();
      unsubSound();
    };
  }, []);

  // Box Breathing Guide Timer
  useEffect(() => {
    if (activeDrawer !== 'breathe') return;

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
  }, [activeDrawer]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  // Saved Decks & Current Study Targets
  const savedSessions = StorageService.getSessions();
  const dueCards = StorageService.getDueCards();
  const currentHousing = lifeSimService.getHousing();
  const ownedGear = lifeSimService.getOwnedGear();

  // Currently active or primary deck
  const primaryDeck = useMemo(() => {
    if (savedSessions.length === 0) return null;
    if (dueCards.length > 0) {
      return savedSessions.find(s => 
        s.concepts.some(cp => (cp.retrievalCards || []).some(rc => dueCards.some(dc => dc.id === rc.id)))
      ) || savedSessions[0];
    }
    return savedSessions[0];
  }, [savedSessions, dueCards]);

  // Order Meal
  const handleOrderMeal = (meal: MealItem) => {
    const res = lifeSimService.buyMeal(meal.id);
    if (res.success) {
      soundEngine.playSuccess();
      showToast(`Served ${meal.name}! 🍽️`);
    } else {
      showToast(res.error || 'Could not order meal');
    }
  };

  // Rent / Upgrade Housing
  const handleRentHousing = (housingId: HousingTier) => {
    const res = lifeSimService.rentHousing(housingId);
    if (res.success) {
      try {
        confetti({
          particleCount: 65,
          spread: 75,
          origin: { y: 0.5 }
        });
      } catch {}
      showToast(`Lease upgraded to ${lifeSimService.getHousing().name}! 🏠`);
    } else {
      showToast(res.error || 'Could not upgrade lease');
    }
  };

  // Buy Gear
  const handleBuyGear = (gearId: string) => {
    const res = lifeSimService.buyGear(gearId);
    if (res.success && res.item) {
      try {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.7 }
        });
      } catch {}
      showToast(`Equipped ${res.item.name}! ${res.item.perk}`);
    } else {
      showToast(res.error || 'Could not purchase gear');
    }
  };

  // Soundscape toggles
  const handleToggleSound = (type: SoundType) => {
    if (currentSound === type) {
      soundEngine.stop();
    } else {
      soundEngine.play(type);
    }
  };

  // Filtered menu
  const menuList = useMemo(() => {
    if (cafeTab === 'all') return CAFETERIA_MENU;
    return CAFETERIA_MENU.filter(m => m.category === cafeTab);
  }, [cafeTab]);

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden select-none animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-indigo-500/40 text-indigo-100 text-xs sm:text-sm font-semibold shadow-2xl backdrop-blur-xl animate-bounce">
          {toastMessage}
        </div>
      )}



      {/* 3D Architectural Estate */}
      <Suspense fallback={<HomeDesign3DSkeleton />}>
        <HomeDesign3D
          onStartSession={onStartSession}
          onOpenDeckStation={onOpenDeckStation}
          onOpenStarterCatalog={onOpenStarterCatalog}
          onOpenDashboard={onOpenDashboard}
          onOpenCafeteria={() => {
            setActiveDrawer('cafe');
            setCafeTab('all');
          }}
          onOpenHousing={() => setActiveDrawer('housing')}
          onToggleMobileSidebar={onToggleMobileSidebar}
          onNavigateHome={onNavigateHome}
        />
      </Suspense>

      {/* ======================================================== */}
      {/* 4. CLEAN POP-OUT DRAWERS (When dock icons are clicked) */}
      {/* ======================================================== */}
      
      {/* DRAWER 1: PANTRY & CAFE */}
      {activeDrawer === 'cafe' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-slate-900 border border-white/[0.12] rounded-3xl p-5 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white font-display">Campus Pantry &amp; Cafe</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                  🪙 {walletCoins} Tokens
                </span>
                <button
                  type="button"
                  onClick={() => setActiveDrawer(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'all', label: 'All' },
                { id: 'breakfast', label: '🥣 Breakfast' },
                { id: 'lunch', label: '🥪 Lunch' },
                { id: 'dinner', label: '🍜 Dinner' },
                { id: 'drink', label: '☕ Drinks' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCafeTab(cat.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    cafeTab === cat.id
                      ? 'bg-amber-500/25 border border-amber-500/50 text-amber-200'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-400'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Food Items List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {menuList.map((meal) => {
                const canAfford = walletCoins >= meal.cost;
                return (
                  <div
                    key={meal.id}
                    className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl p-2 rounded-xl bg-white/[0.05] border border-white/[0.06] shrink-0">
                        {meal.emoji}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white truncate">{meal.name}</h4>
                          <span className="text-[10px] font-mono font-bold text-amber-300">
                            {meal.cost === 0 ? 'FREE' : `🪙 ${meal.cost}`}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{meal.subtitle}</p>
                        {meal.buffValue > 1 && (
                          <span className="text-[10px] font-bold text-amber-300">
                            ⚡ +{Math.round((meal.buffValue - 1) * 100)}% Study Wage Boost ({meal.buffDurationMinutes}m)
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => {
                        handleOrderMeal(meal);
                        setActiveDrawer(null);
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        canAfford
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md shadow-amber-500/20 hover:scale-105'
                          : 'bg-white/[0.05] text-slate-500 cursor-not-allowed border border-white/[0.06]'
                      }`}
                    >
                      {canAfford ? 'Order' : `Need 🪙${meal.cost}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* DRAWER 2: STUDY COCKPIT */}
      {activeDrawer === 'study' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-slate-900 border border-white/[0.12] rounded-3xl p-5 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white font-display">Study Cockpit &amp; Decks</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawer(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveDrawer(null);
                  onOpenDeckStudio();
                }}
                className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-left transition-all cursor-pointer space-y-1"
              >
                <div className="flex items-center gap-1.5 text-pink-400 font-bold text-xs">
                  <Plus className="w-4 h-4" />
                  <span>Create Deck</span>
                </div>
                <p className="text-[10px] text-slate-400">PDF, AI or manual flashcards</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveDrawer(null);
                  if (primaryDeck) onStartMatch(primaryDeck);
                }}
                className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-left transition-all cursor-pointer space-y-1"
              >
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                  <Flame className="w-4 h-4" />
                  <span>Match Arena</span>
                </div>
                <p className="text-[10px] text-slate-400">Speed match game</p>
              </button>

              {onOpenInterleaving && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveDrawer(null);
                    onOpenInterleaving();
                  }}
                  className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-left transition-all cursor-pointer space-y-1"
                >
                  <div className="flex items-center gap-1.5 text-purple-400 font-bold text-xs">
                    <Shuffle className="w-4 h-4" />
                    <span>Mix Decks</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Interleaved cross-study</p>
                </button>
              )}

              {onOpenExam && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveDrawer(null);
                    onOpenExam();
                  }}
                  className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-left transition-all cursor-pointer space-y-1"
                >
                  <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs">
                    <Award className="w-4 h-4" />
                    <span>Mock Exam</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Full timed exam testing</p>
                </button>
              )}

              {onStartAudioBriefing && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveDrawer(null);
                    if (primaryDeck) onStartAudioBriefing(primaryDeck);
                  }}
                  className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-left transition-all cursor-pointer space-y-1"
                >
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                    <Headphones className="w-4 h-4" />
                    <span>Audio Pilot</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Podcast style review</p>
                </button>
              )}
            </div>

            {/* Saved Decks List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Decks ({savedSessions.length})</span>
              {savedSessions.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  No decks yet. Click "Create Deck" or explore starter catalog!
                </div>
              ) : (
                savedSessions.map((deck) => {
                  const deckDueCount = deck.concepts.flatMap(cp => cp.retrievalCards || []).filter(rc => dueCards.some(dc => dc.id === rc.id)).length;
                  return (
                    <div
                      key={deck.id}
                      className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-between gap-3 transition-all"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-white">{deck.title}</h4>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {deck.concepts.reduce((acc, c) => acc + (c.retrievalCards?.length || 0), 0)} cards
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {deckDueCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-300">
                            {deckDueCount} due
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDrawer(null);
                            onStartSession(deck);
                          }}
                          className="py-1 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                        >
                          Study
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDrawer(null);
                            onOpenDeckStation(deck);
                          }}
                          className="py-1 px-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 text-xs font-semibold cursor-pointer"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* DRAWER 3: HOUSING AGENCY */}
      {activeDrawer === 'housing' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-slate-900 border border-white/[0.12] rounded-3xl p-5 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Home className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white font-display">Campus Housing Agency</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawer(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {HOUSING_CATALOG.map((prop) => {
                const isCurrent = currentHousing.id === prop.id;
                const canAfford = walletCoins >= prop.rentPerDay;

                return (
                  <div
                    key={prop.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                        : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl p-2 rounded-2xl bg-white/[0.05] border border-white/[0.08]">
                          {prop.icon}
                        </span>
                        <div>
                          <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                            <span>{prop.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                Current Home
                              </span>
                            )}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">{prop.subtitle}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono font-bold text-amber-300">
                          🪙 {prop.rentPerDay} / day
                        </div>
                        <div className="text-[10px] font-bold text-indigo-300 mt-0.5">
                          {prop.wageMultiplier > 1.0 ? `+${Math.round((prop.wageMultiplier - 1) * 100)}% Wage` : 'Baseline Wage'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-300">
                        ✨ {prop.perkDescription}
                      </span>

                      {!isCurrent && (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => {
                            handleRentHousing(prop.id);
                            setActiveDrawer(null);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            canAfford
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20 hover:scale-105'
                              : 'bg-white/[0.05] text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {canAfford ? 'Move In & Lease' : `Need 🪙${prop.rentPerDay}`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* DRAWER 4: TECH GEAR SHOP */}
      {activeDrawer === 'gear' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-slate-900 border border-white/[0.12] rounded-3xl p-5 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white font-display">Student Tech &amp; Desk Depot</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawer(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
              {STUDENT_GEAR_CATALOG.map((item) => {
                const isOwned = ownedGear.some(g => g.id === item.id);
                const canAfford = walletCoins >= item.cost;

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl p-2 rounded-xl bg-white/[0.05] border border-white/[0.06] shrink-0">
                        {item.emoji}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                          <span className="text-[10px] font-mono font-bold text-amber-300">
                            🪙 {item.cost}
                          </span>
                        </div>
                        <p className="text-[11px] text-purple-300 line-clamp-1">{item.perk}</p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isOwned ? (
                        <span className="text-[11px] font-bold text-emerald-400 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1">
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Owned</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => {
                            handleBuyGear(item.id);
                            setActiveDrawer(null);
                          }}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            canAfford
                              ? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-md shadow-purple-500/20 hover:scale-105'
                              : 'bg-white/[0.05] text-slate-500 cursor-not-allowed border border-white/[0.06]'
                          }`}
                        >
                          {canAfford ? 'Buy' : `Need 🪙${item.cost}`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* DRAWER 5: AMBIENT SOUNDSCAPE MIXER */}
      {activeDrawer === 'audio' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/[0.12] rounded-3xl p-5 shadow-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white font-display">Ambient Focus Soundscapes</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawer(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {[
                { id: 'off', label: 'Mute / Off', desc: 'Silent study', icon: VolumeX },
                { id: 'rain', label: 'Rainfall on Window', desc: 'Calming rain soundscape', icon: CloudRain },
                { id: 'binaural-alpha-10hz', label: 'Lo-Fi Alpha 10Hz', desc: 'Relaxed focus waves', icon: Headphones },
                { id: 'binaural-40hz', label: '40 Hz Tone', desc: 'Steady background tone', icon: Sparkles },
                { id: 'brown-noise', label: 'Warm Brown Noise', desc: 'Deep background mask', icon: Radio },
              ].map((snd) => {
                const isActive = currentSound === snd.id;
                const IconComponent = snd.icon;
                return (
                  <div
                    key={snd.id}
                    onClick={() => handleToggleSound(snd.id as any)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isActive
                        ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-100 shadow-md shadow-cyan-500/10'
                        : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent className={`w-5 h-5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <div>
                        <div className="text-xs font-bold text-white">{snd.label}</div>
                        <p className="text-[10px] text-slate-400">{snd.desc}</p>
                      </div>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-cyan-400" />}
                  </div>
                );
              })}
            </div>

            {/* Volume Slider */}
            {currentSound !== 'off' && (
              <div className="pt-2 border-t border-white/[0.08] flex items-center gap-3">
                <Volume2 className="w-4 h-4 text-slate-400" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundVolume}
                  onChange={(e) => soundEngine.setVolume(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <span className="text-[11px] font-mono text-slate-400">{Math.round(soundVolume * 100)}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DRAWER 6: BOX BREATHING GUIDE (4-4-4) */}
      {activeDrawer === 'breathe' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/[0.12] rounded-3xl p-6 shadow-2xl flex flex-col items-center space-y-6 text-center">
            <div className="w-full flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Wind className="w-5 h-5 text-teal-400" />
                <h3 className="text-base font-bold text-white font-display">4-4-4 Box Breathing</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawer(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pulsating Breathing Circle */}
            <div className="relative flex items-center justify-center my-4">
              <div className={`w-40 h-40 rounded-full border-2 border-teal-400/50 flex flex-col items-center justify-center transition-all duration-1000 ${
                breathPhase === 'Inhale'
                  ? 'scale-125 bg-teal-500/20 shadow-2xl shadow-teal-500/30'
                  : breathPhase === 'Hold'
                    ? 'scale-110 bg-teal-500/30'
                    : 'scale-90 bg-transparent'
              }`}>
                <span className="text-xl font-black text-white font-display">{breathPhase}</span>
                <span className="text-2xl font-mono font-bold text-teal-300 mt-1">{breathSeconds}s</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
              Box breathing resets your autonomic nervous system, clears mental fog, and boosts alpha waves before a study sprint.
            </p>

            <button
              type="button"
              onClick={() => setActiveDrawer(null)}
              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs cursor-pointer"
            >
              Ready to Study
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const StudyEstateCampus = AxolotlStudyHabitat;
export default AxolotlStudyHabitat;

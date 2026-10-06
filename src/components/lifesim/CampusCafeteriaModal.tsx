import React, { useState, useEffect } from 'react';
import { 
  X, 
  Coffee, 
  Sun, 
  CloudSun, 
  Sparkles, 
  Zap, 
  Check, 
  AlertCircle,
  Coins,
  Moon
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  lifeSimService, 
  CAFETERIA_MENU, 
  LIFESTYLE_TIERS 
} from '../../services/lifeSimService';
import { type MealCategory, type MealItem } from '../../types/lifeSim';

interface CampusCafeteriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMealPurchased?: (meal: MealItem) => void;
}

export const CampusCafeteriaModal: React.FC<CampusCafeteriaModalProps> = ({
  isOpen,
  onClose,
  onMealPurchased,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<MealCategory>('breakfast');
  const [walletCoins, setWalletCoins] = useState<number>(lifeSimService.getWalletBalance());
  const [ledger, setLedger] = useState(lifeSimService.getDailyLedger());
  const [activeBuffs, setActiveBuffs] = useState(lifeSimService.getActiveBuffs());
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  // Clock for "minutes left" on buffs; ticks while the modal is open.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [isOpen]);

  useEffect(() => {
    const update = () => {
      setWalletCoins(lifeSimService.getWalletBalance());
      setLedger(lifeSimService.getDailyLedger());
      setActiveBuffs(lifeSimService.getActiveBuffs());
      setNow(Date.now());
    };
    const unsubscribe = lifeSimService.subscribe(update);
    update();
    return unsubscribe;
  }, [isOpen]);

  if (!isOpen) return null;

  const currentTier = lifeSimService.getLifestyleTier();
  const tierMeta = LIFESTYLE_TIERS[currentTier];

  const handlePurchase = (meal: MealItem) => {
    const res = lifeSimService.buyMeal(meal.id);
    if (!res.success) {
      setStatusMessage({ text: res.error || 'Could not purchase meal', isError: true });
      setTimeout(() => setStatusMessage(null), 3500);
      return;
    }

    try {
      confetti({
        particleCount: 25,
        spread: 50,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f59e0b', '#38bdf8', '#ec4899'],
      });
    } catch {}

    setStatusMessage({
      text: `Enjoy your ${meal.name}! ${meal.buffDescription}`,
      isError: false,
    });
    setTimeout(() => setStatusMessage(null), 4000);

    if (onMealPurchased && res.meal) {
      onMealPurchased(res.meal);
    }
  };

  const filteredMeals = CAFETERIA_MENU.filter((m) => {
    if (selectedCategory === 'breakfast') return m.category === 'breakfast';
    if (selectedCategory === 'lunch') return m.category === 'lunch';
    if (selectedCategory === 'dinner') return m.category === 'dinner';
    return m.category === 'drink' || m.category === 'snack';
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-slate-900 border border-amber-500/30 shadow-2xl overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-amber-950/60 via-slate-900 to-indigo-950/60 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-pink-500 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center text-2xl">
              🍳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-xl font-extrabold font-display text-white">
                  Campus Cafeteria & Bodega
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {tierMeta.title}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Fuel your daily routine. Meals give real active recall & coin buffs!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Wallet pill */}
            <div className="px-3 py-1.5 rounded-2xl bg-slate-950/80 border border-amber-500/30 flex items-center gap-1.5 shadow-inner">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="text-xs sm:text-sm font-extrabold text-amber-300 font-mono">
                🪙 {walletCoins}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Alert Banner */}
        {statusMessage && (
          <div className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 ${
            statusMessage.isError 
              ? 'bg-rose-500/20 border-b border-rose-500/30 text-rose-300' 
              : 'bg-emerald-500/20 border-b border-emerald-500/30 text-emerald-300'
          }`}>
            {statusMessage.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Sparkles className="w-4 h-4 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Category Tabs & Active Buffs Bar */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-white/[0.06] bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('breakfast')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'breakfast'
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>Morning Breakfast</span>
              {ledger.breakfastId && <Check className="w-3 h-3 text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('lunch')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'lunch'
                  ? 'bg-blue-500/20 border border-blue-500/40 text-blue-200'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <CloudSun className="w-3.5 h-3.5 text-blue-400" />
              <span>Campus Lunch</span>
              {ledger.lunchId && <Check className="w-3 h-3 text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('dinner')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'dinner'
                  ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-200'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Evening Dinner</span>
              {ledger.dinnerId && <Check className="w-3 h-3 text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('drink')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'drink'
                  ? 'bg-purple-500/20 border border-purple-500/40 text-purple-200'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Coffee className="w-3.5 h-3.5 text-purple-400" />
              <span>Drinks & Snacks</span>
            </button>
          </div>

          {/* Active Buffs Pill */}
          {activeBuffs.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Buff:</span>
              {activeBuffs.map((b) => (
                <span
                  key={b.id}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-pink-500/20 border border-pink-500/40 text-pink-300 flex items-center gap-1 animate-pulse"
                >
                  <span>{b.emoji}</span>
                  <span>{b.name} ({Math.round((new Date(b.expiresAt).getTime() - now) / 60000)}m left)</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Meals Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {filteredMeals.map((meal) => {
              const isAffordable = walletCoins >= meal.cost;
              const isPurchasedToday = 
                (meal.category === 'breakfast' && ledger.breakfastId === meal.id) ||
                (meal.category === 'lunch' && ledger.lunchId === meal.id) ||
                (meal.category === 'dinner' && ledger.dinnerId === meal.id);

              return (
                <div
                  key={meal.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    isPurchasedToday
                      ? 'bg-emerald-950/30 border-emerald-500/40'
                      : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl sm:text-4xl p-2 rounded-xl bg-white/[0.04] shrink-0">
                      {meal.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-sm sm:text-base text-white truncate">
                          {meal.name}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-black ${
                          meal.cost === 0 
                            ? 'bg-emerald-500/20 text-emerald-300' 
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {meal.cost === 0 ? 'FREE' : `🪙 ${meal.cost}`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                        {meal.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Buff Box */}
                  <div className="px-3 py-2 rounded-xl bg-slate-950/60 border border-white/[0.05] flex items-center gap-2 text-xs">
                    <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-slate-300 font-medium">
                      {meal.buffDescription}
                    </span>
                  </div>

                  {/* Purchase CTA */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-400">
                      {meal.buffDurationMinutes > 0 ? `Duration: ${meal.buffDurationMinutes}m` : 'Daily Staple'}
                    </span>

                    <button
                      type="button"
                      onClick={() => handlePurchase(meal)}
                      disabled={!isAffordable && meal.cost > 0}
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isPurchasedToday
                          ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/40'
                          : isAffordable || meal.cost === 0
                            ? 'bg-gradient-to-r from-amber-500 to-pink-500 hover:from-amber-400 hover:to-pink-400 text-slate-950 shadow-md shadow-amber-500/20 hover:scale-[1.02]'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                      }`}
                    >
                      {isPurchasedToday ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Eaten Today (Re-order)</span>
                        </>
                      ) : meal.cost === 0 ? (
                        <span>Eat Free 🥣</span>
                      ) : isAffordable ? (
                        <span>Buy & Eat 🪙{meal.cost}</span>
                      ) : (
                        <span>Need 🪙{meal.cost}</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 sm:p-4 bg-slate-950/80 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Daily Ledger:</span>
            <span className="text-rose-400 font-mono font-bold">-{ledger.totalExpenses} 🪙 spent</span>
            <span>•</span>
            <span className="text-emerald-400 font-mono font-bold">+{ledger.totalEarnings} 🪙 wages</span>
          </div>
          <span className="hidden sm:inline text-slate-400">
            Study active recall to earn your daily scholar wage!
          </span>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Coins, Sparkles, TrendingUp, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface WageDetail {
  activity: string;
  rawAmount: number;
  buffBonus: number;
  totalAmount: number;
}

export const WagePayoutBanner: React.FC = () => {
  const [wage, setWage] = useState<WageDetail | null>(null);

  useEffect(() => {
    const handleWageEvent = (event: Event) => {
      const custom = event as CustomEvent<WageDetail>;
      if (custom.detail) {
        setWage(custom.detail);

        try {
          confetti({
            particleCount: 20,
            spread: 40,
            origin: { y: 0.85, x: 0.5 },
            colors: ['#34d399', '#10b981', '#fbbf24'],
          });
        } catch {}

        // Auto-dismiss after 4.5 seconds
        const timer = setTimeout(() => {
          setWage(null);
        }, 4500);

        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('study-wage-earned', handleWageEvent);
    return () => window.removeEventListener('study-wage-earned', handleWageEvent);
  }, []);

  if (!wage) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-bounce">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/95 border border-emerald-500/50 shadow-2xl backdrop-blur-xl text-white">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20">
          <Coins className="w-5 h-5" />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Study Wage Deposited!</span>
            </span>
            {wage.buffBonus > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" />
                <span>+{wage.buffBonus} meal buff</span>
              </span>
            )}
          </div>
          <span className="text-xs text-slate-300 font-medium">
            Earned <strong className="font-mono font-extrabold text-emerald-400">+{wage.totalAmount} AxonCoins</strong> for {wage.activity}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setWage(null)}
          className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

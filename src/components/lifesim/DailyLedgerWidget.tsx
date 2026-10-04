import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  TrendingUp, 
  TrendingDown, 
  Utensils, 
  ChevronDown, 
  ChevronUp, 
  Sparkles
} from 'lucide-react';
import { 
  lifeSimService, 
  LIFESTYLE_TIERS 
} from '../../services/lifeSimService';
import { type DailyLedger, type ActiveBuff } from '../../types/lifeSim';

interface DailyLedgerWidgetProps {
  onOpenCafeteria?: () => void;
  className?: string;
  compact?: boolean;
}

export const DailyLedgerWidget: React.FC<DailyLedgerWidgetProps> = ({
  onOpenCafeteria,
  className = '',
  compact = false,
}) => {
  const [ledger, setLedger] = useState<DailyLedger>(lifeSimService.getDailyLedger());
  const [activeBuffs, setActiveBuffs] = useState<ActiveBuff[]>(lifeSimService.getActiveBuffs());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const update = () => {
      setLedger(lifeSimService.getDailyLedger());
      setActiveBuffs(lifeSimService.getActiveBuffs());
    };
    const unsubscribe = lifeSimService.subscribe(update);
    update();
    return unsubscribe;
  }, []);

  const tier = lifeSimService.getLifestyleTier();
  const tierMeta = LIFESTYLE_TIERS[tier];
  const isProfit = ledger.netBalance >= 0;

  if (compact) {
    return (
      <div 
        onClick={onOpenCafeteria}
        className={`px-3 py-1.5 rounded-2xl bg-slate-900/90 border border-amber-500/30 hover:border-amber-500/50 shadow-lg backdrop-blur-xl flex items-center gap-2 cursor-pointer transition-all hover:scale-105 ${className}`}
        title="Daily Student Ledger — Click to open Campus Cafeteria"
      >
        <span className="text-sm">🍳</span>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-slate-400 leading-none">Daily Balance</span>
          <span className={`text-xs font-mono font-black leading-tight ${isProfit ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isProfit ? `+${ledger.netBalance}` : ledger.netBalance} 🪙
          </span>
        </div>
        {activeBuffs.length > 0 && (
          <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping" />
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-3xl bg-slate-950/85 border border-white/[0.1] backdrop-blur-2xl shadow-xl overflow-hidden transition-all ${className}`}>
      {/* Summary Header */}
      <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-md ${
            isProfit 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}>
            <Receipt className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-white font-display">Daily Student Ledger</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {tierMeta.title}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] mt-0.5">
              <span className="text-rose-400 font-mono font-bold flex items-center gap-0.5">
                <TrendingDown className="w-3 h-3" /> -{ledger.totalExpenses} spent
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-mono font-bold flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> +{ledger.totalEarnings} wages
              </span>
              <span className="text-slate-600">•</span>
              <span className={`font-mono font-black ${isProfit ? 'text-emerald-300' : 'text-amber-300'}`}>
                Net: {isProfit ? `+${ledger.netBalance}` : ledger.netBalance} 🪙
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenCafeteria && (
            <button
              type="button"
              onClick={onOpenCafeteria}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-pink-500/20 hover:from-amber-500/30 hover:to-pink-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Open Campus Cafeteria"
            >
              <Utensils className="w-3.5 h-3.5 text-amber-400" />
              <span>Cafeteria</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={isExpanded ? "Collapse transaction history" : "Expand transaction history"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Active Buffs Strip */}
      {activeBuffs.length > 0 && (
        <div className="px-3.5 sm:px-4 py-1.5 bg-gradient-to-r from-pink-950/30 via-slate-900 to-indigo-950/30 border-t border-white/[0.05] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-spin" />
            <span className="text-[11px] font-bold text-pink-300">Active Meal Boost:</span>
            {activeBuffs.map(b => (
              <span key={b.id} className="text-xs text-white font-medium flex items-center gap-1">
                <span>{b.emoji}</span>
                <span>{b.name}</span>
                <span className="text-[11px] text-pink-300/80">({b.buffType === 'coin_multiplier' ? `+${Math.round((b.buffValue - 1) * 100)}% Coins` : '+XP'})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Expanded Transaction History */}
      {isExpanded && (
        <div className="p-3.5 sm:p-4 border-t border-white/[0.06] bg-slate-950/60 space-y-3 max-h-56 overflow-y-auto">
          {ledger.expenses.length === 0 && ledger.wages.length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center py-2">
              No transactions recorded today yet. Have breakfast or study to earn wages!
            </p>
          ) : (
            <div className="space-y-1.5">
              {/* Wages */}
              {ledger.wages.map(w => (
                <div key={w.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">💼</span>
                    <span className="text-slate-200 font-medium">{w.activity}</span>
                    {w.buffBonus > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-pink-500/20 text-pink-300">
                        +{w.buffBonus} buff
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-300">+{w.totalAmount} 🪙</span>
                    <span className="text-[11px] text-slate-500">{w.earnedAt}</span>
                  </div>
                </div>
              ))}

              {/* Expenses */}
              {ledger.expenses.map(e => (
                <div key={e.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-rose-950/20 border border-rose-500/20 text-xs">
                  <div className="flex items-center gap-2">
                    <span>{e.emoji}</span>
                    <span className="text-slate-200 font-medium">{e.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-rose-300">-{e.cost} 🪙</span>
                    <span className="text-[11px] text-slate-500">{e.purchasedAt}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

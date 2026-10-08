import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { lifeSimService } from '../../services/lifeSimService';
import type { LedgerWage } from '../../types/lifeSim';
import { cn } from '../../utils/cn';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Button, CoinIcon, Tokens } from '../ui/primitives';
import { formatBonus, formatMultiplier, formatTimeLeft } from './campusFormat';

const snapshot = () => ({
  ledger: lifeSimService.getDailyLedger(),
  wallet: lifeSimService.getWalletBalance(),
  boosts: lifeSimService.getPayBoosts(),
  multiplier: lifeSimService.getActiveMultiplier(),
  housing: lifeSimService.getHousing(),
  now: Date.now(),
});

interface EarningGroup {
  activity: string;
  count: number;
  total: number;
  fromBoosts: number;
}

/** One row per kind of activity, so a day of reviews isn't hundreds of lines. */
const groupWages = (wages: LedgerWage[]): EarningGroup[] => {
  const groups = new Map<string, EarningGroup>();
  for (const wage of wages) {
    const group = groups.get(wage.activity) ?? { activity: wage.activity, count: 0, total: 0, fromBoosts: 0 };
    group.count += 1;
    group.total += wage.totalAmount;
    group.fromBoosts += wage.buffBonus;
    groups.set(wage.activity, group);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
};

/** Today's money: what came in, what went out, and what raises pay right now. */
export const MoneyDialog: React.FC<{ onClose: () => void; onOpenCafe: () => void }> = ({ onClose, onOpenCafe }) => {
  const [state, setState] = useState(snapshot);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const refresh = () => setState(snapshot());
    const unsubscribe = lifeSimService.subscribe(refresh);
    const timer = setInterval(refresh, 30_000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const { ledger, wallet, boosts, multiplier, housing, now } = state;
  const homeBonus = housing.wageMultiplier - 1;
  const rentDue = homeBonus > 0 && !ledger.rentPaidToday;
  const earned = groupWages(ledger.wages);

  const payRent = () => {
    const result = lifeSimService.payDailyRent();
    setNotice(
      result.success
        ? { text: `Rent paid. Your ${formatBonus(homeBonus)} home bonus is on until the day ends.`, ok: true }
        : { text: result.error || 'Could not pay the rent just now.', ok: false },
    );
  };

  return (
    <Dialog isOpen onClose={onClose} titleId="money-title" className="max-w-xl">
      <DialogPanel>
        <DialogHeader
          titleId="money-title"
          title="Today's money"
          description="What you earned and spent today, and what raises your pay."
          onClose={onClose}
        />

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          <dl className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-line bg-canvas px-3 py-2.5">
              <dt className="text-xs text-ink-subtle">Wallet</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-[18px] font-semibold tabular-nums text-ink">
                <CoinIcon className="h-4 w-4" />
                {wallet.toLocaleString()}
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-canvas px-3 py-2.5">
              <dt className="text-xs text-ink-subtle">Earned today</dt>
              <dd className={cn('mt-1 text-[18px] font-semibold tabular-nums', ledger.totalEarnings > 0 ? 'text-success' : 'text-ink')}>
                {ledger.totalEarnings > 0 ? `+${ledger.totalEarnings.toLocaleString()}` : '0'}
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-canvas px-3 py-2.5">
              <dt className="text-xs text-ink-subtle">Spent today</dt>
              <dd className="mt-1 text-[18px] font-semibold tabular-nums text-ink">
                {ledger.totalExpenses > 0 ? `−${ledger.totalExpenses.toLocaleString()}` : '0'}
              </dd>
            </div>
          </dl>

          <section aria-labelledby="money-pay" className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 id="money-pay" className="text-[15px] font-semibold text-ink">
                Pay right now
              </h3>
              <span className="text-[22px] font-semibold tabular-nums text-ink">{formatMultiplier(multiplier)}</span>
            </div>

            {notice && (
              <p
                role="status"
                className={cn(
                  'flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[13px] animate-fadeIn',
                  notice.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
                )}
              >
                {notice.ok && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
                {notice.text}
              </p>
            )}

            {rentDue && (
              <div className="flex flex-col gap-3 rounded-2xl border border-gold/30 bg-gold-soft p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13px] leading-relaxed text-ink">
                  Your home adds <span className="font-semibold">{formatBonus(homeBonus)}</span> on days the rent is paid.
                  {wallet < housing.rentPerDay && (
                    <span className="text-ink-muted"> You need {housing.rentPerDay - wallet} more tokens.</span>
                  )}
                </p>
                <Button variant="gold" size="sm" onClick={payRent} disabled={wallet < housing.rentPerDay} className="shrink-0">
                  Pay rent <Tokens amount={housing.rentPerDay} />
                </Button>
              </div>
            )}

            {boosts.length > 0 ? (
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {boosts.map(boost => (
                  <li key={boost.id} className="flex items-center justify-between gap-3 bg-canvas px-4 py-2.5 text-[13px]">
                    <span className="min-w-0 truncate text-ink">{boost.label}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {boost.endsAt && (
                        <span className="flex items-center gap-1 text-xs text-ink-subtle">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {formatTimeLeft(boost.endsAt, now)}
                        </span>
                      )}
                      <span className="font-medium tabular-nums text-gold">{formatBonus(boost.bonus)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              !rentDue && (
                <p className="rounded-2xl border border-dashed border-line-strong px-4 py-3.5 text-[13px] leading-relaxed text-ink-muted">
                  Nothing is raising your pay right now.{' '}
                  {homeBonus > 0
                    ? 'A café meal adds a boost for a while.'
                    : 'A café meal adds a boost for a while, and bigger homes add one on days you pay their rent.'}
                </p>
              )
            )}
          </section>

          <section aria-labelledby="money-earned" className="space-y-2">
            <h3 id="money-earned" className="text-[15px] font-semibold text-ink">
              Earned
            </h3>
            {earned.length === 0 ? (
              <p className="text-[13px] text-ink-subtle">Nothing yet today. Reviews, mock exams and study sessions all pay.</p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {earned.map(group => (
                  <li key={group.activity} className="flex items-center justify-between gap-3 bg-canvas px-4 py-2.5 text-[13px]">
                    <span className="min-w-0">
                      <span className="block truncate text-ink">{group.activity}</span>
                      <span className="block text-xs text-ink-subtle">
                        {group.count === 1 ? 'once' : `${group.count} times`}
                        {group.fromBoosts > 0 && ` · ${group.fromBoosts} from boosts`}
                      </span>
                    </span>
                    <Tokens amount={group.total} signed className="shrink-0 text-success" />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="money-spent" className="space-y-2">
            <h3 id="money-spent" className="text-[15px] font-semibold text-ink">
              Spent
            </h3>
            {ledger.expenses.length === 0 ? (
              <p className="text-[13px] text-ink-subtle">Nothing spent today.</p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {ledger.expenses.map(expense => (
                  <li key={expense.id} className="flex items-center justify-between gap-3 bg-canvas px-4 py-2.5 text-[13px]">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="text-base" aria-hidden="true">
                        {expense.emoji}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-ink">{expense.name}</span>
                        <span className="block text-xs text-ink-subtle">{expense.purchasedAt}</span>
                      </span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums text-ink-muted">−{expense.cost.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <DialogFooter className="justify-end">
          <Button onClick={onOpenCafe}>Café</Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};

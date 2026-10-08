import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { CAFETERIA_MENU, lifeSimService } from '../../services/lifeSimService';
import type { MealItem } from '../../types/lifeSim';
import { cn } from '../../utils/cn';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Button, Tokens } from '../ui/primitives';
import { formatBonus, formatTimeLeft } from './campusFormat';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'drink', label: 'Drinks and snacks' },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

const inCategory = (meal: MealItem, category: CategoryId) =>
  category === 'all' || meal.category === category || (category === 'drink' && meal.category === 'snack');

/** What a meal does to pay, read from its numbers rather than its blurb. */
const effectOf = (meal: MealItem): string | null =>
  meal.buffType === 'coin_multiplier' && meal.buffValue > 1 && meal.buffDurationMinutes > 0
    ? `${formatBonus(meal.buffValue - 1)} pay for ${meal.buffDurationMinutes} min`
    : null;

/** The campus café: meals that raise pay for a while. */
export const CafeDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [category, setCategory] = useState<CategoryId>('all');
  const [wallet, setWallet] = useState(() => lifeSimService.getWalletBalance());
  const [boosts, setBoosts] = useState(() => lifeSimService.getPayBoosts());
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const refresh = () => {
      setWallet(lifeSimService.getWalletBalance());
      setBoosts(lifeSimService.getPayBoosts());
      setNow(Date.now());
    };
    const unsubscribe = lifeSimService.subscribe(refresh);
    // Keeps "minutes left" current, and drops a boost once it runs out.
    const timer = setInterval(refresh, 30_000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const mealBoost = boosts.find(boost => boost.endsAt);
  const meals = CAFETERIA_MENU.filter(meal => inCategory(meal, category));

  const buy = (meal: MealItem) => {
    const result = lifeSimService.buyMeal(meal.id);
    if (!result.success) {
      setNotice({ text: result.error || 'Could not buy that just now.', ok: false });
      return;
    }
    const effect = effectOf(meal);
    setNotice({ text: effect ? `${meal.name}: ${effect}.` : `${meal.name}. Enjoy. It has no pay boost.`, ok: true });
  };

  return (
    <Dialog isOpen onClose={onClose} titleId="cafe-title" className="max-w-xl">
      <DialogPanel>
        <DialogHeader
          titleId="cafe-title"
          title="Café"
          description="A meal raises your pay for a while. Buying another replaces the boost you have."
          onClose={onClose}
        >
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span className="flex items-center gap-1.5 text-ink-muted">
              {mealBoost ? (
                <>
                  <Clock className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                  <span>
                    <span className="font-medium text-ink">{mealBoost.label}</span>: {formatBonus(mealBoost.bonus)} pay,{' '}
                    {formatTimeLeft(mealBoost.endsAt!, now)}
                  </span>
                </>
              ) : (
                'No meal boost right now.'
              )}
            </span>
            <span className="flex items-center gap-1.5 text-ink-subtle">
              You have <Tokens amount={wallet} className="text-ink" />
            </span>
          </div>
          <div role="group" aria-label="Menu" className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1 pb-0.5 no-scrollbar">
            {CATEGORIES.map(item => (
              <button
                key={item.id}
                type="button"
                aria-pressed={category === item.id}
                onClick={() => setCategory(item.id)}
                className={cn(
                  'h-8 shrink-0 rounded-lg px-3 text-[13px] font-medium transition-colors cursor-pointer',
                  category === item.id ? 'bg-ink text-canvas' : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
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
          <ul className="space-y-2">
            {meals.map(meal => {
              const effect = effectOf(meal);
              const short = meal.cost - wallet;
              return (
                <li key={meal.id} className="flex items-center gap-3 rounded-2xl border border-line bg-canvas p-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-hover text-2xl" aria-hidden="true">
                    {meal.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium leading-snug text-ink">{meal.name}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-ink-subtle">{meal.subtitle}</p>
                    <p className="mt-1 text-xs">
                      {effect ? <span className="font-medium text-gold">{effect}</span> : <span className="text-ink-subtle">No pay boost</span>}
                      {short > 0 && <span className="text-ink-subtle"> · need {short} more</span>}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={meal.cost === 0 ? 'secondary' : 'gold'}
                    disabled={short > 0}
                    onClick={() => buy(meal)}
                    aria-label={meal.cost === 0 ? `Have ${meal.name}, free` : `Buy ${meal.name} for ${meal.cost} tokens`}
                    className="shrink-0"
                  >
                    {meal.cost === 0 ? 'Free' : <Tokens amount={meal.cost} />}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>

        <DialogFooter className="justify-end">
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};

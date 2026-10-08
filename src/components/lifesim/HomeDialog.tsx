import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, Lock } from 'lucide-react';
import { HOME_ROOMS, HOUSING_CATALOG, lifeSimService } from '../../services/lifeSimService';
import type { HomeRoomId, HousingProperty } from '../../types/lifeSim';
import { cn } from '../../utils/cn';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Badge, Button, ProgressBar, Tokens } from '../ui/primitives';
import { formatBonus } from './campusFormat';

const roomName = (id: HomeRoomId) => HOME_ROOMS.find(room => room.id === id)?.name ?? id;

/** Rooms a home adds over the one before it. */
const newRoomsOf = (home: HousingProperty) => {
  const previous = HOUSING_CATALOG.find(other => other.level === home.level - 1);
  return home.unlockedRooms.filter(id => !previous?.unlockedRooms.includes(id));
};

const payLine = (home: HousingProperty) =>
  home.wageMultiplier > 1
    ? `${formatBonus(home.wageMultiplier - 1)} pay on days the rent is paid · rent ${home.rentPerDay} a day`
    : 'No rent and no pay bonus';

/** Your home and the ones above it: what each adds, and what it takes to move up. */
export const HomeDialog: React.FC<{
  reviews: number;
  onClose: () => void;
  onUpgraded: (home: HousingProperty) => void;
}> = ({ reviews, onClose, onUpgraded }) => {
  const [home, setHome] = useState(() => lifeSimService.getHousing());
  const [wallet, setWallet] = useState(() => lifeSimService.getWalletBalance());
  const [rentPaid, setRentPaid] = useState(() => lifeSimService.isRentPaidToday());
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(
    () =>
      lifeSimService.subscribe(() => {
        setHome(lifeSimService.getHousing());
        setWallet(lifeSimService.getWalletBalance());
        setRentPaid(lifeSimService.isRentPaidToday());
      }),
    [],
  );

  const payRent = () => {
    const result = lifeSimService.payDailyRent();
    setNotice(
      result.success
        ? { text: `Rent paid. Your ${formatBonus(home.wageMultiplier - 1)} home bonus is on until the day ends.`, ok: true }
        : { text: result.error || 'Could not pay the rent just now.', ok: false },
    );
  };

  const upgrade = (target: HousingProperty) => {
    const result = lifeSimService.upgradeHousing(target.id);
    if (result.success && result.property) onUpgraded(result.property);
    else setNotice({ text: result.error || 'Could not upgrade just now.', ok: false });
  };

  return (
    <Dialog isOpen onClose={onClose} titleId="home-title" className="max-w-2xl">
      <DialogPanel>
        <DialogHeader
          titleId="home-title"
          title="Your home"
          description="Bigger homes add rooms to furnish, and raise your pay on days you pay their rent."
          onClose={onClose}
        />

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
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

          <section className="rounded-2xl border border-brand/30 bg-brand-soft p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-solid text-2xl" aria-hidden="true">
                  {home.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-brand-text">
                    You live here · level {home.level} of {HOUSING_CATALOG.length}
                  </p>
                  <p className="mt-0.5 text-[15px] font-semibold leading-snug text-ink">{home.name}</p>
                  <p className="mt-0.5 text-[13px] text-ink-muted">{payLine(home)}</p>
                </div>
              </div>
              {home.rentPerDay > 0 &&
                (rentPaid ? (
                  <Badge tone="success">
                    <Check className="h-3 w-3" aria-hidden="true" />
                    Rent paid today
                  </Badge>
                ) : (
                  <Button variant="gold" size="sm" onClick={payRent} disabled={wallet < home.rentPerDay}>
                    Pay rent <Tokens amount={home.rentPerDay} />
                  </Button>
                ))}
            </div>
            <p className="mt-3 text-xs text-ink-subtle">Rooms: {home.unlockedRooms.map(roomName).join(', ')}</p>
          </section>

          <ol className="space-y-2.5" aria-label="Homes">
            {HOUSING_CATALOG.map(tier => {
              const isDone = tier.level < home.level;
              const isCurrent = tier.id === home.id;
              const isNext = tier.level === home.level + 1;
              const added = newRoomsOf(tier);
              if (isCurrent) return null;
              return (
                <li
                  key={tier.id}
                  className={cn(
                    'rounded-2xl border p-4',
                    isNext ? 'border-line-strong bg-canvas' : 'border-line bg-canvas',
                    !isNext && !isDone && 'opacity-70',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl',
                        isDone ? 'bg-success-soft text-success' : 'bg-surface-hover',
                      )}
                      aria-hidden="true"
                    >
                      {isDone ? <Check className="h-5 w-5" /> : isNext ? tier.icon : <Lock className="h-4 w-4 text-ink-subtle" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-semibold text-ink">{tier.name}</p>
                        <Badge>Level {tier.level}</Badge>
                        {isDone && <Badge tone="success">Done</Badge>}
                      </div>
                      <p className="mt-0.5 text-[13px] text-ink-muted">{payLine(tier)}</p>
                      {added.length > 0 && <p className="mt-0.5 text-xs text-ink-subtle">Adds {added.map(roomName).join(', ')}</p>}

                      {isNext && (
                        <div className="mt-3.5 space-y-3">
                          <Requirement
                            label="Cards reviewed"
                            have={reviews}
                            need={tier.minCardsReviewed}
                          />
                          <Requirement label="Tokens" have={wallet} need={tier.upgradeCost} tone="gold" />
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                            <p className="text-xs text-ink-subtle">
                              {reviews < tier.minCardsReviewed
                                ? `Review ${tier.minCardsReviewed - reviews} more cards to unlock it.`
                                : wallet < tier.upgradeCost
                                  ? `Earn ${tier.upgradeCost - wallet} more tokens to afford it.`
                                  : 'Ready. Today counts as paid rent.'}
                            </p>
                            <Button
                              variant="gold"
                              size="sm"
                              onClick={() => upgrade(tier)}
                              disabled={reviews < tier.minCardsReviewed || wallet < tier.upgradeCost}
                            >
                              Upgrade <Tokens amount={tier.upgradeCost} />
                            </Button>
                          </div>
                        </div>
                      )}
                      {!isNext && !isDone && (
                        <p className="mt-1.5 text-xs text-ink-subtle">
                          After level {tier.level - 1}: {tier.minCardsReviewed} cards reviewed and {tier.upgradeCost} tokens.
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <DialogFooter className="justify-end">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};

const Requirement: React.FC<{ label: string; have: number; need: number; tone?: 'brand' | 'gold' }> = ({
  label,
  have,
  need,
  tone = 'brand',
}) => {
  const met = have >= need;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-ink-muted">
          {met && <Check className="h-3 w-3 text-success" aria-hidden="true" />}
          {label}
        </span>
        <span className="tabular-nums text-ink-subtle">
          <span className={cn('font-medium', met ? 'text-success' : 'text-ink')}>{Math.min(have, need).toLocaleString()}</span> of{' '}
          {need.toLocaleString()}
        </span>
      </div>
      <ProgressBar value={need > 0 ? (have / need) * 100 : 100} tone={met ? 'success' : tone} className="mt-1.5" label={label} />
    </div>
  );
};

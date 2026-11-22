import React, { useEffect, useState } from 'react';
import { ArrowRight, Flame, Swords, Trophy, Users } from 'lucide-react';
import { FriendsService, friendStatus, leaderboard, type Friend } from '../../services/friendsService';
import { DuelService, duelOutcome, type Duel } from '../../services/duelService';
import { StorageService } from '../../services/storageService';
import { cn } from '../../utils/cn';
import { Badge, Button, Card } from '../ui/primitives';
import { FriendAvatar } from './FriendAvatar';
import { FriendsDialog } from './FriendsDialog';
import { DuelDialog, type DuelDialogMode } from './DuelDialog';

/** Rows of the weekly ranking shown on Today; the rest are in the dialog. */
const RANKS_ON_TODAY = 5;
/** Finished duels shown, from the past week. */
const RECENT_RESULTS = 3;
const WEEK_MS = 7 * 86_400_000;

/** Today's card: friends ranked by this week's XP, challenges to answer, and recent duel results. */
export const FriendsCard: React.FC<{ user: { id: string; name: string } | null; onOpenAuth?: () => void }> = ({ user, onOpenAuth }) => {
  const signedIn = !!user;
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [duelMode, setDuelMode] = useState<DuelDialogMode | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    const load = () => {
      void FriendsService.load().then(res => {
        if (alive && res.ok) setFriends(res.data.friends);
      });
      void DuelService.list().then(res => {
        if (alive && res.ok) setDuels(res.data);
      });
    };
    load();
    const unsubscribeFriends = FriendsService.subscribe(load);
    const unsubscribeDuels = DuelService.subscribe(load);
    return () => {
      alive = false;
      unsubscribeFriends();
      unsubscribeDuels();
    };
  }, [signedIn]);

  // One of each dialog for every look of the card, so a change of look doesn't close them.
  const dialogs = (
    <>
      {signedIn && <FriendsDialog isOpen={isOpen} onClose={() => setIsOpen(false)} onChallenge={friend => setDuelMode({ kind: 'challenge', friend, friends: friends ?? [] })} />}
      {duelMode && <DuelDialog mode={duelMode} onClose={() => setDuelMode(null)} />}
    </>
  );

  // Signed in and still loading (or offline): nothing yet.
  if (signedIn && friends === null && !isOpen) return null;

  if (!signedIn || !friends || friends.length === 0) {
    return (
      <>
        <Card className="flex items-center gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text" aria-hidden="true">
            <Users className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-ink">Study with friends</p>
            <p className="text-[13px] text-ink-subtle">
              {signedIn ? 'Add classmates, race up the weekly ranking and challenge them to duels.' : 'Sign in to add friends, see their streaks and challenge them.'}
            </p>
          </div>
          <Button size="sm" trailingIcon={ArrowRight} onClick={signedIn ? () => setIsOpen(true) : onOpenAuth}>
            {signedIn ? 'Add' : 'Sign in'}
          </Button>
        </Card>
        {dialogs}
      </>
    );
  }

  const stats = StorageService.getStats();
  const ranking = leaderboard(friends, { id: user!.id, name: 'You', weekXp: StorageService.getWeeklyXP().current, streak: stats.currentStreak });
  const yourRank = ranking.findIndex(row => row.isYou);
  // The top rows, and your own row if you're further down.
  const shown = ranking.slice(0, RANKS_ON_TODAY);
  if (yourRank >= RANKS_ON_TODAY) shown.push(ranking[yourRank]);

  const toPlay = duels.filter(d => d.status === 'your-turn');
  const results = duels.filter(d => d.status === 'done' && now.getTime() - Date.parse(d.completedAt ?? d.createdAt) < WEEK_MS).slice(0, RECENT_RESULTS);
  const waiting = duels.filter(d => d.status === 'waiting').length;

  return (
    <>
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-ink">Friends this week</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" icon={Swords} onClick={() => setDuelMode({ kind: 'challenge', friends })}>
              Challenge
            </Button>
            <Button variant="ghost" size="sm" trailingIcon={ArrowRight} onClick={() => setIsOpen(true)}>
              Friends
            </Button>
          </div>
        </div>

        {toPlay.length > 0 && (
          <ul className="space-y-2">
            {toPlay.map(duel => (
              <li key={duel.id} className="flex items-center gap-3 rounded-xl border border-brand/40 bg-brand-soft px-3 py-2">
                <Swords className="h-4 w-4 shrink-0 text-brand-text" aria-hidden="true" />
                <p className="min-w-0 flex-1 truncate text-[13px] text-ink">
                  <span className="font-medium">{duel.them.name}</span> challenged you on {duel.deckTitle}
                </p>
                <Button size="sm" variant="primary" onClick={() => setDuelMode({ kind: 'duel', duel })}>
                  Play
                </Button>
              </li>
            ))}
          </ul>
        )}

        <ol className="space-y-1" aria-label="This week's ranking by XP">
          {shown.map(row => {
            const rank = ranking.indexOf(row) + 1;
            return (
              <li key={row.id} className={cn('flex min-w-0 items-center gap-3 rounded-xl px-3 py-2', row.isYou ? 'bg-brand-soft/60' : 'bg-canvas')}>
                <span className={cn('w-5 shrink-0 text-center text-[13px] font-semibold tabular-nums', rank === 1 ? 'text-gold' : 'text-ink-subtle')}>
                  {rank === 1 ? <Trophy className="mx-auto h-4 w-4" aria-label="First" /> : rank}
                </span>
                {row.friend ? (
                  <FriendAvatar friend={row.friend} className="h-8 w-8 text-base" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-semibold text-white" aria-hidden="true">
                    You
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">{row.isYou ? 'You' : row.name}</p>
                  {row.friend && <p className="truncate text-xs text-ink-subtle">{friendStatus(row.friend, now)}</p>}
                </div>
                <span className="shrink-0 text-[13px] font-medium tabular-nums text-ink">{row.weekXp} XP</span>
                <span className="inline-flex w-9 shrink-0 items-center justify-end gap-0.5 text-[13px] tabular-nums text-ink-muted" title={`${row.streak}-day streak`}>
                  <Flame className={row.streak > 0 ? 'h-3.5 w-3.5 text-gold' : 'h-3.5 w-3.5 text-ink-subtle'} aria-hidden="true" />
                  {row.streak}
                  <span className="sr-only">-day streak</span>
                </span>
              </li>
            );
          })}
        </ol>

        {(results.length > 0 || waiting > 0) && (
          <div className="space-y-1.5 border-t border-line pt-3">
            {results.map(duel => {
              const outcome = duelOutcome(duel);
              return (
                <button
                  key={duel.id}
                  type="button"
                  onClick={() => setDuelMode({ kind: 'duel', duel })}
                  className="flex w-full items-center gap-2 text-left text-[13px] text-ink-muted hover:text-ink cursor-pointer"
                >
                  <Swords className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">
                    You {duel.you.score}–{duel.them.score} {duel.them.name} · {duel.deckTitle}
                  </span>
                  <Badge tone={outcome === 'won' ? 'success' : outcome === 'lost' ? 'danger' : 'neutral'}>
                    {outcome === 'won' ? 'Won' : outcome === 'lost' ? 'Lost' : 'Draw'}
                  </Badge>
                </button>
              );
            })}
            {waiting > 0 && (
              <p className="text-xs text-ink-subtle">
                {waiting} {waiting === 1 ? 'challenge is' : 'challenges are'} waiting for your friends to play.
              </p>
            )}
          </div>
        )}
      </Card>
      {dialogs}
    </>
  );
};

import React, { useEffect, useState } from 'react';
import { ArrowRight, Flame, Users } from 'lucide-react';
import { FriendsService, friendStatus, sortFriends, type Friend } from '../../services/friendsService';
import { Button, Card } from '../ui/primitives';
import { FriendAvatar } from './FriendAvatar';
import { FriendsDialog } from './FriendsDialog';

/** Friends shown on Today; the rest are in the dialog. */
const FRIENDS_ON_TODAY = 5;

/** Today's card: how friends are doing, or an invitation to add some. */
export const FriendsCard: React.FC<{ signedIn: boolean; onOpenAuth?: () => void }> = ({ signedIn, onOpenAuth }) => {
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [now] = useState(() => new Date());

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    const load = () =>
      void FriendsService.load().then(res => {
        if (alive && res.ok) setFriends(res.data.friends);
      });
    load();
    const unsubscribe = FriendsService.subscribe(load);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [signedIn]);

  // One dialog for both looks of the card, so adding the first friend doesn't close it.
  const dialog = signedIn && <FriendsDialog isOpen={isOpen} onClose={() => setIsOpen(false)} />;

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
              {signedIn ? "Add classmates and see each other's streaks." : 'Sign in to add friends and see their streaks.'}
            </p>
          </div>
          <Button size="sm" trailingIcon={ArrowRight} onClick={signedIn ? () => setIsOpen(true) : onOpenAuth}>
            {signedIn ? 'Add' : 'Sign in'}
          </Button>
        </Card>
        {dialog}
      </>
    );
  }

  const sorted = sortFriends(friends, now);
  return (
    <>
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-ink">Friends</h2>
          <Button variant="ghost" size="sm" trailingIcon={ArrowRight} onClick={() => setIsOpen(true)}>
            {friends.length > FRIENDS_ON_TODAY ? `All ${friends.length}` : 'Manage'}
          </Button>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {sorted.slice(0, FRIENDS_ON_TODAY).map(friend => (
            <li key={friend.id} className="flex min-w-0 items-center gap-3 rounded-xl bg-canvas px-3 py-2">
              <FriendAvatar friend={friend} className="h-8 w-8 text-base" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">{friend.name}</p>
                <p className="truncate text-xs text-ink-subtle">{friendStatus(friend, now)}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-[13px] tabular-nums text-ink-muted" title={`${friend.streak}-day streak`}>
                <Flame className={friend.streak > 0 ? 'h-4 w-4 text-gold' : 'h-4 w-4 text-ink-subtle'} aria-hidden="true" />
                {friend.streak}
                <span className="sr-only">-day streak</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {dialog}
    </>
  );
};

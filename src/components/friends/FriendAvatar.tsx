import React from 'react';
import type { Friend } from '../../services/friendsService';
import { cn } from '../../utils/cn';

/** A friend's picture, or their emoji avatar. */
export const FriendAvatar: React.FC<{ friend: Friend; className?: string }> = ({ friend, className }) =>
  friend.pictureUrl ? (
    <img src={friend.pictureUrl} alt="" referrerPolicy="no-referrer" className={cn('h-9 w-9 shrink-0 rounded-full object-cover', className)} />
  ) : (
    <span aria-hidden="true" className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-hover text-lg', className)}>
      {friend.avatar}
    </span>
  );

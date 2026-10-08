import React, { useState } from 'react';
import { Check, Copy, Flame, Share2 } from 'lucide-react';
import type { StudySession, UserStats } from '../../types';
import { soundEngine } from '../../services/soundEngine';
import { UserAvatarBadge } from '../character/UserAvatarBadge';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { BrandMark, Button } from '../ui/primitives';

interface SynapticFlexModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: StudySession;
  stats: UserStats;
}

/** A card to share after a session, with the text to paste wherever friends are. */
export const SynapticFlexModal: React.FC<SynapticFlexModalProps> = ({ isOpen, onClose, session, stats }) => {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const minutes = Math.max(1, Math.round(session.elapsedSeconds / 60));
  const cards = session.concepts.reduce((sum, concept) => sum + concept.retrievalCards.length, 0);
  const streak = stats.currentStreak;

  const shareText =
    `I just studied “${session.title}” on Studify: ${minutes} min, ${session.concepts.length} ` +
    `${session.concepts.length === 1 ? 'concept' : 'concepts'}, ${cards} ${cards === 1 ? 'card' : 'cards'}.` +
    (streak > 1 ? ` ${streak}-day streak.` : '');
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setCopyFailed(false);
      soundEngine.playSuccess();
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyFailed(true);
    }
  };

  const share = async () => {
    try {
      await navigator.share({ text: shareText });
    } catch {
      // Closing the share sheet rejects too; nothing to do.
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId="share-title" className="max-w-md">
      <DialogPanel>
        <DialogHeader titleId="share-title" title="Share your session" description="Copy it into a group chat or a study server." onClose={onClose} />

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <figure className="relative overflow-hidden rounded-3xl border border-line-strong bg-canvas p-5">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/20 blur-3xl" aria-hidden="true" />
            <div className="relative flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <BrandMark size={22} />
                Studify
              </span>
              {streak > 0 && (
                <span className="flex items-center gap-1 text-xs font-medium text-gold">
                  <Flame className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  {streak}-day streak
                </span>
              )}
            </div>
            <div className="relative mt-5 flex items-center gap-3.5">
              <UserAvatarBadge size="md" />
              <div className="min-w-0">
                <p className="text-xs text-ink-subtle">{session.category || 'Studied'}</p>
                <p className="mt-0.5 line-clamp-2 text-[17px] font-semibold leading-snug text-ink">{session.title}</p>
              </div>
            </div>
            <dl className="relative mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
              {[
                { label: 'Minutes', value: minutes },
                { label: session.concepts.length === 1 ? 'Concept' : 'Concepts', value: session.concepts.length },
                { label: cards === 1 ? 'Card' : 'Cards', value: cards },
              ].map(stat => (
                <div key={stat.label} className="flex flex-col-reverse">
                  <dt className="text-xs text-ink-subtle">{stat.label}</dt>
                  <dd className="text-[22px] font-semibold tabular-nums text-ink">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </figure>

          <p className="rounded-2xl bg-surface-hover px-4 py-3 text-[13px] leading-relaxed text-ink-muted">{shareText}</p>
          {copyFailed && (
            <p className="text-xs text-danger" role="alert">
              Your browser blocked copying. Select the text above and copy it yourself.
            </p>
          )}
        </div>

        <DialogFooter className="justify-end">
          {canShare && (
            <Button icon={Share2} onClick={() => void share()}>
              Share…
            </Button>
          )}
          <Button variant="primary" icon={copied ? Check : Copy} onClick={() => void copy()} data-autofocus>
            {copied ? 'Copied' : 'Copy text'}
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};

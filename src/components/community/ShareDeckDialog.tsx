import React, { useId, useState } from 'react';
import { Check, Copy, Lock, Share2, UserRound } from 'lucide-react';
import type { StudySession, UserAccount } from '../../types';
import { AuthService } from '../../services/authService';
import { CommunityService, absoluteShareUrl } from '../../services/communityService';
import { ANONYMOUS_AUTHOR, authorPreview } from '../../services/deckSharing';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Button } from '../ui/primitives';

const MIN_DESCRIPTION = 20;

const fieldClass =
  'w-full rounded-xl border border-line-strong bg-canvas px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none';

/**
 * Shares a deck with other students: says what is shared (and what never is), how the author is
 * shown, and asks the sharer to confirm the cards are theirs to share. Then gives a link to copy.
 */
export const ShareDeckDialog: React.FC<{
  session: StudySession;
  onClose: () => void;
  onOpenSignUp?: () => void;
}> = ({ session, onClose, onOpenSignUp }) => {
  const titleId = useId();
  const [user] = useState<UserAccount | null>(() => AuthService.getCurrentUser());
  const [title, setTitle] = useState(session.title);
  const [subject, setSubject] = useState(session.category || 'General');
  const [description, setDescription] = useState(session.description || '');
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shownAs = authorPreview(user);
  const cardCount = session.concepts.reduce((n, c) => n + c.retrievalCards.filter(card => !card.hidden).length, 0);
  const ready = title.trim().length > 0 && description.trim().length >= MIN_DESCRIPTION && rights && !busy;

  const share = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    const result = await CommunityService.shareDeck({ session, title: title.trim(), subject: subject.trim() || 'General', description: description.trim(), rightsConfirmed: rights });
    setBusy(false);
    if (result.success) setShareUrl(absoluteShareUrl(result.shareUrl));
    else setError(result.error);
  };

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The link stays selected in the box to copy by hand.
    }
  };

  return (
    <Dialog isOpen onClose={busy ? () => {} : onClose} titleId={titleId} className="max-w-lg">
      <DialogPanel className="max-h-[92dvh]">
        <DialogHeader
          titleId={titleId}
          title={shareUrl ? 'Your deck is shared' : 'Share this deck'}
          description={shareUrl ? undefined : 'Classmates can add it with a link, and other students can find it in Community.'}
          onClose={busy ? undefined : onClose}
        />

        {!user ? (
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <p className="text-[14px] leading-relaxed text-ink-muted">Sign up free to share decks. Your decks stay yours, and you can unshare them at any time.</p>
            {onOpenSignUp && (
              <Button variant="primary" onClick={onOpenSignUp}>
                Sign up free
              </Button>
            )}
          </div>
        ) : shareUrl ? (
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <p className="text-[14px] leading-relaxed text-ink-muted">Anyone with this link can add the deck to their library. It is also listed in Library → Community.</p>
            <div className="flex gap-2">
              <input readOnly value={shareUrl} onFocus={e => e.currentTarget.select()} aria-label="Share link" className={`${fieldClass} min-w-0 flex-1 text-[14px]`} />
              <Button variant="primary" icon={copied ? Check : Copy} onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="text-xs text-ink-subtle">To unshare it, open Library → Community → Shared by you.</p>
          </div>
        ) : (
          <form id="share-deck-form" onSubmit={share} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            <label className="block space-y-1.5">
              <span className="text-[13px] font-medium text-ink">Title</span>
              <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} required className={fieldClass} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[13px] font-medium text-ink">Subject</span>
              <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={60} placeholder="e.g. Biology" className={fieldClass} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[13px] font-medium text-ink">What is it for?</span>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="e.g. Chapter 7 of AP Biology: cellular respiration, for the unit test."
                className={`${fieldClass} resize-none`}
              />
              {description.trim().length > 0 && description.trim().length < MIN_DESCRIPTION && (
                <span className="text-xs text-ink-subtle">A little more, please: a sentence helps others find it.</span>
              )}
            </label>

            <div className="space-y-2 rounded-2xl border border-line bg-surface p-3.5 text-[13px] text-ink-muted">
              <p className="flex items-start gap-2">
                <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-text" aria-hidden="true" />
                <span>
                  <span className="font-medium text-ink">Shared:</span> the {cardCount} {cardCount === 1 ? 'card' : 'cards'} and their explanations.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                <span>
                  <span className="font-medium text-ink">Never shared:</span> your progress, hidden cards, sketches, notes or PDF.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                <span>
                  <span className="font-medium text-ink">Shown as:</span> {shownAs}
                  {shownAs === ANONYMOUS_AUTHOR && ' (students under 16 are never named)'}
                </span>
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-ink-muted">
              <input type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]" />
              <span>I made these cards, or I have the right to share them. They are not copied word for word from a textbook or someone else's work.</span>
            </label>

            {error && (
              <p role="alert" className="text-[13px] text-danger">
                {error}
              </p>
            )}
          </form>
        )}

        {user && !shareUrl && (
          <DialogFooter className="justify-end">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="share-deck-form" variant="primary" icon={Share2} disabled={!ready}>
              {busy ? 'Checking and sharing…' : 'Share deck'}
            </Button>
          </DialogFooter>
        )}
      </DialogPanel>
    </Dialog>
  );
};

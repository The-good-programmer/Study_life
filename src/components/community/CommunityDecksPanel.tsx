import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Flag, Heart, Link2, Plus, Trash2, UserRound } from 'lucide-react';
import type { StudySession } from '../../types';
import { AuthService } from '../../services/authService';
import { CommunityService, absoluteShareUrl, type MySharedDeck, type PublicDeckSummary } from '../../services/communityService';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Mascot } from '../mascot/Mascot';
import { ActionMenu } from '../ui/ActionMenu';
import { Badge, Button } from '../ui/primitives';

const shareLinkOf = (slug: string) => absoluteShareUrl(`/?shared=${encodeURIComponent(slug)}`);

const REPORT_REASONS = [
  'Wrong or misleading answers',
  'Copied from a textbook or someone else (copyright)',
  'Inappropriate or unsafe',
  'Spam or advertising',
];

/** The Library's Community tab: decks other students shared, and the ones you shared. */
export const CommunityDecksPanel: React.FC<{
  query: string;
  onAdded: () => void;
  onStartSession: (session: StudySession) => void;
  onOpenAuth?: () => void;
}> = ({ query, onAdded, onStartSession, onOpenAuth }) => {
  const [signedIn] = useState(() => Boolean(AuthService.getCurrentUser()));
  const [decks, setDecks] = useState<PublicDeckSummary[] | null>(null);
  const [mine, setMine] = useState<MySharedDeck[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, StudySession>>({});
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [reporting, setReporting] = useState<PublicDeckSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Searches as the student types, a moment after they stop.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await CommunityService.getPublicDecks(query);
      if (cancelled) return;
      if (result.success) {
        setDecks(result.decks);
        setError(null);
      } else {
        setDecks([]);
        setError(result.error);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const loadMine = useCallback(async () => {
    const result = await CommunityService.getMyDecks();
    if (result.success) setMine(result.decks);
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    void CommunityService.getMyDecks().then(result => {
      if (!cancelled && result.success) setMine(result.decks);
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const add = async (deck: PublicDeckSummary) => {
    setBusySlug(deck.slug);
    const result = await CommunityService.addToLibrary(deck.slug);
    setBusySlug(null);
    if (result.success) {
      setAdded(prev => ({ ...prev, [deck.slug]: result.session }));
      onAdded();
    } else {
      setNotice(result.error);
    }
  };

  const copyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(shareLinkOf(slug));
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 2000);
    } catch {
      setNotice(shareLinkOf(slug));
    }
  };

  const unshare = async (deck: MySharedDeck) => {
    if (!window.confirm(`Unshare "${deck.title}"? The link stops working, and copies others already added stay theirs.`)) return;
    const result = await CommunityService.unshareDeck(deck.slug);
    if (result.success) {
      setMine(prev => prev.filter(d => d.slug !== deck.slug));
      setDecks(prev => prev?.filter(d => d.slug !== deck.slug) ?? prev);
    } else {
      setNotice(result.error);
    }
  };

  return (
    <div className="space-y-5">
      {notice && (
        <p role="status" className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink-muted">
          {notice}
        </p>
      )}

      {signedIn && mine.length > 0 && (
        <section aria-labelledby="shared-by-you" className="space-y-2">
          <h3 id="shared-by-you" className="text-[13px] font-semibold text-ink">
            Shared by you
          </h3>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {mine.map(deck => (
              <li key={deck.slug} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-ink">{deck.title}</p>
                  <p className="text-xs text-ink-subtle">
                    {deck.card_count} cards · {deck.likes} {deck.likes === 1 ? 'like' : 'likes'}
                    {deck.hidden && ' · hidden after reports'}
                  </p>
                </div>
                <Button variant="ghost" size="sm" icon={copiedSlug === deck.slug ? Check : Link2} onClick={() => copyLink(deck.slug)}>
                  {copiedSlug === deck.slug ? 'Copied' : 'Copy link'}
                </Button>
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => unshare(deck)}>
                  Unshare
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {decks === null ? (
        <p className="py-8 text-center text-[13px] text-ink-subtle" role="status">
          Loading shared decks…
        </p>
      ) : error ? (
        <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-[13px] text-ink-muted">{error}</div>
      ) : decks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
          <Mascot mood="sleepy" className="mx-auto h-20 w-24 text-ink" />
          <p className="mt-3 text-[15px] font-medium text-ink">{query ? 'No shared decks match your search' : 'No shared decks yet'}</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-subtle">
            Be the first: open one of your decks and press Share.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {decks.map(deck => {
            const copy = added[deck.slug];
            return (
              <article key={deck.slug} className="flex flex-col rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <Badge>{deck.subject || 'General'}</Badge>
                  <ActionMenu
                    label={`More actions for ${deck.title}`}
                    items={[
                      { label: copiedSlug === deck.slug ? 'Link copied' : 'Copy link', icon: Copy, onSelect: () => copyLink(deck.slug) },
                      {
                        label: 'Report',
                        icon: Flag,
                        tone: 'danger',
                        onSelect: () => (signedIn ? setReporting(deck) : onOpenAuth?.()),
                      },
                    ]}
                  />
                </div>
                <h3 className="mt-3 line-clamp-2 text-[15px] font-medium leading-snug text-ink">{deck.title}</h3>
                {deck.description && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-subtle">{deck.description}</p>}
                <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-[13px] text-ink-subtle">
                  <span className="inline-flex items-center gap-1">
                    <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                    {deck.author_name}
                  </span>
                  <span>{deck.card_count} cards</span>
                  {deck.likes > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" aria-hidden="true" />
                      {deck.likes}
                    </span>
                  )}
                </p>
                <div className="mt-3">
                  {copy ? (
                    <Button variant="primary" size="sm" icon={Check} onClick={() => onStartSession({ ...copy, currentPhase: 'retrieval', casualFlashcardMode: true })} className="w-full">
                      Added. Study now
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" icon={Plus} onClick={() => add(deck)} disabled={busySlug === deck.slug} className="w-full">
                      {busySlug === deck.slug ? 'Adding…' : 'Add to my library'}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {reporting && (
        <ReportDialog
          deck={reporting}
          onClose={() => setReporting(null)}
          onReported={() => {
            setReporting(null);
            setNotice('Thanks. The deck has been reported, and decks reported by several students are hidden.');
            void loadMine();
          }}
        />
      )}
    </div>
  );
};

const ReportDialog: React.FC<{ deck: PublicDeckSummary; onClose: () => void; onReported: () => void }> = ({ deck, onClose, onReported }) => {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    const result = await CommunityService.reportDeck(deck.slug, details.trim() ? `${reason}: ${details.trim()}` : reason);
    setBusy(false);
    if (result.success) onReported();
    else setError(result.error);
  };

  return (
    <Dialog isOpen onClose={onClose} titleId="report-deck-title" className="max-w-md">
      <DialogPanel>
        <DialogHeader titleId="report-deck-title" title="Report this deck" description={deck.title} onClose={onClose} />
        <div className="space-y-3 px-5 py-5 sm:px-6">
          <fieldset className="space-y-2">
            <legend className="mb-1 text-[13px] font-medium text-ink">What is wrong with it?</legend>
            {REPORT_REASONS.map(option => (
              <label key={option} className="flex cursor-pointer items-center gap-2.5 text-[14px] text-ink-muted">
                <input type="radio" name="report-reason" checked={reason === option} onChange={() => setReason(option)} className="accent-[var(--brand)]" />
                {option}
              </label>
            ))}
          </fieldset>
          <textarea
            value={details}
            onChange={e => setDetails(e.target.value)}
            maxLength={400}
            rows={2}
            placeholder="Anything else? (optional)"
            className="w-full resize-none rounded-xl border border-line-strong bg-canvas px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none"
          />
          {error && (
            <p role="alert" className="text-[13px] text-danger">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={Flag} onClick={send} disabled={busy}>
            {busy ? 'Sending…' : 'Report'}
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};

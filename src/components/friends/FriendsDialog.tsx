import React, { useCallback, useEffect, useId, useState } from 'react';
import { Check, Copy, Flame, Share2, UserMinus, UserPlus } from 'lucide-react';
import { FriendsService, formatCode, friendStatus, sortFriends, type FriendsData } from '../../services/friendsService';
import { Dialog, DialogHeader, DialogPanel } from '../common/Dialog';
import { Button } from '../ui/primitives';
import { FriendAvatar } from './FriendAvatar';

const INPUT =
  'h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm uppercase tracking-wider text-ink placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none';

/** Your code and invite link, adding a friend by their code, and the list of friends. */
export const FriendsDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  /** A code from an invite link, filled in ready to add. */
  initialCode?: string | null;
}> = ({ isOpen, onClose, initialCode }) => {
  const titleId = useId();
  const codeId = useId();
  const [data, setData] = useState<FriendsData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState(initialCode ?? '');
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [now] = useState(() => new Date());

  const show = useCallback((res: Awaited<ReturnType<typeof FriendsService.load>>) => {
    if (res.ok) {
      setData(res.data);
      setLoadError(null);
    } else {
      setLoadError(res.error);
    }
  }, []);
  const load = useCallback(() => FriendsService.load().then(show), [show]);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    void FriendsService.load().then(res => alive && show(res));
    return () => {
      alive = false;
    };
  }, [isOpen, show]);

  const [prevInitial, setPrevInitial] = useState(initialCode);
  if (initialCode !== prevInitial) {
    setPrevInitial(initialCode);
    if (initialCode) setCode(initialCode);
  }

  const add = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!code.trim() || adding) return;
    setAdding(true);
    setMessage(null);
    const res = await FriendsService.add(code);
    setAdding(false);
    if (!res.ok) {
      setMessage({ tone: 'error', text: res.error });
      return;
    }
    setCode('');
    setMessage({
      tone: 'success',
      text: res.data.alreadyFriends ? `You're already friends with ${res.data.friend.name}.` : `You and ${res.data.friend.name} are now friends.`,
    });
    void load();
  };

  const remove = async (friendId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from your friends? You'll stop seeing each other's progress.`)) return;
    const res = await FriendsService.remove(friendId);
    if (res.ok) void load();
    else setMessage({ tone: 'error', text: res.error });
  };

  const copy = async (what: 'code' | 'link') => {
    if (!data) return;
    const text = what === 'code' ? formatCode(data.code) : FriendsService.inviteLink(data.code);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt('Copy this:', text);
    }
  };

  const share = async () => {
    if (!data) return;
    const url = FriendsService.inviteLink(data.code);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Study with me on Studify', text: `Add me as a friend on Studify. My code is ${formatCode(data.code)}.`, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    void copy('link');
  };

  const friends = data ? sortFriends(data.friends, now) : [];

  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId={titleId} className="max-w-lg">
      <DialogPanel className="max-h-[90dvh]">
        <DialogHeader
          titleId={titleId}
          title="Friends"
          description="Friends see each other's streak and whether they studied today. Never your decks or email."
          onClose={onClose}
        />
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {/* Your code */}
          <section aria-label="Your friend code" className="rounded-2xl border border-line bg-canvas p-4">
            <p className="text-[13px] text-ink-subtle">Your friend code</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xl font-semibold tracking-widest text-ink" aria-live="polite">
                {data ? formatCode(data.code) : loadError ? '—' : '····-····'}
              </span>
              <div className="ml-auto flex gap-1.5">
                <Button size="sm" variant="ghost" icon={copied === 'code' ? Check : Copy} onClick={() => void copy('code')} disabled={!data}>
                  {copied === 'code' ? 'Copied' : 'Copy'}
                </Button>
                <Button size="sm" variant="primary" icon={copied === 'link' ? Check : Share2} onClick={() => void share()} disabled={!data}>
                  {copied === 'link' ? 'Link copied' : 'Invite'}
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-subtle">Anyone with your code or link can add you, so share it with friends only.</p>
          </section>

          {/* Add a friend */}
          <form onSubmit={e => void add(e)} className="space-y-2">
            <label htmlFor={codeId} className="text-[13px] font-medium text-ink">
              Add a friend
            </label>
            <div className="flex gap-2">
              <input
                id={codeId}
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Their code, like K7M2-QX9P"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={12}
                className={INPUT}
              />
              <Button type="submit" variant="secondary" icon={UserPlus} disabled={!code.trim() || adding} className="shrink-0">
                {adding ? 'Adding' : 'Add'}
              </Button>
            </div>
            {message && (
              <p role={message.tone === 'error' ? 'alert' : 'status'} className={message.tone === 'error' ? 'text-[13px] text-danger' : 'text-[13px] text-success'}>
                {message.text}
              </p>
            )}
          </form>

          {/* Friends */}
          <section aria-label="Your friends" className="space-y-2">
            {loadError && (
              <p role="alert" className="text-[13px] text-danger">
                {loadError}{' '}
                <button type="button" onClick={() => void load()} className="underline cursor-pointer">
                  Try again
                </button>
              </p>
            )}
            {data && friends.length === 0 && (
              <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-ink-subtle">
                No friends yet. Send your invite link to a classmate and keep each other going.
              </p>
            )}
            {friends.length > 0 && (
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {friends.map(friend => (
                  <li key={friend.id} className="flex items-center gap-3 px-3 py-2.5">
                    <FriendAvatar friend={friend} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-ink">{friend.name}</p>
                      <p className="truncate text-xs text-ink-subtle">{friendStatus(friend, now)}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[13px] tabular-nums text-ink-muted" title={`${friend.streak}-day streak`}>
                      <Flame className={friend.streak > 0 ? 'h-4 w-4 text-gold' : 'h-4 w-4 text-ink-subtle'} aria-hidden="true" />
                      {friend.streak}
                      <span className="sr-only">-day streak</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void remove(friend.id, friend.name)}
                      aria-label={`Remove ${friend.name}`}
                      title={`Remove ${friend.name}`}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-hover hover:text-danger cursor-pointer"
                    >
                      <UserMinus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogPanel>
    </Dialog>
  );
};

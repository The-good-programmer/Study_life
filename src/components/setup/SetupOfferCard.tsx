import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { markSetupDone, shouldOfferSetup } from '../../services/setupOffer';
import { Button, IconButton } from '../ui/primitives';

/**
 * On the home page for a signed-in student with no timetable yet: set everything up from a couple of
 * photos. Closing it (or finishing the assistant) hides it for good.
 */
export const SetupOfferCard: React.FC<{ userId: string; onOpen: () => void }> = ({ userId, onOpen }) => {
  const [hiddenFor, setHiddenFor] = useState<string | null>(null);
  const [offerFor] = useState(() => ({ id: userId, offer: shouldOfferSetup() }));
  // Read once per account (signing in as someone else asks again).
  const offer = offerFor.id === userId ? offerFor.offer : shouldOfferSetup();
  if (!offer || hiddenFor === userId) return null;
  return (
    <section aria-labelledby="setup-offer-title" className="flex flex-col gap-3 rounded-2xl border border-brand/30 bg-brand-soft/60 p-4 sm:flex-row sm:items-center sm:p-5 animate-rise">
      <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white sm:flex" aria-hidden="true">
        <Sparkles className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="setup-offer-title" className="text-[15px] font-semibold text-ink">
          Set up your school year with AI
        </h2>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
          Snap your timetable and exam dates: Studify adds your lessons, plans each exam and makes a starter deck for every subject.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="primary" icon={Sparkles} onClick={onOpen}>
          Set up
        </Button>
        <IconButton
          icon={X}
          label="Not now"
          onClick={() => {
            markSetupDone();
            setHiddenFor(userId);
          }}
        />
      </div>
    </section>
  );
};

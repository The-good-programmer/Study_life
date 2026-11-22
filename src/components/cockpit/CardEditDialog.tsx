import React, { useId, useState } from 'react';
import { EyeOff, Save } from 'lucide-react';
import type { RetrievalCard } from '../../types';
import type { CardContentPatch } from '../../utils/cardProgress';
import { cardEditPatch } from './cardEdit';
import { getEffectiveCardType } from './retrievalLogic';
import { Dialog, DialogFooter, DialogHeader, DialogPanel } from '../common/Dialog';
import { Button } from '../ui/primitives';

const FIELD =
  'w-full resize-y rounded-xl border border-line-strong bg-canvas px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none';

/** Fix a card's text during a review, or hide it from reviews. */
export const CardEditDialog: React.FC<{
  card: RetrievalCard;
  onClose: () => void;
  onSave: (patch: CardContentPatch) => void;
  onHide: () => void;
}> = ({ card, onClose, onSave, onHide }) => {
  const titleId = useId();
  const isCloze = getEffectiveCardType(card) === 'cloze';
  const [question, setQuestion] = useState(isCloze ? card.clozeTemplate || card.question : card.question);
  const [answer, setAnswer] = useState(card.answer);
  const [hint, setHint] = useState(card.hint ?? '');
  const [error, setError] = useState<string | null>(null);
  const ids = { question: useId(), answer: useId(), hint: useId() };

  const save = () => {
    const result = cardEditPatch(card, { question, answer, hint });
    if ('error' in result) setError(result.error);
    else onSave(result.patch);
  };

  return (
    <Dialog isOpen onClose={onClose} titleId={titleId} className="max-w-lg">
      <DialogPanel className="max-h-[90dvh]">
        <DialogHeader
          titleId={titleId}
          title="Edit card"
          description="Changes are saved to the deck and used from now on. The card's review schedule stays as it is."
          onClose={onClose}
        />
        <form
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6"
          onSubmit={e => {
            e.preventDefault();
            save();
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor={ids.question} className="text-[13px] font-medium text-ink">
              {isCloze ? 'Sentence' : 'Question'}
            </label>
            <textarea id={ids.question} rows={3} value={question} onChange={e => setQuestion(e.target.value)} className={FIELD} autoFocus />
            {isCloze && <p className="text-xs text-ink-subtle">The words in {'{{double braces}}'} are hidden and become the answer.</p>}
          </div>
          {!isCloze && (
            <div className="space-y-1.5">
              <label htmlFor={ids.answer} className="text-[13px] font-medium text-ink">Answer</label>
              <textarea id={ids.answer} rows={3} value={answer} onChange={e => setAnswer(e.target.value)} className={FIELD} />
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor={ids.hint} className="text-[13px] font-medium text-ink">
              Hint <span className="font-normal text-ink-subtle">(optional)</span>
            </label>
            <textarea id={ids.hint} rows={2} value={hint} onChange={e => setHint(e.target.value)} className={FIELD} />
          </div>
          {error && (
            <p role="alert" className="text-[13px] text-danger">
              {error}
            </p>
          )}
          <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
        </form>
        <DialogFooter>
          <Button variant="ghost" icon={EyeOff} onClick={onHide} className="-ml-2" title="Stop showing this card in reviews">
            Hide this card
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={Save} onClick={save}>
            Save
          </Button>
        </DialogFooter>
      </DialogPanel>
    </Dialog>
  );
};

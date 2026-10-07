import React, { useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, EyeOff, FileUp, Image as ImageIcon, Layers, PenLine, Plus, Trash2, Upload, X } from 'lucide-react';
import type { ConceptCheckpoint, RetrievalCard, StudySession, SubjectFolder } from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { cn } from '../../utils/cn';
import { CARD_TYPE_LABELS, getEffectiveCardType } from '../cockpit/retrievalLogic';
import { Dialog, DialogFooter, DialogPanel } from '../common/Dialog';
import { Badge, Button, IconButton } from '../ui/primitives';
import { ImageOcclusionStudio } from './ImageOcclusionStudio';
import { SubjectFolderModal } from './SubjectFolderModal';
import {
  CARD_ISSUE_TEXT,
  DELIMITERS,
  buildDeckFromDraft,
  buildImportedDeck,
  cardIssue,
  clozeAnswer,
  detectDelimiter,
  isUntouched,
  newCard,
  newConcept,
  parseImport,
  withCardType,
  withChoices,
  withFreshIdsIfTaken,
  wrongAnswersOf,
} from './deckDraft';
import type { Delimiter, EditableCardType } from './deckDraft';

interface DeckStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveDeck: (session: StudySession) => void;
  initialSession?: StudySession | null;
  initialTab?: 'create' | 'import' | 'occlusion';
}

type Tab = 'create' | 'import' | 'occlusion';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'create', label: 'Write cards', icon: PenLine },
  { id: 'import', label: 'Import', icon: Upload },
  { id: 'occlusion', label: 'Diagram cards', icon: ImageIcon },
];

const CARD_TYPES: EditableCardType[] = ['standard', 'cloze', 'multiple-choice'];

const INPUT =
  'w-full min-w-0 rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none';

/** Create a deck by hand, import one, or make diagram cards. Editing an existing deck shows the editor only. */
export const DeckStudioModal: React.FC<DeckStudioModalProps> = ({ isOpen, onClose, onSaveDeck, initialSession, initialTab = 'create' }) => {
  const isEditing = !!initialSession;
  const [tab, setTab] = useState<Tab>(isEditing ? 'create' : initialTab);
  const [folders, setFolders] = useState<SubjectFolder[]>(() => StorageService.getFolders());
  const [folderId, setFolderId] = useState<string | undefined>(initialSession?.folderId);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  if (!isOpen) return null;

  const subjectPicker = (
    <SubjectPicker folders={folders} value={folderId} onChange={setFolderId} onCreate={() => setIsFolderModalOpen(true)} />
  );

  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId="deck-studio-title" className="max-w-4xl">
      <DialogPanel className="h-[min(880px,92dvh)]">
        <div className="shrink-0 border-b border-line px-5 pt-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 id="deck-studio-title" className="text-[17px] font-semibold text-ink">
                {isEditing ? 'Edit deck' : 'New deck'}
              </h2>
              <p className="mt-1 text-[13px] text-ink-subtle">
                {isEditing
                  ? 'Change cards, add new ones, or fill in the overview for each concept.'
                  : 'Write your own cards, import them, or make cards from a diagram.'}
              </p>
            </div>
            <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2 -mt-1.5" />
          </div>
          {!isEditing ? (
            <div role="tablist" aria-label="How to make the deck" className="-mb-px mt-4 flex gap-5 overflow-x-auto no-scrollbar">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 text-[13px] font-medium transition-colors cursor-pointer',
                    tab === id ? 'border-ink text-ink' : 'border-transparent text-ink-subtle hover:text-ink',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <div className="h-4" />
          )}
        </div>

        {tab === 'create' && (
          <WriteCards initialSession={initialSession} folderId={folderId} subjectPicker={subjectPicker} onCancel={onClose} onSaved={onSaveDeck} />
        )}
        {tab === 'import' && <ImportCards folderId={folderId} subjectPicker={subjectPicker} onCancel={onClose} onSaved={onSaveDeck} />}
        {tab === 'occlusion' && (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            <ImageOcclusionStudio onCardsGenerated={(_cards, _title, deck) => onSaveDeck(deck)} onClose={onClose} />
          </div>
        )}
      </DialogPanel>

      {isFolderModalOpen && (
        <SubjectFolderModal
          isOpen={isFolderModalOpen}
          onClose={() => setIsFolderModalOpen(false)}
          onFolderSaved={(folder) => {
            setFolders(StorageService.getFolders());
            setFolderId(folder.id);
          }}
        />
      )}
    </Dialog>
  );
};

/* ------------------------------------------------------------------ */
/* Write cards                                                         */
/* ------------------------------------------------------------------ */

const WriteCards: React.FC<{
  initialSession?: StudySession | null;
  folderId?: string;
  subjectPicker: React.ReactNode;
  onCancel: () => void;
  onSaved: (deck: StudySession) => void;
}> = ({ initialSession, folderId, subjectPicker, onCancel, onSaved }) => {
  const [title, setTitle] = useState(initialSession?.title || '');
  const [category, setCategory] = useState(initialSession?.category || '');
  const [description, setDescription] = useState(initialSession?.description || '');
  const [concepts, setConcepts] = useState<ConceptCheckpoint[]>(() =>
    initialSession?.concepts?.length ? initialSession.concepts : [newConcept(1)],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const active = concepts[activeIndex] ?? concepts[0];
  const titleMissing = attemptedSave && !title.trim();

  const issues = useMemo(() => {
    const byCard = new Map<string, string>();
    concepts.forEach(concept =>
      concept.retrievalCards.forEach(card => {
        const issue = isUntouched(card) ? null : cardIssue(card);
        if (issue) byCard.set(card.id, CARD_ISSUE_TEXT[issue]);
      }),
    );
    return byCard;
  }, [concepts]);

  const updateConcept = (index: number, patch: Partial<ConceptCheckpoint>) =>
    setConcepts(prev => prev.map((concept, i) => (i === index ? { ...concept, ...patch } : concept)));

  // Functional updates, so two quick edits to one card never overwrite each other.
  const updateCard = (index: number, cardId: string, update: (card: RetrievalCard) => RetrievalCard) =>
    setConcepts(prev =>
      prev.map((concept, i) =>
        i === index ? { ...concept, retrievalCards: concept.retrievalCards.map(card => (card.id === cardId ? update(card) : card)) } : concept,
      ),
    );

  const addCard = (type: EditableCardType) =>
    setConcepts(prev =>
      prev.map((concept, i) => (i === activeIndex ? { ...concept, retrievalCards: [...concept.retrievalCards, newCard(concept.id, type)] } : concept)),
    );

  const removeCard = (cardId: string) =>
    setConcepts(prev =>
      prev.map((concept, i) => (i === activeIndex ? { ...concept, retrievalCards: concept.retrievalCards.filter(card => card.id !== cardId) } : concept)),
    );

  const addConcept = () => {
    setConcepts(prev => [...prev, newConcept(prev.length + 1)]);
    setActiveIndex(concepts.length);
  };

  const removeConcept = (index: number) => {
    setConcepts(prev => prev.filter((_, i) => i !== index));
    setActiveIndex(i => Math.max(0, Math.min(i, concepts.length - 2)));
  };

  const handleSave = () => {
    setAttemptedSave(true);
    if (!title.trim()) {
      setSaveMessage('Give the deck a name.');
      bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (issues.size > 0) {
      const firstIndex = concepts.findIndex(concept => concept.retrievalCards.some(card => issues.has(card.id)));
      if (firstIndex >= 0) setActiveIndex(firstIndex);
      setSaveMessage(`${issues.size} ${issues.size === 1 ? 'card needs' : 'cards need'} a fix before saving.`);
      return;
    }
    const deck = buildDeckFromDraft({ title, category, description, folderId }, concepts, initialSession);
    if (deck.concepts.every(concept => concept.retrievalCards.length === 0)) {
      setSaveMessage('Add at least one card.');
      return;
    }
    StorageService.saveSession(deck);
    soundEngine.playCompletionChime();
    onSaved(deck);
  };

  const cardCount = concepts.reduce((sum, concept) => sum + concept.retrievalCards.filter(card => !isUntouched(card)).length, 0);

  return (
    <>
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
        {/* Deck details */}
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Deck name" error={titleMissing ? 'Give the deck a name.' : undefined} className="sm:col-span-2">
            {(id, describedBy) => (
              <input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={titleMissing || undefined}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Cell biology: membranes and transport"
                className={cn(INPUT, 'h-10', titleMissing && 'border-danger')}
                data-autofocus={!initialSession || undefined}
              />
            )}
          </Field>
          <Field label="Subject" optional>
            {() => subjectPicker}
          </Field>
          <Field label="Category" optional>
            {id => (
              <input id={id} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Biology" className={cn(INPUT, 'h-10')} />
            )}
          </Field>
          <Field label="Description" optional className="sm:col-span-2">
            {id => (
              <input
                id={id}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this deck covers"
                className={cn(INPUT, 'h-10')}
              />
            )}
          </Field>
        </section>

        {/* Concepts */}
        <section className="mt-7">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-ink">Concepts</h3>
            <Button size="sm" variant="ghost" icon={Plus} onClick={addConcept} className="-mr-2">
              Add concept
            </Button>
          </div>
          <p className="mt-0.5 text-[13px] text-ink-subtle">Each concept is one step of a guided session, with its own cards.</p>
          <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar" role="tablist" aria-label="Concepts">
            {concepts.map((concept, index) => {
              const hasIssue = concept.retrievalCards.some(card => issues.has(card.id));
              return (
                <button
                  key={concept.id}
                  type="button"
                  role="tab"
                  aria-selected={index === activeIndex}
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    'inline-flex h-8 max-w-[220px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors cursor-pointer',
                    index === activeIndex ? 'bg-ink text-canvas' : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
                  )}
                >
                  <span className="tabular-nums opacity-60">{index + 1}</span>
                  <span className="truncate">{concept.title.trim() || 'Untitled'}</span>
                  {attemptedSave && hasIssue && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" aria-label="Needs a fix" />}
                </button>
              );
            })}
          </div>
        </section>

        {active && (
          <ConceptEditor
            key={active.id}
            concept={active}
            index={activeIndex}
            canRemove={concepts.length > 1}
            issues={attemptedSave ? issues : new Map()}
            onChange={(patch) => updateConcept(activeIndex, patch)}
            onUpdateCard={(cardId, update) => updateCard(activeIndex, cardId, update)}
            onAddCard={addCard}
            onRemoveCard={removeCard}
            onRemove={() => removeConcept(activeIndex)}
          />
        )}
      </div>

      <DialogFooter className="justify-between">
        <p className={cn('min-w-0 truncate text-[13px]', saveMessage && (issues.size > 0 || titleMissing) ? 'text-danger' : 'text-ink-subtle')} role="status">
          {saveMessage && (issues.size > 0 || titleMissing || cardCount === 0)
            ? saveMessage
            : `${concepts.length} ${concepts.length === 1 ? 'concept' : 'concepts'} · ${cardCount} ${cardCount === 1 ? 'card' : 'cards'}`}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>
            {initialSession ? 'Save changes' : 'Save deck'}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
};

const ConceptEditor: React.FC<{
  concept: ConceptCheckpoint;
  index: number;
  canRemove: boolean;
  issues: Map<string, string>;
  onChange: (patch: Partial<ConceptCheckpoint>) => void;
  onUpdateCard: (cardId: string, update: (card: RetrievalCard) => RetrievalCard) => void;
  onAddCard: (type: EditableCardType) => void;
  onRemoveCard: (cardId: string) => void;
  onRemove: () => void;
}> = ({ concept, index, canRemove, issues, onChange, onUpdateCard, onAddCard, onRemoveCard, onRemove }) => {
  const hasOverview =
    !!concept.mentalModel || concept.coreTakeaways.length > 0 || concept.keyTerms.length > 0 || !!concept.feynmanPrompt;
  const [showOverview, setShowOverview] = useState(hasOverview);

  return (
    <section className="mt-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-end gap-2">
        <Field label={`Concept ${index + 1} name`} className="flex-1">
          {id => (
            <input
              id={id}
              value={concept.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="e.g. How the cell membrane works"
              className={cn(INPUT, 'h-10')}
            />
          )}
        </Field>
        {canRemove && <IconButton icon={Trash2} label="Delete this concept" onClick={onRemove} className="mb-0.5 hover:text-danger" />}
      </div>

      <div className="mt-5 space-y-3">
        {concept.retrievalCards.map((card, cardIndex) => (
          <CardEditor
            key={card.id}
            card={card}
            number={cardIndex + 1}
            issue={issues.get(card.id)}
            onChange={(update) => onUpdateCard(card.id, update)}
            onRemove={() => onRemoveCard(card.id)}
          />
        ))}
        {concept.retrievalCards.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-ink-subtle">No cards in this concept yet.</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-ink-subtle">Add a card:</span>
        {CARD_TYPES.map(type => (
          <Button key={type} size="sm" icon={Plus} onClick={() => onAddCard(type)}>
            {CARD_TYPE_LABELS[type]}
          </Button>
        ))}
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => setShowOverview(v => !v)}
          aria-expanded={showOverview}
          className="flex w-full items-center justify-between gap-3 text-left cursor-pointer"
        >
          <span>
            <span className="block text-sm font-medium text-ink">Overview and explain step</span>
            <span className="block text-xs text-ink-subtle">Optional. Used in the guided session before the flashcards.</span>
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-ink-subtle transition-transform', showOverview && 'rotate-180')} aria-hidden="true" />
        </button>
        {showOverview && (
          <div className="mt-4 grid gap-4 animate-fadeIn">
            <Field label="The big idea" optional hint="One or two sentences, ideally with a comparison.">
              {id => (
                <textarea
                  id={id}
                  rows={2}
                  value={concept.mentalModel}
                  onChange={(e) => onChange({ mentalModel: e.target.value })}
                  placeholder="e.g. A cell membrane is like a nightclub door: it decides who gets in."
                  className={cn(INPUT, 'resize-y py-2.5 leading-relaxed')}
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Key points" optional hint="One per line.">
                {id => (
                  <LinesInput
                    id={id}
                    lines={concept.coreTakeaways}
                    onChange={(lines) => onChange({ coreTakeaways: lines })}
                    placeholder={'Lipids form a double layer\nProteins act as gates'}
                  />
                )}
              </Field>
              <Field label="Key terms" optional hint="One per line, as term: meaning.">
                {id => (
                  <LinesInput
                    id={id}
                    lines={concept.keyTerms.map(term => (term.definition ? `${term.term}: ${term.definition}` : term.term))}
                    onChange={(lines) =>
                      onChange({
                        keyTerms: lines.map(line => {
                          const [term, ...rest] = line.split(':');
                          return { term: term.trim(), definition: rest.join(':').trim() };
                        }),
                      })
                    }
                    placeholder={'Osmosis: water moving across a membrane'}
                  />
                )}
              </Field>
            </div>
            <Field label="Explain prompt" optional hint="The question for the explain step.">
              {id => (
                <input
                  id={id}
                  value={concept.feynmanPrompt}
                  onChange={(e) => onChange({ feynmanPrompt: e.target.value })}
                  placeholder={`Explain ${concept.title.trim() || 'this concept'} in your own words, as if to a friend.`}
                  className={cn(INPUT, 'h-10')}
                />
              )}
            </Field>
          </div>
        )}
      </div>
    </section>
  );
};

const CardEditor: React.FC<{
  card: RetrievalCard;
  number: number;
  issue?: string;
  onChange: (update: (card: RetrievalCard) => RetrievalCard) => void;
  onRemove: () => void;
}> = ({ card, number, issue, onChange, onRemove }) => {
  const type = getEffectiveCardType(card);
  const [showMore, setShowMore] = useState(!!(card.hint || card.explanation));
  const clozeRef = useRef<HTMLTextAreaElement>(null);

  // Wraps the selected words in {{ }} so they become the hidden part of the sentence.
  const hideSelection = () => {
    const box = clozeRef.current;
    if (!box) return;
    const { selectionStart, selectionEnd, value } = box;
    if (selectionStart === selectionEnd) return;
    const next = `${value.slice(0, selectionStart)}{{${value.slice(selectionStart, selectionEnd)}}}${value.slice(selectionEnd)}`;
    onChange(c => ({ ...c, question: next, clozeTemplate: next, answer: clozeAnswer(next) }));
    requestAnimationFrame(() => box.focus());
  };

  return (
    <div
      data-card-issue={issue ? 'true' : undefined}
      className={cn('rounded-2xl border bg-surface-solid p-4', issue ? 'border-danger/60' : 'border-line')}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="w-5 shrink-0 text-xs tabular-nums text-ink-subtle">{number}</span>
          {type === 'image-occlusion' ? (
            <Badge>{CARD_TYPE_LABELS['image-occlusion']}</Badge>
          ) : (
            <div className="inline-flex rounded-lg border border-line bg-canvas p-0.5" role="radiogroup" aria-label={`Card ${number} type`}>
              {CARD_TYPES.map(option => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={type === option}
                  onClick={() => onChange(c => withCardType(c, option))}
                  className={cn(
                    'h-7 rounded-md px-2.5 text-xs font-medium transition-colors cursor-pointer',
                    type === option ? 'bg-surface-hover text-ink shadow-sm' : 'text-ink-subtle hover:text-ink',
                  )}
                >
                  {CARD_TYPE_LABELS[option]}
                </button>
              ))}
            </div>
          )}
        </div>
        <IconButton icon={Trash2} label={`Delete card ${number}`} onClick={onRemove} className="hover:text-danger" />
      </div>

      {type === 'image-occlusion' && (
        <p className="mt-3 text-[13px] text-ink-muted">
          {card.question || 'Diagram card'} · {card.masks?.length ?? 0} hidden labels. Diagram cards are made in Diagram cards.
        </p>
      )}

      {type === 'standard' && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Question">
            {id => (
              <textarea
                id={id}
                rows={2}
                value={card.question}
                onChange={(e) => {
                  const question = e.target.value;
                  onChange(c => ({ ...c, question }));
                }}
                placeholder="e.g. What does the cell membrane control?"
                className={cn(INPUT, 'resize-y py-2.5 leading-relaxed')}
              />
            )}
          </Field>
          <Field label="Answer">
            {id => (
              <textarea
                id={id}
                rows={2}
                value={card.answer}
                onChange={(e) => {
                  const answer = e.target.value;
                  onChange(c => ({ ...c, answer }));
                }}
                placeholder="e.g. What enters and leaves the cell"
                className={cn(INPUT, 'resize-y py-2.5 leading-relaxed')}
              />
            )}
          </Field>
        </div>
      )}

      {type === 'cloze' && (
        <div className="mt-3">
          <Field label="Sentence" hint="Put the words to hide in {{double braces}}, or select them and press Hide selection.">
            {id => (
              <textarea
                id={id}
                ref={clozeRef}
                rows={2}
                value={card.question}
                onChange={(e) => {
                  const question = e.target.value;
                  onChange(c => ({ ...c, question, clozeTemplate: question, answer: clozeAnswer(question) }));
                }}
                placeholder="e.g. Water moves across a membrane by {{osmosis}}."
                className={cn(INPUT, 'resize-y py-2.5 leading-relaxed')}
              />
            )}
          </Field>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-subtle">
              Hidden: <span className="font-medium text-ink-muted">{clozeAnswer(card.question) || 'nothing yet'}</span>
            </p>
            <Button size="sm" variant="ghost" icon={EyeOff} onMouseDown={(e) => e.preventDefault()} onClick={hideSelection}>
              Hide selection
            </Button>
          </div>
        </div>
      )}

      {type === 'multiple-choice' && (
        <div className="mt-3 grid gap-3">
          <Field label="Question">
            {id => (
              <input
                id={id}
                value={card.question}
                onChange={(e) => {
                  const question = e.target.value;
                  onChange(c => ({ ...c, question }));
                }}
                placeholder="e.g. Which part of the cell makes ATP?"
                className={cn(INPUT, 'h-10')}
              />
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Right answer">
              {id => (
                <input
                  id={id}
                  value={card.answer}
                  onChange={(e) => {
                    const answer = e.target.value;
                    onChange(c => withChoices(c, answer, wrongAnswersOf(c)));
                  }}
                  placeholder="e.g. Mitochondria"
                  className={cn(INPUT, 'h-10 border-success/50')}
                />
              )}
            </Field>
            <Field label="Wrong answers" hint="Up to three. They are shuffled when studying.">
              {() => (
                <div className="grid gap-2">
                  {wrongAnswersOf(card).map((wrong, i) => (
                    <input
                      key={i}
                      aria-label={`Wrong answer ${i + 1}`}
                      value={wrong}
                      onChange={(e) => {
                        const value = e.target.value;
                        onChange(c => {
                          const next = wrongAnswersOf(c);
                          next[i] = value;
                          return withChoices(c, c.answer, next);
                        });
                      }}
                      placeholder={['e.g. Ribosome', 'e.g. Nucleus', 'e.g. Golgi body'][i]}
                      className={cn(INPUT, 'h-9')}
                    />
                  ))}
                </div>
              )}
            </Field>
          </div>
        </div>
      )}

      {type !== 'image-occlusion' && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowMore(v => !v)}
            aria-expanded={showMore}
            className="inline-flex items-center gap-1 text-xs font-medium text-ink-subtle transition-colors hover:text-ink cursor-pointer"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showMore && 'rotate-180')} aria-hidden="true" />
            Hint and explanation
          </button>
          {showMore && (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <input
                aria-label="Hint"
                value={card.hint || ''}
                onChange={(e) => {
                  const hint = e.target.value;
                  onChange(c => ({ ...c, hint }));
                }}
                placeholder="Hint (shown on request)"
                className={cn(INPUT, 'h-9')}
              />
              <input
                aria-label="Explanation"
                value={card.explanation || ''}
                onChange={(e) => {
                  const explanation = e.target.value;
                  onChange(c => ({ ...c, explanation }));
                }}
                placeholder="Explanation (shown after the answer)"
                className={cn(INPUT, 'h-9')}
              />
            </div>
          )}
        </div>
      )}

      {issue && (
        <p className="mt-3 text-[13px] font-medium text-danger" role="alert">
          {issue}
        </p>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

const ImportCards: React.FC<{
  folderId?: string;
  subjectPicker: React.ReactNode;
  onCancel: () => void;
  onSaved: (deck: StudySession) => void;
}> = ({ folderId, subjectPicker, onCancel, onSaved }) => {
  const [deckTitle, setDeckTitle] = useState('');
  const [category, setCategory] = useState('');
  const [text, setText] = useState('');
  const [delimiter, setDelimiter] = useState<Delimiter>('tab');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => (text.trim() ? parseImport(text, delimiter) : []), [text, delimiter]);

  const handleText = (value: string) => {
    setText(value);
    setError(null);
    if (value.trim()) setDelimiter(detectDelimiter(value));
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!deckTitle) setDeckTitle(file.name.replace(/\.[^/.]+$/, ''));
    const reader = new FileReader();
    reader.onerror = () => setError('Could not read that file.');
    reader.onload = () => {
      const content = String(reader.result ?? '');
      if (file.name.toLowerCase().endsWith('.json')) {
        try {
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed === 'object' && parsed.title && Array.isArray(parsed.concepts)) {
            const restored: StudySession = withFreshIdsIfTaken(
              {
                ...parsed,
                id: parsed.id || `session-imported-${Date.now()}`,
                createdAt: parsed.createdAt || new Date().toISOString(),
                currentPhase: parsed.currentPhase || 'priming',
                folderId: folderId || parsed.folderId,
              },
              StorageService.getSessions(),
            );
            StorageService.saveSession(restored);
            soundEngine.playCompletionChime();
            onSaved(restored);
            return;
          }
          setError('That JSON file is not a Studify deck.');
        } catch {
          setError('That JSON file could not be read.');
        }
        return;
      }
      handleText(content);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (rows.length === 0) return;
    const deck = buildImportedDeck(rows, { title: deckTitle, category, description: '', folderId });
    StorageService.saveSession(deck);
    soundEngine.playCompletionChime();
    onSaved(deck);
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
        <section className="grid gap-4 sm:grid-cols-3">
          <Field label="Deck name">
            {id => (
              <input id={id} value={deckTitle} onChange={(e) => setDeckTitle(e.target.value)} placeholder="e.g. Spanish verbs" className={cn(INPUT, 'h-10')} />
            )}
          </Field>
          <Field label="Subject" optional>
            {() => subjectPicker}
          </Field>
          <Field label="Category" optional>
            {id => <input id={id} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Languages" className={cn(INPUT, 'h-10')} />}
          </Field>
        </section>

        <section className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-semibold text-ink">Your cards</h3>
              <p className="mt-0.5 text-[13px] text-ink-subtle">
                Choose an Anki, Quizlet or CSV export, or paste one card per line: question, then answer, then an optional hint.
              </p>
            </div>
            <Button icon={FileUp} onClick={() => fileInputRef.current?.click()}>
              Choose a file
            </Button>
            <input ref={fileInputRef} type="file" accept=".txt,.tsv,.csv,.json" onChange={handleFile} className="hidden" tabIndex={-1} aria-hidden="true" />
          </div>
          <label htmlFor="import-text" className="sr-only">
            Cards to import
          </label>
          <textarea
            id="import-text"
            rows={8}
            value={text}
            onChange={(e) => handleText(e.target.value)}
            placeholder={'What is osmosis?\tWater moving across a membrane\nWhat makes ATP?\tMitochondria'}
            className={cn(INPUT, 'mt-3 resize-y py-3 font-mono text-[13px] leading-relaxed')}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-[13px] text-ink-muted">
              Separator
              <select value={delimiter} onChange={(e) => setDelimiter(e.target.value as Delimiter)} className={cn(INPUT, 'h-9 w-auto pr-8')}>
                {DELIMITERS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[13px] tabular-nums text-ink-subtle" role="status">
              {text.trim() ? `${rows.length} ${rows.length === 1 ? 'card' : 'cards'} found` : 'Fill-in-the-blank works too: use {{braces}}.'}
            </p>
          </div>
          {error && (
            <p className="mt-2 text-[13px] text-danger" role="alert">
              {error}
            </p>
          )}
        </section>

        {rows.length > 0 && (
          <section className="mt-5 overflow-hidden rounded-2xl border border-line animate-fadeIn">
            <div className="grid grid-cols-[2rem_1fr_1fr] gap-3 border-b border-line bg-surface px-4 py-2 text-xs font-medium text-ink-subtle">
              <span>#</span>
              <span>Question</span>
              <span>Answer</span>
            </div>
            <ul className="divide-y divide-line">
              {rows.slice(0, 8).map((row, i) => (
                <li key={i} className="grid grid-cols-[2rem_1fr_1fr] gap-3 px-4 py-2.5 text-[13px]">
                  <span className="tabular-nums text-ink-subtle">{i + 1}</span>
                  <span className="truncate text-ink">{row.front}</span>
                  <span className="truncate text-ink-muted">{row.back}</span>
                </li>
              ))}
            </ul>
            {rows.length > 8 && <p className="border-t border-line px-4 py-2 text-xs text-ink-subtle">and {rows.length - 8} more</p>}
          </section>
        )}
      </div>

      <DialogFooter className="justify-end">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" icon={Layers} onClick={handleImport} disabled={rows.length === 0}>
          {rows.length > 0 ? `Import ${rows.length} ${rows.length === 1 ? 'card' : 'cards'}` : 'Import'}
        </Button>
      </DialogFooter>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

const Field: React.FC<{
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: (id: string, describedBy?: string) => React.ReactNode;
}> = ({ label, optional, hint, error, className, children }) => {
  const id = React.useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-ink-subtle">Optional</span>}
      </label>
      <div className="mt-1.5">{children(id, describedBy)}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-subtle">
            {hint}
          </p>
        )
      )}
    </div>
  );
};

/** A textarea edited as free text and reported as trimmed, non-empty lines. */
const LinesInput: React.FC<{ id: string; lines: string[]; onChange: (lines: string[]) => void; placeholder?: string }> = ({
  id,
  lines,
  onChange,
  placeholder,
}) => {
  const [text, setText] = useState(() => lines.join('\n'));
  return (
    <textarea
      id={id}
      rows={3}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(
          e.target.value
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean),
        );
      }}
      placeholder={placeholder}
      className={cn(INPUT, 'resize-y py-2.5 leading-relaxed')}
    />
  );
};

const SubjectPicker: React.FC<{
  folders: SubjectFolder[];
  value?: string;
  onChange: (id: string | undefined) => void;
  onCreate: () => void;
}> = ({ folders, value, onChange, onCreate }) => (
  <div className="flex gap-2">
    <select
      aria-label="Subject"
      value={value || ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      className={cn(INPUT, 'h-10 cursor-pointer')}
    >
      <option value="">No subject</option>
      {folders.map(folder => (
        <option key={folder.id} value={folder.id}>
          {folder.name}
        </option>
      ))}
    </select>
    <IconButton icon={Plus} label="New subject" onClick={onCreate} className="h-10 w-10 shrink-0 border border-line-strong" />
  </div>
);

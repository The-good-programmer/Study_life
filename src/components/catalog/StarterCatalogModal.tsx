import React, { useState } from 'react';
import { 
  Sparkles, 
  Layers, 
  Search, 
  X, 
  Play, 
  Download, 
  ShieldCheck, 
  Clock, 
  Award, 
  Eye, 
  FileText, 
  ArrowRight,
  BookmarkCheck,
  Check
} from 'lucide-react';
import type { StarterDeckMetadata, StudySession } from '../../types';
import { CURATED_STARTER_DECKS } from '../../data/curatedStarterCatalog';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';

function createClonedSession(deck: StarterDeckMetadata): StudySession {
  return {
    ...deck.session,
    id: `${deck.id}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    elapsedSeconds: 0,
    currentConceptIndex: 0,
    currentPhase: 'priming',
  };
}

interface StarterCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSession: (session: StudySession) => void;
  onDeckImported?: () => void;
  onOpenDeckStation?: (session: StudySession) => void;
}

export const StarterCatalogModal: React.FC<StarterCatalogModalProps> = ({
  isOpen,
  onClose,
  onStartSession,
  onDeckImported,
  onOpenDeckStation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [previewDeck, setPreviewDeck] = useState<StarterDeckMetadata | null>(null);
  const [importedDeckIds, setImportedDeckIds] = useState<Set<string>>(() => {
    const existing = StorageService.getSessions().map(s => s.id);
    return new Set(existing);
  });
  const [justImportedId, setJustImportedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = [
    'All',
    'Medical & Clinical',
    'STEM & Engineering',
    'Biochemistry & Life Sciences',
    'Languages & Polyglot',
    'Cognitive & Behavioral Science',
  ];

  const filteredDecks = CURATED_STARTER_DECKS.filter(deck => {
    const matchesSearch = 
      deck.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deck.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deck.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
      deck.session.concepts.some(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'All' || deck.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'All' || deck.difficulty === selectedDifficulty;

    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const handleImportDeck = (deck: StarterDeckMetadata) => {
    const clonedSession = createClonedSession(deck);
    StorageService.saveSession(clonedSession);

    // Save all cards into FSRS queue
    const allCards = clonedSession.concepts.flatMap(c => c.retrievalCards);
    StorageService.saveCards(allCards);

    soundEngine.playSuccess();
    setImportedDeckIds(prev => new Set(prev).add(deck.id));
    setJustImportedId(deck.id);
    setTimeout(() => setJustImportedId(null), 3000);

    if (onDeckImported) {
      onDeckImported();
    }
  };

  const handleLaunchDirectly = (deck: StarterDeckMetadata) => {
    // If not already imported, auto-import to ensure progress is tracked
    if (!importedDeckIds.has(deck.id)) {
      handleImportDeck(deck);
    }
    soundEngine.playStart();
    onClose();
    if (onOpenDeckStation) {
      onOpenDeckStation(deck.session);
    } else {
      onStartSession(deck.session);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-white/[0.12] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-white/[0.08] flex items-start justify-between bg-slate-950/60 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white font-display flex items-center gap-2">
                  <span>High-Yield Starter Catalog</span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Verified Benchmarks
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Instant cold-start decks with FSRS calibration, source document grounding, and visual image occlusion.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close catalog"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 sm:px-6 border-b border-white/[0.06] bg-slate-950/30 space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by topic, board exam (USMLE, MCAT, AP), or concept..."
                className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-white/[0.1] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-slate-400 font-medium">Difficulty:</span>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="bg-slate-950/80 border border-white/[0.1] text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
              >
                <option value="All">All Levels</option>
                <option value="Foundational">Foundational</option>
                <option value="Intermediate">Intermediate</option>
                <option value="High-Yield Board Review">High-Yield Board Review</option>
              </select>
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all text-xs font-medium ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Catalog Deck Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {filteredDecks.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <Layers className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-300">No starter decks match your search criteria.</div>
              <p className="text-xs text-slate-500">Try clearing filters or search terms.</p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory('All'); setSelectedDifficulty('All'); }}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-indigo-400 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDecks.map((deck) => {
                const isImported = importedDeckIds.has(deck.id);
                const isJustImported = justImportedId === deck.id;

                return (
                  <div
                    key={deck.id}
                    className="p-5 rounded-2xl bg-slate-950/50 border border-white/[0.08] hover:border-indigo-500/40 hover:bg-slate-950/80 transition-all flex flex-col justify-between group space-y-4 relative overflow-hidden"
                  >
                    {/* Top Meta Header */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                          {deck.category}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {deck.hasImageOcclusion && (
                            <span className="text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30" title="Includes anatomical / diagram image occlusion cards">
                              <Eye className="w-3 h-3 text-amber-400" />
                              <span>Image Occlusion</span>
                            </span>
                          )}
                          {deck.hasSourcePdf && (
                            <span className="text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30" title="Includes primary source PDF with page coordinates">
                              <FileText className="w-3 h-3 text-sky-400" />
                              <span>PDF Grounded</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-white group-hover:text-indigo-200 transition-colors font-display">
                        {deck.title}
                      </h3>

                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {deck.summary}
                      </p>

                      {/* Tag badges */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {deck.tags.map((tag) => (
                          <span key={tag} className="text-[11px] text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded-md">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Stats & Verification Banner */}
                    <div className="space-y-3 pt-3 border-t border-white/[0.06]">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{deck.conceptCount} Concepts</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            <span>{deck.cardCount} Cards</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-emerald-400" />
                            <span>~{deck.estimatedMinutes}m</span>
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-500 font-medium">
                          {deck.difficulty}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-white/[0.02] p-2 rounded-xl border border-white/[0.04]">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">Verified by <strong className="text-slate-200">{deck.verifiedBy}</strong></span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => setPreviewDeck(deck)}
                          className="flex-1 py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
                        >
                          <span>Inspect Syllabus</span>
                        </button>

                        <button
                          onClick={() => handleImportDeck(deck)}
                          className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                            isJustImported
                              ? 'bg-emerald-600 text-white'
                              : isImported
                              ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-950'
                              : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                          }`}
                          title={isImported ? 'Already in your local library' : 'Import deck to your library'}
                        >
                          {isJustImported ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Added!</span>
                            </>
                          ) : isImported ? (
                            <>
                              <BookmarkCheck className="w-3.5 h-3.5" />
                              <span>In Library</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>Import</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleLaunchDirectly(deck)}
                          className="py-2 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold shadow-md shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 shrink-0"
                          title="Start Active Recall Session Now"
                        >
                          <span>Study</span>
                          <Play className="w-3.5 h-3.5 fill-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer Banner */}
        <div className="p-4 px-6 border-t border-white/[0.08] bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              All catalog decks include calibrated <strong>FSRS</strong> initial stability and <strong>Socratic oral viva</strong> prompts.
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-medium text-slate-200 transition-colors"
          >
            Close Catalog
          </button>
        </div>
      </div>

      {/* Syllabus / Deck Inspector Slide-Over */}
      {previewDeck && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md animate-fade-in"
          onClick={() => setPreviewDeck(null)}
        >
          <div 
            className="w-full max-w-3xl max-h-[88vh] bg-slate-900 border border-white/[0.15] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Inspector Header */}
            <div className="p-6 border-b border-white/[0.08] bg-slate-950/80 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                  {previewDeck.category}
                </span>
                <h3 className="text-lg font-bold text-white mt-1 font-display">
                  {previewDeck.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Target Audience: {previewDeck.targetAudience}
                </p>
              </div>

              <button
                onClick={() => setPreviewDeck(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Inspector Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Concept Curriculum ({previewDeck.session.concepts.length} Checkpoints)
                </h4>
                <div className="space-y-3">
                  {previewDeck.session.concepts.map((concept, idx) => (
                    <div 
                      key={concept.id}
                      className="p-4 rounded-xl bg-slate-950/60 border border-white/[0.06] space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-white">
                        <span className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center text-[11px]">
                            {idx + 1}
                          </span>
                          <span>{concept.title}</span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          {concept.retrievalCards.length} Cards • ~{concept.estimatedMinutes}m
                        </span>
                      </div>

                      <div className="text-xs text-slate-300 bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.04] italic">
                        &quot;{concept.mentalModel}&quot;
                      </div>

                      <div className="space-y-1 pt-1">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Key Takeaways:</span>
                        <ul className="text-xs text-slate-400 space-y-1 pl-4 list-disc">
                          {concept.coreTakeaways.map((takeaway, tIdx) => (
                            <li key={tIdx}>{takeaway}</li>
                          ))}
                        </ul>
                      </div>

                      {concept.sourceAnchor && (
                        <div className="pt-2 flex items-center gap-1.5 text-[11px] text-sky-400">
                          <FileText className="w-3 h-3" />
                          <span>Grounded in {concept.sourceAnchor.sourceName} (Page {concept.sourceAnchor.pageNumber})</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample Cards Preview */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Sample Flashcards Preview
                </h4>
                <div className="space-y-2">
                  {previewDeck.session.concepts.flatMap(c => c.retrievalCards).slice(0, 3).map((card) => (
                    <div key={card.id} className="p-3 rounded-xl bg-slate-950/40 border border-white/[0.06] text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="uppercase font-semibold text-indigo-400">{card.cardType || 'standard'} card</span>
                        {card.cardType === 'image-occlusion' && (
                          <span className="text-amber-400 flex items-center gap-1">
                            <Eye className="w-3 h-3" /> {card.masks?.length} Masks
                          </span>
                        )}
                      </div>
                      <div className="font-medium text-white">{card.question}</div>
                      <div className="text-slate-400 text-[11px] line-clamp-1">Answer: {card.answer}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Inspector Footer */}
            <div className="p-4 px-6 border-t border-white/[0.08] bg-slate-950/80 flex items-center justify-between">
              <button
                onClick={() => setPreviewDeck(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Back to Catalog
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleImportDeck(previewDeck);
                  }}
                  className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Import to Library</span>
                </button>

                <button
                  onClick={() => {
                    const deck = previewDeck;
                    setPreviewDeck(null);
                    handleLaunchDirectly(deck);
                  }}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
                >
                  <span>Launch Study Session</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

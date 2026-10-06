import React, { useState, useRef } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Upload, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  Zap,
  BookOpen,
  Eye
} from 'lucide-react';
import type { CardType, ConceptCheckpoint, RetrievalCard, StudySession, SubjectFolder } from '../../types';
import { StorageService } from '../../services/storageService';
import { soundEngine } from '../../services/soundEngine';
import { ImageOcclusionStudio } from './ImageOcclusionStudio';
import { SubjectFolderModal } from './SubjectFolderModal';

interface DeckStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveDeck: (session: StudySession) => void;
  initialSession?: StudySession | null;
  initialTab?: 'create' | 'import' | 'occlusion';
}

export const DeckStudioModal: React.FC<DeckStudioModalProps> = ({
  isOpen,
  onClose,
  onSaveDeck,
  initialSession,
  initialTab = 'create',
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'import' | 'occlusion'>(initialTab);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);

  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setActiveTab(initialTab);
  }

  // Deck metadata
  const [title, setTitle] = useState(initialSession?.title || '');
  const [category, setCategory] = useState(initialSession?.category || 'General Studies');
  const [folderId, setFolderId] = useState<string | undefined>(initialSession?.folderId);
  const [description, setDescription] = useState(initialSession?.description || '');
  const [folders, setFolders] = useState<SubjectFolder[]>(() => StorageService.getFolders());
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  // Active concepts & cards
  const [concepts, setConcepts] = useState<ConceptCheckpoint[]>(() => {
    if (initialSession?.concepts && initialSession.concepts.length > 0) {
      return initialSession.concepts;
    }
    return [
      {
        id: `c-${Date.now()}-1`,
        order: 1,
        title: 'Core Fundamentals',
        estimatedMinutes: 10,
        mentalModel: 'Think of this concept as a foundational cornerstone upon which advanced mechanics rely.',
        coreTakeaways: ['Primary causal relationship', 'Critical operational condition'],
        keyTerms: [{ term: 'Foundational Concept', definition: 'The essential core definition.' }],
        feynmanPrompt: 'Explain the core mechanism in simple terms without reading from notes.',
        sampleMasteryExplanation: 'The system functions by taking inputs and applying governing rules to yield outcomes.',
        retrievalCards: [
          {
            id: `rc-${Date.now()}-1`,
            conceptId: `c-${Date.now()}-1`,
            cardType: 'standard',
            question: 'What is the primary driving principle of this topic?',
            answer: 'The core governing dynamic that determines system state.',
            hint: 'Focus on cause and effect.',
            explanation: 'Effortful recall creates lasting synaptic stability.',
            stability: 1,
            difficulty: 5,
            reps: 0,
            lapses: 0,
          },
          {
            id: `rc-${Date.now()}-2`,
            conceptId: `c-${Date.now()}-1`,
            cardType: 'cloze',
            question: 'The foundational process operates by {{active transformation}} under steady conditions.',
            clozeTemplate: 'The foundational process operates by {{active transformation}} under steady conditions.',
            answer: 'active transformation',
            hint: 'The two-word phrase indicating continuous operation.',
            explanation: 'Cloze retrieval triggers specific lexical recall pathways.',
            stability: 1,
            difficulty: 4,
            reps: 0,
            lapses: 0,
          }
        ]
      }
    ];
  });

  const [activeConceptIdx, setActiveConceptIdx] = useState(0);

  // Importer State
  const [importText, setImportText] = useState('');
  const [importDelimiter, setImportDelimiter] = useState<'tab' | 'comma' | 'pipe'>('tab');
  const [importCategory, setImportCategory] = useState('Imported Deck');
  const [importDeckTitle, setImportDeckTitle] = useState('');
  const [importedPreview, setImportedPreview] = useState<{ front: string; back: string; hint?: string }[]>([]);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const currentConcept = concepts[activeConceptIdx] || concepts[0];

  // Add new concept checkpoint
  const handleAddConcept = () => {
    const newId = `c-${Date.now()}-${concepts.length + 1}`;
    const newConcept: ConceptCheckpoint = {
      id: newId,
      order: concepts.length + 1,
      title: `Checkpoint ${concepts.length + 1}`,
      estimatedMinutes: 10,
      mentalModel: 'Intuitive mental model or visual analogy.',
      coreTakeaways: ['Key mechanism 1', 'Key mechanism 2'],
      keyTerms: [{ term: 'New Term', definition: 'Definition' }],
      feynmanPrompt: 'Explain this checkpoint concisely.',
      sampleMasteryExplanation: 'Clear explanation of the checkpoint.',
      retrievalCards: [
        {
          id: `rc-${Date.now()}-1`,
          conceptId: newId,
          cardType: 'standard',
          question: 'Recall prompt question?',
          answer: 'Target answer',
          hint: '',
          explanation: '',
          stability: 1,
          difficulty: 5,
          reps: 0,
          lapses: 0,
        }
      ]
    };
    setConcepts([...concepts, newConcept]);
    setActiveConceptIdx(concepts.length);
  };

  // Add new card to active concept
  const handleAddCard = (type: CardType = 'standard') => {
    if (!currentConcept) return;
    const newCard: RetrievalCard = {
      id: `rc-${Date.now()}-${currentConcept.retrievalCards.length + 1}`,
      conceptId: currentConcept.id,
      cardType: type,
      question: type === 'cloze' ? 'The system uses {{target_keyword}} to function.' : 'What is the key mechanism?',
      answer: type === 'cloze' ? 'target_keyword' : 'Target recall answer',
      hint: '',
      explanation: '',
      options: type === 'multiple-choice' ? ['Target recall answer', 'Option B', 'Option C', 'Option D'] : undefined,
      clozeTemplate: type === 'cloze' ? 'The system uses {{target_keyword}} to function.' : undefined,
      stability: 1,
      difficulty: 5,
      reps: 0,
      lapses: 0,
    };

    const updated = [...concepts];
    updated[activeConceptIdx] = {
      ...currentConcept,
      retrievalCards: [...currentConcept.retrievalCards, newCard]
    };
    setConcepts(updated);
  };

  // Remove card
  const handleRemoveCard = (cardIdx: number) => {
    if (!currentConcept) return;
    const updatedCards = currentConcept.retrievalCards.filter((_, idx) => idx !== cardIdx);
    const updated = [...concepts];
    updated[activeConceptIdx] = {
      ...currentConcept,
      retrievalCards: updatedCards
    };
    setConcepts(updated);
  };

  // Update card field
  const handleUpdateCard = (cardIdx: number, field: keyof RetrievalCard, value: unknown) => {
    if (!currentConcept) return;
    const updatedCards = [...currentConcept.retrievalCards];
    updatedCards[cardIdx] = {
      ...updatedCards[cardIdx],
      [field]: value
    };
    const updated = [...concepts];
    updated[activeConceptIdx] = {
      ...currentConcept,
      retrievalCards: updatedCards
    };
    setConcepts(updated);
  };

  // Parse TSV / CSV text
  const handleParseImportText = (textToParse: string, delim: 'tab' | 'comma' | 'pipe') => {
    const delimiterChar = delim === 'tab' ? '\t' : delim === 'comma' ? ',' : '|';
    const lines = textToParse.split(/\r?\n/).filter(line => line.trim().length > 0);
    const parsed: { front: string; back: string; hint?: string }[] = [];

    lines.forEach(line => {
      // Split by delimiter
      const parts = line.split(delimiterChar).map(p => p.trim());
      if (parts.length >= 2) {
        parsed.push({
          front: parts[0],
          back: parts[1],
          hint: parts[2] || undefined,
        });
      }
    });

    setImportedPreview(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!importDeckTitle) {
      setImportDeckTitle(file.name.replace(/\.[^/.]+$/, ''));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;

      // Handle full JSON deck restore
      if (file.name.toLowerCase().endsWith('.json')) {
        try {
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed === 'object' && parsed.title && Array.isArray(parsed.concepts)) {
            const restoredSession: StudySession = {
              ...parsed,
              id: parsed.id || `session-imported-${Date.now()}`,
              createdAt: parsed.createdAt || new Date().toISOString(),
              currentPhase: parsed.currentPhase || 'priming',
            };
            StorageService.saveSession(restoredSession);
            setImportSuccess(`Successfully imported "${restoredSession.title}" (${restoredSession.concepts.flatMap(c => c.retrievalCards || []).length} cards)!`);
            onSaveDeck(restoredSession);
            return;
          }
        } catch (err) {
          console.error('Failed to parse JSON deck backup:', err);
        }
      }

      setImportText(content);
      // Auto-detect delimiter
      const firstLine = content.split('\n')[0] || '';
      let detected: 'tab' | 'comma' | 'pipe' = 'tab';
      if (firstLine.includes('\t')) detected = 'tab';
      else if (firstLine.includes('|')) detected = 'pipe';
      else if (firstLine.includes(',')) detected = 'comma';

      setImportDelimiter(detected);
      handleParseImportText(content, detected);
    };
    reader.readAsText(file);
  };

  // Finalize Import
  const handleExecuteImport = () => {
    if (importedPreview.length === 0) return;

    const deckName = importDeckTitle.trim() || 'Imported Flashcards';
    const sessionId = `session-${Date.now()}`;
    const conceptId = `c-${sessionId}-1`;

    const cards: RetrievalCard[] = importedPreview.map((item, idx) => {
      const isCloze = item.front.includes('{{') || item.back.includes('{{');
      return {
        id: `rc-${conceptId}-${idx + 1}`,
        conceptId: conceptId,
        cardType: isCloze ? 'cloze' : 'standard',
        question: item.front,
        answer: item.back,
        hint: item.hint || '',
        explanation: 'Imported from external flashcard deck.',
        clozeTemplate: isCloze ? (item.front.includes('{{') ? item.front : item.back) : undefined,
        stability: 1,
        difficulty: 4,
        reps: 0,
        lapses: 0,
      };
    });

    const newSession: StudySession = {
      id: sessionId,
      title: deckName,
      category: importCategory.trim() || 'Imported Deck',
      folderId: folderId || undefined,
      description: `Contains ${cards.length} flashcards imported via Deck Studio.`,
      currentConceptIndex: 0,
      currentPhase: 'priming',
      elapsedSeconds: 0,
      createdAt: new Date().toISOString(),
      concepts: [
        {
          id: conceptId,
          order: 1,
          title: 'Imported Review Queue',
          estimatedMinutes: Math.max(5, Math.round(cards.length * 0.8)),
          mentalModel: `Rapid active retrieval deck for "${deckName}". Focus on effortful memory recall.`,
          coreTakeaways: [
            `Total ${cards.length} target retrieval items imported.`,
            'Spaced repetition schedules every item based on individual recall latency.'
          ],
          keyTerms: cards.slice(0, 5).map(c => ({ term: c.question.slice(0, 30), definition: c.answer.slice(0, 50) })),
          feynmanPrompt: `Explain the central theme of ${deckName} in simple words.`,
          sampleMasteryExplanation: `A comprehensive active retrieval deck focusing on ${deckName}.`,
          retrievalCards: cards,
        }
      ]
    };

    StorageService.saveSession(newSession);
    soundEngine.playCompletionChime();
    setImportSuccess(`Successfully imported "${deckName}" with ${cards.length} cards!`);

    setTimeout(() => {
      onSaveDeck(newSession);
      onClose();
    }, 1200);
  };

  // Finalize Manual Deck Save
  const handleSaveManualDeck = () => {
    if (!title.trim()) {
      alert('Please enter a title for your study deck.');
      return;
    }

    const sessionId = initialSession?.id || `session-${Date.now()}`;
    const newSession: StudySession = {
      id: sessionId,
      title: title.trim(),
      category: category.trim() || 'General Studies',
      folderId: folderId || undefined,
      description: description.trim() || `Custom study deck created in Studify Deck Studio.`,
      currentConceptIndex: 0,
      currentPhase: 'priming',
      elapsedSeconds: initialSession?.elapsedSeconds || 0,
      createdAt: initialSession?.createdAt || new Date().toISOString(),
      concepts: concepts.map((c, idx) => ({ ...c, order: idx + 1 })),
    };

    StorageService.saveSession(newSession);
    soundEngine.playCompletionChime();
    onSaveDeck(newSession);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl glass-panel border border-white/[0.15] shadow-2xl overflow-hidden"
      >
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/[0.08] flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white font-display">Deck Studio & Card Architect</h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  FSRS Local-First
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Author custom multi-type cards or import Anki, Quizlet, and CSV flashcard decks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode Switcher */}
            <div className="flex bg-slate-950/80 p-1 rounded-xl border border-white/[0.08] text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'create'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Card Studio
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('import')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'import'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import Anki/CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('occlusion')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'occlusion'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Image Occlusion</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* TAB 1: CARD STUDIO */}
          {activeTab === 'create' && (
            <div className="space-y-6">
              
              {/* Deck Metadata row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-display">
                    Deck Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Advanced Biochemistry: Krebs Cycle & PMF"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.1] focus:border-indigo-500 text-white text-xs outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-display">
                    Category / Tag
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Neuroscience, CS, Physics"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.1] focus:border-indigo-500 text-white text-xs outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-display">
                      Subject Folder
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsFolderModalOpen(true)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
                    >
                      + New
                    </button>
                  </div>
                  <select
                    value={folderId || ''}
                    onChange={(e) => setFolderId(e.target.value || undefined)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.1] focus:border-indigo-500 text-white text-xs outline-none cursor-pointer"
                  >
                    <option value="">📂 None (Uncategorized)</option>
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.icon || '📁'} {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-display">
                    Brief Overview
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Essential mechanisms and active recall"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.1] focus:border-indigo-500 text-white text-xs outline-none"
                  />
                </div>
              </div>

              {/* Concept Checkpoints Scrubber */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white font-display">
                      Concept Checkpoints ({concepts.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddConcept}
                    className="px-3 py-1 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Checkpoint</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {concepts.map((c, idx) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveConceptIdx(idx)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all border flex items-center gap-2 ${
                        activeConceptIdx === idx
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/25'
                          : 'bg-slate-900/60 text-slate-400 hover:text-white border-white/[0.06]'
                      }`}
                    >
                      <span>{idx + 1}.</span>
                      <span className="truncate max-w-[130px]">{c.title}</span>
                      <span className="text-[11px] opacity-75 font-mono">({c.retrievalCards.length})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Concept Editor */}
              {currentConcept && (
                <div className="p-5 rounded-2xl bg-slate-950/60 border border-white/[0.08] space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-400">Checkpoint Title</label>
                      <input
                        type="text"
                        value={currentConcept.title}
                        onChange={(e) => {
                          const updated = [...concepts];
                          updated[activeConceptIdx] = { ...currentConcept, title: e.target.value };
                          setConcepts(updated);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/[0.08] focus:border-indigo-500 text-white text-xs outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-400">Est. Minutes</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={currentConcept.estimatedMinutes}
                        onChange={(e) => {
                          const updated = [...concepts];
                          updated[activeConceptIdx] = { ...currentConcept, estimatedMinutes: Number(e.target.value) || 10 };
                          setConcepts(updated);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/[0.08] focus:border-indigo-500 text-white text-xs outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400">Intuitive Mental Model / Analogy</label>
                    <textarea
                      rows={2}
                      value={currentConcept.mentalModel}
                      onChange={(e) => {
                        const updated = [...concepts];
                        updated[activeConceptIdx] = { ...currentConcept, mentalModel: e.target.value };
                        setConcepts(updated);
                      }}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/[0.08] focus:border-indigo-500 text-white text-xs outline-none resize-none leading-relaxed"
                    />
                  </div>

                  {/* Retrieval Cards Section */}
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between border-t border-white/[0.08] pt-4">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-white font-display">
                          Active Retrieval Cards ({currentConcept.retrievalCards.length})
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAddCard('standard')}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[11px] font-semibold border border-indigo-500/30"
                        >
                          + Standard Card
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddCard('cloze')}
                          className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[11px] font-semibold border border-purple-500/30"
                        >
                          + Cloze Card
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddCard('multiple-choice')}
                          className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[11px] font-semibold border border-sky-500/30"
                        >
                          + Multiple Choice
                        </button>
                      </div>
                    </div>

                    {/* Cards List */}
                    <div className="space-y-3">
                      {currentConcept.retrievalCards.map((card, cIdx) => (
                        <div
                          key={card.id || cIdx}
                          className="p-4 rounded-xl bg-slate-900/80 border border-white/[0.06] space-y-3 relative group/card"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400 font-mono">#{cIdx + 1}</span>
                              <select
                                value={card.cardType || 'standard'}
                                onChange={(e) => handleUpdateCard(cIdx, 'cardType', e.target.value as CardType)}
                                className="px-2 py-0.5 rounded-md bg-slate-950 border border-white/[0.1] text-white text-[11px] font-semibold"
                              >
                                <option value="standard">Standard 3D Flip</option>
                                <option value="cloze">Cloze Deletion</option>
                                <option value="multiple-choice">Multiple Choice</option>
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveCard(cIdx)}
                              className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                              title="Delete Card"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Card Question / Template */}
                          <div className="space-y-1">
                            <label className="text-[11px] uppercase font-bold text-slate-400">
                              {card.cardType === 'cloze' 
                                ? 'Cloze Template (wrap target term in {{double_braces}})' 
                                : 'Question / Prompt'}
                            </label>
                            <input
                              type="text"
                              value={card.question}
                              onChange={(e) => {
                                handleUpdateCard(cIdx, 'question', e.target.value);
                                if (card.cardType === 'cloze') {
                                  handleUpdateCard(cIdx, 'clozeTemplate', e.target.value);
                                }
                              }}
                              placeholder={card.cardType === 'cloze' ? 'e.g. Memory is consolidated into the {{neocortex}} during sleep.' : 'e.g. What is the testing effect?'}
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/[0.08] text-white text-xs outline-none"
                            />
                          </div>

                          {/* Card Answer */}
                          <div className="space-y-1">
                            <label className="text-[11px] uppercase font-bold text-slate-400">
                              Target Recall Answer {card.cardType === 'cloze' && '(The word inside {{}})'}
                            </label>
                            <input
                              type="text"
                              value={card.answer}
                              onChange={(e) => handleUpdateCard(cIdx, 'answer', e.target.value)}
                              placeholder="Target correct answer"
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/[0.08] text-white text-xs outline-none"
                            />
                          </div>

                          {/* Multiple Choice Options */}
                          {card.cardType === 'multiple-choice' && (
                            <div className="space-y-2 pt-1">
                              <label className="text-[11px] uppercase font-bold text-slate-400">
                                4 Multiple Choice Options (Comma-separated)
                              </label>
                              <input
                                type="text"
                                value={(card.options || [card.answer, 'Option B', 'Option C', 'Option D']).join(', ')}
                                onChange={(e) => {
                                  const opts = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                  handleUpdateCard(cIdx, 'options', opts);
                                }}
                                placeholder="Choice 1, Choice 2, Choice 3, Choice 4"
                                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/[0.08] text-white text-xs outline-none"
                              />
                            </div>
                          )}

                          {/* Hint & Explanation Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-400">Optional Hint</label>
                              <input
                                type="text"
                                value={card.hint || ''}
                                onChange={(e) => handleUpdateCard(cIdx, 'hint', e.target.value)}
                                placeholder="Helpful recall cue..."
                                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-white/[0.08] text-white text-xs outline-none"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-400">Scientific Detail / Explanation</label>
                              <input
                                type="text"
                                value={card.explanation || ''}
                                onChange={(e) => handleUpdateCard(cIdx, 'explanation', e.target.value)}
                                placeholder="Underlying cognitive nuance..."
                                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-white/[0.08] text-white text-xs outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: IMPORT ANKI / CSV / TSV */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-display">
                    Import Deck Title
                  </label>
                  <input
                    type="text"
                    value={importDeckTitle}
                    onChange={(e) => setImportDeckTitle(e.target.value)}
                    placeholder="e.g. Cellular Biology Anki Deck"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.1] focus:border-purple-500 text-white text-xs outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-display">
                    Category / Tag
                  </label>
                  <input
                    type="text"
                    value={importCategory}
                    onChange={(e) => setImportCategory(e.target.value)}
                    placeholder="e.g. Biology, CS, History"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.1] focus:border-purple-500 text-white text-xs outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-display">
                      Subject Folder
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsFolderModalOpen(true)}
                      className="text-[10px] text-purple-400 hover:text-purple-300 font-bold cursor-pointer"
                    >
                      + New
                    </button>
                  </div>
                  <select
                    value={folderId || ''}
                    onChange={(e) => setFolderId(e.target.value || undefined)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.1] focus:border-purple-500 text-white text-xs outline-none cursor-pointer"
                  >
                    <option value="">📂 None (Uncategorized)</option>
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.icon || '📁'} {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-display">
                    Delimiter
                  </label>
                  <select
                    value={importDelimiter}
                    onChange={(e) => {
                      const d = e.target.value as 'tab' | 'comma' | 'pipe';
                      setImportDelimiter(d);
                      if (importText) handleParseImportText(importText, d);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.1] text-white text-xs outline-none"
                  >
                    <option value="tab">Tab-Separated (Anki / TSV default)</option>
                    <option value="comma">Comma-Separated (.csv)</option>
                    <option value="pipe">Pipe-Separated (|)</option>
                  </select>
                </div>
              </div>

              {/* Upload Drop Zone & Text Area */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-2 font-display">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <span>Paste Raw Flashcards or Choose File</span>
                  </label>
                  
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Select .tsv / .csv / .txt / .json</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".tsv,.csv,.txt,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                <textarea
                  rows={8}
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    handleParseImportText(e.target.value, importDelimiter);
                  }}
                  placeholder={`Paste front and back lines separated by ${importDelimiter === 'tab' ? 'Tab' : importDelimiter === 'comma' ? 'Comma' : 'Pipe'}:\nFront question\tBack answer\tOptional hint\nAnother question\tAnother answer`}
                  className="w-full p-4 rounded-2xl bg-slate-950/80 border border-white/[0.12] focus:border-purple-500 text-white font-mono text-xs outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Parsed Preview Table */}
              {importedPreview.length > 0 && (
                <div className="space-y-2 pt-2 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>Parsed Preview ({importedPreview.length} Flashcards):</span>
                    <span className="text-emerald-400 font-mono">Format Verified</span>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-2xl border border-white/[0.08] bg-slate-950/60 divide-y divide-white/[0.04] text-xs">
                    {importedPreview.slice(0, 8).map((card, idx) => (
                      <div key={idx} className="p-3 flex items-start gap-4">
                        <span className="font-mono text-slate-500 font-bold shrink-0">{idx + 1}</span>
                        <div className="flex-1 font-semibold text-slate-200 truncate">{card.front}</div>
                        <div className="flex-1 text-slate-400 truncate">{card.back}</div>
                      </div>
                    ))}
                    {importedPreview.length > 8 && (
                      <div className="p-2.5 text-center text-slate-500 font-mono text-[11px]">
                        + {importedPreview.length - 8} additional cards parsed
                      </div>
                    )}
                  </div>
                </div>
              )}

              {importSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{importSuccess}</span>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: IMAGE OCCLUSION ARCHITECT */}
          {activeTab === 'occlusion' && (
            <div className="py-1">
              <ImageOcclusionStudio
                onCardsGenerated={(_cards, _deckTitle) => {
                  const all = StorageService.getSessions();
                  const latest = all[all.length - 1];
                  if (latest) {
                    onSaveDeck(latest);
                  }
                  onClose();
                }}
                onClose={onClose}
              />
            </div>
          )}

        </div>

        {/* Footer Actions */}
        {activeTab !== 'occlusion' && (
          <div className="p-5 border-t border-white/[0.08] bg-slate-900/60 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
            >
              Cancel
            </button>

            {activeTab === 'create' ? (
              <button
                type="button"
                onClick={handleSaveManualDeck}
                className="px-7 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all hover:scale-[1.02]"
              >
                <Sparkles className="w-4 h-4" />
                <span>Save & Register in Library</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={importedPreview.length === 0}
                className={`px-7 py-2.5 rounded-xl font-bold text-xs shadow-lg flex items-center gap-2 transition-all ${
                  importedPreview.length === 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/[0.04]'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30 hover:scale-[1.02]'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Import {importedPreview.length} Cards as Active Deck</span>
              </button>
            )}
          </div>
        )}

      </div>

      {isFolderModalOpen && (
        <SubjectFolderModal
          isOpen={isFolderModalOpen}
          onClose={() => setIsFolderModalOpen(false)}
          onFolderSaved={(newFolder) => {
            setFolders(StorageService.getFolders());
            setFolderId(newFolder.id);
          }}
        />
      )}
    </div>
  );
};

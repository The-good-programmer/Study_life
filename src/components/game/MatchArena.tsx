import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Zap, 
  Timer, 
  ArrowLeft, 
  RotateCcw, 
  Trophy, 
  Flame, 
  Sparkles, 
  Play
} from 'lucide-react';
import type { StudySession, RetrievalCard } from '../../types';
import { soundEngine } from '../../services/soundEngine';
import { StorageService } from '../../services/storageService';
import { lifeSimService } from '../../services/lifeSimService';
import { characterService } from '../../services/characterService';
import { UserAvatarBadge } from '../character/UserAvatarBadge';

interface MatchTile {
  id: string;
  cardId: string;
  text: string;
  type: 'question' | 'answer';
  isMatched: boolean;
}

function generateTilesFromSession(session: StudySession): MatchTile[] {
  const allCards: RetrievalCard[] = session.concepts.flatMap(c => c.retrievalCards);
  if (allCards.length === 0) return [];
  const shuffledCards = [...allCards].sort(() => Math.random() - 0.5).slice(0, 6);
  const generated: MatchTile[] = [];
  shuffledCards.forEach((card, idx) => {
    generated.push({
      id: `q-${card.id}-${idx}`,
      cardId: card.id,
      text: card.question.length > 90 ? card.question.slice(0, 87) + '...' : card.question,
      type: 'question',
      isMatched: false,
    });
    generated.push({
      id: `a-${card.id}-${idx}`,
      cardId: card.id,
      text: card.answer.length > 90 ? card.answer.slice(0, 87) + '...' : card.answer,
      type: 'answer',
      isMatched: false,
    });
  });
  return generated.sort(() => Math.random() - 0.5);
}

interface MatchArenaProps {
  session: StudySession;
  onBack: () => void;
  onLaunchStudy?: () => void;
}

export const MatchArena: React.FC<MatchArenaProps> = ({ session, onBack, onLaunchStudy }) => {
  const [tiles, setTiles] = useState<MatchTile[]>(() => generateTilesFromSession(session));
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [mismatchedTileIds, setMismatchedTileIds] = useState<string[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [mistakesCount, setMistakesCount] = useState(0);
  const [bestTimeMs, setBestTimeMs] = useState<number | null>(() => {
    const raw = localStorage.getItem(`axon_match_best_${session.id}`) || localStorage.getItem(`studify_match_best_${session.id}`);
    return raw ? parseInt(raw, 10) : null;
  });

  const timerRef = useRef<number | null>(null);
  const handleTileClickRef = useRef<(clickedTile: MatchTile) => void>(() => {});

  // Tile Selection Handler
  const handleTileClick = (clickedTile: MatchTile) => {
    if (clickedTile.isMatched || mismatchedTileIds.length > 0) return;

    // First tile tapped
    if (!selectedTileId) {
      setSelectedTileId(clickedTile.id);
      return;
    }

    // Tapping the exact same tile: deselect
    if (selectedTileId === clickedTile.id) {
      setSelectedTileId(null);
      return;
    }

    const firstTile = tiles.find(t => t.id === selectedTileId);
    if (!firstTile) {
      setSelectedTileId(clickedTile.id);
      return;
    }

    // Checking if they match!
    const isPair = firstTile.cardId === clickedTile.cardId && firstTile.type !== clickedTile.type;

    if (isPair) {
      // MATCH!
      soundEngine.playCorrectChime();
      const updatedStreak = streak + 1;
      setStreak(updatedStreak);
      if (updatedStreak > maxStreak) setMaxStreak(updatedStreak);

      const nextTiles = tiles.map(t => {
        if (t.id === firstTile.id || t.id === clickedTile.id) {
          return { ...t, isMatched: true };
        }
        return t;
      });

      setTiles(nextTiles);
      setSelectedTileId(null);

      // Check if all matched
      const allMatched = nextTiles.every(t => t.isMatched);
      if (allMatched) {
        setIsCompleted(true);
        setIsRunning(false);
        soundEngine.playCompletionChime();

        // Trigger victory celebration
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch {
          // ignore
        }

        // Award Study Wage & XP
        StorageService.addXP(45);
        lifeSimService.awardStudyWage('Match Arena Clear', 20);

        // Update high score
        const finalTime = elapsedMs;
        const currentBest = bestTimeMs;
        if (!currentBest || finalTime < currentBest) {
          setBestTimeMs(finalTime);
          localStorage.setItem(`axon_match_best_${session.id}`, finalTime.toString());
        }
      }
    } else {
      // MISMATCH!
      soundEngine.playIncorrectChime();
      setStreak(0);
      setMistakesCount(prev => prev + 1);
      setMismatchedTileIds([firstTile.id, clickedTile.id]);

      window.setTimeout(() => {
        setMismatchedTileIds([]);
        setSelectedTileId(null);
      }, 650);
    }
  };

  useEffect(() => {
    handleTileClickRef.current = handleTileClick;
  });

  // Keyboard navigation: 1-9 to select active tiles, Escape to deselect
  useEffect(() => {
    if (isCompleted || tiles.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        setSelectedTileId(null);
        return;
      }

      const activeTiles = tiles.filter(t => !t.isMatched);
      const digit = parseInt(e.key, 10);
      if (!isNaN(digit) && digit >= 1 && digit <= activeTiles.length) {
        e.preventDefault();
        const targetTile = activeTiles[digit - 1];
        if (targetTile) {
          handleTileClickRef.current(targetTile);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tiles, isCompleted]);

  // Re-shuffle match game on user request
  const resetGame = () => {
    setTiles(generateTilesFromSession(session));
    setSelectedTileId(null);
    setMismatchedTileIds([]);
    setElapsedMs(0);
    setIsRunning(true);
    setIsCompleted(false);
    setStreak(0);
    setMistakesCount(0);
  };

  // Stopwatch loop
  useEffect(() => {
    if (isRunning && !isCompleted) {
      const interval = window.setInterval(() => {
        setElapsedMs(prev => prev + 100);
      }, 100);
      timerRef.current = interval;
      return () => clearInterval(interval);
    }
  }, [isRunning, isCompleted]);



  const formatSeconds = (ms: number) => {
    return (ms / 1000).toFixed(1);
  };

  if (tiles.length === 0) {
    return (
      <div className="max-w-xl mx-auto p-8 rounded-3xl glass-panel text-center space-y-5 animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <Sparkles className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-xl font-bold text-white font-display">No Flashcards In This Deck</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Match Arena requires at least 1 flashcard to construct memory pairs. Add flashcards in Deck Studio or import a starter deck from the catalog.
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors cursor-pointer"
        >
          Return to Deck
        </button>
      </div>
    );
  }

  const activeTiles = tiles.filter(t => !t.isMatched);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in text-slate-100">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-2xl glass-panel">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit Game</span>
        </button>

        <div className="flex items-center gap-4">
          {/* Live Timer */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-white/[0.08] text-xs font-mono font-bold text-amber-400">
            <Timer className="w-4 h-4" />
            <span>{formatSeconds(elapsedMs)}s</span>
          </div>

          {/* Streak Counter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
            <Flame className="w-4 h-4 text-orange-400 fill-orange-400" />
            <span>{streak}x Combo</span>
          </div>
        </div>

        <button
          onClick={resetGame}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Restart with new shuffled pairs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>

      {/* Main Game Arena */}
      {!isCompleted ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-2">
            <span>Tap or press numeric keys <span className="font-mono text-indigo-300 bg-white/[0.08] px-1.5 py-0.5 rounded text-[11px]">1-9</span> to match prompts with answers.</span>
            <span>
              {tiles.filter(t => t.isMatched).length / 2} / {tiles.length / 2} Pairs Matched
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {tiles.map((tile) => {
              const isSelected = selectedTileId === tile.id;
              const isMismatched = mismatchedTileIds.includes(tile.id);
              const isMatched = tile.isMatched;
              const activeIndex = activeTiles.findIndex(t => t.id === tile.id);

              if (isMatched) {
                return (
                  <div
                    key={tile.id}
                    className="p-4 rounded-2xl bg-emerald-950/10 border border-emerald-500/20 text-emerald-400/30 opacity-20 pointer-events-none transition-all duration-500 scale-95 flex items-center justify-center min-h-[105px] text-center text-xs"
                  >
                    Matched
                  </div>
                );
              }

              return (
                <div
                  key={tile.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${tile.type === 'question' ? 'Prompt' : 'Target Match'}: ${tile.text}`}
                  onClick={() => handleTileClick(tile)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleTileClick(tile);
                    }
                  }}
                  className={`p-4 rounded-2xl border transition-all duration-200 select-none flex flex-col justify-between cursor-pointer min-h-[115px] group text-left relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                    isSelected
                      ? 'bg-indigo-600/30 border-indigo-400 shadow-lg shadow-indigo-600/30 scale-[1.03] text-white'
                      : isMismatched
                      ? 'bg-rose-950/60 border-rose-500 text-rose-200 animate-pulse'
                      : 'bg-slate-950/60 border-white/[0.08] hover:border-indigo-500/40 hover:bg-slate-900/80 text-slate-200 hover:scale-[1.01]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {tile.type === 'question' ? 'Prompt' : 'Target Match'}
                    </span>
                    {activeIndex >= 0 && activeIndex < 9 && (
                      <span className="text-[11px] font-mono text-slate-500 bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 rounded">
                        {activeIndex + 1}
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-medium leading-relaxed mt-1 mb-auto line-clamp-4">
                    {tile.text}
                  </div>

                  {isSelected && (
                    <div className="mt-2 text-[11px] font-semibold text-indigo-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                      <span>Select match...</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Victory Screen */
        <div className="p-8 sm:p-12 rounded-3xl glass-panel text-center space-y-6 max-w-xl mx-auto border-emerald-500/30 shadow-2xl shadow-emerald-500/10 animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative w-20 h-20 rounded-3xl p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 mx-auto shadow-2xl shadow-purple-500/20 flex items-center justify-center">
            <UserAvatarBadge size="lg" showBorder={false} />
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 ring-4 ring-slate-950 animate-ping" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-black text-white font-display">
              Matching Arena Cleared!
            </h2>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold font-mono">
              <span>🪙 +20 Study Wage Deposited</span>
            </div>
            <p className="text-xs text-slate-300">
              <span className="text-cyan-300 font-bold font-display">{characterService.getCharacter().name || 'Study Partner'}:</span> "Blazing synaptic recall speed! Active association trains instant memory indexing."
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-950/80 border border-white/[0.08] text-center">
            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Time</span>
              <div className="text-lg font-bold text-amber-400 font-mono">
                {formatSeconds(elapsedMs)}s
              </div>
            </div>

            <div className="space-y-0.5 border-x border-white/[0.08]">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Max Combo</span>
              <div className="text-lg font-bold text-indigo-400 font-mono">
                {maxStreak}x
              </div>
            </div>

            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Errors</span>
              <div className="text-lg font-bold text-rose-400 font-mono">
                {mistakesCount}
              </div>
            </div>
          </div>

          {bestTimeMs && (
            <div className="text-xs text-emerald-400 font-semibold flex items-center justify-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              <span>Personal Best: {formatSeconds(bestTimeMs)}s</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={resetGame}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-bold text-white transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Play Again</span>
            </button>

            {onLaunchStudy && (
              <button
                onClick={onLaunchStudy}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Full Study Pilot</span>
                <Play className="w-3.5 h-3.5 fill-white" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="p-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[11px] text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Active association speed training • Rapid mental model indexing</span>
        </span>
        <span className="font-mono text-slate-400">{session.title}</span>
      </div>
    </div>
  );
};

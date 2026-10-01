import React, { useState } from 'react';
import { ArrowLeft, Clock, Flame, Award, Layers, Play } from 'lucide-react';
import type { RetrievalCard, StudySession, UserStats } from '../../types';
import { StorageService } from '../../services/storageService';
import { FSRSService } from '../../services/fsrsService';
import { soundEngine } from '../../services/soundEngine';

interface RetentionDashboardProps {
  stats: UserStats;
  onBack: () => void;
  onStartSession: (session: StudySession) => void;
}

export const RetentionDashboard: React.FC<RetentionDashboardProps> = ({ stats, onBack, onStartSession }) => {
  const [dueCards, setDueCards] = useState<RetrievalCard[]>(StorageService.getDueCards());
  const [activeReviewCardIndex, setActiveReviewCardIndex] = useState<number | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const sessions = StorageService.getSessions();

  const handleStartDueReview = () => {
    if (dueCards.length === 0) return;
    setActiveReviewCardIndex(0);
    setIsAnswerRevealed(false);
  };

  const handleRateReviewCard = (rating: 'again' | 'hard' | 'good' | 'easy') => {
    if (activeReviewCardIndex === null) return;
    const currentCard = dueCards[activeReviewCardIndex];
    const { updatedCard } = FSRSService.schedule(currentCard, rating);
    StorageService.saveCard(updatedCard);

    if (activeReviewCardIndex + 1 < dueCards.length) {
      setActiveReviewCardIndex(activeReviewCardIndex + 1);
      setIsAnswerRevealed(false);
    } else {
      soundEngine.playCompletionChime();
      setActiveReviewCardIndex(null);
      setDueCards(StorageService.getDueCards());
    }
  };

  // If currently reviewing due cards
  if (activeReviewCardIndex !== null && dueCards[activeReviewCardIndex]) {
    const card = dueCards[activeReviewCardIndex];
    const intervals = FSRSService.previewIntervals(card);

    return (
      <div className="max-w-2xl mx-auto space-y-6 py-8 px-4 animate-fadeIn">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setActiveReviewCardIndex(null)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel Review</span>
          </button>
          <span className="text-xs text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800">
            Due Card {activeReviewCardIndex + 1} of {dueCards.length}
          </span>
        </div>

        <div className="min-h-[300px] rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="text-xs uppercase text-slate-400 font-bold">FSRS Scheduled Recall</div>
            <h3 className="text-lg font-semibold text-white leading-relaxed">{card.question}</h3>
            {card.hint && !isAnswerRevealed && (
              <p className="text-xs text-amber-300/80 bg-amber-950/20 p-2.5 rounded-lg border border-amber-900/40">
                💡 {card.hint}
              </p>
            )}
          </div>

          {isAnswerRevealed ? (
            <div className="mt-6 pt-6 border-t border-slate-800 space-y-4 animate-fadeIn">
              <p className="text-base text-slate-100 font-medium">{card.answer}</p>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <button
                  onClick={() => handleRateReviewCard('again')}
                  className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs font-semibold"
                >
                  <div>Again</div>
                  <div className="text-[10px] text-rose-400 font-normal">{intervals.again}</div>
                </button>
                <button
                  onClick={() => handleRateReviewCard('hard')}
                  className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800 text-amber-300 text-xs font-semibold"
                >
                  <div>Hard</div>
                  <div className="text-[10px] text-amber-400 font-normal">{intervals.hard}</div>
                </button>
                <button
                  onClick={() => handleRateReviewCard('good')}
                  className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-800 text-blue-300 text-xs font-semibold"
                >
                  <div>Good</div>
                  <div className="text-[10px] text-blue-400 font-normal">{intervals.good}</div>
                </button>
                <button
                  onClick={() => handleRateReviewCard('easy')}
                  className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-semibold"
                >
                  <div>Easy</div>
                  <div className="text-[10px] text-emerald-400 font-normal">{intervals.easy}</div>
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-6 flex justify-center">
              <button
                onClick={() => setIsAnswerRevealed(true)}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
              >
                Reveal Target Answer
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8 px-4 animate-fadeIn">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Ingestion Hub</span>
        </button>
        <span className="text-xs text-slate-400">Memory Decay Tracking</span>
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Retention & Spaced Repetition Dashboard
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Tracking memory consolidation through the Free Spaced Repetition Scheduler (FSRS).
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <Flame className="w-5 h-5 text-amber-400 mb-1" />
          <div className="text-xl font-bold text-white">{stats.currentStreak} Days</div>
          <div className="text-xs text-slate-400">Current Streak</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <Clock className="w-5 h-5 text-indigo-400 mb-1" />
          <div className="text-xl font-bold text-white">{stats.totalStudyMinutes}m</div>
          <div className="text-xs text-slate-400">Total Study Time</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <Award className="w-5 h-5 text-purple-400 mb-1" />
          <div className="text-xl font-bold text-white">{stats.conceptsMastered}</div>
          <div className="text-xs text-slate-400">Concepts Mastered</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <Layers className="w-5 h-5 text-emerald-400 mb-1" />
          <div className="text-xl font-bold text-white">{dueCards.length}</div>
          <div className="text-xs text-slate-400">Cards Due Today</div>
        </div>
      </div>

      {/* Spaced Review Action Box */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-base font-bold text-white">Daily Memory Reinforcement Queue</h3>
          <p className="text-xs text-slate-400">
            {dueCards.length > 0
              ? `You have ${dueCards.length} flashcards due for optimal retention review right now.`
              : 'All your flashcards are currently in long-term memory stability! No cards due right now.'}
          </p>
        </div>

        {dueCards.length > 0 && (
          <button
            onClick={handleStartDueReview}
            className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Review {dueCards.length} Due Cards</span>
          </button>
        )}
      </div>

      {/* Recent Sessions */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Recent Study Sessions</h3>
        {sessions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800">
            No sessions recorded yet. Launch your first Study Pilot to start building your knowledge base!
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="text-sm font-semibold text-white">{sess.title}</div>
                  <div className="text-xs text-slate-500">
                    {sess.concepts.length} concepts • {Math.max(1, Math.round(sess.elapsedSeconds / 60))} minutes
                  </div>
                </div>
                <button
                  onClick={() => onStartSession(sess)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-indigo-300 font-medium transition-colors"
                >
                  Resume Pilot
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

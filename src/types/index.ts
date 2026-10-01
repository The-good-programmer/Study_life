export interface RetrievalCard {
  id: string;
  conceptId: string;
  question: string;
  answer: string;
  hint?: string;
  explanation?: string;
  // FSRS scheduling metadata
  stability: number; // in days
  difficulty: number; // 1 to 10
  reps: number;
  lapses: number;
  lastReviewDate?: string;
  nextReviewDate?: string;
}

export interface ConceptCheckpoint {
  id: string;
  order: number;
  title: string;
  estimatedMinutes: number;
  mentalModel: string; // Intuitive analogy or big picture summary
  coreTakeaways: string[];
  keyTerms: { term: string; definition: string }[];
  feynmanPrompt: string; // The specific challenge (e.g. "Explain why X happens without using word Y")
  sampleMasteryExplanation: string;
  retrievalCards: RetrievalCard[];
}

export type StudyPhase = 'priming' | 'feynman' | 'retrieval' | 'rest' | 'summary';

export interface StudySession {
  id: string;
  title: string;
  category: string;
  description: string;
  concepts: ConceptCheckpoint[];
  currentConceptIndex: number;
  currentPhase: StudyPhase;
  elapsedSeconds: number;
  createdAt: string;
  completedAt?: string;
}

export interface FeynmanEvaluation {
  score: number; // 0 - 100
  grade: 'Novice' | 'Developing' | 'Solid Understanding' | 'Complete Mastery';
  masteredPoints: string[];
  missingNuances: string[];
  jargonDetected: string[];
  actionableFeedback: string;
}

export type FSRSRating = 'again' | 'hard' | 'good' | 'easy';

export interface UserStats {
  totalStudyMinutes: number;
  sessionsCompleted: number;
  conceptsMastered: number;
  currentStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
  cardsDueCount: number;
  // Habit & XP metrics
  xp: number;
  level: number;
  levelTitle: string;
  dailyGoalMinutes: number;
  todayMinutes: number;
}

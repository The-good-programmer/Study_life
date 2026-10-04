export type CardType = 'standard' | 'cloze' | 'multiple-choice' | 'image-occlusion';

export interface OcclusionMask {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 0-100
  height: number; // percentage 0-100
  label?: string; // target answer covered by mask
  hint?: string;
}

export type CognitiveTrapType = 
  | 'inversion'          // Cause & effect reversed
  | 'semantic-twin'      // Phonetically or categorially close term (e.g. Mitosis/Meiosis)
  | 'naive-intuition'    // Common sense fallacy (e.g. heavier falls faster)
  | 'partial-truth'      // True fact, but answers a different question
  | 'boundary-overstep'; // Holds in some conditions, but fails here

export interface DiagnosticDistractor {
  optionText: string;
  trapType: CognitiveTrapType;
  trapTitle?: string;
  trapExplanation: string; // The Socratic explanation of why the brain made this mistake
}

export interface SocraticHintLadder {
  level1Prompt: string; // Socratic Question: guides attention to missing link
  level2Analogy: string; // Physical Grounded Analogy: maps to intuitive physical system
  level3Deconstruction: string; // Atomic simplification: breaks question in half
}

export interface RetrievalCard {
  id: string;
  conceptId: string;
  cardType?: CardType;
  question: string;
  answer: string;
  hint?: string;
  explanation?: string;
  options?: string[]; // Distractor choices for multiple choice
  diagnosticDistractors?: DiagnosticDistractor[]; // Misconception mapping for distractors
  socraticHintLadder?: SocraticHintLadder; // 3-tier progressive hint scaffolding
  clozeTemplate?: string; // Text containing {{blank}} for cloze deletion
  // Image Occlusion fields:
  imageUrl?: string;
  occlusionMode?: 'hide-all-reveal-one' | 'hide-one-reveal-one';
  masks?: OcclusionMask[];
  activeMaskId?: string;
  // FSRS scheduling metadata
  stability: number; // in days
  difficulty: number; // 1 to 10
  reps: number;
  lapses: number;
  lastReviewDate?: string;
  nextReviewDate?: string;
  diagramDataUrl?: string; // Optional student dual-coding sketch
  sourceAnchor?: SourceAnchor;
  isStarred?: boolean; // Star/Bookmark for high-priority drilling
  retrievability?: number; // Current calculated probability of recall (0 - 100%)
}

export interface SourceAnchor {
  pageNumber: number;
  snippet?: string;
  sourceName?: string;
  relevanceReason?: string;
}

export interface PDFSourcePage {
  pageNumber: number;
  text: string;
}

export interface SourceDocument {
  name: string;
  totalPages: number;
  pages?: PDFSourcePage[];
  pdfDataUrl?: string;
}

export interface ConceptNode {
  id: string;
  label: string;
  category: 'core' | 'mechanism' | 'application';
  connectedTo: string[];
  description?: string;
}

export interface ConceptCheckpoint {
  id: string;
  order: number;
  title: string;
  estimatedMinutes: number;
  mentalModel: string; // Intuitive analogy or big picture summary
  coreTakeaways: string[];
  keyTerms: { term: string; definition: string }[];
  conceptNodes?: ConceptNode[]; // Interactive dual-coding knowledge graph
  feynmanPrompt: string; // The specific challenge
  sampleMasteryExplanation: string;
  retrievalCards: RetrievalCard[];
  diagramDataUrl?: string; // Serialized sketch data URL
  sourceAnchor?: SourceAnchor;
}

export type StudyPhase = 'diagnostic' | 'priming' | 'feynman' | 'retrieval' | 'rest' | 'summary';

export interface DiagnosticProbe {
  conceptId: string;
  conceptTitle: string;
  question: string;
  options: string[];
  correctAnswer: string;
  userAnswer?: string;
  isCorrect?: boolean;
}

export interface DiagnosticReport {
  probes: DiagnosticProbe[];
  score: number;
  completedAt: string;
}

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
  sourceDocument?: SourceDocument;
  casualFlashcardMode?: boolean;
  diagnosticReport?: DiagnosticReport;
  depthTier?: DepthTier;
  gradeLevel?: AcademicGradeLevel;
  studentProfile?: StudentEducationProfile;
  languageCode?: string;
}

export interface FeynmanEvaluation {
  score: number; // 0 - 100
  grade: 'Novice' | 'Developing' | 'Solid Understanding' | 'Complete Mastery' | 'Self-Review';
  masteredPoints: string[];
  missingNuances: string[];
  jargonDetected: string[];
  actionableFeedback: string;
  isOfflineSelfCheck?: boolean;
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
  targetRetention?: number; // Desired target retention rate (0.75 - 0.97, default 0.90)
}

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export type ExamQuadrant = 'mastery' | 'lucky-guess' | 'known-unknown' | 'blindspot';

export interface ExamQuestionResult {
  card: RetrievalCard;
  conceptTitle: string;
  deckTitle: string;
  userAnswer: string;
  isCorrect: boolean;
  confidence: ConfidenceLevel;
  pointsEarned: number;
  quadrant: ExamQuadrant;
  explanation?: string;
}

export interface ExamReport {
  id: string;
  date: string;
  deckTitle: string;
  totalQuestions: number;
  correctCount: number;
  rawAccuracyPercent: number;
  confidenceWeightedScore: number;
  maxPossibleScore: number;
  calibrationPercent: number; // Calibration accuracy between confidence and correctness
  blindspotCount: number; // High confidence + wrong (Cognitive Illusion)
  luckyGuessCount: number; // Low confidence + right
  knownUnknownCount: number; // Low confidence + wrong
  masteryCount: number; // High confidence + right
  timeSpentSeconds: number;
  questionResults: ExamQuestionResult[];
}

export type SocraticTurnRole = 'examiner' | 'student';
export type SocraticTurnType = 'initial-prompt' | 'mechanism-probe' | 'counter-example' | 'analogy-probe' | 'verdict';
export type SocraticTurnReaction = 'satisfied' | 'skeptical' | 'probing' | 'impressed';

export interface SocraticTurn {
  id: string;
  role: SocraticTurnRole;
  text: string;
  timestamp: number;
  turnType?: SocraticTurnType;
  jargonDetected?: string[];
  reaction?: SocraticTurnReaction;
  reactionNote?: string;
}

export interface VivaDefenseVerdict {
  overallGrade: 'Summa Cum Laude' | 'Pass with Distinction' | 'Sound Defense' | 'Conditional Pass' | 'Incomplete Defense';
  depthScore: number; // 0-100
  analogyIntegrity: number; // 0-100
  jargonFreeScore: number; // 0-100
  roundsCompleted: number;
  verdictSummary: string;
  keyStrengths: string[];
  vulnerableBlindspots: string[];
}

export type LeechRootCause = 'interference' | 'abstract-disconnect' | 'overloaded-card' | 'arbitrary-ordering';

export interface MnemonicRewiringOption {
  id: string;
  strategy: 'sensory-story' | 'acronym-rhyme' | 'atomic-split' | 'etymology-anchor';
  strategyTitle: string;
  badge: string;
  mnemonicText: string;
  visualImagery: string;
  recommendedAction: string;
  atomicCards?: { question: string; answer: string; clozeTemplate?: string }[];
}

export interface LeechAnalysis {
  cardId: string;
  rootCause: LeechRootCause;
  diagnosisTitle: string;
  diagnosticExplanation: string;
  confusionSuspects?: string[];
  rewiringOptions: MnemonicRewiringOption[];
}

export type InterleavingStrategy = 'round-robin' | 'cognitive-entropy' | 'adaptive-difficulty';

export interface InterleavedCard extends RetrievalCard {
  deckId: string;
  deckTitle: string;
  domain: string;
  domainColor: string;
}

export interface InterleavingSessionReport {
  id: string;
  timestamp: string;
  totalCards: number;
  contextShiftsCount: number;
  strategy: InterleavingStrategy;
  overallAccuracyPercent: number;
  switchAccuracyPercent: number;
  stableAccuracyPercent: number;
  agilityIndex: number;
  domainBreakdown: {
    domain: string;
    total: number;
    correct: number;
    accuracyPercent: number;
    color: string;
  }[];
  xpEarned: number;
}
export interface StarterDeckMetadata {
  id: string;
  title: string;
  category: 'Medical & Clinical' | 'STEM & Engineering' | 'Biochemistry & Life Sciences' | 'Languages & Polyglot' | 'Cognitive & Behavioral Science';
  difficulty: 'Foundational' | 'Intermediate' | 'High-Yield Board Review';
  estimatedMinutes: number;
  cardCount: number;
  conceptCount: number;
  hasImageOcclusion: boolean;
  hasSourcePdf: boolean;
  tags: string[];
  verifiedBy: string;
  targetAudience: string;
  summary: string;
  session: StudySession;
}

export type DepthTier = 'foundational' | 'standard' | 'deep-dive';

export type AcademicGradeLevel =
  | 'elementary'     // Grades 1-5 (e.g. 4th grader, ages 7-11)
  | 'middle-school'  // Grades 6-8 (ages 11-14)
  | 'high-school'    // Grades 9-12 (e.g. 9th grader, ages 14-18)
  | 'college'        // Undergraduate / AP (ages 18-22)
  | 'specialist';    // Graduate / Professional / Olympiad

export interface GradeLevelOption {
  level: AcademicGradeLevel;
  label: string;
  badge: string;
  ageRange: string;
  description: string;
}

export interface ConceptDepthEstimate {
  score: number; // 1 to 10 scale of cognitive complexity
  tier: DepthTier;
  gradeLevel: AcademicGradeLevel;
  gradeLabel: string;
  recommendedCheckpoints: number; // 2 to 6 checkpoints
  estimatedMinutes: number; // 15 to 90 minutes
  domain: string;
  reasoning: string;
  detectedKeywords: string[];
}

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export interface StudentEducationProfile {
  age: number; // e.g. 15
  country: string; // e.g. "United States", "Turkey", "United Kingdom"
  grade: string; // e.g. "9th Grade", "Year 10", "4. Sınıf"
}

export type AuthProvider = 'password' | 'google';

export interface GoogleProfilePayload {
  googleId: string;
  email: string;
  name: string;
  pictureUrl?: string;
}

export interface GoogleAuthDTO extends GoogleProfilePayload {
  age?: number;
  country?: string;
  grade?: string;
  avatar?: string;
  institution?: string;
  migrateGuestData?: boolean;
}

export interface UserAccount {
  id: string; // Unique identifier
  name: string; // Display name
  email: string; // Normalized lowercase email
  passwordHash?: string; // Web Crypto SHA-256 hash (optional for OAuth / Google accounts)
  passwordSalt?: string; // Cryptographic salt hex (optional for OAuth / Google accounts)
  provider?: AuthProvider; // 'password' | 'google'
  googleId?: string; // Google sub id
  pictureUrl?: string; // Google profile picture URL
  age: number; // Student age
  country: string; // Student country
  grade: string; // Grade in country's curriculum
  gradeLevel?: AcademicGradeLevel; // Optional legacy tier
  avatar: string; // Emoji avatar icon or letter
  createdAt: string; // ISO timestamp
  lastLoginAt: string; // ISO timestamp
  bio?: string;
  institution?: string; // School, university, or organization
}

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
  age: number;
  country: string;
  grade: string;
  gradeLevel?: AcademicGradeLevel;
  avatar?: string;
  institution?: string;
  migrateGuestData?: boolean;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  error?: string;
  user?: UserAccount;
  requiresProfileSetup?: boolean;
  partialProfile?: GoogleProfilePayload;
}

import type { ConceptCheckpoint, RetrievalCard, StudentEducationProfile, StudySession } from '../types';
import { AIService } from './aiService';
import { EXAM_ROAST_SCHEMA, STUDY_SESSION_GENERATION_SCHEMA } from './aiSchemas';
import { SUPPORTED_LANGUAGES } from './depthEstimationService';

/**
 * Roast my exam: reads photos of a marked exam paper, finds what cost the marks, jokes about the mistakes
 * (never the student), and turns them into a deck that tests the idea behind each mistake.
 */

export type MistakeKind = 'concept-gap' | 'careless' | 'misread-question' | 'method-error' | 'incomplete' | 'memory-slip';

export type RoastTone = 'gentle' | 'spicy';

export interface ExamMistake {
  id: string;
  questionRef: string;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  kind: MistakeKind;
  topic: string;
  whyWrong: string;
  roast: string;
  /** Marks lost, when the paper shows them. */
  pointsLost: number | null;
  /** 'low' when the AI was unsure of the handwriting, the marking or the right answer. */
  readConfidence: 'high' | 'low';
}

export interface ExamRoast {
  isExam: boolean;
  examTitle: string;
  subject: string;
  languageCode: string;
  scoreText: string;
  headline: string;
  verdict: string;
  strengths: string[];
  patterns: string[];
  mistakes: ExamMistake[];
}

/** One page of the paper, ready to send: a base64 JPEG without the data: prefix. */
export interface ExamPage {
  id: string;
  name: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  data: string;
  previewUrl: string;
}

export const MISTAKE_KINDS: Record<MistakeKind, { label: string; advice: string }> = {
  'concept-gap': { label: 'Concept gap', advice: 'The idea itself is missing. Relearn it, then test it.' },
  'method-error': { label: 'Method error', advice: 'Right idea, wrong steps. Practise the procedure.' },
  careless: { label: 'Careless slip', advice: 'You knew it. Build a checking habit.' },
  'misread-question': { label: 'Misread question', advice: 'Underline what the question actually asks.' },
  incomplete: { label: 'Left unfinished', advice: 'Show the working and manage the clock.' },
  'memory-slip': { label: 'Memory slip', advice: 'A fact or formula slipped. Spaced review fixes this.' },
};

/** Pages per paper. Six phone photos fit the shared AI service's 5 MB request limit once compressed. */
export const MAX_EXAM_PAGES = 6;

/** Children always get the gentle roast, whatever they pick. */
export const MIN_SPICY_AGE = 13;

export const resolveTone = (requested: RoastTone, age?: number): RoastTone =>
  age !== undefined && age < MIN_SPICY_AGE ? 'gentle' : requested;

export class ExamRoastUnavailableError extends Error {
  constructor() {
    super('Reading an exam paper needs the AI. Sign in, or add your Gemini API key in Settings. You can still type your mistakes in yourself.');
    this.name = 'ExamRoastUnavailableError';
  }
}

const KINDS = Object.keys(MISTAKE_KINDS) as MistakeKind[];
const MAX_MISTAKES = 30;

const text = (value: unknown, max = 600): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const texts = (value: unknown, count: number): string[] =>
  Array.isArray(value) ? value.map(v => text(v, 200)).filter(Boolean).slice(0, count) : [];

/** Checks and trims the model's reading of the paper, dropping mistakes too incomplete to make cards from. */
export const normalizeRoast = (raw: Record<string, unknown>): ExamRoast => {
  const mistakes = (Array.isArray(raw.mistakes) ? raw.mistakes : [])
    .filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === 'object')
    .map((m, i): ExamMistake => {
      const points = typeof m.pointsLost === 'number' && Number.isFinite(m.pointsLost) && m.pointsLost >= 0 ? m.pointsLost : null;
      return {
        id: `m-${i + 1}`,
        questionRef: text(m.questionRef, 12) || String(i + 1),
        question: text(m.question),
        studentAnswer: text(m.studentAnswer),
        correctAnswer: text(m.correctAnswer),
        kind: KINDS.includes(m.kind as MistakeKind) ? (m.kind as MistakeKind) : 'concept-gap',
        topic: text(m.topic, 80),
        whyWrong: text(m.whyWrong),
        roast: text(m.roast, 240),
        pointsLost: points,
        readConfidence: m.readConfidence === 'high' ? 'high' : 'low',
      };
    })
    .filter(m => m.question && m.correctAnswer)
    .slice(0, MAX_MISTAKES);

  return {
    isExam: raw.isExam !== false,
    examTitle: text(raw.examTitle, 80) || 'Your exam',
    subject: text(raw.subject, 60),
    languageCode: text(raw.languageCode, 8).toLowerCase() || 'en',
    scoreText: text(raw.scoreText, 20),
    headline: text(raw.headline, 240),
    verdict: text(raw.verdict, 800),
    strengths: texts(raw.strengths, 3),
    patterns: texts(raw.patterns, 3),
    mistakes,
  };
};

const languageName = (code: string): string => SUPPORTED_LANGUAGES.find(l => l.code === code)?.name || 'the language the paper is written in';

const studentLine = (profile?: StudentEducationProfile | null): string =>
  profile ? `The student is ${profile.age} years old, in ${profile.grade}, studying under the ${profile.country} curriculum.` : '';

export const buildRoastPrompt = (tone: RoastTone, note: string, profile?: StudentEducationProfile | null): string => `
You are marking and roasting a student's exam paper inside Studify, a study app. The attached images are the pages of one paper, in order.
${studentLine(profile)}
${note.trim() ? `The student adds: """${note.trim().slice(0, 1000)}"""` : ''}

1. Decide whether this is a test, quiz, exam or graded homework. If it is not, set isExam to false, leave mistakes empty and say so kindly in headline.
2. Find every question where the student lost marks. Use the teacher's marking (crosses, ticks, partial marks, comments) where it is there. If the paper is unmarked, judge each answer yourself.
3. Transcribe each question and the student's answer faithfully. Never invent a question you cannot read. Set readConfidence to "low" whenever the handwriting, the marking or the right answer is uncertain.
4. kind: "concept-gap" (does not understand the idea), "method-error" (right idea, wrong procedure), "careless" (arithmetic, sign, unit or copying slip), "misread-question" (answered something else), "incomplete" (unfinished or missing working), "memory-slip" (forgot a fact or formula).
5. whyWrong: the misunderstanding behind the mistake and how to fix it, in one or two sentences pitched at this student.
6. patterns: up to 3 habits that repeat across questions. strengths: 1 to 3 real things the student did well.
7. Write every text field in the language the paper is written in, and give its ISO 639-1 code in languageCode.

Roast rules (tone: ${tone.toUpperCase()}):
- Roast the mistakes, never the student. Nothing about intelligence, looks, identity, family or worth, and no swearing.
- Each roast is one line of at most 20 words, specific to that mistake.
- ${tone === 'spicy'
    ? 'SPICY: sharp, stand-up-comedian timing, but it should still make the student laugh, not wince.'
    : 'GENTLE: playful teasing a kind teacher would say out loud in class.'}
- headline is a one-line roast of the whole paper. verdict is not a joke: plain, encouraging and concrete about what to fix first.
`;

export const buildDeckPrompt = (roast: ExamRoast, mistakes: ExamMistake[], profile?: StudentEducationProfile | null): string => `
You are building a Studify review deck from the mistakes a student made on a real exam: "${roast.examTitle}"${roast.subject ? ` (${roast.subject})` : ''}.
${studentLine(profile)}

Mistakes:
${JSON.stringify(mistakes.map(({ questionRef, question, studentAnswer, correctAnswer, kind, topic, whyWrong }) => ({ questionRef, question, studentAnswer, correctAnswer, kind, topic, whyWrong })))}

Make one concept per idea the student got wrong, grouping mistakes on the same idea, at most 6 concepts. For each concept:
- mentalModel: the idea the student was missing, as an intuitive picture.
- coreTakeaways: 3, the first one states the exact correction.
- keyTerms: 2 or 3, with short definitions.
- feynmanPrompt: ask the student to explain why their exam answer was wrong and what is right.
- sampleMasteryExplanation: a model answer to that prompt.
- retrievalCards: 3 cards that test the underlying idea in new wording, so the student cannot just memorise the exam answer:
  * card 1 "standard";
  * card 2 "cloze", wrapping the target word in {{...}} in the question;
  * card 3 "multiple-choice" with 4 options without letter prefixes, the answer copied exactly from the options, and one wrong option that is the student's own exam answer or the same misconception. Map every wrong option in diagnosticDistractors.
  * For a careless or misread mistake, the cards train the check that would have caught it (units, signs, re-reading the question).
  * Give every card a socraticHintLadder.

Write everything in ${languageName(roast.languageCode)}. title: "Fix: ${roast.examTitle}". category: ${JSON.stringify(roast.subject || 'Exam review')}. description: one sentence on what the deck fixes.
`;

/** Reads the paper. Throws ExamRoastUnavailableError when no AI is set up. */
export const analyzeExam = async (
  pages: ExamPage[],
  options: { tone: RoastTone; note?: string; profile?: StudentEducationProfile | null },
): Promise<ExamRoast> => {
  if (!AIService.isAvailable()) throw new ExamRoastUnavailableError();
  if (pages.length === 0) throw new Error('Add at least one page of the exam.');

  const tone = resolveTone(options.tone, options.profile?.age);
  const contents = [
    {
      role: 'user',
      parts: [
        { text: buildRoastPrompt(tone, options.note || '', options.profile) },
        ...pages.slice(0, MAX_EXAM_PAGES).map(page => ({ inlineData: { mimeType: page.mimeType, data: page.data } })),
      ],
    },
  ];

  const reply = await AIService.generateText(contents, 'application/json', true, EXAM_ROAST_SCHEMA);
  const parsed = AIService.safeParseJSON<Record<string, unknown> | null>(reply, null);
  if (!parsed) throw new Error('The AI reply could not be read. Try again, or take sharper photos.');
  return normalizeRoast(parsed);
};

const newCard = (conceptId: string, index: number, fields: Pick<RetrievalCard, 'question' | 'answer'> & Partial<RetrievalCard>): RetrievalCard => ({
  id: `rc-${conceptId}-${index}`,
  conceptId,
  cardType: 'standard',
  hint: '',
  explanation: '',
  stability: 1,
  difficulty: 5,
  reps: 0,
  lapses: 0,
  ...fields,
});

const sessionShell = (roast: ExamRoast, concepts: ConceptCheckpoint[], id: string, description: string, profile?: StudentEducationProfile | null): StudySession => ({
  id,
  title: `Fix: ${roast.examTitle}`.slice(0, 80),
  category: roast.subject || 'Exam review',
  description,
  concepts,
  currentConceptIndex: 0,
  currentPhase: 'priming',
  elapsedSeconds: 0,
  createdAt: new Date().toISOString(),
  languageCode: roast.languageCode,
  studentProfile: profile || undefined,
});

/**
 * A deck made without AI: one concept per topic, and for each mistake a card asking the question again
 * plus, where the student's answer is known, a card asking what was wrong with it.
 */
export const buildOfflineMistakeDeck = (roast: ExamRoast, mistakes: ExamMistake[], profile?: StudentEducationProfile | null, now = Date.now()): StudySession => {
  const id = `exam-fix-${now}`;
  const byTopic = new Map<string, ExamMistake[]>();
  for (const m of mistakes) {
    const key = m.topic || roast.subject || 'Questions to fix';
    byTopic.set(key, [...(byTopic.get(key) || []), m]);
  }

  const concepts = [...byTopic.entries()].map(([topic, group], idx): ConceptCheckpoint => {
    const conceptId = `c-${id}-${idx + 1}`;
    const cards: RetrievalCard[] = [];
    for (const m of group) {
      cards.push(newCard(conceptId, cards.length + 1, {
        question: m.question,
        answer: m.correctAnswer,
        hint: MISTAKE_KINDS[m.kind].advice,
        explanation: m.whyWrong,
      }));
      if (m.studentAnswer && m.whyWrong) {
        cards.push(newCard(conceptId, cards.length + 1, {
          question: `On the exam you answered "${m.studentAnswer}" to: ${m.question}\nWhat was wrong with that answer?`,
          answer: m.whyWrong,
          hint: `The right answer is ${m.correctAnswer}.`,
        }));
      }
    }
    return {
      id: conceptId,
      order: idx + 1,
      title: topic,
      estimatedMinutes: Math.max(4, cards.length * 2),
      mentalModel: group[0].whyWrong || `What the exam asked about ${topic}, and the right answer.`,
      coreTakeaways: group.map(m => `${m.questionRef}: ${m.correctAnswer}`).slice(0, 3),
      keyTerms: [],
      feynmanPrompt: `Explain why your exam answer on ${topic} was wrong, and what the right idea is.`,
      sampleMasteryExplanation: group.map(m => m.whyWrong).filter(Boolean).join(' '),
      retrievalCards: cards,
    };
  });

  return sessionShell(roast, concepts, id, `The ${mistakes.length} ${mistakes.length === 1 ? 'question' : 'questions'} you lost marks on in ${roast.examTitle}.`, profile);
};

/**
 * Builds the review deck. With AI it writes fresh cards on the idea behind each mistake; without AI it makes the
 * simple offline deck. An AI failure is thrown, so the student can retry or choose the offline deck.
 */
export const buildMistakeDeck = async (roast: ExamRoast, mistakes: ExamMistake[], profile?: StudentEducationProfile | null): Promise<StudySession> => {
  if (mistakes.length === 0) throw new Error('Pick at least one mistake to build the deck from.');
  if (!AIService.isAvailable()) return buildOfflineMistakeDeck(roast, mistakes, profile);

  const reply = await AIService.generateText(buildDeckPrompt(roast, mistakes, profile), 'application/json', true, STUDY_SESSION_GENERATION_SCHEMA);
  const parsed = AIService.safeParseJSON<Record<string, any>>(reply, {});
  const id = `exam-fix-${Date.now()}`;
  const concepts = AIService.conceptsFromGeneratedJson(Array.isArray(parsed.concepts) ? parsed.concepts : [], id, roast.examTitle);
  if (concepts.length === 0 || concepts.every(c => c.retrievalCards.length === 0)) {
    throw new Error('The AI reply had no cards in it.');
  }
  const session = sessionShell(roast, concepts, id, text(parsed.description, 300) || `Cards on the ideas behind your mistakes in ${roast.examTitle}.`, profile);
  return { ...session, title: text(parsed.title, 80) || session.title };
};

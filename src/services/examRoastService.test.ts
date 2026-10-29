import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIService, optionsContaining } from './aiService';
import { EXAM_ROAST_SCHEMA } from './aiSchemas';
import {
  ExamRoastUnavailableError,
  analyzeExam,
  buildMistakeDeck,
  buildOfflineMistakeDeck,
  buildRoastPrompt,
  normalizeRoast,
  resolveTone,
} from './examRoastService';
import type { ExamMistake, ExamPage, ExamRoast } from './examRoastService';
import { fitScale, isAcceptedExamFile } from '../components/roast/examPages';
// @ts-expect-error The server is plain JavaScript without type declarations.
import { checkAiRequest } from '../../server/src/aiGuard.js';

const mistake = (over: Partial<ExamMistake> = {}): ExamMistake => ({
  id: 'm-1',
  questionRef: '2a',
  question: 'How many moles are in 36 g of water?',
  studentAnswer: '36 mol',
  correctAnswer: '2 mol',
  kind: 'concept-gap',
  topic: 'Moles',
  whyWrong: 'Mass is not moles: divide by the molar mass, 18 g/mol.',
  roast: 'You converted grams to moles by vibes.',
  pointsLost: 2,
  readConfidence: 'high',
  ...over,
});

const roast = (over: Partial<ExamRoast> = {}): ExamRoast => ({
  isExam: true,
  examTitle: 'Chemistry quiz',
  subject: 'Chemistry',
  languageCode: 'en',
  scoreText: '12/20',
  headline: 'A bold reinterpretation of chemistry.',
  verdict: 'Most marks went on mole conversions.',
  strengths: [],
  patterns: [],
  mistakes: [mistake()],
  ...over,
});

const page: ExamPage = { id: 'p1', name: 'page.jpg', mimeType: 'image/jpeg', data: 'A'.repeat(4000), previewUrl: '' };

afterEach(() => vi.restoreAllMocks());

describe('normalizeRoast', () => {
  it('keeps well-formed mistakes and fills safe defaults', () => {
    const result = normalizeRoast({
      isExam: true,
      examTitle: 'Physics test',
      languageCode: 'TR',
      headline: 'Newton is filing a complaint.',
      verdict: 'Units.',
      strengths: ['Neat working', '', 3],
      patterns: [],
      mistakes: [
        { questionRef: '1', question: 'F = ?', studentAnswer: 'ma²', correctAnswer: 'ma', kind: 'careless', topic: 'Forces', whyWrong: 'No square.', roast: 'Squared for no reason.', pointsLost: -1, readConfidence: 'high' },
        { questionRef: '2', question: 'Unreadable', correctAnswer: '', kind: 'nonsense' },
        { question: 'Define work', correctAnswer: 'Force × distance', kind: 'nonsense' },
      ],
    });

    expect(result.languageCode).toBe('tr');
    expect(result.strengths).toEqual(['Neat working']);
    expect(result.mistakes).toHaveLength(2);
    expect(result.mistakes[0]).toMatchObject({ kind: 'careless', pointsLost: null, readConfidence: 'high' });
    // Unknown kinds and missing confidence fall back to the cautious values.
    expect(result.mistakes[1]).toMatchObject({ kind: 'concept-gap', readConfidence: 'low', questionRef: '3' });
  });

  it('treats a reply without isExam as an exam and names it', () => {
    const result = normalizeRoast({});
    expect(result.isExam).toBe(true);
    expect(result.examTitle).toBe('Your exam');
    expect(result.mistakes).toEqual([]);
  });

  it('recognizes when the photos are not an exam', () => {
    expect(normalizeRoast({ isExam: false }).isExam).toBe(false);
  });
});

describe('resolveTone', () => {
  it('keeps children on the gentle roast', () => {
    expect(resolveTone('spicy', 10)).toBe('gentle');
    expect(resolveTone('spicy', 13)).toBe('spicy');
    expect(resolveTone('spicy')).toBe('spicy');
    expect(resolveTone('gentle', 30)).toBe('gentle');
  });

  it('puts the tone and the never-the-student rule in the prompt', () => {
    const prompt = buildRoastPrompt('gentle', 'Lost marks on Q2', { age: 15, country: 'TR', grade: 'Grade 10' });
    expect(prompt).toContain('GENTLE');
    expect(prompt).toContain('Roast the mistakes, never the student');
    expect(prompt).toContain('Lost marks on Q2');
    expect(prompt).toContain('15 years old');
  });
});

describe('analyzeExam', () => {
  it('needs an AI provider', async () => {
    vi.spyOn(AIService, 'isAvailable').mockReturnValue(false);
    await expect(analyzeExam([page], { tone: 'spicy' })).rejects.toBeInstanceOf(ExamRoastUnavailableError);
  });

  it('sends a request the shared AI service accepts, with the pages attached', async () => {
    vi.spyOn(AIService, 'isAvailable').mockReturnValue(true);
    const generate = vi.spyOn(AIService, 'generateText').mockResolvedValue(JSON.stringify({ isExam: true, examTitle: 'Quiz', mistakes: [] }));

    const pages = Array.from({ length: 8 }, (_, i) => ({ ...page, id: `p${i}` }));
    const result = await analyzeExam(pages, { tone: 'spicy', profile: { age: 9, country: 'US', grade: 'Grade 4' } });

    expect(result.examTitle).toBe('Quiz');
    const [contents, mime, thinking, schema] = generate.mock.calls[0];
    expect(schema).toBe(EXAM_ROAST_SCHEMA);
    // Only six pages go, and a nine-year-old gets the gentle roast even after asking for spicy.
    expect(contents[0].parts.filter((p: any) => p.inlineData)).toHaveLength(6);
    expect(contents[0].parts[0].text).toContain('GENTLE');

    const checked = checkAiRequest({ contents, responseMimeType: mime, enableThinking: thinking, responseSchema: schema });
    expect(checked.error).toBeUndefined();
  });

  it('reports a reply that is not JSON', async () => {
    vi.spyOn(AIService, 'isAvailable').mockReturnValue(true);
    vi.spyOn(AIService, 'generateText').mockResolvedValue('Sorry, I cannot help.');
    await expect(analyzeExam([page], { tone: 'gentle' })).rejects.toThrow(/could not be read/);
  });
});

describe('buildOfflineMistakeDeck', () => {
  it('groups mistakes by topic and asks about each wrong answer', () => {
    const deck = buildOfflineMistakeDeck(
      roast(),
      [mistake(), mistake({ id: 'm-2', questionRef: '3', topic: 'Moles', studentAnswer: '' }), mistake({ id: 'm-3', topic: 'Bonding' })],
      null,
      1000,
    );

    expect(deck.id).toBe('exam-fix-1000');
    expect(deck.title).toBe('Fix: Chemistry quiz');
    expect(deck.category).toBe('Chemistry');
    expect(deck.concepts.map(c => c.title)).toEqual(['Moles', 'Bonding']);
    // Two cards for the mistake with a known answer, one for the one without.
    expect(deck.concepts[0].retrievalCards).toHaveLength(3);
    const [ask, whyWrong] = deck.concepts[0].retrievalCards;
    expect(ask).toMatchObject({ question: 'How many moles are in 36 g of water?', answer: '2 mol' });
    expect(whyWrong.question).toContain('"36 mol"');
    expect(new Set(deck.concepts.flatMap(c => c.retrievalCards.map(card => card.id))).size).toBe(5);
  });
});

describe('buildMistakeDeck', () => {
  it('uses the offline deck without AI', async () => {
    vi.spyOn(AIService, 'isAvailable').mockReturnValue(false);
    const deck = await buildMistakeDeck(roast(), [mistake()]);
    expect(deck.concepts[0].retrievalCards.length).toBeGreaterThan(0);
  });

  it('builds AI cards on the idea behind each mistake', async () => {
    vi.spyOn(AIService, 'isAvailable').mockReturnValue(true);
    const generate = vi.spyOn(AIService, 'generateText').mockResolvedValue(JSON.stringify({
      title: 'Fix: Chemistry quiz',
      category: 'Chemistry',
      description: 'Mole conversions, fixed.',
      concepts: [{
        title: 'Mass vs moles',
        estimatedMinutes: 8,
        mentalModel: 'Moles count particles; grams weigh them.',
        coreTakeaways: ['n = m / M'],
        keyTerms: [],
        feynmanPrompt: 'Why is 36 g not 36 mol?',
        sampleMasteryExplanation: '',
        retrievalCards: [{
          cardType: 'multiple-choice',
          question: 'How many moles in 54 g of water?',
          answer: '3 mol',
          hint: '',
          explanation: '',
          options: ['54 mol', '3 mol.', '18 mol', '1 mol'],
        }],
      }],
    }));

    const deck = await buildMistakeDeck(roast(), [mistake()]);
    expect(generate.mock.calls[0][0]).toContain('"studentAnswer":"36 mol"');
    expect(deck.description).toBe('Mole conversions, fixed.');
    const card = deck.concepts[0].retrievalCards[0];
    // '3 mol.' is the same option as the answer '3 mol', so no distractor is lost.
    expect(card.options).toEqual(['54 mol', '3 mol', '18 mol', '1 mol']);
  });

  it('throws when the AI reply has no cards, so the student can pick the offline deck', async () => {
    vi.spyOn(AIService, 'isAvailable').mockReturnValue(true);
    vi.spyOn(AIService, 'generateText').mockResolvedValue('{"concepts": []}');
    await expect(buildMistakeDeck(roast(), [mistake()])).rejects.toThrow(/no cards/);
  });

  it('needs at least one mistake', async () => {
    await expect(buildMistakeDeck(roast(), [])).rejects.toThrow(/at least one/);
  });
});

describe('optionsContaining', () => {
  it('makes sure the answer is one of the options', () => {
    expect(optionsContaining(['a', 'b'], 'a')).toEqual(['a', 'b']);
    expect(optionsContaining(['B) Paris', 'Rome'], 'paris')).toEqual(['paris', 'Rome']);
    expect(optionsContaining(['w', 'x', 'y', 'z'], 'right')).toEqual(['w', 'x', 'y', 'right']);
    expect(optionsContaining(['w', 'x'], 'right')).toEqual(['w', 'x', 'right']);
    expect(optionsContaining(undefined, 'right')).toBeUndefined();
  });
});

describe('exam pages', () => {
  it('shrinks large photos and leaves small ones alone', () => {
    expect(fitScale(4000, 3000)).toBeCloseTo(0.4);
    expect(fitScale(800, 1200)).toBe(1);
  });

  it('accepts photos and PDFs only', () => {
    expect(isAcceptedExamFile({ type: 'image/jpeg', name: 'a.jpg' })).toBe(true);
    expect(isAcceptedExamFile({ type: '', name: 'scan.PDF' })).toBe(true);
    expect(isAcceptedExamFile({ type: '', name: 'IMG_1.HEIC' })).toBe(true);
    expect(isAcceptedExamFile({ type: 'text/plain', name: 'notes.txt' })).toBe(false);
  });
});

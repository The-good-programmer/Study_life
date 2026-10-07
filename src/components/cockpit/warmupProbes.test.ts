import { describe, it, expect } from 'vitest';
import type { ConceptCheckpoint, RetrievalCard, StudySession } from '../../types';
import { buildWarmupProbes, MAX_WARMUP_PROBES } from './warmupProbes';

const card = (id: string, conceptId: string, question: string, answer: string, extra: Partial<RetrievalCard> = {}): RetrievalCard =>
  ({ id, conceptId, question, answer, stability: 0, difficulty: 5, reps: 0, lapses: 0, ...extra }) as RetrievalCard;

const concept = (
  id: string,
  cards: RetrievalCard[],
  keyTerms: { term: string; definition: string }[] = [],
): ConceptCheckpoint => ({ id, title: `Concept ${id}`, retrievalCards: cards, keyTerms }) as unknown as ConceptCheckpoint;

const deck = (...concepts: ConceptCheckpoint[]): StudySession => ({ id: 'deck', title: 'Deck', concepts }) as unknown as StudySession;

const fixedRandom = () => 0.42;

// Answers of similar length, so they make believable distractors for each other.
const fillers = ['Golgi body', 'Ribosome', 'Lysosome', 'Vacuole', 'Nucleolus'].map((answer, i) =>
  card(`f${i}`, 'filler', `Filler question ${i}?`, answer),
);

describe('buildWarmupProbes', () => {
  it("uses a card's own choices and hides cloze blanks", () => {
    const probes = buildWarmupProbes(
      deck(concept('a', [card('c1', 'a', 'The powerhouse is the {{mitochondrion}}.', 'mitochondrion', { options: ['mitochondrion', 'nucleus'] })])),
      fixedRandom,
    );
    expect(probes).toHaveLength(1);
    expect(probes[0].question).toBe('The powerhouse is the _____.');
    expect([...probes[0].options].sort()).toEqual(['mitochondrion', 'nucleus']);
  });

  it('turns a plain card into a choice question with the answer exactly once', () => {
    const probes = buildWarmupProbes(deck(concept('a', [card('c1', 'a', 'Where is ATP made?', 'Mitochondria')]), concept('filler', fillers)), fixedRandom);
    const options = probes[0].options;
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(options.filter(o => o === 'Mitochondria')).toHaveLength(1);
    expect(new Set(options.map(o => o.toLowerCase())).size).toBe(options.length);
  });

  it('never asks about a diagram the warm-up cannot show', () => {
    const diagram = card('d1', 'a', 'Label the part', 'Axon', { cardType: 'image-occlusion', imageUrl: 'x.png' });
    const probes = buildWarmupProbes(deck(concept('a', [diagram])), fixedRandom);
    expect(probes).toEqual([]);
  });

  it('falls back to a key term, without repeating its definition among the choices', () => {
    const probes = buildWarmupProbes(
      deck(
        concept('a', [], [{ term: 'Osmosis', definition: 'Water moving across a membrane' }]),
        concept('b', [], [
          { term: 'Diffusion', definition: 'Particles spreading out' },
          { term: 'Osmosis again', definition: 'water moving across a membrane' },
        ]),
      ),
      fixedRandom,
    );
    expect(probes[0].question).toBe('Which of these describes "Osmosis"?');
    expect(probes[0].options.map(o => o.toLowerCase()).filter(o => o === 'water moving across a membrane')).toHaveLength(1);
    expect(probes[0].options).toContain('Particles spreading out');
  });

  it(`asks at most ${MAX_WARMUP_PROBES} questions`, () => {
    const concepts = Array.from({ length: 6 }, (_, i) =>
      concept(`k${i}`, [card(`c${i}`, `k${i}`, `Question ${i}?`, `Answer ${i}`, { options: [`Answer ${i}`, 'Something else'] })]),
    );
    expect(buildWarmupProbes(deck(...concepts), fixedRandom)).toHaveLength(MAX_WARMUP_PROBES);
  });
});

import { describe, expect, it } from 'vitest';
import type { RetrievalCard } from '../types';
import { cleanDeletionLog, emptyDeletionLog, hashOf, mergeById, mergeDeletions, mergeLog, mergeText, newerProgress } from './syncMerge';

const at = (day: number) => new Date(Date.UTC(2026, 10, day)).toISOString();
const NOW = Date.UTC(2026, 10, 21);

describe('mergeById', () => {
  const item = (id: string, updatedAt: string, title = id) => ({ id, title, updatedAt, createdAt: at(1) });

  it('keeps items from both sides, the newer edit winning', () => {
    const local = [item('a', at(5), 'a-local'), item('b', at(5), 'b-local')];
    const remote = [item('a', at(6), 'a-remote'), item('b', at(4), 'b-remote'), item('c', at(5))];
    expect(mergeById(local, remote).map(i => i.title)).toEqual(['a-remote', 'b-local', 'c']);
  });

  it('keeps this device\'s copy on a tie', () => {
    expect(mergeById([item('a', at(5), 'mine')], [item('a', at(5), 'theirs')])[0].title).toBe('mine');
  });

  it('leaves out deleted items, unless edited after the deletion', () => {
    const local = [item('a', at(5)), item('b', at(9))];
    const remote = [item('c', at(5))];
    const merged = mergeById(local, remote, { a: at(6), b: at(7), c: at(8) });
    expect(merged.map(i => i.id)).toEqual(['b']);
  });

  it('uses the creation time when there is no edit time', () => {
    const merged = mergeById([{ id: 'f', createdAt: at(3), name: 'old' }], [{ id: 'f', createdAt: at(3), updatedAt: at(4), name: 'new' }]);
    expect(merged[0].name).toBe('new');
  });
});

describe('deletion logs', () => {
  it('keeps the later time for an id and drops old records', () => {
    const a = { ...emptyDeletionLog(), decks: { d1: at(10), d2: at(1) } };
    const b = { ...emptyDeletionLog(), decks: { d1: at(12) }, planner: { p1: at(15) } };
    const merged = mergeDeletions(a, b, NOW);
    expect(merged.decks).toEqual({ d1: at(12), d2: at(1) });
    expect(merged.planner).toEqual({ p1: at(15) });
    expect(mergeDeletions(a, b, NOW + 95 * 86_400_000).decks).toEqual({});
  });

  it('cleans what it receives', () => {
    expect(cleanDeletionLog({ decks: { ok: at(3), bad: 'yesterday', num: 4 }, wallet: { x: at(1) } })).toEqual({ ...emptyDeletionLog(), decks: { ok: at(3) } });
    expect(cleanDeletionLog(null)).toEqual(emptyDeletionLog());
  });
});

describe('mergeLog', () => {
  it('joins both logs once per entry, oldest first', () => {
    const e = (id: string, day: number) => ({ id, endedAt: at(day), minutes: 25 });
    expect(mergeLog([e('a', 3), e('b', 5)], [e('b', 5), e('c', 4)]).map(x => x.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('mergeText', () => {
  it('takes the more recent edit', () => {
    const mine = { text: 'mine', updatedAt: 10 };
    expect(mergeText(mine, { text: 'theirs', updatedAt: 20 }).text).toBe('theirs');
    expect(mergeText(mine, { text: 'theirs', updatedAt: 5 }).text).toBe('mine');
    expect(mergeText(mine, null).text).toBe('mine');
  });
});

describe('newerProgress', () => {
  const card = (lastReviewDate: string | undefined, reps: number): RetrievalCard =>
    ({ id: 'c1', question: 'q', answer: 'a', stability: reps, difficulty: 5, reps, lapses: 0, lastReviewDate, nextReviewDate: lastReviewDate }) as unknown as RetrievalCard;

  it('takes the review done more recently, keeping this device\'s content', () => {
    const local = { ...card(at(3), 2), question: 'edited here' };
    const updated = newerProgress(local, card(at(5), 4))!;
    expect(updated).toMatchObject({ reps: 4, lastReviewDate: at(5), question: 'edited here' });
    expect(newerProgress(card(at(5), 4), card(at(3), 2))).toBeNull();
    expect(newerProgress(card(at(5), 4), card(undefined, 0))).toBeNull();
    expect(newerProgress(undefined, card(at(1), 1))?.reps).toBe(1);
  });
});

describe('hashOf', () => {
  it('changes when the value changes', () => {
    expect(hashOf({ a: 1 })).toBe(hashOf({ a: 1 }));
    expect(hashOf({ a: 1 })).not.toBe(hashOf({ a: 2 }));
  });
});

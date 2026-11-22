/**
 * Rules for decks students share: how the author is shown, what a shared deck may contain, and an AI
 * check that keeps unsafe content out of the community (and, later, off public pages).
 */

/** Who is shown as a shared deck's author: first name and initial, and nobody under 16 by name. */
export const ANONYMOUS_AUTHOR = 'a Studify student';

export function authorDisplay(user) {
  const age = Number(user?.age);
  if (!user || !Number.isFinite(age) || age < 16) return ANONYMOUS_AUTHOR;
  const [first, second] = String(user.name || '').trim().split(/\s+/);
  if (!first) return ANONYMOUS_AUTHOR;
  return second ? `${first} ${second[0].toUpperCase()}.` : first;
}

const MAX_CONCEPTS = 60;
const MAX_CARDS = 1500;
const MAX_FIELD = 4000;

/** The deck's text cards, or null when the payload isn't a deck the app would make. */
export function cardsOf(session) {
  if (!session || typeof session !== 'object' || !Array.isArray(session.concepts)) return null;
  if (session.concepts.length === 0 || session.concepts.length > MAX_CONCEPTS) return null;
  const cards = [];
  for (const concept of session.concepts) {
    if (!concept || typeof concept !== 'object' || !Array.isArray(concept.retrievalCards)) return null;
    for (const card of concept.retrievalCards) {
      if (!card || typeof card.question !== 'string' || typeof card.answer !== 'string') return null;
      if (card.question.length > MAX_FIELD || card.answer.length > MAX_FIELD) return null;
      cards.push(card);
    }
  }
  return cards.length > 0 && cards.length <= MAX_CARDS ? cards : null;
}

export const DECK_SAFETY_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['ok', 'unsafe'] },
    reason: { type: 'string' },
  },
  required: ['verdict'],
};

const MAX_CHECK_CHARS = 30_000;

/**
 * Asks the AI whether a deck is fit to share with other students. Returns 'passed', 'unsafe' (with a
 * reason to show) or 'unchecked' when the AI isn't available; an unchecked deck is still shared, but
 * stays off public pages until it has been checked.
 */
export async function checkDeckContent(ai, { title, description, cards }) {
  if (!ai?.isAiConfigured?.()) return { result: 'unchecked' };
  const text = [`Title: ${title}`, `Description: ${description}`, ...cards.map((c, i) => `${i + 1}. Q: ${c.question} | A: ${c.answer}`)]
    .join('\n')
    .slice(0, MAX_CHECK_CHARS);
  const prompt =
    'A student wants to share this flashcard deck publicly with other students, some of them children. ' +
    'Reply "unsafe" if it contains any of: sexual content, hate or harassment, encouragement of violence or self-harm, ' +
    "personal information about a real private person (full names with contact details, addresses, phone numbers), " +
    'advertising or spam links, or nothing to do with studying. Otherwise reply "ok". ' +
    'Ordinary school and university subjects (including medicine, biology, history of wars) are "ok". ' +
    'If unsafe, give a one-sentence reason the student can act on.\n\n' +
    text;
  try {
    const raw = await ai.generateContent({ contents: prompt, responseMimeType: 'application/json', responseSchema: DECK_SAFETY_SCHEMA });
    const parsed = JSON.parse(raw);
    if (parsed?.verdict === 'unsafe') return { result: 'unsafe', reason: String(parsed.reason || '').slice(0, 300) };
    if (parsed?.verdict === 'ok') return { result: 'passed' };
  } catch (err) {
    console.warn('[Decks] The content check failed:', err?.message || err);
  }
  return { result: 'unchecked' };
}

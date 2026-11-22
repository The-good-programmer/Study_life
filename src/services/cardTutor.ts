import type { RetrievalCard } from '../types';
import { AIService } from './aiService';
import { fillCloze } from '../utils/cloze';

export interface TutorTurn {
  question: string;
  answer: string;
}

/** Ready-made questions shown as buttons. */
export const TUTOR_PROMPTS = {
  simpler: 'Explain this more simply, as if I were new to the topic.',
  example: 'Give me a concrete, real-world example of this.',
  why: 'Why is this the right answer? Walk me through the reasoning.',
  memory: 'Give me a short trick to remember this.',
} as const;

export const wrongAnswerPrompt = (picked: string) => `I picked "${picked}". Why is that wrong, and how do I tell them apart next time?`;

/** Questions kept per card, so a long chat stays a small request. */
const MAX_TURNS = 6;

/** What the card says, written out for the tutor (cloze blanks filled in). */
export const describeCard = (card: RetrievalCard): string => {
  const question = card.clozeTemplate ? fillCloze(card.clozeTemplate) : card.question;
  return [
    `Question: ${question}`,
    `Answer: ${card.answer}`,
    card.explanation ? `Explanation on the card: ${card.explanation}` : '',
    card.options?.length ? `Choices: ${card.options.join(' | ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
};

/** The conversation sent to the AI: the card, the earlier questions and answers, and the new question. */
export function tutorRequest(card: RetrievalCard, history: readonly TutorTurn[], question: string) {
  const intro = `You are a friendly tutor inside a flashcard app. The student is reviewing this flashcard:
${describeCard(card)}

Answer the student's questions about it. Be clear and short: at most 120 words, plain sentences or a few "- " points, no headings.
Write in the same language as the flashcard. Stay on the card's topic; if the card itself looks wrong, say so plainly.`;
  const turns = history.slice(-MAX_TURNS).flatMap(turn => [
    { role: 'user', parts: [{ text: turn.question }] },
    { role: 'model', parts: [{ text: turn.answer }] },
  ]);
  return [
    { role: 'user', parts: [{ text: intro }] },
    { role: 'model', parts: [{ text: 'Got it. What would you like to know?' }] },
    ...turns,
    { role: 'user', parts: [{ text: question }] },
  ];
}

/** The tutor's answer to a question about a card. */
export async function askAboutCard(card: RetrievalCard, history: readonly TutorTurn[], question: string): Promise<string> {
  const reply = (await AIService.generateText(tutorRequest(card, history, question))).trim();
  if (!reply) throw new Error('The AI sent back an empty answer.');
  return reply;
}

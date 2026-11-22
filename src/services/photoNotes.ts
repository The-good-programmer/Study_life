import { AIService } from './aiService';
import type { AiImage } from '../utils/photoForAi';

/** Photos of notes read in one go; each is its own request, so every request stays small. */
export const MAX_NOTE_PHOTOS = 5;

/** What the AI answers when a photo has no text it can read. */
export const NO_TEXT = 'NO_READABLE_TEXT';

export const NOTES_PHOTO_PROMPT = `You are reading a photo a student took of their study material: handwritten notes, a textbook page, slides or a whiteboard.
Write out all the text in the photo exactly as it is written, in its own language. Do not summarize, explain, translate or add anything.
Keep the structure: headings on their own line, lists as "- " items, and formulas in plain text.
Describe a diagram in one short line in square brackets, like [Diagram: the water cycle], only when it carries information.
If there is no readable text in the photo, answer with exactly ${NO_TEXT} and nothing else.`;

export class NoTextInPhotoError extends Error {
  constructor() {
    super("Couldn't find any text in that photo. Try again with the page flat, in good light and filling the frame.");
    this.name = 'NoTextInPhotoError';
  }
}

/** The request for one photo, in the shape the AI service takes (see readSyllabus). */
export const notesPhotoRequest = (image: AiImage) => [
  { role: 'user', parts: [{ text: NOTES_PHOTO_PROMPT }, { inlineData: image }] },
];

/** The text in a photo of notes, ready for the notes box. */
export async function readNotesFromPhoto(image: AiImage): Promise<string> {
  const reply = (await AIService.generateText(notesPhotoRequest(image))).trim();
  if (!reply || reply.includes(NO_TEXT)) throw new NoTextInPhotoError();
  // Some replies come wrapped in a code block.
  return reply.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
}

/** The notes box with a photo's text added after what's already there. */
export const appendNotes = (current: string, added: string): string =>
  current.trim() ? `${current.trimEnd()}\n\n${added}` : added;

/**
 * Checks what a client may send to the shared Gemini proxy, so it serves Studify's own requests and cannot be
 * used as a free general-purpose Gemini endpoint: text and images only, a size cap, and only the response
 * schemas the app itself uses.
 */

import * as schemas from './aiSchemas.js';

/** Characters of text per request; the app trims long source notes to fit (MAX_SOURCE_CHARS in aiService.ts). */
export const MAX_PROMPT_CHARS = 200_000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_PARTS = 16;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const RESPONSE_TYPES = new Set(['application/json', 'text/plain']);

const KNOWN_SCHEMAS = new Set(Object.values(schemas).map((schema) => JSON.stringify(schema)));

/** Tells the model what it is for, so off-topic requests get a short refusal instead of a full answer. */
export const STUDY_ONLY_INSTRUCTION =
  'You are the AI inside Studify, a study app. You help learners study: you turn notes into flashcards and study ' +
  'plans, explain concepts, quiz learners and give feedback on their explanations. If a request has nothing to do ' +
  'with studying or learning, reply in one sentence that you can only help with studying.';

class Rejected extends Error {}

function checkPart(part, budget) {
  if (typeof part === 'string') {
    budget.chars += part.length;
    return;
  }
  if (!part || typeof part !== 'object') throw new Rejected('Each part must be text or an image.');
  const keys = Object.keys(part);
  if (keys.length === 1 && typeof part.text === 'string') {
    budget.chars += part.text.length;
    return;
  }
  if (keys.length === 1 && part.inlineData && typeof part.inlineData === 'object') {
    const { mimeType, data } = part.inlineData;
    if (!IMAGE_TYPES.has(mimeType) || typeof data !== 'string') throw new Rejected('Only PNG, JPEG or WebP images can be attached.');
    if (data.length * 0.75 > MAX_IMAGE_BYTES) throw new Rejected('Images must be under 4 MB.');
    return;
  }
  throw new Rejected('Each part must be text or an image.');
}

function checkContents(contents) {
  const budget = { chars: 0 };
  let parts = 0;
  const visit = (part) => {
    parts += 1;
    if (parts > MAX_PARTS) throw new Rejected('Too many parts in one request.');
    checkPart(part, budget);
  };

  if (typeof contents === 'string') {
    visit(contents);
  } else if (Array.isArray(contents) && contents.length > 0) {
    for (const item of contents) {
      if (item && typeof item === 'object' && 'parts' in item) {
        const { role, parts: itemParts, ...rest } = item;
        if (Object.keys(rest).length > 0 || (role !== undefined && role !== 'user' && role !== 'model') || !Array.isArray(itemParts)) {
          throw new Rejected('Unsupported message format.');
        }
        itemParts.forEach(visit);
      } else {
        visit(item);
      }
    }
  } else {
    throw new Rejected('contents prompt or payload is required.');
  }

  if (budget.chars === 0) throw new Rejected('contents prompt or payload is required.');
  if (budget.chars > MAX_PROMPT_CHARS) throw new Rejected(`Prompt too long (over ${MAX_PROMPT_CHARS.toLocaleString('en-US')} characters).`);
}

/**
 * Returns { request } with the fields to pass on, or { error } with a message for a 400 response.
 * Streaming requests take no response schema.
 */
export function checkAiRequest(body, { stream = false } = {}) {
  const { contents, responseMimeType, enableThinking, responseSchema } = body || {};
  try {
    checkContents(contents);
    if (responseMimeType !== undefined && !RESPONSE_TYPES.has(responseMimeType)) {
      throw new Rejected('Unsupported response type.');
    }
    if (responseSchema !== undefined && responseSchema !== null) {
      if (stream || !KNOWN_SCHEMAS.has(JSON.stringify(responseSchema))) throw new Rejected('Unknown response schema.');
    }
  } catch (err) {
    if (err instanceof Rejected) return { error: err.message };
    throw err;
  }
  return {
    request: {
      contents,
      responseMimeType,
      enableThinking: enableThinking === true,
      responseSchema: responseSchema ?? undefined,
    },
  };
}

/**
 * Studify AI Gateway & Gemini Proxy
 * Securely proxies AI calls using server-side GEMINI_API_KEY.
 */

import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || '';
let aiClient = null;

if (apiKey && apiKey.trim()) {
  try {
    aiClient = new GoogleGenAI({ apiKey: apiKey.trim() });
    console.log('[AI Gateway] GoogleGenAI client initialized successfully with server key.');
  } catch (err) {
    console.error('[AI Gateway] Failed to initialize GoogleGenAI client:', err);
  }
} else {
  console.warn('[AI Gateway] GEMINI_API_KEY is not set in server environment. Set GEMINI_API_KEY in server/.env to enable proxy AI generations.');
}

const MODEL_CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
];

function supportsThinking(model) {
  return model.includes('2.5') || model.includes('3.');
}

// In-memory rate limiting map: ip -> timestamps[]
const rateLimits = new Map();
const MAX_REQUESTS_PER_MINUTE = 40;

export function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - 60000;
  const history = (rateLimits.get(ip) || []).filter(t => t > windowStart);

  if (history.length >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }

  history.push(now);
  rateLimits.set(ip, history);
  return true;
}

export async function generateContent({ contents, responseMimeType, enableThinking, responseSchema }) {
  if (!aiClient) {
    throw new Error('Server AI Gateway is not configured with GEMINI_API_KEY.');
  }

  let lastError = null;

  for (const model of MODEL_CANDIDATES) {
    const buildConfig = (includeThinking) => {
      const config = {};
      if (responseSchema) {
        config.responseSchema = responseSchema;
        config.responseMimeType = 'application/json';
      } else if (responseMimeType) {
        config.responseMimeType = responseMimeType;
      }

      if (includeThinking && supportsThinking(model)) {
        if (model.includes('3.')) {
          config.thinkingConfig = { thinkingLevel: 'LOW' };
        } else if (model.includes('2.5')) {
          config.thinkingConfig = { thinkingBudget: 1024 };
        }
      }
      return config;
    };

    try {
      const config = buildConfig(enableThinking);
      const response = await aiClient.models.generateContent({
        model,
        contents,
        config: Object.keys(config).length > 0 ? config : undefined,
      });
      return response.text || '';
    } catch (err) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);

      if (enableThinking && (errMsg.includes('thinking') || errMsg.includes('INVALID_ARGUMENT'))) {
        try {
          const fallbackConfig = buildConfig(false);
          const response = await aiClient.models.generateContent({
            model,
            contents,
            config: Object.keys(fallbackConfig).length > 0 ? fallbackConfig : undefined,
          });
          return response.text || '';
        } catch (retryErr) {
          lastError = retryErr;
        }
      }

      console.warn(`[AI Gateway] Model ${model} failed, trying next candidate...`, errMsg);
    }
  }

  throw lastError || new Error('All model candidates failed.');
}

export async function* generateContentStream({ contents, responseMimeType, enableThinking }) {
  if (!aiClient) {
    throw new Error('Server AI Gateway is not configured with GEMINI_API_KEY.');
  }

  let lastError = null;

  for (const model of MODEL_CANDIDATES) {
    const buildConfig = (includeThinking) => {
      const config = {};
      if (responseMimeType) {
        config.responseMimeType = responseMimeType;
      }
      if (includeThinking && supportsThinking(model)) {
        if (model.includes('3.')) {
          config.thinkingConfig = { thinkingLevel: 'LOW' };
        } else if (model.includes('2.5')) {
          config.thinkingConfig = { thinkingBudget: 1024 };
        }
      }
      return config;
    };

    try {
      const config = buildConfig(enableThinking);
      const responseStream = await aiClient.models.generateContentStream({
        model,
        contents,
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          yield chunk.text;
        }
      }
      return;
    } catch (err) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      if (enableThinking && (errMsg.includes('thinking') || errMsg.includes('INVALID_ARGUMENT'))) {
        try {
          const fallbackConfig = buildConfig(false);
          const responseStream = await aiClient.models.generateContentStream({
            model,
            contents,
            config: Object.keys(fallbackConfig).length > 0 ? fallbackConfig : undefined,
          });

          for await (const chunk of responseStream) {
            if (chunk.text) {
              yield chunk.text;
            }
          }
          return;
        } catch (retryErr) {
          lastError = retryErr;
        }
      }
      console.warn(`[AI Gateway Stream] Model ${model} failed, trying next candidate...`, errMsg);
    }
  }

  throw lastError || new Error('All model candidates failed for streaming.');
}

export function isAiConfigured() {
  return Boolean(aiClient);
}


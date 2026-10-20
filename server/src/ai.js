/**
 * Studify AI Gateway & Gemini Proxy
 * Securely proxies AI calls using server-side GEMINI_API_KEY.
 */

import { GoogleGenAI } from '@google/genai';
import { db } from './db.js';
import { STUDY_ONLY_INSTRUCTION } from './aiGuard.js';

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

// Flash models only: a fallback to a Pro model would multiply the cost of every request that reaches it.
// gemini-2.0-flash was shut down on 2026-06-01, and Google limits the 2.5 models to keys that used them
// recently, so the 3.x Flash model comes last. GEMINI_MODELS (comma-separated) replaces the list.
const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.6-flash'];
const MODEL_CANDIDATES = (process.env.GEMINI_MODELS || '')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
if (MODEL_CANDIDATES.length === 0) MODEL_CANDIDATES.push(...DEFAULT_MODELS);

function supportsThinking(model) {
  return model.includes('2.5') || model.includes('3.');
}

// In-memory burst rate limiting: userId -> timestamps[]
const rateLimits = new Map();
const MAX_REQUESTS_PER_MINUTE = 20;
const RATE_WINDOW_MS = 60000;

export function checkRateLimit(key) {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;
  const history = (rateLimits.get(key) || []).filter(t => t > windowStart);

  if (history.length >= MAX_REQUESTS_PER_MINUTE) {
    rateLimits.set(key, history);
    return false;
  }

  history.push(now);
  rateLimits.set(key, history);
  return true;
}

// Drop idle keys so the map cannot grow without bound.
setInterval(() => {
  const windowStart = Date.now() - RATE_WINDOW_MS;
  for (const [key, history] of rateLimits) {
    if (!history.some(t => t > windowStart)) rateLimits.delete(key);
  }
}, RATE_WINDOW_MS).unref();

class QuotaExceeded extends Error {
  constructor(scope) {
    super(scope);
    this.scope = scope;
  }
}

/**
 * Persistent daily quotas: per account, per network (so a stack of throwaway accounts from one place shares a
 * limit) and for the whole service (a ceiling on the Gemini bill). Records one request and returns null when all
 * three have room; otherwise records nothing and returns which one is spent: 'user', 'ip' or 'all'.
 */
export async function consumeDailyQuota(userId, ip = 'unknown') {
  const limits = {
    user: Number(process.env.AI_DAILY_QUOTA) || 200,
    ip: Number(process.env.AI_IP_DAILY_QUOTA) || 400,
    all: Number(process.env.AI_GLOBAL_DAILY_QUOTA) || 5000,
  };
  const day = new Date().toISOString().slice(0, 10);
  try {
    await db.tx(async (t) => {
      const user = await t.run(
        `INSERT INTO ai_usage (user_id, day, count) VALUES ($1, $2, 1)
         ON CONFLICT (user_id, day) DO UPDATE SET count = ai_usage.count + 1
         WHERE ai_usage.count < $3`,
        [userId, day, limits.user],
      );
      if (!user) throw new QuotaExceeded('user');
      for (const [scope, pool] of [['ip', `ip:${ip}`], ['all', 'all']]) {
        const changed = await t.run(
          `INSERT INTO ai_usage_pools (pool, day, count) VALUES ($1, $2, 1)
           ON CONFLICT (pool, day) DO UPDATE SET count = ai_usage_pools.count + 1
           WHERE ai_usage_pools.count < $3`,
          [pool, day, limits[scope]],
        );
        if (!changed) throw new QuotaExceeded(scope);
      }
    });
    return null;
  } catch (err) {
    if (!(err instanceof QuotaExceeded)) throw err;
    if (err.scope === 'all') console.warn(`[AI Gateway] The service-wide daily limit (${limits.all}) is spent. Raise AI_GLOBAL_DAILY_QUOTA to allow more.`);
    return err.scope;
  }
}

export async function generateContent({ contents, responseMimeType, enableThinking, responseSchema }) {
  if (!aiClient) {
    throw new Error('Server AI Gateway is not configured with GEMINI_API_KEY.');
  }

  let lastError = null;

  for (const model of MODEL_CANDIDATES) {
    const buildConfig = (includeThinking) => {
      const config = { systemInstruction: STUDY_ONLY_INSTRUCTION };
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
        config,
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
            config: fallbackConfig,
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
      const config = { systemInstruction: STUDY_ONLY_INSTRUCTION };
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
        config,
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
            config: fallbackConfig,
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


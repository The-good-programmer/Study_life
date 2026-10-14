import { beforeAll, describe, expect, it } from 'vitest';

// public/sw-routes.js is a plain script (the service worker importScripts it);
// it puts studifyStrategyFor on the global object.
let strategyFor;
beforeAll(async () => {
  await import('../../public/sw-routes.js');
  strategyFor = globalThis.studifyStrategyFor;
});

const APP = 'https://studify.example';
const s = (href, mode = 'cors', method = 'GET') => strategyFor(new URL(href, APP), mode, method, APP);

describe('service worker routing', () => {
  it('never caches the API, wherever it is hosted', () => {
    expect(s('/api/auth/me')).toBe('network');
    expect(s('/api/sync/pull')).toBe('network');
    expect(s('https://api.studify.example/api/health')).toBe('network');
    expect(s('https://studify-api-8orm.onrender.com/api/decks/public')).toBe('network');
  });

  it('never caches non-GET requests or other origins (Google sign-in)', () => {
    expect(s('/assets/index-abc.js', 'cors', 'POST')).toBe('network');
    expect(s('https://accounts.google.com/gsi/client', 'no-cors')).toBe('network');
    expect(s('https://www.googleapis.com/oauth2/v3/userinfo')).toBe('network');
  });

  it('gives the browser-side Gemini SDK an offline fallback', () => {
    expect(s('https://generativelanguage.googleapis.com/v1beta/models')).toBe('gemini');
  });

  it('loads pages network-first (fresh index.html after a deploy)', () => {
    expect(s('/', 'navigate')).toBe('navigate');
    expect(s('/?launch=quick_sprint', 'navigate')).toBe('navigate');
  });

  it('caches content-hashed files forever', () => {
    expect(s('/assets/index-ByOJcIiN.js')).toBe('immutable');
    expect(s('https://fonts.gstatic.com/s/geist/v1/a.woff2')).toBe('immutable');
    expect(s('/avatar/medium/base.4d2af721.glb')).toBe('avatar');
    expect(s('/basis/basis_transcoder.wasm')).toBe('avatar');
  });

  it('always fetches the avatar manifest and the worker scripts fresh', () => {
    expect(s('/avatar/manifest.json')).toBe('fresh');
    expect(s('/sw.js')).toBe('network');
    expect(s('/sw-routes.js')).toBe('network');
    expect(s('/register-sw.js')).toBe('network');
  });

  it('revalidates everything else in the background', () => {
    expect(s('/manifest.json')).toBe('swr');
    expect(s('/favicon.svg')).toBe('swr');
  });
});

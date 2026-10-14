/**
 * How the service worker handles each request. Plain script (no modules), so
 * sw.js can load it with importScripts and tests can load it too: it puts
 * `studifyStrategyFor` on the global object.
 *
 * Strategies:
 * - network:     never cached (the API, other origins, the worker scripts)
 * - gemini:      network, with an offline JSON error for the AI SDK
 * - navigate:    network first, cached app shell when offline
 * - fresh:       network first, cached copy when offline (avatar manifest)
 * - immutable:   cache first; content-hashed files never change
 * - avatar:      cache first in the capped avatar cache (content-hashed models)
 * - swr:         stale while revalidate (icons, web manifest)
 */
(function (root) {
  function strategyFor(url, mode, method, appOrigin) {
    if (method !== 'GET') return 'network';
    if (url.origin !== appOrigin) {
      if (url.hostname === 'generativelanguage.googleapis.com') return 'gemini';
      if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return 'immutable';
      return 'network'; // the API, Google sign-in, anything else: never cached
    }
    const path = url.pathname;
    if (path.startsWith('/api/')) return 'network';
    if (mode === 'navigate') return 'navigate';
    if (path === '/sw.js' || path === '/sw-routes.js' || path === '/register-sw.js') return 'network';
    if (path === '/avatar/manifest.json') return 'fresh';
    if (path.startsWith('/assets/')) return 'immutable';
    if (path.startsWith('/avatar/') || path.startsWith('/basis/')) return 'avatar';
    return 'swr';
  }
  root.studifyStrategyFor = strategyFor;
})(typeof self !== 'undefined' ? self : globalThis);

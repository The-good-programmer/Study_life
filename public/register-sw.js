/* Registers the service worker (a file, not inline, so the Content Security
 * Policy needs no 'unsafe-inline'). On localhost it removes any worker and
 * cache instead, so development never serves stale chunks. When a new
 * version takes over an open tab, it offers a reload. */
(function () {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;

  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    if ('caches' in window) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    return;
  }

  // Only an update (not the very first install) should prompt.
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) showUpdateToast();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.log('SW registration skipped:', err));
  });

  function showUpdateToast() {
    if (document.getElementById('studify-update-toast')) return;
    const toast = document.createElement('div');
    toast.id = 'studify-update-toast';
    toast.setAttribute('role', 'status');
    toast.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:24px', 'transform:translateX(-50%)', 'z-index:2147483647',
      'display:flex', 'gap:12px', 'align-items:center', 'padding:10px 14px', 'border-radius:12px',
      'background:#131b34', 'color:#e2e8f0', 'border:1px solid rgba(129,140,248,.4)',
      'box-shadow:0 8px 24px rgba(0,0,0,.4)', 'font:500 14px/1.3 system-ui,sans-serif',
    ].join(';');
    const text = document.createElement('span');
    text.textContent = 'A new version of Studify is available.';
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.textContent = 'Reload';
    reload.style.cssText = 'background:#818cf8;color:#0b1020;border:0;border-radius:8px;padding:6px 12px;font-weight:600;cursor:pointer';
    reload.addEventListener('click', () => location.reload());
    toast.append(text, reload);
    document.body.appendChild(toast);
  }
})();

/* ShopX boot splash — runs from <head>, hides after real initialization:
   1) document parsing finished (when splash starts early)
   2) backend health check  3) essential categories data               */
(function () {
  'use strict';

  if (window.__shopxSplash) return;
  window.__shopxSplash = true;

  var SESSION_KEY = 'shopx_booted';
  var REQUEST_TIMEOUT_MS = 10000;

  try {
    if (sessionStorage.getItem(SESSION_KEY) === '1') return;
  } catch (e) {}

  var reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var MESSAGES = {
    init: 'Initializing ShopX...',
    connect: 'Connecting to server...',
    data: 'Loading products...',
    ready: 'Preparing your shopping experience...',
  };

  var BAG_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M6 7h12l1.2 12.2a1.8 1.8 0 0 1-1.8 2H6.6a1.8 1.8 0 0 1-1.8-2L6 7z"/>' +
    '<path d="M9 10V6a3 3 0 0 1 6 0v4"/>' +
    '</svg>';

  var ALERT_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 9v4"/><path d="M12 17h.01"/>' +
    '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>' +
    '</svg>';

  var root = document.createElement('div');
  root.className = 'splash';
  root.id = 'shopx-splash';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-label', 'ShopX is loading');
  root.innerHTML =
    '<div class="splash-card">' +
    '<div class="splash-mark">' + BAG_SVG + '</div>' +
    '<div class="splash-word">Shop<span>X</span></div>' +
    '<p class="splash-tag">Your shopping experience starts here.</p>' +
    '<div class="splash-loading" id="splashLoading">' +
    '<svg class="splash-spinner" viewBox="0 0 48 48" aria-hidden="true">' +
    '<circle class="s-track" cx="24" cy="24" r="19"/><circle class="s-arc" cx="24" cy="24" r="19"/>' +
    '</svg>' +
    '<div class="splash-track" aria-hidden="true"><span class="splash-bar"></span></div>' +
    '<p class="splash-status" id="splashStatus">' + MESSAGES.init + '</p>' +
    '</div>' +
    '<div class="splash-error hidden" id="splashError" role="alert">' +
    '<div class="splash-err-ic">' + ALERT_SVG + '</div>' +
    '<h2>Unable to connect to ShopX.</h2>' +
    '<p>We could not reach the server. Please check your internet connection and try again.</p>' +
    '<button type="button" class="splash-retry" id="splashRetry">Retry</button>' +
    '</div>' +
    '</div>';

  document.documentElement.appendChild(root);

  var loadingEl = root.querySelector('#splashLoading');
  var errorEl = root.querySelector('#splashError');
  var statusEl = root.querySelector('#splashStatus');
  var retryEl = root.querySelector('#splashRetry');
  var destroyed = false;
  var started = false;
  var leaveFallback = null;

  function reparent() {
    if (document.body && root.parentNode === document.documentElement) {
      document.body.insertBefore(root, document.body.firstChild);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reparent, { once: true });
  } else {
    reparent();
  }

  function setStatus(text) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.remove('splash-status--in');
    void statusEl.offsetWidth;
    statusEl.classList.add('splash-status--in');
  }

  function fetchJSON(url) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;
    if (ctrl) timer = setTimeout(function () { ctrl.abort(); }, REQUEST_TIMEOUT_MS);
    function done() {
      if (timer) clearTimeout(timer);
    }
    return fetch(url, {
      signal: ctrl ? ctrl.signal : undefined,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        if (!res.ok) throw new Error('request failed');
        return res.json();
      })
      .then(function (json) {
        done();
        if (!json || json.success !== true) throw new Error('unexpected response');
        return json;
      })
      .catch(function (err) {
        done();
        throw err;
      });
  }

  function startHealth() {
    if (destroyed || started) return;
    started = true;
    errorEl.classList.add('hidden');
    loadingEl.classList.remove('hidden');
    setStatus(MESSAGES.connect);

    fetchJSON('/api/health')
      .then(function () {
        setStatus(MESSAGES.data);
        return fetchJSON('/api/categories');
      })
      .then(function (json) {
        window.ShopXBoot = window.ShopXBoot || {};
        window.ShopXBoot.categories = json.data || [];
        try {
          sessionStorage.setItem(SESSION_KEY, '1');
        } catch (e) {}
        setStatus(MESSAGES.ready);
        finish();
      })
      .catch(function () {
        showError();
      });
  }

  function showError() {
    loadingEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
    root.setAttribute('aria-live', 'assertive');
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    clearTimeout(leaveFallback);
    document.removeEventListener('DOMContentLoaded', reparent);
    root.removeEventListener('transitionend', onLeaveEnd);
    if (root.parentNode) root.parentNode.removeChild(root);
    try {
      window.dispatchEvent(new CustomEvent('shopx:splash-done'));
    } catch (e) {}
  }

  function onLeaveEnd(e) {
    if (e.target !== root || e.propertyName !== 'opacity') return;
    clearTimeout(leaveFallback);
    root.removeEventListener('transitionend', onLeaveEnd);
    destroy();
  }

  function finish() {
    if (reducedMotion) {
      destroy();
      return;
    }
    // clear the entrance animation (it pins opacity via fill-mode) so the
    // exit fade can run instead of the screen popping away
    root.classList.add('is-entered');
    void root.offsetWidth;
    root.classList.add('is-leaving');
    leaveFallback = setTimeout(function () {
      root.removeEventListener('transitionend', onLeaveEnd);
      destroy();
    }, 900);
    root.addEventListener('transitionend', onLeaveEnd);
  }

  retryEl.addEventListener('click', function () {
    started = false;
    root.setAttribute('aria-live', 'polite');
    errorEl.classList.add('hidden');
    loadingEl.classList.remove('hidden');
    setStatus(MESSAGES.init);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startHealth, { once: true });
    } else {
      startHealth();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startHealth, { once: true });
  } else {
    startHealth();
  }
})();

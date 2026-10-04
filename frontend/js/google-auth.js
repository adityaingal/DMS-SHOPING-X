/* ShopX — Google Sign-In (Google Identity Services, ID-token flow)
   The ID token is sent to the backend and verified there; nothing from the
   browser is trusted for identity. */

const GoogleAuth = (() => {
  const GIS_SRC = 'https://accounts.google.com/gsi/client';

  const G_LOGO =
    '<svg class="g-logo" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" focusable="false">' +
    '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
    '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
    '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
    '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
    '</svg>';

  const LABEL = `${G_LOGO}<span class="g-label">Continue with Google</span>`;

  let busy = false;
  let submitted = false;
  let fallbackShown = false;
  let fallbackTimer = null;
  let ctx = null;

  const loadGis = () =>
    new Promise((resolve, reject) => {
      if (window.google && window.google.accounts && window.google.accounts.id) return resolve();
      const existing = document.querySelector('script[data-gis]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('script')));
        return;
      }
      const s = document.createElement('script');
      s.src = GIS_SRC;
      s.async = true;
      s.defer = true;
      s.dataset.gis = '1';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('script'));
      document.head.appendChild(s);
      setTimeout(() => reject(new Error('timeout')), 15000);
    });

  const hideBlock = () => {
    if (!ctx) return;
    const wrap = document.getElementById('googleAuth');
    const divider = document.getElementById('authDivider');
    if (wrap) wrap.classList.add('hidden');
    if (divider) divider.classList.add('hidden');
  };

  const message = (text, kind) => {
    if (!ctx) return;
    ctx.status.textContent = text || '';
    ctx.status.className = 'google-status' + (text ? ` is-${kind || 'info'}` : '');
  };

  const setBusy = (label) => {
    busy = true;
    ctx.btn.disabled = true;
    ctx.btn.setAttribute('aria-busy', 'true');
    ctx.btn.innerHTML = `<span class="spinner dark"></span><span class="g-label">${label}</span>`;
  };

  const setIdle = () => {
    busy = false;
    if (ctx.btn) {
      ctx.btn.disabled = false;
      ctx.btn.removeAttribute('aria-busy');
      ctx.btn.innerHTML = LABEL;
    }
  };

  const showFallback = () => {
    if (!ctx || submitted || fallbackShown) return;
    fallbackShown = true;
    clearTimeout(fallbackTimer);
    setIdle();
    ctx.btn.classList.add('hidden');
    ctx.hint.textContent = 'Choose a Google account to continue';
    ctx.hint.classList.remove('hidden');
    ctx.slot.classList.remove('hidden');
    try {
      window.google.accounts.id.renderButton(ctx.slot, {
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        width: 300,
      });
    } catch (e) {
      hideBlock();
    }
  };

  const handleCredential = async (credential) => {
    if (!credential || submitted) return;
    submitted = true;
    clearTimeout(fallbackTimer);
    setBusy('Signing in…');
    message('');
    try {
      const user = await AuthAPI.google(credential);
      if (typeof afterAuth === 'function') await afterAuth(user);
    } catch (err) {
      submitted = false;
      setIdle();
      const text = (err && err.message) || 'Google sign-in failed. Please try again.';
      if (ctx.alertId && typeof showAlert === 'function') showAlert(ctx.alertId, text);
      else message(text, 'error');
    }
  };

  const handlePromptError = (err) => {
    clearTimeout(fallbackTimer);
    if (submitted) return;
    const type = err && err.type;
    if (type === 'popup_closed' || type === 'ironic_cancel') {
      setIdle();
      message('Sign-in cancelled. You can try again any time.', 'info');
      return;
    }
    if (type === 'popup_failed_to_open') {
      setIdle();
      message('Your browser blocked the Google window. Allow pop-ups for this site and try again.', 'error');
      showFallback();
      return;
    }
    setIdle();
    showFallback();
  };

  const onClick = () => {
    if (busy || submitted) return;
    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
      message('Google Sign-In could not load. Check your connection and try again.', 'error');
      return;
    }
    setBusy('Waiting for Google…');
    message('');
    try {
      window.google.accounts.id.prompt();
    } catch (e) {
      setIdle();
      showFallback();
      return;
    }
    fallbackTimer = setTimeout(() => {
      if (!submitted) showFallback();
    }, 3500);
  };

  const mount = async (opts) => {
    ctx = {
      alertId: opts.alertId,
      btn: document.getElementById('googleBtn'),
      slot: document.getElementById('gisSlot'),
      hint: document.getElementById('googleHint'),
      status: document.getElementById('googleStatus'),
    };
    if (!ctx.btn || !ctx.slot) return;

    ctx.btn.innerHTML = LABEL;

    let config;
    try {
      config = (await api.get('/auth/google/config')).data;
    } catch (e) {
      hideBlock();
      return;
    }

    if (!config || !config.enabled || !config.clientId) {
      hideBlock();
      return;
    }

    try {
      await loadGis();
    } catch (e) {
      message('Google Sign-In is unavailable right now. Please sign in with your email instead.', 'error');
      ctx.btn.disabled = true;
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: config.clientId,
        callback: (resp) => handleCredential(resp && resp.credential),
        error_callback: handlePromptError,
      });
    } catch (e) {
      message('Google Sign-In could not be initialised.', 'error');
      ctx.btn.disabled = true;
      return;
    }

    ctx.btn.addEventListener('click', onClick);
  };

  const renderLinkButton = async (slot, onCredential) => {
    let config;
    try {
      config = (await api.get('/auth/google/config')).data;
    } catch (e) {
      throw new Error('Cannot reach the server. Please try again.');
    }
    if (!config || !config.enabled || !config.clientId) {
      throw new Error('Google Sign-In is not configured.');
    }
    await loadGis();
    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
      throw new Error('Google Sign-In could not load. Check your connection and try again.');
    }
    window.google.accounts.id.initialize({
      client_id: config.clientId,
      callback: (resp) => onCredential(resp && resp.credential),
    });
    window.google.accounts.id.renderButton(slot, {
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      text: 'continue_with',
      width: 300,
    });
  };

  return { mount, renderLinkButton };
})();

document.addEventListener('shopx:ready', () => {
  if (document.getElementById('googleAuth')) {
    GoogleAuth.mount({
      alertId: document.getElementById('loginForm') ? 'loginAlert' : 'registerAlert',
    });
  }
});

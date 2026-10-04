function markOk(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3500);
}

async function refreshUser() {
  const user = await AuthAPI.refresh();
  if (user) fillProfile(user);
}

function fillProfile(user) {
  document.getElementById('whoName').textContent = user.name;
  document.getElementById('whoEmail').textContent = user.email;
  document.getElementById('pName').value = user.name;
  document.getElementById('pEmail').value = user.email;
  document.getElementById('pPhone').value = user.phone || '';
  document.getElementById('accountStats').innerHTML = `
    <div><b id="statOrders">…</b><span>Orders placed</span></div>
    <div><b id="statWish">…</b><span>Wishlist items</span></div>
    <div><b>${new Date(user.createdAt || Date.now()).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</b><span>Member since</span></div>`;
  renderAddresses(user.addresses || []);
  renderSignInMethod(user);
}

function renderSignInMethod(user) {
  const box = document.getElementById('signInMethod');
  if (!box) return;

  const passwordSet = user.provider !== 'google';
  box.innerHTML = `
    <div class="sign-in-row"><span>Password</span><b>${passwordSet ? 'Set' : 'Not set'}</b></div>
    <div class="sign-in-row"><span>Google</span><b>${user.hasGoogle ? 'Linked' : 'Not linked'}</b></div>
    ${
      user.hasGoogle
        ? `<p class="muted text-sm" style="margin:.6rem 0 0">You can sign in with Google using <b>${esc(user.email)}</b>.</p>`
        : `<div class="google-link-row">
             <button type="button" class="btn btn-outline btn-sm" id="linkGoogleBtn">Link Google account</button>
             <p class="google-hint" id="linkGoogleHint"></p>
           </div>`
    }`;

  const btn = document.getElementById('linkGoogleBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const hint = document.getElementById('linkGoogleHint');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner dark"></span> Checking…';

    const slot = document.createElement('div');
    slot.className = 'gis-slot';
    btn.parentElement.insertBefore(slot, btn.nextSibling);

    try {
      await GoogleAuth.renderLinkButton(slot, async (credential) => {
        try {
          await AuthAPI.googleLink(credential);
          showToast('Google account linked.', 'success');
          await refreshUser();
        } catch (err) {
          showToast(err.message || 'Could not link the Google account.', 'error');
        }
      });
      btn.classList.add('hidden');
      if (hint) hint.textContent = `Choose the Google account that uses ${user.email}`;
    } catch (err) {
      slot.remove();
      btn.disabled = false;
      btn.textContent = 'Link Google account';
      if (hint) hint.textContent = err.message || 'Google Sign-In is unavailable.';
    }
  });
}

function renderAddresses(addresses) {
  const box = document.getElementById('addressList');
  if (!addresses.length) {
    box.innerHTML = '<p class="muted" style="margin:0">No saved addresses yet. Add one for faster checkout.</p>';
    return;
  }
  box.innerHTML = addresses
    .map(
      (a) => `
    <div class="panel" style="background:var(--surface-2);margin-bottom:.7rem;padding:.9rem 1rem">
      <div class="section-head" style="margin-bottom:.4rem">
        <b>${esc(a.label || 'Address')} ${a.isDefault ? '<span class="tag tag-cod" style="font-size:.68rem">Default</span>' : ''}</b>
        <span style="display:flex;gap:.7rem">
          <button class="btn-link" data-edit="${a._id}">Edit</button>
          <button class="link-danger" data-del="${a._id}">Delete</button>
        </span>
      </div>
      <div class="text-sm muted">${esc(a.fullName)} · ${esc(a.phone)}</div>
      <div class="text-sm muted">${esc(a.line1)}${a.line2 ? ', ' + esc(a.line2) : ''}, ${esc(a.city)}, ${esc(a.state)} — ${esc(a.postalCode)}</div>
    </div>`
    )
    .join('');

  box.querySelectorAll('[data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const addr = addresses.find((a) => a._id === btn.dataset.edit);
      if (!addr) return;
      document.getElementById('addrId').value = addr._id;
      document.getElementById('aLabel').value = addr.label || '';
      document.getElementById('aName').value = addr.fullName;
      document.getElementById('aPhone').value = addr.phone;
      document.getElementById('aLine1').value = addr.line1;
      document.getElementById('aLine2').value = addr.line2 || '';
      document.getElementById('aCity').value = addr.city;
      document.getElementById('aState').value = addr.state;
      document.getElementById('aPostal').value = addr.postalCode;
      document.getElementById('aDefault').checked = !!addr.isDefault;
      document.getElementById('addressForm').classList.remove('hidden');
      document.getElementById('addressForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    })
  );

  box.querySelectorAll('[data-del]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!(await confirmDialog('Delete this address?', { confirmText: 'Delete', danger: true }))) return;
      try {
        await api.del(`/auth/addresses/${btn.dataset.del}`);
        showToast('Address deleted.', 'success');
        await refreshUser();
      } catch (e) {
        showToast(e.message, 'error');
      }
    })
  );
}

function wireTabs() {
  document.querySelectorAll('.account-nav button[data-panel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.account-nav button[data-panel]').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${btn.dataset.panel}`));
    });
  });
}

function wireForms() {
  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await api.patch('/auth/profile', {
        name: document.getElementById('pName').value.trim(),
        email: document.getElementById('pEmail').value.trim(),
        phone: document.getElementById('pPhone').value.trim(),
      });
      await refreshUser();
      markOk('profileOk', 'Profile updated successfully.');
      showToast('Profile updated.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('curPass').value;
    const newPassword = document.getElementById('newPass').value;
    const confirm = document.getElementById('confPass').value;

    if (newPassword.length < 8 || !/\d/.test(newPassword)) {
      showToast('New password needs 8+ characters and a number.', 'error');
      return;
    }
    if (newPassword !== confirm) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await api.patch('/auth/password', { currentPassword, newPassword });
      e.target.reset();
      markOk('passwordOk', 'Password changed successfully.');
      showToast('Password changed.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  const form = document.getElementById('addressForm');
  document.getElementById('addAddressBtn').addEventListener('click', () => {
    form.reset();
    document.getElementById('addrId').value = '';
    form.classList.remove('hidden');
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.getElementById('cancelAddress').addEventListener('click', () => form.classList.add('hidden'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      label: document.getElementById('aLabel').value.trim() || 'Address',
      fullName: document.getElementById('aName').value.trim(),
      phone: document.getElementById('aPhone').value.trim(),
      line1: document.getElementById('aLine1').value.trim(),
      line2: document.getElementById('aLine2').value.trim(),
      city: document.getElementById('aCity').value.trim(),
      state: document.getElementById('aState').value.trim(),
      postalCode: document.getElementById('aPostal').value.trim(),
      isDefault: document.getElementById('aDefault').checked,
    };
    if (!payload.fullName || !payload.phone || !payload.line1 || !payload.city || !payload.state || !payload.postalCode) {
      showToast('Please fill in all required address fields.', 'error');
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const id = document.getElementById('addrId').value;
      if (id) await api.patch(`/auth/addresses/${id}`, payload);
      else await api.post('/auth/addresses', payload);
      form.reset();
      form.classList.add('hidden');
      showToast('Address saved.', 'success');
      await refreshUser();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

async function loadStats() {
  try {
    const [orders, wish] = await Promise.all([api.get('/orders/my-orders', { limit: 1 }), api.get('/wishlist')]);
    const oEl = document.getElementById('statOrders');
    const wEl = document.getElementById('statWish');
    if (oEl) oEl.textContent = (orders.pagination && orders.pagination.total) || 0;
    if (wEl) wEl.textContent = wish.data.count || 0;
  } catch (e) {
    /* stats are optional */
  }
}

document.addEventListener('shopx:ready', () => {
  if (!Auth.isLoggedIn()) {
    document.getElementById('accountGate').classList.remove('hidden');
    return;
  }
  document.getElementById('accountLayout').classList.remove('hidden');
  fillProfile(Auth.user);
  wireTabs();
  wireForms();
  loadStats();
});

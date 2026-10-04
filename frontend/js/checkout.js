let cartData = null;
let promo = null;

const PROMO_RULES = {
  WELCOME10: { type: 'percent', value: 10, max: 500 },
  SAVE50: { type: 'flat', value: 50, min: 499 },
};

function showError(msg) {
  const box = qs('#checkoutError');
  if (!msg) {
    box.classList.add('hidden');
    return;
  }
  box.textContent = msg;
  box.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function selectedAddressMode() {
  const checked = qs('input[name="addressMode"]:checked');
  return checked ? checked.value : 'new';
}

function getSavedSelection() {
  const checked = qs('input[name="addressMode"]:checked');
  if (!checked || checked.value === 'new') return null;
  const user = Auth.user;
  return (user.addresses || []).find((a) => a._id === checked.value) || null;
}

function renderAddresses() {
  const user = Auth.user;
  const addresses = user.addresses || [];
  const box = qs('#savedAddresses');
  const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];

  if (!addresses.length) {
    box.innerHTML = '';
    qs('input[name="addressMode"][value="new"]').checked = true;
    qs('#addressForm').classList.remove('hidden');
    return;
  }

  box.innerHTML = addresses
    .map(
      (a) => `
    <label class="address-option ${defaultAddr && a._id === defaultAddr._id ? 'selected' : ''}">
      <input type="radio" name="addressMode" value="${a._id}" ${defaultAddr && a._id === defaultAddr._id ? 'checked' : ''} />
      <span>
        <b>${esc(a.fullName)}</b> ${a.isDefault ? '<span class="tag tag-cod">Default</span>' : ''}
        <div class="text-sm muted">${esc(a.line1)}${a.line2 ? ', ' + esc(a.line2) : ''}, ${esc(a.city)}, ${esc(a.state)} — ${esc(a.postalCode)}</div>
        <div class="text-sm muted">Phone: ${esc(a.phone)}</div>
      </span>
    </label>`
    )
    .join('');

  qs('#addressForm').classList.toggle('hidden', selectedAddressMode() !== 'new');
}

function promoDiscount(subtotal) {
  if (!promo) return 0;
  const rule = PROMO_RULES[promo];
  if (!rule) return 0;
  if (rule.min && subtotal < rule.min) return 0;
  let d = rule.type === 'percent' ? Math.min((subtotal * rule.value) / 100, rule.max || Infinity) : rule.value;
  return Math.min(Math.round(d), subtotal);
}

function renderSummary() {
  if (!cartData) return;
  const subtotal = cartData.subtotal;
  const shipping = cartData.shippingFee;
  const discount = promoDiscount(subtotal);
  const total = Math.max(subtotal + shipping - discount, 0);

  qs('#oSubtotal').textContent = money(subtotal);
  qs('#oShipping').textContent = shipping === 0 ? 'FREE' : money(shipping);
  qs('#discountRow').style.display = discount ? 'flex' : 'none';
  qs('#oDiscount').textContent = '-' + money(discount);
  qs('#oTotal').textContent = money(total);
}

async function loadOrderSummary() {
  try {
    const res = await api.get('/cart');
    cartData = res.data;
    if (!cartData.items.length) {
      showToast('Your cart is empty.', 'info');
      location.href = '/cart.html';
      return false;
    }
    qs('#orderItems').innerHTML = cartData.items
      .map(
        (i) => `
      <div class="mini-line">
        <img src="${esc(i.product.image)}" alt="" />
        <span class="grow">
          <span class="nm">${esc(i.product.name)}</span>
          <span class="text-xs muted">Qty ${i.quantity} × ${money(i.unitPrice)}</span>
        </span>
        <b>${money(i.lineTotal)}</b>
      </div>`
      )
      .join('');
    attachImgFallbacks(qs('#orderItems'));
    renderSummary();
    return true;
  } catch (e) {
    showError(e.message);
    return false;
  }
}

function collectAddress() {
  const mode = selectedAddressMode();
  if (mode !== 'new') {
    const saved = getSavedSelection();
    if (saved) {
      return {
        fullName: saved.fullName,
        phone: saved.phone,
        line1: saved.line1,
        line2: saved.line2 || '',
        city: saved.city,
        state: saved.state,
        postalCode: saved.postalCode,
        notes: qs('#notes') ? qs('#notes').value.trim() : '',
      };
    }
  }

  const form = qs('#addressForm');
  const val = (id) => (qs('#' + id, form) ? qs('#' + id, form).value.trim() : '');
  const data = {
    fullName: val('fullName'),
    phone: val('phone'),
    line1: val('line1'),
    line2: val('line2'),
    city: val('city'),
    state: val('state'),
    postalCode: val('postalCode'),
    notes: val('notes'),
  };

  qsa('.input', form).forEach((i) => i.classList.remove('invalid'));
  qsa('.field-error', form).forEach((e) => e.remove());

  const problems = [];
  const check = (id, cond, msg) => {
    if (!cond) {
      problems.push(msg);
      const input = qs('#' + id, form);
      if (input) {
        input.classList.add('invalid');
        const err = document.createElement('span');
        err.className = 'field-error';
        err.textContent = msg;
        input.parentElement.appendChild(err);
      }
    }
  };
  check('fullName', data.fullName.length >= 2, 'Please enter your full name.');
  check('phone', /^[0-9+\-\s]{6,20}$/.test(data.phone), 'Enter a valid phone number.');
  check('line1', data.line1.length >= 3, 'Enter your address.');
  check('city', data.city.length >= 2, 'Enter your city.');
  check('state', data.state.length >= 2, 'Enter your state.');
  check('postalCode', /^[0-9a-zA-Z\s-]{4,12}$/.test(data.postalCode), 'Enter a valid postal code.');

  if (problems.length) {
    showError(problems[0]);
    return null;
  }
  showError('');
  return data;
}

async function placeOrder() {
  const address = collectAddress();
  if (!address) return;

  const paymentMethod = qs('input[name="payment"]:checked').value;
  const btn = qs('#placeOrder');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Placing order…';
  showError('');

  try {
    const res = await api.post('/orders', {
      shippingAddress: address,
      paymentMethod,
      promoCode: promo || undefined,
    });
    const order = res.data;
    await refreshBadges();
    showToast('Order placed successfully!', 'success');
    location.href = `/orders.html?id=${encodeURIComponent(order._id)}&placed=1&no=${encodeURIComponent(order.orderNumber)}`;
  } catch (e) {
    showError(e.message);
    showToast(e.message, 'error');
    btn.disabled = false;
    btn.innerHTML = original;
    if (e.status === 401) requireLogin('/checkout.html');
  }
}

document.addEventListener('shopx:ready', async () => {
  if (!Auth.isLoggedIn()) {
    requireLogin('/checkout.html');
    return;
  }

  qs('#checkoutLoading').classList.add('hidden');
  qs('#checkoutLayout').classList.remove('hidden');
  renderAddresses();

  document.addEventListener('change', (e) => {
    if (e.target.name === 'addressMode') {
      qsa('.address-option').forEach((el) => el.classList.toggle('selected', el.contains(e.target)));
      qs('#addressForm').classList.toggle('hidden', selectedAddressMode() !== 'new');
    }
    if (e.target.name === 'payment') {
      qsa('.pay-option').forEach((el) => el.classList.toggle('selected', el.contains(e.target)));
    }
  });

  qs('#applyPromo').addEventListener('click', () => {
    const code = qs('#promoInput').value.trim().toUpperCase();
    const msg = qs('#promoMsg');
    if (!code) {
      promo = null;
      msg.innerHTML = '';
      renderSummary();
      return;
    }
    const rule = PROMO_RULES[code];
    if (!rule) {
      promo = null;
      msg.innerHTML = '<span style="color:var(--danger)">Invalid promo code.</span>';
      renderSummary();
      return;
    }
    if (rule.min && cartData.subtotal < rule.min) {
      promo = null;
      msg.innerHTML = `<span style="color:var(--danger)">This code needs a minimum order of ${money(rule.min)}.</span>`;
      renderSummary();
      return;
    }
    promo = code;
    const d = promoDiscount(cartData.subtotal);
    msg.innerHTML = `<span style="color:var(--success)">Code applied — you saved ${money(d)}.</span>`;
    renderSummary();
  });

  qs('#placeOrder').addEventListener('click', placeOrder);
  await loadOrderSummary();
});

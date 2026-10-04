let mode = 'guest';

function hideAll() {
  qs('#cartLoading').classList.add('hidden');
  qs('#cartEmpty').classList.add('hidden');
  qs('#cartLayout').classList.add('hidden');
}

function itemRow(item, loggedIn) {
  const product = loggedIn ? item.product : item;
  const qty = item.quantity;
  const unit = item.unitPrice != null ? item.unitPrice : product.discountPrice != null ? product.discountPrice : product.price;
  const lineTotal = item.lineTotal != null ? item.lineTotal : unit * qty;
  const maxQty = loggedIn ? item.maxQuantity : product.stock;
  const idAttr = loggedIn ? `data-item="${item._id}"` : `data-guest="${product.id}"`;
  const href = `/product-details.html?slug=${encodeURIComponent(product.slug || '')}`;

  return `
    <div class="cart-item" ${idAttr}>
      <a href="${href}"><img src="${esc(product.image)}" alt="${esc(product.name)}" /></a>
      <div>
        <a class="ci-title" href="${href}">${esc(product.name)}</a>
        <div class="ci-meta">${esc(product.brand || '')} · ${money(unit)} each ${!loggedIn ? '<span style="color:var(--warning)"> (display price — verified at checkout)</span>' : ''}</div>
        <div class="qty-control" style="margin-top:.6rem">
          <button type="button" data-act="dec" aria-label="Decrease quantity">−</button>
          <input type="number" value="${qty}" min="1" max="${maxQty || 99}" data-act="qty" aria-label="Quantity" />
          <button type="button" data-act="inc" aria-label="Increase quantity">+</button>
        </div>
        ${maxQty && maxQty <= 5 ? `<div class="text-xs" style="color:var(--warning);margin-top:.35rem">Only ${maxQty} in stock</div>` : ''}
      </div>
      <div class="ci-right">
        <span class="ci-total">${money(lineTotal)}</span>
        <button class="link-danger" data-act="remove">Remove</button>
      </div>
    </div>`;
}

function renderSummary(subtotal, shipping, total) {
  qs('#sumSubtotal').textContent = money(subtotal);
  qs('#sumShipping').textContent = shipping === 0 ? (subtotal > 0 ? 'FREE' : money(0)) : money(shipping);
  qs('#sumTotal').textContent = money(total);
  const note = qs('#shipNote');
  if (subtotal >= 999) {
    note.innerHTML = '✓ You have unlocked free shipping on this order.';
    note.style.display = 'block';
  } else if (subtotal > 0) {
    const left = 999 - subtotal;
    note.innerHTML = `Add ${money(left)} more to get free shipping.`;
    note.style.display = 'block';
  } else {
    note.style.display = 'none';
  }
}

function showContent() {
  qs('#cartLayout').classList.remove('hidden');
}

async function renderServerCart() {
  mode = 'server';
  try {
    const res = await api.get('/cart');
    const data = res.data;
    hideAll();
    qs('#cartSubtitle').textContent = `${data.itemCount} item${data.itemCount === 1 ? '' : 's'} in your cart`;
    if (!data.items.length) {
      qs('#cartEmpty').classList.remove('hidden');
      return;
    }
    qs('#cartItems').innerHTML = data.items.map((i) => itemRow(i, true)).join('');
    attachImgFallbacks(qs('#cartItems'));
    renderSummary(data.subtotal, data.shippingFee, data.total);
    showContent();
  } catch (e) {
    hideAll();
    qs('#cartEmpty').classList.remove('hidden');
    showToast(e.message, 'error');
  }
}

function renderGuestCart() {
  mode = 'guest';
  hideAll();
  const data = GuestCart.totals();
  qs('#cartSubtitle').textContent = `${data.itemCount} item${data.itemCount === 1 ? '' : 's'} in your cart`;
  if (!data.items.length) {
    qs('#cartEmpty').classList.remove('hidden');
    return;
  }
  qs('#cartItems').innerHTML = data.items.map((i) => itemRow(i, false)).join('');
  attachImgFallbacks(qs('#cartItems'));
  renderSummary(data.subtotal, data.shippingFee, data.total);
  qs('#guestNote').classList.remove('hidden');
  showContent();
}

async function render() {
  if (Auth.isLoggedIn()) await renderServerCart();
  else renderGuestCart();
}

function wireItems() {
  qs('#cartItems').addEventListener('click', async (e) => {
    const row = e.target.closest('.cart-item');
    if (!row) return;
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const action = act.dataset.act;

    if (mode === 'server') {
      const itemId = row.dataset.item;
      const input = qs('[data-act="qty"]', row);
      let qty = parseInt(input.value, 10) || 1;
      try {
        if (action === 'dec') qty = Math.max(1, qty - 1);
        if (action === 'inc') qty += 1;
        if (action === 'remove') {
          if (!(await confirmDialog('Remove this item from your cart?', { confirmText: 'Remove', danger: true }))) return;
          await api.del(`/cart/items/${itemId}`);
          showToast('Item removed.', 'info');
        } else {
          await api.patch(`/cart/items/${itemId}`, { quantity: qty });
        }
        await renderServerCart();
        await refreshBadges();
      } catch (err) {
        showToast(err.message, 'error');
      }
    } else {
      const id = row.dataset.guest;
      if (action === 'remove') {
        if (!(await confirmDialog('Remove this item from your cart?', { confirmText: 'Remove', danger: true }))) return;
        GuestCart.remove(id);
        showToast('Item removed.', 'info');
      } else {
        const current = parseInt(qs('[data-act="qty"]', row).value, 10) || 1;
        const item = GuestCart.read().find((i) => i.id === id);
        const stock = item ? item.stock : 99;
        if (action === 'dec') GuestCart.setQty(id, Math.max(1, current - 1));
        if (action === 'inc') GuestCart.setQty(id, Math.min(current + 1, stock));
      }
      renderGuestCart();
      refreshBadges();
    }
  });

  qs('#cartItems').addEventListener('change', async (e) => {
    if (!e.target.matches('[data-act="qty"]')) return;
    const row = e.target.closest('.cart-item');
    const qty = parseInt(e.target.value, 10) || 1;
    if (mode === 'server') {
      try {
        await api.patch(`/cart/items/${row.dataset.item}`, { quantity: qty });
        await renderServerCart();
        await refreshBadges();
      } catch (err) {
        showToast(err.message, 'error');
        await renderServerCart();
      }
    } else {
      GuestCart.setQty(row.dataset.guest, qty);
      renderGuestCart();
      refreshBadges();
    }
  });
}

document.addEventListener('shopx:ready', () => {
  render();
  wireItems();

  qs('#checkoutBtn').addEventListener('click', () => {
    if (!Auth.isLoggedIn()) {
      showToast('Please sign in to continue to checkout.', 'info');
      requireLogin('/checkout.html');
      return;
    }
    location.href = '/checkout.html';
  });

  window.addEventListener('shopx:cart', () => {
    if (mode === 'guest') renderGuestCart();
  });
});

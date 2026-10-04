const FLOW = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered'];

function statusBadge(status) {
  return `<span class="status-badge st-${String(status).toLowerCase()}">${esc(status)}</span>`;
}

function paymentBadge(order) {
  const label = order.isSandboxPayment && order.paymentStatus === 'paid' ? 'Paid (sandbox)' : order.paymentStatus;
  return `<span class="status-badge st-${esc(order.paymentStatus)}">${esc(label)}</span>`;
}

function orderCard(o) {
  const canCancel = o.orderStatus === 'Pending' || o.orderStatus === 'Confirmed';
  return `
  <article class="order-card">
    <div class="order-head">
      <div>
        <span class="order-no">${esc(o.orderNumber)}</span>
        <div class="order-date">Placed on ${new Date(o.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      </div>
      <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
        ${statusBadge(o.orderStatus)}
        ${paymentBadge(o)}
      </div>
    </div>
    <div class="order-body">
      <div class="order-items-mini">
        ${o.items.slice(0, 6).map((i) => `<img src="${esc(i.image)}" alt="${esc(i.name)}" title="${esc(i.name)}" />`).join('')}
        ${o.items.length > 6 ? `<span class="text-sm muted" style="align-self:center">+${o.items.length - 6} more</span>` : ''}
      </div>
      <div class="order-foot">
        <div class="text-sm muted">${o.items.reduce((s, i) => s + i.quantity, 0)} item(s) · ${esc(o.shippingAddress.city)} · ${o.paymentMethod === 'cod' ? 'Cash on delivery' : 'Sandbox test payment'}</div>
        <div style="display:flex;gap:.7rem;align-items:center">
          <b class="price">${money(o.total)}</b>
          <a class="btn btn-sm btn-outline" href="/orders.html?id=${encodeURIComponent(o._id)}">View details</a>
          ${canCancel ? `<button class="btn btn-sm btn-danger" data-cancel="${o._id}">Cancel</button>` : ''}
        </div>
      </div>
    </div>
  </article>`;
}

async function cancelOrder(id) {
  if (!(await confirmDialog('Cancel this order? This cannot be undone.', { confirmText: 'Cancel order', danger: true }))) return;
  try {
    await api.patch(`/orders/${id}/cancel`);
    showToast('Order cancelled.', 'success');
    const params = new URLSearchParams(location.search);
    if (params.get('id')) await loadDetail(id);
    else await loadList();
    await refreshBadges();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function loadList(page = 1) {
  const list = document.getElementById('ordersList');
  const loading = document.getElementById('ordersLoading');
  list.classList.add('hidden');
  document.getElementById('orderDetail').classList.add('hidden');
  document.getElementById('ordersPager').classList.add('hidden');
  document.getElementById('ordersEmpty').classList.add('hidden');
  document.getElementById('ordersTitle').textContent = 'My orders';
  document.getElementById('ordersSubtitle').textContent = 'Track, manage and review your purchases';
  loading.classList.remove('hidden');

  try {
    const res = await api.get('/orders/my-orders', { page, limit: 10 });
    loading.classList.add('hidden');
    const orders = res.data || [];
    const pg = res.pagination || {};
    if (!orders.length) {
      document.getElementById('ordersEmpty').classList.remove('hidden');
      return;
    }
    list.innerHTML = orders.map(orderCard).join('');
    attachImgFallbacks(list);
    list.classList.remove('hidden');
    list.querySelectorAll('[data-cancel]').forEach((btn) =>
      btn.addEventListener('click', () => cancelOrder(btn.dataset.cancel))
    );

    if (pg.pages > 1) {
      const pager = document.getElementById('ordersPager');
      pager.innerHTML = `
        <button data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>‹</button>
        <button class="active">${page}</button>
        <button data-page="${page + 1}" ${page >= pg.pages ? 'disabled' : ''}>›</button>`;
      pager.classList.remove('hidden');
      pager.onclick = (e) => {
        const b = e.target.closest('[data-page]');
        if (b && !b.disabled) loadList(parseInt(b.dataset.page, 10));
      };
    }
  } catch (e) {
    loading.classList.add('hidden');
    showToast(e.message, 'error');
  }
}

async function loadDetail(id) {
  const box = document.getElementById('orderDetail');
  document.getElementById('ordersList').classList.add('hidden');
  document.getElementById('ordersEmpty').classList.add('hidden');
  document.getElementById('ordersPager').classList.add('hidden');
  document.getElementById('ordersLoading').classList.remove('hidden');

  try {
    const res = await api.get(`/orders/${id}`);
    const o = res.data;
    document.getElementById('ordersLoading').classList.add('hidden');
    document.getElementById('ordersTitle').textContent = `Order ${o.orderNumber}`;
    document.getElementById('ordersSubtitle').innerHTML =
      `<a href="/orders.html" class="btn-link">← Back to all orders</a>`;

    const stepIdx = FLOW.indexOf(o.orderStatus);
    const cancelled = o.orderStatus === 'Cancelled';
    const canCancel = o.orderStatus === 'Pending' || o.orderStatus === 'Confirmed';

    box.innerHTML = `
      <div class="panel">
        <div class="section-head">
          <div>
            <h3 style="margin:0">${esc(o.orderNumber)}</h3>
            <span class="text-sm muted">Placed ${new Date(o.createdAt).toLocaleString('en-IN')}</span>
          </div>
          <div style="display:flex;gap:.5rem">${statusBadge(o.orderStatus)} ${paymentBadge(o)}</div>
        </div>

        ${
          cancelled
            ? `<div class="alert alert-error" style="margin-top:1rem">This order was cancelled${o.statusHistory.find((h) => h.status === 'Cancelled') ? ' — ' + esc(o.statusHistory.find((h) => h.status === 'Cancelled').note || 'no reason given') : ''}.</div>`
            : `<div class="order-timeline">
                ${FLOW.map(
                  (s, i) =>
                    `<div class="timeline-step ${i <= stepIdx ? 'done' : ''} ${i === stepIdx ? 'current' : ''}">${s}</div>`
                ).join('')}
              </div>`
        }

        <div class="table-wrap" style="margin-top:1.2rem">
          <table class="data">
            <thead><tr><th>Product</th><th>Price</th><th>Qty</th><th style="text-align:right">Total</th></tr></thead>
            <tbody>
              ${o.items
                .map(
                  (i) => `
                <tr>
                  <td>
                    <div class="prod-cell">
                      <img src="${esc(i.image)}" alt="" />
                      <div><b>${esc(i.name)}</b><span>${esc((i.slug || '').replace(/-/g, ' '))}</span></div>
                    </div>
                  </td>
                  <td>${money(i.unitPrice)}${i.discountPrice ? `<br><span class="text-xs muted">MRP ${money(i.price)}</span>` : ''}</td>
                  <td>${i.quantity}</td>
                  <td style="text-align:right"><b>${money(i.lineTotal)}</b></td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="row" style="align-items:flex-start">
        <div class="panel" style="flex:1;min-width:250px">
          <h3>Delivery address</h3>
          <div class="text-sm"><b>${esc(o.shippingAddress.fullName)}</b></div>
          <div class="text-sm muted">${esc(o.shippingAddress.line1)}${o.shippingAddress.line2 ? ', ' + esc(o.shippingAddress.line2) : ''}<br/>${esc(o.shippingAddress.city)}, ${esc(o.shippingAddress.state)} — ${esc(o.shippingAddress.postalCode)}<br/>Phone: ${esc(o.shippingAddress.phone)}</div>
          ${o.shippingAddress.notes ? `<div class="text-sm muted" style="margin-top:.5rem">Note: ${esc(o.shippingAddress.notes)}</div>` : ''}
        </div>
        <div class="panel" style="flex:1;min-width:250px">
          <h3>Payment summary</h3>
          <div class="summary-row"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
          <div class="summary-row"><span>Shipping</span><span>${o.shippingFee === 0 ? 'FREE' : money(o.shippingFee)}</span></div>
          ${o.discount ? `<div class="summary-row"><span>Discount ${o.promoCode ? '(' + esc(o.promoCode) + ')' : ''}</span><span class="save">-${money(o.discount)}</span></div>` : ''}
          <div class="summary-row total"><span>Total</span><span>${money(o.total)}</span></div>
          <div class="text-sm muted" style="margin-top:.7rem">Method: ${o.paymentMethod === 'cod' ? 'Cash on delivery' : 'Sandbox test payment (demo only)'}</div>
          <div style="margin-top:.9rem;display:flex;gap:.6rem;flex-wrap:wrap">
            <a class="btn btn-outline btn-sm" href="/orders.html">All orders</a>
            ${canCancel ? `<button class="btn btn-danger btn-sm" data-cancel="${o._id}">Cancel order</button>` : ''}
          </div>
        </div>
      </div>

      <div class="panel">
        <h3>Status history</h3>
        ${o.statusHistory
          .map(
            (h) => `
          <div class="info-line" style="justify-content:space-between;border-bottom:1px dashed var(--border);padding:.5rem 0">
            <span>${statusBadge(h.status)} <span class="text-sm muted">${esc(h.note || '')}</span></span>
            <span class="text-sm muted">${new Date(h.at).toLocaleString('en-IN')} · by ${esc(h.by)}</span>
          </div>`
          )
          .join('')}
      </div>`;

    box.classList.remove('hidden');
    attachImgFallbacks(box);
    box.querySelector('[data-cancel]')?.addEventListener('click', () => cancelOrder(id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    document.getElementById('ordersLoading').classList.add('hidden');
    showToast(e.message, 'error');
    loadList();
  }
}

document.addEventListener('shopx:ready', () => {
  if (!Auth.isLoggedIn()) {
    document.getElementById('ordersGate').classList.remove('hidden');
    return;
  }

  const params = new URLSearchParams(location.search);
  if (params.get('placed') === '1') {
    const banner = document.getElementById('placedBanner');
    const no = params.get('no');
    banner.innerHTML = `<span>${icon('check', 17)}</span><span><b>Order placed successfully!</b>${no ? ` Your order number is <b>${esc(no)}</b>.` : ''} A confirmation is shown in your order history.</span>`;
    banner.classList.remove('hidden');
  }

  const id = params.get('id');
  if (id) loadDetail(id);
  else loadList();
});

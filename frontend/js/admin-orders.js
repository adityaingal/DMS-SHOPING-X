const FLOW = {
  Pending: ['Confirmed', 'Processing', 'Shipped', 'Cancelled'],
  Confirmed: ['Processing', 'Shipped', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

let orderState = { page: 1, search: '', status: '', payment: '' };

async function loadOrders() {
  const tbody = document.querySelector('#ordersTable tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center;padding:2rem">Loading…</td></tr>';
  try {
    const res = await api.get('/admin/orders', {
      page: orderState.page,
      limit: 10,
      search: orderState.search || undefined,
      status: orderState.status || undefined,
      payment: orderState.payment || undefined,
    });
    const orders = res.data;
    const pg = res.pagination;

    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center;padding:2rem">No orders match your filters.</td></tr>';
      document.getElementById('orderPager').innerHTML = '';
      return;
    }

    tbody.innerHTML = orders
      .map(
        (o) => `
      <tr>
        <td><b>${esc(o.orderNumber)}</b><br><span class="text-xs muted">${new Date(o.createdAt).toLocaleString('en-IN')}</span></td>
        <td>${esc(o.user ? o.user.name : o.shippingAddress.fullName)}<br><span class="text-xs muted">${esc(o.user ? o.user.email : o.shippingAddress.email || '')}</span></td>
        <td>${o.items.reduce((s, i) => s + i.quantity, 0)}</td>
        <td><b>${money(o.total)}</b></td>
        <td><span class="status-badge st-${o.paymentStatus}">${o.isSandboxPayment && o.paymentStatus === 'paid' ? 'Paid (sandbox)' : o.paymentStatus}</span><br><span class="text-xs muted">${o.paymentMethod === 'cod' ? 'COD' : 'Test'}</span></td>
        <td><span class="status-badge st-${String(o.orderStatus).toLowerCase()}">${esc(o.orderStatus)}</span></td>
        <td><button class="btn btn-sm btn-outline" data-view="${o._id}">View</button></td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll('[data-view]').forEach((btn) =>
      btn.addEventListener('click', () => openOrderModal(orders.find((o) => o._id === btn.dataset.view)))
    );

    const pager = document.getElementById('orderPager');
    if (pg.pages > 1) {
      const btns = [`<button data-p="${pg.page - 1}" ${pg.page === 1 ? 'disabled' : ''}>‹</button>`];
      for (let i = 1; i <= pg.pages; i++) {
        if (i === 1 || i === pg.pages || Math.abs(i - pg.page) <= 1)
          btns.push(`<button data-p="${i}" class="${i === pg.page ? 'active' : ''}">${i}</button>`);
        else if (btns[btns.length - 1] !== '<button disabled>…</button>') btns.push('<button disabled>…</button>');
      }
      btns.push(`<button data-p="${pg.page + 1}" ${pg.page >= pg.pages ? 'disabled' : ''}>›</button>`);
      pager.innerHTML = btns.join('');
      pager.onclick = (e) => {
        const b = e.target.closest('[data-p]');
        if (b && !b.disabled) {
          orderState.page = parseInt(b.dataset.p, 10);
          loadOrders();
        }
      };
    } else {
      pager.innerHTML = '';
    }
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">${esc(e.message)}</td></tr>`;
  }
}

function openOrderModal(order) {
  const nextStatuses = FLOW[order.orderStatus] || [];
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal modal-lg">
      <div class="modal-head">
        <div>
          <h3>${esc(order.orderNumber)}</h3>
          <span class="text-xs muted">${new Date(order.createdAt).toLocaleString('en-IN')}${order.isSample ? ' · sample data' : ''}</span>
        </div>
        <button class="btn-icon" data-close aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <div class="detail-list" style="margin-bottom:1rem">
          <div><span>Customer</span><b>${esc(order.user ? order.user.name : order.shippingAddress.fullName)}</b></div>
          <div><span>Email</span><b>${esc(order.user ? order.user.email : order.shippingAddress.email || '—')}</b></div>
          <div><span>Phone</span><b>${esc(order.shippingAddress.phone)}</b></div>
          <div><span>Ship to</span><b>${esc(order.shippingAddress.city)}, ${esc(order.shippingAddress.state)} ${esc(order.shippingAddress.postalCode)}</b></div>
        </div>

        <div class="table-wrap" style="margin-bottom:1rem">
          <table class="data">
            <thead><tr><th>Item</th><th>Unit</th><th>Qty</th><th style="text-align:right">Total</th></tr></thead>
            <tbody>
              ${order.items
                .map(
                  (i) => `
                <tr>
                  <td><div class="prod-cell"><img src="${esc(i.image)}" alt="" /><div><b>${esc(i.name)}</b></div></div></td>
                  <td>${money(i.unitPrice)}</td>
                  <td>${i.quantity}</td>
                  <td style="text-align:right"><b>${money(i.lineTotal)}</b></td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>

        <div class="summary-row"><span>Subtotal</span><span>${money(order.subtotal)}</span></div>
        <div class="summary-row"><span>Shipping</span><span>${order.shippingFee === 0 ? 'FREE' : money(order.shippingFee)}</span></div>
        ${order.discount ? `<div class="summary-row"><span>Discount</span><span class="save">-${money(order.discount)}</span></div>` : ''}
        <div class="summary-row total"><span>Total</span><span>${money(order.total)}</span></div>

        <div class="panel" style="margin-top:1rem;background:var(--surface-2)">
          <h3 style="font-size:.95rem">Update order</h3>
          <div class="form-grid">
            <div class="field">
              <label>Order status</label>
              <select class="select" id="mOrderStatus">
                <option value="">${esc(order.orderStatus)} (current)</option>
                ${nextStatuses.map((s) => `<option value="${s}">${s}</option>`).join('')}
              </select>
              ${!nextStatuses.length ? '<span class="field-hint">This order is in a final state.</span>' : ''}
            </div>
            <div class="field">
              <label>Payment status</label>
              <select class="select" id="mPaymentStatus">
                <option value="">${esc(order.paymentStatus)} (current)</option>
                ${['pending', 'paid', 'failed', 'refunded']
                  .filter((s) => s !== order.paymentStatus)
                  .map((s) => `<option value="${s}">${s}</option>`)
                  .join('')}
              </select>
            </div>
            <div class="field full">
              <label>Note (shown in customer status history)</label>
              <input class="input" id="mNote" placeholder="e.g. handed to courier" />
            </div>
          </div>
          <div class="alert alert-error hidden" id="orderModalError"></div>
          <button class="btn" id="saveOrderUpdate">Save update</button>
        </div>

        <div style="margin-top:1rem">
          <b class="text-sm">Status history</b>
          ${order.statusHistory
            .map(
              (h) => `
            <div class="info-line" style="justify-content:space-between;border-bottom:1px dashed var(--border);padding:.45rem 0">
              <span><span class="status-badge st-${String(h.status).toLowerCase()}">${esc(h.status)}</span> <span class="text-sm muted">${esc(h.note || '')}</span></span>
              <span class="text-xs muted">${new Date(h.at).toLocaleString('en-IN')} · ${esc(h.by)}</span>
            </div>`
            )
            .join('')}
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline" data-close>Close</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-close]')) {
      backdrop.remove();
      return;
    }
    if (e.target.id === 'saveOrderUpdate') {
      const orderStatus = backdrop.querySelector('#mOrderStatus').value;
      const paymentStatus = backdrop.querySelector('#mPaymentStatus').value;
      const note = backdrop.querySelector('#mNote').value.trim();
      if (!orderStatus && !paymentStatus) {
        showToast('Choose a status to update.', 'info');
        return;
      }
      const btn = e.target;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';
      api
        .patch(`/admin/orders/${order._id}`, {
          orderStatus: orderStatus || undefined,
          paymentStatus: paymentStatus || undefined,
          note,
        })
        .then(async () => {
          backdrop.remove();
          showToast('Order updated.', 'success');
          await loadOrders();
        })
        .catch((err) => {
          const errBox = backdrop.querySelector('#orderModalError');
          errBox.textContent = err.message;
          errBox.classList.remove('hidden');
          btn.disabled = false;
          btn.textContent = 'Save update';
        });
    }
  });
}

document.addEventListener('admin:ready', () => {
  loadOrders();

  document.getElementById('orderSearch').addEventListener(
    'input',
    debounce((e) => {
      orderState.search = e.target.value.trim();
      orderState.page = 1;
      loadOrders();
    }, 400)
  );
  document.getElementById('statusFilter').addEventListener('change', (e) => {
    orderState.status = e.target.value;
    orderState.page = 1;
    loadOrders();
  });
  document.getElementById('paymentFilter').addEventListener('change', (e) => {
    orderState.payment = e.target.value;
    orderState.page = 1;
    loadOrders();
  });

  const id = new URLSearchParams(location.search).get('id');
  if (id) {
    api
      .get(`/orders/${id}`)
      .then((res) => openOrderModal(res.data))
      .catch((e) => showToast(e.message, 'error'));
  }
});

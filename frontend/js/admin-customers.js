let custState = { page: 1, search: '' };

async function loadCustomers() {
  const tbody = document.querySelector('#customersTable tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:2rem">Loading…</td></tr>';
  try {
    const res = await api.get('/admin/customers', { page: custState.page, limit: 10, search: custState.search || undefined });
    const customers = res.data;
    const pg = res.pagination;

    if (!customers.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:2rem">No customers found.</td></tr>';
      document.getElementById('custPager').innerHTML = '';
      return;
    }

    tbody.innerHTML = customers
      .map(
        (c) => `
      <tr>
        <td><b>${esc(c.name)}</b><br><span class="text-xs muted">${esc(c.email)}</span></td>
        <td>${esc(c.phone || '—')}</td>
        <td class="text-sm">${new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
        <td>${c.orderCount}</td>
        <td><b>${money(c.totalSpent)}</b></td>
        <td><button class="btn btn-sm btn-outline" data-cust="${c._id}">Details</button></td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll('[data-cust]').forEach((btn) =>
      btn.addEventListener('click', () => openCustomer(customers.find((c) => c._id === btn.dataset.cust)))
    );

    const pager = document.getElementById('custPager');
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
          custState.page = parseInt(b.dataset.p, 10);
          loadCustomers();
        }
      };
    } else {
      pager.innerHTML = '';
    }
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">${esc(e.message)}</td></tr>`;
  }
}

async function openCustomer(customer) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal modal-lg">
      <div class="modal-head">
        <h3>${esc(customer.name)}</h3>
        <button class="btn-icon" data-close aria-label="Close">✕</button>
      </div>
      <div class="modal-body" id="custBody">
        <div class="loading-overlay"><span class="spinner dark"></span></div>
      </div>
      <div class="modal-foot"><button class="btn btn-outline" data-close>Close</button></div>
    </div>`;
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-close]')) backdrop.remove();
  });

  try {
    const res = await api.get(`/admin/customers/${customer._id}`);
    const { customer: c, orders } = res.data;
    backdrop.querySelector('#custBody').innerHTML = `
      <div class="detail-list" style="margin-bottom:1rem">
        <div><span>Email</span><b>${esc(c.email)}</b></div>
        <div><span>Phone</span><b>${esc(c.phone || '—')}</b></div>
        <div><span>Role</span><b>${esc(c.role)}</b></div>
        <div><span>Joined</span><b>${new Date(c.createdAt).toLocaleDateString('en-IN')}</b></div>
        <div><span>Status</span><b>${c.isActive ? 'Active' : 'Deactivated'}</b></div>
        <div><span>Addresses</span><b>${(c.addresses || []).length}</b></div>
      </div>

      <b class="text-sm">Order history (${orders.length})</b>
      ${
        orders.length
          ? `<div class="table-wrap" style="margin-top:.5rem">
              <table class="data">
                <thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>
                  ${orders
                    .map(
                      (o) => `
                    <tr>
                      <td><a href="/admin/orders.html?id=${o._id}"><b>${esc(o.orderNumber)}</b></a></td>
                      <td class="text-sm">${new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                      <td>${money(o.total)}</td>
                      <td><span class="status-badge st-${String(o.orderStatus).toLowerCase()}">${esc(o.orderStatus)}</span></td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
          : '<p class="muted text-sm">No orders yet.</p>'
      }`;
  } catch (e) {
    backdrop.querySelector('#custBody').innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
  }
}

document.addEventListener('admin:ready', () => {
  loadCustomers();
  document.getElementById('customerSearch').addEventListener(
    'input',
    debounce((e) => {
      custState.search = e.target.value.trim();
      custState.page = 1;
      loadCustomers();
    }, 400)
  );
});

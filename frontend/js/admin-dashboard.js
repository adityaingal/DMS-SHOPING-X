async function loadDashboard() {
  try {
    const res = await api.get('/admin/dashboard');
    const d = res.data;

    document.getElementById('dashDate').textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    document.getElementById('sCustomers').textContent = d.totals.customers.toLocaleString('en-IN');
    document.getElementById('sRevenue').textContent = money(d.totals.revenue);
    document.getElementById('sOrders').textContent = d.totals.orders.toLocaleString('en-IN');
    document.getElementById('sProducts').textContent = d.totals.products.toLocaleString('en-IN');

    const max = Math.max(...d.salesChart.map((c) => c.sales), 1);
    document.getElementById('salesChart').innerHTML = d.salesChart
      .map((c) => {
        const h = Math.max(Math.round((c.sales / max) * 100), 3);
        const day = new Date(c.date).toLocaleDateString('en-IN', { weekday: 'short' });
        return `
          <div class="chart-col" title="${c.date}: ${money(c.sales)} across ${c.orders} order(s)">
            <span class="amt">${c.sales > 0 ? Math.round(c.sales / 1000) + 'k' : '0'}</span>
            <div class="chart-bar" style="height:${h}%"></div>
            <span class="lbl">${day}</span>
          </div>`;
      })
      .join('');
    const weekSum = d.salesChart.reduce((s, c) => s + c.sales, 0);
    document.getElementById('weekTotal').textContent = `${money(weekSum)} this week`;

    const lowBox = document.getElementById('lowStockBox');
    if (!d.lowStock.length) {
      lowBox.innerHTML = '<p class="muted" style="margin:0">All products have healthy stock levels.</p>';
    } else {
      lowBox.innerHTML = d.lowStock
        .map((p) => {
          const cls = p.stock === 0 ? 'qty-out' : 'qty-low';
          const label = p.stock === 0 ? 'Out of stock' : `${p.stock} left`;
          return `
            <div class="low-stock-item">
              <span>${esc(p.name)}</span>
              <span class="qty-pill ${cls}">${label}</span>
            </div>`;
        })
        .join('');
    }

    const tbody = document.querySelector('#recentOrders tbody');
    tbody.innerHTML = d.recentOrders.length
      ? d.recentOrders
          .map(
            (o) => `
        <tr>
          <td><a href="/admin/orders.html?id=${o._id}"><b>${esc(o.orderNumber)}</b></a><br><span class="text-xs muted">${new Date(o.createdAt).toLocaleDateString('en-IN')}</span></td>
          <td>${esc(o.user ? o.user.name : '—')}<br><span class="text-xs muted">${esc(o.user ? o.user.email : '')}</span></td>
          <td><b>${money(o.total)}</b></td>
          <td><span class="status-badge st-${String(o.orderStatus).toLowerCase()}">${esc(o.orderStatus)}</span></td>
        </tr>`
          )
          .join('')
      : '<tr><td colspan="4" class="muted">No orders yet.</td></tr>';

    const statuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    document.getElementById('statusBreakdown').innerHTML = statuses
      .map((s) => {
        const count = d.byStatus[s] || 0;
        const pct = d.totals.orders ? Math.round((count / d.totals.orders) * 100) : 0;
        return `
          <div style="display:flex;align-items:center;gap:.7rem;margin-bottom:.6rem;font-size:.88rem">
            <span style="width:96px"><span class="status-badge st-${s.toLowerCase()}">${s}</span></span>
            <span style="flex:1;background:var(--border);height:8px;border-radius:99px;overflow:hidden">
              <span style="display:block;width:${pct}%;background:var(--primary);height:100%"></span>
            </span>
            <b style="width:32px;text-align:right">${count}</b>
          </div>`;
      })
      .join('');

    document.getElementById('dashLoading').classList.add('hidden');
    document.getElementById('dashContent').classList.remove('hidden');
  } catch (e) {
    document.getElementById('dashLoading').classList.add('hidden');
    showToast(e.message, 'error');
  }
}

document.addEventListener('admin:ready', loadDashboard);

const ADMIN_NAV = [
  { href: '/admin/index.html', label: 'Dashboard', ic: 'dashboard', key: 'dashboard' },
  { href: '/admin/products.html', label: 'Products', ic: 'package', key: 'products' },
  { href: '/admin/orders.html', label: 'Orders', ic: 'list', key: 'orders' },
  { href: '/admin/customers.html', label: 'Customers', ic: 'users', key: 'customers' },
  { href: '/admin/notifications.html', label: 'Notifications', ic: 'send', key: 'notifications' },
];

function requireAdmin() {
  if (!Auth.isLoggedIn() || !Auth.isAdmin()) {
    location.href = '/login.html?returnTo=' + encodeURIComponent(location.pathname + location.search);
    return false;
  }
  return true;
}

function renderAdminSidebar() {
  const el = document.getElementById('adminSidebar');
  if (!el) return;
  const key = document.body.dataset.adminPage || '';
  el.innerHTML = `
    <a class="brand" href="/admin/index.html">
      <span class="logo-mark" style="width:30px;height:30px">${icon('bag', 16)}</span>
      ShopX <span class="tag">Admin</span>
    </a>
    <nav class="admin-nav">
      <span class="sep">Overview</span>
      <a href="/admin/index.html" class="${key === 'dashboard' ? 'active' : ''}">${icon('dashboard', 18)} Dashboard</a>
      <span class="sep">Manage</span>
      ${ADMIN_NAV.slice(1)
        .map((n) => `<a href="${n.href}" class="${key === n.key ? 'active' : ''}">${icon(n.ic, 18)} ${n.label}</a>`)
        .join('')}
    </nav>
    <div class="foot">
      <a href="/index.html">${icon('bag', 15)} View storefront</a>
      <a href="#" id="adminLogout">${icon('logout', 15)} Log out (${esc((Auth.user && Auth.user.name) || 'Admin')})</a>
    </div>`;

  document.getElementById('adminLogout').addEventListener('click', async (e) => {
    e.preventDefault();
    await AuthAPI.logout();
    location.href = '/index.html';
  });

  const toggle = document.getElementById('adminMenuBtn');
  if (toggle) {
    toggle.addEventListener('click', () => el.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.admin-sidebar') && !e.target.closest('#adminMenuBtn')) el.classList.remove('open');
    });
  }
}

document.addEventListener('shopx:ready', () => {
  if (!requireAdmin()) return;
  renderAdminSidebar();
  document.dispatchEvent(new CustomEvent('admin:ready'));
});

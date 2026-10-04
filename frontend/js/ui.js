const ICON_PATHS = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  menu: '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2"/><circle cx="12" cy="12" r="3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  trending: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  rupee: '<path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3"/><path d="M9 13c6.667 0 6.667-10 0-10"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  card: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  chevronL: '<path d="m15 18-6-6 6-6"/>',
  chevronR: '<path d="m9 18 6-6-6-6"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
};

function icon(name, size = 20, cls = '') {
  const d = ICON_PATHS[name] || ICON_PATHS.info;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}" aria-hidden="true">${d}</svg>`;
}

const money = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const qs = (sel, root) => (root || document).querySelector(sel);
const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

const getParam = (k) => new URLSearchParams(location.search).get(k);

const setUrlParams = (obj, replace = true) => {
  const url = new URL(location.href);
  Object.entries(obj).forEach(([k, v]) => {
    if (v === '' || v === null || v === undefined) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  });
  history[replace ? 'replaceState' : 'pushState']({}, '', url);
};

const debounce = (fn, wait = 350) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

function starsHTML(rating, size = 13) {
  const r = Math.round(Number(rating) || 0);
  let out = '<span class="stars">';
  for (let i = 1; i <= 5; i++) out += `<span class="${i <= r ? '' : 'off'}">★</span>`;
  out += '</span>';
  return out;
}

function showToast(message, type = 'info', timeout = 3200) {
  let stack = qs('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.setAttribute('role', 'status');
  const iconName = type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info';
  t.innerHTML = `${icon(iconName, 17)}<span style="flex:1">${esc(message)}</span>`;
  const close = document.createElement('button');
  close.innerHTML = '×';
  close.setAttribute('aria-label', 'Close notification');
  close.onclick = () => t.remove();
  t.appendChild(close);
  stack.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity .3s';
    setTimeout(() => t.remove(), 300);
  }, timeout);
}

function confirmDialog(message, { title = 'Are you sure?', confirmText = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal modal-sm" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>${esc(title)}</h3></div>
        <div class="modal-body"><p class="mb-0" style="margin:0">${esc(message)}</p></div>
        <div class="modal-foot">
          <button class="btn btn-outline" data-act="cancel">Cancel</button>
          <button class="btn ${danger ? 'btn-danger' : ''}" data-act="ok">${esc(confirmText)}</button>
        </div>
      </div>`;
    const done = (val) => {
      wrap.remove();
      resolve(val);
    };
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) done(false);
      const act = e.target.closest('[data-act]');
      if (act) done(act.dataset.act === 'ok');
    });
    document.body.appendChild(wrap);
    qs('[data-act="ok"]', wrap).focus();
  });
}

const fallbackImage =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#eef2ff"/><g fill="none" stroke="#4f46e5" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"><path d="M140 150h120l-10 130H150z"/><path d="M170 150a30 30 0 0 1 60 0"/></g></svg>`
  );

function attachImgFallbacks(root) {
  qsa('img', root).forEach((img) => {
    if (img.dataset.fb) return;
    img.dataset.fb = '1';
    img.addEventListener('error', () => {
      if (img.src !== fallbackImage) img.src = fallbackImage;
    });
  });
}

function requireLogin(returnTo) {
  const target = returnTo || location.pathname + location.search;
  location.href = `/login.html?returnTo=${encodeURIComponent(target)}`;
  return false;
}

/* ---------- header & footer ---------- */
const SITE_NAV = [
  { href: '/index.html', label: 'Home', key: 'home' },
  { href: '/products.html', label: 'Shop All', key: 'shop' },
];

async function renderHeader() {
  const host = document.getElementById('site-header');
  if (!host) return;

  let categories = [];
  try {
    if (window.ShopXBoot && Array.isArray(window.ShopXBoot.categories)) {
      categories = window.ShopXBoot.categories;
    } else {
      const res = await api.get('/categories');
      categories = res.data || [];
    }
  } catch (e) {
    categories = [];
  }

  const page = document.body.dataset.page || '';
  const searchValue = getParam('q') || getParam('search') || '';
  const user = Auth.user;
  const avatarImg = user && user.avatar
    ? `<img class="avatar" src="${esc(user.avatar)}" alt="" referrerpolicy="no-referrer" loading="lazy" />`
    : '';
  const userGlyph = avatarImg || icon('user', 19);

  host.className = 'site-header';
  host.innerHTML = `
    <div class="container">
      <div class="header-main">
        <button class="btn-icon nav-toggle" id="navToggle" aria-label="Toggle menu">${icon('menu', 20)}</button>
        <a class="logo" href="/index.html" aria-label="ShopX home">
          <span class="logo-mark">${icon('bag', 18)}</span>Shop<span>X</span>
        </a>
        <form class="search-bar" id="headerSearch" role="search">
          <input class="input" type="search" name="q" value="${esc(searchValue)}" placeholder="Search for products, brands and categories" aria-label="Search products" />
          <button class="search-btn" type="submit" aria-label="Search">${icon('search', 18)}</button>
        </form>
        <div class="header-actions">
          <div class="account-menu">
            <button class="header-action" id="accountBtn" aria-haspopup="true" aria-expanded="false">
              ${userGlyph}<span class="lbl">${user ? esc(user.name.split(' ')[0]) : 'Account'}</span>
            </button>
            <div class="account-dropdown hidden" id="accountDropdown">
              ${
                user
                  ? `<div class="who">${avatarImg ? `<img class="avatar avatar-lg" src="${esc(user.avatar)}" alt="" referrerpolicy="no-referrer" />` : ''}
                     <span>Signed in as<br><b>${esc(user.name)}</b>${user.provider === 'google' ? ' · Google' : ''}</span></div>
                     <a href="/account.html">${icon('settings', 16)} My Account</a>
                     <a href="/orders.html">${icon('package', 16)} Orders</a>
                     <a href="/wishlist.html">${icon('heart', 16)} Wishlist</a>
                     ${user.role === 'admin' ? `<div class="divider"></div><a href="/admin/index.html">${icon('shield', 16)} Admin Dashboard</a>` : ''}
                     <div class="divider"></div>
                     <button id="logoutBtn">${icon('logout', 16)} Log out</button>`
                  : `<div class="who">Welcome to ShopX</div>
                     <a href="/login.html">${icon('user', 16)} Sign in</a>
                     <a href="/register.html">${icon('users', 16)} Create account</a>
                     <div class="divider"></div>
                     <a href="/orders.html">${icon('package', 16)} Track orders</a>`
              }
            </div>
          </div>
          <a class="header-action" href="/wishlist.html" aria-label="Wishlist">
            ${icon('heart', 19)}<span class="lbl">Wishlist</span>
            <span class="cart-badge hidden" id="wishBadge">0</span>
          </a>
          <a class="header-action" href="/cart.html" aria-label="Shopping cart">
            ${icon('cart', 19)}<span class="lbl">Cart</span>
            <span class="cart-badge hidden" id="cartBadge">0</span>
          </a>
        </div>
      </div>
      <div class="header-mobile-search">
        <form class="search-bar" id="headerSearchMobile" role="search" style="display:flex">
          <input class="input" type="search" name="q" value="${esc(searchValue)}" placeholder="Search products..." aria-label="Search products" />
          <button class="search-btn" type="submit" aria-label="Search">${icon('search', 18)}</button>
        </form>
      </div>
      <nav class="header-nav" id="headerNav" aria-label="Main navigation">
        ${SITE_NAV.map(
          (n) => `<a href="${n.href}" class="${page === n.key ? 'active' : ''}">${n.label}</a>`
        ).join('')}
        ${categories
          .slice(0, 5)
          .map(
            (c) =>
              `<a href="/products.html?category=${encodeURIComponent(c.slug)}" class="${getParam('category') === c.slug ? 'active' : ''}">${esc(c.name)}</a>`
          )
          .join('')}
        <a href="/products.html?sort=newest&onSale=true" class="${getParam('onSale') === 'true' ? 'active' : ''}">Deals</a>
      </nav>
    </div>`;

  qsa('form[id^="headerSearch"]', host).forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = qs('input[name="q"]', form).value.trim();
      const url = val ? `/products.html?q=${encodeURIComponent(val)}` : '/products.html';
      if (location.pathname.endsWith('/products.html')) {
        location.href = url;
      } else {
        location.href = url;
      }
    });
  });

  const navToggle = qs('#navToggle', host);
  navToggle.addEventListener('click', () => qs('#headerNav', host).classList.toggle('open'));

  const accountBtn = qs('#accountBtn', host);
  const dropdown = qs('#accountDropdown', host);
  accountBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
    accountBtn.setAttribute('aria-expanded', String(!dropdown.classList.contains('hidden')));
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.account-menu')) dropdown.classList.add('hidden');
  });

  const logoutBtn = qs('#logoutBtn', host);
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await AuthAPI.logout();
      showToast('You have been logged out.', 'success');
      setTimeout(() => (location.href = '/index.html'), 500);
    });
  }

  await refreshBadges();
}

function renderFooter() {
  const host = document.getElementById('site-footer');
  if (!host) return;
  host.className = 'site-footer';
  host.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <a class="logo" href="/index.html"><span class="logo-mark">${icon('bag', 18)}</span>Shop<span style="color:#a5b4fc">X</span></a>
          <p>Your modern online shopping destination for electronics, fashion, home and beauty — with fast delivery and honest prices.</p>
          <div class="footer-contact">${icon('phone', 16)} +91 90000 12345</div>
          <div class="footer-contact">${icon('mail', 16)} support@shopx.example</div>
          <div class="footer-contact">${icon('pin', 16)} 12 Tech Park, Bengaluru, India</div>
        </div>
        <div>
          <h4>Shop</h4>
          <a href="/products.html">All Products</a>
          <a href="/products.html?sort=newest">New Arrivals</a>
          <a href="/products.html?onSale=true">Deals & Offers</a>
          <a href="/products.html?sort=rating">Top Rated</a>
        </div>
        <div>
          <h4>Account</h4>
          <a href="/account.html">My Profile</a>
          <a href="/orders.html">Order History</a>
          <a href="/wishlist.html">Wishlist</a>
          <a href="/cart.html">Shopping Cart</a>
        </div>
        <div>
          <h4>Help</h4>
          <a href="/account.html">Shipping & Delivery</a>
          <a href="/account.html">Returns Policy</a>
          <a href="/register.html">Create Account</a>
          <a href="/admin/index.html">Admin Login</a>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} ShopX. Built as a full-stack e-commerce project. All sample data is fictional.</span>
        <div class="footer-pay"><span>UPI</span><span>COD</span><span>Visa</span><span>Mastercard</span></div>
      </div>
    </div>`;
}

async function refreshBadges() {
  const cartBadge = qs('#cartBadge');
  const wishBadge = qs('#wishBadge');
  if (Auth.isLoggedIn()) {
    try {
      const [cart, wish] = await Promise.all([api.get('/cart'), api.get('/wishlist')]);
      if (cartBadge) {
        cartBadge.textContent = cart.data.itemCount || 0;
        cartBadge.classList.toggle('hidden', !cart.data.itemCount);
      }
      if (wishBadge) {
        wishBadge.textContent = wish.data.count || 0;
        wishBadge.classList.toggle('hidden', !wish.data.count);
      }
      return;
    } catch (e) {
      /* fall through to guest cart */
    }
  }
  const guest = GuestCart.items();
  if (cartBadge) {
    const count = guest.reduce((s, i) => s + i.quantity, 0);
    cartBadge.textContent = count;
    cartBadge.classList.toggle('hidden', count === 0);
  }
  if (wishBadge) wishBadge.classList.add('hidden');
}

/* ---------- product card ---------- */
function productCardHTML(p) {
  const effective = p.discountPrice != null ? p.discountPrice : p.price;
  const discount = p.discountPrice != null ? Math.round(((p.price - p.discountPrice) / p.price) * 100) : 0;
  const img = (p.images && p.images[0]) || fallbackImage;
  const stockTag =
    p.stock <= 0
      ? '<span class="stock-tag out">Out of stock</span>'
      : p.stock <= 5
        ? `<span class="stock-tag low">Only ${p.stock} left</span>`
        : '<span class="stock-tag in">In stock</span>';
  return `
  <article class="product-card" data-id="${p._id}">
    <div class="product-thumb">
      ${discount > 0 ? `<span class="badge-discount">${discount}% off</span>` : ''}
      ${p.featured ? '<span class="badge-soft">Featured</span>' : ''}
      <a href="/product-details.html?slug=${encodeURIComponent(p.slug)}" aria-label="${esc(p.name)}">
        <img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy" />
      </a>
      <button class="wish-btn" data-wish="${p._id}" aria-label="Add to wishlist">${icon('heart', 17)}</button>
    </div>
    <div class="product-body">
      <span class="product-brand">${esc(p.brand)}</span>
      <a class="product-title" href="/product-details.html?slug=${encodeURIComponent(p.slug)}">${esc(p.name)}</a>
      <div class="rating-line">
        ${p.rating > 0 ? `<span class="rating-pill">${p.rating.toFixed(1)} ${icon('star', 11)}</span><span>(${p.reviewCount})</span>` : '<span class="muted">No reviews yet</span>'}
      </div>
      <div class="price-line">
        <span class="price">${money(effective)}</span>
        ${discount > 0 ? `<span class="price-old">${money(p.price)}</span>` : ''}
      </div>
      <div>${stockTag}</div>
      <button class="btn btn-block" data-add="${p._id}" ${p.stock <= 0 ? 'disabled' : ''}>
        ${p.stock <= 0 ? 'Out of stock' : `${icon('cart', 16)} Add to cart`}
      </button>
    </div>
  </article>`;
}

function skeletonCards(n = 8) {
  return Array.from({ length: n })
    .map(
      () => `
    <div class="skeleton-card">
      <div class="skeleton sk-img"></div>
      <div class="sk-body">
        <div class="skeleton sk-line w40"></div>
        <div class="skeleton sk-line w80"></div>
        <div class="skeleton sk-line w60"></div>
        <div class="skeleton sk-line" style="height:34px"></div>
      </div>
    </div>`
    )
    .join('');
}

function wireProductGrid(container) {
  if (!container) return;
  container.addEventListener('click', async (e) => {
    const addBtn = e.target.closest('[data-add]');
    const wishBtn = e.target.closest('[data-wish]');
    if (addBtn) {
      await CartStore.addItem(addBtn.dataset.add, 1, addBtn);
    }
    if (wishBtn) {
      await WishlistStore.toggle(wishBtn.dataset.wish, wishBtn);
    }
  });
}

function markWishlistButtons(container) {
  if (!Auth.isLoggedIn() || !container) return;
  api
    .get('/wishlist')
    .then((res) => {
      const ids = new Set((res.data.items || []).map((i) => i.product.id || i.product._id));
      qsa('[data-wish]', container).forEach((btn) => {
        if (ids.has(btn.dataset.wish)) btn.classList.add('active');
      });
    })
    .catch(() => {});
}

async function boot() {
  if (Auth.isLoggedIn()) await AuthAPI.refresh();
  renderFooter();
  await renderHeader();
  attachImgFallbacks(document);
}

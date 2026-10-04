const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:5000';
const CHROME =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SHOTS = path.resolve(__dirname, 'screenshots');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let step = 0;
const ok = (msg) => {
  step += 1;
  console.log(`  ${step}. PASS ${msg}`);
};
const fail = (msg) => {
  console.error(`  FAIL ${msg}`);
  throw new Error(msg);
};
const assert = (cond, msg) => (cond ? ok(msg) : fail(msg));

async function text(page, sel) {
  await page.waitForSelector(sel, { timeout: 15000 });
  return page.$eval(sel, (el) => el.textContent.trim());
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1400,900'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  await page.setViewport({ width: 1400, height: 900 });
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(String(e)));

  const stamp = Date.now();
  const customerEmail = `e2e-${stamp}@test.com`;

  console.log('\n=== ShopX browser E2E ===');

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.product-card');
  const homeCards = await page.$$eval('.product-card', (els) => els.length);
  const homeCats = await page.$$eval('.cat-tile', (els) => els.length);
  assert(homeCards >= 4, `home renders ${homeCards} product cards`);
  assert(homeCats >= 3, `home renders ${homeCats} category tiles`);
  await page.screenshot({ path: path.join(SHOTS, '01-home.png') });

  await page.type('#headerSearch input[name="q"]', 'headphones');
  await page.click('#headerSearch .search-btn');
  await page.waitForFunction(() => location.pathname.includes('products.html'));
  await page.waitForSelector('.product-card');
  const searchCards = await page.$$eval('.product-card', (els) => els.length);
  const searchTitle = await text(page, '#pageTitle');
  assert(searchCards >= 1, `search returns ${searchCards} results`);
  assert(searchTitle.toLowerCase().includes('headphone'), `search title is "${searchTitle}"`);
  await page.screenshot({ path: path.join(SHOTS, '02-search.png') });

  await page.click('.product-card .product-title');
  await page.waitForFunction(() => location.pathname.includes('product-details.html'));
  const pdpName = await text(page, '#pName');
  assert(pdpName.length > 3, `product details loaded: "${pdpName.slice(0, 40)}…"`);
  await page.screenshot({ path: path.join(SHOTS, '03-product-details.png') });

  await page.click('#addToCartBtn');
  await sleep(700);
  const guestNote = await page.$eval('#guestNote', (el) => el.classList.contains('hidden')).catch(() => true);
  await page.goto(`${BASE}/cart.html`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.cart-item, #cartEmpty');
  const hasCartItem = await page.$('.cart-item') !== null;
  assert(hasCartItem, 'guest cart shows the added item');
  await page.screenshot({ path: path.join(SHOTS, '04-cart-guest.png') });

  await page.goto(`${BASE}/register.html`, { waitUntil: 'networkidle2' });
  await page.type('#name', 'E2E Shopper');
  await page.type('#email', customerEmail);
  await page.type('#password', 'Testing@123');
  await page.type('#confirmPassword', 'Testing@123');
  await page.click('#terms');
  await page.click('#registerBtn');
  await page.waitForFunction(() => location.pathname === '/index.html', { timeout: 20000 });
  ok(`registered ${customerEmail} and landed on home`);

  await sleep(1200);
  const badge = await page.$eval('#cartBadge', (el) => ({ n: el.textContent, hidden: el.classList.contains('hidden') }));
  assert(!badge.hidden && Number(badge.n) >= 1, `guest cart merged into account (badge = ${badge.n})`);

  await page.goto(`${BASE}/checkout.html`, { waitUntil: 'networkidle2' });
  try {
    await page.waitForSelector('#checkoutLayout:not(.hidden)', { timeout: 15000 });
  } catch (e) {
    const diag = await page.evaluate(() => ({
      url: location.href,
      token: Boolean(localStorage.getItem('shopx_token')),
      guestCart: localStorage.getItem('shopx_guest_cart'),
      body: document.body.innerText.slice(0, 300),
    }));
    await page.screenshot({ path: path.join(SHOTS, 'debug-checkout.png') });
    fail(`checkout layout not shown: ${JSON.stringify(diag)}`);
  }
  await page.click('#newAddrOption input');
  await page.type('#fullName', 'E2E Shopper');
  await page.type('#phone', '9876501234');
  await page.type('#line1', '99 Test Avenue, Layout');
  await page.type('#city', 'Bengaluru');
  await page.type('#state', 'Karnataka');
  await page.type('#postalCode', '560103');
  await page.screenshot({ path: path.join(SHOTS, '05-checkout.png') });
  await page.click('#placeOrder');
  await page.waitForFunction(() => location.pathname.includes('orders.html') && location.search.includes('placed=1'), {
    timeout: 25000,
  });
  await page.waitForSelector('#placedBanner:not(.hidden)');
  const banner = await text(page, '#placedBanner');
  assert(/order placed successfully/i.test(banner), 'order confirmation banner shown');
  const orderNo = (banner.match(/SHX-[A-Z0-9]+/) || [''])[0];
  assert(orderNo.length > 4, `order number generated: ${orderNo}`);
  await sleep(500);
  await page.screenshot({ path: path.join(SHOTS, '06-order-confirmation.png') });

  const customerStatus = await text(page, '.status-badge');
  assert(customerStatus === 'Confirmed', `customer sees status "${customerStatus}"`);

  await page.goto(`${BASE}/orders.html`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.order-card');
  const ordersCount = await page.$$eval('.order-card', (els) => els.length);
  assert(ordersCount >= 1, `order history lists ${ordersCount} order(s)`);

  await page.click('#accountBtn');
  await page.waitForSelector('#logoutBtn');
  await page.click('#logoutBtn');
  await page.waitForFunction(() => location.pathname === '/index.html', { timeout: 15000 });
  ok('customer logged out');

  await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle2' });
  await page.type('#email', 'admin@shopx.com');
  await page.type('#password', 'Admin@123');
  await page.click('#loginBtn');
  await page.waitForFunction(() => location.pathname.startsWith('/admin/'), { timeout: 20000 });
  await page.waitForSelector('#dashContent:not(.hidden)');
  const revenue = await text(page, '#sRevenue');
  assert(revenue.startsWith('₹'), `admin dashboard loaded (revenue ${revenue})`);
  await page.screenshot({ path: path.join(SHOTS, '07-admin-dashboard.png') });

  await page.goto(`${BASE}/admin/orders.html`, { waitUntil: 'networkidle2' });
  await page.type('#orderSearch', orderNo);
  await sleep(1000);
  await page.waitForSelector('[data-view]');
  await page.click('[data-view]');
  await page.waitForSelector('#mOrderStatus');
  await page.select('#mOrderStatus', 'Processing');
  await page.click('#saveOrderUpdate');
  await sleep(1200);
  await page.click('[data-view]');
  await page.waitForSelector('#mOrderStatus');
  await page.select('#mOrderStatus', 'Shipped');
  await page.click('#saveOrderUpdate');
  await sleep(1200);
  await page.click('[data-view]');
  await page.waitForSelector('#mOrderStatus');
  await page.select('#mOrderStatus', 'Delivered');
  await page.click('#saveOrderUpdate');
  await sleep(1200);
  ok('admin advanced order: Confirmed → Processing → Shipped → Delivered');
  await page.screenshot({ path: path.join(SHOTS, '08-admin-orders.png') });

  await page.goto(`${BASE}/admin/notifications.html`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#notifContent:not(.hidden)');
  const notifRows = await page.$$eval('#eventsTable tbody tr', (els) => els.length);
  assert(notifRows >= 8, `notification settings render ${notifRows} event rows`);
  const historyText = await page.$eval('#historyTable tbody', (el) => el.textContent.trim());
  assert(historyText.length > 0, 'notification history table rendered');
  await page.screenshot({ path: path.join(SHOTS, '08b-admin-notifications.png') });

  await page.goto(`${BASE}/admin/orders.html`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-view]');
  await page.waitForFunction(() => !document.querySelector('.modal-backdrop'));
  await page.click('#adminLogout');
  await page.waitForFunction(() => location.pathname === '/index.html', { timeout: 15000 });

  await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle2' });
  await page.type('#email', customerEmail);
  await page.type('#password', 'Testing@123');
  await page.click('#loginBtn');
  await page.waitForFunction(() => location.pathname === '/index.html', { timeout: 20000 });
  await page.goto(`${BASE}/orders.html`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.order-card');
  await page.click('.order-card a[href*="id="]');
  await page.waitForSelector('.status-badge');
  const finalStatus = await text(page, '.status-badge');
  assert(finalStatus === 'Delivered', `customer sees updated status "${finalStatus}"`);
  await page.screenshot({ path: path.join(SHOTS, '09-customer-order-delivered.png') });

  await page.goto(`${BASE}/products.html?category=electronics&sort=price_asc`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.product-card');
  await page.screenshot({ path: path.join(SHOTS, '10-products-filtered.png') });

  const mobile = await browser.newPage();
  await mobile.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await mobile.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await mobile.waitForSelector('.product-card');
  await mobile.screenshot({ path: path.join(SHOTS, '11-mobile-home.png') });
  await mobile.goto(`${BASE}/products.html`, { waitUntil: 'networkidle2' });
  await mobile.waitForSelector('.product-card');
  await mobile.screenshot({ path: path.join(SHOTS, '12-mobile-products.png') });
  ok('mobile viewport renders (390×844)');
  await mobile.close();

  const relevantErrors = jsErrors.filter((e) => !/ResizeObserver|favicon/i.test(e));
  assert(relevantErrors.length === 0, `no JavaScript page errors${relevantErrors.length ? `: ${relevantErrors.join(' | ')}` : ''}`);

  await browser.close();
  console.log('\nALL BROWSER E2E CHECKS PASSED\n');
}

main().catch(async (err) => {
  console.error(`\nE2E FAILED: ${err.message}\n`);
  process.exit(1);
});

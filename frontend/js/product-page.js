let product = null;
let reviewPage = 1;

function showMissing(msg) {
  qs('#pdpLoading').classList.add('hidden');
  qs('#pdpContent').classList.add('hidden');
  qs('#pdpError').classList.remove('hidden');
  if (msg) qs('#pdpErrorMsg').textContent = msg;
}

function renderProduct() {
  const p = product;
  const effective = p.discountPrice != null ? p.discountPrice : p.price;
  const discount = p.discountPrice != null ? Math.round(((p.price - p.discountPrice) / p.price) * 100) : 0;
  const images = (p.images && p.images.length ? p.images : [fallbackImage]);

  document.title = `${p.name} — ShopX`;
  qs('#crumbs').innerHTML = `
    <a href="/index.html">Home</a>
    <span><a href="/products.html?category=${encodeURIComponent(p.category)}">${esc(p.category.replace(/-/g, ' '))}</a></span>
    <span>${esc(p.name)}</span>`;

  qs('#pBrand').textContent = p.brand;
  qs('#pName').textContent = p.name;
  qs('#pMeta').innerHTML = `
    ${p.rating > 0 ? `${starsHTML(p.rating)} <b>${p.rating.toFixed(1)}</b> <span>· ${p.reviewCount} review${p.reviewCount === 1 ? '' : 's'}</span>` : '<span>No reviews yet</span>'}
    <span>·</span><span>SKU ${esc(p._id.slice(-8).toUpperCase())}</span>`;

  qs('#pPrice').innerHTML = `
    <span class="price">${money(effective)}</span>
    ${discount > 0 ? `<span class="price-old">${money(p.price)}</span><span class="save-tag">Save ${discount}%</span>` : ''}`;

  qs('#stockLine').innerHTML =
    p.stock <= 0
      ? '<span class="stock-tag out">● Out of stock</span>'
      : p.stock <= 5
        ? `<span class="stock-tag low">● Only ${p.stock} left — order soon</span>`
        : '<span class="stock-tag in">● In stock and ready to ship</span>';

  qs('#pDesc').textContent = p.description;
  qs('#fullDescription').textContent = p.description;

  const mainImg = qs('#mainImage');
  mainImg.src = images[0];
  mainImg.alt = p.name;
  attachImgFallbacks(qs('#pdpContent'));

  qs('#thumbs').innerHTML = images
    .map(
      (src, i) =>
        `<button class="${i === 0 ? 'active' : ''}" data-img="${esc(src)}" aria-label="View image ${i + 1}"><img src="${esc(src)}" alt="" /></button>`
    )
    .join('');

  const addBtn = qs('#addToCartBtn');
  addBtn.disabled = p.stock <= 0;
  if (p.stock <= 0) addBtn.innerHTML = 'Out of stock';

  const maxQty = Math.min(p.stock, 99) || 1;
  qs('#qtyInput').max = maxQty;
  if (Number(qs('#qtyInput').value) > maxQty) qs('#qtyInput').value = maxQty;
}

function setupGallery() {
  qs('#thumbs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-img]');
    if (!btn) return;
    qs('#mainImage').src = btn.dataset.img;
    qsa('#thumbs button').forEach((b) => b.classList.toggle('active', b === btn));
  });
}

function setupQty() {
  const input = qs('#qtyInput');
  const clamp = () => {
    let v = parseInt(input.value, 10) || 1;
    const max = Math.min(product.stock, 99) || 1;
    v = Math.max(1, Math.min(v, max));
    input.value = v;
    return v;
  };
  qs('#qtyMinus').addEventListener('click', () => {
    input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1);
  });
  qs('#qtyPlus').addEventListener('click', () => {
    const max = Math.min(product.stock, 99) || 1;
    input.value = Math.min((parseInt(input.value, 10) || 1) + 1, max);
  });
  input.addEventListener('change', clamp);
}

function setupActions() {
  qs('#addToCartBtn').addEventListener('click', async (e) => {
    const qty = parseInt(qs('#qtyInput').value, 10) || 1;
    await CartStore.addItem(product._id, qty, e.currentTarget);
  });

  const wishBtn = qs('#wishBtn');
  wishBtn.addEventListener('click', async () => {
    await WishlistStore.toggle(product._id, wishBtn);
  });

  if (Auth.isLoggedIn()) {
    api
      .get('/wishlist')
      .then((res) => {
        const ids = (res.data.items || []).map((i) => i.product.id || i.product._id);
        if (ids.includes(product._id)) wishBtn.classList.add('active');
      })
      .catch(() => {});
  }

  qsa('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      qsa('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
      qsa('.tab-panel').forEach((panel) =>
        panel.classList.toggle('active', panel.id === `tab-${btn.dataset.tab}`)
      );
    });
  });
}

function reviewFormHTML() {
  if (!Auth.isLoggedIn()) {
    return `
      <div class="alert alert-info">
        <span>${icon('info', 16)}</span>
        <span><a href="/login.html?returnTo=${encodeURIComponent(location.pathname + location.search)}">Sign in</a> to write a review. Only customers who purchased this product can review it.</span>
      </div>`;
  }
  return `
    <form id="reviewForm" class="panel" style="background:var(--surface-2);margin-bottom:1rem">
      <h3 style="font-size:1rem">Write a review</h3>
      <div class="field">
        <label>Your rating</label>
        <div id="starPicker" style="font-size:1.6rem;color:#d1d5db;cursor:pointer;user-select:none" role="radiogroup" aria-label="Rating">
          ${[1, 2, 3, 4, 5].map((n) => `<span data-star="${n}" style="padding-right:.15rem">★</span>`).join('')}
        </div>
        <input type="hidden" id="ratingValue" value="0" />
      </div>
      <div class="field">
        <label for="reviewComment">Your review</label>
        <textarea class="input" id="reviewComment" rows="3" maxlength="1000" placeholder="Share your experience with this product…"></textarea>
      </div>
      <div id="reviewFormError"></div>
      <button class="btn" type="submit">Submit review</button>
    </form>`;
}

function wireReviewForm() {
  const form = qs('#reviewForm');
  if (!form) return;
  const picker = qs('#starPicker');
  const setStars = (n) => {
    qs('#ratingValue').value = n;
    qsa('[data-star]', picker).forEach((s) => {
      s.style.color = Number(s.dataset.star) <= n ? '#f59e0b' : '#d1d5db';
    });
  };
  picker.addEventListener('click', (e) => {
    const star = e.target.closest('[data-star]');
    if (star) setStars(Number(star.dataset.star));
  });
  picker.addEventListener('mouseover', (e) => {
    const star = e.target.closest('[data-star]');
    if (star) {
      qsa('[data-star]', picker).forEach((s) => {
        s.style.color = Number(s.dataset.star) <= Number(star.dataset.star) ? '#f59e0b' : '#d1d5db';
      });
    }
  });
  picker.addEventListener('mouseleave', () => setStars(Number(qs('#ratingValue').value)));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rating = Number(qs('#ratingValue').value);
    const comment = qs('#reviewComment').value.trim();
    const errBox = qs('#reviewFormError');
    errBox.innerHTML = '';
    if (!rating) {
      errBox.innerHTML = '<div class="alert alert-error">Please select a star rating.</div>';
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await api.post(`/products/${product._id}/reviews`, { rating, comment });
      showToast('Review published. Thank you!', 'success');
      reviewPage = 1;
      await loadReviews(true);
    } catch (err) {
      errBox.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    } finally {
      btn.disabled = false;
    }
  });
}

async function loadReviews(reset = false) {
  if (reset) reviewPage = 1;
  const list = qs('#reviewList');
  if (reset) list.innerHTML = '<div class="loading-overlay"><span class="spinner dark"></span></div>';
  try {
    const res = await api.get(`/products/${product._id}/reviews`, { page: reviewPage, limit: 5 });
    const reviews = res.data || [];
    const stats = res.stats || [];
    const pg = res.pagination || { total: 0 };

    qs('#reviewTabCount').textContent = `(${pg.total})`;
    qs('#reviewSummary').innerHTML = `
      <div style="text-align:center">
        <div class="big-score">${product.rating ? product.rating.toFixed(1) : '—'}</div>
        ${starsHTML(product.rating)}
        <div class="text-xs muted">${pg.total} review${pg.total === 1 ? '' : 's'}</div>
      </div>
      <div style="flex:1;min-width:200px">
        ${[5, 4, 3, 2, 1]
          .map((n) => {
            const found = stats.find((s) => Number(s.rating) === n);
            const pct = pg.total ? Math.round((found ? found.count : 0) / pg.total * 100) : 0;
            return `
            <div style="display:flex;align-items:center;gap:.6rem;font-size:.8rem;margin-bottom:.3rem">
              <span style="width:46px;color:var(--muted)">${n} star</span>
              <span style="flex:1;background:var(--border);height:7px;border-radius:99px;overflow:hidden">
                <span style="display:block;width:${pct}%;background:var(--accent);height:100%"></span>
              </span>
              <span style="width:32px;text-align:right" class="muted">${found ? found.count : 0}</span>
            </div>`;
          })
          .join('')}
      </div>`;

    if (!reviews.length && reviewPage === 1) {
      list.innerHTML = '<p class="muted" style="margin:0">No reviews yet. Be the first to share your experience.</p>';
      qs('#reviewMore').innerHTML = '';
      return;
    }

    const html = reviews
      .map(
        (r) => `
      <article class="review-item">
        <div class="review-head">
          <span class="review-author">${esc(r.user ? r.user.name : 'Customer')}</span>
          <span class="text-xs muted">${new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
        <div style="margin:.3rem 0">${starsHTML(r.rating)}</div>
        ${r.comment ? `<p class="text-sm" style="margin:0;color:var(--text-2)">${esc(r.comment)}</p>` : ''}
      </article>`
      )
      .join('');

    if (reset) list.innerHTML = html;
    else list.insertAdjacentHTML('beforeend', html);

    qs('#reviewMore').innerHTML =
      pg.page < pg.pages
        ? `<button class="btn btn-outline" id="moreReviews">Load more reviews</button>`
        : '';
    const more = qs('#moreReviews');
    if (more) {
      more.addEventListener('click', () => {
        reviewPage += 1;
        loadReviews();
      });
    }
  } catch (e) {
    list.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
  }
}

async function loadRelated() {
  const grid = qs('#relatedGrid');
  grid.innerHTML = skeletonCards(4);
  try {
    const res = await api.get(`/products/${product._id}/related`);
    const items = res.data || [];
    if (!items.length) {
      grid.innerHTML = '';
      return;
    }
    grid.innerHTML = items.map(productCardHTML).join('');
    attachImgFallbacks(grid);
    wireProductGrid(grid);
    markWishlistButtons(grid);
  } catch (e) {
    grid.innerHTML = '';
  }
}

async function initProduct() {
  const slug = getParam('slug');
  const id = getParam('id');
  if (!slug && !id) return showMissing('No product selected.');

  try {
    const res = slug ? await api.get(`/products/slug/${encodeURIComponent(slug)}`) : await api.get(`/products/${id}`);
    product = res.data;
    qs('#pdpLoading').classList.add('hidden');
    qs('#pdpContent').classList.remove('hidden');
    renderProduct();
    setupGallery();
    setupQty();
    setupActions();
    qs('#reviewFormWrap').innerHTML = reviewFormHTML();
    wireReviewForm();
    loadReviews(true);
    loadRelated();
  } catch (e) {
    showMissing(e.message);
  }
}

document.addEventListener('shopx:ready', initProduct);

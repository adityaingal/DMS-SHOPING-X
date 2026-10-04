async function loadCategories() {
  const grid = document.getElementById('categoryGrid');
  grid.innerHTML = Array.from({ length: 5 }).map(() => '<div class="skeleton" style="height:154px"></div>').join('');
  try {
    const res = window.ShopXBoot && Array.isArray(window.ShopXBoot.categories)
      ? { data: window.ShopXBoot.categories }
      : await api.get('/categories');
    const cats = res.data || [];
    if (!cats.length) {
      grid.innerHTML = '<p class="muted">No categories yet.</p>';
      return;
    }
    grid.innerHTML = cats
      .map(
        (c) => `
      <a class="cat-tile" href="/products.html?category=${encodeURIComponent(c.slug)}">
        <img src="${esc(c.image || '')}" alt="${esc(c.name)}" loading="lazy" />
        <div class="cat-body">
          <div class="cat-name">${esc(c.name)}</div>
          <div class="cat-count">${c.productCount || 0} products</div>
        </div>
      </a>`
      )
      .join('');
    attachImgFallbacks(grid);
  } catch (e) {
    grid.innerHTML = '';
    showToast('Could not load categories.', 'error');
  }
}

async function loadProductSection(gridId, query) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = skeletonCards(4);
  try {
    const res = await api.get('/products', { ...query, limit: 4 });
    const products = res.data || [];
    if (!products.length) {
      grid.innerHTML = '';
      return;
    }
    grid.innerHTML = products.map(productCardHTML).join('');
    attachImgFallbacks(grid);
    wireProductGrid(grid);
    markWishlistButtons(grid);
  } catch (e) {
    grid.innerHTML = `<p class="muted">Could not load products. ${esc(e.message)}</p>`;
  }
}

document.addEventListener('shopx:ready', () => {
  loadCategories();
  loadProductSection('featuredGrid', { featured: 'true' });
  loadProductSection('trendingGrid', { sort: 'rating' });
  loadProductSection('dealsGrid', { onSale: 'true', sort: 'price_asc' });
  loadProductSection('newGrid', { sort: 'newest' });

  const form = document.getElementById('newsletterForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const email = input.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      showToast('Please enter a valid email address.', 'error');
      input.focus();
      return;
    }
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      const res = await api.post('/newsletter', { email });
      showToast(res.data.message || 'Subscribed successfully!', 'success');
      input.value = '';
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Subscribe';
    }
  });
});

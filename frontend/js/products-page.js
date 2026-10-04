const state = {
  q: getParam('q') || '',
  category: getParam('category') || '',
  brand: getParam('brand') || '',
  minPrice: getParam('minPrice') || '',
  maxPrice: getParam('maxPrice') || '',
  inStock: getParam('inStock') === 'true',
  featured: getParam('featured') === 'true',
  onSale: getParam('onSale') === 'true',
  sort: getParam('sort') || 'newest',
  page: parseInt(getParam('page'), 10) || 1,
};

let categoryList = [];

function syncUrl() {
  const params = new URLSearchParams();
  Object.entries(state).forEach(([k, v]) => {
    if (v === '' || v === false || v === null || v === undefined) return;
    if (k === 'page' && v === 1) return;
    params.set(k, v);
  });
  const qsStr = params.toString();
  history.replaceState({}, '', location.pathname + (qsStr ? '?' + qsStr : ''));
}

function buildQuery() {
  return {
    search: state.q || undefined,
    category: state.category || undefined,
    brand: state.brand || undefined,
    minPrice: state.minPrice || undefined,
    maxPrice: state.maxPrice || undefined,
    inStock: state.inStock ? 'true' : undefined,
    featured: state.featured ? 'true' : undefined,
    onSale: state.onSale ? 'true' : undefined,
    sort: state.sort,
    page: state.page,
    limit: 12,
  };
}

async function loadFilters() {
  try {
    const catsPromise = window.ShopXBoot && Array.isArray(window.ShopXBoot.categories)
      ? Promise.resolve({ data: window.ShopXBoot.categories })
      : api.get('/categories');
    const [catsRes, metaRes] = await Promise.all([catsPromise, api.get('/products/meta')]);
    categoryList = catsRes.data || [];
    const brands = metaRes.data.brands || [];

    const catBox = document.getElementById('categoryFilters');
    catBox.innerHTML = [
      `<label class="checkbox-line"><input type="radio" name="cat" value="" ${state.category ? '' : 'checked'} /> All categories</label>`,
      ...categoryList.map(
        (c) =>
          `<label class="checkbox-line"><input type="radio" name="cat" value="${esc(c.slug)}" ${state.category === c.slug ? 'checked' : ''} /> ${esc(c.name)} <span class="muted">(${c.productCount || 0})</span></label>`
      ),
    ].join('');

    const brandBox = document.getElementById('brandFilters');
    brandBox.innerHTML =
      `<label class="checkbox-line"><input type="checkbox" name="brand" value="" ${state.brand ? '' : 'checked'} data-all /> All brands</label>` +
      brands
        .map(
          (b) =>
            `<label class="checkbox-line"><input type="checkbox" name="brand" value="${esc(b)}" ${state.brand === b ? 'checked' : ''} /> ${esc(b)}</label>`
        )
        .join('');

    catBox.onchange = (e) => {
      state.category = e.target.value;
      state.page = 1;
      refresh();
    };
    brandBox.onchange = (e) => {
      const all = e.target.hasAttribute('data-all');
      if (all) {
        state.brand = '';
        qsa('input[name="brand"]', brandBox).forEach((i) => {
          if (!i.hasAttribute('data-all')) i.checked = false;
        });
      } else {
        state.brand = e.target.checked ? e.target.value : '';
        const allInput = qs('[data-all]', brandBox);
        if (allInput) allInput.checked = !state.brand;
        qsa('input[name="brand"]', brandBox).forEach((i) => {
          if (!i.hasAttribute('data-all') && i.value !== state.brand) i.checked = false;
        });
      }
      state.page = 1;
      refresh();
    };
  } catch (e) {
    showToast('Could not load filter options.', 'error');
  }
}

function renderChips() {
  const box = document.getElementById('activeChips');
  const chips = [];
  if (state.q) chips.push(['q', `Search: “${state.q}”`]);
  if (state.category) {
    const c = categoryList.find((x) => x.slug === state.category);
    chips.push(['category', `Category: ${c ? c.name : state.category}`]);
  }
  if (state.brand) chips.push(['brand', `Brand: ${state.brand}`]);
  if (state.minPrice) chips.push(['minPrice', `Min ₹${state.minPrice}`]);
  if (state.maxPrice) chips.push(['maxPrice', `Max ₹${state.maxPrice}`]);
  if (state.inStock) chips.push(['inStock', 'In stock']);
  if (state.featured) chips.push(['featured', 'Featured']);
  if (state.onSale) chips.push(['onSale', 'On sale']);

  box.innerHTML = chips
    .map(
      ([key, label]) =>
        `<span class="chip">${esc(label)}<button type="button" data-clear="${key}" aria-label="Remove filter">×</button></span>`
    )
    .join('');
}

function clearOne(key) {
  if (key === 'q') state.q = '';
  else if (key === 'inStock' || key === 'featured' || key === 'onSale') state[key] = false;
  else state[key] = '';
  state.page = 1;
  syncControls();
  refresh();
}

function syncControls() {
  const minEl = document.getElementById('minPrice');
  const maxEl = document.getElementById('maxPrice');
  minEl.value = state.minPrice;
  maxEl.value = state.maxPrice;
  document.getElementById('inStockOnly').checked = state.inStock;
  document.getElementById('featuredOnly').checked = state.featured;
  document.getElementById('saleOnly').checked = state.onSale;
  document.getElementById('sortSelect').value = state.sort;
  qsa('input[name="cat"]').forEach((i) => (i.checked = i.value === state.category));
  qsa('input[name="brand"]').forEach((i) => {
    if (i.hasAttribute('data-all')) i.checked = !state.brand;
    else i.checked = i.value === state.brand;
  });
}

function renderPagination(total, pages) {
  const box = document.getElementById('pagination');
  if (pages <= 1) {
    box.innerHTML = '';
    return;
  }
  const buttons = [];
  buttons.push(`<button data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>`);
  const range = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - state.page) <= 1) range.push(i);
    else if (range[range.length - 1] !== '…') range.push('…');
  }
  range.forEach((i) => {
    if (i === '…') buttons.push(`<button disabled>…</button>`);
    else
      buttons.push(
        `<button data-page="${i}" class="${i === state.page ? 'active' : ''}" aria-label="Page ${i}">${i}</button>`
      );
  });
  buttons.push(`<button data-page="${state.page + 1}" ${state.page === pages ? 'disabled' : ''} aria-label="Next page">›</button>`);
  box.innerHTML = buttons.join('');
}

function renderHeadings(total) {
  const titleEl = document.getElementById('pageTitle');
  const subEl = document.getElementById('pageSubtitle');
  const crumb = document.getElementById('crumbCurrent');
  let title = 'All products';
  let subtitle = 'Browse our complete catalogue';
  if (state.q) {
    title = `Results for “${state.q}”`;
    subtitle = `${total} matching product${total === 1 ? '' : 's'}`;
  } else if (state.category) {
    const c = categoryList.find((x) => x.slug === state.category);
    title = c ? c.name : state.category;
    subtitle = `${total} product${total === 1 ? '' : 's'} in this category`;
  } else if (state.onSale) {
    title = 'Deals & offers';
    subtitle = `${total} discounted product${total === 1 ? '' : 's'}`;
  } else if (state.featured) {
    title = 'Featured products';
    subtitle = `${total} handpicked product${total === 1 ? '' : 's'}`;
  } else {
    subtitle = `${total} product${total === 1 ? '' : 's'} available`;
  }
  titleEl.textContent = title;
  subEl.textContent = subtitle;
  crumb.textContent = title;
  document.title = `${title} — ShopX`;
}

async function refresh() {
  syncUrl();
  renderChips();
  const grid = document.getElementById('productGrid');
  const empty = document.getElementById('emptyState');
  const countEl = document.getElementById('resultsCount');
  grid.innerHTML = skeletonCards(8);
  empty.classList.add('hidden');
  countEl.textContent = 'Loading products…';

  try {
    const res = await api.get('/products', buildQuery());
    const products = res.data || [];
    const pg = res.pagination || { total: 0, pages: 1, page: 1 };
    renderHeadings(pg.total);
    countEl.innerHTML = `<b>${pg.total}</b> product${pg.total === 1 ? '' : 's'} found`;

    if (!products.length) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      document.getElementById('emptyMsg').textContent = state.q
        ? `We could not find anything matching “${state.q}”. Try another keyword or clear filters.`
        : 'No products match the selected filters. Try removing some of them.';
      renderPagination(0, 1);
      return;
    }

    grid.innerHTML = products.map(productCardHTML).join('');
    attachImgFallbacks(grid);
    wireProductGrid(grid);
    markWishlistButtons(grid);
    renderPagination(pg.total, pg.pages);
  } catch (e) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    document.getElementById('emptyMsg').textContent = e.message;
    countEl.textContent = 'Failed to load products';
  }
}

document.addEventListener('shopx:ready', () => {
  syncControls();
  loadFilters().then(refresh);

  document.getElementById('activeChips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-clear]');
    if (btn) clearOne(btn.dataset.clear);
  });

  document.getElementById('sortSelect').addEventListener('change', (e) => {
    state.sort = e.target.value;
    state.page = 1;
    refresh();
  });

  document.getElementById('applyPrice').addEventListener('click', () => {
    const min = document.getElementById('minPrice').value;
    const max = document.getElementById('maxPrice').value;
    if (min && max && Number(min) > Number(max)) {
      showToast('Minimum price cannot exceed maximum price.', 'error');
      return;
    }
    state.minPrice = min;
    state.maxPrice = max;
    state.page = 1;
    refresh();
  });

  ['minPrice', 'maxPrice'].forEach((id) => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('applyPrice').click();
    });
  });

  document.getElementById('inStockOnly').addEventListener('change', (e) => {
    state.inStock = e.target.checked;
    state.page = 1;
    refresh();
  });
  document.getElementById('featuredOnly').addEventListener('change', (e) => {
    state.featured = e.target.checked;
    state.page = 1;
    refresh();
  });
  document.getElementById('saleOnly').addEventListener('change', (e) => {
    state.onSale = e.target.checked;
    state.page = 1;
    refresh();
  });

  const clearAll = () => {
    state.q = '';
    state.category = '';
    state.brand = '';
    state.minPrice = '';
    state.maxPrice = '';
    state.inStock = false;
    state.featured = false;
    state.onSale = false;
    state.page = 1;
    syncControls();
    refresh();
  };
  document.getElementById('clearFilters').addEventListener('click', clearAll);
  document.getElementById('emptyClear').addEventListener('click', clearAll);

  document.getElementById('pagination').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    state.page = parseInt(btn.dataset.page, 10);
    refresh();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  const panel = document.getElementById('filtersPanel');
  document.getElementById('openFilters').addEventListener('click', () => {
    panel.classList.add('open');
    const backdrop = document.createElement('div');
    backdrop.className = 'filters-backdrop';
    backdrop.id = 'filtersBackdrop';
    backdrop.addEventListener('click', () => {
      panel.classList.remove('open');
      backdrop.remove();
    });
    document.body.appendChild(backdrop);
  });
  panel.addEventListener('click', (e) => {
    if (e.target.closest('label') && window.innerWidth <= 768) {
      setTimeout(() => {
        panel.classList.remove('open');
        const bd = document.getElementById('filtersBackdrop');
        if (bd) bd.remove();
      }, 300);
    }
  });
});

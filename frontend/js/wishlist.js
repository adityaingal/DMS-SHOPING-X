function wishCard(item) {
  const p = item.product;
  const effective = p.discountPrice != null ? p.discountPrice : p.price;
  const discount = p.discountPrice != null ? Math.round(((p.price - p.discountPrice) / p.price) * 100) : 0;
  return `
    <article class="product-card" data-id="${p.id}">
      <div class="product-thumb">
        ${discount > 0 ? `<span class="badge-discount">${discount}% off</span>` : ''}
        <a href="/product-details.html?slug=${encodeURIComponent(p.slug)}"><img src="${esc(p.image || (p.images && p.images[0]) || '')}" alt="${esc(p.name)}" loading="lazy" /></a>
        <button class="wish-btn active" data-remove="${p.id}" aria-label="Remove from wishlist">${icon('heart', 17)}</button>
      </div>
      <div class="product-body">
        <span class="product-brand">${esc(p.brand)}</span>
        <a class="product-title" href="/product-details.html?slug=${encodeURIComponent(p.slug)}">${esc(p.name)}</a>
        <div class="price-line">
          <span class="price">${money(effective)}</span>
          ${discount > 0 ? `<span class="price-old">${money(p.price)}</span>` : ''}
        </div>
        <div>${p.stock <= 0 ? '<span class="stock-tag out">Out of stock</span>' : p.stock <= 5 ? `<span class="stock-tag low">Only ${p.stock} left</span>` : '<span class="stock-tag in">In stock</span>'}</div>
        <div style="display:flex;gap:.5rem;margin-top:.5rem">
          <button class="btn btn-sm" style="flex:1" data-move="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>Move to cart</button>
          <button class="btn btn-sm btn-outline" data-drop="${p.id}" aria-label="Remove">Remove</button>
        </div>
      </div>
    </article>`;
}

async function loadWishlist() {
  const loading = document.getElementById('wishLoading');
  const grid = document.getElementById('wishGrid');
  loading.classList.remove('hidden');

  try {
    const res = await api.get('/wishlist');
    loading.classList.add('hidden');
    const items = res.data.items || [];
    if (!items.length) {
      document.getElementById('wishEmpty').classList.remove('hidden');
      return;
    }
    grid.innerHTML = items.map(wishCard).join('');
    attachImgFallbacks(grid);
    grid.classList.remove('hidden');

    grid.querySelectorAll('[data-remove], [data-drop]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const id = btn.dataset.remove || btn.dataset.drop;
        await WishlistStore.toggle(id, null);
        showToast('Removed from wishlist.', 'info');
        await loadWishlist();
        await refreshBadges();
      })
    );

    grid.querySelectorAll('[data-move]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const id = btn.dataset.move;
        await CartStore.addItem(id, 1, btn);
        await WishlistStore.toggle(id, null);
        await loadWishlist();
        await refreshBadges();
      })
    );
  } catch (e) {
    loading.classList.add('hidden');
    if (e.status === 401) document.getElementById('wishGate').classList.remove('hidden');
    else showToast(e.message, 'error');
  }
}

document.addEventListener('shopx:ready', () => {
  if (!Auth.isLoggedIn()) {
    document.getElementById('wishGate').classList.remove('hidden');
    return;
  }
  loadWishlist();
});

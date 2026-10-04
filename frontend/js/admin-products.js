let prodState = { page: 1, search: '', category: '', stock: '' };
let categoriesCache = [];

async function loadProducts() {
  const tbody = document.querySelector('#productsTable tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:2rem">Loading…</td></tr>';
  try {
    const res = await api.get('/admin/products', {
      page: prodState.page,
      limit: 10,
      search: prodState.search || undefined,
      category: prodState.category || undefined,
      stock: prodState.stock || undefined,
    });
    const products = res.data;
    const pg = res.pagination;

    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:2rem">No products match your filters.</td></tr>';
      document.getElementById('prodPager').innerHTML = '';
      return;
    }

    tbody.innerHTML = products
      .map((p) => {
        const eff = p.discountPrice != null ? p.discountPrice : p.price;
        const stockCls = p.stock === 0 ? 'qty-out' : p.stock <= 5 ? 'qty-low' : 'qty-ok';
        return `
        <tr>
          <td>
            <div class="prod-cell">
              <img src="${esc(p.images[0] || '')}" alt="" />
              <div><b>${esc(p.name)}</b><span>${esc(p.brand)} · ${esc(p.category)}${p.isSample ? ' · sample' : ''}</span></div>
            </div>
          </td>
          <td><b>${money(eff)}</b>${p.discountPrice ? `<br><span class="text-xs muted line-through">${money(p.price)}</span>` : ''}</td>
          <td><span class="qty-pill ${stockCls}">${p.stock}</span></td>
          <td><span class="admin-badge"><span class="dot ${p.featured ? 'on' : 'off'}"></span>${p.featured ? 'Yes' : 'No'}</span></td>
          <td>${p.rating ? `${p.rating.toFixed(1)} ★ <span class="text-xs muted">(${p.reviewCount})</span>` : '<span class="muted">—</span>'}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-sm btn-outline" data-edit="${p._id}">Edit</button>
              <button class="btn btn-sm btn-danger" data-del="${p._id}" data-name="${esc(p.name)}">Delete</button>
            </div>
          </td>
        </tr>`;
      })
      .join('');

    tbody.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => openProductModal(products.find((p) => p._id === btn.dataset.edit)))
    );
    tbody.querySelectorAll('[data-del]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        if (!(await confirmDialog(`Delete "${btn.dataset.name}"? This cannot be undone.`, { confirmText: 'Delete', danger: true })))
          return;
        try {
          await api.del(`/admin/products/${btn.dataset.del}`);
          showToast('Product deleted.', 'success');
          loadProducts();
        } catch (e) {
          showToast(e.message, 'error');
        }
      })
    );

    const pager = document.getElementById('prodPager');
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
          prodState.page = parseInt(b.dataset.p, 10);
          loadProducts();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      };
    } else {
      pager.innerHTML = '';
    }
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">${esc(e.message)}</td></tr>`;
  }
}

async function loadCategories() {
  try {
    const [pubRes, adminRes] = await Promise.all([api.get('/categories'), api.get('/admin/categories')]);
    categoriesCache = adminRes.data;
    const options = (pubRes.data || [])
      .map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`)
      .join('');
    document.getElementById('categoryFilter').innerHTML = '<option value="">All categories</option>' + options;

    document.getElementById('catBody').innerHTML = (adminRes.data || [])
      .map(
        (c) => `
      <tr>
        <td><b>${esc(c.name)}</b> <span class="admin-badge"><span class="dot ${c.isActive ? 'on' : 'off'}"></span></span></td>
        <td><code class="text-xs">${esc(c.slug)}</code></td>
        <td class="muted text-sm">${esc(c.description || '—')}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-sm btn-outline" data-cedit="${c._id}">Edit</button>
            <button class="btn btn-sm btn-danger" data-cdel="${c._id}" data-cname="${esc(c.name)}">Delete</button>
          </div>
        </td>
      </tr>`
      )
      .join('');

    document.querySelectorAll('[data-cedit]').forEach((btn) =>
      btn.addEventListener('click', () => openCategoryModal(categoriesCache.find((c) => c._id === btn.dataset.cedit)))
    );
    document.querySelectorAll('[data-cdel]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        if (!(await confirmDialog(`Delete category "${btn.dataset.cname}"? Products using it must be reassigned first.`, { confirmText: 'Delete', danger: true })))
          return;
        try {
          await api.del(`/admin/categories/${btn.dataset.cdel}`);
          showToast('Category deleted.', 'success');
          loadCategories();
        } catch (e) {
          showToast(e.message, 'error');
        }
      })
    );
  } catch (e) {
    showToast('Could not load categories: ' + e.message, 'error');
  }
}

function openProductModal(product) {
  const isEdit = !!product;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <form class="modal modal-lg" id="productForm">
      <div class="modal-head">
        <h3>${isEdit ? 'Edit product' : 'New product'}</h3>
        <button class="btn-icon" type="button" data-close aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field full"><label>Product name *</label><input class="input" name="name" required value="${esc(product ? product.name : '')}" /></div>
          <div class="field"><label>Brand *</label><input class="input" name="brand" required value="${esc(product ? product.brand : '')}" /></div>
          <div class="field">
            <label>Category *</label>
            <select class="select" name="category" required>
              <option value="">Select category</option>
              ${categoriesCache.map((c) => `<option value="${esc(c.name)}" ${product && product.category === c.slug ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Price (₹) *</label><input class="input" type="number" name="price" min="0" step="1" required value="${product ? product.price : ''}" /></div>
          <div class="field"><label>Discount price (₹)</label><input class="input" type="number" name="discountPrice" min="0" step="1" value="${product && product.discountPrice != null ? product.discountPrice : ''}" placeholder="Leave empty for no discount" /></div>
          <div class="field"><label>Stock quantity *</label><input class="input" type="number" name="stock" min="0" step="1" required value="${product ? product.stock : 0}" /></div>
          <div class="field" style="display:flex;align-items:flex-end;padding-bottom:1rem">
            <label class="checkbox-line"><input type="checkbox" name="featured" ${product && product.featured ? 'checked' : ''} /> Featured product</label>
          </div>
          <div class="field full"><label>Description *</label><textarea class="input" name="description" rows="4" required>${esc(product ? product.description : '')}</textarea></div>
          <div class="field full">
            <label>Image URLs <span class="muted" style="font-weight:400">(one per line or comma separated)</span></label>
            <textarea class="input" name="images" rows="2" placeholder="https://example.com/image.jpg">${esc(product ? product.images.join('\n') : '')}</textarea>
            <div class="img-previews" id="imgPreviews"></div>
          </div>
          <div class="field full">
            <label>Or upload image files <span class="muted" style="font-weight:400">(JPEG/PNG/WEBP, max 5MB each)</span></label>
            <input class="input" type="file" name="imageFiles" accept="image/*" multiple />
          </div>
        </div>
        <div class="alert alert-error hidden" id="prodFormError"></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline" type="button" data-close>Cancel</button>
        <button class="btn" type="submit" id="saveProduct">${isEdit ? 'Save changes' : 'Create product'}</button>
      </div>
    </form>`;

  document.body.appendChild(backdrop);
  const form = backdrop.querySelector('#productForm');
  const errBox = backdrop.querySelector('#prodFormError');

  const renderPreviews = () => {
    const urls = form.images.value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    backdrop.querySelector('#imgPreviews').innerHTML = urls
      .map((u, i) => `<span class="pv"><img src="${esc(u)}" alt="" data-i="${i}" /></span>`)
      .join('');
  };
  form.images.addEventListener('input', renderPreviews);
  renderPreviews();

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-close]')) backdrop.remove();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.add('hidden');
    const fd = new FormData(form);
    if (!fd.get('name') || !fd.get('brand') || !fd.get('category') || !fd.get('description')) {
      errBox.textContent = 'Please fill in all required fields.';
      errBox.classList.remove('hidden');
      return;
    }
    const price = Number(fd.get('price'));
    const dp = fd.get('discountPrice') ? Number(fd.get('discountPrice')) : null;
    if (dp && dp >= price) {
      errBox.textContent = 'Discount price must be lower than the price.';
      errBox.classList.remove('hidden');
      return;
    }

    const btn = backdrop.querySelector('#saveProduct');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      if (isEdit) await api.patch(`/admin/products/${product._id}`, fd);
      else await api.post('/admin/products', fd);
      backdrop.remove();
      showToast(isEdit ? 'Product updated.' : 'Product created.', 'success');
      loadProducts();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = isEdit ? 'Save changes' : 'Create product';
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
    }
  });
}

function openCategoryModal(category) {
  const isEdit = !!category;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <form class="modal modal-sm" id="categoryForm">
      <div class="modal-head">
        <h3>${isEdit ? 'Edit category' : 'New category'}</h3>
        <button class="btn-icon" type="button" data-close aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Name *</label><input class="input" name="name" required value="${esc(category ? category.name : '')}" /></div>
        <div class="field"><label>Description</label><textarea class="input" name="description" rows="2">${esc(category ? category.description || '' : '')}</textarea></div>
        <div class="field"><label>Image URL</label><input class="input" name="image" value="${esc(category ? category.image || '' : '')}" /></div>
        ${isEdit ? `<label class="checkbox-line"><input type="checkbox" name="isActive" ${category.isActive ? 'checked' : ''} /> Active (visible in store)</label>` : ''}
        <div class="alert alert-error hidden" id="catError"></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline" type="button" data-close>Cancel</button>
        <button class="btn" type="submit">${isEdit ? 'Save' : 'Create'}</button>
      </div>
    </form>`;

  document.body.appendChild(backdrop);
  const form = backdrop.querySelector('#categoryForm');
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-close]')) backdrop.remove();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.value.trim(),
      description: form.description.value.trim(),
      image: form.image.value.trim(),
    };
    if (form.isActive) payload.isActive = form.isActive.checked;
    if (!payload.name) return;
    try {
      if (isEdit) await api.patch(`/admin/categories/${category._id}`, payload);
      else await api.post('/admin/categories', payload);
      backdrop.remove();
      showToast(isEdit ? 'Category updated.' : 'Category created.', 'success');
      loadCategories();
    } catch (err) {
      const errBox = backdrop.querySelector('#catError');
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
    }
  });
}

document.addEventListener('admin:ready', () => {
  loadCategories().then(loadProducts);

  document.getElementById('newProductBtn').addEventListener('click', () => openProductModal(null));

  document.getElementById('searchInput').addEventListener(
    'input',
    debounce((e) => {
      prodState.search = e.target.value.trim();
      prodState.page = 1;
      loadProducts();
    }, 400)
  );
  document.getElementById('categoryFilter').addEventListener('change', (e) => {
    prodState.category = e.target.value;
    prodState.page = 1;
    loadProducts();
  });
  document.getElementById('stockFilter').addEventListener('change', (e) => {
    prodState.stock = e.target.value;
    prodState.page = 1;
    loadProducts();
  });
  document.getElementById('newCategoryBtn').addEventListener('click', () => openCategoryModal(null));

  const params = new URLSearchParams(location.search);
  if (params.get('stock')) {
    prodState.stock = params.get('stock');
    document.getElementById('stockFilter').value = prodState.stock;
  }
});

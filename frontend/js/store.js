const GUEST_CART_KEY = 'shopx_guest_cart';

const GuestCart = {
  read() {
    try {
      return JSON.parse(localStorage.getItem(GUEST_CART_KEY)) || [];
    } catch (e) {
      return [];
    }
  },
  write(items) {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('shopx:cart'));
  },
  items() {
    return this.read();
  },
  count() {
    return this.read().reduce((s, i) => s + i.quantity, 0);
  },
  add(product, quantity = 1) {
    const items = this.read();
    const existing = items.find((i) => i.id === product._id);
    const stock = product.stock ?? 99;
    if (existing) existing.quantity = Math.min(existing.quantity + quantity, stock, 99);
    else
      items.push({
        id: product._id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        discountPrice: product.discountPrice ?? null,
        image: (product.images && product.images[0]) || '',
        brand: product.brand,
        stock,
        quantity: Math.min(quantity, stock, 99),
      });
    this.write(items);
  },
  setQty(id, quantity) {
    let items = this.read();
    const it = items.find((i) => i.id === id);
    if (!it) return;
    if (quantity <= 0) items = items.filter((i) => i.id !== id);
    else it.quantity = Math.min(quantity, it.stock, 99);
    this.write(items);
  },
  remove(id) {
    this.write(this.read().filter((i) => i.id !== id));
  },
  clear() {
    this.write([]);
  },
  totals() {
    const items = this.read();
    const subtotal = items.reduce(
      (s, i) => s + (i.discountPrice != null ? i.discountPrice : i.price) * i.quantity,
      0
    );
    const shipping = subtotal === 0 || subtotal >= 999 ? 0 : 49;
    return {
      items,
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
      subtotal: Number(subtotal.toFixed(2)),
      shippingFee: shipping,
      total: Number((subtotal + shipping).toFixed(2)),
    };
  },
};

const CartStore = {
  async addItem(productId, quantity = 1, btn) {
    if (!Auth.isLoggedIn()) {
      try {
        const res = await api.get(`/products/${productId}`);
        GuestCart.add(res.data, quantity);
        showToast('Added to your cart (guest). Log in to save it permanently.', 'success');
        refreshBadges();
        window.dispatchEvent(new CustomEvent('shopx:cart'));
        return;
      } catch (e) {
        showToast(e.message, 'error');
        return;
      }
    }
    if (btn) {
      btn.disabled = true;
      const old = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span>';
      try {
        await api.post('/cart/items', { productId, quantity });
        showToast('Added to cart.', 'success');
        await refreshBadges();
        window.dispatchEvent(new CustomEvent('shopx:cart'));
      } catch (e) {
        showToast(e.message, 'error');
        btn.disabled = false;
        btn.innerHTML = old;
        return;
      }
      btn.disabled = false;
      btn.innerHTML = old;
      return;
    }
    try {
      await api.post('/cart/items', { productId, quantity });
      showToast('Added to cart.', 'success');
      await refreshBadges();
      window.dispatchEvent(new CustomEvent('shopx:cart'));
    } catch (e) {
      showToast(e.message, 'error');
    }
  },

  async syncGuestCart() {
    const guest = GuestCart.items();
    if (!Auth.isLoggedIn() || !guest.length) return;
    try {
      await api.post('/cart/merge', {
        items: guest.map((i) => ({ product: i.id, quantity: i.quantity })),
      });
      GuestCart.clear();
      await refreshBadges();
    } catch (e) {
      /* keep guest cart if merge fails */
    }
  },
};

const WishlistStore = {
  async toggle(productId, btn) {
    if (!Auth.isLoggedIn()) {
      requireLogin();
      return;
    }
    const active = btn && btn.classList.contains('active');
    try {
      if (active) {
        await api.del(`/wishlist/items/${productId}`);
        if (btn) btn.classList.remove('active');
        showToast('Removed from wishlist.', 'info');
      } else {
        await api.post('/wishlist/items', { productId });
        if (btn) btn.classList.add('active');
        showToast('Saved to wishlist.', 'success');
      }
      await refreshBadges();
      window.dispatchEvent(new CustomEvent('shopx:wishlist'));
    } catch (e) {
      if (e.status === 409) {
        if (btn) btn.classList.add('active');
        showToast('Already in your wishlist.', 'info');
        return;
      }
      showToast(e.message, 'error');
    }
  },
};

document.addEventListener('DOMContentLoaded', () => {
  boot().then(() => {
    document.dispatchEvent(new CustomEvent('shopx:ready'));
  });
});

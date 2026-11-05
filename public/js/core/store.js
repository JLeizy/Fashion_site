// Глобальное состояние клиента: пользователь, счётчики шапки, корзина, избранное, сравнение.
// Гость: корзина и сравнение — в localStorage (после входа переносятся в БД: /api/cart/merge, /api/compare/merge).
import api, { ApiError } from './api.js';
import { storage } from './dom.js';
import { t } from './i18n.js';

const bus = new EventTarget();

export const store = {
  user: null,
  counts: { cart: 0, wishlist: 0, compare: 0, notifications: 0 },
  wishlistIds: new Set(),
  compareIds: [],
  on(type, fn) {
    const handler = (e) => fn(e.detail);
    bus.addEventListener(type, handler);
    return () => bus.removeEventListener(type, handler);
  },
  emit(type, detail) {
    bus.dispatchEvent(new CustomEvent(type, { detail }));
  },
};

export const isAuth = () => Boolean(store.user);
export const hasRole = (...roles) => Boolean(store.user) && (store.user.role === 'owner' || roles.includes(store.user.role));

export function setCount(name, value) {
  const changed = store.counts[name] !== value;
  store.counts[name] = value;
  if (changed) store.emit('counts', { name, value });
}

// Требуется вход: app.js показывает модальное окно входа
// Гость пытается выполнить действие для вошедших: показываем окно входа/регистрации.
// После входа при покупке возвращаем сразу на оформление (/checkout), в остальных случаях — на текущую страницу.
export function requireAuth(reason = 'default', next) {
  const target = next || (reason === 'checkout' ? '/checkout' : location.pathname + location.search);
  store.emit('auth:required', { reason, next: target });
}

// ---------- Гостевое хранилище ----------
const CART_KEY = 'amf:cart';
const COMPARE_KEY = 'amf:compare';
export const guestCart = {
  get: () => (Array.isArray(storage(CART_KEY)) ? storage(CART_KEY) : []),
  set: (items) => storage(CART_KEY, items),
  clear: () => storage(CART_KEY, null),
};
export const guestCompare = {
  get: () => (Array.isArray(storage(COMPARE_KEY)) ? storage(COMPARE_KEY) : []),
  set: (ids) => storage(COMPARE_KEY, ids),
  clear: () => storage(COMPARE_KEY, null),
};

// ---------- Корзина ----------
export const cart = {
  data: null,
  async load() {
    this.data = isAuth() ? await api.get('/cart') : await api.post('/cart/preview', { items: guestCart.get() });
    setCount('cart', this.data.count);
    store.emit('cart:change', this.data);
    return this.data;
  },
  async add(variantId, quantity = 1) {
    if (isAuth()) {
      this.data = await api.post('/cart/items', { variantId, quantity });
    } else {
      const items = guestCart.get();
      const existing = items.find((i) => i.variantId === variantId);
      const nextQty = (existing?.quantity || 0) + quantity;
      // Проверка остатка для гостя — через тот же сервер
      const preview = await api.post('/cart/preview', { items: [{ variantId, quantity: nextQty }] });
      const info = preview.items[0];
      if (!info || !info.isAvailable) throw new ApiError(409, t('cart.outOfStock'));
      if (nextQty > info.available) throw new ApiError(409, t('cart.notEnough', { n: info.available }));
      if (existing) existing.quantity = nextQty;
      else items.unshift({ variantId, quantity });
      guestCart.set(items);
      this.data = await api.post('/cart/preview', { items });
    }
    setCount('cart', this.data.count);
    store.emit('cart:change', this.data);
    store.emit('cart:added', { variantId, quantity });
    return this.data;
  },
  async update(item, { quantity, variantId } = {}) {
    if (isAuth()) {
      this.data = await api.patch(`/cart/items/${item.id}`, { quantity, variantId });
    } else {
      let items = guestCart.get();
      const target = variantId || item.variantId;
      const qty = quantity || item.quantity;
      const preview = await api.post('/cart/preview', { items: [{ variantId: target, quantity: qty }] });
      const info = preview.items[0];
      if (!info || qty > info.available) throw new ApiError(409, t('cart.notEnough', { n: info?.available ?? 0 }));
      if (variantId && variantId !== item.variantId) {
        items = items.filter((i) => i.variantId !== item.variantId);
        const same = items.find((i) => i.variantId === variantId);
        if (same) same.quantity = Math.min(same.quantity + qty, info.available);
        else items.unshift({ variantId, quantity: qty });
      } else {
        items = items.map((i) => (i.variantId === item.variantId ? { ...i, quantity: qty } : i));
      }
      guestCart.set(items);
      this.data = await api.post('/cart/preview', { items });
    }
    setCount('cart', this.data.count);
    store.emit('cart:change', this.data);
    return this.data;
  },
  async remove(item) {
    if (isAuth()) this.data = await api.del(`/cart/items/${item.id}`);
    else {
      const items = guestCart.get().filter((i) => i.variantId !== item.variantId);
      guestCart.set(items);
      this.data = await api.post('/cart/preview', { items });
    }
    setCount('cart', this.data.count);
    store.emit('cart:change', this.data);
    return this.data;
  },
  // Вернуть позицию после удаления (кнопка «Отменить» в течение 5 секунд)
  async restore(item) {
    return this.add(item.variantId, item.quantity);
  },
};

// ---------- Избранное (только для авторизованных) ----------
export const wishlist = {
  has: (productId) => store.wishlistIds.has(productId),
  async toggle(productId) {
    if (!isAuth()) {
      requireAuth('wishlist');
      return null;
    }
    const active = !store.wishlistIds.has(productId);
    const result = active ? await api.post('/wishlist', { productId }) : await api.del(`/wishlist/${productId}`);
    if (active) store.wishlistIds.add(productId);
    else store.wishlistIds.delete(productId);
    setCount('wishlist', result.count);
    store.emit('wishlist:change', { productId, active });
    return active;
  },
};

// ---------- Сравнение (до 4 товаров) ----------
export const MAX_COMPARE = 4;
export const compare = {
  has: (productId) => store.compareIds.includes(productId),
  ids: () => [...store.compareIds],
  setIds(ids) {
    store.compareIds = ids;
    setCount('compare', ids.length);
    store.emit('compare:change', { ids });
  },
  async add(productId) {
    if (store.compareIds.includes(productId)) return true;
    if (store.compareIds.length >= MAX_COMPARE) throw new ApiError(409, t('compare.limit', { max: MAX_COMPARE }), null, 'COMPARE_LIMIT');
    if (isAuth()) this.setIds((await api.post('/compare', { productId })).ids);
    else {
      const ids = [...guestCompare.get().filter((id) => id !== productId), productId].slice(-MAX_COMPARE);
      guestCompare.set(ids);
      this.setIds(ids);
    }
    return true;
  },
  async remove(productId) {
    if (isAuth()) this.setIds((await api.del(`/compare/${productId}`)).ids);
    else {
      const ids = guestCompare.get().filter((id) => id !== productId);
      guestCompare.set(ids);
      this.setIds(ids);
    }
    return false;
  },
  async toggle(productId) {
    return this.has(productId) ? this.remove(productId) : this.add(productId);
  },
  async clear() {
    if (isAuth()) this.setIds((await api.del('/compare')).ids);
    else {
      guestCompare.clear();
      this.setIds([]);
    }
  },
};

// Начальное состояние из /api/auth/me
export function hydrate(me) {
  store.user = me.user;
  if (me.user) {
    store.wishlistIds = new Set(me.wishlistIds || []);
    store.compareIds = me.compareIds || [];
    store.counts = { ...store.counts, ...(me.counts || {}) };
  } else {
    store.wishlistIds = new Set();
    store.compareIds = guestCompare.get();
    store.counts = { ...store.counts, cart: guestCart.get().reduce((sum, i) => sum + (i.quantity || 0), 0), wishlist: 0, compare: store.compareIds.length, notifications: 0 };
  }
  store.emit('counts', { name: '*' });
  store.emit('user', store.user);
}

// После входа: перенос гостевой корзины и сравнения в БД
export async function mergeGuestData() {
  const items = guestCart.get();
  const compareIds = guestCompare.get();
  if (items.length) {
    await api.post('/cart/merge', { items });
    guestCart.clear();
  }
  if (compareIds.length) {
    await api.post('/compare/merge', { productIds: compareIds });
    guestCompare.clear();
  }
}

export default store;

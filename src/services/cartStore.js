// ==========================================
// FIBERLINK SHOPPING CART & POPULARITY STORE
// Persistent localStorage cart synced across Home & Full Ecommerce Store
// ==========================================

const CART_STORAGE_KEY = 'fiberlink_cart_v1';
const PHONE_NUMBER = '522311024672';

const POPULAR_PRIORITY_SKUS = [
  'POS-IMP-80I',
  'CCTV-TAPO-C310',
  'POS-CAJ-01',
  'CCTV-TAPO-C240D',
  'SW-MS365',
  'CCTV-TAPO-C500',
  'POS-IMP-80',
  'SW-OFFICE24'
];

let memoryCart = {};

function readCartFromStorage() {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return { ...memoryCart };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const sanitized = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry !== 'object') continue;
      const qty = Math.max(0, Math.floor(Number(entry.qty) || 0));
      if (qty <= 0) continue;
      sanitized[id] = {
        id: String(entry.id || id),
        sku: String(entry.sku || ''),
        name: String(entry.name || entry.title || 'Producto Fiberlink'),
        category: String(entry.category || 'pos'),
        price: Math.max(0, Math.round(Number(entry.price) || 0)),
        qty,
        maxStock: entry.isService ? 999 : Math.max(1, Math.floor(Number(entry.maxStock) || 99)),
        isService: Boolean(entry.isService),
        imageUrl: String(entry.imageUrl || ''),
        unit: String(entry.unit || 'pza')
      };
    }
    memoryCart = sanitized;
    return sanitized;
  } catch {
    return { ...memoryCart };
  }
}

function writeCartToStorage(cartMap) {
  memoryCart = { ...cartMap };
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartMap));
  } catch {
    // ignore private browsing quota issues
  }
  window.dispatchEvent(
    new CustomEvent('fiberlink:cart-change', {
      detail: getCartSnapshot(cartMap)
    })
  );
}

function getProductCover(prod) {
  if (Array.isArray(prod?.images) && prod.images.length > 0) {
    const first = prod.images.find((x) => typeof x === 'string' && x.trim());
    if (first) return first.trim();
  }
  return typeof prod?.imageUrl === 'string' ? prod.imageUrl.trim() : '';
}

function getCartSnapshot(cartMap = readCartFromStorage()) {
  const items = Object.values(cartMap).filter((item) => item && item.qty > 0);
  const count = items.reduce((acc, item) => acc + item.qty, 0);
  const subtotal = items.reduce((acc, item) => acc + item.qty * item.price, 0);
  return { cartMap, items, count, subtotal };
}

export const cartStore = {
  FREE_SHIPPING_THRESHOLD: 2000,

  getCartMap() {
    return readCartFromStorage();
  },

  getItems() {
    return getCartSnapshot().items;
  },

  getCount() {
    return getCartSnapshot().count;
  },

  getSubtotal() {
    return getCartSnapshot().subtotal;
  },

  getItemQty(productId) {
    const map = readCartFromStorage();
    return map[productId]?.qty || 0;
  },

  addItem(prod, delta = 1) {
    if (!prod || !prod.id) return { ok: false, qty: 0, reason: 'invalid' };
    const map = readCartFromStorage();
    const isService = Boolean(prod.isService);
    const maxStock = isService ? 999 : Math.max(0, Math.floor(Number(prod.stock) || 0));

    if (!isService && maxStock <= 0) {
      return { ok: false, qty: map[prod.id]?.qty || 0, reason: 'out_of_stock', maxStock: 0 };
    }

    const currentQty = map[prod.id]?.qty || 0;
    const requested = currentQty + Math.floor(Number(delta) || 1);
    const clamped = Math.max(0, Math.min(requested, maxStock));

    if (!isService && requested > maxStock && currentQty >= maxStock) {
      return { ok: false, qty: currentQty, reason: 'max_stock', maxStock };
    }

    if (clamped <= 0) {
      delete map[prod.id];
    } else {
      map[prod.id] = {
        id: String(prod.id),
        sku: String(prod.sku || ''),
        name: String(prod.name || 'Producto Fiberlink'),
        category: String(prod.category || 'pos'),
        price: Math.max(0, Math.round(parseFloat(prod.price) || 0)),
        qty: clamped,
        maxStock,
        isService,
        imageUrl: getProductCover(prod),
        unit: String(prod.unit || (isService ? 'servicio' : 'pza'))
      };
    }

    writeCartToStorage(map);
    return { ok: true, qty: clamped, maxStock };
  },

  setQty(productId, qty, prodMeta = null) {
    const map = readCartFromStorage();
    const existing = map[productId];
    const source = prodMeta || existing;
    if (!source) return { ok: false, qty: 0 };

    const isService = Boolean(source.isService);
    const maxStock = isService
      ? 999
      : Math.max(
          0,
          Math.floor(Number(prodMeta ? prodMeta.stock : source.maxStock) || 0)
        );
    const next = Math.max(0, Math.min(Math.floor(Number(qty) || 0), maxStock));

    if (next <= 0) {
      delete map[productId];
    } else {
      map[productId] = {
        id: String(productId),
        sku: String(source.sku || ''),
        name: String(source.name || 'Producto Fiberlink'),
        category: String(source.category || 'pos'),
        price: Math.max(0, Math.round(parseFloat(source.price) || 0)),
        qty: next,
        maxStock,
        isService,
        imageUrl: prodMeta ? getProductCover(prodMeta) : String(source.imageUrl || ''),
        unit: String(source.unit || (isService ? 'servicio' : 'pza'))
      };
    }

    writeCartToStorage(map);
    return { ok: true, qty: next, maxStock };
  },

  removeItem(productId) {
    const map = readCartFromStorage();
    if (map[productId]) {
      delete map[productId];
      writeCartToStorage(map);
    }
  },

  clear() {
    writeCartToStorage({});
  },

  syncWithProducts(liveProducts) {
    if (!Array.isArray(liveProducts) || liveProducts.length === 0) return;
    const map = readCartFromStorage();
    const liveById = new Map(liveProducts.map((p) => [p.id, p]));
    let changed = false;

    for (const id of Object.keys(map)) {
      const live = liveById.get(id);
      if (!live || live.publicVisible === false || (!live.isService && (Number(live.stock) || 0) <= 0)) {
        delete map[id];
        changed = true;
        continue;
      }

      const maxStock = live.isService ? 999 : Math.max(0, Math.floor(Number(live.stock) || 0));
      const clampedQty = Math.min(map[id].qty, maxStock);
      const nextPrice = Math.max(0, Math.round(parseFloat(live.price) || 0));
      const nextImg = getProductCover(live);

      if (
        map[id].qty !== clampedQty ||
        map[id].price !== nextPrice ||
        map[id].name !== live.name ||
        map[id].maxStock !== maxStock ||
        map[id].imageUrl !== nextImg
      ) {
        map[id] = {
          ...map[id],
          sku: String(live.sku || map[id].sku || ''),
          name: String(live.name || map[id].name),
          category: String(live.category || map[id].category || 'pos'),
          price: nextPrice,
          qty: clampedQty,
          maxStock,
          isService: Boolean(live.isService),
          imageUrl: nextImg,
          unit: String(live.unit || map[id].unit || 'pza')
        };
        if (clampedQty <= 0) delete map[id];
        changed = true;
      }
    }

    if (changed) {
      writeCartToStorage(map);
    }
  },

  getTopPopularProducts(products, maxCount = 5) {
    if (!Array.isArray(products)) return [];
    const visible = products.filter((p) => p && p.publicVisible !== false);

    const scoreProduct = (p) => {
      let score = 0;
      const skuUpper = String(p.sku || '').toUpperCase();
      const priorityIndex = POPULAR_PRIORITY_SKUS.indexOf(skuUpper);
      if (priorityIndex !== -1) {
        score += 1000 - priorityIndex * 50;
      }
      const hasPhoto = getProductCover(p).length > 0;
      if (hasPhoto) score += 260;

      const inStock = Boolean(p.isService) || (Number(p.stock) || 0) > 0;
      if (inStock) score += 180;

      const catBonus = { pos: 65, cctv: 60, software: 45, redes: 35, refacciones: 20, servicios: 15 };
      score += catBonus[p.category] || 10;

      // Slight preference for rich multi-photo listings
      if (Array.isArray(p.images) && p.images.length > 1) {
        score += Math.min(40, p.images.length * 10);
      }

      return score;
    };

    return [...visible]
      .sort((a, b) => scoreProduct(b) - scoreProduct(a))
      .slice(0, maxCount);
  },

  buildWhatsAppOrderUrl({ deliveryMode = 'Envío local en Teziutlán', customerNote = '' } = {}) {
    const { items, count, subtotal } = getCartSnapshot();
    if (count === 0) {
      return `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(
        'Hola Fiberlink, deseo cotizar equipamiento de la tienda para mi negocio.'
      )}`;
    }

    const lines = items.map(
      (entry) =>
        `• ${entry.qty}x ${entry.name}${entry.sku ? ` (${entry.sku})` : ''} — $${(
          entry.qty * entry.price
        ).toLocaleString('es-MX')} MXN`
    );

    const shippingNote =
      subtotal >= cartStore.FREE_SHIPPING_THRESHOLD
        ? 'Envío local GRATIS incluido (compra mayor a $2,000 MXN)'
        : deliveryMode;

    let msg =
      `*PEDIDO TIENDA FIBERLINK TIC*\n\n` +
      `${lines.join('\n')}\n\n` +
      `*Artículos:* ${count}\n` +
      `*Total estimado:* $${subtotal.toLocaleString('es-MX')} MXN (IVA incluido)\n` +
      `*Modalidad:* ${shippingNote}`;

    if (customerNote && customerNote.trim()) {
      msg += `\n*Notas / Datos:* ${customerNote.trim()}`;
    }

    msg += `\n\n¿Me confirman disponibilidad para entrega hoy?`;
    return `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(msg)}`;
  },

  buildQuoteSummaryText() {
    const { items, count, subtotal } = getCartSnapshot();
    if (count === 0) return 'Cotización de equipamiento TIC Fiberlink';
    const summary = items.map((i) => `${i.qty}x ${i.name}`).join(', ');
    return `Cotización formal (${count} items · $${subtotal.toLocaleString('es-MX')} MXN): ${summary}`;
  },

  subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    const handler = (ev) => callback(ev?.detail || getCartSnapshot());
    const storageHandler = (ev) => {
      if (ev.key === CART_STORAGE_KEY) {
        callback(getCartSnapshot());
      }
    };
    window.addEventListener('fiberlink:cart-change', handler);
    window.addEventListener('storage', storageHandler);
    callback(getCartSnapshot());
    return () => {
      window.removeEventListener('fiberlink:cart-change', handler);
      window.removeEventListener('storage', storageHandler);
    };
  }
};

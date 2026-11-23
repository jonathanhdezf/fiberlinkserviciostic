import { storeService, STARTER_PRODUCTS } from './services/storeService.js';
import { cartStore } from './services/cartStore.js';
import {
  attachCardHoverZoom,
  getProductPhotos,
  initCartWidgets,
  openCartDrawer,
  openProductZoomModal,
  showStoreToast
} from './services/storeWidgets.js';

const CATEGORY_ORDER = ['pos', 'cctv', 'redes', 'software', 'refacciones', 'servicios'];
const CATEGORY_META = {
  pos: { tabLabel: 'Puntos de Venta (POS)', label: 'Punto de Venta', icon: 'point_of_sale', tone: 'text-neon-emerald' },
  cctv: { tabLabel: 'Cámaras & Seguridad', label: 'Videovigilancia', icon: 'videocam', tone: 'text-status-info' },
  redes: { tabLabel: 'Redes & Conectividad', label: 'Redes & Fibra', icon: 'router', tone: 'text-status-info' },
  software: { tabLabel: 'Licencias & Software', label: 'Software & Licencias', icon: 'key', tone: 'text-neon-emerald' },
  refacciones: { tabLabel: 'Refacciones & Cómputo', label: 'Refacciones & Cómputo', icon: 'memory', tone: 'text-status-warning' },
  servicios: { tabLabel: 'Servicio Técnico', label: 'Servicio TIC', icon: 'build_circle', tone: 'text-neon-emerald' }
};

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildFallbackVisualHtml(catMeta, sku) {
  return `
    <div class="w-full h-full flex flex-col items-center justify-center gap-2 text-center select-none" style="background-image: radial-gradient(rgba(156,195,46,0.18) 1px, transparent 1px); background-size: 16px 16px;">
      <div class="w-16 h-16 rounded-2xl bg-panel border border-primary-container/30 flex items-center justify-center text-neon-emerald shadow-sm">
        <span class="material-symbols-outlined text-[36px]" aria-hidden="true">${catMeta.icon}</span>
      </div>
      <span class="font-label-mono-xs text-[11px] text-text-tertiary uppercase tracking-wider">${escapeHtml(sku || catMeta.label)}</span>
    </div>
  `;
}

function bootCatalogPage() {
  initCartWidgets();
  const grid = document.getElementById('storeProductsGrid');
  const tabsWrap = document.getElementById('storeCategoryTabs');
  const searchInput = document.getElementById('storeSearch');
  const clearBtn = document.getElementById('storeClearSearch');
  const inStockCheckbox = document.getElementById('storeInStockOnly');
  const sortSelect = document.getElementById('storeSort');
  const visibleCountEl = document.getElementById('storeVisibleCount');
  const resetToolbarBtn = document.getElementById('storeResetFiltersBtn');
  const emptyState = document.getElementById('storeEmptyState');
  const emptyResetBtn = document.getElementById('storeEmptyResetBtn');
  const mobileCartBar = document.getElementById('mobileCartFloatingBar');

  if (!grid) return;

  let allItems = [];
  let currentCategory = 'all';
  let searchQuery = '';
  let sortBy = 'popular';
  let inStockOnly = false;

  // Allow deep-linking via URL ?cat=pos or ?q=tapo
  try {
    const params = new URLSearchParams(window.location.search);
    const catParam = params.get('cat');
    const qParam = params.get('q');
    if (catParam && CATEGORY_ORDER.includes(catParam)) {
      currentCategory = catParam;
    }
    if (qParam) {
      searchQuery = qParam.trim();
      if (searchInput) searchInput.value = searchQuery;
      if (clearBtn) {
        clearBtn.classList.toggle('hidden', !searchQuery);
        clearBtn.classList.toggle('flex', Boolean(searchQuery));
      }
    }
  } catch (_) {}

  function syncMobileBarVisibility(count) {
    if (!mobileCartBar) return;
    mobileCartBar.classList.toggle('hidden', count <= 0);
  }

  function hasActiveFilters() {
    return currentCategory !== 'all' || Boolean(searchQuery.trim()) || inStockOnly || sortBy !== 'popular';
  }

  function renderTabs() {
    if (!tabsWrap) return;
    const counts = { all: allItems.length };
    allItems.forEach((p) => {
      const cat = p.category || 'pos';
      counts[cat] = (counts[cat] || 0) + 1;
    });

    if (currentCategory !== 'all' && !counts[currentCategory]) {
      currentCategory = 'all';
    }

    const baseBtnClass = (active) =>
      active
        ? 'px-3.5 py-2 rounded-xl bg-primary-container text-on-brand font-button-text text-xs font-bold whitespace-nowrap shadow-sm shrink-0 transition-all'
        : 'px-3.5 py-2 rounded-xl bg-panel-2 hover:bg-surface-overlay text-text-secondary hover:text-text-primary border border-glass font-button-text text-xs font-medium whitespace-nowrap shrink-0 transition-all';

    const tabsHtml = [
      `<button class="${baseBtnClass(currentCategory === 'all')}" data-category="all" type="button">Todos (<span class="tabular-nums">${counts.all}</span>)</button>`
    ];

    CATEGORY_ORDER.forEach((catKey) => {
      if ((counts[catKey] || 0) > 0) {
        const label = CATEGORY_META[catKey]?.tabLabel || catKey;
        tabsHtml.push(
          `<button class="${baseBtnClass(currentCategory === catKey)}" data-category="${catKey}" type="button">${escapeHtml(label)} (<span class="tabular-nums">${counts[catKey]}</span>)</button>`
        );
      }
    });

    tabsWrap.innerHTML = tabsHtml.join('');
    tabsWrap.querySelectorAll('button[data-category]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentCategory = btn.getAttribute('data-category') || 'all';
        renderTabs();
        renderCards();
      });
    });
  }

  function renderCards() {
    const q = searchQuery.toLowerCase().trim();
    const cartMap = cartStore.getCartMap();

    let filtered = allItems.filter((p) => {
      if (currentCategory !== 'all' && (p.category || 'pos') !== currentCategory) return false;
      if (inStockOnly && !p.isService && (Number(p.stock) || 0) <= 0) return false;
      if (!q) return true;
      const hay = `${p.name || ''} ${p.sku || ''} ${p.description || ''} ${p.category || ''} ${(Array.isArray(p.specs) ? p.specs.join(' ') : '')}`.toLowerCase();
      return hay.includes(q);
    });

    if (sortBy === 'popular') {
      const popularIds = new Map(
        cartStore.getTopPopularProducts(allItems, allItems.length).map((p, i) => [p.id, i])
      );
      filtered.sort((a, b) => (popularIds.get(a.id) ?? 999) - (popularIds.get(b.id) ?? 999));
    } else if (sortBy === 'precio-asc') {
      filtered.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
    } else if (sortBy === 'precio-desc') {
      filtered.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
    } else if (sortBy === 'stock-desc') {
      filtered.sort((a, b) => (Number(b.stock) || 0) - (Number(a.stock) || 0));
    } else if (sortBy === 'nombre-asc') {
      filtered.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'));
    }

    if (visibleCountEl) {
      visibleCountEl.textContent = `Mostrando ${filtered.length} de ${allItems.length} artículos`;
    }
    if (resetToolbarBtn) {
      resetToolbarBtn.classList.toggle('hidden', !hasActiveFilters());
    }

    if (filtered.length === 0) {
      grid.innerHTML = '';
      grid.classList.add('hidden');
      if (emptyState) {
        emptyState.classList.remove('hidden');
        emptyState.classList.add('flex');
      }
      return;
    }

    grid.classList.remove('hidden');
    if (emptyState) {
      emptyState.classList.add('hidden');
      emptyState.classList.remove('flex');
    }

    grid.innerHTML = filtered.map((p) => {
      const catKey = p.category || 'pos';
      const catMeta = CATEGORY_META[catKey] || CATEGORY_META.pos;
      const photos = getProductPhotos(p);
      const cover = photos[0] || '';
      const stockNum = Number(p.stock) || 0;
      const minStockNum = Number(p.minStock) || 2;
      const isOutOfStock = !p.isService && stockNum <= 0;
      const isLowStock = !p.isService && stockNum > 0 && stockNum <= minStockNum;
      const priceVal = Math.round(parseFloat(p.price) || 0);
      const priceStr = `$${priceVal.toLocaleString('es-MX')}`;
      const unitSuffix = p.unit === 'metro' ? ' / metro' : '';
      const currentQty = cartMap[p.id]?.qty || 0;
      const specsList = Array.isArray(p.specs) ? p.specs.slice(0, 3).map((s) => escapeHtml(s)).join(' · ') : '';

      const stockLabel = p.isService
        ? 'Servicio disponible'
        : isOutOfStock
          ? 'Agotado'
          : isLowStock
            ? `${stockNum} disp. · Últimas piezas`
            : `${stockNum} ${p.unit === 'kit' ? 'kits en stock' : 'en stock'}`;

      const stockClass = isOutOfStock
        ? 'text-status-alert font-semibold'
        : isLowStock
          ? 'text-status-warning font-semibold'
          : 'text-text-secondary';

      const zoomBadgeHtml = photos.length > 1
        ? `<span class="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-panel/95 border border-primary-container/40 text-neon-emerald font-label-mono-xs text-[11px] font-semibold flex items-center gap-1 shadow-sm pointer-events-none"><span class="material-symbols-outlined text-[14px]" aria-hidden="true">zoom_in</span>1/${photos.length}</span>`
        : `<span class="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-panel/95 border border-glass text-text-primary group-hover/media:text-neon-emerald group-hover/media:border-primary-container/45 font-label-mono-xs text-[11px] font-semibold flex items-center gap-1 shadow-sm transition-colors pointer-events-none"><span class="material-symbols-outlined text-[14px]" aria-hidden="true">zoom_in</span>Zoom</span>`;

      const mediaHtml = cover
        ? `<img loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="${escapeHtml(p.name)}" class="w-full h-full object-contain transition-transform duration-200 ease-out will-change-transform" src="${escapeHtml(cover)}" data-product-img>${zoomBadgeHtml}`
        : buildFallbackVisualHtml(catMeta, p.sku);

      return `
        <article data-product data-id="${escapeHtml(p.id)}" data-category="${escapeHtml(catKey)}" class="p-4 sm:p-5 rounded-2xl bg-panel border ${isLowStock ? 'border-primary-container/35' : 'border-glass'} hover:border-primary-container/45 hover:bg-panel-2 transition-all flex flex-col justify-between group shadow-sm">
          <div class="flex flex-col">
            <div class="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-glass/60">
              <span class="font-label-mono-xs text-[11px] ${catMeta.tone} uppercase tracking-wider font-semibold truncate">${escapeHtml(catMeta.label)}${p.sku ? ` · ${escapeHtml(p.sku)}` : ''}</span>
              <span class="font-label-mono-xs text-[11px] ${stockClass} tabular-nums whitespace-nowrap">${escapeHtml(stockLabel)}</span>
            </div>

            <div class="relative w-full aspect-[4/3] rounded-xl bg-surface-container-low border border-glass p-4 flex items-center justify-center overflow-hidden mb-3.5 transition-all cursor-zoom-in group/media hover:border-primary-container/50" data-media-box role="button" tabindex="0" aria-label="Hacer zoom y ver detalles de ${escapeHtml(p.name)}">
              ${mediaHtml}
            </div>

            <h2 data-open-pdp class="font-headline-sm text-base sm:text-[17px] text-text-primary group-hover:text-neon-emerald transition-colors font-semibold leading-snug line-clamp-2 cursor-pointer">${escapeHtml(p.name)}</h2>
            <p class="font-body-sm text-xs sm:text-sm text-text-secondary mt-1.5 leading-relaxed line-clamp-2">${escapeHtml(p.description || 'Equipamiento homologado con garantía directa en Teziutlán y soporte técnico Fiberlink.')}</p>
            ${specsList ? `<p class="font-label-mono-xs text-[11px] text-text-tertiary mt-2 leading-relaxed truncate">${specsList}</p>` : ''}
          </div>

          <div class="flex flex-col gap-3 pt-4 mt-4 border-t border-glass">
            <div class="flex items-baseline justify-between gap-2">
              <div class="flex flex-col">
                <span class="font-headline-md text-xl text-text-primary font-bold tracking-tight tabular-nums">${priceStr} <span class="text-xs text-text-tertiary font-normal">MXN${escapeHtml(unitSuffix)}</span></span>
                <span class="font-label-mono-xs text-[11px] text-neon-emerald">Precio neto · Garantía local</span>
              </div>
              <span class="font-label-mono-xs text-[11px] ${isOutOfStock ? 'text-text-tertiary' : 'text-neon-emerald'} font-semibold whitespace-nowrap">${isOutOfStock ? 'Bajo pedido' : 'Entrega hoy'}</span>
            </div>

            <div class="flex items-center gap-2">
              ${currentQty > 0 ? `
                <div class="flex items-center rounded-xl bg-surface-container-low border border-primary-container/40 p-1">
                  <button type="button" data-qty="minus" aria-label="Quitar uno" class="w-8 h-8 rounded-lg hover:bg-surface-overlay text-text-primary flex items-center justify-center font-bold">−</button>
                  <span data-qty="value" aria-live="polite" class="w-7 text-center font-label-mono-xs text-xs font-bold text-neon-emerald tabular-nums">${currentQty}</span>
                  <button type="button" data-qty="plus" aria-label="Agregar uno" class="w-8 h-8 rounded-lg hover:bg-surface-overlay text-text-primary flex items-center justify-center font-bold">+</button>
                </div>
                <button type="button" data-open-cart class="flex-1 py-2.5 px-3 rounded-xl bg-primary-container hover:bg-primary-fixed text-on-brand font-button-text text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap">
                  <span class="material-symbols-outlined text-[17px]">shopping_bag</span>
                  <span>Ver Carrito</span>
                </button>
              ` : `
                <button type="button" data-add-cart class="flex-1 py-2.5 px-3 rounded-xl bg-primary-container hover:bg-primary-fixed text-on-brand font-button-text text-xs sm:text-sm font-bold transition-all text-center flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed" ${isOutOfStock ? 'disabled' : ''}>
                  <span class="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                  <span>${isOutOfStock ? 'Agotado' : 'Agregar al carrito'}</span>
                </button>
                <button type="button" data-open-pdp aria-label="Ver detalles y zoom" title="Ampliar fotografía y ficha" class="w-10 h-10 rounded-xl bg-panel-2 border border-glass hover:border-primary-container/45 text-text-secondary hover:text-neon-emerald flex items-center justify-center shrink-0 transition-colors">
                  <span class="material-symbols-outlined text-[19px]">zoom_in</span>
                </button>
              `}
            </div>
          </div>
        </article>
      `;
    }).join('');

    grid.querySelectorAll('article[data-product]').forEach((card) => {
      const id = card.dataset.id;
      const prod = allItems.find((x) => x.id === id);
      if (!prod) return;

      const mediaBox = card.querySelector('[data-media-box]');
      const img = card.querySelector('img[data-product-img]');
      if (img && mediaBox) {
        img.addEventListener('error', () => {
          const catMeta = CATEGORY_META[prod.category || 'pos'] || CATEGORY_META.pos;
          mediaBox.innerHTML = buildFallbackVisualHtml(catMeta, prod.sku);
        }, { once: true });
        attachCardHoverZoom(mediaBox, img);
      }

      const openPdp = () => openProductZoomModal(prod);

      mediaBox?.addEventListener('click', openPdp);
      mediaBox?.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openPdp();
        }
      });
      card.querySelectorAll('[data-open-pdp]').forEach((el) => {
        el.addEventListener('click', openPdp);
      });

      card.querySelector('[data-add-cart]')?.addEventListener('click', () => {
        const res = cartStore.addItem(prod, 1);
        if (!res.ok) {
          showStoreToast(res.reason === 'out_of_stock' ? 'Producto temporalmente agotado.' : `Stock máximo: ${res.maxStock}`, 'warning');
          return;
        }
        showStoreToast(`${prod.name} agregado al carrito.`, 'success');
      });

      card.querySelector('[data-qty="plus"]')?.addEventListener('click', () => {
        const res = cartStore.addItem(prod, 1);
        if (!res.ok && res.reason === 'max_stock') {
          showStoreToast(`Stock máximo disponible: ${res.maxStock}`, 'warning');
        }
      });

      card.querySelector('[data-qty="minus"]')?.addEventListener('click', () => {
        const curr = cartStore.getItemQty(prod.id);
        cartStore.setQty(prod.id, curr - 1, prod);
      });

      card.querySelector('[data-open-cart]')?.addEventListener('click', openCartDrawer);
    });
  }

  function applyCatalog(list) {
    allItems = Array.isArray(list) ? list.filter((p) => p && p.publicVisible !== false) : [];
    cartStore.syncWithProducts(allItems);
    renderTabs();
    renderCards();
  }

  function resetAllFilters() {
    currentCategory = 'all';
    searchQuery = '';
    sortBy = 'popular';
    inStockOnly = false;
    if (searchInput) searchInput.value = '';
    if (sortSelect) sortSelect.value = 'popular';
    if (inStockCheckbox) inStockCheckbox.checked = false;
    if (clearBtn) {
      clearBtn.classList.add('hidden');
      clearBtn.classList.remove('flex');
    }
    renderTabs();
    renderCards();
  }

  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    if (clearBtn) {
      clearBtn.classList.toggle('hidden', !searchQuery);
      clearBtn.classList.toggle('flex', Boolean(searchQuery));
    }
    renderCards();
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      searchQuery = '';
      clearBtn.classList.add('hidden');
      clearBtn.classList.remove('flex');
      renderCards();
      searchInput.focus();
    }
  });

  inStockCheckbox?.addEventListener('change', (e) => {
    inStockOnly = Boolean(e.target.checked);
    renderCards();
  });

  sortSelect?.addEventListener('change', (e) => {
    sortBy = e.target.value || 'popular';
    renderCards();
  });

  resetToolbarBtn?.addEventListener('click', resetAllFilters);
  emptyResetBtn?.addEventListener('click', resetAllFilters);

  cartStore.subscribe(({ count }) => {
    syncMobileBarVisibility(count);
    if (allItems.length > 0) renderCards();
  });

  // Real-time Firestore public catalog subscription
  applyCatalog(STARTER_PRODUCTS);
  storeService.subscribePublicProducts(
    (liveList) => {
      if (liveList.length > 0) {
        applyCatalog(liveList);
      } else {
        applyCatalog(STARTER_PRODUCTS);
      }
    },
    (err) => {
      console.warn('[CatalogoPage] Fallback local activo tras error Firestore:', err?.message || err);
    }
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootCatalogPage);
} else {
  bootCatalogPage();
}

// ==========================================
// FIBERLINK STORE WIDGETS
// Interactive Photo Zoom Lightbox (PDP) + Slide-Over Shopping Cart Drawer
// Works across index.html and catalogo.html with Dark/Light Tailwind tokens
// ==========================================

import { cartStore } from './cartStore.js';

const CATEGORY_META = {
  pos: { label: 'Punto de Venta', icon: 'point_of_sale', tone: 'text-neon-emerald' },
  cctv: { label: 'Videovigilancia CCTV', icon: 'videocam', tone: 'text-status-info' },
  redes: { label: 'Redes & Conectividad', icon: 'router', tone: 'text-status-info' },
  software: { label: 'Software & Licencias', icon: 'key', tone: 'text-neon-emerald' },
  refacciones: { label: 'Refacciones & Cómputo', icon: 'memory', tone: 'text-status-warning' },
  servicios: { label: 'Servicio Técnico', icon: 'build_circle', tone: 'text-neon-emerald' }
};

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getProductPhotos(p) {
  if (Array.isArray(p?.images) && p.images.length > 0) {
    return p.images.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
  }
  return typeof p?.imageUrl === 'string' && p.imageUrl.trim() ? [p.imageUrl.trim()] : [];
}

export function showStoreToast(message, type = 'success') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }

  let wrap = document.getElementById('fl-toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'fl-toast-wrap';
    wrap.className = 'fl-toast-wrap';
    wrap.setAttribute('aria-live', 'polite');
    wrap.setAttribute('aria-atomic', 'true');
    document.body.appendChild(wrap);
  }

  const toast = document.createElement('div');
  toast.className = 'fl-toast';
  toast.dataset.type = type;
  const icon = type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'check_circle';
  toast.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">${icon}</span><span>${escapeHtml(message)}</span>`;
  wrap.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 260);
  }, 3500);
}

// Lightweight focal hover zoom directly on product cards
export function attachCardHoverZoom(mediaBox, imgEl) {
  if (!mediaBox || !imgEl) return;

  mediaBox.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse') return;
    const rect = mediaBox.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const xPct = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
    imgEl.style.transformOrigin = `${xPct.toFixed(1)}% ${yPct.toFixed(1)}%`;
    imgEl.style.transform = 'scale(1.28)';
  });

  mediaBox.addEventListener('pointerleave', () => {
    imgEl.style.transformOrigin = '50% 50%';
    imgEl.style.transform = 'scale(1)';
  });
}

// ==========================================
// 1. PRODUCT DETAIL & INTERACTIVE ZOOM MODAL
// ==========================================
let zoomModalState = {
  prod: null,
  photos: [],
  photoIdx: 0,
  zoom: 1,
  panX: 0,
  panY: 0,
  qty: 1,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  dragMoved: false
};

const ZOOM_LEVELS = [1, 1.75, 2.5, 3.25];

function applyZoomTransform(modal) {
  const img = modal.querySelector('#flpdpMainImg');
  const stage = modal.querySelector('#flpdpStage');
  const levelEl = modal.querySelector('#flpdpZoomBadge');
  const outBtn = modal.querySelector('#flpdpZoomOut');
  const inBtn = modal.querySelector('#flpdpZoomIn');
  const resetBtn = modal.querySelector('#flpdpZoomReset');
  const hintEl = modal.querySelector('#flpdpZoomHint');

  const z = zoomModalState.zoom;
  if (z <= 1) {
    zoomModalState.panX = 0;
    zoomModalState.panY = 0;
  }

  if (img) {
    img.style.transition = zoomModalState.isDragging ? 'none' : 'transform 150ms ease-out';
    img.style.transform = `translate3d(${zoomModalState.panX}px, ${zoomModalState.panY}px, 0) scale(${z})`;
  }
  if (stage) {
    stage.style.cursor = z > 1 ? (zoomModalState.isDragging ? 'grabbing' : 'zoom-out') : 'zoom-in';
  }
  if (levelEl) {
    levelEl.textContent = `${Math.round(z * 100)}%`;
  }
  if (outBtn) outBtn.disabled = z <= 1;
  if (inBtn) inBtn.disabled = z >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
  if (resetBtn) resetBtn.classList.toggle('hidden', z <= 1);
  if (hintEl) {
    hintEl.textContent = z > 1
      ? 'Mueve el cursor o arrastra para inspeccionar detalles · Clic para restablecer'
      : 'Haz clic en la imagen o usa + para hacer zoom';
  }
}

function clampPan(modal, rawX, rawY) {
  const stage = modal.querySelector('#flpdpStage');
  if (!stage || zoomModalState.zoom <= 1) return { x: 0, y: 0 };
  const rect = stage.getBoundingClientRect();
  const maxX = Math.max(0, (rect.width * (zoomModalState.zoom - 1)) / 2.1);
  const maxY = Math.max(0, (rect.height * (zoomModalState.zoom - 1)) / 2.1);
  return {
    x: Math.max(-maxX, Math.min(maxX, rawX)),
    y: Math.max(-maxY, Math.min(maxY, rawY))
  };
}

function setModalPhotoIndex(modal, nextIdx) {
  const { photos, prod } = zoomModalState;
  const total = photos.length;
  if (total === 0) return;

  const safeIdx = ((nextIdx % total) + total) % total;
  zoomModalState.photoIdx = safeIdx;
  zoomModalState.zoom = 1;
  zoomModalState.panX = 0;
  zoomModalState.panY = 0;

  const mainImg = modal.querySelector('#flpdpMainImg');
  const counterEl = modal.querySelector('#flpdpPhotoCounter');
  if (mainImg) {
    mainImg.src = photos[safeIdx];
    mainImg.alt = `${prod?.name || 'Producto'} — Vista ${safeIdx + 1}`;
  }
  if (counterEl) {
    counterEl.textContent = `${safeIdx + 1} / ${total}`;
  }

  modal.querySelectorAll('#flpdpThumbs button[data-thumb-idx]').forEach((btn) => {
    const isActive = Number(btn.dataset.thumbIdx) === safeIdx;
    btn.classList.toggle('border-primary-container', isActive);
    btn.classList.toggle('ring-2', isActive);
    btn.classList.toggle('ring-primary-container/40', isActive);
    btn.classList.toggle('border-glass', !isActive);
  });

  applyZoomTransform(modal);
}

function ensureZoomModal() {
  let modal = document.getElementById('flProductZoomModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'flProductZoomModal';
  modal.className = 'fixed inset-0 z-[1350] hidden items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'flpdpTitle');
  modal.setAttribute('aria-hidden', 'true');

  modal.innerHTML = `
    <div class="relative w-full max-w-4xl rounded-2xl bg-panel border border-glass shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
      <div class="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-glass bg-panel-2 shrink-0">
        <div class="min-w-0">
          <span id="flpdpMeta" class="font-label-mono-xs text-[11px] text-neon-emerald uppercase tracking-wider font-semibold block truncate">Catálogo Fiberlink</span>
          <h3 id="flpdpTitle" class="font-headline-sm text-base sm:text-lg text-text-primary font-bold truncate">Detalle de producto</h3>
        </div>
        <button type="button" id="flpdpClose" aria-label="Cerrar vista ampliada" class="w-9 h-9 rounded-lg bg-surface-container-low border border-glass text-text-secondary hover:text-text-primary flex items-center justify-center shrink-0 transition-colors">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <div class="overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
        <!-- LEFT: ZOOMABLE PHOTO STAGE -->
        <div class="md:col-span-7 flex flex-col gap-3">
          <div id="flpdpStage" class="relative w-full h-72 sm:h-96 rounded-xl bg-surface-container-low border border-glass overflow-hidden flex items-center justify-center select-none touch-none">
            <img id="flpdpMainImg" src="" alt="" class="w-full h-full object-contain p-4 transition-transform duration-150 ease-out pointer-events-none select-none will-change-transform">
            <div id="flpdpFallbackStage" class="hidden w-full h-full flex-col items-center justify-center gap-2 text-center p-6">
              <div class="w-20 h-20 rounded-2xl bg-panel border border-primary-container/30 flex items-center justify-center text-neon-emerald">
                <span id="flpdpFallbackIcon" class="material-symbols-outlined text-[42px]">inventory_2</span>
              </div>
              <span id="flpdpFallbackSku" class="font-label-mono-xs text-xs text-text-tertiary uppercase tracking-wider"></span>
            </div>

            <!-- Prev / Next Arrows -->
            <button type="button" id="flpdpPrevPhoto" aria-label="Fotografía anterior" class="hidden absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-panel/90 border border-glass text-text-primary hover:border-primary-container hover:text-neon-emerald items-center justify-center shadow-md transition-all">
              <span class="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <button type="button" id="flpdpNextPhoto" aria-label="Siguiente fotografía" class="hidden absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-panel/90 border border-glass text-text-primary hover:border-primary-container hover:text-neon-emerald items-center justify-center shadow-md transition-all">
              <span class="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>

            <!-- Photo Counter Badge -->
            <span id="flpdpPhotoCounter" class="hidden absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-panel/90 border border-glass font-label-mono-xs text-[11px] text-text-primary font-semibold tabular-nums">1 / 1</span>

            <!-- Zoom Controls Toolbar -->
            <div id="flpdpZoomToolbar" class="absolute bottom-2.5 right-2.5 flex items-center gap-1 p-1 rounded-xl bg-panel/95 border border-glass shadow-lg">
              <button type="button" id="flpdpZoomOut" aria-label="Reducir zoom" class="w-8 h-8 rounded-lg hover:bg-surface-overlay text-text-primary flex items-center justify-center disabled:opacity-35 disabled:cursor-not-allowed transition-colors">
                <span class="material-symbols-outlined text-[18px]">zoom_out</span>
              </button>
              <span id="flpdpZoomBadge" class="px-2 font-label-mono-xs text-[11px] font-bold text-neon-emerald tabular-nums min-w-[46px] text-center">100%</span>
              <button type="button" id="flpdpZoomIn" aria-label="Acercar zoom" class="w-8 h-8 rounded-lg hover:bg-surface-overlay text-text-primary flex items-center justify-center disabled:opacity-35 disabled:cursor-not-allowed transition-colors">
                <span class="material-symbols-outlined text-[18px]">zoom_in</span>
              </button>
              <button type="button" id="flpdpZoomReset" aria-label="Restablecer zoom" title="Restablecer 100%" class="hidden w-8 h-8 rounded-lg hover:bg-surface-overlay text-text-secondary hover:text-neon-emerald flex items-center justify-center transition-colors">
                <span class="material-symbols-outlined text-[17px]">restart_alt</span>
              </button>
            </div>
          </div>

          <p id="flpdpZoomHint" class="font-label-mono-xs text-[11px] text-text-tertiary flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[14px] text-neon-emerald" aria-hidden="true">search</span>
            <span>Haz clic en la imagen o usa + para hacer zoom</span>
          </p>

          <div id="flpdpThumbs" class="flex items-center gap-2 overflow-x-auto pb-1"></div>
        </div>

        <!-- RIGHT: ECOMMERCE PURCHASE MODULE -->
        <div class="md:col-span-5 flex flex-col justify-between gap-4">
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between gap-2">
              <span id="flpdpStock" class="font-label-mono-xs text-xs font-semibold tabular-nums text-neon-emerald">Disponible</span>
              <span id="flpdpDelivery" class="font-label-mono-xs text-[11px] text-text-secondary">Entrega hoy · Teziutlán</span>
            </div>

            <div class="pb-3 border-b border-glass">
              <div id="flpdpPrice" class="font-headline-lg text-2xl sm:text-3xl font-bold text-text-primary tabular-nums">$0 MXN</div>
              <p class="font-label-mono-xs text-[11px] text-neon-emerald mt-1">Precio neto · Garantía local directa</p>
            </div>

            <p id="flpdpDesc" class="font-body-sm text-xs sm:text-sm text-text-secondary leading-relaxed"></p>

            <div id="flpdpSpecsWrap" class="hidden flex-col gap-1.5 pt-1">
              <span class="font-label-mono-xs text-[11px] text-text-tertiary uppercase tracking-wider font-semibold">Especificaciones</span>
              <ul id="flpdpSpecs" class="flex flex-col gap-1.5"></ul>
            </div>
          </div>

          <div class="flex flex-col gap-2.5 pt-3 border-t border-glass">
            <div class="flex items-center gap-2.5">
              <div class="flex items-center rounded-xl bg-surface-container-low border border-glass p-1 shrink-0">
                <button type="button" id="flpdpQtyMinus" aria-label="Disminuir cantidad" class="w-9 h-9 rounded-lg hover:bg-surface-overlay text-text-primary font-bold flex items-center justify-center disabled:opacity-35">−</button>
                <span id="flpdpQtyVal" class="w-8 text-center font-label-mono-xs text-sm font-bold text-text-primary tabular-nums">1</span>
                <button type="button" id="flpdpQtyPlus" aria-label="Aumentar cantidad" class="w-9 h-9 rounded-lg hover:bg-surface-overlay text-text-primary font-bold flex items-center justify-center disabled:opacity-35">+</button>
              </div>
              <button type="button" id="flpdpAddCartBtn" class="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-primary-container hover:bg-primary-fixed text-on-brand font-button-text text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all">
                <span class="material-symbols-outlined text-[19px]">add_shopping_cart</span>
                <span>Agregar al carrito</span>
              </button>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <a id="flpdpWaBtn" href="#" target="_blank" rel="noopener noreferrer" class="py-2.5 px-3 rounded-xl bg-panel-2 border border-glass hover:border-primary-container/50 text-text-primary hover:text-neon-emerald font-button-text text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center">
                <span class="material-symbols-outlined text-[16px] text-neon-emerald">chat</span>
                <span>WhatsApp</span>
              </a>
              <button type="button" id="flpdpQuoteBtn" class="py-2.5 px-3 rounded-xl bg-panel-2 border border-glass hover:border-primary-container/50 text-text-primary hover:text-neon-emerald font-button-text text-xs font-semibold flex items-center justify-center gap-1.5 transition-all">
                <span class="material-symbols-outlined text-[16px] text-neon-emerald">receipt_long</span>
                <span>Cotizar Ticket</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    modal.setAttribute('aria-hidden', 'true');
    const drawer = document.getElementById('flCartDrawer');
    if (!drawer || drawer.classList.contains('hidden')) {
      document.body.style.overflow = '';
    }
  };

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  modal.querySelector('#flpdpClose')?.addEventListener('click', closeModal);

  const stage = modal.querySelector('#flpdpStage');
  const mainImgEl = modal.querySelector('#flpdpMainImg');
  const fallbackStageEl = modal.querySelector('#flpdpFallbackStage');
  const zoomInBtn = modal.querySelector('#flpdpZoomIn');
  const zoomOutBtn = modal.querySelector('#flpdpZoomOut');
  const zoomResetBtn = modal.querySelector('#flpdpZoomReset');
  const prevBtn = modal.querySelector('#flpdpPrevPhoto');
  const nextBtn = modal.querySelector('#flpdpNextPhoto');

  if (mainImgEl) {
    mainImgEl.addEventListener('error', () => {
      mainImgEl.classList.add('hidden');
      if (fallbackStageEl) {
        fallbackStageEl.classList.remove('hidden');
        fallbackStageEl.classList.add('flex');
      }
      modal.querySelector('#flpdpZoomToolbar')?.classList.add('hidden');
      modal.querySelector('#flpdpZoomHint')?.classList.add('hidden');
    });
  }

  const stepZoom = (dir) => {
    const currIdx = ZOOM_LEVELS.findIndex((lvl) => Math.abs(lvl - zoomModalState.zoom) < 0.05);
    const baseIdx = currIdx === -1 ? 0 : currIdx;
    const nextIdx = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, baseIdx + dir));
    zoomModalState.zoom = ZOOM_LEVELS[nextIdx];
    const clamped = clampPan(modal, zoomModalState.panX, zoomModalState.panY);
    zoomModalState.panX = clamped.x;
    zoomModalState.panY = clamped.y;
    applyZoomTransform(modal);
  };

  zoomInBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    stepZoom(1);
  });
  zoomOutBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    stepZoom(-1);
  });
  zoomResetBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    zoomModalState.zoom = 1;
    applyZoomTransform(modal);
  });
  prevBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    setModalPhotoIndex(modal, zoomModalState.photoIdx - 1);
  });
  nextBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    setModalPhotoIndex(modal, zoomModalState.photoIdx + 1);
  });

  if (stage) {
    stage.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || zoomModalState.photos.length === 0) return;
      zoomModalState.dragMoved = false;
      if (zoomModalState.zoom > 1) {
        zoomModalState.isDragging = true;
        zoomModalState.dragStartX = e.clientX - zoomModalState.panX;
        zoomModalState.dragStartY = e.clientY - zoomModalState.panY;
        stage.setPointerCapture?.(e.pointerId);
        applyZoomTransform(modal);
      }
    });

    stage.addEventListener('pointermove', (e) => {
      if (zoomModalState.photos.length === 0 || zoomModalState.zoom <= 1) return;
      if (zoomModalState.isDragging) {
        const dx = e.clientX - zoomModalState.dragStartX;
        const dy = e.clientY - zoomModalState.dragStartY;
        if (Math.hypot(dx - zoomModalState.panX, dy - zoomModalState.panY) > 4) {
          zoomModalState.dragMoved = true;
        }
        const clamped = clampPan(modal, dx, dy);
        zoomModalState.panX = clamped.x;
        zoomModalState.panY = clamped.y;
        applyZoomTransform(modal);
      } else if (e.pointerType === 'mouse') {
        // Effortless hover pan on desktop when zoomed in
        const rect = stage.getBoundingClientRect();
        const normX = ((e.clientX - rect.left) / rect.width - 0.5) * -2;
        const normY = ((e.clientY - rect.top) / rect.height - 0.5) * -2;
        const maxX = (rect.width * (zoomModalState.zoom - 1)) / 2.2;
        const maxY = (rect.height * (zoomModalState.zoom - 1)) / 2.2;
        zoomModalState.panX = normX * maxX;
        zoomModalState.panY = normY * maxY;
        applyZoomTransform(modal);
      }
    });

    const endDrag = () => {
      if (zoomModalState.isDragging) {
        zoomModalState.isDragging = false;
        applyZoomTransform(modal);
      }
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    stage.addEventListener('click', (e) => {
      if (e.target.closest('button') || zoomModalState.photos.length === 0) return;
      if (zoomModalState.dragMoved) {
        zoomModalState.dragMoved = false;
        return;
      }
      if (zoomModalState.zoom <= 1.05) {
        zoomModalState.zoom = 2;
      } else if (zoomModalState.zoom < 2.8) {
        zoomModalState.zoom = 3;
      } else {
        zoomModalState.zoom = 1;
      }
      applyZoomTransform(modal);
    });

    stage.addEventListener('wheel', (e) => {
      if (zoomModalState.photos.length === 0) return;
      e.preventDefault();
      stepZoom(e.deltaY < 0 ? 1 : -1);
    }, { passive: false });
  }

  // Modal Qty & Add to Cart
  const qtyMinus = modal.querySelector('#flpdpQtyMinus');
  const qtyPlus = modal.querySelector('#flpdpQtyPlus');
  const qtyVal = modal.querySelector('#flpdpQtyVal');
  const addCartBtn = modal.querySelector('#flpdpAddCartBtn');
  const quoteBtn = modal.querySelector('#flpdpQuoteBtn');

  const syncModalQtyUi = () => {
    const prod = zoomModalState.prod;
    if (!prod) return;
    const maxStock = prod.isService ? 999 : Math.max(0, Number(prod.stock) || 0);
    const outOfStock = !prod.isService && maxStock <= 0;
    if (qtyVal) qtyVal.textContent = outOfStock ? 0 : zoomModalState.qty;
    if (qtyMinus) qtyMinus.disabled = outOfStock || zoomModalState.qty <= 1;
    if (qtyPlus) qtyPlus.disabled = outOfStock || (!prod.isService && zoomModalState.qty >= maxStock);
    if (addCartBtn) addCartBtn.disabled = outOfStock;
  };

  qtyMinus?.addEventListener('click', () => {
    if (zoomModalState.qty > 1) {
      zoomModalState.qty -= 1;
      syncModalQtyUi();
    }
  });
  qtyPlus?.addEventListener('click', () => {
    const prod = zoomModalState.prod;
    if (!prod) return;
    const maxStock = prod.isService ? 999 : Math.max(0, Number(prod.stock) || 0);
    if (prod.isService || zoomModalState.qty < maxStock) {
      zoomModalState.qty += 1;
      syncModalQtyUi();
    } else {
      showStoreToast(`Stock máximo disponible: ${maxStock}`, 'warning');
    }
  });

  addCartBtn?.addEventListener('click', () => {
    const prod = zoomModalState.prod;
    if (!prod) return;
    const res = cartStore.addItem(prod, zoomModalState.qty);
    if (!res.ok) {
      showStoreToast(
        res.reason === 'out_of_stock'
          ? 'Producto temporalmente agotado para venta inmediata.'
          : `Solo hay ${res.maxStock} unidades disponibles en stock.`,
        'warning'
      );
      return;
    }
    showStoreToast(`${prod.name} agregado al carrito (${res.qty} en bolsa).`, 'success');
    closeModal();
    openCartDrawer();
  });

  quoteBtn?.addEventListener('click', () => {
    const prod = zoomModalState.prod;
    if (!prod) return;
    closeModal();
    const issueMsg = `Cotización formal: ${zoomModalState.qty}x ${prod.name}${prod.sku ? ` (${prod.sku})` : ''}`;
    if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html')) {
      prefillHomeTicketAndScroll(issueMsg);
    } else {
      window.location.href = `/?ticket=${encodeURIComponent(issueMsg)}#modulo-ticket`;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (modal.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft' && zoomModalState.photos.length > 1) {
      setModalPhotoIndex(modal, zoomModalState.photoIdx - 1);
    }
    if (e.key === 'ArrowRight' && zoomModalState.photos.length > 1) {
      setModalPhotoIndex(modal, zoomModalState.photoIdx + 1);
    }
  });

  modal._syncModalQtyUi = syncModalQtyUi;
  return modal;
}

export function openProductZoomModal(prod, initialPhotoIdx = 0) {
  if (!prod) return;
  const modal = ensureZoomModal();
  const photos = getProductPhotos(prod);
  const catMeta = CATEGORY_META[prod.category || 'pos'] || CATEGORY_META.pos;

  zoomModalState.prod = prod;
  zoomModalState.photos = photos;
  zoomModalState.photoIdx = Math.max(0, Math.min(initialPhotoIdx, Math.max(0, photos.length - 1)));
  zoomModalState.zoom = 1;
  zoomModalState.panX = 0;
  zoomModalState.panY = 0;
  zoomModalState.qty = 1;

  const metaEl = modal.querySelector('#flpdpMeta');
  const titleEl = modal.querySelector('#flpdpTitle');
  const mainImg = modal.querySelector('#flpdpMainImg');
  const fallbackStage = modal.querySelector('#flpdpFallbackStage');
  const fallbackIcon = modal.querySelector('#flpdpFallbackIcon');
  const fallbackSku = modal.querySelector('#flpdpFallbackSku');
  const prevBtn = modal.querySelector('#flpdpPrevPhoto');
  const nextBtn = modal.querySelector('#flpdpNextPhoto');
  const counterEl = modal.querySelector('#flpdpPhotoCounter');
  const zoomToolbar = modal.querySelector('#flpdpZoomToolbar');
  const thumbsWrap = modal.querySelector('#flpdpThumbs');
  const hintEl = modal.querySelector('#flpdpZoomHint');

  const stockEl = modal.querySelector('#flpdpStock');
  const deliveryEl = modal.querySelector('#flpdpDelivery');
  const priceEl = modal.querySelector('#flpdpPrice');
  const descEl = modal.querySelector('#flpdpDesc');
  const specsWrap = modal.querySelector('#flpdpSpecsWrap');
  const specsList = modal.querySelector('#flpdpSpecs');
  const waBtn = modal.querySelector('#flpdpWaBtn');

  if (metaEl) metaEl.textContent = `${catMeta.label}${prod.sku ? ` · ${prod.sku}` : ''}`;
  if (titleEl) titleEl.textContent = prod.name;

  const stockNum = Number(prod.stock) || 0;
  const minStockNum = Number(prod.minStock) || 2;
  const isOutOfStock = !prod.isService && stockNum <= 0;
  const isLowStock = !prod.isService && stockNum > 0 && stockNum <= minStockNum;

  if (stockEl) {
    stockEl.textContent = prod.isService
      ? 'Servicio disponible'
      : isOutOfStock
        ? 'Agotado · Bajo pedido'
        : isLowStock
          ? `Últimas ${stockNum} piezas disponibles`
          : `${stockNum} ${prod.unit === 'kit' ? 'kits' : 'piezas'} disponibles`;
    stockEl.className = `font-label-mono-xs text-xs font-semibold tabular-nums ${
      isOutOfStock ? 'text-status-alert' : isLowStock ? 'text-status-warning' : 'text-neon-emerald'
    }`;
  }
  if (deliveryEl) {
    deliveryEl.textContent = isOutOfStock ? 'Tiempo de surtido 24-48h' : 'Entrega hoy · Teziutlán';
  }

  const priceVal = Math.round(parseFloat(prod.price) || 0);
  const unitSuffix = prod.unit === 'metro' ? ' / metro' : '';
  if (priceEl) priceEl.textContent = `$${priceVal.toLocaleString('es-MX')} MXN${unitSuffix}`;
  if (descEl) descEl.textContent = prod.description || 'Equipamiento homologado con garantía directa en Teziutlán y soporte técnico Fiberlink.';

  const specs = Array.isArray(prod.specs) ? prod.specs.filter(Boolean) : [];
  if (specsWrap && specsList) {
    if (specs.length > 0) {
      specsWrap.classList.remove('hidden');
      specsWrap.classList.add('flex');
      specsList.innerHTML = specs.map((s) => `
        <li class="flex items-start gap-2 font-body-sm text-xs text-text-secondary">
          <span class="material-symbols-outlined text-[15px] text-neon-emerald shrink-0 mt-0.5" aria-hidden="true">check_circle</span>
          <span>${escapeHtml(s)}</span>
        </li>
      `).join('');
    } else {
      specsWrap.classList.add('hidden');
      specsWrap.classList.remove('flex');
    }
  }

  if (waBtn) {
    waBtn.href = `https://wa.me/522311024672?text=${encodeURIComponent(
      `Hola Fiberlink, me interesa comprar: ${prod.name} ($${priceVal.toLocaleString('es-MX')} MXN).`
    )}`;
  }

  if (photos.length > 0) {
    mainImg?.classList.remove('hidden');
    fallbackStage?.classList.add('hidden');
    fallbackStage?.classList.remove('flex');
    zoomToolbar?.classList.remove('hidden');
    hintEl?.classList.remove('hidden');

    const multi = photos.length > 1;
    prevBtn?.classList.toggle('hidden', !multi);
    prevBtn?.classList.toggle('flex', multi);
    nextBtn?.classList.toggle('hidden', !multi);
    nextBtn?.classList.toggle('flex', multi);
    counterEl?.classList.toggle('hidden', !multi);

    if (thumbsWrap) {
      if (multi) {
        thumbsWrap.classList.remove('hidden');
        thumbsWrap.innerHTML = photos.map((src, i) => `
          <button type="button" data-thumb-idx="${i}" class="w-16 h-16 shrink-0 rounded-xl border ${i === zoomModalState.photoIdx ? 'border-primary-container ring-2 ring-primary-container/40' : 'border-glass'} bg-surface-container-low p-1.5 overflow-hidden transition-all">
            <img src="${escapeHtml(src)}" alt="Vista ${i + 1}" class="w-full h-full object-contain">
          </button>
        `).join('');
        thumbsWrap.querySelectorAll('button[data-thumb-idx]').forEach((btn) => {
          btn.addEventListener('click', () => setModalPhotoIndex(modal, Number(btn.dataset.thumbIdx)));
        });
      } else {
        thumbsWrap.classList.add('hidden');
        thumbsWrap.innerHTML = '';
      }
    }

    setModalPhotoIndex(modal, zoomModalState.photoIdx);
  } else {
    mainImg?.classList.add('hidden');
    fallbackStage?.classList.remove('hidden');
    fallbackStage?.classList.add('flex');
    if (fallbackIcon) fallbackIcon.textContent = catMeta.icon;
    if (fallbackSku) fallbackSku.textContent = prod.sku || catMeta.label;
    zoomToolbar?.classList.add('hidden');
    hintEl?.classList.add('hidden');
    prevBtn?.classList.add('hidden');
    nextBtn?.classList.add('hidden');
    counterEl?.classList.add('hidden');
    if (thumbsWrap) thumbsWrap.innerHTML = '';
  }

  modal._syncModalQtyUi?.();
  modal.style.zIndex = '1350';
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

// ==========================================
// 2. SLIDE-OVER SHOPPING CART DRAWER
// ==========================================
let cartDeliveryMode = 'Envío local en Teziutlán';
let cartCloseTimer = null;

function ensureCartDrawer() {
  let drawer = document.getElementById('flCartDrawer');
  if (drawer) return drawer;

  drawer = document.createElement('div');
  drawer.id = 'flCartDrawer';
  drawer.className = 'fixed inset-0 z-[1380] hidden justify-end bg-black/70 backdrop-blur-sm';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-labelledby', 'flCartDrawerTitle');
  drawer.setAttribute('aria-hidden', 'true');

  drawer.innerHTML = `
    <div id="flCartPanel" class="relative w-full max-w-md h-full bg-panel border-l border-glass shadow-2xl flex flex-col transform translate-x-full transition-transform duration-200">
      <!-- Drawer Header -->
      <div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-glass bg-panel-2 shrink-0">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-panel border border-primary-container/35 flex items-center justify-center text-neon-emerald shrink-0">
            <span class="material-symbols-outlined text-[20px]">shopping_bag</span>
          </div>
          <div class="min-w-0">
            <h3 id="flCartDrawerTitle" class="font-headline-sm text-base text-text-primary font-bold leading-tight truncate">Carrito de Compra</h3>
            <p class="font-label-mono-xs text-[11px] text-text-secondary tabular-nums"><span id="flCartDrawerCount">0</span> artículos seleccionados</p>
          </div>
        </div>
        <button type="button" id="flCartCloseBtn" aria-label="Cerrar carrito" class="w-9 h-9 rounded-lg bg-surface-container-low border border-glass text-text-secondary hover:text-text-primary flex items-center justify-center shrink-0 transition-colors">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <!-- Free Shipping Progress -->
      <div id="flCartShippingBarWrap" class="px-5 py-3 bg-surface-container-low border-b border-glass shrink-0">
        <div class="flex items-center justify-between gap-2 text-xs mb-1.5">
          <span id="flCartShippingMsg" class="font-body-sm text-xs text-text-secondary"></span>
          <span class="font-label-mono-xs text-[11px] text-neon-emerald font-bold tabular-nums" id="flCartShippingPct">0%</span>
        </div>
        <div class="w-full h-1.5 rounded-full bg-surface-overlay overflow-hidden">
          <div id="flCartShippingProgress" class="h-full rounded-full bg-primary-container transition-all duration-300" style="width: 0%;"></div>
        </div>
      </div>

      <!-- Cart Items List -->
      <div id="flCartItemsList" class="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3"></div>

      <!-- Drawer Footer Checkout -->
      <div id="flCartFooter" class="p-4 sm:p-5 border-t border-glass bg-panel-2 flex flex-col gap-3 shrink-0">
        <div class="flex flex-col gap-1.5">
          <span class="font-label-mono-xs text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">Modalidad de entrega</span>
          <div class="grid grid-cols-3 gap-1.5" id="flCartDeliveryOptions">
            <button type="button" data-delivery="Envío local en Teziutlán" class="py-1.5 px-2 rounded-lg border text-[11px] font-button-text font-semibold transition-all text-center">Envío local</button>
            <button type="button" data-delivery="Recoger en sucursal Centro" class="py-1.5 px-2 rounded-lg border text-[11px] font-button-text font-semibold transition-all text-center">En tienda</button>
            <button type="button" data-delivery="Entrega con instalación en sitio" class="py-1.5 px-2 rounded-lg border text-[11px] font-button-text font-semibold transition-all text-center">Instalación</button>
          </div>
        </div>

        <input type="text" id="flCartCustomerNote" placeholder="Dirección breve o nota para tu pedido (opcional)" class="w-full !h-9 !py-0 !px-3 !rounded-lg bg-surface-container-lowest border border-glass text-text-primary !font-body-sm !text-xs placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-neon-emerald" autocomplete="off">

        <div class="flex items-baseline justify-between pt-1">
          <div>
            <span class="font-body-sm text-xs text-text-secondary block">Subtotal estimado</span>
            <span class="font-label-mono-xs text-[10px] text-neon-emerald">Precio neto · Entrega local</span>
          </div>
          <span id="flCartSubtotal" class="font-headline-lg text-xl font-bold text-text-primary tabular-nums">$0 MXN</span>
        </div>

        <a id="flCartWaCheckout" href="#" target="_blank" rel="noopener noreferrer" class="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-primary-container hover:bg-primary-fixed text-on-brand font-button-text text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all">
          <span class="material-symbols-outlined text-[18px]">send</span>
          <span>Enviar Pedido por WhatsApp</span>
        </a>

        <div class="flex items-center gap-2">
          <button type="button" id="flCartQuoteBtn" class="flex-1 py-2 px-3 rounded-lg bg-panel border border-glass hover:border-primary-container/50 text-text-primary hover:text-neon-emerald font-button-text text-xs font-semibold flex items-center justify-center gap-1.5 transition-all">
            <span class="material-symbols-outlined text-[15px]">confirmation_number</span>
            <span>Cotizar en Ticket</span>
          </button>
          <button type="button" id="flCartClearBtn" class="py-2 px-3 rounded-lg bg-surface-container-low border border-glass hover:border-status-alert/50 text-text-secondary hover:text-status-alert font-button-text text-xs font-semibold flex items-center justify-center gap-1 transition-all">
            <span class="material-symbols-outlined text-[15px]">delete_sweep</span>
            <span>Vaciar</span>
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(drawer);

  drawer.addEventListener('click', (e) => {
    if (e.target === drawer) closeCartDrawer();
  });
  drawer.querySelector('#flCartCloseBtn')?.addEventListener('click', closeCartDrawer);

  const noteInput = drawer.querySelector('#flCartCustomerNote');
  const waBtn = drawer.querySelector('#flCartWaCheckout');

  const syncWaHref = () => {
    if (waBtn) {
      waBtn.href = cartStore.buildWhatsAppOrderUrl({
        deliveryMode: cartDeliveryMode,
        customerNote: noteInput?.value || ''
      });
    }
  };

  noteInput?.addEventListener('input', syncWaHref);

  const deliveryBtns = drawer.querySelectorAll('#flCartDeliveryOptions button[data-delivery]');
  const syncDeliveryBtns = () => {
    deliveryBtns.forEach((btn) => {
      const active = btn.dataset.delivery === cartDeliveryMode;
      btn.classList.toggle('bg-primary-container', active);
      btn.classList.toggle('text-on-brand', active);
      btn.classList.toggle('border-primary-container', active);
      btn.classList.toggle('bg-surface-container-low', !active);
      btn.classList.toggle('text-text-secondary', !active);
      btn.classList.toggle('border-glass', !active);
    });
    syncWaHref();
  };
  deliveryBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      cartDeliveryMode = btn.dataset.delivery || 'Envío local en Teziutlán';
      syncDeliveryBtns();
    });
  });
  syncDeliveryBtns();

  drawer.querySelector('#flCartClearBtn')?.addEventListener('click', () => {
    cartStore.clear();
    showStoreToast('Carrito vaciado.', 'info');
  });

  drawer.querySelector('#flCartQuoteBtn')?.addEventListener('click', () => {
    const summary = cartStore.buildQuoteSummaryText();
    closeCartDrawer();
    if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html')) {
      prefillHomeTicketAndScroll(summary);
    } else {
      window.location.href = `/?ticket=${encodeURIComponent(summary)}#modulo-ticket`;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !drawer.classList.contains('hidden')) {
      closeCartDrawer();
    }
  });

  renderCartDrawer();
  return drawer;
}

function renderCartDrawer() {
  const drawer = document.getElementById('flCartDrawer');
  if (!drawer) return;

  const items = cartStore.getItems();
  const count = cartStore.getCount();
  const subtotal = cartStore.getSubtotal();

  const countEl = drawer.querySelector('#flCartDrawerCount');
  const subtotalEl = drawer.querySelector('#flCartSubtotal');
  const listEl = drawer.querySelector('#flCartItemsList');
  const footerEl = drawer.querySelector('#flCartFooter');
  const waBtn = drawer.querySelector('#flCartWaCheckout');
  const noteInput = drawer.querySelector('#flCartCustomerNote');

  const shipMsg = drawer.querySelector('#flCartShippingMsg');
  const shipPct = drawer.querySelector('#flCartShippingPct');
  const shipBar = drawer.querySelector('#flCartShippingProgress');

  if (countEl) countEl.textContent = count;
  if (subtotalEl) subtotalEl.textContent = `$${subtotal.toLocaleString('es-MX')} MXN`;

  const pct = Math.min(100, Math.round((subtotal / cartStore.FREE_SHIPPING_THRESHOLD) * 100));
  if (shipPct) shipPct.textContent = `${pct}%`;
  if (shipBar) shipBar.style.width = `${pct}%`;
  if (shipMsg) {
    if (subtotal >= cartStore.FREE_SHIPPING_THRESHOLD) {
      shipMsg.innerHTML = `<strong class="text-neon-emerald">¡Envío local GRATIS desbloqueado</strong> en Teziutlán`;
    } else if (subtotal === 0) {
      shipMsg.textContent = `Envío local gratis en compras desde $${cartStore.FREE_SHIPPING_THRESHOLD.toLocaleString('es-MX')} MXN`;
    } else {
      const missing = (cartStore.FREE_SHIPPING_THRESHOLD - subtotal).toLocaleString('es-MX');
      shipMsg.innerHTML = `Te faltan <strong class="text-text-primary">$${missing} MXN</strong> para envío local gratis`;
    }
  }

  if (waBtn) {
    waBtn.href = cartStore.buildWhatsAppOrderUrl({
      deliveryMode: cartDeliveryMode,
      customerNote: noteInput?.value || ''
    });
  }

  if (!listEl || !footerEl) return;

  if (items.length === 0) {
    footerEl.classList.add('hidden');
    listEl.innerHTML = `
      <div class="flex-1 flex flex-col items-center justify-center text-center py-10 px-4 gap-3">
        <div class="w-16 h-16 rounded-2xl bg-surface-container-low border border-glass flex items-center justify-center text-text-tertiary">
          <span class="material-symbols-outlined text-[32px]">shopping_cart</span>
        </div>
        <h4 class="font-headline-sm text-base text-text-primary font-bold">Tu carrito está vacío</h4>
        <p class="font-body-sm text-xs text-text-secondary max-w-xs leading-relaxed">
          Agrega impresoras térmicas, cajones de dinero, cámaras CCTV o licencias originales para armar tu pedido.
        </p>
        <a href="/catalogo.html" class="mt-1 px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary-fixed text-on-brand font-button-text text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all">
          <span class="material-symbols-outlined text-[16px]">storefront</span>
          <span>Explorar Tienda Completa</span>
        </a>
      </div>
    `;
    return;
  }

  footerEl.classList.remove('hidden');
  listEl.innerHTML = items.map((item) => {
    const catMeta = CATEGORY_META[item.category || 'pos'] || CATEGORY_META.pos;
    const itemTotal = (item.price * item.qty).toLocaleString('es-MX');
    const thumbHtml = item.imageUrl
      ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" class="w-full h-full object-contain">`
      : `<span class="material-symbols-outlined text-[24px] text-neon-emerald">${catMeta.icon}</span>`;

    return `
      <div data-cart-row="${escapeHtml(item.id)}" class="p-3 rounded-xl bg-surface-container-low border border-glass flex items-start gap-3">
        <div class="w-16 h-16 rounded-lg bg-panel border border-glass p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
          ${thumbHtml}
        </div>
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <span class="font-label-mono-xs text-[10px] text-neon-emerald uppercase tracking-wider block truncate">${escapeHtml(item.sku || catMeta.label)}</span>
              <h4 class="font-button-text text-xs sm:text-sm text-text-primary font-semibold leading-snug line-clamp-2">${escapeHtml(item.name)}</h4>
            </div>
            <button type="button" data-cart-remove="${escapeHtml(item.id)}" aria-label="Eliminar ${escapeHtml(item.name)}" class="text-text-tertiary hover:text-status-alert p-1 transition-colors shrink-0">
              <span class="material-symbols-outlined text-[17px]">delete_outline</span>
            </button>
          </div>
          <div class="flex items-center justify-between gap-2 pt-1">
            <div class="flex items-center rounded-lg bg-panel border border-glass p-0.5">
              <button type="button" data-cart-minus="${escapeHtml(item.id)}" aria-label="Quitar uno" class="w-7 h-7 rounded hover:bg-surface-overlay text-text-primary font-bold flex items-center justify-center text-sm">−</button>
              <span class="w-7 text-center font-label-mono-xs text-xs font-bold text-text-primary tabular-nums">${item.qty}</span>
              <button type="button" data-cart-plus="${escapeHtml(item.id)}" aria-label="Agregar uno" class="w-7 h-7 rounded hover:bg-surface-overlay text-text-primary font-bold flex items-center justify-center text-sm disabled:opacity-35 disabled:cursor-not-allowed" ${!item.isService && item.qty >= item.maxStock ? 'disabled' : ''}>+</button>
            </div>
            <div class="text-right">
              <span class="font-headline-sm text-sm font-bold text-text-primary tabular-nums block">$${itemTotal} <span class="text-[10px] font-normal text-text-tertiary">MXN</span></span>
              <span class="font-label-mono-xs text-[10px] text-text-tertiary tabular-nums">$${item.price.toLocaleString('es-MX')} c/u</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('[data-cart-minus]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cart-minus');
      const curr = cartStore.getItemQty(id);
      cartStore.setQty(id, curr - 1);
    });
  });
  listEl.querySelectorAll('[data-cart-plus]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cart-plus');
      const map = cartStore.getCartMap();
      const entry = map[id];
      if (!entry) return;
      if (!entry.isService && entry.qty >= entry.maxStock) {
        showStoreToast(`Stock máximo disponible: ${entry.maxStock}`, 'warning');
        return;
      }
      cartStore.setQty(id, entry.qty + 1);
    });
  });
  listEl.querySelectorAll('[data-cart-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cart-remove');
      cartStore.removeItem(id);
    });
  });
}

export function openCartDrawer() {
  if (cartCloseTimer) {
    clearTimeout(cartCloseTimer);
    cartCloseTimer = null;
  }
  const drawer = ensureCartDrawer();
  renderCartDrawer();
  drawer.style.zIndex = '1380';
  drawer.classList.remove('hidden');
  drawer.classList.add('flex');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    const panel = drawer.querySelector('#flCartPanel');
    if (panel) panel.classList.remove('translate-x-full');
  });
}

export function closeCartDrawer() {
  const drawer = document.getElementById('flCartDrawer');
  if (!drawer) return;
  const panel = drawer.querySelector('#flCartPanel');
  if (panel) panel.classList.add('translate-x-full');
  if (cartCloseTimer) clearTimeout(cartCloseTimer);
  cartCloseTimer = setTimeout(() => {
    cartCloseTimer = null;
    drawer.classList.add('hidden');
    drawer.classList.remove('flex');
    drawer.setAttribute('aria-hidden', 'true');
    const zoomModal = document.getElementById('flProductZoomModal');
    if (!zoomModal || zoomModal.classList.contains('hidden')) {
      document.body.style.overflow = '';
    }
  }, 190);
}

export function prefillHomeTicketAndScroll(summaryText) {
  const ticketSection = document.getElementById('modulo-ticket');
  const issueInput = document.getElementById('client-issue');
  if (typeof window.switchConsoleTab === 'function') window.switchConsoleTab('create');
  if (typeof window.goToStep === 'function') window.goToStep(3);
  if (issueInput) issueInput.value = summaryText;
  if (ticketSection) ticketSection.scrollIntoView({ behavior: 'smooth' });
}

let cartWidgetsInitialized = false;

export function initCartWidgets() {
  ensureCartDrawer();
  if (cartWidgetsInitialized) {
    renderCartDrawer();
    return;
  }
  cartWidgetsInitialized = true;

  cartStore.subscribe(({ count, subtotal }) => {
    document.querySelectorAll('.fl-cart-count, #headerCartCount, #cart-item-count').forEach((el) => {
      el.textContent = count;
    });
    document.querySelectorAll('.fl-cart-subtotal, #cart-total-amount').forEach((el) => {
      el.textContent = subtotal.toLocaleString('es-MX');
    });
    document.querySelectorAll('.fl-cart-badge-pill').forEach((el) => {
      el.classList.toggle('hidden', count === 0);
    });
    renderCartDrawer();
  });

  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open-cart], #homeCartOpenBtn, #headerCartBtn, #storeCartBtn');
    if (!opener) return;
    e.preventDefault();
    openCartDrawer();
  });
}

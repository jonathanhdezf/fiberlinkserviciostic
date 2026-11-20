import { storeService, STARTER_PRODUCTS } from './services/storeService.js';

const CATEGORY_ORDER = ['pos', 'cctv', 'redes', 'software', 'refacciones', 'servicios'];
const CATEGORY_META = {
  pos: { tabLabel: 'Puntos de Venta (POS)', badge: 'PUNTO DE VENTA' },
  cctv: { tabLabel: 'Cámaras & Seguridad', badge: 'VIDEOVIGILANCIA' },
  redes: { tabLabel: 'Redes & Conectividad', badge: 'REDES & FIBRA' },
  software: { tabLabel: 'Licencias & Software', badge: 'SOFTWARE ORIGINAL' },
  refacciones: { tabLabel: 'Refacciones & Cómputo', badge: 'REFACCIONES' },
  servicios: { tabLabel: 'Servicio Técnico', badge: 'SERVICIO TIC' }
};

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getProductPhotos(p) {
  if (Array.isArray(p?.images) && p.images.length > 0) {
    return p.images.filter((x) => typeof x === 'string' && x.trim());
  }
  return p?.imageUrl ? [String(p.imageUrl).trim()] : [];
}

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('catalogProductsContainer');
  const tabsWrap = document.getElementById('catalogFilterTabs');
  const searchInput = document.getElementById('catalogSearch');
  const clearBtn = document.getElementById('catalogClearSearch');
  const emptyState = document.getElementById('catalogEmptyState');
  const resetBtn = document.getElementById('catalogResetFilters');

  if (!container) return;

  let allItems = [];
  let currentCategory = 'all';
  let searchQuery = '';

  function ensureLightbox() {
    let modal = document.getElementById('catalogGalleryLightbox');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'catalogGalleryLightbox';
    modal.style.cssText = 'position:fixed;inset:0;z-index:1400;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(4,7,3,0.86);backdrop-filter:blur(6px);';
    modal.innerHTML = `
      <div style="width:100%;max-width:680px;max-height:90vh;overflow-y:auto;background:var(--fondo, #0c110a);border:1px solid rgba(156,195,46,0.35);border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,0.85);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;border-bottom:1px solid rgba(156,195,46,0.2);">
          <div style="min-width:0;">
            <div id="clbSku" style="font-family:var(--mono);font-size:0.72rem;color:var(--verde);letter-spacing:0.06em;">SKU</div>
            <h3 id="clbTitle" style="font-family:var(--euro);font-size:1.05rem;color:var(--blanco);margin:2px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Producto</h3>
          </div>
          <button type="button" id="clbClose" aria-label="Cerrar galería" style="width:36px;height:36px;border-radius:8px;border:1px solid rgba(156,195,46,0.3);background:rgba(255,255,255,0.06);color:var(--blanco);font-size:1.1rem;cursor:pointer;">✕</button>
        </div>
        <div style="padding:18px 20px;display:flex;flex-direction:column;gap:14px;">
          <div style="width:100%;height:300px;border-radius:12px;background:rgba(0,0,0,0.35);border:1px solid rgba(156,195,46,0.2);display:flex;align-items:center;justify-content:center;padding:14px;overflow:hidden;">
            <img id="clbMainImg" src="" alt="" style="max-width:100%;max-height:100%;object-fit:contain;">
          </div>
          <div id="clbThumbs" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;"></div>
          <p id="clbDesc" style="font-size:0.88rem;color:var(--muted);line-height:1.5;margin:0;"></p>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:12px;border-top:1px solid rgba(156,195,46,0.2);">
            <strong id="clbPrice" style="font-family:var(--euro);font-size:1.25rem;color:var(--verde);"></strong>
            <a id="clbWaBtn" href="#" target="_blank" rel="noopener" class="prod-btn-wa" style="width:auto;padding:10px 18px;text-decoration:none;">Pedir por WhatsApp</a>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeModal = () => {
      modal.style.display = 'none';
    };
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    modal.querySelector('#clbClose')?.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') closeModal();
    });

    return modal;
  }

  function openProductGallery(prod) {
    const photos = getProductPhotos(prod);
    if (photos.length === 0) return;

    const modal = ensureLightbox();
    const skuEl = modal.querySelector('#clbSku');
    const titleEl = modal.querySelector('#clbTitle');
    const mainImg = modal.querySelector('#clbMainImg');
    const thumbsEl = modal.querySelector('#clbThumbs');
    const descEl = modal.querySelector('#clbDesc');
    const priceEl = modal.querySelector('#clbPrice');
    const waBtn = modal.querySelector('#clbWaBtn');

    const catMeta = CATEGORY_META[prod.category] || CATEGORY_META.pos;
    if (skuEl) skuEl.textContent = `[${catMeta.badge}]${prod.sku ? ` · ${prod.sku}` : ''}`;
    if (titleEl) titleEl.textContent = prod.name;
    if (mainImg) {
      mainImg.src = photos[0];
      mainImg.alt = prod.name;
    }
    if (descEl) descEl.textContent = prod.description || 'Equipamiento homologado con garantía directa Fiberlink.';
    const priceVal = Math.round(parseFloat(prod.price) || 0);
    if (priceEl) priceEl.textContent = `$${priceVal.toLocaleString('es-MX')} MXN`;
    if (waBtn) {
      waBtn.href = `https://wa.me/522311024672?text=${encodeURIComponent(`Hola Fiberlink, me interesa comprar: ${prod.name} ($${priceVal.toLocaleString('es-MX')} MXN)`)}`;
    }

    if (thumbsEl) {
      thumbsEl.innerHTML = photos.map((src, i) => `
        <button type="button" data-idx="${i}" style="width:62px;height:62px;flex-shrink:0;border-radius:8px;padding:4px;background:rgba(0,0,0,0.35);cursor:pointer;border:2px solid ${i === 0 ? 'var(--verde)' : 'rgba(156,195,46,0.2)'};">
          <img src="${escapeHtml(src)}" alt="Vista ${i + 1}" style="width:100%;height:100%;object-fit:contain;">
        </button>
      `).join('');

      thumbsEl.querySelectorAll('button[data-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.idx);
          if (mainImg) mainImg.src = photos[i];
          thumbsEl.querySelectorAll('button[data-idx]').forEach((b) => {
            b.style.borderColor = 'rgba(156,195,46,0.2)';
          });
          btn.style.borderColor = 'var(--verde)';
        });
      });
    }

    modal.style.display = 'flex';
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

    const tabsHtml = [
      `<button class="cat-tab-btn ${currentCategory === 'all' ? 'active' : ''}" data-category="all" type="button">Todos los Productos (${counts.all})</button>`
    ];

    CATEGORY_ORDER.forEach((catKey) => {
      if ((counts[catKey] || 0) > 0) {
        const label = CATEGORY_META[catKey]?.tabLabel || catKey;
        tabsHtml.push(
          `<button class="cat-tab-btn ${currentCategory === catKey ? 'active' : ''}" data-category="${catKey}" type="button">${escapeHtml(label)} (${counts[catKey]})</button>`
        );
      }
    });

    tabsWrap.innerHTML = tabsHtml.join('');
    tabsWrap.querySelectorAll('.cat-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentCategory = btn.getAttribute('data-category') || 'all';
        renderTabs();
        renderCards();
      });
    });
  }

  function renderCards() {
    const q = searchQuery.toLowerCase().trim();
    const filtered = allItems.filter((p) => {
      const matchesCat = currentCategory === 'all' || (p.category || 'pos') === currentCategory;
      if (!matchesCat) return false;
      if (!q) return true;
      const hay = `${p.name || ''} ${p.sku || ''} ${p.description || ''} ${p.category || ''} ${(Array.isArray(p.specs) ? p.specs.join(' ') : '')}`.toLowerCase();
      return hay.includes(q);
    });

    if (filtered.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    container.innerHTML = filtered.map((p) => {
      const catKey = p.category || 'pos';
      const catMeta = CATEGORY_META[catKey] || CATEGORY_META.pos;
      const photos = getProductPhotos(p);
      const cover = photos[0] || '';
      const stockNum = Number(p.stock) || 0;
      const priceVal = Math.round(parseFloat(p.price) || 0);
      const priceStr = `$${priceVal.toLocaleString('es-MX')}`;
      const unitLabel = p.unit === 'metro' ? 'MXN / metro' : 'MXN';
      const statusText = p.isService
        ? 'Servicio disponible'
        : stockNum > 0
          ? `${stockNum} en stock`
          : 'Bajo pedido';

      const specsArr = Array.isArray(p.specs) ? p.specs.slice(0, 5) : [];
      const specsHtml = specsArr.map((s) => `
        <li>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>${escapeHtml(s)}</span>
        </li>
      `).join('');

      const mediaHtml = cover
        ? `
          <div class="prod-media-box" data-gallery-id="${escapeHtml(p.id)}" style="cursor:pointer;" title="${photos.length > 1 ? `Ver ${photos.length} fotografías` : 'Ampliar fotografía'}">
            <img src="${escapeHtml(cover)}" alt="${escapeHtml(p.name)}" loading="lazy" referrerpolicy="no-referrer" />
            ${photos.length > 1 ? `<span style="position:absolute;bottom:8px;right:10px;font-family:var(--mono);font-size:0.68rem;padding:2px 8px;border-radius:6px;background:rgba(10,14,8,0.88);border:1px solid rgba(156,195,46,0.4);color:var(--verde);">📷 1/${photos.length}</span>` : ''}
          </div>
        `
        : `
          <div class="prod-icon-box">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 9h6v6H9z"/></svg>
          </div>
        `;

      const waUrl = `https://wa.me/522311024672?text=${encodeURIComponent(`Hola Fiberlink, me interesa comprar: ${p.name} (${priceStr} MXN)`)}`;

      return `
        <article class="prod-card" data-category="${escapeHtml(catKey)}">
          <div class="prod-meta-bar">
            <span class="prod-cat-badge">[${escapeHtml(catMeta.badge)}${p.sku ? ` · ${escapeHtml(p.sku)}` : ''}]</span>
            <span class="prod-status-tag"><span class="prod-status-dot"></span> ${escapeHtml(statusText)}</span>
          </div>
          ${mediaHtml}
          <h2 class="prod-title">${escapeHtml(p.name)}</h2>
          <p class="prod-desc">${escapeHtml(p.description || 'Equipamiento homologado con garantía directa en Teziutlán y soporte técnico Fiberlink.')}</p>
          <div class="prod-price-bar">
            <span class="prod-price-label">Precio Fiberlink</span>
            <div>
              <span class="prod-price-amount">${priceStr}</span>
              <span class="prod-price-currency">${escapeHtml(unitLabel)}</span>
            </div>
          </div>
          ${specsHtml ? `<ul class="prod-specs">${specsHtml}</ul>` : ''}
          <div class="prod-warranty-bar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Garantía directa + soporte técnico Fiberlink</span>
          </div>
          <div class="prod-actions">
            <a class="prod-btn-wa" href="${waUrl}" target="_blank" rel="noopener">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
              <span>Pedir por WhatsApp (${priceStr} MXN)</span>
            </a>
            <button class="prod-btn-sub open-ticket" type="button" data-service="${escapeHtml(p.name)}">Solicitar Cotización Formal &rarr;</button>
          </div>
        </article>
      `;
    }).join('');

    // Wire image error fallback + gallery lightbox + ticket redirect
    container.querySelectorAll('[data-gallery-id]').forEach((box) => {
      const id = box.getAttribute('data-gallery-id');
      const prod = allItems.find((x) => x.id === id);
      if (!prod) return;
      const img = box.querySelector('img');
      if (img) {
        img.addEventListener('error', () => {
          img.src = '/logo.gif';
        }, { once: true });
      }
      box.addEventListener('click', () => openProductGallery(prod));
    });

    container.querySelectorAll('.open-ticket').forEach((btn) => {
      btn.addEventListener('click', () => {
        const srv = btn.getAttribute('data-service') || 'Equipamiento y Licencias';
        window.location.href = `/?ticket=${encodeURIComponent(srv)}#inicio`;
      });
    });
  }

  function applyCatalog(list) {
    allItems = Array.isArray(list) ? list.filter((p) => p && p.publicVisible !== false) : [];
    renderTabs();
    renderCards();
  }

  // Search Input
  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    if (clearBtn) {
      clearBtn.style.display = searchQuery ? 'flex' : 'none';
    }
    renderCards();
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      searchQuery = '';
      clearBtn.style.display = 'none';
      renderCards();
      searchInput.focus();
    }
  });

  resetBtn?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      searchQuery = '';
    }
    if (clearBtn) clearBtn.style.display = 'none';
    currentCategory = 'all';
    renderTabs();
    renderCards();
  });

  // Top header/banner ticket triggers
  document.querySelectorAll('body .open-ticket').forEach((btn) => {
    btn.addEventListener('click', () => {
      const srv = btn.getAttribute('data-service') || 'Equipamiento y Licencias';
      window.location.href = `/?ticket=${encodeURIComponent(srv)}#inicio`;
    });
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
});

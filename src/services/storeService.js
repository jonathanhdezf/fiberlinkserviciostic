// ==========================================
// FIBERLINK STORE & INVENTORY SERVICE (Cloud Firestore)
// Real-time Store Catalog, Compressed Photo Uploads & Atomic Kardex Ledger
// ==========================================

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType
} from './firebase.js';

const ALLOWED_CATEGORIES = ['pos', 'cctv', 'redes', 'software', 'refacciones', 'servicios'];
const ALLOWED_MOVEMENT_TYPES = ['entrada', 'salida_venta', 'ajuste_conteo', 'ajuste_salida', 'merma', 'taller'];
const MAX_IMAGE_CHARS = 142000;
const MAX_IMAGES_COUNT = 6;
const MAX_DOC_ESTIMATED_CHARS = 860000;

function toIsoDate(val) {
  if (!val) return new Date().toISOString();
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  return String(val);
}

function sanitizeStr(val, maxLen, fallback = '') {
  const s = String(val ?? fallback).trim();
  if (!s && fallback) return String(fallback).slice(0, maxLen);
  return s.slice(0, maxLen);
}

function sanitizeCategory(cat) {
  return ALLOWED_CATEGORIES.includes(cat) ? cat : 'pos';
}

function sanitizeMovementType(mtype) {
  return ALLOWED_MOVEMENT_TYPES.includes(mtype) ? mtype : 'ajuste_conteo';
}

function sanitizeSpecs(specsInput) {
  const arr = Array.isArray(specsInput)
    ? specsInput
    : String(specsInput || '').split(',');
  return arr
    .map((s) => sanitizeStr(s, 140))
    .filter(Boolean)
    .slice(0, 20);
}

function sanitizeImages(imagesInput, fallbackImageUrl = '') {
  const raw = Array.isArray(imagesInput) && imagesInput.length > 0
    ? imagesInput
    : (fallbackImageUrl ? [fallbackImageUrl] : []);
  const clean = [];
  for (const item of raw) {
    if (clean.length >= MAX_IMAGES_COUNT) break;
    const str = String(item || '').trim();
    if (!str) continue;
    if (str.length > MAX_IMAGE_CHARS) {
      throw new Error('Una de las fotografías supera el tamaño máximo permitido tras compresión.');
    }
    clean.push(str);
  }
  return clean;
}

function normalizeProductDoc(id, data) {
  const images = Array.isArray(data.images)
    ? data.images.filter((x) => typeof x === 'string' && x.trim())
    : [];
  const imageUrl = (typeof data.imageUrl === 'string' && data.imageUrl.trim())
    ? data.imageUrl.trim()
    : (images[0] || '');
  const finalImages = images.length > 0 ? images : (imageUrl ? [imageUrl] : []);

  return {
    id: data.id || id,
    sku: data.sku || id.toUpperCase(),
    barcode: data.barcode || '',
    name: data.name || 'Artículo sin nombre',
    category: sanitizeCategory(data.category),
    cost: Math.max(0, Number(data.cost) || 0),
    price: Math.max(0, Number(data.price) || 0),
    stock: Math.max(0, Number(data.stock) || 0),
    minStock: Math.max(0, Number(data.minStock) || 0),
    unit: data.unit || (data.isService ? 'servicio' : 'pza'),
    isService: Boolean(data.isService),
    publicVisible: data.publicVisible !== false,
    description: data.description || '',
    specs: Array.isArray(data.specs) ? data.specs : [],
    images: finalImages,
    imageUrl: finalImages[0] || '',
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt)
  };
}

function normalizeMovementDoc(id, data) {
  return {
    id: data.id || id,
    folio: data.folio || 'KDX-1000',
    date: toIsoDate(data.date || data.createdAt),
    productId: data.productId || '',
    sku: data.sku || '',
    productName: data.productName || '',
    category: sanitizeCategory(data.category),
    type: sanitizeMovementType(data.type),
    reason: data.reason || '',
    reference: data.reference || '',
    stockBefore: Math.max(0, Number(data.stockBefore) || 0),
    quantity: Math.max(0, Number(data.quantity) || 0),
    delta: Number(data.delta) || 0,
    stockAfter: Math.max(0, Number(data.stockAfter) || 0),
    unitCost: Math.max(0, Number(data.unitCost) || 0),
    totalCost: Math.max(0, Number(data.totalCost) || 0),
    user: data.user || 'Sistema',
    createdAt: toIsoDate(data.createdAt)
  };
}

function generateKardexFolio() {
  const rand = Math.floor(100000 + Math.random() * 899999);
  return `KDX-${rand}`;
}

export const STARTER_PRODUCTS = [
  {
    id: 'prod-101',
    sku: 'POS-CAJ-01',
    barcode: '750104500101',
    name: 'Cajón de Dinero Volteck PDV-58C (5 Billetes · 8 Monedas)',
    category: 'pos',
    cost: 540.00,
    price: 890.00,
    stock: 14,
    minStock: 4,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Cajón metálico de uso rudo Grupo Truper con 5 divisiones de billetes, 8 de monedas y apertura automática RJ11.',
    specs: ['5 billetes / 8 monedas', 'Interfaz RJ11 a impresora', 'Cerradura de 3 posiciones'],
    images: ['/images/products/volteck-pdv-58c.webp'],
    imageUrl: '/images/products/volteck-pdv-58c.webp'
  },
  {
    id: 'prod-102',
    sku: 'POS-IMP-80I',
    barcode: '750104500102',
    name: 'Impresora Térmica 58/80mm Volteck PDV-80I (USB + Bluetooth)',
    category: 'pos',
    cost: 790.00,
    price: 1290.00,
    stock: 9,
    minStock: 3,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Impresora térmica directa para rollos de 58mm y 80mm, conexión USB + Bluetooth, velocidad 150mm/s y autocorte.',
    specs: ['Doble ancho 58mm y 80mm', 'USB + Bluetooth iOS/Android/Win', 'Guillotina de autocorte + RJ11'],
    images: [
      '/images/products/volteck-pdv-80i.webp',
      '/images/products/volteck-pdv-80i-puertos.webp',
      '/images/products/volteck-pdv-80i-dimensiones.webp',
      '/images/products/volteck-pdv-80i-caja.webp'
    ],
    imageUrl: '/images/products/volteck-pdv-80i.webp'
  },
  {
    id: 'prod-103',
    sku: 'POS-IMP-80',
    barcode: '750104500103',
    name: 'Impresora Térmica 80mm Autocorte USB + LAN Ethernet',
    category: 'pos',
    cost: 1250.00,
    price: 1980.00,
    stock: 6,
    minStock: 2,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Impresora de tickets 80mm para cocina y mostrador con cortador automático de guillotina y doble interfaz USB + Red LAN.',
    specs: ['Ancho 80mm con autocorte', 'USB + Ethernet LAN', 'Velocidad 260mm/s'],
    images: ['/images/products/volteck-pdv-80i-puertos.webp'],
    imageUrl: '/images/products/volteck-pdv-80i-puertos.webp'
  },
  {
    id: 'prod-104',
    sku: 'POS-LEC-2D',
    barcode: '750104500104',
    name: 'Lector de Código de Barras 1D/2D QR Inalámbrico',
    category: 'pos',
    cost: 520.00,
    price: 950.00,
    stock: 11,
    minStock: 3,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Escáner omnidireccional inalámbrico 2.4GHz + USB capaz de leer códigos impresos y en pantallas de celular.',
    specs: ['Lectura 1D, 2D y QR', 'Inalámbrico 2.4GHz + cable USB', 'Batería de larga duración'],
    images: [],
    imageUrl: ''
  },
  {
    id: 'prod-105',
    sku: 'CCTV-TAPO-C310',
    barcode: '750104500105',
    name: 'TP-Link Tapo C310 · Cámara Exterior 2K 3MP IP66',
    category: 'cctv',
    cost: 560.00,
    price: 890.00,
    stock: 18,
    minStock: 5,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Cámara de videovigilancia exterior IP66 Ultra HD 2K con conexión dual Wi-Fi/Ethernet, visión nocturna 30m y sirena.',
    specs: ['Resolución 2K 3MP (2304×1296)', 'Intemperie IP66 + Wi-Fi/LAN', 'Detección IA + Audio 2 vías'],
    images: ['/images/products/tapo-c310.webp'],
    imageUrl: '/images/products/tapo-c310.webp'
  },
  {
    id: 'prod-106',
    sku: 'CCTV-TAPO-C240D',
    barcode: '750104500106',
    name: 'TP-Link Tapo C240D · Doble Lente Pan/Tilt 2K+2K',
    category: 'cctv',
    cost: 1050.00,
    price: 1590.00,
    stock: 5,
    minStock: 2,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Tecnología Dual-Lens: visualiza panorama gran angular y zoom telefoto 3x simultáneamente con seguimiento inteligente por IA.',
    specs: ['Doble Lente 2K + 2K', 'Seguimiento sincronizado IA', 'MicroSD hasta 512GB'],
    images: ['/images/products/tapo-c240d.webp'],
    imageUrl: '/images/products/tapo-c240d.webp'
  },
  {
    id: 'prod-114',
    sku: 'CCTV-TAPO-C500',
    barcode: '750104500114',
    name: 'TP-Link Tapo C500 · Cámara Exterior Pan/Tilt 360° IP65',
    category: 'cctv',
    cost: 690.00,
    price: 1090.00,
    stock: 8,
    minStock: 3,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Cobertura total 360° horizontal y 130° vertical para exteriores con seguimiento de movimiento y alarma sonora configurable.',
    specs: ['Giro 360° Full HD 1080p', 'Resistencia exterior IP65', 'Seguimiento inteligente 360°'],
    images: ['/images/products/tapo-c500.webp'],
    imageUrl: '/images/products/tapo-c500.webp'
  },
  {
    id: 'prod-115',
    sku: 'CCTV-TAPO-C200',
    barcode: '750104500115',
    name: 'TP-Link Tapo C200 · Cámara Interior Pan/Tilt 1080p Blanca',
    category: 'cctv',
    cost: 340.00,
    price: 550.00,
    stock: 12,
    minStock: 4,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Cámara interior motorizada 360° Full HD con visión nocturna, detección de personas y audio bidireccional.',
    specs: ['Giro 360° Full HD 1080p', 'Audio bidireccional integrado', 'Modo privacidad física'],
    images: ['/images/products/tapo-c200.webp'],
    imageUrl: '/images/products/tapo-c200.webp'
  },
  {
    id: 'prod-107',
    sku: 'NET-UTP-CAT6',
    barcode: '750104500107',
    name: 'Cable UTP Cat6 100% Cobre (Por Metro)',
    category: 'redes',
    cost: 7.50,
    price: 15.00,
    stock: 280,
    minStock: 50,
    unit: 'metro',
    isService: false,
    publicVisible: true,
    description: 'Cable de red categoría 6 certificado 100% cobre calibre 23 AWG para enlaces gigabit y alimentación PoE estable.',
    specs: ['100% Cobre calibre 23 AWG', 'Soporta Gigabit y PoE', 'Venta por metro o bobina'],
    images: [],
    imageUrl: ''
  },
  {
    id: 'prod-108',
    sku: 'NET-AP-U6',
    barcode: '750104500108',
    name: 'Access Point Ubiquiti UniFi U6+ Dual Band WiFi 6',
    category: 'redes',
    cost: 1980.00,
    price: 2890.00,
    stock: 3,
    minStock: 2,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Punto de acceso empresarial WiFi 6 de alta densidad para hoteles, clínicas, restaurantes y oficinas.',
    specs: ['WiFi 6 MIMO 2x2', 'Soporta +300 clientes concurrentes', 'Alimentación PoE'],
    images: [],
    imageUrl: ''
  },
  {
    id: 'prod-109',
    sku: 'SW-MS365',
    barcode: '750104500109',
    name: 'Licencia Oficial Microsoft 365 (1TB OneDrive + Apps)',
    category: 'software',
    cost: 780.00,
    price: 1290.00,
    stock: 20,
    minStock: 4,
    unit: 'licencia',
    isService: false,
    publicVisible: true,
    description: 'Suscripción genuina Microsoft 365 con Word, Excel, PowerPoint, Outlook y 1 TB de almacenamiento OneDrive en la nube.',
    specs: ['100% Original Microsoft', '1 TB OneDrive incluido', 'Instalación y configuración asistida'],
    images: ['/images/products/microsoft-365.svg'],
    imageUrl: '/images/products/microsoft-365.svg'
  },
  {
    id: 'prod-110',
    sku: 'SW-OFFICE24',
    barcode: '750104500110',
    name: 'Licencia Perpetua Microsoft Office Hogar 2024',
    category: 'software',
    cost: 1450.00,
    price: 2290.00,
    stock: 15,
    minStock: 3,
    unit: 'licencia',
    isService: false,
    publicVisible: true,
    description: 'Pago único sin rentas anuales para Windows o Mac con aplicaciones clásicas de Office en licencia permanente.',
    specs: ['Pago único vitalicio', 'Sin mensualidades', 'Activación vinculada a cuenta'],
    images: ['/images/products/office-2024.svg'],
    imageUrl: '/images/products/office-2024.svg'
  },
  {
    id: 'prod-111',
    sku: 'REF-SSD-480',
    barcode: '750104500111',
    name: 'Unidad de Estado Sólido SSD 480GB Kingston SATA III',
    category: 'refacciones',
    cost: 520.00,
    price: 890.00,
    stock: 4,
    minStock: 3,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Reemplazo de alta velocidad para acelerar laptops y PCs de escritorio hasta 10 veces frente a discos mecánicos.',
    specs: ['480GB SATA 3 6Gb/s', 'Lectura 500MB/s', '3 años de garantía'],
    images: [],
    imageUrl: ''
  },
  {
    id: 'prod-112',
    sku: 'REF-RAM-8G',
    barcode: '750104500112',
    name: 'Memoria RAM DDR4 8GB 3200MHz SODIMM Laptop',
    category: 'refacciones',
    cost: 340.00,
    price: 620.00,
    stock: 7,
    minStock: 3,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Módulo de memoria RAM DDR4 para actualización de laptops y Mini PCs de trabajo.',
    specs: ['8GB DDR4 3200MHz', 'Formato SODIMM', 'Instalación sin costo en taller'],
    images: [],
    imageUrl: ''
  },
  {
    id: 'prod-113',
    sku: 'SRV-MANT-PC',
    barcode: '750104500113',
    name: 'Mantenimiento Preventivo Completo + Optimización',
    category: 'servicios',
    cost: 80.00,
    price: 350.00,
    stock: 999,
    minStock: 0,
    unit: 'servicio',
    isService: true,
    publicVisible: true,
    description: 'Limpieza física interna, cambio de pasta térmica de alto rendimiento, limpieza lógica y optimización del sistema.',
    specs: ['Pasta térmica premium', 'Limpieza de ventiladores', 'Garantía de servicio Fiberlink'],
    images: [],
    imageUrl: ''
  }
];

function canvasToDataUrl(canvas, mime, quality) {
  return new Promise((resolve) => {
    try {
      const dataUrl = canvas.toDataURL(mime, quality);
      resolve(dataUrl);
    } catch (_) {
      resolve('');
    }
  });
}

export const storeService = {
  /**
   * Compress a File / Blob image in the browser to WebP (with JPEG fallback)
   * so every uploaded photograph stays crisp (~30–110 KB) and fits cleanly
   * under Firestore document size limits.
   */
  async compressProductImage(file) {
    if (!file || !file.type?.startsWith('image/')) {
      throw new Error('Selecciona un archivo de imagen válido (JPG, PNG, WEBP).');
    }

    const rawDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(String(ev.target?.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
      reader.readAsDataURL(file);
    });

    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('El archivo no es una imagen válida o está dañado.'));
      el.src = rawDataUrl;
    });

    const dimensions = [840, 680, 520];
    const qualities = [0.80, 0.68, 0.56, 0.44];

    for (const maxDim of dimensions) {
      let w = img.width || maxDim;
      let h = img.height || maxDim;
      if (w > maxDim || h > maxDim) {
        if (w >= h) {
          h = Math.max(1, Math.round((h * maxDim) / w));
          w = maxDim;
        } else {
          w = Math.max(1, Math.round((w * maxDim) / h));
          h = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      for (const q of qualities) {
        const webp = await canvasToDataUrl(canvas, 'image/webp', q);
        if (webp && webp.startsWith('data:image/webp') && webp.length <= 125000) {
          return webp;
        }
        const jpg = await canvasToDataUrl(canvas, 'image/jpeg', q);
        if (jpg && jpg.length <= 125000) {
          return jpg;
        }
      }
    }

    throw new Error('La fotografía es demasiado compleja o pesada incluso tras comprimir. Usa una imagen más ligera.');
  },

  /**
   * Validate an external or asset image URL before adding it to gallery.
   */
  validatePhotoUrl(url) {
    const clean = String(url || '').trim();
    if (!clean) throw new Error('Ingresa una URL de imagen válida.');
    if (clean.length > MAX_IMAGE_CHARS) {
      throw new Error('La URL de la imagen excede el límite permitido.');
    }
    const isAllowed =
      clean.startsWith('https://') ||
      clean.startsWith('http://') ||
      clean.startsWith('/images/') ||
      clean.startsWith('data:image/');
    if (!isAllowed) {
      throw new Error('La fotografía debe ser un enlace https:// o una imagen subida.');
    }
    return clean;
  },

  /**
   * Seed starter catalog & initial Kardex once when /products is empty (Admin only).
   */
  async seedInitialProductsIfEmpty(actorName = 'Administrador') {
    if (!auth.currentUser) return;
    try {
      const checkSnap = await getDocs(query(collection(db, 'products'), limit(1)));
      if (!checkSnap.empty) return;

      const batch = writeBatch(db);
      STARTER_PRODUCTS.forEach((p, idx) => {
        const prodRef = doc(db, 'products', p.id);
        batch.set(prodRef, {
          ...p,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        if (!p.isService && Number(p.stock) > 0) {
          const movId = `kdx-seed-${p.id}`;
          const movRef = doc(db, 'inventory_movements', movId);
          batch.set(movRef, {
            id: movId,
            folio: `KDX-${1001 + idx}`,
            date: new Date().toISOString(),
            productId: p.id,
            sku: p.sku,
            productName: p.name,
            category: p.category,
            type: 'entrada',
            reason: 'Inventario inicial sincronizado en Firestore',
            reference: 'SEED-CATALOGO',
            stockBefore: 0,
            quantity: Number(p.stock),
            delta: Number(p.stock),
            stockAfter: Number(p.stock),
            unitCost: Number(p.cost) || 0,
            totalCost: (Number(p.stock) || 0) * (Number(p.cost) || 0),
            user: sanitizeStr(actorName, 120, 'Sistema Fiberlink'),
            createdAt: serverTimestamp()
          });
        }
      });

      await batch.commit();
    } catch (err) {
      console.warn('[StoreService] Seed skipped or failed:', err?.message || err);
    }
  },

  /**
   * List products from Firestore (Public gets publicVisible == true; Staff gets all).
   */
  async getProducts(params = {}) {
    let list = [];
    const wantPublicOnly = params.public === true || !auth.currentUser;

    try {
      const q = wantPublicOnly
        ? query(collection(db, 'products'), where('publicVisible', '==', true))
        : query(collection(db, 'products'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      list = snap.docs.map((d) => normalizeProductDoc(d.id, d.data()));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'products');
    }

    if (params.category && params.category !== 'all') {
      list = list.filter((p) => p.category === params.category);
    }
    if (params.lowStock) {
      list = list.filter((p) => !p.isService && Number(p.stock) <= Number(p.minStock || 3));
    }
    if (params.q) {
      const qStr = String(params.q).toLowerCase();
      list = list.filter((p) =>
        (p.name && p.name.toLowerCase().includes(qStr)) ||
        (p.sku && p.sku.toLowerCase().includes(qStr)) ||
        (p.barcode && p.barcode.toLowerCase().includes(qStr)) ||
        (p.description && p.description.toLowerCase().includes(qStr))
      );
    }

    return list;
  },

  /**
   * Real-time public catalog subscription (safe for unauthenticated visitors via where('publicVisible', '==', true)).
   */
  subscribePublicProducts(onData, onError) {
    const q = query(collection(db, 'products'), where('publicVisible', '==', true));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => normalizeProductDoc(d.id, d.data()))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        onData(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'products');
        } catch (wrapped) {
          if (typeof onError === 'function') onError(wrapped);
        }
      }
    );
  },

  /**
   * Real-time staff catalog subscription (all products including hidden).
   */
  subscribeAllProducts(onData, onError) {
    if (!auth.currentUser) return () => {};
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => normalizeProductDoc(d.id, d.data()));
        onData(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'products');
        } catch (wrapped) {
          if (typeof onError === 'function') onError(wrapped);
        }
      }
    );
  },

  /**
   * List Kardex movements (Staff only).
   */
  async getInventoryMovements(params = {}) {
    if (!auth.currentUser) return [];
    let list = [];
    try {
      const q = query(collection(db, 'inventory_movements'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      list = snap.docs.map((d) => normalizeMovementDoc(d.id, d.data()));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'inventory_movements');
    }

    if (params.productId && params.productId !== 'all') {
      list = list.filter((m) => m.productId === params.productId || m.sku === params.productId);
    }
    if (params.type && params.type !== 'all') {
      if (params.type === 'entradas') list = list.filter((m) => m.delta > 0);
      else if (params.type === 'salidas') list = list.filter((m) => m.delta < 0);
      else list = list.filter((m) => m.type === params.type);
    }
    return list;
  },

  /**
   * Real-time Kardex movements subscription (Staff only).
   */
  subscribeInventoryMovements(onData, onError) {
    if (!auth.currentUser) return () => {};
    const q = query(collection(db, 'inventory_movements'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => normalizeMovementDoc(d.id, d.data()));
        onData(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'inventory_movements');
        } catch (wrapped) {
          if (typeof onError === 'function') onError(wrapped);
        }
      }
    );
  },

  /**
   * Create a new product/service and atomically log initial Kardex entry if stock > 0.
   */
  async createProduct(payload, actorName = '') {
    const productId = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const name = sanitizeStr(payload.name, 180);
    if (!name) throw new Error('El nombre del producto o servicio es obligatorio.');

    const category = sanitizeCategory(payload.category);
    const isService = Boolean(payload.isService || category === 'servicios');
    const sku = sanitizeStr(payload.sku || `FL-${Date.now().toString().slice(-4)}`, 64).toUpperCase();
    const barcode = sanitizeStr(payload.barcode || `7501045${Date.now().toString().slice(-6)}`, 64);
    const cost = Math.max(0, Math.min(10000000, parseFloat(payload.cost) || 0));
    const price = Math.max(0, Math.min(10000000, parseFloat(payload.price) || 0));
    const stock = isService ? 999 : Math.max(0, Math.min(1000000, parseInt(payload.stock, 10) || 0));
    const minStock = isService ? 0 : Math.max(0, Math.min(1000000, parseInt(payload.minStock, 10) || 0));
    const unit = sanitizeStr(payload.unit || (isService ? 'servicio' : 'pza'), 32);
    const publicVisible = payload.publicVisible !== false;
    const description = sanitizeStr(payload.description, 2000, '');
    const specs = sanitizeSpecs(payload.specs);
    const images = sanitizeImages(payload.images, payload.imageUrl);
    const imageUrl = images[0] || '';
    const author = sanitizeStr(actorName || auth.currentUser?.displayName || 'Staff Fiberlink', 120);

    const productDoc = {
      id: productId,
      sku,
      barcode,
      name,
      category,
      cost,
      price,
      stock,
      minStock,
      unit,
      isService,
      publicVisible,
      description,
      specs,
      images,
      imageUrl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const estimatedSize = JSON.stringify({ ...productDoc, createdAt: '', updatedAt: '' }).length;
    if (estimatedSize > MAX_DOC_ESTIMATED_CHARS) {
      throw new Error('Las fotografías juntas exceden el tamaño permitido por producto. Reduce el número o peso de imágenes.');
    }

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'products', productId), productDoc);

      if (!isService && stock > 0) {
        const movId = `kdx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        batch.set(doc(db, 'inventory_movements', movId), {
          id: movId,
          folio: generateKardexFolio(),
          date: new Date().toISOString(),
          productId,
          sku,
          productName: name,
          category,
          type: 'entrada',
          reason: 'Inventario inicial al dar de alta el artículo',
          reference: 'ALTA-INICIAL',
          stockBefore: 0,
          quantity: stock,
          delta: stock,
          stockAfter: stock,
          unitCost: cost,
          totalCost: stock * cost,
          user: author,
          createdAt: serverTimestamp()
        });
      }

      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `products/${productId}`);
    }

    return normalizeProductDoc(productId, {
      ...productDoc,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  },

  /**
   * Update product details, photographs, visibility, or stock (atomically recording Kardex delta).
   */
  async updateProduct(id, payload, actorName = '') {
    const prodRef = doc(db, 'products', id);
    let snap;
    try {
      snap = await getDoc(prodRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `products/${id}`);
    }
    if (!snap || !snap.exists()) {
      throw new Error('Producto no encontrado en Firestore.');
    }

    const prev = normalizeProductDoc(snap.id, snap.data());
    const category = payload.category !== undefined ? sanitizeCategory(payload.category) : prev.category;
    const isService = payload.isService !== undefined ? Boolean(payload.isService) : prev.isService;
    const sku = payload.sku !== undefined ? sanitizeStr(payload.sku, 64, prev.sku).toUpperCase() : prev.sku;
    const barcode = payload.barcode !== undefined ? sanitizeStr(payload.barcode, 64, '') : prev.barcode;
    const name = payload.name !== undefined ? sanitizeStr(payload.name, 180, prev.name) : prev.name;
    const cost = payload.cost !== undefined ? Math.max(0, Math.min(10000000, parseFloat(payload.cost) || 0)) : prev.cost;
    const price = payload.price !== undefined ? Math.max(0, Math.min(10000000, parseFloat(payload.price) || 0)) : prev.price;
    const stock = payload.stock !== undefined
      ? (isService ? 999 : Math.max(0, Math.min(1000000, parseInt(payload.stock, 10) || 0)))
      : prev.stock;
    const minStock = payload.minStock !== undefined
      ? (isService ? 0 : Math.max(0, Math.min(1000000, parseInt(payload.minStock, 10) || 0)))
      : prev.minStock;
    const unit = payload.unit !== undefined ? sanitizeStr(payload.unit, 32, prev.unit) : prev.unit;
    const publicVisible = payload.publicVisible !== undefined ? Boolean(payload.publicVisible) : prev.publicVisible;
    const description = payload.description !== undefined ? sanitizeStr(payload.description, 2000, '') : prev.description;
    const specs = payload.specs !== undefined ? sanitizeSpecs(payload.specs) : prev.specs;
    const images = (payload.images !== undefined || payload.imageUrl !== undefined)
      ? sanitizeImages(payload.images, payload.imageUrl)
      : prev.images;
    const imageUrl = images[0] || '';
    const author = sanitizeStr(actorName || auth.currentUser?.displayName || 'Staff Fiberlink', 120);

    const updates = {
      sku,
      barcode,
      name,
      category,
      cost,
      price,
      stock,
      minStock,
      unit,
      isService,
      publicVisible,
      description,
      specs,
      images,
      imageUrl,
      updatedAt: serverTimestamp()
    };

    const estimatedSize = JSON.stringify({ ...updates, id: prev.id, updatedAt: '' }).length;
    if (estimatedSize > MAX_DOC_ESTIMATED_CHARS) {
      throw new Error('Las fotografías juntas exceden el tamaño permitido por producto. Reduce el número o peso de imágenes.');
    }

    try {
      const batch = writeBatch(db);
      batch.update(prodRef, updates);

      if (!isService && payload.stock !== undefined && stock !== prev.stock) {
        const delta = stock - prev.stock;
        const movId = `kdx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        batch.set(doc(db, 'inventory_movements', movId), {
          id: movId,
          folio: generateKardexFolio(),
          date: new Date().toISOString(),
          productId: prev.id,
          sku,
          productName: name,
          category,
          type: 'ajuste_conteo',
          reason: 'Actualización directa de existencia en ficha de producto',
          reference: 'EDICION-FICHA',
          stockBefore: prev.stock,
          quantity: Math.abs(delta),
          delta,
          stockAfter: stock,
          unitCost: cost,
          totalCost: Math.abs(delta) * cost,
          user: author,
          createdAt: serverTimestamp()
        });
      }

      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${id}`);
    }

    return normalizeProductDoc(id, {
      ...snap.data(),
      ...updates,
      updatedAt: new Date().toISOString()
    });
  },

  /**
   * Adjust warehouse stock (+ Entrada / Ajuste físico) and atomically log Kardex entry.
   */
  async adjustStock(id, payload = {}, actorName = '') {
    const prodRef = doc(db, 'products', id);
    let snap;
    try {
      snap = await getDoc(prodRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `products/${id}`);
    }
    if (!snap || !snap.exists()) {
      throw new Error('Producto no encontrado en Firestore.');
    }

    const prev = normalizeProductDoc(snap.id, snap.data());
    const prevStock = prev.stock;
    let nextStock = prevStock;

    if (payload.newStock !== undefined && payload.newStock !== null && payload.newStock !== '') {
      nextStock = Math.max(0, Math.min(1000000, parseInt(payload.newStock, 10) || 0));
    } else {
      const reqDelta = parseInt(payload.delta, 10) || 0;
      nextStock = Math.max(0, Math.min(1000000, prevStock + reqDelta));
    }
    const delta = nextStock - prevStock;
    const unitCost = (payload.unitCost !== undefined && parseFloat(payload.unitCost) > 0)
      ? Math.min(10000000, parseFloat(payload.unitCost))
      : prev.cost;
    const movType = sanitizeMovementType(payload.type || (delta >= 0 ? 'entrada' : 'ajuste_salida'));
    const reason = sanitizeStr(payload.reason || (delta >= 0 ? 'Entrada de inventario' : 'Ajuste de inventario'), 300);
    const reference = sanitizeStr(payload.reference || 'AJUSTE', 80).toUpperCase();
    const author = sanitizeStr(actorName || payload.user || auth.currentUser?.displayName || 'Administrador', 120);

    const movId = `kdx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const prodUpdates = {
      stock: nextStock,
      updatedAt: serverTimestamp()
    };
    if (payload.unitCost !== undefined && parseFloat(payload.unitCost) > 0 && unitCost !== prev.cost) {
      prodUpdates.cost = unitCost;
    }

    try {
      const batch = writeBatch(db);
      batch.update(prodRef, prodUpdates);
      batch.set(doc(db, 'inventory_movements', movId), {
        id: movId,
        folio: generateKardexFolio(),
        date: new Date().toISOString(),
        productId: prev.id,
        sku: prev.sku,
        productName: prev.name,
        category: prev.category,
        type: movType,
        reason,
        reference,
        stockBefore: prevStock,
        quantity: Math.abs(delta),
        delta,
        stockAfter: nextStock,
        unitCost,
        totalCost: Math.abs(delta) * unitCost,
        user: author,
        createdAt: serverTimestamp()
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${id}`);
    }

    return {
      product: { ...prev, stock: nextStock, cost: unitCost },
      delta
    };
  },

  /**
   * Synchronize POS sale or Workshop part consumption with Firestore stock & Kardex.
   */
  async deductStockForSale(items = [], referenceFolio = 'POS', movType = 'salida_venta', actorName = '') {
    if (!auth.currentUser || !Array.isArray(items) || items.length === 0) return;
    const author = sanitizeStr(actorName || auth.currentUser?.displayName || 'Cajero POS', 120);
    const refStr = sanitizeStr(referenceFolio, 80).toUpperCase();

    const grouped = new Map();
    items.forEach((it) => {
      if (!it?.productId) return;
      const qty = Math.max(0, Number(it.qty) || 1);
      if (qty <= 0) return;
      grouped.set(it.productId, (grouped.get(it.productId) || 0) + qty);
    });

    if (grouped.size === 0) return;

    try {
      const batch = writeBatch(db);
      let ops = 0;

      for (const [prodId, qty] of grouped.entries()) {
        const prodRef = doc(db, 'products', prodId);
        const snap = await getDoc(prodRef);
        if (!snap.exists()) continue;
        const p = normalizeProductDoc(snap.id, snap.data());
        if (p.isService) continue;

        const nextStock = Math.max(0, p.stock - qty);
        const delta = nextStock - p.stock;
        batch.update(prodRef, { stock: nextStock, updatedAt: serverTimestamp() });

        const movId = `kdx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        batch.set(doc(db, 'inventory_movements', movId), {
          id: movId,
          folio: generateKardexFolio(),
          date: new Date().toISOString(),
          productId: p.id,
          sku: p.sku,
          productName: p.name,
          category: p.category,
          type: sanitizeMovementType(movType),
          reason: movType === 'taller' ? 'Salida por uso de refacción en Taller' : 'Salida por Venta en Terminal POS',
          reference: refStr,
          stockBefore: p.stock,
          quantity: Math.abs(delta),
          delta,
          stockAfter: nextStock,
          unitCost: p.cost,
          totalCost: Math.abs(delta) * p.cost,
          user: author,
          createdAt: serverTimestamp()
        });
        ops++;
      }

      if (ops > 0) await batch.commit();
    } catch (err) {
      console.warn('[StoreService] Stock sync after sale skipped:', err?.message || err);
    }
  },

  /**
   * Delete product from Firestore catalog.
   */
  async deleteProduct(id) {
    try {
      await deleteDoc(doc(db, 'products', id));
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
    }
  }
};

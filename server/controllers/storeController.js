// ==========================================
// STORE & INVENTORY CONTROLLER (Tienda, Almacén, Movimientos y Kardex)
// ==========================================

import { readCollection, writeCollection, logActivity, recordInventoryMovement } from '../db/jsonStore.js';

export function handleListProducts(searchParams) {
  let products = readCollection('products');

  const category = searchParams?.get('category');
  const publicOnly = searchParams?.get('public');
  const lowStock = searchParams?.get('lowStock');
  const q = searchParams?.get('q');

  if (publicOnly === 'true') {
    products = products.filter(p => p.publicVisible !== false);
  }
  if (category && category !== 'all') {
    products = products.filter(p => p.category === category);
  }
  if (lowStock === 'true') {
    products = products.filter(p => !p.isService && Number(p.stock) <= Number(p.minStock || 3));
  }
  if (q) {
    const query = q.toLowerCase();
    products = products.filter(p =>
      (p.name && p.name.toLowerCase().includes(query)) ||
      (p.sku && p.sku.toLowerCase().includes(query)) ||
      (p.barcode && String(p.barcode).toLowerCase().includes(query)) ||
      (p.category && p.category.toLowerCase().includes(query)) ||
      (p.description && p.description.toLowerCase().includes(query))
    );
  }

  return { status: 200, data: products };
}

export function handleCreateProduct(body, currentUser) {
  const products = readCollection('products');

  if (!body.name || body.price === undefined) {
    return { status: 400, data: { error: 'Nombre y precio de venta son obligatorios.' } };
  }

  const sku = (body.sku || `FL-${Date.now().toString().slice(-4)}`).trim().toUpperCase();
  const barcode = (body.barcode || `7501045${Date.now().toString().slice(-6)}`).trim();
  const isService = Boolean(body.isService || body.category === 'servicios');
  const initialStock = isService ? 999 : (parseInt(body.stock, 10) || 0);
  const cost = parseFloat(body.cost) || 0;
  const author = currentUser?.name || 'Admin';

  const newProduct = {
    id: `prod-${Date.now()}`,
    sku,
    barcode,
    name: body.name.trim(),
    category: body.category || 'pos',
    cost,
    price: parseFloat(body.price) || 0,
    stock: initialStock,
    minStock: isService ? 0 : (parseInt(body.minStock, 10) || 3),
    unit: body.unit || (isService ? 'servicio' : 'pza'),
    isService,
    publicVisible: body.publicVisible !== undefined ? Boolean(body.publicVisible) : true,
    description: (body.description || '').trim(),
    specs: Array.isArray(body.specs)
      ? body.specs
      : String(body.specs || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  products.unshift(newProduct);
  writeCollection('products', products);

  if (!isService && initialStock > 0) {
    recordInventoryMovement({
      productId: newProduct.id,
      sku: newProduct.sku,
      productName: newProduct.name,
      category: newProduct.category,
      type: 'entrada',
      reason: 'Inventario inicial al dar de alta el artículo',
      reference: 'ALTA-INICIAL',
      stockBefore: 0,
      delta: initialStock,
      stockAfter: initialStock,
      unitCost: cost,
      user: author
    });
  }

  logActivity({
    user: author,
    role: currentUser?.role || 'admin',
    module: 'store',
    action: `Agregó producto/servicio [${newProduct.sku}] ${newProduct.name} ($${newProduct.price.toFixed(2)})`
  });

  return { status: 201, data: { success: true, product: newProduct } };
}

export function handleUpdateProduct(id, body, currentUser) {
  const products = readCollection('products');
  const idx = products.findIndex(p => p.id === id || p.sku === id);
  if (idx === -1) {
    return { status: 404, data: { error: 'Producto no encontrado' } };
  }

  const p = products[idx];
  const prevStock = Number(p.stock) || 0;
  const author = currentUser?.name || 'Admin';

  if (body.sku !== undefined) p.sku = body.sku.trim().toUpperCase();
  if (body.barcode !== undefined) p.barcode = String(body.barcode).trim();
  if (body.name !== undefined) p.name = body.name.trim();
  if (body.category !== undefined) p.category = body.category;
  if (body.cost !== undefined) p.cost = parseFloat(body.cost) || 0;
  if (body.price !== undefined) p.price = parseFloat(body.price) || 0;
  if (body.stock !== undefined) p.stock = parseInt(body.stock, 10) || 0;
  if (body.minStock !== undefined) p.minStock = parseInt(body.minStock, 10) || 0;
  if (body.unit !== undefined) p.unit = body.unit;
  if (body.isService !== undefined) p.isService = Boolean(body.isService);
  if (body.publicVisible !== undefined) p.publicVisible = Boolean(body.publicVisible);
  if (body.description !== undefined) p.description = body.description.trim();
  if (body.specs !== undefined) {
    p.specs = Array.isArray(body.specs)
      ? body.specs
      : String(body.specs)
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
  }
  p.updatedAt = new Date().toISOString();

  writeCollection('products', products);

  const newStock = Number(p.stock) || 0;
  if (!p.isService && body.stock !== undefined && newStock !== prevStock) {
    const delta = newStock - prevStock;
    recordInventoryMovement({
      productId: p.id,
      sku: p.sku,
      productName: p.name,
      category: p.category,
      type: 'ajuste_conteo',
      reason: 'Actualización directa de existencia en ficha de producto',
      reference: 'EDICION-FICHA',
      stockBefore: prevStock,
      delta,
      stockAfter: newStock,
      unitCost: p.cost,
      user: author
    });
  }

  logActivity({
    user: author,
    role: currentUser?.role || 'admin',
    module: 'store',
    action: `Actualizó producto [${p.sku}] ${p.name}`
  });

  return { status: 200, data: { success: true, product: p } };
}

export function handleAdjustStock(id, body, currentUser) {
  const products = readCollection('products');
  const idx = products.findIndex(p => p.id === id || p.sku === id);
  if (idx === -1) {
    return { status: 404, data: { error: 'Producto no encontrado' } };
  }

  const prod = products[idx];
  const prev = Number(prod.stock) || 0;
  const author = currentUser?.name || body.user || 'Administrador';

  let delta = 0;
  let nextStock = prev;

  if (body.newStock !== undefined && body.newStock !== null && body.newStock !== '') {
    nextStock = Math.max(0, parseInt(body.newStock, 10) || 0);
    delta = nextStock - prev;
  } else {
    delta = parseInt(body.delta, 10) || 0;
    nextStock = Math.max(0, prev + delta);
    delta = nextStock - prev;
  }

  if (body.unitCost !== undefined && parseFloat(body.unitCost) > 0) {
    prod.cost = parseFloat(body.unitCost);
  }

  prod.stock = nextStock;
  prod.updatedAt = new Date().toISOString();
  writeCollection('products', products);

  const movType = body.type || (delta >= 0 ? 'entrada' : 'ajuste_salida');
  const reason = (body.reason || (delta >= 0 ? 'Entrada de inventario' : 'Ajuste de inventario')).trim();
  const reference = (body.reference || 'AJUSTE').trim().toUpperCase();

  const movement = recordInventoryMovement({
    productId: prod.id,
    sku: prod.sku,
    productName: prod.name,
    category: prod.category,
    type: movType,
    reason,
    reference,
    stockBefore: prev,
    delta,
    stockAfter: nextStock,
    unitCost: parseFloat(body.unitCost) || prod.cost || 0,
    user: author
  });

  logActivity({
    user: author,
    role: currentUser?.role || 'admin',
    module: 'store',
    action: `Movimiento de inventario [${prod.sku}]: ${prev} ➔ ${nextStock} (${delta >= 0 ? '+' + delta : delta}) - ${reason}`
  });

  return {
    status: 200,
    data: {
      success: true,
      product: prod,
      movement
    }
  };
}

export function handleListInventoryMovements(searchParams) {
  let movements = readCollection('inventoryMovements');
  const productId = searchParams?.get('productId');
  const sku = searchParams?.get('sku');
  const type = searchParams?.get('type');
  const q = searchParams?.get('q');

  if (productId && productId !== 'all') {
    movements = movements.filter(m => m.productId === productId || m.sku === productId);
  }
  if (sku) {
    movements = movements.filter(m => m.sku && m.sku.toLowerCase() === sku.toLowerCase());
  }
  if (type && type !== 'all') {
    if (type === 'entradas') {
      movements = movements.filter(m => Number(m.delta) > 0);
    } else if (type === 'salidas') {
      movements = movements.filter(m => Number(m.delta) < 0);
    } else {
      movements = movements.filter(m => m.type === type);
    }
  }
  if (q) {
    const query = q.toLowerCase();
    movements = movements.filter(m =>
      (m.folio && m.folio.toLowerCase().includes(query)) ||
      (m.sku && m.sku.toLowerCase().includes(query)) ||
      (m.productName && m.productName.toLowerCase().includes(query)) ||
      (m.reason && m.reason.toLowerCase().includes(query)) ||
      (m.reference && m.reference.toLowerCase().includes(query)) ||
      (m.user && m.user.toLowerCase().includes(query))
    );
  }

  movements.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { status: 200, data: movements };
}

export function handleGetProductKardex(productId) {
  const products = readCollection('products');
  const product = products.find(p => p.id === productId || p.sku === productId);
  if (!product) {
    return { status: 404, data: { error: 'Producto no encontrado para Kardex' } };
  }

  const allMovements = readCollection('inventoryMovements');
  const movements = allMovements
    .filter(m => m.productId === product.id || m.sku === product.sku)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalEntries = movements.filter(m => Number(m.delta) > 0).reduce((s, m) => s + Math.abs(Number(m.delta) || 0), 0);
  const totalExits = movements.filter(m => Number(m.delta) < 0).reduce((s, m) => s + Math.abs(Number(m.delta) || 0), 0);

  return {
    status: 200,
    data: {
      product,
      summary: {
        currentStock: product.stock,
        minStock: product.minStock || 0,
        unitCost: product.cost || 0,
        inventoryValueCost: (Number(product.stock) || 0) * (parseFloat(product.cost) || 0),
        inventoryValueRetail: (Number(product.stock) || 0) * (parseFloat(product.price) || 0),
        totalEntries,
        totalExits,
        movementsCount: movements.length
      },
      movements
    }
  };
}

export function handleDeleteProduct(id, currentUser) {
  let products = readCollection('products');
  const target = products.find(p => p.id === id || p.sku === id);
  if (!target) {
    return { status: 404, data: { error: 'Producto no encontrado' } };
  }

  products = products.filter(p => p.id !== id && p.sku !== id);
  writeCollection('products', products);

  logActivity({
    user: currentUser?.name || 'Admin',
    role: currentUser?.role || 'admin',
    module: 'store',
    action: `Eliminó producto [${target.sku}] ${target.name}`
  });

  return { status: 200, data: { success: true } };
}

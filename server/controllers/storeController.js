// ==========================================
// STORE & INVENTORY CONTROLLER (Tienda / Catálogo)
// ==========================================

import { readCollection, writeCollection, logActivity } from '../db/jsonStore.js';

export function handleListProducts(searchParams) {
  let products = readCollection('products');

  const category = searchParams.get('category');
  const publicOnly = searchParams.get('public');
  const lowStock = searchParams.get('lowStock');
  const q = searchParams.get('q');

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

  const newProduct = {
    id: `prod-${Date.now()}`,
    sku,
    barcode,
    name: body.name.trim(),
    category: body.category || 'pos',
    cost: parseFloat(body.cost) || 0,
    price: parseFloat(body.price) || 0,
    stock: isService ? 999 : (parseInt(body.stock, 10) || 0),
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

  logActivity({
    user: currentUser?.name || 'Admin',
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

  logActivity({
    user: currentUser?.name || 'Admin',
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

  const delta = parseInt(body.delta, 10) || 0;
  const reason = (body.reason || 'Ajuste manual').trim();
  const prev = Number(products[idx].stock) || 0;
  products[idx].stock = Math.max(0, prev + delta);
  products[idx].updatedAt = new Date().toISOString();

  writeCollection('products', products);

  logActivity({
    user: currentUser?.name || 'Admin',
    role: currentUser?.role || 'admin',
    module: 'store',
    action: `Ajuste de stock [${products[idx].sku}]: ${prev} ➔ ${products[idx].stock} (${delta >= 0 ? '+' + delta : delta}) - ${reason}`
  });

  return { status: 200, data: { success: true, product: products[idx] } };
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
